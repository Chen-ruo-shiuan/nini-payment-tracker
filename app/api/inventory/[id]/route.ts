import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// GET /api/inventory/[id] — item detail with ledger history
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()

  const item = db.prepare(`
    SELECT i.*,
      (SELECT COALESCE(SUM(delta), 0) FROM inventory_ledger WHERE item_id = i.id) as computed_qty
    FROM inventory_items i WHERE i.id = ?
  `).get(Number(id))
  if (!item) return NextResponse.json({ error: '找不到品項' }, { status: 404 })

  const ledger = db.prepare(`
    SELECT * FROM inventory_ledger WHERE item_id = ? ORDER BY date DESC, id DESC LIMIT 100
  `).all(Number(id))

  return NextResponse.json({ ...item as object, ledger })
}

// PATCH /api/inventory/[id] — update item metadata
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const body = await req.json()
  const { name, category, unit, spec, cost_price, low_stock_threshold, note } = body

  if (!name?.trim()) return NextResponse.json({ error: '請填寫品項名稱' }, { status: 400 })

  const existing = db.prepare('SELECT id FROM inventory_items WHERE id = ?').get(Number(id))
  if (!existing) return NextResponse.json({ error: '找不到品項' }, { status: 404 })

  db.prepare(`
    UPDATE inventory_items SET
      name = @name, category = @category, unit = @unit, spec = @spec,
      cost_price = @cost_price,
      low_stock_threshold = @low_stock_threshold, note = @note,
      updated_at = datetime('now')
    WHERE id = @id
  `).run({
    id: Number(id), name: name.trim(), category: category || '其他',
    unit: unit || '瓶', spec: spec?.trim() || null,
    cost_price: Number(cost_price) || 0,
    low_stock_threshold: low_stock_threshold != null && low_stock_threshold !== '' ? Number(low_stock_threshold) : 2,
    note: note || null,
  })

  return NextResponse.json({ success: true })
}

// DELETE /api/inventory/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  db.prepare('DELETE FROM inventory_items WHERE id = ?').run(Number(id))
  return NextResponse.json({ success: true })
}
