import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// GET /api/stats/referrals — 推薦人排行（最多帶來幾位新客）
export async function GET() {
  const db = getDb()

  const rows = db.prepare(`
    SELECT
      c.id,
      c.name,
      c.level,
      COUNT(r.id) AS referral_count
    FROM clients c
    JOIN clients r ON r.referred_by_id = c.id
    GROUP BY c.id, c.name, c.level
    ORDER BY referral_count DESC
    LIMIT 10
  `).all()

  return NextResponse.json(rows)
}
