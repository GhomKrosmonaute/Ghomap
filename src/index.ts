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

  @utils.checkReady()
  public async destroy(): Promise<void> {
    await this.deleteAll()
    await fsp.rmdir(this.path)
    this.ready = false
  }

  @utils.checkReady()
  public async delete(key: utils.Key) {
    if (!fs.existsSync(this.filepath(key))) return
    await fsp.unlink(this.filepath(key))
    if (this.useCache) this.cache.delete(key)
  }

  @utils.checkReady()
  public deleteAll(): Promise<void> {
    return this.forEach((data, key) => this.delete(key))
  }

  @utils.checkReady()
  public async random(): Promise<T | null> {
    const keys = this.useCache
      ? Array.from(this.cache.keys())
      : await this.fetchKeys()
    if (keys.length === 0) return null
    return this.get(keys[Math.floor(Math.random() * keys.length)])
  }

  @utils.checkReady()
  public has(key: utils.Key): boolean {
    if (this.useCache) return this.cache.has(key)
    return fs.existsSync(this.filepath(key))
  }

  @utils.checkReady()
  public async count(): Promise<number> {
    if (this.useCache) return this.cache.size
    return await fsp.readdir(this.path).then((filenames) => filenames.length)
  }

  @utils.checkReady()
  public async set(key: utils.Key, data: T): Promise<T> {
    utils.validateKey(key)
    const raw = utils.stringify(data)
    await fsp.writeFile(this.filepath(key), raw, "utf-8")
    if (this.useCache) this.cache.set(key, data)
    return data
  }

  @utils.checkReady()
  public async get(key: utils.Key): Promise<T | null> {
    utils.validateKey(key)
    if (this.useCache) return this.cache.get(key) ?? null
    if (!fs.existsSync(this.filepath(key))) return null
    const raw = await fsp.readFile(this.filepath(key), "utf-8")
    return utils.parse<T>(raw) ?? null
  }

  @utils.checkReady()
  public async ensure(key: utils.Key, defaultValue: T): Promise<T> {
    const data = await this.get(key)
    return data ?? (await this.set(key, defaultValue))
  }

  @utils.checkReady()
  public async push<I = any>(key: utils.Key, ...items: I[]): Promise<I[]> {
    const data = await this.get(key)
    if (data instanceof Array) {
      data.push(...items)
      return items
    }
    throw new Error("the push() function must bu used on Array value.")
  }

  @utils.checkReady()
  public async unshift<I = any>(key: utils.Key, item: I): Promise<I> {
    const data = await this.get(key)
    if (data instanceof Array) {
      data.unshift(item)
      return item
    }
    throw new Error("the unshift() function must bu used on Array value.")
  }

  @utils.checkReady()
  public async pop<I = any>(key: utils.Key): Promise<I> {
    const data = await this.get(key)
    if (data instanceof Array) {
      return data.pop()
    }
    throw new Error("the pop() function must bu used on Array value.")
  }

  @utils.checkReady()
  public async shift<I = any>(key: utils.Key): Promise<I> {
    const data = await this.get(key)
    if (data instanceof Array) {
      return data.shift()
    }
    throw new Error("the shift() function must bu used on Array value.")
  }

  @utils.checkReady()
  public async includes(key: utils.Key, item: any): Promise<boolean> {
    const data = await this.get(key)
    if (data instanceof Array) {
      return data.includes(item)
    }
    throw new Error("the includes() function must bu used on Array value.")
  }

  @utils.checkReady()
  public async forEach(
    callback: (data: T, key: utils.Key) => unknown
  ): Promise<void> {
    const entries = this.useCache ? this.cache : await this.fetchAll()
    for (const [key, data] of [...entries]) {
      await callback(data, key)
    }
  }

  @utils.checkReady()
  public async map<R>(
    callback: (data: T, key: utils.Key) => R | Promise<R>
  ): Promise<R[]> {
    const entries = this.useCache ? this.cache : await this.fetchAll()
    const output: R[] = []
    for (const [key, data] of [...entries]) {
      output.push(await callback(data, key))
    }
    return output
  }

  @utils.checkReady()
  public async some(
    callback: (data: T, key: utils.Key) => boolean | Promise<boolean>
  ): Promise<boolean> {
    const entries = this.useCache ? this.cache : await this.fetchAll()
    for (const [key, data] of [...entries]) {
      if (await callback(data, key)) {
        return true
      }
    }
    return false
  }

  @utils.checkReady()
  public async every(
    callback: (data: T, key: utils.Key) => boolean | Promise<boolean>
  ): Promise<boolean> {
    return !(await this.some(callback))
  }

  @utils.checkReady()
  public async filter(
    callback: (data: T, key: utils.Key) => boolean | Promise<boolean>
  ): Promise<Map<utils.Key, T>> {
    const entries = this.useCache ? this.cache : await this.fetchAll()
    const output = new Map<utils.Key, T>()
    for (const [key, data] of [...entries]) {
      if (await callback(data, key)) {
        output.set(key, data)
      }
    }
    return output
  }

  @utils.checkReady()
  public async filterArray(
    callback: (data: T, key: utils.Key) => boolean | Promise<boolean>
  ): Promise<T[]> {
    const entries = this.useCache ? this.cache : await this.fetchAll()
    const output: T[] = []
    for (const [key, data] of [...entries]) {
      if (await callback(data, key)) {
        output.push(data)
      }
    }
    return output
  }

  @utils.checkReady()
  public async find(
    callback: (data: T, key: utils.Key) => boolean | Promise<boolean>
  ): Promise<T | null> {
    const entries = this.useCache ? this.cache : await this.fetchAll()
    for (const [key, data] of [...entries]) {
      if (await callback(data, key)) {
        return data
      }
    }
    return null
  }

  @utils.checkReady()
  public fetchAll(): Promise<Map<utils.Key, T>> {
    return this.fetchKeys().then(async (keys) => {
      const entries = new Map<utils.Key, T>()
      for (const key of keys) {
        const data = await this.get(key)
        if (data !== null) entries.set(key, data)
      }
      return entries
    })
  }

  @utils.checkReady()
  public fetchValues(): Promise<T[]> {
    return this.fetchAll().then((entries) =>
      Array.from(entries).map((entry) => entry[1])
    )
  }

  @utils.checkReady()
  public fetchKeys(): Promise<utils.Key[]> {
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
}

export default Ghomap
module.exports = Ghomap
