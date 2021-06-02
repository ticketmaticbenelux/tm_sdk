const { getRequestsInfo } = require('./waitinglist')

const api = require("tm_api")

jest.mock('tm_api')

test("Can get requests", async () => {
    const client = {
        language: 'nl',
    }    
    const requests = [
        {
            eventid: 20000,
            itemsstatus: 29102,
            tickets: '[{"tickettypepriceid": 1737}, {"tickettypepriceid": 1737}]',
            nbroftickets: 2,
            name: 'Event 20000',
            subtitle: 'subtitle',
            startts: '2022-01-01 00:00:00',
            endts: '2022-01-02 02:00:00',
        },
        {
            eventid: 20000,
            itemsstatus: 29101,
            tickets: '',
            nbroftickets: 0,
            name: 'Event 20000',
            subtitle: 'subtitle',
            startts: '2022-01-01 00:00:00',
            endts: '2022-01-02 02:00:00',
        },        
        {
            eventid: 20001,
            itemsstatus: 29102,
            tickets: '',
            nbroftickets: 0,
            name: 'Event 20001',
            subtitle: 'subtitle',
            startts: '2022-01-02 00:00:00',
            endts: '2022-01-02 02:00:00',
        },
    ]
    api.export.mockResolvedValue(requests)
    const result = await getRequestsInfo(client, 10000)
    const expected = {
        "events": [
           {
              "endts": "2022-01-02 02:00:00",
              "name": "Event 20000",
              "requests": [
                 {
                    "itemsstatus": 29102,
                    "nbroftickets": 2,
                 },
                 {
                    "itemsstatus": 29101,
                    "nbroftickets": 0,
                 }
              ],
              "startts": "2022-01-01 00:00:00",
              "subtitle": "subtitle"
           },
           {
              "endts": "2022-01-02 02:00:00",
              "name": "Event 20001",
              "requests": [
                 {
                    "itemsstatus": 29102,
                    "nbroftickets": 0,
                 }
              ],
              "startts": "2022-01-02 00:00:00",
              "subtitle": "subtitle"
           }
        ]
    }
    expect(result).toEqual(expected)
})