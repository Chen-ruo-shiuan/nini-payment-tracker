import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

function recalcQty(db: ReturnType<typeof getDb>, itemId: number) {
  const row = db.prepare(
    `SELECT COALESCE(SUM(delta), 0) as total FROM inventory_ledger WHERE item_id = ?`
  ).get(itemId) as { total: number }
  db.prepare(`UPDATE inventory_items SET current_qty = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(row.total, itemId)
  return row.total
}

// PATCH /api/inventory/ledger/[id] — 編輯一筆帳
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const entryId = parseInt(id)
  if (isNaN(entryId)) return NextResponse.json({ error: '無效 ID' }, { status: 400 })

  const db = getDb()
  const entry = db.prepare('SELECT * FROM inventory_ledger WHERE id = ?').get(entryId) as
    { id: number; item_id: number; delta: number; reason: string; date: string; note: string | null } | undefined
  if (!entry) return NextResponse.json({ error: '找不到記錄' }, { status: 404 })

  const body = await req.json()
  const delta  = body.delta  != null ? Number(body.delta)  : entry.delta
  const reason = body.reason ?? entry.reason
  const date   = body.date   ?? entry.date
  const note   = body.note   ?? entry.note

  if (isNaN(delta) || delta === 0) {
    return NextResponse.json({ error: '數量不能為 0' }, { status: 400 })
  }

  db.prepare(`
    UPDATE inventory_ledger SET delta = ?, reason = ?, date = ?, note = ? WHERE id = ?
  `).run(delta, reason, date, note, entryId)

  const newQty = recalcQty(db, entry.item_id)
  return NextResponse.json({ ok: true, current_qty: newQty })
}

// DELETE /api/inventory/ledger/[id] — 刪除一筆帳
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const entryId = parseInt(id)
  if (isNaN(entryId)) return NextResponse.json({ error: '無效 ID' }, { status: 400 })

  const db = getDb()
  const entry = db.prepare('SELECT item_id FROM inventory_ledger WHERE id = ?').get(entryId) as
    { item_id: number } | undefined
  if (!entry) return NextResponse.json({ error: '找不到記錄' }, { status: 404 })

  db.prepare('DELETE FROM inventory_ledger WHERE id = ?').run(entryId)
  const newQty = recalcQty(db, entry.item_id)
  return NextResponse.json({ ok: true, current_qty: newQty })
}
