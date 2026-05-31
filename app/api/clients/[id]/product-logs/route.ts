import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// GET /api/clients/[id]/product-logs
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const rows = db.prepare(`
    SELECT * FROM product_usage_logs
    WHERE client_id = ?
    ORDER BY date DESC, id DESC
  `).all(Number(id))
  return NextResponse.json(rows)
}

// POST /api/clients/[id]/product-logs
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const body = await req.json()
  const { date, product_name, quantity, unit, batch_note, note } = body

  if (!date) return NextResponse.json({ error: '請填寫日期' }, { status: 400 })
  if (!product_name?.trim()) return NextResponse.json({ error: '請填寫產品名稱' }, { status: 400 })

  const deductQty = quantity != null ? Number(quantity) : 1

  const result = db.prepare(`
    INSERT INTO product_usage_logs (client_id, date, product_name, quantity, unit, batch_note, note)
    VALUES (@client_id, @date, @product_name, @quantity, @unit, @batch_note, @note)
  `).run({
    client_id: Number(id),
    date,
    product_name: product_name.trim(),
    quantity: quantity != null ? Number(quantity) : null,
    unit: unit || null,
    batch_note: batch_note || null,
    note: note || null,
  })

  const logId = Number(result.lastInsertRowid)

  // Auto-deduct from inventory if a matching item exists (name match)
  const invItem = db.prepare(
    `SELECT id FROM inventory_items WHERE name = ? LIMIT 1`
  ).get(product_name.trim()) as { id: number } | undefined

  if (invItem) {
    db.prepare(`
      INSERT INTO inventory_ledger (item_id, delta, reason, ref_id, date, note)
      VALUES (?, ?, '客人使用', ?, ?, ?)
    `).run(invItem.id, -deductQty, logId, date, `客人 #${id} 施作`)
    db.prepare(`
      UPDATE inventory_items
      SET current_qty = (SELECT COALESCE(SUM(delta), 0) FROM inventory_ledger WHERE item_id = ?),
          updated_at = datetime('now')
      WHERE id = ?
    `).run(invItem.id, invItem.id)
  }

  return NextResponse.json({ id: logId, auto_deducted: !!invItem })
}
