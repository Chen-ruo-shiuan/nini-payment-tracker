import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  db.prepare('DELETE FROM appointment_logs WHERE id = ?').run(Number(id))
  return NextResponse.json({ success: true })
}
