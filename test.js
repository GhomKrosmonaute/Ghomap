const fs = require("fs")
const path = require("path")
const Ghomap = require("./dist/index")

const db = new Ghomap()

test("use database before init", async () => {
  try {
    await db.set("something", true)
    expect(false).toBeTruthy()
  } catch (error) {
    expect(true).toBeTruthy()
  }
})

test("init database", async () => {
  await db.open()

  expect(db.isReady).toBe(true)
  expect(fs.existsSync(path.join(__dirname, "data", "default"))).toBe(true)
})

test("set data", async () => {
  await db.set("set-data", true)

  expect(
    fs.existsSync(path.join(__dirname, "data", "default", "set-data.json"))
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

test("set and get array data", async () => {
  await db.set("array", [42])
  await db.push("array", 66)

  expect(await db.includes("array", 42)).toBe(true)
  expect(await db.includes("array", 66)).toBe(true)
  expect(await db.includes("array", 33)).toBe(false)

  await db.pop("array")

  expect(await db.includes("array", 66)).toBe(false)
})

test("destroy database", async () => {
  await db.destroy()

  expect(db.isReady).toBe(false)
})
