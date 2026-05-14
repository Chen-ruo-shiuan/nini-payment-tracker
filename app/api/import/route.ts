import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// POST /api/import
export async function POST(req: NextRequest) {
  const db = getDb()
  const body = await req.json()
  const version = body.version ?? 1

  // ── Version 2：新格式（從 /api/export 匯出的 snake_case 格式）──────────
  if (version === 2) {
    const {
      clients = [],
      sv_ledger = [],
      points_ledger = [],
      packages = [],
      checkouts = [],
      expenses = [],
      installment_contracts = [],
      installments = [],
      shopping_credit_ledger = [],
    } = body

    const stats = {
      clients: 0, sv: 0, points: 0, packages: 0,
      checkouts: 0, expenses: 0, contracts: 0, installments: 0, sc: 0, skipped: 0,
    }

    const run = db.transaction(() => {
      // 1. Clients
      for (const c of clients as Record<string, unknown>[]) {
        const existing = db.prepare('SELECT id FROM clients WHERE id = ?').get(c.id)
        if (existing) { stats.skipped++; continue }
        db.prepare(`
          INSERT OR IGNORE INTO clients
            (id, name, phone, note, level, level_since, birthday,
             points, yodomo_card_points, yodomo_total_cards,
             yodomo_redeemed, tea_usage, birthday_perks, harvest_given,
             shopping_credit, legacy_id, created_at, updated_at)
          VALUES
            (@id, @name, @phone, @note, @level, @level_since, @birthday,
             @points, @yodomo_card_points, @yodomo_total_cards,
             @yodomo_redeemed, @tea_usage, @birthday_perks, @harvest_given,
             @shopping_credit, @legacy_id, @created_at, @updated_at)
        `).run({
          id: c.id,
          name: c.name,
          phone: c.phone ?? null,
          note: c.note ?? null,
          level: c.level ?? '癒米',
          level_since: c.level_since ?? null,
          birthday: c.birthday ?? null,
          points: c.points ?? 0,
          yodomo_card_points: c.yodomo_card_points ?? 0,
          yodomo_total_cards: c.yodomo_total_cards ?? 0,
          yodomo_redeemed: c.yodomo_redeemed ?? '[]',
          tea_usage: c.tea_usage ?? '{}',
          birthday_perks: c.birthday_perks ?? '{}',
          harvest_given: c.harvest_given ?? null,
          shopping_credit: c.shopping_credit ?? 0,
          legacy_id: c.legacy_id ?? null,
          created_at: c.created_at ?? new Date().toISOString(),
          updated_at: c.updated_at ?? new Date().toISOString(),
        })
        stats.clients++
      }

      // 2. sv_ledger
      for (const e of sv_ledger as Record<string, unknown>[]) {
        const existing = db.prepare('SELECT id FROM sv_ledger WHERE id = ?').get(e.id)
        if (existing) { stats.skipped++; continue }
        db.prepare(`
          INSERT OR IGNORE INTO sv_ledger
            (id, client_id, amount, paid_amount, payment_method,
             include_in_accumulation, note, date, created_at)
          VALUES
            (@id, @client_id, @amount, @paid_amount, @payment_method,
             @include_in_accumulation, @note, @date, @created_at)
        `).run({
          id: e.id,
          client_id: e.client_id,
          amount: e.amount ?? 0,
          paid_amount: e.paid_amount ?? null,
          payment_method: e.payment_method ?? null,
          include_in_accumulation: e.include_in_accumulation ?? 0,
          note: e.note ?? null,
          date: e.date,
          created_at: e.created_at ?? new Date().toISOString(),
        })
        stats.sv++
      }

      // 3. points_ledger
      for (const e of points_ledger as Record<string, unknown>[]) {
        const existing = db.prepare('SELECT id FROM points_ledger WHERE id = ?').get(e.id)
        if (existing) { stats.skipped++; continue }
        db.prepare(`
          INSERT OR IGNORE INTO points_ledger (id, client_id, delta, note, date, created_at)
          VALUES (@id, @client_id, @delta, @note, @date, @created_at)
        `).run({
          id: e.id,
          client_id: e.client_id,
          delta: e.delta ?? 0,
          note: e.note ?? null,
          date: e.date,
          created_at: e.created_at ?? new Date().toISOString(),
        })
        stats.points++
      }

      // 4. shopping_credit_ledger
      for (const e of shopping_credit_ledger as Record<string, unknown>[]) {
        const existing = db.prepare('SELECT id FROM shopping_credit_ledger WHERE id = ?').get(e.id)
        if (existing) { stats.skipped++; continue }
        db.prepare(`
          INSERT OR IGNORE INTO shopping_credit_ledger (id, client_id, delta, note, date, created_at)
          VALUES (@id, @client_id, @delta, @note, @date, @created_at)
        `).run({
          id: e.id,
          client_id: e.client_id,
          delta: e.delta ?? 0,
          note: e.note ?? null,
          date: e.date,
          created_at: e.created_at ?? new Date().toISOString(),
        })
        stats.sc++
      }

      // 5. Packages
      for (const p of packages as Record<string, unknown>[]) {
        const existing = db.prepare('SELECT id FROM packages WHERE id = ?').get(p.id)
        if (existing) { stats.skipped++; continue }
        db.prepare(`
          INSERT OR IGNORE INTO packages
            (id, client_id, service_name, total_sessions, used_sessions,
             unit_price, prepaid_amount, payment_method,
             include_in_accumulation, include_in_points, note, date, legacy_id, created_at)
          VALUES
            (@id, @client_id, @service_name, @total_sessions, @used_sessions,
             @unit_price, @prepaid_amount, @payment_method,
             @include_in_accumulation, @include_in_points, @note, @date, @legacy_id, @created_at)
        `).run({
          id: p.id,
          client_id: p.client_id,
          service_name: p.service_name,
          total_sessions: p.total_sessions ?? 1,
          used_sessions: p.used_sessions ?? 0,
          unit_price: p.unit_price ?? 0,
          prepaid_amount: p.prepaid_amount ?? 0,
          payment_method: p.payment_method ?? '現金',
          include_in_accumulation: p.include_in_accumulation ?? 0,
          include_in_points: p.include_in_points ?? 0,
          note: p.note ?? null,
          date: p.date,
          legacy_id: p.legacy_id ?? null,
          created_at: p.created_at ?? new Date().toISOString(),
        })
        stats.packages++
      }

      // 6. Checkouts + items + payments
      for (const co of checkouts as Record<string, unknown>[]) {
        const existing = db.prepare('SELECT id FROM checkouts WHERE id = ?').get(co.id)
        if (existing) { stats.skipped++; continue }
        db.prepare(`
          INSERT OR IGNORE INTO checkouts
            (id, client_id, date, note, total_amount,
             incl_course, incl_product, incl_yodomo, incl_points, created_at)
          VALUES
            (@id, @client_id, @date, @note, @total_amount,
             @incl_course, @incl_product, @incl_yodomo, @incl_points, @created_at)
        `).run({
          id: co.id,
          client_id: co.client_id ?? null,
          date: co.date,
          note: co.note ?? null,
          total_amount: co.total_amount ?? 0,
          incl_course: co.incl_course ?? 0,
          incl_product: co.incl_product ?? 0,
          incl_yodomo: co.incl_yodomo ?? 0,
          incl_points: co.incl_points ?? 0,
          created_at: co.created_at ?? new Date().toISOString(),
        })
        for (const item of (co.items as Record<string, unknown>[]) ?? []) {
          db.prepare(`
            INSERT INTO checkout_items (checkout_id, category, label, price, qty)
            VALUES (@checkout_id, @category, @label, @price, @qty)
          `).run({
            checkout_id: co.id,
            category: item.category ?? '服務',
            label: item.label ?? '',
            price: item.price ?? 0,
            qty: item.qty ?? 1,
          })
        }
        for (const pay of (co.payments as Record<string, unknown>[]) ?? []) {
          db.prepare(`
            INSERT INTO checkout_payments (checkout_id, method, amount)
            VALUES (@checkout_id, @method, @amount)
          `).run({
            checkout_id: co.id,
            method: pay.method,
            amount: pay.amount ?? 0,
          })
        }
        stats.checkouts++
      }

      // 7. Expenses
      for (const e of expenses as Record<string, unknown>[]) {
        const existing = db.prepare('SELECT id FROM expenses WHERE id = ?').get(e.id)
        if (existing) { stats.skipped++; continue }
        db.prepare(`
          INSERT OR IGNORE INTO expenses (id, date, category, note, amount, pay_method, created_at)
          VALUES (@id, @date, @category, @note, @amount, @pay_method, @created_at)
        `).run({
          id: e.id,
          date: e.date,
          category: e.category ?? '其他',
          note: e.note ?? null,
          amount: e.amount ?? 0,
          pay_method: e.pay_method ?? '店內當月現金',
          created_at: e.created_at ?? new Date().toISOString(),
        })
        stats.expenses++
      }

      // 8. Installment contracts
      for (const c of installment_contracts as Record<string, unknown>[]) {
        const existing = db.prepare('SELECT id FROM installment_contracts WHERE id = ?').get(c.id)
        if (existing) { stats.skipped++; continue }
        db.prepare(`
          INSERT OR IGNORE INTO installment_contracts
            (id, client_id, total_amount, payment_method, total_periods,
             note, is_completed, created_at, updated_at)
          VALUES
            (@id, @client_id, @total_amount, @payment_method, @total_periods,
             @note, @is_completed, @created_at, @updated_at)
        `).run({
          id: c.id,
          client_id: c.client_id,
          total_amount: c.total_amount ?? 0,
          payment_method: c.payment_method ?? '現金',
          total_periods: c.total_periods ?? 1,
          note: c.note ?? null,
          is_completed: c.is_completed ?? 0,
          created_at: c.created_at ?? new Date().toISOString(),
          updated_at: c.updated_at ?? new Date().toISOString(),
        })
        stats.contracts++
      }

      // 9. Installments
      for (const i of installments as Record<string, unknown>[]) {
        const existing = db.prepare('SELECT id FROM installments WHERE id = ?').get(i.id)
        if (existing) { stats.skipped++; continue }
        db.prepare(`
          INSERT OR IGNORE INTO installments
            (id, contract_id, client_id, period_number, due_date, paid_at, amount, created_at)
          VALUES
            (@id, @contract_id, @client_id, @period_number, @due_date, @paid_at, @amount, @created_at)
        `).run({
          id: i.id,
          contract_id: i.contract_id,
          client_id: i.client_id,
          period_number: i.period_number ?? 1,
          due_date: i.due_date,
          paid_at: i.paid_at ?? null,
          amount: i.amount ?? 0,
          created_at: i.created_at ?? new Date().toISOString(),
        })
        stats.installments++
      }
    })

    try {
      run()
      return NextResponse.json({ success: true, stats })
    } catch (err) {
      console.error('[Import v2 Error]', err)
      return NextResponse.json({ error: String(err) }, { status: 500 })
    }
  }

  // ── Version 1：舊格式（camelCase，舊系統備份）────────────────────────────
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

  const pkgUsedMap = new Map<string, number>()
  for (const co of rawCheckouts) {
    for (const item of co.items ?? []) {
      if (item.pkgId) {
        pkgUsedMap.set(item.pkgId, (pkgUsedMap.get(item.pkgId) ?? 0) + (item.qty ?? 1))
      }
    }
  }

  const svUsedByClient = new Map<string, number>()
  for (const co of rawCheckouts) {
    if (!co.clientId) continue
    for (const pay of co.payments ?? []) {
      if (pay.method === '儲值金' && pay.amount > 0) {
        svUsedByClient.set(co.clientId, (svUsedByClient.get(co.clientId) ?? 0) + pay.amount)
      }
    }
  }

  const stats = { clients: 0, sv: 0, packages: 0, checkouts: 0, expenses: 0, skipped: 0 }

  const run = db.transaction(() => {
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
    const legacyMap = new Map<string, number>()

    for (const c of rawClients) {
      const existing = db.prepare('SELECT id FROM clients WHERE legacy_id = ?').get(c.id) as { id: number } | undefined
      if (existing) { legacyMap.set(c.id, existing.id); stats.skipped++; continue }

      const teaUsageConverted: Record<string, string[]> = {}
      for (const [month, val] of Object.entries(c.teaUsage ?? {})) {
        teaUsageConverted[month] = Array.isArray(val) ? val.filter(v => typeof v === 'string') : []
      }

      const res = insertClient.run({
        name: c.name,
        phone: c.phone || null,
        note: c.note || null,
        level: (['癒米','甜癒米','療癒米','悟癒米'].includes(c.level) ? c.level : '癒米'),
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

      const svHistorical = svUsedByClient.get(c.id) ?? 0
      const svDeposit = (c.storedValue ?? 0) + svHistorical
      if (svDeposit > 0) {
        insertSv.run({
          client_id: newId, amount: svDeposit,
          note: '匯入初始儲值金',
          date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' }),
          legacy_id: `sv_${c.id}`,
        })
        stats.sv++
      }
    }

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
      if (db.prepare('SELECT id FROM packages WHERE legacy_id = ?').get(p.id)) { stats.skipped++; continue }
      insertPkg.run({
        client_id: clientId, service_name: p.serviceName,
        total_sessions: p.totalSessions ?? 1,
        used_sessions: pkgUsedMap.get(p.id) ?? 0,
        unit_price: p.unitPrice ?? 0, prepaid_amount: p.prepaidAmount ?? 0,
        payment_method: p.paymentMethod || '現金',
        include_in_accumulation: p.includeInAccumulation ? 1 : 0,
        include_in_points: p.includeInPoints ? 1 : 0,
        note: p.note || null, date: p.date, legacy_id: p.id,
      })
      stats.packages++
    }

    const insertCo = db.prepare(`
      INSERT OR IGNORE INTO checkouts
        (client_id, date, note, total_amount,
         incl_course, incl_product, incl_yodomo, incl_points, legacy_id)
      VALUES
        (@client_id, @date, @note, @total_amount,
         @incl_course, @incl_product, @incl_yodomo, @incl_points, @legacy_id)
    `)
    for (const co of rawCheckouts) {
      if (db.prepare('SELECT id FROM checkouts WHERE legacy_id = ?').get(co.id)) { stats.skipped++; continue }
      const clientId = co.clientId ? legacyMap.get(co.clientId) ?? null : null
      const coRes = insertCo.run({
        client_id: clientId, date: co.date, note: co.note || null,
        total_amount: co.total ?? 0,
        incl_course: co.inclCourse ? 1 : 0, incl_product: co.inclProduct ? 1 : 0,
        incl_yodomo: co.inclYodomo ? 1 : 0, incl_points: co.inclPoints ? 1 : 0,
        legacy_id: co.id,
      })
      const coId = Number(coRes.lastInsertRowid)
      for (const item of co.items ?? []) {
        db.prepare(`INSERT INTO checkout_items (checkout_id, category, label, price, qty) VALUES (?, ?, ?, ?, ?)`)
          .run(coId, item.category || '服務', item.name || item.label || '', item.price ?? 0, item.qty ?? 1)
      }
      for (const pay of co.payments ?? []) {
        db.prepare(`INSERT INTO checkout_payments (checkout_id, method, amount) VALUES (?, ?, ?)`)
          .run(coId, pay.method, pay.amount ?? 0)
        if (pay.method === '儲值金' && clientId && (pay.amount ?? 0) > 0) {
          db.prepare(`INSERT OR IGNORE INTO sv_ledger (client_id, amount, note, date, legacy_id) VALUES (@client_id, @amount, @note, @date, @legacy_id)`)
            .run({ client_id: clientId, amount: -(pay.amount), note: `歷史結帳消費 (${co.date})`, date: co.date, legacy_id: `sv_deduct_${co.id}_${pay.id ?? pay.method}` })
        }
      }
      stats.checkouts++
    }

    for (const e of rawExpenses) {
      if (db.prepare('SELECT id FROM expenses WHERE legacy_id = ?').get(e.id)) { stats.skipped++; continue }
      db.prepare(`INSERT OR IGNORE INTO expenses (date, category, note, amount, pay_method, legacy_id) VALUES (@date, @category, @note, @amount, @pay_method, @legacy_id)`)
        .run({ date: e.date, category: e.category || '其他', note: e.note || null, amount: e.amount ?? 0, pay_method: e.payMethod || '店內現金', legacy_id: e.id })
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
