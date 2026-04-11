import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// POST /api/installments/[id]/pay
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()

  const installment = db.prepare('SELECT * FROM installments WHERE id = ?').get(id) as {
    id: number; customer_id: number; paid_at: string | null
  } | undefined

  if (!installment) return NextResponse.json({ error: '找不到分期' }, { status: 404 })
  if (installment.paid_at) return NextResponse.json({ error: '已繳納' }, { status: 400 })

  db.prepare(`UPDATE installments SET paid_at = datetime('now') WHERE id = ?`).run(id)

  // Check if all installments for this customer are paid
  const unpaid = db.prepare(
    'SELECT COUNT(*) as count FROM installments WHERE customer_id = ? AND paid_at IS NULL'
  ).get(installment.customer_id) as { count: number }

  let completed = false
  let membershipTier = null

  if (unpaid.count === 0) {
    db.prepare(`UPDATE customers SET is_completed = 1, updated_at = datetime('now') WHERE id = ?`)
      .run(installment.customer_id)
    const customer = db.prepare('SELECT membership_tier FROM customers WHERE id = ?')
      .get(installment.customer_id) as { membership_tier: string }
    completed = true
    membershipTier = customer.membership_tier
  }

  return NextResponse.json({ success: true, completed, membershipTier })
}

// DELETE /api/installments/[id]/pay — undo payment
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()

  const installment = db.prepare('SELECT * FROM installments WHERE id = ?').get(id) as {
    customer_id: number
  } | undefined

  if (!installment) return NextResponse.json({ error: '找不到分期' }, { status: 404 })

  db.prepare('UPDATE installments SET paid_at = NULL WHERE id = ?').run(id)
  db.prepare(`UPDATE customers SET is_completed = 0, updated_at = datetime('now') WHERE id = ?`)
    .run(installment.customer_id)

  return NextResponse.json({ success: true })
}
