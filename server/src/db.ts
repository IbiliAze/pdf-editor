import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { migrate } from './migrations.js'

export type Db = Database.Database

export function openDb(path: string): Db {
  if (path !== ':memory:') {
    try {
      mkdirSync(dirname(path), { recursive: true })
    } catch {
      // already there, or not creatable; the open below reports the real error
    }
  }
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')
  migrate(db)
  return db
}
