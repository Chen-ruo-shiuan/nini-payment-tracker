import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const { password } = await req.json()
  const expected = process.env.APP_PASSWORD ?? 'nini1234'

  if (password !== expected) {
    return NextResponse.json({ error: '密碼錯誤' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set('nini-auth', expected, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 天
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set('nini-auth', '', { maxAge: 0, path: '/' })
  return res
}
