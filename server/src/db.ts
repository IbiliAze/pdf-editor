import mysql from 'mysql2/promise'
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import type { Config } from './config.js'
import { migrate } from './migrations.js'

export type Db = Pool

/** What a statement's placeholders may be bound to. */
export type Param = string | number | boolean | null

/** How long to keep retrying the first connection before giving up (ms). */
const CONNECT_TIMEOUT_MS = 30_000

export async function openDb(config: Config): Promise<Db> {
  const pool = mysql.createPool({
    host: config.DB_HOST,
    port: config.DB_PORT,
    database: config.DB_NAME,
    user: config.DB_USERNAME,
    password: config.DB_PASSWORD,
    // One small service with a single replica; a handful of connections is
    // plenty and keeps the shared server's connection count low.
    connectionLimit: 5,
    waitForConnections: true,
    charset: 'utf8mb4_0900_ai_ci',
    // DATETIME columns come back as 'YYYY-MM-DD HH:MM:SS' strings rather than
    // Date objects, so the values the API hands the browser are the same
    // strings whatever the database is.
    dateStrings: true,
    timezone: 'Z',
  })

  // Every timestamp the schema writes comes from the server clock, so the
  // session has to be in UTC or a server in another zone would store local
  // time and expiries would be wrong.
  pool.on('connection', (conn) => {
    conn.query("SET time_zone = '+00:00'")
  })

  await waitForServer(pool)
  await migrate(pool)
  return pool
}

/**
 * On a deploy the API can start before the database is accepting connections.
 * Retrying briefly turns that into a slow start rather than a crash loop.
 */
async function waitForServer(pool: Pool): Promise<void> {
  const deadline = Date.now() + CONNECT_TIMEOUT_MS
  for (;;) {
    try {
      const conn = await pool.getConnection()
      conn.release()
      return
    } catch (err) {
      if (Date.now() >= deadline) throw err
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
}

/** Every row of a query. */
export async function all<T>(db: Db, sql: string, params: Param[] = []): Promise<T[]> {
  const [rows] = await db.execute<RowDataPacket[]>(sql, params)
  return rows as T[]
}

/** The first row, or undefined. */
export async function one<T>(db: Db, sql: string, params: Param[] = []): Promise<T | undefined> {
  const rows = await all<T>(db, sql, params)
  return rows[0]
}

/** A statement that returns no rows; the result carries insertId. */
export async function run(db: Db, sql: string, params: Param[] = []): Promise<ResultSetHeader> {
  const [result] = await db.execute<ResultSetHeader>(sql, params)
  return result
}
