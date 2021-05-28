"use strict"

const api = require('tm_api')
const R = require('ramda')

const { append, curry, filter, findIndex, propEq, pipe, pluck, reduce, reject, sum, update } = R

async function getNonManualOrderfees(client) {
    const res = await api.export(client, "select id from tm.orderfee where typeid is distinct from 2403")
    return pluck('id', res)
}

async function getScriptOrderfees(client) {
    const res = await api.export(client, "select id from tm.orderfee where typeid = 2402")
    return pluck('id', res)
}

function addCost(costs, newCost) {
    const servicechargedefinitionid = newCost.servicechargedefinitionid
    if (pluck("servicechargedefinitionid", costs).includes(servicechargedefinitionid)) {
      const costToUpdate = R.find(R.propEq("servicechargedefinitionid", servicechargedefinitionid))(costs)
      costToUpdate.amount += newCost.amount
      return update(findIndex(propEq("servicechargedefinitionid", servicechargedefinitionid))(costs), costToUpdate, costs)
    }
    else {
      return append(newCost, costs)
    }
}
exports.addCost = addCost

function addCosts(newCosts, costs) {
    return reduce(addCost, costs, newCosts)
}
exports.addCosts = addCosts

exports.add = async function(client, orderid, newCosts) {
    if (newCosts.length === 0) {
        return
    }

    const currentOrder = await api.get(client, "orders", orderid)
    const nonManualOrderfees = await getNonManualOrderfees(client)
    const ordercosts = pipe(
        reject(R.propSatisfies(x => nonManualOrderfees.includes(x), "servicechargedefinitionid")),
        curry(addCosts)(newCosts)
    )(currentOrder.ordercosts)
    return api.put(client, "orders", orderid, {
        ordercosts
    })
}

exports.getAmount = async function(client, orderid, ids) {
    if (ids.length === 0) {
        return 0
    }
    
    const currentOrder = await api.get(client, "orders", orderid)
    const orderfeesWithScript = await getScriptOrderfees(client)
    return pipe(
        reject(R.propSatisfies(x => orderfeesWithScript.includes(x), "servicechargedefinitionid")),
        filter(R.propSatisfies(x => ids.includes(x), "servicechargedefinitionid")),
        pluck("amount"),
        sum
    )(currentOrder.ordercosts)
}

exports.remove = async function(client, orderid, idsToRemove) {
    if (idsToRemove.length === 0) {
        return
    }

    const currentOrder = await api.get(client, "orders", orderid)
    const nonManualOrderfees = await getNonManualOrderfees(client)
    const ordercosts = pipe(
        reject(R.propSatisfies(x => nonManualOrderfees.includes(x), "servicechargedefinitionid")),
        reject(R.propSatisfies(x => idsToRemove.includes(x), "servicechargedefinitionid"))
    )(currentOrder.ordercosts)
    return api.put(client, "orders", orderid, {
        ordercosts
    })    
}