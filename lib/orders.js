"use strict"

const api = require('tm_api')
const moment = require('moment')
const R = require('ramda')

const { head, pipe, prop, sortBy } = R

const defaultOptions = {
  customfields: [],
}

exports.isMixed = async function(client, orderid) {
  const sql = `
    select count(distinct eventid) > 1 as mixed
    from tm.ticket t
    inner join tm.tickettype tt on tt.id = t.tickettypeid
    where orderid = ${orderid}
  `
  return pipe(head, prop("mixed"))(await api.export(client, sql))
}

exports.getFutureTicketInfo = async function(client, orderids, inputOptions = {}) {
    const options = Object.assign({}, defaultOptions, inputOptions)
    const eventFields = ["location", "name", "subtitle", "startts", "endts", ...options.customfields]

    const orders = []
    const events = {}
    const meta = { 
      nbroftickets: 0,
      totalamount: 0,
      amountpaid: 0,
    }
    if (orderids.length === 0) {
      return {
        orders: [],
        events: [],
        meta,
      }
    } 

    const filter = `select id from tm.order where id in (${orderids.join()})`
    const orderResult = await api.getListAllWithLookup(client, "orders", { filter, 
      orderby: "createdts"})

    for (const order of orderResult.data) {
      const orderid = order.orderid
      for (const ticket of order.tickets) {
        const eventid = ticket.eventid

        // Skip historical events
        const historical = (moment(orderResult.lookup.events[eventid].endts).diff(moment(), 'days') < 0)
        if (historical) {
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
      }
  
      orders.push({
        orderid, 
        customerid: order.customerid, 
        totalamount: order.totalamount,
        amountpaid: order.amountpaid,
        nbroftickets: order.nbroftickets, 
        ordercosts: order.ordercosts,
        deliverystatus: order.deliverystatus,
      })
      meta.nbroftickets += order.nbroftickets
      meta.totalamount += order.totalamount
      meta.amountpaid += order.amountpaid
    }
    return {
      orders,
      events: sortBy(prop("startts"))(Object.values(events)),
      meta,
    }
}

exports.getHistory = async function(client, options) {
  const eventFields = ["location", "name", "subtitle", "startts", "endts"]

  const events = {}
  const meta = { 
    nbrofevents: 0,
    nbroftickets: 0,
  }

  const payload = {
    orderby: "createdts",
    ...options,
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
    events: sortBy(prop("startts"))(Object.values(events)),
    meta,
  }
}

exports.payWithCredit = async function(client, contactid, orderid, paymentmethodid, paymentAmount) {
    const { vouchers } = await getCreditInfo(client, contactid)
    console.log(`[${client.shortname}] Going to pay ${paymentAmount} with credit for contact ${contactid} and order ${orderid}`)
    let currentlyPaid = 0
    let currentlyOpen = paymentAmount
    for (voucher of vouchers) {
        const available = voucher.amount - voucher.amountused
        if (available === 0) {
            continue
        }
        if (currentlyPaid >= paymentAmount) {
            break
        }
        const amount = (available>currentlyOpen) ? currentlyOpen : available
        const vouchercode = voucher.code
        const vouchercodeid = voucher.id
        const payload = {
            amount,
            paymentmethodid,
            vouchercode,
            vouchercodeid,
        }
        await api.post(client, "payments", orderid, payload)
        currentlyPaid += amount
        currentlyOpen -= amount
    }
}

async function getMolliePayments(client, orderid) {
    const sql = `
      select 
        p.id, 
        p.paidts, 
        p.amount, 
        properties::json->>'id' as mollieid, 
        coalesce(sum(refunds.amount), 0) as refunded, 
        p.amount + coalesce(sum(refunds.amount),0) as refundable
      from tm.payment p
      inner join conf.paymentmethod m
          on m.id = p.paymentmethodid
      left join (
          select orderid, amount, properties::json->'payment'->>'id' mollieoriginalid
          from tm.payment p2
          inner join conf.paymentmethod m2
              on m2.id = p2.paymentmethodid
          where m2.paymentmethodtypeid = 1006
          and p2.amount < 0   
      ) refunds
          on refunds.orderid = p.orderid
          and refunds.mollieoriginalid = properties::json->>'id'
      where p.orderid = ${orderid}
      and paymentmethodtypeid = 1006
      and p.amount > 0
      group by p.id, p.paidts, p.amount, p.properties
      order by refundable desc
    `
    return api.export(client, sql)
}

function canRefund(payments, totalamount) {
  if (totalamount === 0) {
    return true
  }  
  if (payments.length === 0) {
    return false
  }
  const refundable = R.sum(R.pluck("refundable", payments))
  if (refundable < totalamount) {
      return false
  }
  return true
}

exports.isAmountRefundable = async function(client, orderid, totalamount) {
  const payments = await getMolliePayments(client, orderid)
  return canRefund(payments, totalamount)
}

exports.refund = async function(client, orderid, totalamount) {
    if (totalamount < 0) {
        totalamount *= -1
    }
    const payments = await getMolliePayments(client, orderid)
    const refundable = canRefund(payments, totalamount)
    if (!refundable) {
      return 0
    }

    let remainingAmount = totalamount
    for (const payment of payments) {
        const amount = R.min(remainingAmount, payment.refundable)
        const paymentid = payment.id
        await api.post(client, "refunds", orderid, {
            amount,
            paymentid,
        })
        remainingAmount -= amount
    }
    return (totalamount - remainingAmount)
}
  