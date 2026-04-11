import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { YODOMO_MILESTONES } from '@/types'

export const runtime = 'nodejs'

// POST /api/clients/[id]/yodomo  { delta: number, note?: string }  → 手動調整點數
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const { delta, note } = await req.json()

  if (typeof delta !== 'number') return NextResponse.json({ error: '請輸入數量' }, { status: 400 })

  const client = db.prepare(
    'SELECT id, yodomo_card_points, yodomo_total_cards FROM clients WHERE id = ?'
  ).get(id) as { id: number; yodomo_card_points: number; yodomo_total_cards: number } | undefined
  if (!client) return NextResponse.json({ error: '找不到客人' }, { status: 404 })

  const newPoints = Math.max(0, client.yodomo_card_points + delta)
  db.prepare(`UPDATE clients SET yodomo_card_points = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(newPoints, id)

  console.log(`[Yodomo] client=${id} delta=${delta} note="${note}" → ${newPoints}`)
  return NextResponse.json({ yodomo_card_points: newPoints })
}

// PATCH /api/clients/[id]/yodomo  { redeem: number }  → 兌換里程碑
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const { redeem } = await req.json()

  if (!YODOMO_MILESTONES.includes(redeem))
    return NextResponse.json({ error: '無效的兌換里程碑' }, { status: 400 })

  const client = db.prepare(
    'SELECT id, yodomo_card_points, yodomo_redeemed FROM clients WHERE id = ?'
  ).get(id) as { id: number; yodomo_card_points: number; yodomo_redeemed: string } | undefined
  if (!client) return NextResponse.json({ error: '找不到客人' }, { status: 404 })

  if (client.yodomo_card_points < redeem)
    return NextResponse.json({ error: '點數不足，無法兌換' }, { status: 400 })

  const redeemed: number[] = JSON.parse(client.yodomo_redeemed || '[]')
  if (redeemed.includes(redeem))
    return NextResponse.json({ error: '已兌換過此里程碑' }, { status: 400 })

  redeemed.push(redeem)
  db.prepare(`UPDATE clients SET yodomo_redeemed = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(JSON.stringify(redeemed), id)

  return NextResponse.json({ yodomo_redeemed: redeemed })
}
