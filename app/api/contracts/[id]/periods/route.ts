import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// POST /api/contracts/[id]/periods — 在現有合約附加新的分期期數
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()

  const contract = db.prepare('SELECT * FROM installment_contracts WHERE id = ?').get(id) as
    { id: number; client_id: number; total_amount: number; total_periods: number } | undefined
  if (!contract) return NextResponse.json({ error: '找不到合約' }, { status: 404 })

  const body = await req.json()
  const periods: { due_date: string; amount: number }[] = body.periods
  if (!Array.isArray(periods) || periods.length === 0)
    return NextResponse.json({ error: '請提供分期期數' }, { status: 400 })

  // 目前最大 period_number
  const maxRow = db.prepare(
    'SELECT COALESCE(MAX(period_number), 0) AS max_no FROM installments WHERE contract_id = ?'
  ).get(id) as { max_no: number }
  const startNo = maxRow.max_no + 1

  const addTotal = periods.reduce((s, p) => s + (p.amount || 0), 0)

  const insertInstallment = db.prepare(`
    INSERT INTO installments (contract_id, client_id, period_number, due_date, amount)
    VALUES (@contract_id, @client_id, @period_number, @due_date, @amount)
  `)

  db.transaction(() => {
    // 插入新的期數
    periods.forEach((p, i) => {
      insertInstallment.run({
        contract_id: Number(id),
        client_id: contract.client_id,
        period_number: startNo + i,
        due_date: p.due_date,
        amount: p.amount,
      })
    })
    // 更新合約的總金額與總期數
    db.prepare(`
      UPDATE installment_contracts
      SET total_amount   = total_amount + @add_total,
          total_periods  = total_periods + @add_periods,
          updated_at     = datetime('now')
      WHERE id = @id
    `).run({ add_total: addTotal, add_periods: periods.length, id: Number(id) })
  })()

  return NextResponse.json({ success: true, added: periods.length })
}
