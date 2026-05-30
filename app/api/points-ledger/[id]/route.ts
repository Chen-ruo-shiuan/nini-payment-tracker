import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// 以加減方式更新點數（不重算 ledger 加總，相容舊有直接修改的餘額）
function applyPointsDelta(db: ReturnType<typeof import('@/lib/db').getDb>, clientId: number, delta: number) {
  const cur = (db.prepare('SELECT points FROM clients WHERE id = ?').get(clientId) as { points: number }).points
  const newPoints = Math.max(0, cur + delta)
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

  const newDelta = typeof delta === 'number' ? delta : entry.delta

  const update = db.transaction(() => {
    db.prepare(`
      UPDATE points_ledger SET delta = @delta, note = @note, date = @date WHERE id = @id
    `).run({
      id: Number(id),
      delta: newDelta,
      note: note !== undefined ? (note || null) : entry.note,
      date: date || entry.date,
    })
    // 先還原舊 delta，再套用新 delta
    const diff = newDelta - entry.delta
    return applyPointsDelta(db, entry.client_id, diff)
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
    { id: number; client_id: number; delta: number } | undefined
  if (!entry) return NextResponse.json({ error: '找不到記錄' }, { status: 404 })

  const del = db.transaction(() => {
    db.prepare('DELETE FROM points_ledger WHERE id = ?').run(id)
    // 還原這筆 ledger 的 delta
    return applyPointsDelta(db, entry.client_id, -entry.delta)
  })

  const newPoints = del()
  return NextResponse.json({ success: true, points: newPoints })
}
