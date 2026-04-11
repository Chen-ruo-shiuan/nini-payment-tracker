import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// POST /api/import
export async function POST(req: NextRequest) {
  const db = getDb()
  const body = await req.json()

  const {
    clients: rawClients = [],
    packages: rawPackages = [],
    checkouts: rawCheckouts = [],
    expenses: rawExpenses = [],
  } = body as {
    clients: OldClient[]
    packages: OldPackage[]
    checkouts: OldCheckout[]
    expenses: OldExpense[]
  }

  // ── 計算每個 package 的 usedSessions（從 checkouts 算）──────────────
  const pkgUsedMap = new Map<string, number>()
  for (const co of rawCheckouts) {
    for (const item of co.items ?? []) {
      if (item.pkgId) {
        pkgUsedMap.set(item.pkgId, (pkgUsedMap.get(item.pkgId) ?? 0) + (item.qty ?? 1))
      }
    }
  }

  const stats = { clients: 0, sv: 0, packages: 0, checkouts: 0, expenses: 0, skipped: 0 }

  const run = db.transaction(() => {

    // ── 1. Clients ──────────────────────────────────────────────────────
    const insertClient = db.prepare(`
      INSERT OR IGNORE INTO clients
        (name, phone, note, level, level_since, birthday,
         points, yodomo_card_points, yodomo_total_cards,
         yodomo_redeemed, tea_usage, legacy_id)
      VALUES
        (@name, @phone, @note, @level, @level_since, @birthday,
         @points, @yodomo_card_points, @yodomo_total_cards,
         @yodomo_redeemed, @tea_usage, @legacy_id)
    `)
    const insertSv = db.prepare(`
      INSERT OR IGNORE INTO sv_ledger (client_id, amount, note, date, legacy_id)
      VALUES (@client_id, @amount, @note, @date, @legacy_id)
    `)

    // Build legacy_id → new client id map
    const legacyMap = new Map<string, number>()

    for (const c of rawClients) {
      // Check already imported
      const existing = db.prepare('SELECT id FROM clients WHERE legacy_id = ?').get(c.id) as { id: number } | undefined
      if (existing) {
        legacyMap.set(c.id, existing.id)
        stats.skipped++
        continue
      }

      // Convert teaUsage: {"YYYY-MM": [date, date]} → {"YYYY-MM": count}
      const teaUsageConverted: Record<string, number> = {}
      for (const [month, val] of Object.entries(c.teaUsage ?? {})) {
        teaUsageConverted[month] = Array.isArray(val) ? val.length : (val as number)
      }

      const res = insertClient.run({
        name: c.name,
        phone: c.phone || null,
        note: c.note || null,
        level: c.level || '甜癒米',
        level_since: c.levelSince || null,
        birthday: c.birthday || null,
        points: c.points ?? 0,
        yodomo_card_points: c.yodomoCardPoints ?? 0,
        yodomo_total_cards: c.yodomoTotalCards ?? 0,
        yodomo_redeemed: JSON.stringify(c.yodomoCardRedeemed ?? []),
        tea_usage: JSON.stringify(teaUsageConverted),
        legacy_id: c.id,
      })

      const newId = Number(res.lastInsertRowid)
      legacyMap.set(c.id, newId)
      stats.clients++

      // 儲值金 → sv_ledger
      if ((c.storedValue ?? 0) > 0) {
        insertSv.run({
          client_id: newId,
          amount: c.storedValue,
          note: '匯入初始儲值金',
          date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' }),
          legacy_id: `sv_${c.id}`,
        })
        stats.sv++
      }
    }

    // ── 2. Packages ────────────────────────────────────────────────────
    const insertPkg = db.prepare(`
      INSERT OR IGNORE INTO packages
        (client_id, service_name, total_sessions, used_sessions,
         unit_price, prepaid_amount, payment_method,
         include_in_accumulation, include_in_points, note, date, legacy_id)
      VALUES
        (@client_id, @service_name, @total_sessions, @used_sessions,
         @unit_price, @prepaid_amount, @payment_method,
         @include_in_accumulation, @include_in_points, @note, @date, @legacy_id)
    `)

    for (const p of rawPackages) {
      const clientId = legacyMap.get(p.clientId)
      if (!clientId) continue

      const existing = db.prepare('SELECT id FROM packages WHERE legacy_id = ?').get(p.id)
      if (existing) { stats.skipped++; continue }

      insertPkg.run({
        client_id: clientId,
        service_name: p.serviceName,
        total_sessions: p.totalSessions ?? 1,
        used_sessions: pkgUsedMap.get(p.id) ?? 0,
        unit_price: p.unitPrice ?? 0,
        prepaid_amount: p.prepaidAmount ?? 0,
        payment_method: p.paymentMethod || '現金',
        include_in_accumulation: p.includeInAccumulation ? 1 : 0,
        include_in_points: p.includeInPoints ? 1 : 0,
        note: p.note || null,
        date: p.date,
        legacy_id: p.id,
      })
      stats.packages++
    }

    // ── 3. Checkouts ───────────────────────────────────────────────────
    const insertCo = db.prepare(`
      INSERT OR IGNORE INTO checkouts
        (client_id, date, note, total_amount,
         incl_course, incl_product, incl_yodomo, incl_points, legacy_id)
      VALUES
        (@client_id, @date, @note, @total_amount,
         @incl_course, @incl_product, @incl_yodomo, @incl_points, @legacy_id)
    `)
    const insertItem = db.prepare(`
      INSERT INTO checkout_items (checkout_id, category, label, price, qty)
      VALUES (@checkout_id, @category, @label, @price, @qty)
    `)
    const insertPay = db.prepare(`
      INSERT INTO checkout_payments (checkout_id, method, amount)
      VALUES (@checkout_id, @method, @amount)
    `)

    for (const co of rawCheckouts) {
      const existing = db.prepare('SELECT id FROM checkouts WHERE legacy_id = ?').get(co.id)
      if (existing) { stats.skipped++; continue }

      const clientId = co.clientId ? legacyMap.get(co.clientId) ?? null : null

      const coRes = insertCo.run({
        client_id: clientId,
        date: co.date,
        note: co.note || null,
        total_amount: co.total ?? 0,
        incl_course: co.inclCourse ? 1 : 0,
        incl_product: co.inclProduct ? 1 : 0,
        incl_yodomo: co.inclYodomo ? 1 : 0,
        incl_points: co.inclPoints ? 1 : 0,
        legacy_id: co.id,
      })

      const coId = Number(coRes.lastInsertRowid)
      for (const item of co.items ?? []) {
        insertItem.run({
          checkout_id: coId,
          category: item.category || '服務',
          label: item.name || item.label || '',
          price: item.price ?? 0,
          qty: item.qty ?? 1,
        })
      }
      for (const pay of co.payments ?? []) {
        insertPay.run({
          checkout_id: coId,
          method: pay.method,
          amount: pay.amount ?? 0,
        })
      }
      stats.checkouts++
    }

    // ── 4. Expenses ────────────────────────────────────────────────────
    const insertExp = db.prepare(`
      INSERT OR IGNORE INTO expenses (date, category, note, amount, pay_method, legacy_id)
      VALUES (@date, @category, @note, @amount, @pay_method, @legacy_id)
    `)

    for (const e of rawExpenses) {
      const existing = db.prepare('SELECT id FROM expenses WHERE legacy_id = ?').get(e.id)
      if (existing) { stats.skipped++; continue }

      insertExp.run({
        date: e.date,
        category: e.category || '其他',
        note: e.note || null,
        amount: e.amount ?? 0,
        pay_method: e.payMethod || '店內現金',
        legacy_id: e.id,
      })
      stats.expenses++
    }
  })

  try {
    run()
    return NextResponse.json({ success: true, stats })
  } catch (err) {
    console.error('[Import Error]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ── Old system types ───────────────────────────────────────────────────────

interface OldClient {
  id: string; name: string; phone: string; note: string; level: string
  levelSince: string; birthday: string; storedValue: number; points: number
  yodomoCardPoints: number; yodomoCardRedeemed: number[]
  yodomoTotalCards: number; teaUsage: Record<string, string[] | number>
}
interface OldPackage {
  id: string; clientId: string; serviceName: string
  totalSessions: number; unitPrice: number; prepaidAmount: number
  date: string; note: string; paymentMethod: string
  includeInAccumulation: boolean; includeInPoints: boolean
}
interface OldCheckout {
  id: string; clientId: string; date: string; note: string; total: number
  inclCourse: boolean; inclProduct: boolean; inclYodomo: boolean; inclPoints: boolean
  items: { id: string; category: string; name?: string; label?: string; price: number; qty: number; pkgId?: string }[]
  payments: { id: string; method: string; amount: number }[]
}
interface OldExpense {
  id: string; date: string; category: string; note: string; amount: number; payMethod: string
}
