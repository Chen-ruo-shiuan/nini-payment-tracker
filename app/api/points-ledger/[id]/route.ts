import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

function recalcPoints(db: ReturnType<typeof import('@/lib/db').getDb>, clientId: number) {
  const result = db.prepare(
    'SELECT COALESCE(SUM(delta), 0) as total FROM points_ledger WHERE client_id = ?'
  ).get(clientId) as { total: number }
  const newPoints = Math.max(0, result.total)
  db.prepare(`UPDATE clients SET points = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(newPoints, clientId)
  return newPoints
}

// PATCH /api/points-ledger/[id]  { delta, note, date }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = getDb()

  const entry = db.prepare('SELECT * FROM points_ledger WHERE id = ?').get(id) as
    { id: number; client_id: number; delta: number; note: string | null; date: string } | undefined
  if (!entry) return NextResponse.json({ error: '找不到記錄' }, { status: 404 })

  const body = await req.json()
  const { delta, note, date } = body

  const update = db.transaction(() => {
    db.prepare(`
      UPDATE points_ledger SET delta = @delta, note = @note, date = @date WHERE id = @id
    `).run({
      id: Number(id),
      delta: typeof delta === 'number' ? delta : entry.delta,
      note: note !== undefined ? (note || null) : entry.note,
      date: date || entry.date,
    })
    return recalcPoints(db, entry.client_id)
  })

  const newPoints = update()
  return NextResponse.json({ success: true, points: newPoints })
}

// DELETE /api/points-ledger/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = getDb()

  const entry = db.prepare('SELECT * FROM points_ledger WHERE id = ?').get(id) as
    { id: number; client_id: number } | undefined
  if (!entry) return NextResponse.json({ error: '找不到記錄' }, { status: 404 })

  const del = db.transaction(() => {
    db.prepare('DELETE FROM points_ledger WHERE id = ?').run(id)
    return recalcPoints(db, entry.client_id)
  })

  const newPoints = del()
  return NextResponse.json({ success: true, points: newPoints })
}
