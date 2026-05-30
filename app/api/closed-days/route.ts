import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// GET /api/closed-days?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const db = getDb()
  const from = req.nextUrl.searchParams.get('from') || ''
  const to   = req.nextUrl.searchParams.get('to')   || ''
  if (!from || !to) return NextResponse.json({ error: '請提供日期區間' }, { status: 400 })
  const rows = db.prepare(
    `SELECT date, type, note FROM closed_days WHERE date >= ? AND date <= ? ORDER BY date ASC`
  ).all(from, to)
  return NextResponse.json(rows)
}

// POST /api/closed-days  { date, type, note? }  — upsert
export async function POST(req: NextRequest) {
  const db = getDb()
  const { date, type, note } = await req.json()
  if (!date || !type) return NextResponse.json({ error: '請填寫日期與類型' }, { status: 400 })
  db.prepare(`
    INSERT INTO closed_days (date, type, note) VALUES (?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET type = excluded.type, note = excluded.note
  `).run(date, type, note || null)
  return NextResponse.json({ ok: true })
}

// DELETE /api/closed-days?date=YYYY-MM-DD
export async function DELETE(req: NextRequest) {
  const db = getDb()
  const date = req.nextUrl.searchParams.get('date') || ''
  if (!date) return NextResponse.json({ error: '請提供日期' }, { status: 400 })
  db.prepare(`DELETE FROM closed_days WHERE date = ?`).run(date)
  return NextResponse.json({ ok: true })
}
