import path from "path"
import fs from "fs"
import fsp from "fs/promises"
import * as utils from "./utils"

class Ghomap<T> {
  static path = path.join(utils.root, "data")

  static setPath(_path: string): string {
    this.path = path.resolve(utils.root, _path)
    return this.path
  }

  private cache = new Set<string>()

  constructor(public readonly name: string = "default") {}

  async open() {
    await utils.ensureDir(Ghomap.path)
    await utils.ensureDir(this.path)
    this.cache = new Set(
      (await fsp.readdir(this.path))
        .filter((filename) => filename.endsWith(".json"))
        .map((filename) => filename.slice(0, filename.lastIndexOf(".")))
    )
  }

  async delete(key: string) {
    if (!fs.existsSync(this.filepath(key))) return
    await fsp.unlink(this.filepath(key))
    this.cache.delete(key)
  }

  async deleteAll() {
    for (const key of [...this.cache]) {
      await this.delete(key)
    }
  }

  async set(key: string, data: T) {
    const raw = utils.stringify(data)
    await fsp.writeFile(this.filepath(key), raw, "utf-8")
    this.cache.add(key)
  }

  async get(key: string): Promise<T | undefined> {
    if (!fs.existsSync(this.filepath(key))) return undefined
    const raw = await fsp.readFile(this.filepath(key), "utf-8")
    return utils.parse<T>(raw)
  }

  async ensure(key: string, defaultValue: T): Promise<T> {
    return (await this.get(key)) ?? defaultValue
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
