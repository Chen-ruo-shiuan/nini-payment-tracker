import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

interface Item { category: string; label: string }
interface Payment { method: string; amount: number | string }

// PATCH /api/visit-log/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const row = db.prepare('SELECT id FROM visit_logs WHERE id = ?').get(id)
  if (!row) return NextResponse.json({ error: '找不到記錄' }, { status: 404 })

  const body = await req.json()
  const { client_id, client_name, date, items, payment_status, payments, next_visit_date, note } = body

  const validItems = ((items ?? []) as Item[]).filter(i => i.label?.trim())
  const status: string = payment_status || '未收費'
  const isPaid = status !== '未收費'
  const validPayments = ((payments ?? []) as Payment[]).filter(p => p.method && p.amount !== '' && p.amount != null && Number(p.amount) >= 0)

  if (!date)                return NextResponse.json({ error: '請選擇日期' },     { status: 400 })
  if (!client_name?.trim()) return NextResponse.json({ error: '請輸入客人姓名' }, { status: 400 })
  if (!validItems.length)   return NextResponse.json({ error: '請新增至少一個項目' }, { status: 400 })
  if (isPaid && !validPayments.length)
                             return NextResponse.json({ error: '請新增付款方式與金額' }, { status: 400 })

  const serviceSummary = validItems.map(i => i.label.trim()).join('、')
  const paymentTotal    = validPayments.reduce((s, p) => s + Number(p.amount), 0)
  const paymentSummary  = validPayments.map(p => p.method).join('、')

  db.transaction(() => {
    db.prepare(`
      UPDATE visit_logs
      SET client_id = @client_id, client_name = @client_name, date = @date, service = @service,
          paid = @paid, payment_status = @payment_status, payment_method = @payment_method,
          amount = @amount, next_visit_date = @next_visit_date, note = @note,
          updated_at = datetime('now')
      WHERE id = @id
    `).run({
      id,
      client_id: client_id ?? null,
      client_name: client_name.trim(),
      date,
      service: serviceSummary,
      paid: isPaid ? 1 : 0,
      payment_status: status,
      payment_method: isPaid ? paymentSummary : null,
      amount: isPaid ? paymentTotal : null,
      next_visit_date: next_visit_date || null,
      note: note || null,
    })

    db.prepare('DELETE FROM visit_log_items WHERE visit_log_id = ?').run(id)
    const insertItem = db.prepare('INSERT INTO visit_log_items (visit_log_id, category, label) VALUES (?, ?, ?)')
    for (const item of validItems) {
      insertItem.run(Number(id), item.category || '服務', item.label.trim())
    }

    db.prepare('DELETE FROM visit_log_payments WHERE visit_log_id = ?').run(id)
    const insertPayment = db.prepare('INSERT INTO visit_log_payments (visit_log_id, method, amount) VALUES (?, ?, ?)')
    for (const pay of validPayments) {
      insertPayment.run(Number(id), pay.method, Number(pay.amount))
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
