import { NextRequest, NextResponse } from 'next/server'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { getDb, DOCS_DIR } from '@/lib/db'

export const runtime = 'nodejs'

const MAX_SIZE = 20 * 1024 * 1024 // 20 MB
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

// GET /api/clients/[id]/documents
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = getDb()
  const docs = db.prepare(
    `SELECT id, client_id, original_name, doc_type, note, file_size, upload_date, created_at
     FROM client_documents WHERE client_id = ? ORDER BY upload_date DESC, created_at DESC`
  ).all(Number(id))
  return NextResponse.json(docs)
}

// POST /api/clients/[id]/documents  (multipart/form-data)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const clientId = Number(id)
  const db = getDb()

  const client = db.prepare('SELECT id FROM clients WHERE id = ?').get(clientId)
  if (!client) return NextResponse.json({ error: '找不到客人' }, { status: 404 })

  let formData: FormData
  try { formData = await req.formData() } catch {
    return NextResponse.json({ error: '無法解析上傳資料' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: '請選擇檔案' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: '只支援 PDF、JPG、PNG 格式' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: '檔案不能超過 20MB' }, { status: 400 })
  }

  const docType   = (formData.get('doc_type')  as string) || '其他'
  const note      = (formData.get('note')       as string) || null
  const uploadDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })

  // Determine extension
  const ext = file.type === 'application/pdf' ? '.pdf'
    : file.type === 'image/jpeg' ? '.jpg'
    : file.type === 'image/png'  ? '.png'
    : '.webp'
  const filename = `${randomUUID()}${ext}`
  const filePath = join(DOCS_DIR, filename)

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    writeFileSync(filePath, buffer)
  } catch (err) {
    console.error('[Documents] write error', err)
    return NextResponse.json({ error: '儲存失敗，請重試' }, { status: 500 })
  }

  const res = db.prepare(`
    INSERT INTO client_documents (client_id, filename, original_name, doc_type, note, file_size, upload_date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(clientId, filename, file.name, docType, note, file.size, uploadDate)

  return NextResponse.json({ id: res.lastInsertRowid }, { status: 201 })
}
