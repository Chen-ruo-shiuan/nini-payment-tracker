import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

function getTaipeiDate(offsetDays = 0): string {
  const now = new Date()
  now.setDate(now.getDate() + offsetDays)
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
}

// GET /api/dashboard
export async function GET() {
  const db = getDb()
  const today = getTaipeiDate(0)
  const in7days = getTaipeiDate(7)

  const baseQuery = `
    SELECT i.id, i.client_id, i.contract_id, i.period_number, i.due_date, i.amount,
           c.name as client_name, c.level as client_level
    FROM installments i
    JOIN installment_contracts ic ON ic.id = i.contract_id
    JOIN clients c ON c.id = i.client_id
    WHERE i.paid_at IS NULL
  `

  const rows = db.prepare(`${baseQuery}
    AND i.due_date >= @today AND i.due_date <= @in7days
    ORDER BY i.due_date ASC
  `).all({ today, in7days })

  const todayDue = (rows as { due_date: string }[]).filter(r => r.due_date === today)
  const weekDue = (rows as { due_date: string }[]).filter(r => r.due_date !== today)

  const overdue = db.prepare(`${baseQuery}
    AND i.due_date < @today
    ORDER BY i.due_date ASC
  `).all({ today })

  // Summary stats
  const totalClients = (db.prepare('SELECT COUNT(*) as n FROM clients').get() as { n: number }).n
  const activeContracts = (db.prepare('SELECT COUNT(*) as n FROM installment_contracts WHERE is_completed = 0').get() as { n: number }).n
  const totalOutstanding = (db.prepare(`
    SELECT COALESCE(SUM(i.amount), 0) as total
    FROM installments i
    WHERE i.paid_at IS NULL
  `).get() as { total: number }).total

  return NextResponse.json({ todayDue, weekDue, overdue, totalClients, activeContracts, totalOutstanding })
}
