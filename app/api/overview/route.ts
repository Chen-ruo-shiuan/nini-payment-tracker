import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

function getTaipeiDate(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
}
function thisMonth() {
  return getTaipeiDate(0).slice(0, 7)
}

export async function GET() {
  const db = getDb()
  const today = getTaipeiDate(0)
  const in7days = getTaipeiDate(7)
  const month = thisMonth()

  // ── 套組預收 vs 實收 ───────────────────────────────────────────────────────
  const pkgStats = db.prepare(`
    SELECT
      COALESCE(SUM(prepaid_amount), 0)                                          AS pkg_prepaid,
      COALESCE(SUM(used_sessions * unit_price), 0)                              AS pkg_realized,
      COALESCE(SUM((total_sessions - used_sessions) * unit_price), 0)           AS pkg_outstanding,
      COUNT(*)                                                                   AS pkg_total,
      SUM(CASE WHEN used_sessions < total_sessions THEN 1 ELSE 0 END)           AS pkg_active
    FROM packages
  `).get() as { pkg_prepaid: number; pkg_realized: number; pkg_outstanding: number; pkg_total: number; pkg_active: number }

  // ── 儲值金統計 ────────────────────────────────────────────────────────────
  const svStats = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)        AS sv_deposited,
      COALESCE(ABS(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END)), 0)   AS sv_used,
      COALESCE(SUM(amount), 0)                                              AS sv_balance
    FROM sv_ledger
  `).get() as { sv_deposited: number; sv_used: number; sv_balance: number }

  // ── 金米折抵 ─────────────────────────────────────────────────────────────
  const pointsRedeemed = (db.prepare(`
    SELECT COALESCE(SUM(cp.amount), 0) AS total
    FROM checkout_payments cp
    WHERE cp.method = '金米'
  `).get() as { total: number }).total

  // ── 本月結帳 ──────────────────────────────────────────────────────────────
  const monthStats = db.prepare(`
    SELECT
      COUNT(*) AS month_count,
      COALESCE(SUM(total_amount), 0) AS month_total
    FROM checkouts WHERE date LIKE ?
  `).get(`${month}%`) as { month_count: number; month_total: number }

  // ── 分期待收 ─────────────────────────────────────────────────────────────
  const installmentOutstanding = (db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS total FROM installments WHERE paid_at IS NULL
  `).get() as { total: number }).total

  // ── 逾期 / 今日 / 本週 付款 ──────────────────────────────────────────────
  const dueQuery = `
    SELECT i.id, i.client_id, i.period_number, i.due_date, i.amount,
           c.name AS client_name, c.level AS client_level
    FROM installments i
    JOIN installment_contracts ic ON ic.id = i.contract_id
    JOIN clients c ON c.id = i.client_id
    WHERE i.paid_at IS NULL
  `
  const overdue  = db.prepare(`${dueQuery} AND i.due_date < ? ORDER BY i.due_date ASC`).all(today)
  const todayDue = db.prepare(`${dueQuery} AND i.due_date = ? ORDER BY i.due_date ASC`).all(today)
  const weekDue  = db.prepare(`${dueQuery} AND i.due_date > ? AND i.due_date <= ? ORDER BY i.due_date ASC`).all(today, in7days)

  // ── 進行中套組（含客人名稱，最多顯示 20 筆）──────────────────────────────
  const activePackages = db.prepare(`
    SELECT p.*, c.name AS client_name, c.level AS client_level
    FROM packages p
    JOIN clients c ON c.id = p.client_id
    WHERE p.used_sessions < p.total_sessions
    ORDER BY p.date DESC
    LIMIT 20
  `).all()

  // ── 最近結帳（最近 10 筆）────────────────────────────────────────────────
  const recentCheckouts = db.prepare(`
    SELECT co.id, co.date, co.total_amount, co.note,
           c.name AS client_name
    FROM checkouts co
    LEFT JOIN clients c ON c.id = co.client_id
    ORDER BY co.date DESC, co.created_at DESC
    LIMIT 10
  `).all()

  // ── 本月結帳明細（依日期分組）────────────────────────────────────────────
  const monthCheckouts = db.prepare(`
    SELECT co.id, co.date, co.total_amount, co.note,
           c.name AS client_name
    FROM checkouts co
    LEFT JOIN clients c ON c.id = co.client_id
    WHERE co.date LIKE ?
    ORDER BY co.date DESC, co.created_at DESC
  `).all(`${month}%`)

  // ── 客人總數 ─────────────────────────────────────────────────────────────
  const totalClients = (db.prepare('SELECT COUNT(*) AS n FROM clients').get() as { n: number }).n

  return NextResponse.json({
    // 大數字
    pkg_prepaid:    pkgStats.pkg_prepaid,
    pkg_realized:   pkgStats.pkg_realized,
    pkg_pending:    pkgStats.pkg_outstanding,
    pkg_total:      pkgStats.pkg_total,
    pkg_active:     pkgStats.pkg_active,
    sv_deposited:   svStats.sv_deposited,
    sv_used:        svStats.sv_used,
    sv_balance:     svStats.sv_balance,
    points_redeemed: pointsRedeemed,
    month_count:    monthStats.month_count,
    month_total:    monthStats.month_total,
    installment_outstanding: installmentOutstanding,
    total_clients:  totalClients,
    // 列表
    overdue, todayDue, weekDue,
    activePackages,
    recentCheckouts,
    monthCheckouts,
  })
}
