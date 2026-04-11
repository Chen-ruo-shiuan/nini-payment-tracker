import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// GET /api/expenses?month=YYYY-MM   (all if no month)
export async function GET(req: NextRequest) {
  const db = getDb()
  const month = req.nextUrl.searchParams.get('month') || ''

  const rows = month
    ? db.prepare(`SELECT * FROM expenses WHERE date LIKE ? ORDER BY date DESC, id DESC`).all(`${month}%`)
    : db.prepare(`SELECT * FROM expenses ORDER BY date DESC, id DESC LIMIT 200`).all()

  return NextResponse.json(rows)
}

// POST /api/expenses
export async function POST(req: NextRequest) {
  const db = getDb()
  const body = await req.json()
  const { date, category, note, amount, pay_method } = body

  if (!date)   return NextResponse.json({ error: '請選擇日期' },   { status: 400 })
  if (!amount || Number(amount) <= 0)
               return NextResponse.json({ error: '請輸入金額' },   { status: 400 })

  const res = db.prepare(`
    INSERT INTO expenses (date, category, note, amount, pay_method)
    VALUES (@date, @category, @note, @amount, @pay_method)
  `).run({
    date,
    category: category || '食材耗材',
    note: note || null,
    amount: Number(amount),
    pay_method: pay_method || '店內現金',
  })

  return NextResponse.json({ id: res.lastInsertRowid }, { status: 201 })
}
