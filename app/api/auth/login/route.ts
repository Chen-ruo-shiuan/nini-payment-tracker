import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const COOKIE_NAME  = 'nini-auth'
const COOKIE_DAYS  = 14
const MAX_AGE      = 60 * 60 * 24 * COOKIE_DAYS

// 用 Node.js crypto 生成 HMAC-SHA256 token（格式與 middleware 驗證一致）
async function makeToken(secret: string): Promise<string> {
  const { createHmac } = await import('crypto')
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + MAX_AGE * 1000 })).toString('base64')
  const sig = createHmac('sha256', secret).update(payload).digest('hex')
  return `${payload}.${sig}`
}

export async function POST(req: NextRequest) {
  const { password } = await req.json()

  const expected = process.env.AUTH_PASSWORD
  const secret   = process.env.AUTH_SECRET ?? 'nini-dev-secret'

  if (!expected) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: '伺服器未設定密碼' }, { status: 500 })
    }
  } else if (password !== expected) {
    return NextResponse.json({ error: '密碼錯誤' }, { status: 401 })
  }

  const token = await makeToken(secret)
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/',
  })
  return res
}
