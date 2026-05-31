import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// GET /api/clients/[id]/product-logs
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const rows = db.prepare(`
    SELECT * FROM product_usage_logs
    WHERE client_id = ?
    ORDER BY date DESC, id DESC
  `).all(Number(id))
  return NextResponse.json(rows)
}

// POST /api/clients/[id]/product-logs
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const body = await req.json()
  const { date, product_name, quantity, unit, batch_note, note } = body

  if (!date) return NextResponse.json({ error: '請填寫日期' }, { status: 400 })
  if (!product_name?.trim()) return NextResponse.json({ error: '請填寫產品名稱' }, { status: 400 })

  const result = db.prepare(`
    INSERT INTO product_usage_logs (client_id, date, product_name, quantity, unit, batch_note, note)
    VALUES (@client_id, @date, @product_name, @quantity, @unit, @batch_note, @note)
  `).run({
    client_id: Number(id),
    date,
    product_name: product_name.trim(),
    quantity: quantity != null ? Number(quantity) : null,
    unit: unit || null,
    batch_note: batch_note || null,
    note: note || null,
  })

  return NextResponse.json({ id: result.lastInsertRowid })
}
