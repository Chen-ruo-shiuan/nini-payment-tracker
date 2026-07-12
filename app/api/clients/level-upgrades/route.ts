import { NextResponse, NextRequest } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

const WUYUMI_CAP = 15

// GET /api/clients/level-upgrades?year=2026
export async function GET(req: NextRequest) {
  const db = getDb()
  const year = req.nextUrl.searchParams.get('year') ||
    new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' }).slice(0, 4)

  const { count } = db.prepare(
    `SELECT COUNT(*) AS count FROM clients WHERE level = '悟癒米' AND level_since LIKE ?`
  ).get(`${year}-%`) as { count: number }

  return NextResponse.json({ count, year, cap: WUYUMI_CAP })
}
