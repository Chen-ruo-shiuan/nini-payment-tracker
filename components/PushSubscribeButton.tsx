'use client'
import { useState, useEffect } from 'react'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export default function PushSubscribeButton() {
  const [status, setStatus] = useState<'unknown' | 'subscribed' | 'denied' | 'unsupported'>('unknown')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported')
      return
    }
    navigator.serviceWorker.ready.then(async reg => {
      const sub = await reg.pushManager.getSubscription()
      if (sub) setStatus('subscribed')
      else if (Notification.permission === 'denied') setStatus('denied')
    })
  }, [])

  const subscribe = async () => {
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_KEY || ''
        ),
      })
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: {
            p256dh: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')!))),
            auth: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')!))),
          },
          userAgent: navigator.userAgent,
        }),
      })
      setStatus('subscribed')
    } catch {
      alert('無法開啟通知，請確認已允許通知權限')
    }
    setLoading(false)
  }

  const unsubscribe = async () => {
    setLoading(true)
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      })
      await sub.unsubscribe()
    }
    setStatus('unknown')
    setLoading(false)
  }

  if (status === 'unsupported') return null
  if (status === 'denied') return (
    <p className="text-sm text-red-500">⚠️ 通知已被封鎖，請到瀏覽器設定允許通知</p>
  )

  return status === 'subscribed' ? (
    <button
      onClick={unsubscribe}
      disabled={loading}
      className="text-sm text-gray-500 hover:text-red-500 underline"
    >
      {loading ? '處理中...' : '🔕 關閉推播通知'}
    </button>
  ) : (
    <button
      onClick={subscribe}
      disabled={loading}
      className="flex items-center gap-2 bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-full text-sm font-medium transition-colors"
    >
      {loading ? '開啟中...' : '🔔 開啟推播通知'}
    </button>
  )
}
