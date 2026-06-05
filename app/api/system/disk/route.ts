import { NextResponse } from 'next/server'
import { statfs } from 'fs/promises'
import { existsSync, readdirSync, statSync } from 'fs'
import path from 'path'
import { DATA_DIR, DOCS_DIR } from '@/lib/db'

export const runtime = 'nodejs'

function fmtBytes(bytes: number): string {
  if (bytes < 1024)           return `${bytes} B`
  if (bytes < 1024 * 1024)    return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3)      return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

export async function GET() {
  try {
    const stats = await statfs(DATA_DIR)
    const total   = stats.bsize * stats.blocks
    const free    = stats.bsize * stats.bavail
    const used    = total - free
    const usedPct = total > 0 ? Math.round((used / total) * 100) : 0

    // 文件資料夾統計
    let docCount = 0
    let docSize  = 0
    if (existsSync(DOCS_DIR)) {
      const files = readdirSync(DOCS_DIR)
      docCount = files.length
      for (const f of files) {
        try { docSize += statSync(path.join(DOCS_DIR, f)).size } catch { /* skip */ }
      }
    }

    return NextResponse.json({
      total,  used,  free,  usedPct,
      totalFmt: fmtBytes(total),
      usedFmt:  fmtBytes(used),
      freeFmt:  fmtBytes(free),
      documents: {
        count:   docCount,
        size:    docSize,
        sizeFmt: fmtBytes(docSize),
      },
    })
  } catch (err) {
    // 本機開發時 statfs 可能不支援，回傳 null 讓前端降級顯示
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
