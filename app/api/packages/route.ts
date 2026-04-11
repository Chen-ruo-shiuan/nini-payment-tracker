import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// GET /api/packages?client_id=&status=active|all
export async function GET(req: NextRequest) {
  const db = getDb()
  const clientId = req.nextUrl.searchParams.get('client_id')
  const status   = req.nextUrl.searchParams.get('status') || 'active'

  let where = status === 'active' ? 'p.used_sessions < p.total_sessions' : '1=1'
  if (clientId) where += ` AND p.client_id = ${Number(clientId)}`

  const packages = db.prepare(`
    SELECT p.*, c.name AS client_name, c.level AS client_level
    FROM packages p
    JOIN clients c ON c.id = p.client_id
    WHERE ${where}
    ORDER BY p.date DESC
  `).all()

  return NextResponse.json(packages)
}

// POST /api/packages
export async function POST(req: NextRequest) {
  const db = getDb()
  const body = await req.json()
  const {
    client_id, service_name, total_sessions,
    unit_price, prepaid_amount, payment_method,
    date, note, include_in_accumulation, include_in_points,
  } = body

  if (!client_id)    return NextResponse.json({ error: '請選擇客人' }, { status: 400 })
  if (!service_name) return NextResponse.json({ error: '請輸入服務名稱' }, { status: 400 })
  if (!total_sessions || total_sessions < 1)
    return NextResponse.json({ error: '請輸入堂數' }, { status: 400 })

  const res = db.prepare(`
    INSERT INTO packages
      (client_id, service_name, total_sessions, used_sessions,
       unit_price, prepaid_amount, payment_method,
       include_in_accumulation, include_in_points, note, date)
    VALUES
      (@client_id, @service_name, @total_sessions, 0,
       @unit_price, @prepaid_amount, @payment_method,
       @include_in_acc, @include_in_pts, @note, @date)
  `).run({
    client_id: Number(client_id),
    service_name,
    total_sessions: Number(total_sessions),
    unit_price:     Number(unit_price)     || 0,
    prepaid_amount: Number(prepaid_amount) || 0,
    payment_method: payment_method || '現金',
    include_in_acc: include_in_accumulation ? 1 : 0,
    include_in_pts: include_in_points       ? 1 : 0,
    note:  note  || null,
    date:  date  || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' }),
  })

  return NextResponse.json({ id: res.lastInsertRowid }, { status: 201 })
}
