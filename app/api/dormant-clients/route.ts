import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// GET /api/dormant-clients?days=60
// 回傳：有進行中套組，但超過 N 天沒有預約或消費記錄的客人
export async function GET(req: NextRequest) {
  const days = Math.max(1, Number(req.nextUrl.searchParams.get('days') || '60'))
  const db = getDb()

  const rows = db.prepare(`
    SELECT
      c.id,
      c.name,
      c.phone,
      c.level,
      COUNT(DISTINCT p.id) AS active_pkg_count,
      (
        SELECT MAX(d) FROM (
          SELECT MAX(a.date) AS d FROM appointment_logs a WHERE a.client_id = c.id
          UNION ALL
          SELECT MAX(co.date) AS d FROM checkouts co WHERE co.client_id = c.id
        )
      ) AS last_visit_date
    FROM clients c
    JOIN packages p ON p.client_id = c.id
      AND p.used_sessions < p.total_sessions
    GROUP BY c.id, c.name, c.phone, c.level
    HAVING last_visit_date IS NULL
       OR  last_visit_date < date('now', '-' || @days || ' days')
    ORDER BY COALESCE(last_visit_date, '0000-00-00') ASC
  `).all({ days })

  return NextResponse.json(rows)
}
