import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// GET /api/customers
export async function GET() {
  const db = getDb()
  const customers = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM installments WHERE customer_id = c.id AND paid_at IS NOT NULL) as paid_count,
      (SELECT due_date FROM installments WHERE customer_id = c.id AND paid_at IS NULL ORDER BY due_date ASC LIMIT 1) as next_due_date
    FROM customers c
    ORDER BY c.created_at DESC
  `).all()
  return NextResponse.json(customers)
}

// POST /api/customers
export async function POST(req: NextRequest) {
  const db = getDb()
  const body = await req.json()
  const {
    name,
    total_amount,
    installment_amount,
    payment_method,
    total_periods,
    membership_tier,
    notes,
    due_dates, // array of ISO date strings, one per period
  } = body

  if (!name || !total_amount || !installment_amount || !due_dates?.length) {
    return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 })
  }

  const insertCustomer = db.prepare(`
    INSERT INTO customers (name, total_amount, installment_amount, payment_method, total_periods, membership_tier, notes)
    VALUES (@name, @total_amount, @installment_amount, @payment_method, @total_periods, @membership_tier, @notes)
  `)

  const insertInstallment = db.prepare(`
    INSERT INTO installments (customer_id, period_number, due_date, amount)
    VALUES (@customer_id, @period_number, @due_date, @amount)
  `)

  const transaction = db.transaction(() => {
    const result = insertCustomer.run({
      name,
      total_amount,
      installment_amount,
      payment_method: payment_method || 'cash',
      total_periods: total_periods || due_dates.length,
      membership_tier: membership_tier || '甜癒米',
      notes: notes || null,
    })

    const customerId = result.lastInsertRowid
    for (let i = 0; i < due_dates.length; i++) {
      insertInstallment.run({
        customer_id: customerId,
        period_number: i + 1,
        due_date: due_dates[i],
        amount: installment_amount,
      })
    }
    return customerId
  })

  const customerId = transaction()
  return NextResponse.json({ id: customerId }, { status: 201 })
}
