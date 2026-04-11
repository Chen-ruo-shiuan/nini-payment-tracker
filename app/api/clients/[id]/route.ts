import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// GET /api/clients/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()

  const client = db.prepare(`
    SELECT c.*,
      COALESCE((SELECT SUM(amount) FROM sv_ledger WHERE client_id = c.id), 0) as stored_value,
      (SELECT COUNT(*) FROM installment_contracts WHERE client_id = c.id AND is_completed = 0) as active_contracts,
      (SELECT MIN(i.due_date) FROM installments i
        JOIN installment_contracts ic ON ic.id = i.contract_id
        WHERE ic.client_id = c.id AND i.paid_at IS NULL) as next_due_date,
      (SELECT COUNT(*) FROM packages p
        WHERE p.client_id = c.id AND p.used_sessions < p.total_sessions) as active_packages
    FROM clients c WHERE c.id = ?
  `).get(id)

  if (!client) return NextResponse.json({ error: '找不到客人' }, { status: 404 })

  // Fetch contracts with installments
  const contracts = db.prepare(`
    SELECT * FROM installment_contracts WHERE client_id = ? ORDER BY created_at DESC
  `).all(id)

  for (const contract of contracts as { id: number; installments?: unknown[] }[]) {
    contract.installments = db.prepare(`
      SELECT * FROM installments WHERE contract_id = ? ORDER BY period_number ASC
    `).all(contract.id)
  }

  // Fetch packages
  const packages = db.prepare(`
    SELECT * FROM packages WHERE client_id = ? ORDER BY date DESC
  `).all(id)

  // Fetch sv_ledger
  const sv_ledger = db.prepare(`
    SELECT * FROM sv_ledger WHERE client_id = ? ORDER BY date DESC
  `).all(id)

  // Fetch recent checkouts
  const checkouts = db.prepare(`
    SELECT * FROM checkouts WHERE client_id = ? ORDER BY date DESC LIMIT 20
  `).all(id)

  return NextResponse.json({ ...client as object, contracts, packages, sv_ledger, checkouts })
}

// PUT /api/clients/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const body = await req.json()
  const { name, phone, note, level, level_since, birthday } = body

  if (!name) return NextResponse.json({ error: '請輸入姓名' }, { status: 400 })

  const existing = db.prepare('SELECT id FROM clients WHERE id = ?').get(id)
  if (!existing) return NextResponse.json({ error: '找不到客人' }, { status: 404 })

  db.prepare(`
    UPDATE clients SET
      name = @name,
      phone = @phone,
      note = @note,
      level = @level,
      level_since = @level_since,
      birthday = @birthday,
      updated_at = datetime('now')
    WHERE id = @id
  `).run({ id: Number(id), name, phone: phone || null, note: note || null, level: level || '甜癒米', level_since: level_since || null, birthday: birthday || null })

  return NextResponse.json({ success: true })
}

// DELETE /api/clients/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()

  const existing = db.prepare('SELECT id FROM clients WHERE id = ?').get(id)
  if (!existing) return NextResponse.json({ error: '找不到客人' }, { status: 404 })

  db.prepare('DELETE FROM clients WHERE id = ?').run(id)
  return NextResponse.json({ success: true })
}
