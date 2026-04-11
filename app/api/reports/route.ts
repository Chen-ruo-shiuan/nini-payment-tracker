import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

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

    // Items for each checkout
    for (const co of checkouts as { id: number; items?: unknown[] }[]) {
      co.items = db.prepare(`SELECT * FROM checkout_items WHERE checkout_id = ?`).all(co.id)
    }
    // Payment breakdown
    const payBreakdown = db.prepare(`
      SELECT cp.method, SUM(cp.amount) AS total
      FROM checkout_payments cp
      JOIN checkouts co ON co.id = cp.checkout_id
      WHERE co.date = ?
      GROUP BY cp.method
      ORDER BY total DESC
    `).all(target)

    const total = (checkouts as { total_amount: number }[]).reduce((s, c) => s + c.total_amount, 0)
    return NextResponse.json({ type: 'daily', date: target, checkouts, payBreakdown, total })
  }

  if (type === 'monthly') {
    const target = month || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' }).slice(0, 7)
    // By day
    const byDay = db.prepare(`
      SELECT date,
             COUNT(*) AS count,
             SUM(total_amount) AS total
      FROM checkouts WHERE date LIKE ?
      GROUP BY date ORDER BY date ASC
    `).all(`${target}%`)
    // By payment method
    const byMethod = db.prepare(`
      SELECT cp.method, SUM(cp.amount) AS total, COUNT(*) AS count
      FROM checkout_payments cp
      JOIN checkouts co ON co.id = cp.checkout_id
      WHERE co.date LIKE ?
      GROUP BY cp.method ORDER BY total DESC
    `).all(`${target}%`)
    // By item category
    const byCategory = db.prepare(`
      SELECT ci.category, SUM(ci.price * ci.qty) AS total, SUM(ci.qty) AS qty
      FROM checkout_items ci
      JOIN checkouts co ON co.id = ci.checkout_id
      WHERE co.date LIKE ?
      GROUP BY ci.category ORDER BY total DESC
    `).all(`${target}%`)
    // Top services
    const topServices = db.prepare(`
      SELECT ci.label, ci.category,
             SUM(ci.price * ci.qty) AS total, SUM(ci.qty) AS qty
      FROM checkout_items ci
      JOIN checkouts co ON co.id = ci.checkout_id
      WHERE co.date LIKE ? AND ci.category != '套組核銷'
      GROUP BY ci.label ORDER BY total DESC LIMIT 10
    `).all(`${target}%`)

    const monthTotal = (byDay as { total: number }[]).reduce((s, d) => s + d.total, 0)
    const monthCount = (byDay as { count: number }[]).reduce((s, d) => s + d.count, 0)
    return NextResponse.json({ type: 'monthly', month: target, byDay, byMethod, byCategory, topServices, monthTotal, monthCount })
  }

  if (type === 'yearly') {
    const byMonth = db.prepare(`
      SELECT substr(date, 1, 7) AS month,
             COUNT(*) AS count,
             SUM(total_amount) AS total
      FROM checkouts WHERE date LIKE ?
      GROUP BY month ORDER BY month ASC
    `).all(`${year}%`)
    // Package stats for year
    const pkgStats = db.prepare(`
      SELECT SUM(prepaid_amount) AS prepaid,
             SUM(used_sessions * unit_price) AS realized
      FROM packages WHERE date LIKE ?
    `).all(`${year}%`)

    const yearTotal = (byMonth as { total: number }[]).reduce((s, m) => s + m.total, 0)
    return NextResponse.json({ type: 'yearly', year, byMonth, pkgStats: pkgStats[0], yearTotal })
  }

  return NextResponse.json({ error: '無效的報表類型' }, { status: 400 })
}
