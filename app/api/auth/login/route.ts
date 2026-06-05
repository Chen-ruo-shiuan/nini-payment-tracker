import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { verifyPassword } from '@/lib/auth'

export const runtime = 'nodejs'

const COOKIE_NAME = 'nini-auth'
const COOKIE_DAYS = 14
const MAX_AGE     = 60 * 60 * 24 * COOKIE_DAYS

async function makeToken(payload: { username: string; role: string }, secret: string): Promise<string> {
  const { createHmac } = await import('crypto')
  const b64 = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + MAX_AGE * 1000 })).toString('base64')
  const sig  = createHmac('sha256', secret).update(b64).digest('hex')
  return `${b64}.${sig}`
}

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()

  if (!username || !password) {
    return NextResponse.json({ error: '請填寫帳號與密碼' }, { status: 400 })
  }

  const db     = getDb()
  const secret = process.env.AUTH_SECRET ?? 'nini-dev-secret'

  const user = db.prepare(
    `SELECT id, username, password_hash, role, display_name, active FROM users WHERE username = ?`
  ).get(username.trim()) as {
    id: number; username: string; password_hash: string
    role: string; display_name: string | null; active: number
  } | undefined

  if (!user || !user.active) {
    return NextResponse.json({ error: '帳號不存在或已停用' }, { status: 401 })
  }

  if (!verifyPassword(password, user.password_hash)) {
    return NextResponse.json({ error: '密碼錯誤，請再試一次' }, { status: 401 })
  }

  const token = await makeToken({ username: user.username, role: user.role }, secret)
  const res   = NextResponse.json({ ok: true, role: user.role, displayName: user.display_name || user.username })

  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/',
  })
  return res
}
