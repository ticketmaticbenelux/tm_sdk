"use strict"

const api = require('tm_api')
const R = require('ramda')

const { groupBy, pipe, prop, sortBy, values } = R

async function getRequests(client, contactid) {
    const l = client.language
    const sql = `
        select 
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

const prepareRequest = R.pick(['itemsstatus', 'nbroftickets'])

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