import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

function thisMonth() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' }).slice(0, 7)
}
function todayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
}

// 讀取 tea_usage，相容舊格式（整數計數）與新格式（日期陣列）
function parseTeaUsage(raw: string): Record<string, string[]> {
  const parsed = JSON.parse(raw || '{}')
  const result: Record<string, string[]> = {}
  for (const [k, v] of Object.entries(parsed)) {
    result[k] = Array.isArray(v) ? (v as string[]) : []
  }
  return result
}

// POST /api/clients/[id]/tea  { date?: string }  → 新增一次下午茶
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const body = await req.json().catch(() => ({}))
  const date = body.date || todayStr()
  const month = date.slice(0, 7)

  const client = db.prepare('SELECT tea_usage FROM clients WHERE id = ?').get(id) as
    { tea_usage: string } | undefined
  if (!client) return NextResponse.json({ error: '找不到客人' }, { status: 404 })

  const usage = parseTeaUsage(client.tea_usage)
  if (!usage[month]) usage[month] = []
  usage[month].push(date)

  db.prepare(`UPDATE clients SET tea_usage = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(JSON.stringify(usage), id)

  return NextResponse.json({ usage })
}

// DELETE /api/clients/[id]/tea  { date: string }  → 取消一筆
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const body = await req.json().catch(() => ({}))
  const date = body.date

  const client = db.prepare('SELECT tea_usage FROM clients WHERE id = ?').get(id) as
    { tea_usage: string } | undefined
  if (!client) return NextResponse.json({ error: '找不到客人' }, { status: 404 })

  const usage = parseTeaUsage(client.tea_usage)
  const month = date?.slice(0, 7) || thisMonth()
  if (usage[month] && date) {
    const idx = usage[month].lastIndexOf(date)
    if (idx !== -1) usage[month].splice(idx, 1)
    if (usage[month].length === 0) delete usage[month]
  }

  db.prepare(`UPDATE clients SET tea_usage = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(JSON.stringify(usage), id)

  return NextResponse.json({ usage })
}
