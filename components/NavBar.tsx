'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function NavBar() {
  const pathname = usePathname()
  const links = [
    { href: '/', label: '首頁', icon: '🏠' },
    { href: '/customers', label: '客人', icon: '👥' },
    { href: '/customers/new', label: '新增', icon: '➕' },
  ]
  return (
    <nav className="bg-white border-b border-pink-200 sticky top-0 z-50">
      <div className="max-w-2xl mx-auto px-4 flex items-center justify-between h-14">
        <span className="font-bold text-pink-600 text-lg">🌸 NINI 分期</span>
        <div className="flex gap-1">
          {links.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                ${pathname === l.href
                  ? 'bg-pink-500 text-white'
                  : 'text-pink-600 hover:bg-pink-100'}`}
            >
              {l.icon} {l.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}
