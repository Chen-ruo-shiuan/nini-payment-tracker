import { NextRequest, NextResponse } from 'next/server'

const COOKIE_NAME = 'nini-auth'

// Web Crypto API — 在 Edge runtime 可用
async function verifyToken(token: string, secret: string): Promise<boolean> {
  try {
    const [payloadB64, sigHex] = token.split('.')
    if (!payloadB64 || !sigHex) return false

    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['verify']
    )

    // hex → Uint8Array
    const sigBytes = new Uint8Array(
      (sigHex.match(/.{2}/g) ?? []).map(b => parseInt(b, 16))
    )

    const valid = await crypto.subtle.verify(
      'HMAC', key, sigBytes, encoder.encode(payloadB64)
    )
    if (!valid) return false

    const { exp } = JSON.parse(atob(payloadB64))
    return Date.now() < exp
  } catch {
    return false
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 放行：登入相關、靜態資源、行事曆公開 API
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/api/calendar-state' ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/manifest.json' ||
    pathname.startsWith('/icons')
  ) {
    return NextResponse.next()
  }

  const secret = process.env.AUTH_SECRET ?? 'nini-dev-secret'
  const token  = req.cookies.get(COOKIE_NAME)?.value

  if (!token || !(await verifyToken(token, secret))) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
