// Connection settings shared by the skill's scripts. mysql2 is the server's
// dependency, not the app's.
import { createRequire } from 'node:module'

const require = createRequire(new URL('../../../../server/package.json', import.meta.url))
const mysql = require('mysql2/promise')

export const settings = {
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USERNAME ?? 'root',
  password: process.env.DB_PASSWORD ?? 'rootpass',
  database: process.env.DB_NAME ?? 'pdf_editor_verify',
}

export const connect = (overrides = {}) =>
  mysql.createConnection({ ...settings, dateStrings: true, ...overrides })
