import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// PATCH /api/sv-ledger/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = getDb()

  const entry = db.prepare('SELECT * FROM sv_ledger WHERE id = ?').get(id) as { id: number; amount: number } | undefined
  if (!entry) return NextResponse.json({ error: '找不到記錄' }, { status: 404 })

  const body = await req.json()
  const { amount, paid_amount, note, date, payment_method } = body

  const isDeposit = Number(amount) > 0
  const parsedPaid = paid_amount !== undefined && paid_amount !== '' ? Number(paid_amount) : null
  const storedPaid = isDeposit && parsedPaid !== null && parsedPaid !== Number(amount) ? parsedPaid : null

  db.prepare(`
    UPDATE sv_ledger SET
      amount         = @amount,
      paid_amount    = @paid_amount,
      note           = @note,
      date           = @date,
      payment_method = @payment_method
    WHERE id = @id
  `).run({
    id: Number(id),
    amount:         Number(amount),
    paid_amount:    storedPaid,
    note:           note || null,
    date:           date || '',
    payment_method: isDeposit ? (payment_method || null) : null,
  })

  return NextResponse.json({ success: true })
}

// DELETE /api/sv-ledger/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = getDb()
  db.prepare('DELETE FROM sv_ledger WHERE id = ?').run(id)
  return NextResponse.json({ success: true })
}
