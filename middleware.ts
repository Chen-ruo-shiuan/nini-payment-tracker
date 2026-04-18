import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'

const COOKIE_NAME = 'nini-auth'

export function verifyToken(token: string, secret: string): boolean {
  try {
    const [payload, sig] = token.split('.')
    if (!payload || !sig) return false
    const expected = createHmac('sha256', secret).update(payload).digest('hex')
    // Timing-safe compare
    if (expected.length !== sig.length) return false
    let diff = 0
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i)
    if (diff !== 0) return false
    // Check expiry
    const { exp } = JSON.parse(Buffer.from(payload, 'base64').toString())
    return Date.now() < exp
  } catch {
    return false
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 放行：登入相關、靜態資源、robots.txt
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/manifest.json' ||
    pathname.startsWith('/icons')
  ) {
    return NextResponse.next()
  }

  const secret = process.env.AUTH_SECRET ?? 'nini-dev-secret'
  const token = req.cookies.get(COOKIE_NAME)?.value

  if (!token || !verifyToken(token, secret)) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
