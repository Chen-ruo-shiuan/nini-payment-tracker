import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// GET /api/contracts?client_id=&status=active|completed|all
export async function GET(req: NextRequest) {
  const db = getDb()
  const clientId = req.nextUrl.searchParams.get('client_id')
  const status = req.nextUrl.searchParams.get('status') || 'all'

  let whereClause = '1=1'
  const bindParams: Record<string, unknown> = {}

  if (clientId) {
    whereClause += ' AND ic.client_id = @client_id'
    bindParams.client_id = Number(clientId)
  }
  if (status === 'active') {
    whereClause += ' AND ic.is_completed = 0'
  } else if (status === 'completed') {
    whereClause += ' AND ic.is_completed = 1'
  }

  const contracts = db.prepare(`
    SELECT ic.*,
      c.name as client_name,
      c.level as client_level,
      (SELECT COUNT(*) FROM installments WHERE contract_id = ic.id AND paid_at IS NULL) as unpaid_count,
      (SELECT MIN(due_date) FROM installments WHERE contract_id = ic.id AND paid_at IS NULL) as next_due_date,
      (SELECT SUM(amount) FROM installments WHERE contract_id = ic.id AND paid_at IS NULL) as remaining_amount
    FROM installment_contracts ic
    JOIN clients c ON c.id = ic.client_id
    WHERE ${whereClause}
    ORDER BY ic.created_at DESC
  `).all(bindParams)

  return NextResponse.json(contracts)
}

// POST /api/contracts
export async function POST(req: NextRequest) {
  const db = getDb()
  const body = await req.json()
  const { client_id, payment_method, note, periods } = body
  // periods: Array<{ due_date: string; amount: number }>

  if (!client_id) return NextResponse.json({ error: '請選擇客人' }, { status: 400 })
  if (!periods || !Array.isArray(periods) || periods.length === 0)
    return NextResponse.json({ error: '請設定分期內容' }, { status: 400 })

  const clientExists = db.prepare('SELECT id FROM clients WHERE id = ?').get(client_id)
  if (!clientExists) return NextResponse.json({ error: '找不到客人' }, { status: 404 })

  const total_amount = (periods as { amount: number }[]).reduce((sum, p) => sum + (p.amount || 0), 0)
  const total_periods = periods.length

  const insertContract = db.prepare(`
    INSERT INTO installment_contracts (client_id, total_amount, payment_method, total_periods, note)
    VALUES (@client_id, @total_amount, @payment_method, @total_periods, @note)
  `)

  const insertInstallment = db.prepare(`
    INSERT INTO installments (contract_id, client_id, period_number, due_date, amount)
    VALUES (@contract_id, @client_id, @period_number, @due_date, @amount)
  `)

  const run = db.transaction(() => {
    const result = insertContract.run({
      client_id: Number(client_id),
      total_amount,
      payment_method: payment_method || '現金',
      total_periods,
      note: note || null,
    })
    const contractId = result.lastInsertRowid

    for (let i = 0; i < (periods as { due_date: string; amount: number }[]).length; i++) {
      const p = (periods as { due_date: string; amount: number }[])[i]
      insertInstallment.run({
        contract_id: contractId,
        client_id: Number(client_id),
        period_number: i + 1,
        due_date: p.due_date,
        amount: p.amount,
      })
    }
    return contractId
  })

  const contractId = run()
  return NextResponse.json({ id: contractId }, { status: 201 })
}
