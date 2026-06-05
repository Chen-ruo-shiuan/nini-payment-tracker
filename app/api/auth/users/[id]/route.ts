import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

export const runtime = 'nodejs'

function isOwner(req: NextRequest) {
  return req.headers.get('x-user-role') === 'owner'
}

// PATCH /api/auth/users/[id] — update display_name, password, active (owner only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isOwner(req)) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  const { id } = await params
  const userId = parseInt(id)
  if (isNaN(userId)) {
    return NextResponse.json({ error: '無效的使用者 ID' }, { status: 400 })
  }

  const db = getDb()
  const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(userId) as
    { id: number; username: string } | undefined

  if (!user) {
    return NextResponse.json({ error: '使用者不存在' }, { status: 404 })
  }

  const body = await req.json()
  const updates: string[] = []
  const values: (string | number)[] = []

  if (body.display_name !== undefined) {
    updates.push('display_name = ?')
    values.push(body.display_name || null as unknown as string)
  }
  if (body.password) {
    updates.push('password_hash = ?')
    values.push(hashPassword(body.password))
  }
  if (body.active !== undefined) {
    // Prevent owner from deactivating themselves
    if (user.username === 'owner' && body.active === 0) {
      return NextResponse.json({ error: '無法停用老闆帳號' }, { status: 400 })
    }
    updates.push('active = ?')
    values.push(body.active ? 1 : 0)
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: '沒有提供要更新的欄位' }, { status: 400 })
  }

  values.push(userId)
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values)

  return NextResponse.json({ ok: true })
}

// DELETE /api/auth/users/[id] — deactivate (soft delete) user (owner only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isOwner(req)) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  const { id } = await params
  const userId = parseInt(id)
  if (isNaN(userId)) {
    return NextResponse.json({ error: '無效的使用者 ID' }, { status: 400 })
  }

  const db = getDb()
  const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(userId) as
    { id: number; username: string } | undefined

  if (!user) {
    return NextResponse.json({ error: '使用者不存在' }, { status: 404 })
  }
  if (user.username === 'owner') {
    return NextResponse.json({ error: '無法刪除老闆帳號' }, { status: 400 })
  }

  db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(userId)
  return NextResponse.json({ ok: true })
}
