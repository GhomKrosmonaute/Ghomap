import fs from "fs"
import fsp from "fs/promises"
import { Key } from "./index"

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

export function validateKey(key: string): key is Key {
  if (/^[^\s]+$/.test(key) && key.length > 3 && key.length < 65) return true
  else throw new Error("invalid provided key")
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

export class TargetTypeError extends TypeError {
  constructor(functionName: string) {
    super(`the ${functionName}() function must bu used on Array data.`)
  }
}
