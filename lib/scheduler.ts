import cron from 'node-cron'

let started = false

export function initScheduler() {
  if (started) return
  started = true

  // Run every day at 09:00 Taiwan time
  cron.schedule(
    '0 9 * * *',
    async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const secret = process.env.CRON_SECRET || 'dev-secret'
        const res = await fetch(`${baseUrl}/api/cron/notify`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${secret}`,
            'Content-Type': 'application/json',
          },
        })
        const data = await res.json()
        console.log('[CRON] Notification job done:', data)
      } catch (err) {
        console.error('[CRON] Failed to run notification job:', err)
      }
    },
    { timezone: 'Asia/Taipei' }
  )

  console.log('[CRON] Scheduler initialized — daily at 09:00 Asia/Taipei')
}
