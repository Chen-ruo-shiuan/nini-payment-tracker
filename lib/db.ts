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
    // Must rename old installments BEFORE initSchema creates the new one
    renameOldInstallmentsIfNeeded(db)
    initSchema(db)
    migrateLegacyCustomers(db)
    migrateOldInstallments(db)
    migrateClientColumns(db)
    migrateCheckoutItems(db)
    migrateSvLedgerPaymentMethod(db)
    migrateRenameCategory(db)
    migratePackageUnitPriceOrig(db)
    migrateSvLedgerPaidAmount(db)
    migratePointsLedger(db)
  }
  return db
}

// ─── 遷移：舊 installments 表（有 customer_id，無 client_id）→ 重新命名 ────────
// 必須在 initSchema 之前執行，讓 CREATE TABLE IF NOT EXISTS 能建立新表
function renameOldInstallmentsIfNeeded(db: Database.Database) {
  const tableExists = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='installments'`
  ).get()
  if (!tableExists) return

  const cols = (db.prepare('PRAGMA table_info(installments)').all() as { name: string }[])
    .map(c => c.name)

  // Old schema has customer_id, new schema has client_id + contract_id
  if (cols.includes('customer_id') && !cols.includes('client_id')) {
    db.exec('ALTER TABLE installments RENAME TO installments_old')
    console.log('[DB] Renamed old installments → installments_old')
  }
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
      level               TEXT NOT NULL DEFAULT '癒米',
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
    --  POINTS LEDGER（金米明細帳）
    -- ═══════════════════════════════
    CREATE TABLE IF NOT EXISTS points_ledger (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id   INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      delta       INTEGER NOT NULL,
      note        TEXT,
      date        TEXT NOT NULL,
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

    CREATE TABLE IF NOT EXISTS birthday_notification_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id   INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      year        INTEGER NOT NULL,
      days_before INTEGER NOT NULL,
      sent_at     TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(client_id, year, days_before)
    );
  `)

}

// ─── 遷移：新增 birthday_perks、harvest_given 欄位，並將生日格式轉換為 MM-DD ────
function migrateClientColumns(db: Database.Database) {
  const cols = (db.prepare('PRAGMA table_info(clients)').all() as { name: string }[]).map(c => c.name)

  if (!cols.includes('birthday_perks')) {
    db.exec(`ALTER TABLE clients ADD COLUMN birthday_perks TEXT NOT NULL DEFAULT '{}'`)
  }
  if (!cols.includes('harvest_given')) {
    db.exec(`ALTER TABLE clients ADD COLUMN harvest_given TEXT`)
  }

  // 生日格式：YYYY-MM-DD → MM-DD（僅對長度為 10 的值做轉換）
  const rows = db.prepare(
    `SELECT id, birthday FROM clients WHERE birthday IS NOT NULL AND length(birthday) = 10`
  ).all() as { id: number; birthday: string }[]
  for (const r of rows) {
    db.prepare(`UPDATE clients SET birthday = ? WHERE id = ?`).run(r.birthday.slice(5), r.id)
  }
}

// ─── 遷移：sv_ledger 新增 payment_method 欄位 ────────────────────────────────
function migrateSvLedgerPaymentMethod(db: Database.Database) {
  const cols = (db.prepare('PRAGMA table_info(sv_ledger)').all() as { name: string }[]).map(c => c.name)
  if (!cols.includes('payment_method')) {
    db.exec(`ALTER TABLE sv_ledger ADD COLUMN payment_method TEXT`)
  }
}

// ─── 遷移：checkout_items 新增 pkg_id 欄位 ────────────────────────────────────
function migrateCheckoutItems(db: Database.Database) {
  const cols = (db.prepare('PRAGMA table_info(checkout_items)').all() as { name: string }[]).map(c => c.name)
  if (!cols.includes('pkg_id')) {
    db.exec('ALTER TABLE checkout_items ADD COLUMN pkg_id INTEGER REFERENCES packages(id) ON DELETE SET NULL')
  }
}

// ─── 遷移：checkout_items.category「套組核銷」→「商品券」 ─────────────────────
function migrateRenameCategory(db: Database.Database) {
  db.prepare(`UPDATE checkout_items SET category = '商品券' WHERE category = '套組核銷'`).run()
}

// ─── 遷移：packages 新增 unit_price_orig（原始單堂定價，用於計算銷售折讓）──────
function migratePackageUnitPriceOrig(db: Database.Database) {
  const cols = (db.prepare('PRAGMA table_info(packages)').all() as { name: string }[]).map(c => c.name)
  if (!cols.includes('unit_price_orig')) {
    db.exec(`ALTER TABLE packages ADD COLUMN unit_price_orig INTEGER NOT NULL DEFAULT 0`)
  }
}

// ─── 遷移：sv_ledger 新增 paid_amount（實際收款，用於計算儲值讓利）──────────────
function migrateSvLedgerPaidAmount(db: Database.Database) {
  const cols = (db.prepare('PRAGMA table_info(sv_ledger)').all() as { name: string }[]).map(c => c.name)
  if (!cols.includes('paid_amount')) {
    db.exec(`ALTER TABLE sv_ledger ADD COLUMN paid_amount INTEGER`)
  }
  if (!cols.includes('include_in_accumulation')) {
    db.exec(`ALTER TABLE sv_ledger ADD COLUMN include_in_accumulation INTEGER NOT NULL DEFAULT 0`)
  }
}

