import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// POST /api/packages/[id]/recalc
// Recalculates used_sessions by counting 商品券 checkout items
// that match this package's service_name for this client.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = getDb()

  const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(id) as {
    id: number; client_id: number; service_name: string; total_sessions: number
  } | undefined
  if (!pkg) return NextResponse.json({ error: '找不到套組' }, { status: 404 })

  // Count all 商品券 items for this client matching this service_name
  const row = db.prepare(`
    SELECT COALESCE(SUM(ci.qty), 0) as total
    FROM checkout_items ci
    JOIN checkouts co ON co.id = ci.checkout_id
    WHERE co.client_id = ?
      AND ci.category = '商品券'
      AND ci.label = ?
  `).get(pkg.client_id, pkg.service_name) as { total: number }

  const newUsed = Math.min(row.total, pkg.total_sessions)
  db.prepare('UPDATE packages SET used_sessions = ? WHERE id = ?').run(newUsed, id)

  return NextResponse.json({ success: true, used_sessions: newUsed, total_sessions: pkg.total_sessions })
}
