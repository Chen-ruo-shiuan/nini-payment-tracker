import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

interface Item { category: string; label: string }
interface Payment { method: string; amount: number | string }

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
    ? db.prepare(`${base} WHERE v.date = ? ORDER BY v.id ASC`).all(date)
    : from && to
      ? db.prepare(`${base} WHERE v.date BETWEEN ? AND ? ORDER BY v.date ASC, v.id ASC`).all(from, to)
      : db.prepare(`${base} ORDER BY v.date DESC, v.id DESC LIMIT 200`).all()

  for (const v of rows as { id: number; items?: unknown[]; payments?: unknown[] }[]) {
    v.items = db.prepare('SELECT * FROM visit_log_items WHERE visit_log_id = ? ORDER BY id').all(v.id)
    v.payments = db.prepare('SELECT * FROM visit_log_payments WHERE visit_log_id = ? ORDER BY id').all(v.id)
  }

  return NextResponse.json(rows)
}

// POST /api/visit-log
export async function POST(req: NextRequest) {
  const db = getDb()
  const body = await req.json()
  const { client_id, client_name, date, items, payment_status, payments, estimated_amount, next_visit_date, note } = body

  const validItems = ((items ?? []) as Item[]).filter(i => i.label?.trim())
  const status: string = payment_status || '未收費'
  const isPaid = status !== '未收費'
  const validPayments = ((payments ?? []) as Payment[]).filter(p => p.method && p.amount !== '' && p.amount != null && Number(p.amount) >= 0)

  if (!date)                return NextResponse.json({ error: '請選擇日期' },     { status: 400 })
  if (!client_name?.trim()) return NextResponse.json({ error: '請輸入客人姓名' }, { status: 400 })
  if (!validItems.length)   return NextResponse.json({ error: '請新增至少一個項目' }, { status: 400 })
  if (isPaid && !validPayments.length)
                             return NextResponse.json({ error: '請新增付款方式與金額' }, { status: 400 })

  const serviceSummary = validItems.map(i => i.label.trim()).join('、')
  const paymentTotal    = validPayments.reduce((s, p) => s + Number(p.amount), 0)
  const paymentSummary  = validPayments.map(p => p.method).join('、')

  const insertVisit = db.prepare(`
    INSERT INTO visit_logs (client_id, client_name, date, service, paid, payment_status, payment_method, amount, next_visit_date, note)
    VALUES (@client_id, @client_name, @date, @service, @paid, @payment_status, @payment_method, @amount, @next_visit_date, @note)
  `)
  const insertItem = db.prepare(`INSERT INTO visit_log_items (visit_log_id, category, label) VALUES (?, ?, ?)`)
  const insertPayment = db.prepare(`INSERT INTO visit_log_payments (visit_log_id, method, amount) VALUES (?, ?, ?)`)

  const id = db.transaction(() => {
    const res = insertVisit.run({
      client_id: client_id ?? null,
      client_name: client_name.trim(),
      date,
      service: serviceSummary,
      paid: isPaid ? 1 : 0,
      payment_status: status,
      payment_method: isPaid ? paymentSummary : null,
      amount: isPaid ? paymentTotal : (estimated_amount != null && estimated_amount !== '' ? Number(estimated_amount) : null),
      next_visit_date: next_visit_date || null,
      note: note || null,
    })
    for (const item of validItems) {
      insertItem.run(res.lastInsertRowid, item.category || '服務', item.label.trim())
    }
    for (const pay of validPayments) {
      insertPayment.run(res.lastInsertRowid, pay.method, Number(pay.amount))
    }
    return res.lastInsertRowid
  })()

  return NextResponse.json({ id }, { status: 201 })
}
