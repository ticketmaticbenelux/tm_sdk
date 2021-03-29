"use strict"

const api = require('tm_api')
const R = require('ramda')
const orders = require('./orders')

const { sum, pipe, pluck } = R

exports.getContactInfo = async function(client, contactid) {
    const sql = `
      select 
        firstname, middlename, lastname
      from tm.contact
      where id = ${contactid}
    `
    const res = await api.export(client, sql)
    if (res.length === 0) {
      return null
    }
    return R.head(res)
}

exports.getCreditInfo = async function(client, contactid) {
    const l = client.language
    const vouchers = await api.export(client, `
        select 
            c.id, 
            c.code, 
            c.amount, 
            c.amountused, 
            c.createdts, 
            v.name${l} as name,
            o.id as orderid
            from tm.vouchercode c
        inner join tm.orderproduct op on op.vouchercodeid = c.id
        inner join tm.order o on o.id = op.orderid
        inner join tm.voucher v on v.id = c.voucherid
        where 
            o.contactid = ${contactid}
            and inactive is false
            and (c.expiryts > now() or c.expiryts is null)
            and v.typeid = 24003 -- Payment Voucher
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

exports.getPricetypeVoucherInfo = async function(client, contactid) {
    const l = client.language
    const vouchers = await api.export(client, `
        select 
            c.id, 
            c.code, 
            c.createdts, 
            v.name${l} as name,
            o.id as orderid,
            coalesce(sum(nbr),0) totalused
        from tm.vouchercode c
        inner join tm.orderproduct op on op.vouchercodeid = c.id
        inner join tm.order o on o.id = op.orderid
        inner join tm.voucher v on v.id = c.voucherid
        left join tm.vouchercodeusage vcu on vcu.vouchercodeid = c.id
        where 
            o.contactid = ${contactid}
            and inactive is false
            and (c.expiryts > now() or c.expiryts is null)
            and v.typeid = 24001 -- Pricetype Voucher
        group by c.id, c.code, c.createdts, v.namenl, o.id
        order by c.id desc
    `)

    return {
        vouchers,
    }    
}

async function getOrderidsForTickets(client, contactid) {
    const res = await api.export(client, `
        select id 
        from tm.order 
        where 
            customerid = ${contactid} 
            and status = 21002 
            and nbroftickets > 0
    `)
    return pluck('id', res)
}

exports.getTicketInfo = async function(client, contactid) {
    const orderids = await getOrderidsForTickets(client, contactid)
    return orders.getTicketInfo(client, orderids)
}