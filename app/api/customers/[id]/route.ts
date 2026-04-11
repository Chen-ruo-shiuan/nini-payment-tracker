import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// GET /api/customers/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id)
  if (!customer) return NextResponse.json({ error: '找不到客人' }, { status: 404 })

  const installments = db.prepare(
    'SELECT * FROM installments WHERE customer_id = ? ORDER BY period_number ASC'
  ).all(id)

  return NextResponse.json({ ...customer as object, installments })
}

// PUT /api/customers/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const body = await req.json()
  const { name, total_amount, installment_amount, payment_method, membership_tier, notes } = body

  db.prepare(`
    UPDATE customers
    SET name = @name, total_amount = @total_amount, installment_amount = @installment_amount,
        payment_method = @payment_method, membership_tier = @membership_tier,
        notes = @notes, updated_at = datetime('now')
    WHERE id = @id
  `).run({ id, name, total_amount, installment_amount, payment_method, membership_tier, notes: notes || null })

  return NextResponse.json({ success: true })
}

// DELETE /api/customers/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  db.prepare('DELETE FROM customers WHERE id = ?').run(id)
  return NextResponse.json({ success: true })
}
