import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// GET /api/clients/[id]/points — 回傳該客人的所有 points_ledger，由新到舊
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()

  const client = db.prepare('SELECT id FROM clients WHERE id = ?').get(id)
  if (!client) return NextResponse.json({ error: '找不到客人' }, { status: 404 })

  const entries = db.prepare(
    'SELECT * FROM points_ledger WHERE client_id = ? ORDER BY date DESC, id DESC'
  ).all(id)

  return NextResponse.json({ entries })
}

// POST /api/clients/[id]/points  { delta: number, note?: string, date?: string }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const { delta, note, date } = await req.json()

  if (typeof delta !== 'number') return NextResponse.json({ error: '請輸入數量' }, { status: 400 })

  const client = db.prepare('SELECT id, points FROM clients WHERE id = ?').get(id) as
    { id: number; points: number } | undefined
  if (!client) return NextResponse.json({ error: '找不到客人' }, { status: 404 })

  const entryDate = date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })

  const addEntry = db.transaction(() => {
    db.prepare(`
      INSERT INTO points_ledger (client_id, delta, note, date)
      VALUES (@client_id, @delta, @note, @date)
    `).run({ client_id: Number(id), delta, note: note || null, date: entryDate })

    const newPoints = Math.max(0, (db.prepare(
      'SELECT COALESCE(SUM(delta), 0) as total FROM points_ledger WHERE client_id = ?'
    ).get(id) as { total: number }).total)

    db.prepare(`UPDATE clients SET points = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(newPoints, id)

    return newPoints
  })

  const newPoints = addEntry()

  console.log(`[Points] client=${id} delta=${delta} note="${note}" → ${newPoints}`)
  return NextResponse.json({ points: newPoints })
}
