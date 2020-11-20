const fs = require("fs")
const path = require("path")
const Ghomap = require("./dist/index")

Ghomap.setPath("test")

let table = new Ghomap("table")

test("Ghomap", async () => {
  await table.open()

  expect(fs.existsSync(path.join(__dirname, "test", "table"))).toBe(true)

  await table.set("key", {
    test: true,
    debug: false,
  })

  expect(fs.existsSync(path.join(__dirname, "test", "table", "key.json"))).toBe(
    true
  )

  const data = await table.get("key")

  expect(data.test).toBe(true)
  expect(data.debug).toBe(false)

  await table.deleteAll()

  expect(fs.readdirSync(path.join(__dirname, "test", "table")).length).toBe(0)
})
