import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// PATCH /api/service-logs/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const body = await req.json()
  const { date, title, content } = body

  if (!content?.trim()) return NextResponse.json({ error: '請輸入內容' }, { status: 400 })

  db.prepare(`
    UPDATE service_logs
    SET date = ?, title = ?, content = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(date, title?.trim() || null, content.trim(), Number(id))

  return NextResponse.json({ success: true })
}

// DELETE /api/service-logs/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  db.prepare('DELETE FROM service_logs WHERE id = ?').run(Number(id))
  return NextResponse.json({ success: true })
}
