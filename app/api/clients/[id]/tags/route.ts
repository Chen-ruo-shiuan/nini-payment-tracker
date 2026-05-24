import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// GET /api/clients/[id]/tags
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const tags = db.prepare(`
    SELECT t.* FROM tags t
    JOIN client_tags ct ON ct.tag_id = t.id
    WHERE ct.client_id = ?
    ORDER BY t.name ASC
  `).all(id)
  return NextResponse.json(tags)
}

// POST /api/clients/[id]/tags — 幫客人貼標籤
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const { tag_id } = await req.json()
  if (!tag_id) return NextResponse.json({ error: '請提供 tag_id' }, { status: 400 })

  db.prepare(
    `INSERT OR IGNORE INTO client_tags (client_id, tag_id) VALUES (?, ?)`
  ).run(Number(id), Number(tag_id))
  return NextResponse.json({ success: true })
}
