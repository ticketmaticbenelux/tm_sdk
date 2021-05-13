const { addCost } = require('./ordercosts')

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