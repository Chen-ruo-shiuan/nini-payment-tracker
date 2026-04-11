import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// GET /api/contracts/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()

  const contract = db.prepare(`
    SELECT ic.*, c.name as client_name, c.level as client_level
    FROM installment_contracts ic
    JOIN clients c ON c.id = ic.client_id
    WHERE ic.id = ?
  `).get(id)

  if (!contract) return NextResponse.json({ error: '找不到合約' }, { status: 404 })

  const installments = db.prepare(`
    SELECT * FROM installments WHERE contract_id = ? ORDER BY period_number ASC
  `).all(id)

  return NextResponse.json({ ...contract as object, installments })
}

// DELETE /api/contracts/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()

  const existing = db.prepare('SELECT id FROM installment_contracts WHERE id = ?').get(id)
  if (!existing) return NextResponse.json({ error: '找不到合約' }, { status: 404 })

  db.prepare('DELETE FROM installment_contracts WHERE id = ?').run(id)
  return NextResponse.json({ success: true })
}

// PATCH /api/contracts/[id] — mark completed / reopen
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const body = await req.json()

  const existing = db.prepare('SELECT id FROM installment_contracts WHERE id = ?').get(id)
  if (!existing) return NextResponse.json({ error: '找不到合約' }, { status: 404 })

  if (typeof body.is_completed === 'number') {
    db.prepare(`UPDATE installment_contracts SET is_completed = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(body.is_completed, id)
  }

  return NextResponse.json({ success: true })
}
