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

    // Check packages table columns
    const pkgCols = (db.prepare(`PRAGMA table_info(packages)`).all() as { name: string }[]).map(c => c.name)

    // Grab packages that have completion_bonus_service set (any value)
    const pkgSample = db.prepare(`
      SELECT id, client_id, service_name, used_sessions, total_sessions,
        completion_bonus_service, completion_bonus_price, completion_weeks,
        completion_bonus_desc, completion_claimed, opened_date
      FROM packages
      WHERE completion_bonus_service IS NOT NULL OR completion_weeks IS NOT NULL
      ORDER BY id DESC LIMIT 10
    `).all()

    return NextResponse.json({
      tables: tableNames,
      has_tags: tableNames.includes('tags'),
      has_client_tags: tableNames.includes('client_tags'),
      has_service_logs: tableNames.includes('service_logs'),
      tags_count: tagsCount,
      tags_error: tagsError,
      packages_columns: pkgCols,
      has_completion_bonus_service: pkgCols.includes('completion_bonus_service'),
      has_completion_claimed: pkgCols.includes('completion_claimed'),
      packages_sample: pkgSample,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
