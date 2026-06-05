import { NextResponse } from 'next/server'
import { existsSync, readdirSync, readFileSync } from 'fs'
import path from 'path'
import JSZip from 'jszip'
import { DOCS_DIR } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET() {
  if (!existsSync(DOCS_DIR)) {
    return NextResponse.json({ error: '文件資料夾不存在' }, { status: 404 })
  }

  const files = readdirSync(DOCS_DIR)
  if (files.length === 0) {
    return NextResponse.json({ error: '目前沒有任何上傳文件' }, { status: 404 })
  }

  const zip = new JSZip()
  const folder = zip.folder('documents')!

  for (const filename of files) {
    try {
      const content = readFileSync(path.join(DOCS_DIR, filename))
      folder.file(filename, content)
    } catch { /* skip unreadable files */ }
  }

  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  const now = new Date().toLocaleDateString('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).replace(/\//g, '-')

  const filename = `NINI文件備份_${now}.zip`

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  })
}
