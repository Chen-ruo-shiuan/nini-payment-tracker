import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// POST /api/clients/[id]/points  { delta: number, note?: string }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const { delta, note } = await req.json()

  if (typeof delta !== 'number') return NextResponse.json({ error: '請輸入數量' }, { status: 400 })

  const client = db.prepare('SELECT id, points FROM clients WHERE id = ?').get(id) as
    { id: number; points: number } | undefined
  if (!client) return NextResponse.json({ error: '找不到客人' }, { status: 404 })

  const newPoints = Math.max(0, client.points + delta)
  db.prepare(`UPDATE clients SET points = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(newPoints, id)

  console.log(`[Points] client=${id} delta=${delta} note="${note}" → ${newPoints}`)
  return NextResponse.json({ points: newPoints })
}
