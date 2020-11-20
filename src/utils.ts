import path from "path"
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

/** lock keys to be formatted in kebab-case. */
export function validateKey(key: string): string {
  if (/^[a-z][a-z-]*[a-z]$/.test(key)) return key
  throw new Error("provided key must be formatted in kebab-case")
}
