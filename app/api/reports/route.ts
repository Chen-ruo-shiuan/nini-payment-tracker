import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

function getFinancials(db: ReturnType<typeof import('@/lib/db').getDb>, dateFilter: string) {
  // 預收金額：套組的預收總額（符合日期範圍的套組購買）
  const prepaid = (db.prepare(`
    SELECT COALESCE(SUM(prepaid_amount), 0) AS total FROM packages WHERE date LIKE ?
  `).get(dateFilter) as { total: number }).total

  // 待履行金額：未核銷堂數 × 單堂單價（不限日期，所有未完成套組）
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

  // 銷售折讓（套組折扣吸收）：本期購買套組中有設定原價者
  const discountRow = (db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN unit_price_orig > 0
        THEN (unit_price_orig * total_sessions) - prepaid_amount
        ELSE 0 END), 0) AS discount_absorbed,
      COALESCE(SUM(CASE WHEN unit_price_orig > 0
        THEN unit_price_orig * total_sessions
        ELSE prepaid_amount END), 0) AS pkg_orig_total
    FROM packages WHERE date LIKE ?
  `).get(dateFilter) as { discount_absorbed: number; pkg_orig_total: number })
  const discountAbsorbed = discountRow.discount_absorbed
  const pkgOrigTotal     = discountRow.pkg_orig_total

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
    pkgRealized, svUsed, pointsUsed,
    installmentReceived, installmentOutstanding,
    checkoutTotal, byPayMethod,
    discountAbsorbed, pkgOrigTotal,
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
