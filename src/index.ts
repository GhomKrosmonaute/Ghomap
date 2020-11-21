import path from "path"
import fs from "fs"
import fsp from "fs/promises"
import * as utils from "./utils"

/**
 * The Ghomap constructor options
 *
 * @property fetchAllOnStart - The setter of {@link Ghomap.fetchAllOnStart}
 * @property useCache - The setter of {@link Ghomap.useCache}
 * @property name - The setter of {@link Ghomap.name}
 */
export interface Options {
  fetchAllOnStart?: boolean
  useCache?: boolean
  name?: utils.Key
}

/**
 * @class Ghomap
 */
class Ghomap<T = any> implements Options {
  /**
   * The path of databases directory
   *
   * @default "./data"
   */
  static path = path.join(utils.root, "data")

  /**
   * The lis of all instanced databases
   */
  static instances = new Set<Ghomap>()

  /**
   * Set the {@link Ghomap.path path} of databases directory
   *
   * @param _path - The new path relative to package.json position
   * @returns The solved full path put in {@link Ghomap.path path}
   */
  static setPath(_path: string): string {
    this.path = path.resolve(utils.root, _path)
    return this.path
  }

  /**
   * Run the {@link open} function of each instanced databases
   *
   * @param callback - In case of you need custom logs
   */
  static async openAll(
    callback?: (name: utils.Key, key: utils.Key, value: any) => unknown
  ): Promise<void> {
    for (const ghomap of this.instances.values()) {
      await ghomap.open((key, value) => {
        return callback?.(ghomap.name, key, value)
      })
    }
  }

  private cache = new Map<utils.Key, T>()

  /**
   * The name of database in case of using multiple databases
   *
   * @default {@link https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Objets_globaux/String "default"}
   */
  public name: utils.Key

  /**
   * Activate cache to get data quickly
   *
   * @remarks
   * Deactivate this flag if you don't have enough RAM on your server
   *
   * @default {@link https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Objets_globaux/Boolean true}
   */
  public useCache: boolean

  /**
   * Fetch all data on {@link open} called and fill cache
   *
   * @remarks
   * Does nothing if the useCache flag is disabled
   *
   * @default {@link https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Objets_globaux/Boolean true}
   */
  public fetchAllOnStart: boolean

  private ready: boolean = false

  /**
   * Create local database, add created database in {@link Ghomap.instances Ghomap instances}
   *
   * @param options - The {@link name} of your database or {@link Options options}
   */
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

