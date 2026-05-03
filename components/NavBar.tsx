'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const tabs = [
  { href: '/',            label: '總覽',  icon: '⊡' },
  { href: '/checkout',    label: '結帳',  icon: '⊟' },
  { href: '/clients',     label: '客人',  icon: '⊛' },
  { href: '/packages',    label: '套組',  icon: '⊕' },
  { href: '/installments',label: '分期',  icon: '⊘' },
  { href: '/expenses',    label: '支出',  icon: '⊖' },
  { href: '/reports',     label: '報表',  icon: '⊜' },
]

export default function NavBar() {
  const pathname = usePathname()
  const router = useRouter()

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <>
      {/* Top header */}
      <header style={{ background: '#faf8f5', borderBottom: '1px solid #e0d9d0' }}
        className="sticky top-0 z-40">
        <div className="max-w-xl mx-auto px-5 h-11 flex items-center justify-between">
          <span style={{ color: '#9a8f84', fontSize: '0.7rem', letterSpacing: '0.15em' }}>
            NINI の 療癒所　管理系統
          </span>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
            <Link href="/export"
              style={{ color: '#c4b8aa', fontSize: '0.68rem', letterSpacing: '0.06em' }}>
              匯出
            </Link>
            <Link href="/import"
              style={{ color: '#c4b8aa', fontSize: '0.68rem', letterSpacing: '0.06em' }}>
              匯入
            </Link>
            <button onClick={handleLogout}
              style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                color: '#c4b8aa', fontSize: '0.68rem', letterSpacing: '0.06em',
              }}>
              登出
            </button>
          </div>
        </div>
      </header>

      {/* Bottom tab bar */}
      <nav style={{ background: '#faf8f5', borderTop: '1px solid #e0d9d0' }}
        className="fixed bottom-0 left-0 right-0 z-40 pb-safe">
        <div className="max-w-xl mx-auto grid grid-cols-7">
          {tabs.map(t => {
            const active = isActive(t.href)
            return (
              <Link key={t.href} href={t.href}
                style={{ color: active ? '#2c2825' : '#b4aa9e' }}
                className="flex flex-col items-center py-2 gap-0.5 transition-colors">
                <span style={{ fontSize: '1rem' }}>{t.icon}</span>
                <span style={{
                  fontSize: '0.6rem', letterSpacing: '0.04em',
                  fontWeight: active ? 500 : 400,
                  borderBottom: active ? '1px solid #6b5f54' : 'none',
                  paddingBottom: active ? '1px' : '2px',
                }}>
                  {t.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
