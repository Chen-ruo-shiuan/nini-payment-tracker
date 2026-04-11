import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

function getTaipeiDate(offsetDays = 0): string {
  const now = new Date()
  now.setDate(now.getDate() + offsetDays)
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' }) // YYYY-MM-DD
}

// GET /api/dashboard
export async function GET() {
  const db = getDb()
  const today = getTaipeiDate(0)
  const in7days = getTaipeiDate(7)

  const rows = db.prepare(`
    SELECT i.id, i.customer_id, i.period_number, i.due_date, i.amount, i.paid_at,
           c.name as customer_name, c.membership_tier, c.payment_method
    FROM installments i
    JOIN customers c ON c.id = i.customer_id
    WHERE i.paid_at IS NULL
      AND i.due_date >= @today
      AND i.due_date <= @in7days
    ORDER BY i.due_date ASC
  `).all({ today, in7days })

  const todayDue = (rows as {due_date: string}[]).filter(r => r.due_date === today)
  const weekDue = (rows as {due_date: string}[]).filter(r => r.due_date !== today)

  // also get overdue
  const overdue = db.prepare(`
    SELECT i.id, i.customer_id, i.period_number, i.due_date, i.amount,
           c.name as customer_name, c.membership_tier, c.payment_method
    FROM installments i
    JOIN customers c ON c.id = i.customer_id
    WHERE i.paid_at IS NULL AND i.due_date < @today
    ORDER BY i.due_date ASC
  `).all({ today })

  return NextResponse.json({ todayDue, weekDue, overdue })
}
