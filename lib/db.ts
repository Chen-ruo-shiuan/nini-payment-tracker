import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = process.env.DATABASE_URL || path.join(process.cwd(), 'data', 'nini.db')

let db: Database.Database

export function getDb(): Database.Database {
  if (!db) {
    // ensure data directory exists
    const { mkdirSync } = require('fs')
    mkdirSync(path.dirname(DB_PATH), { recursive: true })

    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initSchema(db)
  }
  return db
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      name               TEXT NOT NULL,
      total_amount       INTEGER NOT NULL,
      installment_amount INTEGER NOT NULL,
      payment_method     TEXT NOT NULL DEFAULT 'cash',
      total_periods      INTEGER NOT NULL DEFAULT 3,
      membership_tier    TEXT NOT NULL DEFAULT '甜癒米',
      notes              TEXT,
      is_completed       INTEGER NOT NULL DEFAULT 0,
      created_at         TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS installments (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id   INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      period_number INTEGER NOT NULL,
      due_date      TEXT NOT NULL,
      paid_at       TEXT,
      amount        INTEGER NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(customer_id, period_number)
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint   TEXT NOT NULL UNIQUE,
      p256dh     TEXT NOT NULL,
      auth       TEXT NOT NULL,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notification_log (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      installment_id INTEGER NOT NULL REFERENCES installments(id),
      days_before    INTEGER NOT NULL,
      sent_at        TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(installment_id, days_before)
    );
  `)
}
