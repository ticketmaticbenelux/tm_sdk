"use strict"

const api = require('tm_api')
const R = require('ramda')

const { prop, sortBy } = R

exports.getTicketInfo = async function(client, orderids) {
    const orders = []
    const events = {}
    const meta = { 
      nbroftickets: 0,
      totalamount: 0,
      amountpaid: 0,
    }
    if (orderids.length === 0) {
      return {
        orders,
        events,
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
            location: order.lookup.events[eventid].location,
            name: order.lookup.events[eventid].name,
            subtitle: order.lookup.events[eventid].subtitle,
            startts: order.lookup.events[eventid].startts,
            endts: order.lookup.events[eventid].endts,
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
  