import { NextResponse } from 'next/server'
import { existsSync, readdirSync } from 'fs'
import path from 'path'
import archiver from 'archiver'
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

  const archive = archiver('zip', { zlib: { level: 6 } })

  // 將 /data/documents/ 底下所有檔案打包進 zip 的 documents/ 目錄
  archive.directory(DOCS_DIR, 'documents')
  archive.finalize()

  // 把 Node.js Readable Stream 轉換成 Web ReadableStream
  const readable = new ReadableStream({
    start(controller) {
      archive.on('data',  (chunk: Buffer) => controller.enqueue(chunk))
      archive.on('end',   ()              => controller.close())
      archive.on('error', (err: Error)    => controller.error(err))
    },
  })

  const now = new Date().toLocaleDateString('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).replace(/\//g, '-')

  const filename = `NINI文件備份_${now}.zip`

  return new NextResponse(readable, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  })
}
