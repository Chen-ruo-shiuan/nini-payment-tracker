import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const db = getDb()
  const search = req.nextUrl.searchParams.get('q') || ''

  const clients = db.prepare(`
    SELECT c.*,
      COALESCE((SELECT SUM(amount) FROM sv_ledger WHERE client_id = c.id), 0) as stored_value,
      (SELECT COUNT(*) FROM installment_contracts WHERE client_id = c.id AND is_completed = 0) as active_contracts,
      (SELECT MIN(i.due_date) FROM installments i
        JOIN installment_contracts ic ON ic.id = i.contract_id
        WHERE ic.client_id = c.id AND i.paid_at IS NULL) as next_due_date,
      (SELECT COUNT(*) FROM packages p
        WHERE p.client_id = c.id AND p.used_sessions < p.total_sessions) as active_packages
    FROM clients c
    WHERE c.name LIKE @search
    ORDER BY c.name ASC
  `).all({ search: `%${search}%` })

  return NextResponse.json(clients)
}

export async function POST(req: NextRequest) {
  const db = getDb()
  const body = await req.json()
  const { name, phone, note, level, level_since, birthday } = body

  if (!name) return NextResponse.json({ error: '請輸入姓名' }, { status: 400 })

  const result = db.prepare(`
    INSERT INTO clients (name, phone, note, level, level_since, birthday)
    VALUES (@name, @phone, @note, @level, @level_since, @birthday)
  `).run({
    name,
    phone: phone || null,
    note: note || null,
    level: level || '甜癒米',
    level_since: level_since || null,
    birthday: birthday || null,
  })

  return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 })
}
