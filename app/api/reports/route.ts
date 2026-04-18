import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

function getFinancials(db: ReturnType<typeof import('@/lib/db').getDb>, dateFilter: string) {
  // 預收金額：全部套組歷史預收總額（不限日期，與總覽一致）
  const prepaid = (db.prepare(`
    SELECT COALESCE(SUM(prepaid_amount), 0) AS total FROM packages
  `).get() as { total: number }).total

  // 待履行金額：未核銷堂數 × 單堂單價（不限日期，所有未完成套組，與總覽一致）
  const outstanding = (db.prepare(`
    SELECT COALESCE(SUM((total_sessions - used_sessions) * unit_price), 0) AS total
    FROM packages WHERE used_sessions < total_sessions
  `).get() as { total: number }).total

  // 商品券已履行：本期結帳中商品券品項金額
  const pkgRealized = (db.prepare(`
    SELECT COALESCE(SUM(ci.price * ci.qty), 0) AS total
    FROM checkout_items ci
    JOIN checkouts co ON co.id = ci.checkout_id
    WHERE ci.category = '商品券' AND co.date LIKE ?
  `).get(dateFilter) as { total: number }).total

  // 儲值金：全期（不限日期）充值總額、餘額、讓利
  const svAll = (db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)                        AS sv_deposited,
      COALESCE(ABS(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END)), 0)                   AS sv_used_all,
      COALESCE(SUM(amount), 0)                                                              AS sv_balance,
      COALESCE(SUM(CASE WHEN paid_amount IS NOT NULL AND amount > paid_amount
                        THEN amount - paid_amount ELSE 0 END), 0)                          AS sv_allowance_all
    FROM sv_ledger
  `).get() as { sv_deposited: number; sv_used_all: number; sv_balance: number; sv_allowance_all: number })

  // 儲值讓利：本期充值中有折扣的讓利金額
  const svAllowancePeriod = (db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN paid_amount IS NOT NULL AND amount > paid_amount
                             THEN amount - paid_amount ELSE 0 END), 0) AS total
    FROM sv_ledger WHERE date LIKE ? AND amount > 0
  `).get(dateFilter) as { total: number }).total

  // 儲值金已使用：本期 sv_ledger 負值（消費）
  const svUsed = (db.prepare(`
    SELECT COALESCE(ABS(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END)), 0) AS total
    FROM sv_ledger WHERE date LIKE ?
  `).get(dateFilter) as { total: number }).total

  // 金米折抵：本期結帳付款方式為「金米」的金額
  const pointsUsed = (db.prepare(`
    SELECT COALESCE(SUM(cp.amount), 0) AS total
    FROM checkout_payments cp
    JOIN checkouts co ON co.id = cp.checkout_id
    WHERE cp.method = '金米' AND co.date LIKE ?
  `).get(dateFilter) as { total: number }).total

  // 優惠折扣：本期結帳付款方式為「優惠折扣」的金額（我方讓利，未收現金）
  const discountUsed = (db.prepare(`
    SELECT COALESCE(SUM(cp.amount), 0) AS total
    FROM checkout_payments cp
    JOIN checkouts co ON co.id = cp.checkout_id
    WHERE cp.method = '優惠折扣' AND co.date LIKE ?
  `).get(dateFilter) as { total: number }).total

  // 分期已收（本期）
  const installmentReceived = (db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total FROM installments
    WHERE paid_at LIKE ? AND paid_at IS NOT NULL
  `).get(dateFilter) as { total: number }).total

  // 分期未收（全部，不限日期）
  const installmentOutstanding = (db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total FROM installments WHERE paid_at IS NULL
  `).get() as { total: number }).total

  // 結帳實收（本期）
  const checkoutTotal = (db.prepare(`
    SELECT COALESCE(SUM(total_amount), 0) AS total FROM checkouts WHERE date LIKE ?
  `).get(dateFilter) as { total: number }).total

  // 付款方式明細（本期結帳）
  const byPayMethod = db.prepare(`
    SELECT cp.method, COALESCE(SUM(cp.amount), 0) AS total
    FROM checkout_payments cp
    JOIN checkouts co ON co.id = cp.checkout_id
    WHERE co.date LIKE ?
    GROUP BY cp.method ORDER BY total DESC
  `).all(dateFilter) as { method: string; total: number }[]

  // 套組讓利（銷售折讓）：本期核銷的商品券，原定價 vs 記帳價之差
  // 用結帳時間過濾，所以使用套組、P&L 就會更新
  const pkgDiscountRow = (db.prepare(`
    SELECT COALESCE(SUM(
      CASE WHEN p.unit_price_orig > ci.price
           THEN (p.unit_price_orig - ci.price) * ci.qty
           ELSE 0 END
    ), 0) AS pkg_discount
    FROM checkout_items ci
    JOIN packages p ON p.id = ci.pkg_id
    JOIN checkouts co ON co.id = ci.checkout_id
    WHERE ci.category = '商品券' AND co.date LIKE ?
  `).get(dateFilter) as { pkg_discount: number })
  const pkgDiscount = pkgDiscountRow.pkg_discount

  // 費用支出（本期）
  const expensesTotal = (db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE date LIKE ?
  `).get(dateFilter) as { total: number }).total

  const expensesByCategory = db.prepare(`
    SELECT category, COALESCE(SUM(amount), 0) AS total
    FROM expenses WHERE date LIKE ?
    GROUP BY category ORDER BY total DESC
  `).all(dateFilter) as { category: string; total: number }[]

  return {
    prepaid, outstanding,
    pkgRealized, svUsed, pointsUsed, discountUsed,
    svDeposited:      svAll.sv_deposited,
    svBalance:        svAll.sv_balance,
    svAllowanceAll:   svAll.sv_allowance_all,   // 全期儲值讓利（給預收區塊顯示）
    svAllowancePeriod,                           // 本期儲值讓利（進 P&L 銷售折讓）
    installmentReceived, installmentOutstanding,
    checkoutTotal, byPayMethod,
    pkgDiscount,
    expensesTotal, expensesByCategory,
  }
}

// GET /api/reports?type=daily&date=2026-04-11
// GET /api/reports?type=monthly&month=2026-04
// GET /api/reports?type=yearly&year=2026
export async function GET(req: NextRequest) {
  const db = getDb()
  const type  = req.nextUrl.searchParams.get('type')  || 'monthly'
  const date  = req.nextUrl.searchParams.get('date')  || ''
  const month = req.nextUrl.searchParams.get('month') || ''
  const year  = req.nextUrl.searchParams.get('year')  || new Date().getFullYear().toString()

  if (type === 'daily') {
    const target = date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })

    const checkouts = db.prepare(`
      SELECT co.id, co.date, co.total_amount, co.note,
             co.incl_course, co.incl_product,
             c.name AS client_name, c.level AS client_level
      FROM checkouts co
      LEFT JOIN clients c ON c.id = co.client_id
      WHERE co.date = ?
      ORDER BY co.created_at DESC
    `).all(target)

    for (const co of checkouts as { id: number; items?: unknown[] }[]) {
      co.items = db.prepare(`SELECT * FROM checkout_items WHERE checkout_id = ?`).all(co.id)
    }

    const payBreakdown = db.prepare(`
      SELECT cp.method, SUM(cp.amount) AS total
      FROM checkout_payments cp
      JOIN checkouts co ON co.id = cp.checkout_id
      WHERE co.date = ?
      GROUP BY cp.method ORDER BY total DESC
    `).all(target)

    // Category breakdown for the day
    const categoryBreakdown = db.prepare(`
      SELECT ci.category, SUM(ci.price * ci.qty) AS total, SUM(ci.qty) AS qty
      FROM checkout_items ci
      JOIN checkouts co ON co.id = ci.checkout_id
      WHERE co.date = ?
      GROUP BY ci.category ORDER BY total DESC
    `).all(target)

    const total = (checkouts as { total_amount: number }[]).reduce((s, c) => s + c.total_amount, 0)
    const fin = getFinancials(db, `${target}%`)

    return NextResponse.json({ type: 'daily', date: target, checkouts, payBreakdown, categoryBreakdown, total, financials: fin })
  }

  if (type === 'monthly') {
    const target = month || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' }).slice(0, 7)

    const byDay = db.prepare(`
      SELECT date, COUNT(*) AS count, SUM(total_amount) AS total
      FROM checkouts WHERE date LIKE ?
      GROUP BY date ORDER BY date ASC
    `).all(`${target}%`)

    const byMethod = db.prepare(`
      SELECT cp.method, SUM(cp.amount) AS total, COUNT(DISTINCT co.id) AS count
      FROM checkout_payments cp
      JOIN checkouts co ON co.id = cp.checkout_id
      WHERE co.date LIKE ?
      GROUP BY cp.method ORDER BY total DESC
    `).all(`${target}%`)

    const byCategory = db.prepare(`
      SELECT ci.category, SUM(ci.price * ci.qty) AS total, SUM(ci.qty) AS qty
      FROM checkout_items ci
      JOIN checkouts co ON co.id = ci.checkout_id
      WHERE co.date LIKE ?
      GROUP BY ci.category ORDER BY total DESC
    `).all(`${target}%`)

    // Top services (exclude 商品券 — already counted at purchase)
    const topServices = db.prepare(`
      SELECT ci.label, ci.category, SUM(ci.price * ci.qty) AS total, SUM(ci.qty) AS qty
      FROM checkout_items ci
      JOIN checkouts co ON co.id = ci.checkout_id
      WHERE co.date LIKE ? AND ci.category IN ('服務','加購','活動')
      GROUP BY ci.label ORDER BY qty DESC LIMIT 10
    `).all(`${target}%`)

    const topProducts = db.prepare(`
      SELECT ci.label, SUM(ci.price * ci.qty) AS total, SUM(ci.qty) AS qty
      FROM checkout_items ci
      JOIN checkouts co ON co.id = ci.checkout_id
      WHERE co.date LIKE ? AND ci.category = '產品'
      GROUP BY ci.label ORDER BY qty DESC LIMIT 10
    `).all(`${target}%`)

    // Top clients by spending
    const topClients = db.prepare(`
      SELECT c.id, c.name, c.level, SUM(co.total_amount) AS total, COUNT(*) AS visits
      FROM checkouts co
      JOIN clients c ON c.id = co.client_id
      WHERE co.date LIKE ?
      GROUP BY co.client_id ORDER BY total DESC LIMIT 10
    `).all(`${target}%`)

    const monthTotal = (byDay as { total: number }[]).reduce((s, d) => s + d.total, 0)
    const monthCount = (byDay as { count: number }[]).reduce((s, d) => s + d.count, 0)
    const fin = getFinancials(db, `${target}%`)

    return NextResponse.json({
      type: 'monthly', month: target,
      byDay, byMethod, byCategory, topServices, topProducts, topClients,
      monthTotal, monthCount, financials: fin,
    })
  }

  if (type === 'yearly') {
    const byMonth = db.prepare(`
      SELECT substr(date, 1, 7) AS month, COUNT(*) AS count, SUM(total_amount) AS total
      FROM checkouts WHERE date LIKE ?
      GROUP BY month ORDER BY month ASC
    `).all(`${year}%`)

    const byCategory = db.prepare(`
      SELECT ci.category, SUM(ci.price * ci.qty) AS total, SUM(ci.qty) AS qty
      FROM checkout_items ci
      JOIN checkouts co ON co.id = ci.checkout_id
      WHERE co.date LIKE ?
      GROUP BY ci.category ORDER BY total DESC
    `).all(`${year}%`)

    // Top services for year
    const topServices = db.prepare(`
      SELECT ci.label, ci.category, SUM(ci.price * ci.qty) AS total, SUM(ci.qty) AS qty
      FROM checkout_items ci
      JOIN checkouts co ON co.id = ci.checkout_id
      WHERE co.date LIKE ? AND ci.category IN ('服務','加購','活動')
      GROUP BY ci.label ORDER BY qty DESC LIMIT 10
    `).all(`${year}%`)

    const topProducts = db.prepare(`
      SELECT ci.label, SUM(ci.price * ci.qty) AS total, SUM(ci.qty) AS qty
      FROM checkout_items ci
      JOIN checkouts co ON co.id = ci.checkout_id
      WHERE co.date LIKE ? AND ci.category = '產品'
      GROUP BY ci.label ORDER BY qty DESC LIMIT 10
    `).all(`${year}%`)

    // Top clients for year
    const topClients = db.prepare(`
      SELECT c.id, c.name, c.level, SUM(co.total_amount) AS total, COUNT(*) AS visits
      FROM checkouts co
      JOIN clients c ON c.id = co.client_id
      WHERE co.date LIKE ?
      GROUP BY co.client_id ORDER BY total DESC LIMIT 10
    `).all(`${year}%`)

    // Package financials
    const pkgTotal = (db.prepare(`
      SELECT COALESCE(SUM(prepaid_amount),0) AS prepaid,
             COALESCE(SUM(used_sessions * unit_price),0) AS realized,
             COALESCE(SUM((total_sessions - used_sessions) * unit_price),0) AS outstanding
      FROM packages WHERE used_sessions < total_sessions
    `).get() as { prepaid: number; realized: number; outstanding: number })

    const yearTotal = (byMonth as { total: number }[]).reduce((s, m) => s + m.total, 0)
    const fin = getFinancials(db, `${year}%`)

    return NextResponse.json({
      type: 'yearly', year, byMonth, byCategory, topServices, topProducts, topClients,
      pkgStats: pkgTotal, yearTotal, financials: fin,
    })
  }

  return NextResponse.json({ error: '無效的報表類型' }, { status: 400 })
}
