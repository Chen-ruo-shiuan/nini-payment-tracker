import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// GET /api/clients/[id]/service-logs
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const logs = db.prepare(`
    SELECT * FROM service_logs WHERE client_id = ?
    ORDER BY date DESC, id DESC
  `).all(id)
  return NextResponse.json(logs)
}

// POST /api/clients/[id]/service-logs
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const body = await req.json()
  const { date, title, content } = body

  if (!content?.trim()) return NextResponse.json({ error: '請輸入內容' }, { status: 400 })
  if (!date)           return NextResponse.json({ error: '請選擇日期' }, { status: 400 })

  const res = db.prepare(`
    INSERT INTO service_logs (client_id, date, title, content)
    VALUES (?, ?, ?, ?)
  `).run(Number(id), date, title?.trim() || null, content.trim())

  return NextResponse.json({ id: res.lastInsertRowid }, { status: 201 })
}
