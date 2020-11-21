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
  db.set("key", 42)

  // get value
  const value = db.get("key")

  console.log(value)
  // output => 42
})
```

### Multi Ghomap usage

```ts
import Ghomap from "ghomap"

const users = new Ghomap<User>("users")
const cooldowns = new Ghomap<number>("cooldowns")
const descriptions = new Ghomap<string>("descriptions")

Ghomap.openAll().then(async () => {
  // add value
  users.set(userId, {
    name: "bob",
    age: 42,
  })

  // get value
  const value = db.get("key")

  console.log(value)
  // output => 42
})
```

- [API documentation](https://CamilleAbella.github.io/Ghomap)
