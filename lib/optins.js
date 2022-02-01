'use strict'

const api = require('tm_api')

async function getOptins(client, contactid) {
  const l = client.language
  const sql = `
        with manualsort (id_list) as (
            select sortedids from prv.manualsorts where key = 'conf.optin'
        )

        select
            contactoptin.id as id,
            optin.id as optinid,
            name${l} as name, 
            description${l} as description, 
            yescaption${l} as yescaption, 
            nocaption${l} as nocaption, 
            caption${l} as caption,
            typeid, 
            info, 
            coalesce(status,7601) as status
        from manualsort, tm.optin
        left join tm.contactoptin on contactoptin.optinid = optin.id and contactid = ${contactid}
        where optin.id in (
            select optinid from tm.contactoptin where contactid = ${contactid}
            union
            select jsonb_array_elements(optinids)::text::int optinids from conf.optinset where id in (select value::int as setid from conf.accountparameters where key = 'event_default_optinset')
        )
        and optin.isarchived is distinct from true
        order by array_position(manualsort.id_list, optin.id)
    `
  return api.export(client, sql)
}

exports.getOptinsInfo = async function(client, contactid) {
  const optins = await getOptins(client, contactid)
  return {
    optins,
  }
}