import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// GET /api/clients/[id]/product-logs
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const rows = db.prepare(`
    SELECT p.*,
      c.date as checkout_date, c.total_amount as checkout_total
    FROM product_usage_logs p
    LEFT JOIN checkouts c ON c.id = p.checkout_id
    WHERE p.client_id = ?
    ORDER BY p.date DESC, p.id DESC
  `).all(Number(id))
  return NextResponse.json(rows)
}

// POST /api/clients/[id]/product-logs
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const body = await req.json()
  const { date, product_name, category, record_type, checkout_id, note } = body

  if (!date) return NextResponse.json({ error: '請填寫日期' }, { status: 400 })
  if (!product_name?.trim()) return NextResponse.json({ error: '請填寫產品名稱' }, { status: 400 })

  const result = db.prepare(`
    INSERT INTO product_usage_logs
      (client_id, date, product_name, category, record_type, checkout_id, note)
    VALUES
      (@client_id, @date, @product_name, @category, @record_type, @checkout_id, @note)
  `).run({
    client_id: Number(id),
    date,
    product_name: product_name.trim(),
    category: category || null,
    record_type: record_type || '店內購買',
    checkout_id: checkout_id ? Number(checkout_id) : null,
    note: note || null,
  })

  return NextResponse.json({ id: Number(result.lastInsertRowid) })
}
