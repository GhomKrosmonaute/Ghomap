import path from "path"
import fs from "fs"
import fsp from "fs/promises"
import * as utils from "./utils"

export interface Options {
  fetchAllOnStart?: boolean
  useCache?: boolean
  name?: utils.Key
}

class Ghomap<T = any> implements Options {
  static path = path.join(utils.root, "data")
  static instances = new Set<Ghomap>()

  static setPath(_path: string): string {
    this.path = path.resolve(utils.root, _path)
    return this.path
  }

  private cache = new Map<utils.Key, T>()

  /**
   * The name of database in case of multiple databases used <br>
   * default: `"default"`
   */
  public name: utils.Key
  /**
   * Use cache or not ? <br>
   * default: `true`
   */
  public useCache: boolean
  /**
   * Fetch all on start or not ? <br>
   * default: `true`
   */
  public fetchAllOnStart: boolean

  private ready: boolean = false

  constructor(options: Options | utils.Key = "default") {
    if (typeof options === "string") {
      utils.validateKey(options)
      this.name = options
      this.useCache = true
      this.fetchAllOnStart = true
    } else {
      this.useCache = options.useCache ?? true
      this.fetchAllOnStart = options.fetchAllOnStart ?? true
      const name = options.name ?? "default"
      utils.validateKey(name)
      this.name = name
    }
    Ghomap.instances.add(this)
  }

  public async open(
    callback?: (key: utils.Key, value: T) => unknown
  ): Promise<void> {
    await utils.ensureDir(Ghomap.path)
    await utils.ensureDir(this.path)
    if (this.fetchAllOnStart && this.useCache) {
      const dir = await fsp.readdir(this.path)
      for (const filename of dir) {
        if (filename.endsWith(".json")) {
          const key = path.basename(filename, ".json")
          const value = await this.get(key)
          if (value !== null) {
            this.cache.set(key, value)
            callback?.(key, value)
          }
        }
      }
    }
    this.ready = true
  }

  public async destroy(): Promise<void> {
    this.checkReady("destroy()")
    await this.deleteAll()
    await fsp.rmdir(this.path)
  }

  public async delete(key: utils.Key) {
    this.checkReady("delete()")
    if (!fs.existsSync(this.filepath(key))) return
    await fsp.unlink(this.filepath(key))
    if (this.useCache) this.cache.delete(key)
  }

  public deleteAll(): Promise<void> {
    this.checkReady("deleteAll()")
    return this.forEach((data, key) => this.delete(key))
  }

  public async random(): Promise<T | null> {
    this.checkReady("random()")
    const keys = this.useCache
      ? Array.from(this.cache.keys())
      : await this.fetchKeys()
    if (keys.length === 0) return null
    return this.get(keys[Math.floor(Math.random() * keys.length)])
  }

  public has(key: utils.Key): boolean {
    this.checkReady("has()")
    if (this.useCache) return this.cache.has(key)
    return fs.existsSync(this.filepath(key))
  }

  public async count(): Promise<number> {
    this.checkReady("count()")
    if (this.useCache) return this.cache.size
    return await fsp.readdir(this.path).then((filenames) => filenames.length)
  }

  public async set(key: utils.Key, data: T): Promise<T> {
    this.checkReady("set()")
    utils.validateKey(key)
    const raw = utils.stringify(data)
    await fsp.writeFile(this.filepath(key), raw, "utf-8")
    if (this.useCache) this.cache.set(key, data)
    return data
  }

  public async get(key: utils.Key): Promise<T | null> {
    this.checkReady("get()")
    utils.validateKey(key)
    if (this.useCache) return this.cache.get(key) ?? null
    if (!fs.existsSync(this.filepath(key))) return null
    const raw = await fsp.readFile(this.filepath(key), "utf-8")
    return utils.parse<T>(raw) ?? null
  }

  public async ensure(key: utils.Key, defaultValue: T): Promise<T> {
    this.checkReady("ensure()")
    const data = await this.get(key)
    return data ?? (await this.set(key, defaultValue))
  }

  public async push<I = any>(key: utils.Key, item: I): Promise<I> {
    this.checkReady("push()")
    const data = await this.get(key)
    if (data instanceof Array) {
      data.push(item)
      return item
    }
    throw new Error("the push() function must bu used on Array value.")
  }

