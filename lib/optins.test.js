const { getOptinsInfo } = require('./optins')

const api = require("tm_api")

jest.mock('tm_api')

test("Can get optins", async () => {
    const client = {
        language: 'nl',
    }    
    const optins = [
        {
          name: "Nieuw in de verkoop",
          description: "Schrijf u in voor de Carré Nieuwsbrief en wees als eerste op de hoogte van\no.a. start verkoop voorstellingen",
          yescaption: "Ja, graag!",
          nocaption: "Nee, bedankt",
          typeid: 40001,
          info: "{\"ip\": \"62.163.235.184\", \"method\": \"websales checkbox\"}",
          coalesce: 7603
        },
        {
          name: "Inspiratie en tips",
          description: "Schrijf u in voor de Carré Nieuwsbrief en wees als eerste op de hoogte van\no.a. nieuwtjes van de artiesten",
          yescaption: "Ja, graag!",
          nocaption: "Nee, bedankt",
          typeid: 40001,
          info: "{\"ip\": \"62.163.235.184\", \"method\": \"websales checkbox\"}",
          coalesce: 7603
        },
        {
          name: "Boekingen voor groepen (zowel zakelijk als privé)",
          description: "Schrijf u in voor de Carré Nieuwsbrief en wees als eerste op de hoogte van\no.a.  alle inspirerend theaterarrangement en speciale groepsaanbiedingen",
          yescaption: "Ja, graag!",
          nocaption: "Nee, bedankt",
          typeid: 40001,
          info: "{\"ip\": \"62.163.235.184\", \"method\": \"websales checkbox\"}",
          coalesce: 7603
        }
      ]
    api.export.mockResolvedValue(optins)
    const result = await getOptinsInfo(client, 10000)
    const expected = [...optins]
    expect(result).toEqual({
        optins: expected
    })
})