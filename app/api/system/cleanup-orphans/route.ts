import { NextResponse } from 'next/server'
import { existsSync, readdirSync, unlinkSync } from 'fs'
import path from 'path'
import { getDb, DOCS_DIR } from '@/lib/db'

export const runtime = 'nodejs'

// POST /api/system/cleanup-orphans
// 找出磁碟上沒有對應 DB 記錄的孤立文件並刪除
export async function POST() {
  try {
    if (!existsSync(DOCS_DIR)) {
      return NextResponse.json({ deleted: 0, files: [] })
    }

    const db = getDb()

    // DB 裡所有已知的檔名
    const dbFilenames = new Set(
      (db.prepare('SELECT filename FROM client_documents').all() as { filename: string }[])
        .map(r => r.filename)
    )

    const diskFiles = readdirSync(DOCS_DIR)
    const orphans: string[] = []

    for (const f of diskFiles) {
      if (!dbFilenames.has(f)) {
        orphans.push(f)
      }
    }

    // 刪除孤立檔案
    for (const f of orphans) {
      try {
        unlinkSync(path.join(DOCS_DIR, f))
      } catch (e) {
        console.error('[cleanup-orphans] 無法刪除', f, e)
      }
    }

    return NextResponse.json({
      deleted: orphans.length,
      files: orphans,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
