import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// DELETE /api/clients/[id]/tags/[tagId] — 移除標籤
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; tagId: string }> }
) {
  const { id, tagId } = await params
  const db = getDb()
  db.prepare('DELETE FROM client_tags WHERE client_id = ? AND tag_id = ?')
    .run(Number(id), Number(tagId))
  return NextResponse.json({ success: true })
}
