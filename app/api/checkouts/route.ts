import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { LEVEL_POINTS, YODOMO_THRESHOLD } from '@/types'

export const runtime = 'nodejs'

// GET /api/checkouts?client_id=&date=YYYY-MM-DD&limit=20
export async function GET(req: NextRequest) {
  const db = getDb()
  const clientId = req.nextUrl.searchParams.get('client_id')
  const date     = req.nextUrl.searchParams.get('date')
  const limit    = Number(req.nextUrl.searchParams.get('limit') || '20')

  const conditions: string[] = []
  const binds: (string | number)[] = []

  if (clientId) { conditions.push('co.client_id = ?'); binds.push(clientId) }
  if (date)     { conditions.push('co.date = ?');      binds.push(date) }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  binds.push(limit)

  const checkouts = db.prepare(`
    SELECT co.*, c.name AS client_name
    FROM checkouts co LEFT JOIN clients c ON c.id = co.client_id
    ${where}
    ORDER BY co.created_at DESC LIMIT ?
  `).all(...binds)

  for (const co of checkouts as { id: number; items?: unknown[]; payments?: unknown[] }[]) {
    co.items    = db.prepare('SELECT * FROM checkout_items WHERE checkout_id = ?').all(co.id)
    co.payments = db.prepare('SELECT * FROM checkout_payments WHERE checkout_id = ?').all(co.id)
  }
  return NextResponse.json(checkouts)
}

// POST /api/checkouts
export async function POST(req: NextRequest) {
  const db = getDb()
  const body = await req.json()
  const {
    client_id, date, note,
    items,          // { category, label, price, qty, pkg_id? }[]
    payments,       // { method, amount }[]
    incl_course, incl_product, incl_yodomo, incl_points,
  } = body

  if (!items?.length)    return NextResponse.json({ error: '請新增消費品項' }, { status: 400 })
  if (!payments?.length) return NextResponse.json({ error: '請新增付款方式' }, { status: 400 })

  const totalAmount = (items as { price: number; qty: number }[])
    .reduce((s, i) => s + i.price * i.qty, 0)

  const run = db.transaction(() => {
    // ── 1. Insert checkout ───────────────────────────────────────────────────
    const coRes = db.prepare(`
      INSERT INTO checkouts (client_id, date, note, total_amount, incl_course, incl_product, incl_yodomo, incl_points)
      VALUES (@client_id, @date, @note, @total_amount, @incl_course, @incl_product, @incl_yodomo, @incl_points)
    `).run({
      client_id: client_id ?? null,
      date: date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' }),
      note: note || null,
      total_amount: totalAmount,
      incl_course:  incl_course  ? 1 : 0,
      incl_product: incl_product ? 1 : 0,
      incl_yodomo:  incl_yodomo  ? 1 : 0,
      incl_points:  incl_points  ? 1 : 0,
    })
    const coId = Number(coRes.lastInsertRowid)

    // ── 2. Items ─────────────────────────────────────────────────────────────
    for (const item of items as { category: string; label: string; price: number; qty: number; pkg_id?: number }[]) {
      db.prepare(`
        INSERT INTO checkout_items (checkout_id, category, label, price, qty, pkg_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(coId, item.category, item.label, item.price, item.qty, item.pkg_id ?? null)

      // 商品券: increment used_sessions
      if (item.category === '商品券' && item.pkg_id) {
        db.prepare(`UPDATE packages SET used_sessions = used_sessions + ? WHERE id = ?`)
          .run(item.qty, item.pkg_id)
      }
    }

    // ── 3. Payments ──────────────────────────────────────────────────────────
    let pointsEarned = 0
    let yodomoEarned = 0
    for (const pay of payments as { method: string; amount: number }[]) {
      db.prepare(`
        INSERT INTO checkout_payments (checkout_id, method, amount) VALUES (?, ?, ?)
      `).run(coId, pay.method, pay.amount)

      // 儲值金 → deduct sv_ledger
      if (pay.method === '儲值金' && client_id) {
        db.prepare(`
          INSERT INTO sv_ledger (client_id, amount, note, date)
          VALUES (?, ?, ?, ?)
        `).run(
          client_id, -pay.amount, `結帳 #${coId} 儲值金消費`,
          date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
        )
      }
    }

    // ── 4. Points & Yodomo earned ────────────────────────────────────────────
    if (client_id && (incl_points || incl_yodomo)) {
      const client = db.prepare('SELECT level, points, yodomo_card_points, yodomo_total_cards FROM clients WHERE id = ?')
        .get(client_id) as { level: string; points: number; yodomo_card_points: number; yodomo_total_cards: number } | undefined

      if (client) {
        // Qualifying amount
        const qualifyingAmount =
          (items as { category: string; price: number; qty: number }[])
            .filter(i => {
              if (['服務', '加購', '活動'].includes(i.category)) return incl_course
              if (i.category === '產品') return incl_product
              return false
            })
            .reduce((s, i) => s + i.price * i.qty, 0)

        if (incl_points && qualifyingAmount > 0) {
          const rate = LEVEL_POINTS[client.level as keyof typeof LEVEL_POINTS] ?? 2
          pointsEarned = Math.floor(qualifyingAmount / 1000) * rate
          if (pointsEarned > 0) {
            db.prepare(`UPDATE clients SET points = points + ?, updated_at = datetime('now') WHERE id = ?`)
              .run(pointsEarned, client_id)
          }
        }

        if (incl_yodomo && qualifyingAmount > 0) {
          yodomoEarned = Math.floor(qualifyingAmount / YODOMO_THRESHOLD)
          if (yodomoEarned > 0) {
            db.prepare(`UPDATE clients SET yodomo_card_points = yodomo_card_points + ?, updated_at = datetime('now') WHERE id = ?`)
              .run(yodomoEarned, client_id)
          }
        }
      }
    }

    return { id: coId, pointsEarned, yodomoEarned, totalAmount }
  })

  try {
    const result = run()
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    console.error('[Checkout Error]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
