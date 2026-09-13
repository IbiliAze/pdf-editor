import type { Db } from './db.js'

/**
 * Ordered, append-only schema steps. Never edit a released entry: add a new
 * one. `schema_version` records how many have run.
 */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    verified_at   TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE sessions (
    id_hash      TEXT PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at   TEXT NOT NULL,
    last_seen_at TEXT,
    ip           TEXT,
    user_agent   TEXT
  );
  CREATE INDEX sessions_user ON sessions(user_id);

  CREATE TABLE email_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind       TEXT NOT NULL CHECK (kind IN ('verify', 'reset')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    used_at    TEXT
  );
  CREATE INDEX email_tokens_user ON email_tokens(user_id, kind);

  CREATE TABLE downloads (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename   TEXT NOT NULL,
    page_count INTEGER NOT NULL DEFAULT 0,
    byte_size  INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX downloads_user ON downloads(user_id, created_at DESC);
  `,
  // Consent to hear from Eight Mile, given at signup and changeable from the
  // account menu, plus where the visitor came from when they signed up.
  `
  ALTER TABLE users ADD COLUMN marketing_opt_in INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE users ADD COLUMN marketing_opt_in_at TEXT;
  ALTER TABLE users ADD COLUMN signup_source TEXT;
  `,
]

export function migrate(db: Db): number {
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)')
  const row = db.prepare('SELECT version FROM schema_version LIMIT 1').get() as
    | { version: number }
    | undefined
  let current = row?.version ?? 0
  if (!row) db.prepare('INSERT INTO schema_version (version) VALUES (0)').run()

  for (let i = current; i < MIGRATIONS.length; i++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[i])
      db.prepare('UPDATE schema_version SET version = ?').run(i + 1)
    })()
    current = i + 1
  }
  return current
}
