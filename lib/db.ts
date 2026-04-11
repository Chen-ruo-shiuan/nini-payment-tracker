import Database from 'better-sqlite3'
import path from 'path'
import { mkdirSync } from 'fs'

const DB_PATH = process.env.DATABASE_URL || path.join(process.cwd(), 'data', 'nini.db')

let db: Database.Database

export function getDb(): Database.Database {
  if (!db) {
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
    -- ═══════════════════════════════
    --  CLIENTS（核心：所有功能的基礎）
    -- ═══════════════════════════════
    CREATE TABLE IF NOT EXISTS clients (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      name                TEXT NOT NULL,
      phone               TEXT,
      note                TEXT,
      level               TEXT NOT NULL DEFAULT '甜癒米',
      level_since         TEXT,
      birthday            TEXT,
      points              INTEGER NOT NULL DEFAULT 0,
      yodomo_card_points  INTEGER NOT NULL DEFAULT 0,
      yodomo_total_cards  INTEGER NOT NULL DEFAULT 0,
      yodomo_redeemed     TEXT NOT NULL DEFAULT '[]',
      tea_usage           TEXT NOT NULL DEFAULT '{}',
      legacy_id           TEXT,
      created_at          TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ═══════════════════════════════
    --  INSTALLMENT CONTRACTS（分期合約）
    -- ═══════════════════════════════
    CREATE TABLE IF NOT EXISTS installment_contracts (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id           INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      total_amount        INTEGER NOT NULL DEFAULT 0,
      payment_method      TEXT NOT NULL DEFAULT 'cash',
      total_periods       INTEGER NOT NULL DEFAULT 3,
      note                TEXT,
      is_completed        INTEGER NOT NULL DEFAULT 0,
      created_at          TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ═══════════════════════════════
    --  INSTALLMENTS（各期付款）
    -- ═══════════════════════════════
    CREATE TABLE IF NOT EXISTS installments (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id   INTEGER NOT NULL REFERENCES installment_contracts(id) ON DELETE CASCADE,
      client_id     INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      period_number INTEGER NOT NULL,
      due_date      TEXT NOT NULL,
      paid_at       TEXT,
      amount        INTEGER NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(contract_id, period_number)
    );

    -- ═══════════════════════════════
    --  PACKAGES（預購套組）
    -- ═══════════════════════════════
    CREATE TABLE IF NOT EXISTS packages (
      id                      INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id               INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      service_name            TEXT NOT NULL,
      total_sessions          INTEGER NOT NULL DEFAULT 0,
      used_sessions           INTEGER NOT NULL DEFAULT 0,
      unit_price              INTEGER NOT NULL DEFAULT 0,
      prepaid_amount          INTEGER NOT NULL DEFAULT 0,
      payment_method          TEXT NOT NULL DEFAULT 'cash',
      include_in_accumulation INTEGER NOT NULL DEFAULT 1,
      include_in_points       INTEGER NOT NULL DEFAULT 1,
      note                    TEXT,
      date                    TEXT NOT NULL,
      legacy_id               TEXT,
      created_at              TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ═══════════════════════════════
    --  SESSIONS（套組核銷記錄）
    -- ═══════════════════════════════
    CREATE TABLE IF NOT EXISTS sessions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      package_id    INTEGER REFERENCES packages(id) ON DELETE SET NULL,
      client_id     INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      service_name  TEXT NOT NULL,
      amount        INTEGER NOT NULL DEFAULT 0,
      date          TEXT NOT NULL,
      note          TEXT,
      legacy_id     TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ═══════════════════════════════
    --  CHECKOUTS（結帳記錄）
    -- ═══════════════════════════════
    CREATE TABLE IF NOT EXISTS checkouts (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id     INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      date          TEXT NOT NULL,
      note          TEXT,
      total_amount  INTEGER NOT NULL DEFAULT 0,
      incl_course   INTEGER NOT NULL DEFAULT 1,
      incl_product  INTEGER NOT NULL DEFAULT 1,
      incl_yodomo   INTEGER NOT NULL DEFAULT 0,
      incl_points   INTEGER NOT NULL DEFAULT 1,
      legacy_id     TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS checkout_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      checkout_id INTEGER NOT NULL REFERENCES checkouts(id) ON DELETE CASCADE,
      category    TEXT NOT NULL DEFAULT '服務',
      label       TEXT NOT NULL,
      price       INTEGER NOT NULL DEFAULT 0,
      qty         INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS checkout_payments (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      checkout_id INTEGER NOT NULL REFERENCES checkouts(id) ON DELETE CASCADE,
      method      TEXT NOT NULL,
      amount      INTEGER NOT NULL DEFAULT 0
    );

    -- ═══════════════════════════════
    --  STORED VALUE LEDGER（儲值金）
    -- ═══════════════════════════════
    CREATE TABLE IF NOT EXISTS sv_ledger (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id   INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      amount      INTEGER NOT NULL,
      note        TEXT,
      date        TEXT NOT NULL,
      legacy_id   TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ═══════════════════════════════
    --  EXPENSES（支出）
    -- ═══════════════════════════════
    CREATE TABLE IF NOT EXISTS expenses (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      date        TEXT NOT NULL,
      category    TEXT NOT NULL DEFAULT '食材耗材',
      note        TEXT,
      amount      INTEGER NOT NULL DEFAULT 0,
      pay_method  TEXT NOT NULL DEFAULT '店內現金',
      legacy_id   TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ═══════════════════════════════
    --  PUSH NOTIFICATIONS
    -- ═══════════════════════════════
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint    TEXT NOT NULL UNIQUE,
      p256dh      TEXT NOT NULL,
      auth        TEXT NOT NULL,
      user_agent  TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notification_log (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      installment_id  INTEGER NOT NULL REFERENCES installments(id),
      days_before     INTEGER NOT NULL,
      sent_at         TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(installment_id, days_before)
    );
  `)

  // 自動遷移：把舊 customers 資料搬到新 clients + installment_contracts
  migrateLegacyCustomers(db)
}

function migrateLegacyCustomers(db: Database.Database) {
  const hasOldTable = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='customers'`
  ).get()
  if (!hasOldTable) return

  const oldCustomers = db.prepare('SELECT * FROM customers').all() as {
    id: number; name: string; total_amount: number; installment_amount: number;
    payment_method: string; total_periods: number; membership_tier: string;
    notes: string | null; is_completed: number; created_at: string
  }[]

  if (oldCustomers.length === 0) {
    db.prepare('DROP TABLE IF EXISTS customers').run()
    return
  }

  const clientsCount = db.prepare('SELECT COUNT(*) as n FROM clients').get() as { n: number }
  if (clientsCount.n > 0) {
    db.prepare('DROP TABLE IF EXISTS customers').run()
    return
  }

  const insertClient = db.prepare(`
    INSERT INTO clients (name, level, notes, created_at)
    VALUES (@name, @level, @notes, @created_at)
  `)
  const insertContract = db.prepare(`
    INSERT INTO installment_contracts (client_id, total_amount, payment_method, total_periods, note, is_completed, created_at)
    VALUES (@client_id, @total_amount, @payment_method, @total_periods, @note, @is_completed, @created_at)
  `)
  const getOldInstallments = db.prepare(
    'SELECT * FROM installments WHERE customer_id = ? ORDER BY period_number ASC'
  )
  const insertInstallment = db.prepare(`
    INSERT INTO installments (contract_id, client_id, period_number, due_date, paid_at, amount, created_at)
    VALUES (@contract_id, @client_id, @period_number, @due_date, @paid_at, @amount, @created_at)
  `)

  const migrate = db.transaction(() => {
    for (const c of oldCustomers) {
      const clientRes = insertClient.run({
        name: c.name,
        level: c.membership_tier || '甜癒米',
        notes: c.notes || null,
        created_at: c.created_at,
      })
      const clientId = clientRes.lastInsertRowid

      const contractRes = insertContract.run({
        client_id: clientId,
        total_amount: c.total_amount,
        payment_method: c.payment_method,
        total_periods: c.total_periods,
        note: c.notes || null,
        is_completed: c.is_completed,
        created_at: c.created_at,
      })
      const contractId = contractRes.lastInsertRowid

      // Check if old installments table has customer_id column
      try {
        const oldInsts = getOldInstallments.all(c.id) as {
          id: number; period_number: number; due_date: string;
          paid_at: string | null; amount: number; created_at: string
        }[]
        for (const inst of oldInsts) {
          insertInstallment.run({
            contract_id: contractId,
            client_id: clientId,
            period_number: inst.period_number,
            due_date: inst.due_date,
            paid_at: inst.paid_at,
            amount: inst.amount,
            created_at: inst.created_at,
          })
        }
      } catch {
        // old installments table might not exist or have different schema
      }
    }
  })

  migrate()
  db.prepare('DROP TABLE IF EXISTS customers').run()
  console.log(`[DB] Migrated ${oldCustomers.length} legacy customers → clients`)
}
