import { NextRequest, NextResponse } from 'next/server'

const COOKIE_NAME = 'nini-auth'

// Routes staff cannot access
const STAFF_BLOCKED = ['/reports', '/expenses', '/export', '/import', '/settings']

// Web Crypto API — 在 Edge runtime 可用
async function verifyToken(
  token: string,
  secret: string
): Promise<{ username: string; role: string } | null> {
  try {
    const [payloadB64, sigHex] = token.split('.')
    if (!payloadB64 || !sigHex) return null

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
    if (!valid) return null

    const payload = JSON.parse(atob(payloadB64))
    if (!payload.exp || Date.now() > payload.exp) return null

    return {
      username: payload.username ?? '',
      role: payload.role ?? 'staff',
    }
  } catch {
    return null
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 完全放行：靜態資源、登入頁面、登入/登出 API、公開行事曆
  // 注意：/api/auth/me 與 /api/auth/users 需要驗證，不在此放行
  if (
    pathname.startsWith('/login') ||
    pathname === '/api/auth/login' ||
    pathname === '/api/auth/logout' ||
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

  const payload = token ? await verifyToken(token, secret) : null

  if (!payload) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  const { role } = payload

  // Block staff from restricted routes
  if (role === 'staff' && STAFF_BLOCKED.some(p => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  // Attach role to request headers for API routes
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-user-role', role)
  requestHeaders.set('x-username', payload.username)

  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
