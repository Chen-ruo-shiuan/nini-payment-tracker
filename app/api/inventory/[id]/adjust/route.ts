import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// POST /api/inventory/[id]/adjust — add/subtract stock
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const body = await req.json()
  const { delta, reason, date, note } = body

  if (delta === undefined || delta === null || isNaN(Number(delta))) {
    return NextResponse.json({ error: '請填寫數量' }, { status: 400 })
  }

  const existing = db.prepare('SELECT id, unit FROM inventory_items WHERE id = ?').get(Number(id)) as { id: number; unit: string } | undefined
  if (!existing) return NextResponse.json({ error: '找不到品項' }, { status: 404 })

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })

  db.prepare(`
    INSERT INTO inventory_ledger (item_id, delta, reason, date, note)
    VALUES (@item_id, @delta, @reason, @date, @note)
  `).run({
    item_id: Number(id),
    delta: Number(delta),
    reason: reason || '手動調整',
    date: date || today,
    note: note || null,
  })

  // Update current_qty on the item (denormalized for quick reads)
  db.prepare(`
    UPDATE inventory_items
    SET current_qty = (SELECT COALESCE(SUM(delta), 0) FROM inventory_ledger WHERE item_id = @id),
        updated_at = datetime('now')
    WHERE id = @id
  `).run({ id: Number(id) })

  const updated = db.prepare('SELECT current_qty FROM inventory_items WHERE id = ?').get(Number(id)) as { current_qty: number }

  return NextResponse.json({ success: true, current_qty: updated.current_qty })
}
