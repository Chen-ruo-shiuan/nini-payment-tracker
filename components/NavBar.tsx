'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function NavBar() {
  const pathname = usePathname()
  const links = [
    { href: '/', label: '總覽' },
    { href: '/customers', label: '客人' },
    { href: '/customers/new', label: '新增' },
  ]
  return (
    <nav style={{ background: '#faf8f5', borderBottom: '1px solid #e0d9d0' }} className="sticky top-0 z-50">
      <div className="max-w-xl mx-auto px-5 flex items-center justify-between h-14">
        <span style={{ color: '#6b5f54', letterSpacing: '0.08em', fontSize: '0.95rem' }} className="font-medium">
          NINI の 療癒所
        </span>
        <div className="flex gap-1">
          {links.map(l => (
            <Link
              key={l.href}
              href={l.href}
              style={pathname === l.href
                ? { background: '#6b5f54', color: '#faf8f5' }
                : { color: '#9a8f84' }}
              className="px-3 py-1.5 rounded text-sm transition-colors hover:opacity-80"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}
