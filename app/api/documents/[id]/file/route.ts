import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, unlinkSync, existsSync } from 'fs'
import { join } from 'path'
import { getDb, DOCS_DIR } from '@/lib/db'

export const runtime = 'nodejs'

interface DocRow {
  id: number; client_id: number; filename: string; original_name: string
  doc_type: string; note: string | null; file_size: number | null; upload_date: string
}

// GET /api/documents/[id]/file  →  serve the file inline
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = getDb()
  const doc = db.prepare('SELECT * FROM client_documents WHERE id = ?').get(Number(id)) as DocRow | undefined
  if (!doc) return NextResponse.json({ error: '找不到檔案' }, { status: 404 })

  const filePath = join(DOCS_DIR, doc.filename)
  if (!existsSync(filePath)) return NextResponse.json({ error: '檔案已不存在' }, { status: 404 })

  const buffer = readFileSync(filePath)
  const ext = doc.filename.split('.').pop()?.toLowerCase()
  const contentType = ext === 'pdf' ? 'application/pdf'
    : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
    : ext === 'png' ? 'image/png'
    : 'application/octet-stream'

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(doc.original_name)}`,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}

// DELETE /api/documents/[id]/file
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = getDb()
  const doc = db.prepare('SELECT * FROM client_documents WHERE id = ?').get(Number(id)) as DocRow | undefined
  if (!doc) return NextResponse.json({ error: '找不到檔案' }, { status: 404 })

  const filePath = join(DOCS_DIR, doc.filename)
  try { if (existsSync(filePath)) unlinkSync(filePath) } catch { /* ignore */ }
  db.prepare('DELETE FROM client_documents WHERE id = ?').run(Number(id))

  return NextResponse.json({ ok: true })
}
