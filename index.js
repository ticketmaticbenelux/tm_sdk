"use strict"

var env = require('node-env-file')

env(__dirname + '/.env')

const contacts = require('./lib/contacts')

const client = {
	shortname: process.env.SHORTNAME,
	key: process.env.API_KEY,
	secret: process.env.API_SECRET,
    language: process.env.LANGUAGE ?? 'en',
}

async function main() {
    try {
        //const res = await contacts.getCreditInfo(client, 30104)
        //const res = await contacts.getTicketInfo(client, 30104)
        const res = await contacts.getPricetypeVoucherInfo(client, 30104)
        console.log(res)
    }
    catch (err) {
        console.log(err)
    }
}

main()