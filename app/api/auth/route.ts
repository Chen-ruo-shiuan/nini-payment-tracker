import { NextRequest, NextResponse } from 'next/server'
import { webcrypto } from 'crypto'

export const runtime = 'nodejs'

// ── 登入失敗次數限制 ──────────────────────────────────────────────────────────
const MAX_ATTEMPTS = 5            // 最多失敗幾次
const BLOCK_MS = 15 * 60 * 1000  // 封鎖 15 分鐘

interface AttemptRecord {
  count: number
  blockedUntil: number | null
  lastAttempt: number
}
const attempts = new Map<string, AttemptRecord>()

// 每小時清除超過 2 小時的舊記錄
setInterval(() => {
  const now = Date.now()
  for (const [ip, rec] of attempts.entries()) {
    if (now - rec.lastAttempt > 2 * 60 * 60 * 1000) attempts.delete(ip)
  }
}, 60 * 60 * 1000)

function getIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

// ── 產生 HMAC token（與 middleware.ts 格式相符）──────────────────────────────
async function signToken(secret: string): Promise<string> {
  const exp = Date.now() + 30 * 24 * 60 * 60 * 1000  // 30 天後到期
  const payloadB64 = Buffer.from(JSON.stringify({ exp })).toString('base64')
  const encoder = new TextEncoder()
  const key = await webcrypto.subtle.importKey(
    'raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  )
  const sigBuffer = await webcrypto.subtle.sign('HMAC', key, encoder.encode(payloadB64))
  const sigHex = Array.from(new Uint8Array(sigBuffer))
    .map(b => b.toString(16).padStart(2, '0')).join('')
  return `${payloadB64}.${sigHex}`
}

// ── POST /api/auth  登入 ──────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const ip = getIp(req)
  const now = Date.now()

  const rec = attempts.get(ip) ?? { count: 0, blockedUntil: null, lastAttempt: now }

  // 還在封鎖期
  if (rec.blockedUntil && now < rec.blockedUntil) {
    const remainMin = Math.ceil((rec.blockedUntil - now) / 60000)
    return NextResponse.json(
      { error: `嘗試次數過多，請 ${remainMin} 分鐘後再試` },
      { status: 429 }
    )
  }

  // 封鎖期已過 → 重置
  if (rec.blockedUntil && now >= rec.blockedUntil) {
    rec.count = 0
    rec.blockedUntil = null
  }

  const { password } = await req.json()
  const expected = process.env.APP_PASSWORD ?? 'nini1234'
  const secret   = process.env.AUTH_SECRET   ?? 'nini-dev-secret'

  if (password !== expected) {
    rec.count += 1
    rec.lastAttempt = now
    if (rec.count >= MAX_ATTEMPTS) {
      rec.blockedUntil = now + BLOCK_MS
      attempts.set(ip, rec)
      return NextResponse.json(
        { error: '密碼錯誤次數過多，已封鎖 15 分鐘' },
        { status: 429 }
      )
    }
    attempts.set(ip, rec)
    const remaining = MAX_ATTEMPTS - rec.count
    return NextResponse.json(
      { error: `密碼錯誤，還剩 ${remaining} 次機會` },
      { status: 401 }
    )
  }

  // 登入成功
  attempts.delete(ip)
  const token = await signToken(secret)

  const res = NextResponse.json({ ok: true })
  res.cookies.set('nini-auth', token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,  // 30 天
  })
  return res
}

// ── DELETE /api/auth  登出 ───────────────────────────────────────────────────
export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set('nini-auth', '', { maxAge: 0, path: '/' })
  return res
}
