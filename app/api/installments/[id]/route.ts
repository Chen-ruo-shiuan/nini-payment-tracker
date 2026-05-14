import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// PATCH /api/installments/[id] — 編輯期數（金額、應收日）
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()

  const row = db.prepare('SELECT * FROM installments WHERE id = ?').get(id) as {
    id: number; contract_id: number; amount: number; paid_at: string | null
  } | undefined
  if (!row) return NextResponse.json({ error: '找不到此期數' }, { status: 404 })
  if (row.paid_at) return NextResponse.json({ error: '已收款的期數不可編輯' }, { status: 400 })

  const body = await req.json()
  const newAmount  = body.amount  != null ? Number(body.amount)  : row.amount
  const newDueDate = body.due_date ?? null

  const diff = newAmount - row.amount

  db.transaction(() => {
    // 更新期數本身
    if (body.due_date !== undefined) {
      db.prepare('UPDATE installments SET amount = ?, due_date = ? WHERE id = ?')
        .run(newAmount, newDueDate, id)
    } else {
      db.prepare('UPDATE installments SET amount = ? WHERE id = ?').run(newAmount, id)
    }
    // 同步更新合約總金額
    if (diff !== 0) {
      db.prepare(`
        UPDATE installment_contracts SET total_amount = total_amount + ?, updated_at = datetime('now') WHERE id = ?
      `).run(diff, row.contract_id)
    }
  })()

  return NextResponse.json({ success: true })
}

// DELETE /api/installments/[id] — 刪除一期（僅限未收款）
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()

  const row = db.prepare('SELECT * FROM installments WHERE id = ?').get(id) as {
    id: number; contract_id: number; amount: number; paid_at: string | null
  } | undefined
  if (!row) return NextResponse.json({ error: '找不到此期數' }, { status: 404 })
  if (row.paid_at) return NextResponse.json({ error: '已收款的期數不可刪除' }, { status: 400 })

  db.transaction(() => {
    db.prepare('DELETE FROM installments WHERE id = ?').run(id)
    // 合約總金額、期數同步減少
    db.prepare(`
      UPDATE installment_contracts
      SET total_amount  = total_amount - ?,
          total_periods = total_periods - 1,
          updated_at    = datetime('now')
      WHERE id = ?
    `).run(row.amount, row.contract_id)
  })()

  return NextResponse.json({ success: true })
}
