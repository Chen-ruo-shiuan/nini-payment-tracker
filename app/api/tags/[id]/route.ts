import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// PATCH /api/tags/[id] — 編輯名稱 / 顏色
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const { name, color } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: '請輸入標籤名稱' }, { status: 400 })

  const dup = db.prepare('SELECT id FROM tags WHERE name = ? AND id != ?').get(name.trim(), Number(id))
  if (dup) return NextResponse.json({ error: '標籤名稱已存在' }, { status: 409 })

  db.prepare('UPDATE tags SET name = ?, color = ? WHERE id = ?')
    .run(name.trim(), color, Number(id))
  return NextResponse.json({ success: true })
}

// DELETE /api/tags/[id] — 刪除標籤（client_tags 同步刪）
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  db.prepare('DELETE FROM tags WHERE id = ?').run(Number(id))
  return NextResponse.json({ success: true })
}
