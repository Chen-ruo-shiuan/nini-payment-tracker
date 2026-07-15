import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// PATCH /api/visit-log/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const row = db.prepare('SELECT id FROM visit_logs WHERE id = ?').get(id)
  if (!row) return NextResponse.json({ error: '找不到記錄' }, { status: 404 })

  const body = await req.json()
  const { client_id, client_name, date, service, paid, amount, next_visit_date, note } = body

  if (!date)                return NextResponse.json({ error: '請選擇日期' },     { status: 400 })
  if (!client_name?.trim()) return NextResponse.json({ error: '請輸入客人姓名' }, { status: 400 })
  if (!service?.trim())     return NextResponse.json({ error: '請輸入服務項目' }, { status: 400 })
  if (paid && (!amount || Number(amount) <= 0))
                             return NextResponse.json({ error: '請輸入金額' },     { status: 400 })

  db.prepare(`
    UPDATE visit_logs
    SET client_id = @client_id, client_name = @client_name, date = @date, service = @service,
        paid = @paid, amount = @amount, next_visit_date = @next_visit_date, note = @note,
        updated_at = datetime('now')
    WHERE id = @id
  `).run({
    id,
    client_id: client_id ?? null,
    client_name: client_name.trim(),
    date,
    service: service.trim(),
    paid: paid ? 1 : 0,
    amount: paid ? Number(amount) : null,
    next_visit_date: next_visit_date || null,
    note: note || null,
  })

  return NextResponse.json({ success: true })
}

// DELETE /api/visit-log/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const row = db.prepare('SELECT id FROM visit_logs WHERE id = ?').get(id)
  if (!row) return NextResponse.json({ error: '找不到記錄' }, { status: 404 })
  db.prepare('DELETE FROM visit_logs WHERE id = ?').run(id)
  return NextResponse.json({ success: true })
}
