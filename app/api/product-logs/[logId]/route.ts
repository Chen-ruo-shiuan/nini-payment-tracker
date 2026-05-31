import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// PATCH /api/product-logs/[logId]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ logId: string }> }) {
  const { logId } = await params
  const db = getDb()
  const body = await req.json()
  const { date, product_name, category, record_type, checkout_id, note } = body

  if (!date) return NextResponse.json({ error: '請填寫日期' }, { status: 400 })
  if (!product_name?.trim()) return NextResponse.json({ error: '請填寫產品名稱' }, { status: 400 })

  const existing = db.prepare('SELECT id FROM product_usage_logs WHERE id = ?').get(Number(logId))
  if (!existing) return NextResponse.json({ error: '找不到記錄' }, { status: 404 })

  db.prepare(`
    UPDATE product_usage_logs SET
      date = @date, product_name = @product_name,
      category = @category, record_type = @record_type,
      checkout_id = @checkout_id, note = @note
    WHERE id = @id
  `).run({
    id: Number(logId),
    date,
    product_name: product_name.trim(),
    category: category || null,
    record_type: record_type || '店內購買',
    checkout_id: checkout_id ? Number(checkout_id) : null,
    note: note || null,
  })

  return NextResponse.json({ success: true })
}

// DELETE /api/product-logs/[logId]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ logId: string }> }) {
  const { logId } = await params
  const db = getDb()
  db.prepare('DELETE FROM product_usage_logs WHERE id = ?').run(Number(logId))
  return NextResponse.json({ success: true })
}
