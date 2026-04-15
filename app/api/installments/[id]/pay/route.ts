import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// POST /api/installments/[id]/pay
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()

  const installment = db.prepare('SELECT * FROM installments WHERE id = ?').get(id) as {
    id: number; contract_id: number; client_id: number; paid_at: string | null
  } | undefined

  if (!installment) return NextResponse.json({ error: '找不到分期' }, { status: 404 })
  if (installment.paid_at) return NextResponse.json({ error: '已繳納' }, { status: 400 })

  let paidAt: string
  try {
    const body = await req.json()
    paidAt = body.paid_at && /^\d{4}-\d{2}-\d{2}$/.test(body.paid_at) ? body.paid_at : new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
  } catch {
    paidAt = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
  }

  db.prepare(`UPDATE installments SET paid_at = ? WHERE id = ?`).run(paidAt, id)

  // Check if all installments for this contract are paid
  const unpaid = db.prepare(
    'SELECT COUNT(*) as count FROM installments WHERE contract_id = ? AND paid_at IS NULL'
  ).get(installment.contract_id) as { count: number }

  let completed = false
  if (unpaid.count === 0) {
    db.prepare(`UPDATE installment_contracts SET is_completed = 1, updated_at = datetime('now') WHERE id = ?`)
      .run(installment.contract_id)
    completed = true
  }

  return NextResponse.json({ success: true, completed })
}

// DELETE /api/installments/[id]/pay — undo payment
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()

  const installment = db.prepare('SELECT * FROM installments WHERE id = ?').get(id) as {
    contract_id: number
  } | undefined

  if (!installment) return NextResponse.json({ error: '找不到分期' }, { status: 404 })

  db.prepare('UPDATE installments SET paid_at = NULL WHERE id = ?').run(id)
  // Reopen contract if it was completed
  db.prepare(`UPDATE installment_contracts SET is_completed = 0, updated_at = datetime('now') WHERE id = ?`)
    .run(installment.contract_id)

  return NextResponse.json({ success: true })
}
