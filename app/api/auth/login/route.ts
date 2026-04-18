import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'

export const runtime = 'nodejs'

const COOKIE_NAME = 'nini-auth'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 14 // 14 天

function makeToken(secret: string): string {
  const payload = Buffer.from(JSON.stringify({
    exp: Date.now() + COOKIE_MAX_AGE * 1000,
  })).toString('base64')
  const sig = createHmac('sha256', secret).update(payload).digest('hex')
  return `${payload}.${sig}`
}

export async function POST(req: NextRequest) {
  const { password } = await req.json()

  const expected = process.env.AUTH_PASSWORD
  const secret   = process.env.AUTH_SECRET ?? 'nini-dev-secret'

  if (!expected) {
    // 未設定環境變數時開發模式允許任意密碼（production 一定要設定）
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: '伺服器未設定密碼' }, { status: 500 })
    }
  } else if (password !== expected) {
    return NextResponse.json({ error: '密碼錯誤' }, { status: 401 })
  }

  const token = makeToken(secret)
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })
  return res
}
