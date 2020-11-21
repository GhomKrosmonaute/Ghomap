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
  }

  async open(
    callback?: (key: string, value: T) => unknown
  ): Promise<Map<string, T>> {
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
    return this.cache
  }

  async delete(key: string) {
    if (!fs.existsSync(this.filepath(key))) return
    await fsp.unlink(this.filepath(key))
    if (this.useCache) this.cache.delete(key)
  }

  async random(): Promise<T | null> {
    const keys = this.useCache
      ? Array.from(this.cache.keys())
      : await this.fetchKeys()
    if (keys.length === 0) return null
    return this.get(keys[Math.floor(Math.random() * keys.length)])
  }

  deleteAll(): Promise<void> {
    return this.forEach((data, key) => this.delete(key))
  }

  async count(): Promise<number> {
    if (this.useCache) return this.cache.size
    return await fsp.readdir(this.path).then((filenames) => filenames.length)
  }

  async forEach(callback: (data: T, key: utils.Key) => unknown): Promise<void> {
    const list = this.useCache ? this.cache : await this.fetchAll()
    for (const [key, data] of [...list]) {
      await callback(data, key)
    }
  }

  async set(key: string, data: T): Promise<T> {
    utils.validateKey(key)
    const raw = utils.stringify(data)
    await fsp.writeFile(this.filepath(key), raw, "utf-8")
    if (this.useCache) this.cache.set(key, data)
    return data
  }

  async get(key: string): Promise<T | null> {
    utils.validateKey(key)
    if (this.useCache) return this.cache.get(key) ?? null
    if (!fs.existsSync(this.filepath(key))) return null
    const raw = await fsp.readFile(this.filepath(key), "utf-8")
    return utils.parse<T>(raw) ?? null
  }

  async ensure(key: string, defaultValue: T): Promise<T> {
    const data = await this.get(key)
    return data ?? (await this.set(key, defaultValue))
  }

  filepath(key: string): string {
    return path.join(this.path, key) + ".json"
  }

  fetchAll(): Promise<Map<utils.Key, T>> {
    return this.fetchKeys().then(async (keys) => {
      const entries = new Map<utils.Key, T>()
      for (const key of keys) {
        const data = await this.get(key)
        if (data !== null) entries.set(key, data)
      }
      return entries
    })
  }

  fetchValues(): Promise<T[]> {
    return this.fetchAll().then((entries) =>
      Array.from(entries).map((entry) => entry[1])
    )
  }

  fetchKeys(): Promise<utils.Key[]> {
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

  get path(): string {
    return path.join(Ghomap.path, this.name)
  }
}

export default Ghomap
module.exports = Ghomap
