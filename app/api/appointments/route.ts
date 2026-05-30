import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// GET /api/appointments?date=YYYY-MM-DD          (single day)
// GET /api/appointments?from=YYYY-MM-DD&to=YYYY-MM-DD  (date range, for week view)
export async function GET(req: NextRequest) {
  const db = getDb()
  const date = req.nextUrl.searchParams.get('date') || ''
  const from = req.nextUrl.searchParams.get('from') || ''
  const to   = req.nextUrl.searchParams.get('to')   || ''

  if (date) {
    const rows = db.prepare(`
      SELECT al.id, al.client_id, al.date, al.time, al.note, al.created_at,
             c.name as client_name, c.level as client_level, c.phone as client_phone
      FROM appointment_logs al
      JOIN clients c ON c.id = al.client_id
      WHERE al.date = ?
      ORDER BY al.time ASC, al.created_at ASC
    `).all(date)
    return NextResponse.json(rows)
  }

  if (from && to) {
    const rows = db.prepare(`
      SELECT al.id, al.client_id, al.date, al.time, al.note, al.created_at,
             c.name as client_name, c.level as client_level, c.phone as client_phone
      FROM appointment_logs al
      JOIN clients c ON c.id = al.client_id
      WHERE al.date >= ? AND al.date <= ?
      ORDER BY al.date ASC, al.time ASC, al.created_at ASC
    `).all(from, to)
    return NextResponse.json(rows)
  }

  return NextResponse.json({ error: '請提供日期或日期區間' }, { status: 400 })
}

// POST /api/appointments  { client_id, date, time?, note? }
export async function POST(req: NextRequest) {
  const db = getDb()
  const { client_id, date, time, note } = await req.json()
  if (!client_id || !date) return NextResponse.json({ error: '請填寫客人和日期' }, { status: 400 })

  const result = db.prepare(
    `INSERT INTO appointment_logs (client_id, date, time, note) VALUES (?, ?, ?, ?)`
  ).run(Number(client_id), date, time || null, note || null)

  return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 })
}
