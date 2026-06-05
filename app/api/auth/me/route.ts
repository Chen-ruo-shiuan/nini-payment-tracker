import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getDb } from '@/lib/db'
import { createHmac } from 'crypto'

export const runtime = 'nodejs'

const COOKIE_NAME = 'nini-auth'

function verifyToken(token: string, secret: string): { username: string; role: string } | null {
  try {
    const [b64, sig] = token.split('.')
    if (!b64 || !sig) return null
    const expected = createHmac('sha256', secret).update(b64).digest('hex')
    if (expected !== sig) return null
    const payload = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))
    if (!payload.exp || Date.now() > payload.exp) return null
    return { username: payload.username, role: payload.role }
  } catch {
    return null
  }
}

export async function GET(_req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) {
    return NextResponse.json({ error: 'not authenticated' }, { status: 401 })
  }

  const secret = process.env.AUTH_SECRET ?? 'nini-dev-secret'
  const payload = verifyToken(token, secret)
  if (!payload) {
    return NextResponse.json({ error: 'invalid token' }, { status: 401 })
  }

  const db = getDb()
  const user = db.prepare(
    `SELECT display_name FROM users WHERE username = ? AND active = 1`
  ).get(payload.username) as { display_name: string | null } | undefined

  return NextResponse.json({
    username: payload.username,
    role: payload.role,
    displayName: user?.display_name || payload.username,
  })
}
