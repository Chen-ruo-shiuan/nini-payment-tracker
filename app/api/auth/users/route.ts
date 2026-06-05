import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

export const runtime = 'nodejs'

function isOwner(req: NextRequest) {
  return req.headers.get('x-user-role') === 'owner'
}

// GET /api/auth/users — list all users (owner only)
export async function GET(req: NextRequest) {
  if (!isOwner(req)) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  const db = getDb()
  const users = db.prepare(
    `SELECT id, username, role, display_name, active, created_at FROM users ORDER BY id`
  ).all() as {
    id: number; username: string; role: string
    display_name: string | null; active: number; created_at: string
  }[]

  return NextResponse.json(users)
}

// POST /api/auth/users — create new user (owner only)
export async function POST(req: NextRequest) {
  if (!isOwner(req)) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  const { username, password, role, display_name } = await req.json()

  if (!username || !password) {
    return NextResponse.json({ error: '帳號與密碼為必填' }, { status: 400 })
  }
  if (role && !['owner', 'staff'].includes(role)) {
    return NextResponse.json({ error: '無效的角色' }, { status: 400 })
  }

  const db = getDb()

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim())
  if (existing) {
    return NextResponse.json({ error: '帳號已存在' }, { status: 409 })
  }

  const hash = hashPassword(password)
  const result = db.prepare(
    `INSERT INTO users (username, password_hash, role, display_name) VALUES (?, ?, ?, ?)`
  ).run(username.trim(), hash, role || 'staff', display_name || null)

  return NextResponse.json({ ok: true, id: result.lastInsertRowid })
}
