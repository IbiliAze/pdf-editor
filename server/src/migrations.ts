import type { RowDataPacket } from 'mysql2/promise'
import type { Db } from './db.js'

/**
 * Ordered, append-only schema steps, each a list of statements. Never edit a
 * released entry: add a new one. `schema_version` records how many have run.
 *
 * MySQL commits DDL implicitly, so a step that fails half way leaves the
 * statements before it applied and the version unchanged. Write each step so
 * re-running it after a failure is safe.
 */
const MIGRATIONS: string[][] = [
  [
    `CREATE TABLE IF NOT EXISTS users (
      id                  INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      -- utf8mb4_0900_ai_ci is case-insensitive, so the unique key treats
      -- Case@Example.com and case@example.com as the same address.
      email               VARCHAR(254) NOT NULL UNIQUE,
      password_hash       VARCHAR(255) NOT NULL,
      verified_at         DATETIME NULL,
      created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      marketing_opt_in    TINYINT NOT NULL DEFAULT 0,
      marketing_opt_in_at DATETIME NULL,
      signup_source       VARCHAR(300) NULL
    ) ENGINE=InnoDB`,

    // Session ids and email tokens are stored as sha256 hex, which is ASCII
    // and must compare exactly, hence the binary collation.
    `CREATE TABLE IF NOT EXISTS sessions (
      id_hash      CHAR(64) COLLATE ascii_bin NOT NULL PRIMARY KEY,
      user_id      INT UNSIGNED NOT NULL,
      created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at   DATETIME NOT NULL,
      last_seen_at DATETIME NULL,
      ip           VARCHAR(45) NULL,
      user_agent   VARCHAR(300) NULL,
      KEY sessions_user (user_id),
      CONSTRAINT sessions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`,

    `CREATE TABLE IF NOT EXISTS email_tokens (
      token_hash CHAR(64) COLLATE ascii_bin NOT NULL PRIMARY KEY,
      user_id    INT UNSIGNED NOT NULL,
      kind       ENUM('verify', 'reset') NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      used_at    DATETIME NULL,
      KEY email_tokens_user (user_id, kind),
      CONSTRAINT email_tokens_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`,

    `CREATE TABLE IF NOT EXISTS downloads (
      id         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id    INT UNSIGNED NOT NULL,
      filename   VARCHAR(300) NOT NULL,
      page_count INT UNSIGNED NOT NULL DEFAULT 0,
      byte_size  BIGINT UNSIGNED NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY downloads_user (user_id, created_at DESC),
      CONSTRAINT downloads_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`,
  ],
]

export async function migrate(db: Db): Promise<number> {
  await db.query(
    'CREATE TABLE IF NOT EXISTS schema_version (version INT NOT NULL) ENGINE=InnoDB',
  )
  const [rows] = await db.query<RowDataPacket[]>('SELECT version FROM schema_version LIMIT 1')
  const stored = rows[0] as { version: number } | undefined
  let current = stored?.version ?? 0
  if (!stored) await db.query('INSERT INTO schema_version (version) VALUES (0)')

  for (let i = current; i < MIGRATIONS.length; i++) {
    for (const statement of MIGRATIONS[i]) await db.query(statement)
    await db.query('UPDATE schema_version SET version = ?', [i + 1])
    current = i + 1
  }
  return current
}
