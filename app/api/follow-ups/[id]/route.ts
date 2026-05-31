import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// PATCH /api/follow-ups/[id] — update (complete or update details)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const body = await req.json()
  const { contacted, client_feedback, skin_status, follow_up_action, note, due_date, complete } = body

  const existing = db.prepare('SELECT id FROM follow_up_tasks WHERE id = ?').get(Number(id))
  if (!existing) return NextResponse.json({ error: '找不到追蹤任務' }, { status: 404 })

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })

  db.prepare(`
    UPDATE follow_up_tasks SET
      contacted = @contacted,
      client_feedback = @client_feedback,
      skin_status = @skin_status,
      follow_up_action = @follow_up_action,
      note = @note,
      due_date = @due_date,
      completed_at = @completed_at
    WHERE id = @id
  `).run({
    id: Number(id),
    contacted: contacted ? 1 : 0,
    client_feedback: client_feedback || null,
    skin_status: skin_status || null,
    follow_up_action: follow_up_action || null,
    note: note || null,
    due_date: due_date || today,
    completed_at: complete ? today : null,
  })

  return NextResponse.json({ success: true })
}

// DELETE /api/follow-ups/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  db.prepare('DELETE FROM follow_up_tasks WHERE id = ?').run(Number(id))
  return NextResponse.json({ success: true })
}