// ─── 遷移：為已有 points > 0 且沒有明細的客人建立初始歷史記錄 ─────────────────
function migratePointsLedger(db: Database.Database) {
  const clients = db.prepare(
    `SELECT id, points, created_at FROM clients WHERE points > 0`
  ).all() as { id: number; points: number; created_at: string }[]

  const insertInit = db.prepare(`
    INSERT INTO points_ledger (client_id, delta, note, date)
    VALUES (@client_id, @delta, @note, @date)
  `)

  const migrate = db.transaction(() => {
    for (const c of clients) {
      const existing = db.prepare(
        `SELECT id FROM points_ledger WHERE client_id = ? LIMIT 1`
      ).get(c.id)
      if (existing) continue

      insertInit.run({
        client_id: c.id,
        delta: c.points,
        note: '歷史結餘（匯入）',
        date: c.created_at.slice(0, 10),
      })
    }
  })

  migrate()
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
    // Clients already migrated, just drop old table
    db.prepare('DROP TABLE IF EXISTS customers').run()
    return
  }

  const insertClient = db.prepare(`
    INSERT INTO clients (name, level, note, legacy_id, created_at)
    VALUES (@name, @level, @note, @legacy_id, @created_at)
  `)
  const insertContract = db.prepare(`
    INSERT INTO installment_contracts (client_id, total_amount, payment_method, total_periods, note, is_completed, created_at)
    VALUES (@client_id, @total_amount, @payment_method, @total_periods, @note, @is_completed, @created_at)
  `)

  const migrate = db.transaction(() => {
    for (const c of oldCustomers) {
      const clientRes = insertClient.run({
        name: c.name,
        level: c.membership_tier || '癒米',
        note: c.notes || null,
        legacy_id: String(c.id),
        created_at: c.created_at,
      })
      const clientId = clientRes.lastInsertRowid

      insertContract.run({
        client_id: clientId,
        total_amount: c.total_amount,
        payment_method: c.payment_method || '現金',
        total_periods: c.total_periods,
        note: c.notes || null,
        is_completed: c.is_completed,
        created_at: c.created_at,
      })
      // installments are migrated separately in migrateOldInstallments()
    }
  })

  migrate()
  db.prepare('DROP TABLE IF EXISTS customers').run()
  console.log(`[DB] Migrated ${oldCustomers.length} legacy customers → clients`)
}

// ─── 遷移：installments_old（舊欄位）→ installments（新欄位） ─────────────────
function migrateOldInstallments(db: Database.Database) {
  const hasOldTable = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='installments_old'`
  ).get()
  if (!hasOldTable) return

  const oldInsts = db.prepare(
    'SELECT * FROM installments_old ORDER BY customer_id, period_number ASC'
  ).all() as {
    customer_id: number; period_number: number; due_date: string;
    paid_at: string | null; amount: number; created_at: string
  }[]

  if (oldInsts.length === 0) {
    db.prepare('DROP TABLE IF EXISTS installments_old').run()
    return
  }

  const insertInstallment = db.prepare(`
    INSERT OR IGNORE INTO installments
      (contract_id, client_id, period_number, due_date, paid_at, amount, created_at)
    VALUES
      (@contract_id, @client_id, @period_number, @due_date, @paid_at, @amount, @created_at)
  `)

  // Group installments by customer_id
  const byCustomer = new Map<number, typeof oldInsts>()
  for (const inst of oldInsts) {
    const arr = byCustomer.get(inst.customer_id) ?? []
    arr.push(inst)
    byCustomer.set(inst.customer_id, arr)
  }

  const migrate = db.transaction(() => {
    for (const [customerId, insts] of byCustomer) {
      // Find the migrated client by legacy_id
      const client = db.prepare(
        `SELECT id FROM clients WHERE legacy_id = ?`
      ).get(String(customerId)) as { id: number } | undefined
      if (!client) continue

      // Find (or create) contract for this client
      let contract = db.prepare(
        `SELECT id FROM installment_contracts WHERE client_id = ? ORDER BY created_at ASC LIMIT 1`
      ).get(client.id) as { id: number } | undefined

      if (!contract) {
        const totalAmount = insts.reduce((s, i) => s + i.amount, 0)
        const contractRes = db.prepare(`
          INSERT INTO installment_contracts
            (client_id, total_amount, payment_method, total_periods, is_completed)
          VALUES (?, ?, '現金', ?, ?)
        `).run(client.id, totalAmount, insts.length, insts.every(i => i.paid_at) ? 1 : 0)
        contract = { id: Number(contractRes.lastInsertRowid) }
      }

      for (const inst of insts) {
        insertInstallment.run({
          contract_id: contract.id,
          client_id: client.id,
          period_number: inst.period_number,
          due_date: inst.due_date,
          paid_at: inst.paid_at,
          amount: inst.amount,
          created_at: inst.created_at,
        })
      }
    }
  })

  migrate()
  db.prepare('DROP TABLE IF EXISTS installments_old').run()
  console.log(`[DB] Migrated ${oldInsts.length} legacy installments → new schema`)
}
