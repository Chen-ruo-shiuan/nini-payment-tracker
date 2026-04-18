import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// GET /api/sv-ledger?client_id=
export async function GET(req: NextRequest) {
  const db = getDb()
  const clientId = req.nextUrl.searchParams.get('client_id')
  if (!clientId) return NextResponse.json({ error: '請提供 client_id' }, { status: 400 })

  const entries = db.prepare(`
    SELECT * FROM sv_ledger WHERE client_id = ? ORDER BY date DESC, created_at DESC
  `).all(clientId)

  const balance = (db.prepare(
    'SELECT COALESCE(SUM(amount), 0) as total FROM sv_ledger WHERE client_id = ?'
  ).get(clientId) as { total: number }).total

  return NextResponse.json({ entries, balance })
}

// POST /api/sv-ledger
export async function POST(req: NextRequest) {
  const db = getDb()
  const body = await req.json()
  const { client_id, amount, paid_amount, note, date, payment_method, include_in_accumulation } = body

  if (!client_id) return NextResponse.json({ error: '請提供 client_id' }, { status: 400 })
  if (amount === undefined || amount === null) return NextResponse.json({ error: '請輸入金額' }, { status: 400 })

  const isDeposit = Number(amount) > 0
  const parsedPaid = paid_amount !== undefined && paid_amount !== '' ? Number(paid_amount) : null
  const storedPaid = isDeposit && parsedPaid !== null && parsedPaid !== Number(amount) ? parsedPaid : null

  const result = db.prepare(`
    INSERT INTO sv_ledger (client_id, amount, paid_amount, note, date, payment_method, include_in_accumulation)
    VALUES (@client_id, @amount, @paid_amount, @note, @date, @payment_method, @include_in_accumulation)
  `).run({
    client_id: Number(client_id),
    amount: Number(amount),
    paid_amount: storedPaid,
    note: note || null,
    date: date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' }),
    payment_method: payment_method || null,
    include_in_accumulation: isDeposit && include_in_accumulation ? 1 : 0,
  })

  return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 })
}

// DELETE /api/sv-ledger/[id] — handled separately
