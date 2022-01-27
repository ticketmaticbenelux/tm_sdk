"use strict"

const api = require('tm_api')
const moment = require('moment')
const R = require('ramda')
const orders = require('./orders')

const { descend, fromPairs, sortWith, sum, pipe, pluck, prop } = R

async function getConfigForKey(client, [key, sql]) {
  const res = await api.export(client, sql)
  return [key, res]
}

exports.getConfig = async function(client) {
  const l = client.language
  const queries = {
    contacttitles: `select id,name,sex,languagecode from conf.customertitle where not isarchived and not isinternal order by name`,
    addresstypes: `select id,name${l} as name from tm.contactaddresstype where not isarchived order by name${l}`,
    phonenumbertypes: `select id,name${l} as name from tm.contactphonenumbertype where not isarchived order by name${l}`,
    relationtypes: `select id,name${l} as name from tm.relationtype where not isarchived`,
    countries: `select code, name${l} as name from conf.country order by priority`,
  }
  const configs = await Promise.all(
    Object.entries(queries).map(R.curry(getConfigForKey)(client))
  )
  return fromPairs(configs)
}

exports.getInfo = async function(client, contactid) {
    const sql = `
      select 
        customertitleid, firstname, middlename, lastname, date(birthdate) as birthdate, languagecode
      from tm.contact
      where id = ${contactid}
    `
    const res = await api.export(client, sql)
    if (res.length === 0) {
      return null
    }
    return R.head(res)
}

exports.getAddresses = async function(client, contactid) {
  const sql = `
    select id, typeid, street1, street2, street3, street4, zip, city, countrycode
    from tm.contactaddress
    where contactid = ${contactid}
    order by sortorder
  `
  return api.export(client, sql)
}

exports.getPhonenumbers = async function(client, contactid) {
  const sql = `
    select id, typeid, phonenumber as number
    from tm.contactphonenumber
    where contactid = ${contactid}
    order by sortorder
  `
  return api.export(client, sql)
}

exports.getRelationtypes = async function(client, contactid) {
  const sql = `
    select relationtypeid
    from tm.contactrelationtype
    where contactid = ${contactid}
  `
  const result = await api.export(client, sql)
  if (R.type(result) !== "Array") {
    throw new Error("Could not fetch contact relationtypes")
  }
  return R.pluck("relationtypeid", result)  
}

exports.getCreditInfo = async function(client, contactid, filter = null) {
    const l = client.language
    const sqlWhereVoucher = filter ? `and v.id in (${filter.join(",")})` : ""
    const vouchers = await api.export(client, `
        select 
            c.id, 
            case when o.deliverystatus = 2602 then c.code else '' end as code,
            c.amount, 
            c.amountused, 
            c.createdts,
            c.expiryts,
            coalesce((c.expiryts < now()),false) as expired,
            v.name${l} as name,
            o.id as orderid,
            o.deliverystatus,
            v.id as voucherid
        from tm.vouchercode c
        inner join tm.orderproduct op on op.vouchercodeid = c.id
        inner join tm.order o on o.id = op.orderid
        inner join tm.voucher v on v.id = c.voucherid
        where 
            o.contactid = ${contactid}
            and inactive is false
            and (c.expiryts + interval '6 month' > now() or c.expiryts is null)
            and v.typeid = 24003 -- Payment Voucher
            ${sqlWhereVoucher}
        order by c.id desc
  `)

  if (vouchers.length === 0) {
    const meta = { 
      totalamount: 0,
      totalused: 0,
      saldo: 0,
    }
    return {
      vouchers,
      meta,
    }
  }

  const totalamount = pipe(pluck("amount"), sum)(vouchers)
  const totalused = pipe(pluck("amountused"), sum)(vouchers)
  const meta = {
      totalamount,
      totalused,
      saldo: (totalamount-totalused),
  }
  return {
    vouchers,
    meta,
  }    
}

exports.getPricetypeVoucherInfo = async function(client, contactid, filter = null) {
    const l = client.language
    const sqlWhereVoucher = filter ? `and v.id in (${filter.join(",")})` : ""
    const vouchers = await api.export(client, `
        select 
            c.id, 
            case when o.deliverystatus = 2602 then c.code else '' end as code,
            c.createdts,
            c.expiryts,
            coalesce((c.expiryts < now()),false) as expired,
            v.name${l} as name,
            o.id as orderid,
            o.deliverystatus,
            coalesce(sum(nbr),0) totalused,
            v.validity->'maxusages' maxusages
        from tm.vouchercode c
        inner join tm.orderproduct op on op.vouchercodeid = c.id
        inner join tm.order o on o.id = op.orderid
        inner join tm.voucher v on v.id = c.voucherid
        left join tm.vouchercodeusage vcu on vcu.vouchercodeid = c.id
        where 
            o.contactid = ${contactid}
            and inactive is false
            and (c.expiryts + interval '6 month' > now() or c.expiryts is null)
            and v.typeid = 24001 -- Pricetype Voucher
            ${sqlWhereVoucher}
        group by c.id, c.code, c.createdts, c.expiryts, v.namenl, o.id, o.deliverystatus, v.validity
        order by c.id desc
    `)

    return {
        vouchers,
    }    
}

async function getOrderidsForFutureTickets(client, contactid) {
  const res = await api.export(client, `
    select distinct o.id 
    from tm.order o
    inner join tm.ticket on ticket.orderid = o.id
    inner join tm.tickettype on tickettype.id = ticket.tickettypeid
    inner join tm.event on event.id = tickettype.eventid
    where 
        customerid = ${contactid}
        and status = 21002 
        and nbroftickets > 0
        and endts > now()
  `)
  return pluck('id', res)
}

exports.getFutureTicketInfo = async function(client, contactid, inputOptions = {}) {
  const options = Object.assign({}, inputOptions)
  const orderids = await getOrderidsForFutureTickets(client, contactid)
  return orders.getFutureTicketInfo(client, orderids, options)
}

exports.getHistory = async function(client, customerid) {
  const createdsince = moment().
    subtract(4, 'y').
    format('YYYY-MM-DD HH:mm:ss')
  const simplefilter = {
    customerid,
    createdsince,
  }

  const eventFields = ["location", "name", "subtitle", "startts", "endts"]

  const events = {}
  const meta = { 
    nbrofevents: 0,
    nbroftickets: 0,
  }

  const payload = {
    orderby: "createdts",
    simplefilter: JSON.stringify(simplefilter),
  }
  const orderResult = await api.getListAllWithLookup(client, "orders", payload)

  for (const order of orderResult.data) {
    for (const ticket of order.tickets) {
      const eventid = ticket.eventid

      // Skip future events
      const historical = (moment(orderResult.lookup.events[eventid].endts).diff(moment(), 'days') < 0)
      if (!historical) {
        continue;
      }

      const key = `${client.shortname}${eventid}`
      if (!(key in events)) {
        events[key] = {
          id: eventid,
          ...R.pick(eventFields, orderResult.lookup.events[eventid]),
          historical,        
          tickets: [],
        }
      }
      ticket.pricetype = orderResult.lookup.pricetypes[ticket.pricetypeid].name
      ticket.pdfallowed = [15002,15003,15004].includes(orderResult.lookup.deliveryscenarios[order.deliveryscenarioid].allowetickets)
      ticket.deliverystatus = order.deliverystatus
      events[key].tickets.push(ticket)

      meta.nbroftickets += order.nbroftickets
      meta.nbrofevents += 1
    }
  }
  return {
    events: sortWith([descend(prop('startts'))])(Object.values(events)),
    meta,
  }
}