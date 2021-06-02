"use strict"

const api = require('tm_api')

exports.getRequests = async function(client, contactid) {
    const sql = `
        select 
            c.id as contactid,
            eventid,
            itemsstatus,
            json_array_length(tickets::json) nbroftickets
        from tm.waitinglistrequest r
        inner join tm.contact c
            on c.id = r.contactid
        inner join tm.waitinglistrequestitem i
            on i.typeid = r.id
        where 
            c.id = ${contactid}
            and r.requeststatus = 29201
            and r.isarchived is distinct from true
            and i.isarchived is distinct from true
    `
    return api.export(client, sql)
}