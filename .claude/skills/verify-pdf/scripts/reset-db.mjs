// Drop and recreate the throwaway database an end-to-end run uses, so every
// run starts with no accounts and no download history.
//
//   node reset-db.mjs
//
// Reads the same DB_* variables as the API, defaulting to a local MySQL on
// 3306. DB_NAME defaults to pdf_editor_verify: never point this at a database
// that matters, it drops it.
import { connect, settings } from './db.mjs'

const conn = await connect({ database: undefined })
await conn.query(`DROP DATABASE IF EXISTS \`${settings.database}\``)
await conn.query(
  `CREATE DATABASE \`${settings.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
)
await conn.end()
console.log(`${settings.database} is empty`)
