import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// GET /api/follow-ups?status=pending|all&days=3
// Returns tasks due within N days (pending), or all
export async function GET(req: NextRequest) {
  const db = getDb()
  const status = req.nextUrl.searchParams.get('status') || 'pending'
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })

  let rows
  if (status === 'pending') {
    rows = db.prepare(`
      SELECT f.*, c.name as client_name, c.phone as client_phone, c.level as client_level
      FROM follow_up_tasks f
      JOIN clients c ON c.id = f.client_id
      WHERE f.completed_at IS NULL
      ORDER BY f.due_date ASC, f.id ASC
    `).all()
  } else {
    rows = db.prepare(`
      SELECT f.*, c.name as client_name, c.phone as client_phone, c.level as client_level
      FROM follow_up_tasks f
      JOIN clients c ON c.id = f.client_id
      ORDER BY f.due_date DESC, f.id DESC
      LIMIT 100
    `).all()
  }

  // Tag overdue
  const result = (rows as Record<string, unknown>[]).map(r => ({
    ...r,
    is_overdue: !r.completed_at && (r.due_date as string) < today,
    is_due_today: !r.completed_at && (r.due_date as string) === today,
  }))

  return NextResponse.json(result)
}

// POST /api/follow-ups — create a new follow-up task
export async function POST(req: NextRequest) {
  const db = getDb()
  const body = await req.json()
  const { client_id, checkout_id, due_date, note } = body

  if (!client_id) return NextResponse.json({ error: '請指定客人' }, { status: 400 })
  if (!due_date)  return NextResponse.json({ error: '請填寫追蹤日期' }, { status: 400 })

  const result = db.prepare(`
    INSERT INTO follow_up_tasks (client_id, checkout_id, due_date, note)
    VALUES (@client_id, @checkout_id, @due_date, @note)
  `).run({
    client_id: Number(client_id),
    checkout_id: checkout_id ? Number(checkout_id) : null,
    due_date,
    note: note || null,
  })

  return NextResponse.json({ id: result.lastInsertRowid })
}
