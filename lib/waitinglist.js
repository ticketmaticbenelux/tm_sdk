"use strict"

const api = require('tm_api')
const Promise = require('bluebird')
const R = require('ramda')

const { curry, groupBy, pipe, prop, sortBy, values } = R

async function getRequests(client, contactid) {
    const l = client.language
    const sql = `
        select 
            r.id as requestid,
            eventid,
            itemsstatus,
            tickets,
            json_array_length(tickets::json) nbroftickets,
            e.name${l} as name,
            e.subtitle${l} as subtitle,
            e.startts,
            e.endts
        from tm.waitinglistrequest r
        inner join tm.contact c
            on c.id = r.contactid
        inner join tm.waitinglistrequestitem i
            on i.typeid = r.id
        inner join tm.event e
            on e.id = eventid
        where 
            c.id = ${contactid}
            and r.requeststatus = 29201
            and r.isarchived is distinct from true
            and i.isarchived is distinct from true
    `
    return api.export(client, sql)
}

const prepareRequest = R.pick(['requestid', 'itemsstatus', 'nbroftickets'])

function prepareEvent(list) {
    const obj = R.head(list)
    return {
        id: obj.eventid,
        name: obj.name,
        subtitle: obj.subtitle,
        startts: obj.startts,
        endts: obj.endts,
        requests: R.map(prepareRequest)(list),
    }
}

const prepareEvents = R.map(prepareEvent)

exports.getRequestsInfo = async function(client, contactid) {
    const requests = await getRequests(client, contactid)
    const requestsPerEvent = pipe(groupBy(R.prop("eventid")), values, prepareEvents)(requests)
    return {
        events: sortBy(prop("startts"))(requestsPerEvent),
    }
}

async function getRequestsForEvent(client, contactid, eventid) {
    const sql = `
        select distinct r.id
        from tm.waitinglistrequest r
        inner join tm.waitinglistrequestitem i on i.typeid = r.id
        where contactid = ${contactid}
        and eventid = ${eventid}
        and r.isarchived is distinct from true
        and i.isarchived is distinct from true
    `    
    return R.pluck('id', await api.export(client, sql))
}

async function getRequest(client, requestid) {
    return api.get(client, 'waitinglistrequests', requestid)
}

async function archiveRequest(client, requestid) {
    return api.del(client, 'waitinglistrequests', requestid)
}

async function removeEventFromRequest(client, eventid, requestid) {
    const request = await getRequest(client, requestid)
    const waitinglistrequestitems = R.reject(R.propEq("eventid", eventid), request.waitinglistrequestitems)
    await api.put(client, 'waitinglistrequests', requestid, {
        waitinglistrequestitems
    })
    // Clean up request if no items left
    if (waitinglistrequestitems.length === 0) {
        await archiveRequest(client, requestid)
    }
    return true
}

exports.deleteForEvent = async function(client, contactid, eventid) {
    const requestids = await getRequestsForEvent(client, contactid, eventid)
    return Promise.mapSeries(requestids, curry(removeEventFromRequest)(client, eventid))
}