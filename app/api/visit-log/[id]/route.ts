import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

interface Item { category: string; label: string }

// PATCH /api/visit-log/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const row = db.prepare('SELECT id FROM visit_logs WHERE id = ?').get(id)
  if (!row) return NextResponse.json({ error: '找不到記錄' }, { status: 404 })

  const body = await req.json()
  const { client_id, client_name, date, items, paid, amount, next_visit_date, note } = body

  const validItems = ((items ?? []) as Item[]).filter(i => i.label?.trim())

  if (!date)                return NextResponse.json({ error: '請選擇日期' },     { status: 400 })
  if (!client_name?.trim()) return NextResponse.json({ error: '請輸入客人姓名' }, { status: 400 })
  if (!validItems.length)   return NextResponse.json({ error: '請新增至少一個項目' }, { status: 400 })
  if (paid && (!amount || Number(amount) <= 0))
                             return NextResponse.json({ error: '請輸入金額' },     { status: 400 })

  const serviceSummary = validItems.map(i => i.label.trim()).join('、')

  db.transaction(() => {
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
      service: serviceSummary,
      paid: paid ? 1 : 0,
      amount: paid ? Number(amount) : null,
      next_visit_date: next_visit_date || null,
      note: note || null,
    })

    db.prepare('DELETE FROM visit_log_items WHERE visit_log_id = ?').run(id)
    const insertItem = db.prepare('INSERT INTO visit_log_items (visit_log_id, category, label) VALUES (?, ?, ?)')
    for (const item of validItems) {
      insertItem.run(Number(id), item.category || '服務', item.label.trim())
    }
  })()

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
