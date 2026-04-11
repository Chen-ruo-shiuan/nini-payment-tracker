import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// POST /api/push/subscribe
export async function POST(req: NextRequest) {
  const db = getDb()
  const body = await req.json()
  const { endpoint, keys, userAgent } = body

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: '缺少訂閱資料' }, { status: 400 })
  }

  db.prepare(`
    INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_agent)
    VALUES (@endpoint, @p256dh, @auth, @user_agent)
    ON CONFLICT(endpoint) DO UPDATE SET p256dh = @p256dh, auth = @auth
  `).run({
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
    user_agent: userAgent || null,
  })

  return NextResponse.json({ success: true })
}

// DELETE /api/push/subscribe
export async function DELETE(req: NextRequest) {
  const db = getDb()
  const body = await req.json()
  db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(body.endpoint)
  return NextResponse.json({ success: true })
}
