import Link from 'next/link'
import MembershipBadge from '@/components/MembershipBadge'
import { MembershipTier } from '@/types'

interface CustomerRow {
  id: number
  name: string
  total_amount: number
  total_periods: number
  membership_tier: MembershipTier
  is_completed: number
  paid_count: number
  next_due_date: string | null
}

async function getCustomers(): Promise<CustomerRow[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/customers`, { cache: 'no-store' })
    return res.json()
  } catch {
    return []
  }
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' })
}

export default async function CustomersPage() {
  const customers = await getCustomers()
  const active = customers.filter(c => !c.is_completed)
  const completed = customers.filter(c => c.is_completed)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between pt-2">
        <h1 style={{ color: '#2c2825', fontSize: '1.4rem', letterSpacing: '0.05em', fontWeight: 500 }}>
          客人列表
        </h1>
        <Link href="/customers/new"
          style={{ background: '#6b5f54', color: '#faf8f5', fontSize: '0.8rem', letterSpacing: '0.05em' }}
          className="px-4 py-2 rounded transition-opacity hover:opacity-80">
          ＋ 新增
        </Link>
      </div>

      {active.length > 0 && (
        <section className="space-y-2">
          <p style={{ color: '#9a8f84', fontSize: '0.7rem', letterSpacing: '0.12em' }} className="uppercase">
            進行中 · {active.length}
          </p>
          {active.map(c => (
            <Link key={c.id} href={`/customers/${c.id}`}>
              <div style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '6px' }}
                className="p-4 hover:opacity-80 transition-opacity">
                <div className="flex items-center justify-between">
                  <div>
                    <div style={{ color: '#2c2825', fontSize: '1rem' }}>{c.name}</div>
                    <div style={{ color: '#9a8f84', fontSize: '0.78rem', marginTop: '2px' }}>
                      已繳 {c.paid_count}/{c.total_periods} 期
                      {c.next_due_date && `　下期 ${formatDate(c.next_due_date)}`}
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <div style={{ color: '#4a6b52', fontSize: '1rem', fontWeight: 500 }}>
                      $ {c.total_amount.toLocaleString()}
                    </div>
                    <MembershipBadge tier={c.membership_tier} />
                  </div>
                </div>
                {/* Progress */}
                <div style={{ background: '#e8e0d8', borderRadius: '99px', height: '2px', marginTop: '12px' }}>
                  <div style={{
                    background: '#9a8f84', height: '2px', borderRadius: '99px',
                    width: `${(c.paid_count / c.total_periods) * 100}%`,
                    transition: 'width 0.3s'
                  }} />
                </div>
              </div>
            </Link>
          ))}
        </section>
      )}

      {completed.length > 0 && (
        <section className="space-y-2">
          <p style={{ color: '#9a8f84', fontSize: '0.7rem', letterSpacing: '0.12em' }} className="uppercase">
            已完成 · {completed.length}
          </p>
          {completed.map(c => (
            <Link key={c.id} href={`/customers/${c.id}`}>
              <div style={{ background: '#f5f2ee', border: '1px solid #e0d9d0', borderRadius: '6px', opacity: 0.7 }}
                className="p-4 hover:opacity-100 transition-opacity">
                <div className="flex items-center justify-between">
                  <div style={{ color: '#6b5f54' }}>{c.name}</div>
                  <div className="flex items-center gap-2">
                    <span style={{ color: '#9a8f84', fontSize: '0.75rem' }}>全 {c.total_periods} 期完清</span>
                    <MembershipBadge tier={c.membership_tier} />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </section>
      )}

      {customers.length === 0 && (
        <div className="text-center py-20" style={{ color: '#c4b8aa' }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>— 無 —</div>
          <p style={{ fontSize: '0.85rem', letterSpacing: '0.08em' }}>尚無客人資料</p>
          <Link href="/customers/new"
            style={{ color: '#9a8f84', fontSize: '0.8rem', marginTop: '16px', display: 'inline-block' }}
            className="underline underline-offset-4">
            新增第一位客人
          </Link>
        </div>
      )}
    </div>
  )
}
