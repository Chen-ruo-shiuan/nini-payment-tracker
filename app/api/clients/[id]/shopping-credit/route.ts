import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// GET /api/clients/[id]/shopping-credit  → 取得購物金明細
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const entries = db.prepare(
    `SELECT * FROM shopping_credit_ledger WHERE client_id = ? ORDER BY date DESC, id DESC`
  ).all(id)
  return NextResponse.json(entries)
}

// POST /api/clients/[id]/shopping-credit  → 新增一筆購物金記錄（手動發放/調整）
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const { delta, note, date } = await req.json()

  if (!delta || isNaN(Number(delta))) {
    return NextResponse.json({ error: '請輸入增減金額' }, { status: 400 })
  }

  const run = db.transaction(() => {
    db.prepare(
      `INSERT INTO shopping_credit_ledger (client_id, delta, note, date) VALUES (?, ?, ?, ?)`
    ).run(id, Number(delta), note || null, date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' }))

    // 重新計算餘額
    const { total } = db.prepare(
      `SELECT COALESCE(SUM(delta), 0) AS total FROM shopping_credit_ledger WHERE client_id = ?`
    ).get(id) as { total: number }

    db.prepare(`UPDATE clients SET shopping_credit = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(total, id)

    return total
  })

  const newTotal = run()
  return NextResponse.json({ ok: true, shopping_credit: newTotal }, { status: 201 })
}
