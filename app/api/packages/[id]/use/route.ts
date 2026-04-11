import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// POST /api/packages/[id]/use  { qty?: number, date?: string, note?: string }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const body = await req.json().catch(() => ({}))
  const qty  = Number(body.qty) || 1

  const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(id) as {
    id: number; client_id: number; total_sessions: number; used_sessions: number; service_name: string
  } | undefined
  if (!pkg) return NextResponse.json({ error: '找不到套組' }, { status: 404 })

  const remaining = pkg.total_sessions - pkg.used_sessions
  if (qty > remaining)
    return NextResponse.json({ error: `剩餘 ${remaining} 次，無法核銷 ${qty} 次` }, { status: 400 })

  db.prepare('UPDATE packages SET used_sessions = used_sessions + ? WHERE id = ?').run(qty, id)

  return NextResponse.json({ success: true, used: pkg.used_sessions + qty, remaining: remaining - qty })
}

// DELETE /api/packages/[id]/use  → 取消最後一次核銷
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()

  const pkg = db.prepare('SELECT id, used_sessions FROM packages WHERE id = ?').get(id) as
    { id: number; used_sessions: number } | undefined
  if (!pkg) return NextResponse.json({ error: '找不到套組' }, { status: 404 })
  if (pkg.used_sessions <= 0) return NextResponse.json({ error: '尚無已核銷記錄' }, { status: 400 })

  db.prepare('UPDATE packages SET used_sessions = used_sessions - 1 WHERE id = ?').run(id)
  return NextResponse.json({ success: true, used: pkg.used_sessions - 1 })
}
