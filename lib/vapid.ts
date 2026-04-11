import webpush from 'web-push'

let initialized = false

export function initVapid() {
  if (initialized) return
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:nini@example.com',
    process.env.VAPID_PUBLIC_KEY || '',
    process.env.VAPID_PRIVATE_KEY || ''
  )
  initialized = true
}

export async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: {
    title: string
    body: string
    url: string
    tag: string
  }
) {
  initVapid()
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify(payload)
    )
    return { success: true }
  } catch (err: unknown) {
    const error = err as { statusCode?: number; message?: string }
    if (error.statusCode === 410) {
      return { success: false, gone: true }
    }
    console.error('Push notification error:', error.message)
    return { success: false, gone: false }
  }
}
