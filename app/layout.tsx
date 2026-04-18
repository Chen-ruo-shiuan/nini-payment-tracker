import type { Metadata, Viewport } from 'next'
import { Noto_Serif_TC } from 'next/font/google'
import './globals.css'
import NavBar from '@/components/NavBar'

const notoSerif = Noto_Serif_TC({ subsets: ['latin'], weight: ['400', '500', '700'] })

export const metadata: Metadata = {
  title: 'NINI 分期',
  description: 'NINIの皮膚療癒所 — 客人分期繳納系統',
  manifest: '/manifest.json',
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'NINI 分期',
  },
}

export const viewport: Viewport = {
  themeColor: '#f7f4ef',
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
      <body className={notoSerif.className} style={{ background: '#f7f4ef', minHeight: '100vh' }}>
        <NavBar />
        <main className="max-w-xl mx-auto px-5 pb-28 pt-4">
          {children}
        </main>
      </body>
    </html>
  )
}