  public async unshift<I = any>(key: utils.Key, item: I): Promise<I> {
    this.checkReady("unshift()")
    const data = await this.get(key)
    if (data instanceof Array) {
      data.unshift(item)
      return item
    }
    throw new Error("the unshift() function must bu used on Array value.")
  }

  public async pop<I = any>(key: utils.Key): Promise<I> {
    this.checkReady("pop()")
    const data = await this.get(key)
    if (data instanceof Array) {
      return data.pop()
    }
    throw new Error("the pop() function must bu used on Array value.")
  }

  public async shift<I = any>(key: utils.Key): Promise<I> {
    this.checkReady("shift()")
    const data = await this.get(key)
    if (data instanceof Array) {
      return data.shift()
    }
    throw new Error("the shift() function must bu used on Array value.")
  }

  public async forEach(
    callback: (data: T, key: utils.Key) => unknown
  ): Promise<void> {
    this.checkReady("forEach()")
    const entries = this.useCache ? this.cache : await this.fetchAll()
    for (const [key, data] of [...entries]) {
      await callback(data, key)
    }
  }

  public async map<R>(
    callback: (data: T, key: utils.Key) => R | Promise<R>
  ): Promise<R[]> {
    this.checkReady("map()")
    const entries = this.useCache ? this.cache : await this.fetchAll()
    const output: R[] = []
    for (const [key, data] of [...entries]) {
      output.push(await callback(data, key))
    }
    return output
  }

  public async some(
    callback: (data: T, key: utils.Key) => boolean | Promise<boolean>
  ): Promise<boolean> {
    this.checkReady("some()")
    const entries = this.useCache ? this.cache : await this.fetchAll()
    for (const [key, data] of [...entries]) {
      if (await callback(data, key)) {
        return true
      }
    }
    return false
  }

  public async every(
    callback: (data: T, key: utils.Key) => boolean | Promise<boolean>
  ): Promise<boolean> {
    this.checkReady("every()")
    return !(await this.some(callback))
  }

  public async filter(
    callback: (data: T, key: utils.Key) => boolean | Promise<boolean>
  ): Promise<Map<utils.Key, T>> {
    this.checkReady("filter()")
    const entries = this.useCache ? this.cache : await this.fetchAll()
    const output = new Map<utils.Key, T>()
    for (const [key, data] of [...entries]) {
      if (await callback(data, key)) {
        output.set(key, data)
      }
    }
    return output
  }

  public async filterArray(
    callback: (data: T, key: utils.Key) => boolean | Promise<boolean>
  ): Promise<T[]> {
    this.checkReady("filterArray()")
    const entries = this.useCache ? this.cache : await this.fetchAll()
    const output: T[] = []
    for (const [key, data] of [...entries]) {
      if (await callback(data, key)) {
        output.push(data)
      }
    }
    return output
  }

  public async find(
    callback: (data: T, key: utils.Key) => boolean | Promise<boolean>
  ): Promise<T | null> {
    this.checkReady("find()")
    const entries = this.useCache ? this.cache : await this.fetchAll()
    for (const [key, data] of [...entries]) {
      if (await callback(data, key)) {
        return data
      }
    }
    return null
  }

  public fetchAll(): Promise<Map<utils.Key, T>> {
    this.checkReady("fetchAll()")
    return this.fetchKeys().then(async (keys) => {
      const entries = new Map<utils.Key, T>()
      for (const key of keys) {
        const data = await this.get(key)
        if (data !== null) entries.set(key, data)
      }
      return entries
    })
  }

  public fetchValues(): Promise<T[]> {
    this.checkReady("fetchValues()")
    return this.fetchAll().then((entries) =>
      Array.from(entries).map((entry) => entry[1])
    )
  }

  public fetchKeys(): Promise<utils.Key[]> {
    this.checkReady("fetchKeys()")
    return fsp.readdir(this.path).then(async (filenames) => {
      const keys: utils.Key[] = []
      for (const filename of filenames) {
        if (filename.endsWith(".json")) {
          keys.push(path.basename(filename, ".json"))
        }
      }
      return keys
    })
  }

  get isReady(): boolean {
    return this.ready
  }

  private get path(): string {
    return path.join(Ghomap.path, this.name)
  }

  private filepath(key: string): string {
    return path.join(this.path, key) + ".json"
  }

  private checkReady(featureName: string) {
    if (!this.ready) {
      throw new Error(
        `the database must be ready to use this feature: ${featureName}`
      )
    }
  }
}

export default Ghomap
module.exports = Ghomap
