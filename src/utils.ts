import fs from "fs"
import fsp from "fs/promises"

export const root = process.cwd()

export async function ensureDir(dirpath: string) {
  if (!fs.existsSync(dirpath)) {
    await fsp.mkdir(dirpath)
  }
}

export function stringify<T>(data: T): string {
  try {
    return JSON.stringify(data)
  } catch (error) {
    throw new Error("provided data must be json-able")
  }
}

export function parse<T>(raw: string): T {
  return JSON.parse(raw)
}

export type Key = string

/** lock keys to be formatted in kebab-case. */
export function validateKey(key: string): key is Key {
  if (/^[a-z][a-z-]*[a-z]$/.test(key)) return true
  else throw new Error("provided key must be formatted in kebab-case")
}

export function checkReady() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const original = descriptor.value
    descriptor.value = function (...args: any[]) {
      // @ts-ignore
      if (this.isReady) {
        return original.apply(this, args)
      } else {
        throw new Error(
          `the database must be ready to use this feature: ${propertyKey}()`
        )
      }
    }
  }
}
