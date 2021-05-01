"use strict"

const api = require('tm_api')
const R = require('ramda')

const { prop, sortBy } = R

exports.getTicketInfo = async function(client, orderids, inputOptions = {}) {
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
    for (const orderid of orderids) {
      const order = await api.get(client, "orders", orderid)
      
      for (const ticket of order.tickets) {
        const eventid = ticket.eventid
        const key = `${client.shortname}${eventid}`
        if (!(key in events)) {
          events[key] = {
            id: eventid,
            ...R.pick(eventFields, order.lookup.events[eventid]),            
            tickets: [],
          }
        }
        ticket.pricetype = order.lookup.pricetypes[ticket.pricetypeid].name
        events[key].tickets.push(ticket)
      }
  
      orders.push({
        orderid, 
        customerid: order.customerid, 
        totalamount: order.totalamount,
        amountpaid: order.amountpaid,
        nbroftickets: order.nbroftickets, 
        ordercosts: order.ordercosts,
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
        select p.id, p.paidts, p.amount, properties::json->>'id' as mollieid, sum(refunds.amount) as refunded, p.amount + sum(refunds.amount) as refundable
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
  if (refundable < amount) {
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
    const canRefund = canRefund(payments, totalamount)
    if (!canRefund) {
      return 0
    }

    let remainingAmount = totalamount
    for (const payment of payments) {
        const amount = R.min(remainingAmount, payment.refundable)
        const paymentid = payment.id
        await api.post(client, "refunds", {
            amount,
            paymentid,
        })
        remainingAmount -= amount
    }
    return (totalamount - remainingAmount)
}
  