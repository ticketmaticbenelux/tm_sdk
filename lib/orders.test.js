const { isAmountRefundable, refund } = require('./orders')

const api = require("tm_api")

jest.mock('tm_api')

test("Can check if amount is refundable", async () => {
    const client = {}
    const orderid = 10000
    const totalamount = 50
    api.export.mockResolvedValue([
        {
            id: 1,
            paidts: null,
            amount: 100,
            mollieid: null,
            refunded: 0,
            refundable: 100,
        },
    ])
    const res = await isAmountRefundable(client, orderid, totalamount)
    expect(res).toEqual(true)
})

test("Can determine that amount is not refundable", async () => {
    const client = {}
    const orderid = 10000
    const totalamount = 500
    api.export.mockResolvedValue([
        {
            id: 1,
            paidts: null,
            amount: 100,
            mollieid: null,
            refunded: 0,
            refundable: 100,
        },
    ])
    const res = await isAmountRefundable(client, orderid, totalamount)
    expect(res).toEqual(false)
})


test("Can determine that amount is refundable with multiple payments", async () => {
    const client = {}
    const orderid = 10000
    const totalamount = 50
    api.export.mockResolvedValue([
        {
            id: 1,
            paidts: null,
            amount: 35,
            mollieid: null,
            refunded: 10,
            refundable: 25,
        },
        {
            id: 2,
            paidts: null,
            amount: 35,
            mollieid: null,
            refunded: 10,
            refundable: 25,
        },        
    ])
    const res = await isAmountRefundable(client, orderid, totalamount)
    expect(res).toEqual(true)
})

test("Can determine that amount is not refundable with multiple payments", async () => {
    const client = {}
    const orderid = 10000
    const totalamount = 50.1
    api.export.mockResolvedValue([
        {
            id: 1,
            paidts: null,
            amount: 35,
            mollieid: null,
            refunded: 10,
            refundable: 25,
        },
        {
            id: 2,
            paidts: null,
            amount: 35,
            mollieid: null,
            refunded: 10,
            refundable: 25,
        },        
    ])
    const res = await isAmountRefundable(client, orderid, totalamount)
    expect(res).toEqual(false)
})

test("Can refund with multiple payments", async () => {
    const client = {}
    const orderid = 10000
    const totalamount = 50
    api.export.mockResolvedValue([
        {
            id: 1,
            paidts: null,
            amount: 45,
            mollieid: null,
            refunded: 10,
            refundable: 35,
        },
        {
            id: 2,
            paidts: null,
            amount: 25,
            mollieid: null,
            refunded: 10,
            refundable: 15,
        },        
    ])
    const res = await refund(client, orderid, totalamount)
    expect(api.post).toHaveBeenCalledTimes(2)
    expect(api.post).toHaveBeenNthCalledWith(1, client, "refunds", {
        amount: 35,
        paymentid: 1,
    })
    expect(api.post).toHaveBeenNthCalledWith(2, client, "refunds", {
        amount: 15,
        paymentid: 2,
    })
    expect(res).toEqual(totalamount)
})

test("Will refund nothing if totalamount cannot fully be refunded", async () => {
    const client = {}
    const orderid = 10000
    const totalamount = 60
    api.export.mockResolvedValue([
        {
            id: 1,
            paidts: null,
            amount: 45,
            mollieid: null,
            refunded: 10,
            refundable: 35,
        },
        {
            id: 2,
            paidts: null,
            amount: 25,
            mollieid: null,
            refunded: 10,
            refundable: 15,
        },        
    ])
    const res = await refund(client, orderid, totalamount)
    expect(api.post).toHaveBeenCalledTimes(0)
    expect(res).toEqual(0)
})