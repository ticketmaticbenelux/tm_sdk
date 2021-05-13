const { addCost, addCosts, getAmount, remove } = require('./ordercosts')

const api = require("tm_api")

jest.mock('tm_api')

test("Can add first cost", async () => {
    const cost = {
        servicechargedefinitionid: 10000,
        amount: 10,
    }
    const costs = addCost([], cost)
    expect(costs).toEqual([cost])
})

test("Can add second cost", async () => {
    const initialCosts = [{
        servicechargedefinitionid: 10000,
        amount: 10,
    }]
    const cost = {
        servicechargedefinitionid: 10001,
        amount: 5,
    }
    const costs = addCost(initialCosts, cost)
    expect(costs).toEqual([...initialCosts, cost])
})

test("Can increase cost", async () => {
    const servicechargedefinitionid = 10000
    const anotherCost = {
        servicechargedefinitionid: 10001,
        amount: 1,
    }
    const initialCosts = [
        {
            servicechargedefinitionid,
            amount: 10,
        },
        anotherCost
    ]
    const cost = {
        servicechargedefinitionid,
        amount: 5,
    }
    const costs = addCost(initialCosts, cost)
    const expectedCosts = [{
        servicechargedefinitionid,
        amount: 15,
    }, anotherCost]
    expect(costs).toEqual(expectedCosts)
})

test("Can add first 2 costs at once", async () => {
    const newCosts = [
        {
            servicechargedefinitionid: 20000,
            amount: 1,
        },
        {
            servicechargedefinitionid: 20001,
            amount: 2,
        },
    ]
    const costs = addCosts(newCosts, [])
    expect(costs).toEqual(newCosts)
})

test("Can add additional 2 costs at once", async () => {
    const newCosts = [
        {
            servicechargedefinitionid: 20003,
            amount: 3,
        },
        {
            servicechargedefinitionid: 20004,
            amount: 4,
        },
    ]
    const existingCosts = [
        {
            servicechargedefinitionid: 20001,
            amount: 1,
        },
        {
            servicechargedefinitionid: 20002,
            amount: 2,
        },
    ]
    const costs = addCosts(newCosts, existingCosts)
    expect(costs).toEqual([...existingCosts, ...newCosts])
})

test("Can increase one and add one at once", async () => {
    const newCosts = [
        {
            servicechargedefinitionid: 20003,
            amount: 3,
        },
        {
            servicechargedefinitionid: 20001,
            amount: 9,
        },
    ]
    const existingCosts = [
        {
            servicechargedefinitionid: 20001,
            amount: 1,
        },
        {
            servicechargedefinitionid: 20002,
            amount: 2,
        },
    ]
    const costs = addCosts(newCosts, existingCosts)
    expect(costs).toEqual([
        {
            servicechargedefinitionid: 20001,
            amount: 10,
        },
        {
            servicechargedefinitionid: 20002,
            amount: 2,
        },
        {
            servicechargedefinitionid: 20003,
            amount: 3,
        },        
    ])
})

test("Can get amount", async () => {
    const ordercosts = [
        {
            servicechargedefinitionid: 20001,
            amount: 1,
        },
        {
            servicechargedefinitionid: 20002,
            amount: 2,
        },        
    ]
    api.get.mockResolvedValue({
        ordercosts,
    })
    api.export.mockResolvedValue([])
    const amount = await getAmount(null, null, [20001,20002])
    expect(amount).toEqual(3)
})

test("Can get amount ignoring script orderfees", async () => {
    const ordercosts = [
        {
            servicechargedefinitionid: 20001,
            amount: 1,
        },
        {
            servicechargedefinitionid: 20002,
            amount: 2,
        },
        {
            servicechargedefinitionid: 20003,
            amount: 9,
        },        
    ]
    api.get.mockResolvedValue({
        ordercosts,
    })
    // In order to fetch script fees
    api.export.mockResolvedValue([{
        id: 20003,
    }])
    const amount = await getAmount(null, null, [20001,20002,20003])
    expect(amount).toEqual(3)
})

test("Can remove", async () => {
    const ordercosts = [
        {
            servicechargedefinitionid: 20001,
            amount: 1,
        },
        {
            servicechargedefinitionid: 20002,
            amount: 2,
        },        
    ]
    const orderCostToRemove = {
        servicechargedefinitionid: 20003,
        amount: 9,
    }
    const allCosts = [...ordercosts, orderCostToRemove]
    api.get.mockResolvedValue({
        ordercosts: allCosts,
    })
    // In order to fetch script fees
    api.export.mockResolvedValue([])
    await remove(null, null, [20003])
    expect(api.put).toBeCalledWith(null, "orders", null, {ordercosts})
})

test("Can remove and also ignore script fees", async () => {
    const ordercosts = [
        {
            servicechargedefinitionid: 20001,
            amount: 1,
        },
        {
            servicechargedefinitionid: 20002,
            amount: 2,
        },
    ]
    const orderCostToRemove = {
        servicechargedefinitionid: 20003,
        amount: 9,
    }
    const orderCostToIgnore = {
        servicechargedefinitionid: 20004,
        amount: 4,
    }
    const allCosts = [...ordercosts, orderCostToRemove, orderCostToIgnore]
    api.get.mockResolvedValue({
        ordercosts: allCosts,
    })
    // In order to fetch script fees
    api.export.mockResolvedValue([{
        id: 20004,
    }])
    await remove(null, null, [20003])
    expect(api.put).toBeCalledWith(null, "orders", null, {ordercosts})
})