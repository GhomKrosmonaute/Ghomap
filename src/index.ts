import path from "path"
import fs from "fs"
import fsp from "fs/promises"
import * as utils from "./utils"

export interface Options {
  fetchAll?: boolean
  cached?: boolean
  name?: utils.Key
}

class Ghomap<T> implements Options {
  static path = path.join(utils.root, "data")

  static setPath(_path: string): string {
    this.path = path.resolve(utils.root, _path)
    return this.path
  }

  private cache = new Map<string, T>()

  /**
   * The name of database <br>
   * default: `"default"`
   */
  public name: utils.Key
  /**
   * Use cache or not ? <br>
   * default: `true`
   */
  public cached: boolean
  /**
   * Fetch all on start or not ? <br>
   * default: `true`
   */
  public fetchAll: boolean

  constructor(options: Options | string = "default") {
    if (typeof options === "string") {
      utils.validateKey(options)
      this.name = options
      this.cached = true
      this.fetchAll = true
    } else {
      this.cached = options.cached ?? true
      this.fetchAll = options.fetchAll ?? true
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
    if (this.fetchAll && this.cached) {
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
    if (this.cached) this.cache.delete(key)
  }

  deleteAll(): Promise<void> {
    return this.forEach((data, key) => this.delete(key))
  }

  async count(): Promise<number> {
    if (this.cached) return this.cache.size
    return await fsp.readdir(this.path).then((filenames) => filenames.length)
  }

  async forEach(callback: (data: T, key: utils.Key) => unknown): Promise<void> {
    if (this.cached) {
      for (const [key, data] of [...this.cache]) {
        await callback(data, key)
      }
    } else {
      const dir = await fsp.readdir(this.path)
      for (const filename of dir) {
        if (filename.endsWith(".json")) {
          const key = path.basename(filename, ".json")
          const data = await this.get(key)
          if (data !== null) {
            await callback(data, key)
          }
        }
      }
    }
  }

  async set(key: string, data: T): Promise<T> {
    utils.validateKey(key)
    const raw = utils.stringify(data)
    await fsp.writeFile(this.filepath(key), raw, "utf-8")
    if (this.cached) this.cache.set(key, data)
    return data
  }

  async get(key: string): Promise<T | null> {
    utils.validateKey(key)
    if (this.cached) return this.cache.get(key) ?? null
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

  get path(): string {
    return path.join(Ghomap.path, this.name)
  }
}

export default Ghomap
module.exports = Ghomap