  /**
   * Make this database ready for usage
   *
   * @remarks
   * For multiple databases, use static {@link openAll} method instead
   *
   * @param callback
   */
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
          const raw = await fsp.readFile(this.filepath(key), "utf-8")
          const value = utils.parse<T>(raw) ?? null
          if (value !== null) {
            this.cache.set(key, value)
            callback?.(key, value)
          }
        }
      }
    }
    this.ready = true
  }

  /**
   * Remove the database and all data, delete files and cache.
   */
  @utils.checkReady()
  public async destroy(): Promise<void> {
    await this.deleteAll()
    await fsp.rmdir(this.path)
    this.ready = false
  }

  /**
   * Delete target data
   *
   * @param key - The key of data you want delete
   */
  @utils.checkReady()
  public async delete(key: utils.Key): Promise<void> {
    if (!fs.existsSync(this.filepath(key))) return
    await fsp.unlink(this.filepath(key))
    if (this.useCache) this.cache.delete(key)
  }

  /**
   * Delete all data
   */
  @utils.checkReady()
  public deleteAll(): Promise<void> {
    return this.forEach((data, key) => this.delete(key))
  }

  /**
   * Get random data
   */
  @utils.checkReady()
  public async random(): Promise<T | null> {
    const keys = this.useCache
      ? Array.from(this.cache.keys())
      : await this.fetchKeys()
    if (keys.length === 0) return null
    return this.get(keys[Math.floor(Math.random() * keys.length)])
  }

  /**
   * Check if key exists
   *
   * @param key
   * @returns True if the key exists in database
   */
  @utils.checkReady()
  public has(key: utils.Key): boolean {
    if (this.useCache) return this.cache.has(key)
    return fs.existsSync(this.filepath(key))
  }

  /**
   * Count the values in database
   *
   * @returns Count of data
   */
  @utils.checkReady()
  public async count(): Promise<number> {
    if (this.useCache) return this.cache.size
    return await fsp.readdir(this.path).then((filenames) => filenames.length)
  }

  /**
   * Set data by key
   *
   * @param key
   * @param data
   * @returns The data put
   */
  @utils.checkReady()
  public async set(key: utils.Key, data: T): Promise<T> {
    utils.validateKey(key)
    const raw = utils.stringify(data)
    await fsp.writeFile(this.filepath(key), raw, "utf-8")
    if (this.useCache) this.cache.set(key, data)
    return data
  }

  /**
   * Get data by key
   *
   * @param key
   * @returns The data or {@link https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Objets_globaux/null null}
   */
  @utils.checkReady()
  public async get(key: utils.Key): Promise<T | null> {
    utils.validateKey(key)
    if (this.useCache) return this.cache.get(key) ?? null
    if (!fs.existsSync(this.filepath(key))) return null
    const raw = await fsp.readFile(this.filepath(key), "utf-8")
    return utils.parse<T>(raw) ?? null
  }

  /**
   * Get data by key like {@link get} function but ensure a fallback
   * data in case of data is not found, then call the {@link set} function
   *
   * @param key
   * @param defaultValue - The fallback data to put in database if data not exists
   * @returns The request data or the fallback data
   *
   * @example ```js
   * const data = await ghomap.ensure("key", 42)
   * ```
   */
  @utils.checkReady()
  public async ensure(key: utils.Key, defaultValue: T): Promise<T> {
    const data = await this.get(key)
    return data ?? (await this.set(key, defaultValue))
  }

  /**
   * Similar to {@link https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Objets_globaux/Array/push <Array>.push} method for {@link Array} data
   *
   * @param key
   * @param items
   * @returns The pushed item
   *
   * @example ```js
   * await ghomap.push("my-array", 42)
   * ```
   */
  @utils.checkReady()
  public async push<I = any>(key: utils.Key, ...items: I[]): Promise<I[]> {
    const data = await this.get(key)
    if (data instanceof Array) {
      data.push(...items)
      await this.set(key, data)
      return items
    }
    throw new utils.TargetTypeError("push")
  }

  /**
   * Similar to {@link https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Objets_globaux/Array/unshift <Array>.unshift} method for {@link Array} data
   *
   * @example ```js
   * await ghomap.unshift("my-array", 42)
   * ```
   *
   * @param key
   * @param item
   * @returns The un-shifted item
   */
  @utils.checkReady()
  public async unshift<I = any>(key: utils.Key, item: I): Promise<I> {
    const data = await this.get(key)
    if (data instanceof Array) {
      data.unshift(item)
      await this.set(key, data)
      return item
    }
    throw new utils.TargetTypeError("unshift")
  }

  /**
   * Similar to {@link https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Objets_globaux/Array/pop <Array>.pop} method for {@link Array} data
   *
   * @example ```js
   * const pop = await ghomap.pop("my-array")
   * ```
   *
   * @param key
   * @returns The item pop
   */
  @utils.checkReady()
  public async pop<I = any>(key: utils.Key): Promise<I> {
    const data = await this.get(key)
    if (data instanceof Array) {
      const pop = data.pop()
      await this.set(key, data)
      return pop
    }
    throw new utils.TargetTypeError("pop")
  }

  /**
   * Similar to {@link https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Objets_globaux/Array/shift <Array>.shift} method for {@link Array} data
   *
   * @example ```js
   * const shift = await ghomap.shift("my-array")
   * ```
   *
   * @param key
   * @returns The item shift
   */
  @utils.checkReady()
  public async shift<I = any>(key: utils.Key): Promise<I> {
    const data = await this.get(key)
    if (data instanceof Array) {
      const shift = data.shift()
      await this.set(key, data)
      return shift
    }
    throw new utils.TargetTypeError("shift")
  }

  /**
   * Similar to {@link https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Objets_globaux/Array/includes <Array>.includes} method for {@link Array} data
   *
   * @example ```js
   * if(await ghomap.includes("my-array", 42)){
   *   // do something
   * }
   * ```
   *
   * @param key
   * @param item
   * @returns True if item is includes in {@link Array} data
   */
  @utils.checkReady()
  public async includes(key: utils.Key, item: any): Promise<boolean> {
    const data = await this.get(key)
    if (data instanceof Array) {
      return data.includes(item)
    }
    throw new utils.TargetTypeError("includes")
  }

  /**
   * Similar to {@link https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Objets_globaux/Array/forEach <Array>.forEach} method but in asynchronous
   *
   * @example ```js
   * await ghomap.forEach(async (data, key) => {
   *   // do asynchronous something for each data/keys
   * })
   * ```
   *
   * @param callback
   */
  @utils.checkReady()
  public async forEach(
    callback: (data: T, key: utils.Key) => unknown
  ): Promise<void> {
    const entries = this.useCache ? this.cache : await this.fetchAll()
    for (const [key, data] of [...entries]) {
      await callback(data, key)
    }
  }

  /**
   * Similar to {@link https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Objets_globaux/Array/map <Array>.map} method but in asynchronous
   *
   * @example ```js
   * const mapped = await ghomap.map(async (data, key) => {
   *   // return asynchronous thing for each data/keys
   * })
   * ```
   *
   * @param callback
   * @returns The mapped database
   */
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

  /**
   * Similar to {@link https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Objets_globaux/Array/some <Array>.some} method but in asynchronous
   *
   * @example ```js
   * const check = await ghomap.some(async (data, key) => {
   *   // return asynchronous check for each data/keys
   * })
   * ```
   *
   * @param callback
   * @returns True if some successful check
   */
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

  /**
   * Similar to {@link https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Objets_globaux/Array/every <Array>.every} method but in asynchronous
   *
   * @example ```js
   * const check = await ghomap.every(async (data, key) => {
   *   // return asynchronous check for each data/keys
   * })
   * ```
   *
   * @param callback
   * @returns True if every successful check
   */
  @utils.checkReady()
  public async every(
    callback: (data: T, key: utils.Key) => boolean | Promise<boolean>
  ): Promise<boolean> {
    return !(await this.some(callback))
  }

  /**
   * Similar to {@link https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Objets_globaux/Array/filter <Array>.filter} method but in asynchronous
   *
   * @example ```js
   * const filtered = await ghomap.filter(async (data, key) => {
   *   // return asynchronous check for each data/keys
   * })
   * ```
   *
   * @param callback
   * @returns The filtered data as {@link Map}
   */
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

  /**
   * Similar to {@link https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Objets_globaux/Array/filter <Array>.filter} method but in asynchronous
   *
   * @example ```js
   * const filtered = await ghomap.filterArray(async (data, key) => {
   *   // return asynchronous check for each data/keys
   * })
   * ```
   *
   * @param callback
   * @returns The filtered data as {@link Array}
   */
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

  /**
   * Similar to {@link https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Objets_globaux/Array/find <Array>.find} method but in asynchronous
   *
   * @example ```js
   * const data = await ghomap.find(async (data, key) => {
   *   // return asynchronous check for each data/keys
   * })
   * ```
   *
   * @param callback
   * @returns The first successful checks data
   */
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

  /**
   * Fetch all data from disk, update the cache if {@link useCache} flag is set to `true`
   *
   * @returns All fetched data as {@link Map}
   */
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

  /**
   * Fetch all data from disk, update the cache if {@link useCache} flag is set to `true`
   *
   * @returns All fetched data as {@link Array}
   */
  @utils.checkReady()
  public fetchValues(): Promise<T[]> {
    return this.fetchAll().then((entries) =>
      Array.from(entries).map((entry) => entry[1])
    )
  }

  /**
   * Fetch all keys from disk
   *
   * @returns All fetched keys
   */
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

  /**
   * Check if the database is ready
   *
   * @remarks
   * You must {@link open} the database before using it
   *
   * @returns True if the database is ready
   */
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
