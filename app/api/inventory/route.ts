import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// GET /api/inventory — list all items with current stock
export async function GET() {
  const db = getDb()
  const items = db.prepare(`
    SELECT i.*,
      (SELECT COALESCE(SUM(delta), 0) FROM inventory_ledger WHERE item_id = i.id) as computed_qty
    FROM inventory_items i
    ORDER BY i.category ASC, i.name ASC
  `).all()
  return NextResponse.json(items)
}

// POST /api/inventory — add a new item
export async function POST(req: NextRequest) {
  const db = getDb()
  const body = await req.json()
  const { name, category, unit, spec, initial_qty, low_stock_threshold, note } = body

  if (!name?.trim()) return NextResponse.json({ error: '請填寫品項名稱' }, { status: 400 })

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
  const initQty = Number(initial_qty) || 0

  const result = db.prepare(`
    INSERT INTO inventory_items (name, category, unit, spec, current_qty, low_stock_threshold, note)
    VALUES (@name, @category, @unit, @spec, @current_qty, @low_stock_threshold, @note)
  `).run({
    name: name.trim(),
    category: category || '其他',
    unit: unit || '瓶',
    spec: spec?.trim() || null,
    current_qty: initQty,
    low_stock_threshold: Number(low_stock_threshold) || 2,
    note: note || null,
  })

  const itemId = Number(result.lastInsertRowid)

  // Record initial stock
  if (initQty !== 0) {
    db.prepare(`
      INSERT INTO inventory_ledger (item_id, delta, reason, date, note)
      VALUES (?, ?, '期初庫存', ?, '建立品項時設定')
    `).run(itemId, initQty, today)
  }

  return NextResponse.json({ id: itemId })
}
