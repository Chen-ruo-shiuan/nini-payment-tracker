import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

function recalc(db: ReturnType<typeof import('@/lib/db').getDb>, clientId: number) {
  const { total } = db.prepare(
    `SELECT COALESCE(SUM(delta), 0) AS total FROM shopping_credit_ledger WHERE client_id = ?`
  ).get(clientId) as { total: number }
  db.prepare(`UPDATE clients SET shopping_credit = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(total, clientId)
}

// PATCH /api/shopping-credit-ledger/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const { delta, note, date } = await req.json()

  const entry = db.prepare(`SELECT * FROM shopping_credit_ledger WHERE id = ?`).get(id) as { client_id: number } | undefined
  if (!entry) return NextResponse.json({ error: '找不到記錄' }, { status: 404 })

  db.prepare(`UPDATE shopping_credit_ledger SET delta = ?, note = ?, date = ? WHERE id = ?`)
    .run(Number(delta), note || null, date, id)

  recalc(db, entry.client_id)
  return NextResponse.json({ ok: true })
}

// DELETE /api/shopping-credit-ledger/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()

  const entry = db.prepare(`SELECT * FROM shopping_credit_ledger WHERE id = ?`).get(id) as { client_id: number } | undefined
  if (!entry) return NextResponse.json({ error: '找不到記錄' }, { status: 404 })

  db.prepare(`DELETE FROM shopping_credit_ledger WHERE id = ?`).run(id)
  recalc(db, entry.client_id)
  return NextResponse.json({ ok: true })
}
