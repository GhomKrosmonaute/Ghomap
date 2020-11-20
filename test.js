const fs = require("fs")
const path = require("path")
const Ghomap = require("./dist/index")

let table = new Ghomap()

test("init database", async () => {
  await table.open()

  expect(fs.existsSync(path.join(__dirname, "data", "default"))).toBe(true)
})

test("set data", async () => {
  await table.set("key", {
    test: true,
    debug: false,
  })

  expect(
    fs.existsSync(path.join(__dirname, "data", "default", "key.json"))
  ).toBe(true)
})

test("ensure data", async () => {
  const data = await table.ensure("ensured", true)

  expect(data).toBe(true)

  const ensured = await table.get("ensured")

  expect(ensured).toBe(true)
})

test("get data", async () => {
  const data = await table.get("key")

  expect(data.test).toBe(true)
  expect(data.debug).toBe(false)
})

test("delete all", async () => {
  await table.deleteAll()

  expect(fs.readdirSync(path.join(__dirname, "data", "default")).length).toBe(0)
})
