import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { sendPushNotification } from '@/lib/vapid'

export const runtime = 'nodejs'

function getTaipeiDate(offsetDays = 0): string {
  const now = new Date()
  now.setDate(now.getDate() + offsetDays)
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
}

// POST /api/cron/notify
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET || 'dev-secret'
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getDb()
  const today = getTaipeiDate(0)
  const in2days = getTaipeiDate(2)
  const in4days = getTaipeiDate(4)

  const targetDates = [in4days, in2days]

  const installments = db.prepare(`
    SELECT i.id, i.due_date, i.period_number, c.name as customer_name, c.id as customer_id
    FROM installments i
    JOIN customers c ON c.id = i.customer_id
    WHERE i.paid_at IS NULL
      AND i.due_date IN (${targetDates.map(() => '?').join(',')})
  `).all(...targetDates) as Array<{
    id: number; due_date: string; period_number: number;
    customer_name: string; customer_id: number
  }>

  const subscriptions = db.prepare('SELECT * FROM push_subscriptions').all() as Array<{
    id: number; endpoint: string; p256dh: string; auth: string
  }>

  let sent = 0
  const goneEndpoints: string[] = []

  for (const inst of installments) {
    const daysUntil = Math.round(
      (new Date(inst.due_date).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24)
    )
    const daysBefore = daysUntil === 4 ? 4 : daysUntil === 2 ? 2 : null
    if (!daysBefore) continue

    // Idempotency check
    const alreadySent = db.prepare(`
      INSERT OR IGNORE INTO notification_log (installment_id, days_before)
      VALUES (?, ?)
    `).run(inst.id, daysBefore)

    if (alreadySent.changes === 0) continue // already sent

    const payload = {
      title: 'NINI 付款提醒',
      body: `${inst.customer_name} 的第 ${inst.period_number} 期款項將於 ${daysBefore} 天後到期`,
      url: `/customers/${inst.customer_id}`,
      tag: `installment-${inst.id}-${daysBefore}d`,
    }

    for (const sub of subscriptions) {
      const result = await sendPushNotification(sub, payload)
      if (result.gone) {
        goneEndpoints.push(sub.endpoint)
      } else if (result.success) {
        sent++
      }
    }
  }

  // Clean up expired subscriptions
  for (const ep of goneEndpoints) {
    db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(ep)
  }

  return NextResponse.json({ sent, cleaned: goneEndpoints.length })
}
