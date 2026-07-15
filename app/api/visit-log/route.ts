import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

interface Item { category: string; label: string }

// GET /api/visit-log?date=YYYY-MM-DD | ?from=&to= | (none → last 200 rows)
export async function GET(req: NextRequest) {
  const db = getDb()
  const date = req.nextUrl.searchParams.get('date')
  const from = req.nextUrl.searchParams.get('from')
  const to   = req.nextUrl.searchParams.get('to')

  const base = `
    SELECT v.*, c.level AS client_level
    FROM visit_logs v
    LEFT JOIN clients c ON c.id = v.client_id
  `

  const rows = date
    ? db.prepare(`${base} WHERE v.date = ? ORDER BY v.date DESC, v.id DESC`).all(date)
    : from && to
      ? db.prepare(`${base} WHERE v.date BETWEEN ? AND ? ORDER BY v.date DESC, v.id DESC`).all(from, to)
      : db.prepare(`${base} ORDER BY v.date DESC, v.id DESC LIMIT 200`).all()

  for (const v of rows as { id: number; items?: unknown[] }[]) {
    v.items = db.prepare('SELECT * FROM visit_log_items WHERE visit_log_id = ? ORDER BY id').all(v.id)
  }

  return NextResponse.json(rows)
}

// POST /api/visit-log
export async function POST(req: NextRequest) {
  const db = getDb()
  const body = await req.json()
  const { client_id, client_name, date, items, paid, amount, next_visit_date, note } = body

  const validItems = ((items ?? []) as Item[]).filter(i => i.label?.trim())

  if (!date)                return NextResponse.json({ error: '請選擇日期' },     { status: 400 })
  if (!client_name?.trim()) return NextResponse.json({ error: '請輸入客人姓名' }, { status: 400 })
  if (!validItems.length)   return NextResponse.json({ error: '請新增至少一個項目' }, { status: 400 })
  if (paid && (!amount || Number(amount) <= 0))
                             return NextResponse.json({ error: '請輸入金額' },     { status: 400 })

  const serviceSummary = validItems.map(i => i.label.trim()).join('、')

  const insertVisit = db.prepare(`
    INSERT INTO visit_logs (client_id, client_name, date, service, paid, amount, next_visit_date, note)
    VALUES (@client_id, @client_name, @date, @service, @paid, @amount, @next_visit_date, @note)
  `)
  const insertItem = db.prepare(`
    INSERT INTO visit_log_items (visit_log_id, category, label) VALUES (?, ?, ?)
  `)

  const id = db.transaction(() => {
    const res = insertVisit.run({
      client_id: client_id ?? null,
      client_name: client_name.trim(),
      date,
      service: serviceSummary,
      paid: paid ? 1 : 0,
      amount: paid ? Number(amount) : null,
      next_visit_date: next_visit_date || null,
      note: note || null,
    })
    for (const item of validItems) {
      insertItem.run(res.lastInsertRowid, item.category || '服務', item.label.trim())
    }
    return res.lastInsertRowid
  })()

  return NextResponse.json({ id }, { status: 201 })
}
