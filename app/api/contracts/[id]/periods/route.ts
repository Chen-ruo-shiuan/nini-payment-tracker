import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// POST /api/contracts/[id]/periods
// body: { amount: number }
// 將新金額平均分攤到現有未收的期數，合約總金額同步增加
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()

  const contract = db.prepare('SELECT * FROM installment_contracts WHERE id = ?').get(id) as
    { id: number; client_id: number; total_amount: number; total_periods: number } | undefined
  if (!contract) return NextResponse.json({ error: '找不到合約' }, { status: 404 })

  const body = await req.json()
  const addAmount: number = Number(body.amount)
  if (!addAmount || addAmount <= 0)
    return NextResponse.json({ error: '請提供要新增的金額' }, { status: 400 })

  // 取得所有未收期數（依 period_number 排序）
  const unpaidRows = db.prepare(`
    SELECT id, amount FROM installments
    WHERE contract_id = ? AND paid_at IS NULL
    ORDER BY period_number ASC
  `).all(id) as { id: number; amount: number }[]

  db.transaction(() => {
    if (unpaidRows.length > 0) {
      // 平均分攤：base 每期加，最後一期補差額
      const base = Math.floor(addAmount / unpaidRows.length)
      const rem  = addAmount - base * (unpaidRows.length - 1)
      unpaidRows.forEach((row, i) => {
        const add = i === unpaidRows.length - 1 ? rem : base
        db.prepare('UPDATE installments SET amount = amount + ? WHERE id = ?').run(add, row.id)
      })
    } else {
      // 全數已收：新增一期到合約末尾
      const maxRow = db.prepare(
        'SELECT COALESCE(MAX(period_number), 0) AS max_no FROM installments WHERE contract_id = ?'
      ).get(id) as { max_no: number }
      db.prepare(`
        INSERT INTO installments (contract_id, client_id, period_number, due_date, amount)
        VALUES (?, ?, ?, date('now'), ?)
      `).run(Number(id), contract.client_id, maxRow.max_no + 1, addAmount)
      // 期數 +1
      db.prepare(`UPDATE installment_contracts SET total_periods = total_periods + 1 WHERE id = ?`).run(Number(id))
    }
    // 總金額增加
    db.prepare(`
      UPDATE installment_contracts
      SET total_amount = total_amount + ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(addAmount, Number(id))
  })()

  return NextResponse.json({ success: true, distributed: unpaidRows.length, addAmount })
}
