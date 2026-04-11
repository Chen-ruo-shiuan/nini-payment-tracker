import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// DELETE /api/expenses/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const row = db.prepare('SELECT id FROM expenses WHERE id = ?').get(id)
  if (!row) return NextResponse.json({ error: '找不到記錄' }, { status: 404 })
  db.prepare('DELETE FROM expenses WHERE id = ?').run(id)
  return NextResponse.json({ success: true })
}
