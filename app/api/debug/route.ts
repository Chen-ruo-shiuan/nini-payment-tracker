import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// GET /api/debug — 列出所有資料表，確認 schema 狀態
export async function GET() {
  try {
    const db = getDb()
    const tables = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
    ).all() as { name: string }[]

    const tableNames = tables.map(t => t.name)

    // Check tags table specifically
    let tagsCount = 0
    let tagsError = ''
    if (tableNames.includes('tags')) {
      try {
        const r = db.prepare('SELECT COUNT(*) as n FROM tags').get() as { n: number }
        tagsCount = r.n
      } catch (e) {
        tagsError = String(e)
      }
    }

    return NextResponse.json({
      tables: tableNames,
      has_tags: tableNames.includes('tags'),
      has_client_tags: tableNames.includes('client_tags'),
      has_service_logs: tableNames.includes('service_logs'),
      tags_count: tagsCount,
      tags_error: tagsError,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
