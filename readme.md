# Ghomap

JSON version of Enmap, because why not...

## Install

```
npm install ghomap@latest
```

## Import / Declare

### ESModules

```js
import Ghomap from "ghomap"

const db = new Ghomap()
```

### CommonJS

```js
const Ghomap = require("ghomap")

const db = new Ghomap()
```

### Typescript

Ghomap includes type definitions.

```ts
import Ghomap from "ghomap"

const db = new Ghomap<any>()
```

## Usage

### Basic usage

```ts
import Ghomap from "ghomap"

const db = new Ghomap<number>()

db.open().then(async () => {
  // set value
  await db.set("key", 42)

  // get value
  const value = await db.get("key")

  console.log(value)
  // output => 42
})
```

### Multi Ghomap usage

```ts
import Ghomap from "ghomap"

const users = new Ghomap<User>("users")
const numbers = new Ghomap<number[]>("numbers")
const descriptions = new Ghomap<string>("descriptions")

Ghomap.openAll().then(async () => {
  // set value
  await users.set(userId, {
    name: "bob",
    age: 42,
  })

  // ensure array value
  let list = await numbers.ensure("list", [42])

  console.log(list)
  // output => [42]

  // push in arrray value
  await numbers.push("list", 66, 33)

  console.log(await numbers.get("list"))
  // output => [42, 66, 33]
})
```

- [API documentation](http://163.172.176.138:4224)
