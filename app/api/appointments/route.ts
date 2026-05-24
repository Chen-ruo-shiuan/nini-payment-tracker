import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// GET /api/appointments?date=YYYY-MM-DD
// Returns appointment_logs for the given date, joined with client info
export async function GET(req: NextRequest) {
  const db = getDb()
  const date = req.nextUrl.searchParams.get('date') || ''
  if (!date) return NextResponse.json({ error: '請提供日期' }, { status: 400 })

  const rows = db.prepare(`
    SELECT
      al.id, al.client_id, al.date, al.note, al.created_at,
      c.name as client_name, c.level as client_level,
      c.phone as client_phone
    FROM appointment_logs al
    JOIN clients c ON c.id = al.client_id
    WHERE al.date = ?
    ORDER BY al.created_at ASC
  `).all(date)

  return NextResponse.json(rows)
}
