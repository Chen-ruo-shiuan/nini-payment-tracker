import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const rows = db.prepare(
    `SELECT * FROM appointment_logs WHERE client_id = ? ORDER BY date DESC, id DESC`
  ).all(Number(id))
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const { date, note } = await req.json()
  if (!date) return NextResponse.json({ error: '請填寫日期' }, { status: 400 })
  const result = db.prepare(
    `INSERT INTO appointment_logs (client_id, date, note) VALUES (?, ?, ?)`
  ).run(Number(id), date, note || null)
  return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 })
}
