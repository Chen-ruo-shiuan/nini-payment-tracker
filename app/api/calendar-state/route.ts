import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// CORS headers — allow GitHub Pages (or any origin) to call this API
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

function ensureTable(db: ReturnType<typeof getDb>) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS calendar_state (
      id      INTEGER PRIMARY KEY CHECK (id = 1),
      state   TEXT    NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)
}

// GET /api/calendar-state → return saved calendar settings
export async function GET() {
  const db = getDb()
  ensureTable(db)
  const row = db.prepare('SELECT state FROM calendar_state WHERE id = 1').get() as { state: string } | undefined
  const data = row ? JSON.parse(row.state) : {}
  return NextResponse.json(data, { headers: CORS })
}

// POST /api/calendar-state → save calendar settings
export async function POST(req: NextRequest) {
  const db = getDb()
  ensureTable(db)
  const body = await req.json()
  db.prepare(`
    INSERT INTO calendar_state (id, state, updated_at)
    VALUES (1, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      state      = excluded.state,
      updated_at = excluded.updated_at
  `).run(JSON.stringify(body))
  return NextResponse.json({ ok: true, updated_at: new Date().toISOString() }, { headers: CORS })
}
