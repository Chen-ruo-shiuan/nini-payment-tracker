import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import NavBar from '@/components/NavBar'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'NINI 分期管理',
  description: 'NINIの皮膚療癒所 — 客人分期繳納系統',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'NINI 分期',
  },
}

export const viewport: Viewport = {
  themeColor: '#f9a8d4',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className={`${geist.className} bg-pink-50 min-h-screen`}>
        <NavBar />
        <main className="max-w-2xl mx-auto px-4 pb-20 pt-4">
          {children}
        </main>
      </body>
    </html>
  )
}
