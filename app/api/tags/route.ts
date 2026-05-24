import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// GET /api/tags — 全部標籤（附帶客人使用數）
export async function GET() {
  const db = getDb()
  const tags = db.prepare(`
    SELECT t.*, COUNT(ct.client_id) AS client_count
    FROM tags t
    LEFT JOIN client_tags ct ON ct.tag_id = t.id
    GROUP BY t.id
    ORDER BY t.name ASC
  `).all()
  return NextResponse.json(tags)
}

// POST /api/tags — 建立標籤
export async function POST(req: NextRequest) {
  const db = getDb()
  const { name, color } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: '請輸入標籤名稱' }, { status: 400 })

  const existing = db.prepare('SELECT id FROM tags WHERE name = ?').get(name.trim())
  if (existing) return NextResponse.json({ error: '標籤名稱已存在' }, { status: 409 })

  const res = db.prepare(
    `INSERT INTO tags (name, color) VALUES (?, ?)`
  ).run(name.trim(), color || '#9ab89e')

  return NextResponse.json({ id: res.lastInsertRowid }, { status: 201 })
}
