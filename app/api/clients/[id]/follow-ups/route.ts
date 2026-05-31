import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// GET /api/clients/[id]/follow-ups
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const rows = db.prepare(`
    SELECT * FROM follow_up_tasks
    WHERE client_id = ?
    ORDER BY due_date DESC, id DESC
  `).all(Number(id))
  return NextResponse.json(rows)
}
