const fs = require("fs")
const path = require("path")
const Ghomap = require("./dist/index")

const db = new Ghomap()

test("init database", async () => {
  await db.open()

  expect(fs.existsSync(path.join(__dirname, "data", "default"))).toBe(true)
})

test("set data", async () => {
  await db.set("set-data", true)

  expect(
    fs.existsSync(path.join(__dirname, "data", "default", "key.json"))
  ).toBe(true)
})

test("ensure data", async () => {
  const data = await db.ensure("ensured", true)

  expect(data).toBe(true)

  const ensured = await db.get("ensured")

  expect(ensured).toBe(true)
})

test("get data", async () => {
  const data = await db.get("set-data")

  expect(data).toBe(true)
})

test("get random data", async () => {
  const data = await db.random()

  expect(data).toBeDefined()
  expect(data).not.toBeNull()
})

test("delete all", async () => {
  await db.deleteAll()

  expect(fs.readdirSync(path.join(__dirname, "data", "default")).length).toBe(0)
})

test("get undefined data", async () => {
  expect(await db.random()).toBeNull()
  expect(await db.get("someone")).toBeNull()

  const entries = await db.fetchAll()

  expect(entries.size).toBe(0)
})
