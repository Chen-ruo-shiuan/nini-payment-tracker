import Link from 'next/link'
import MembershipBadge from '@/components/MembershipBadge'
import { MembershipTier } from '@/types'

interface CustomerRow {
  id: number
  name: string
  total_amount: number
  installment_amount: number
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
    <div className="space-y-6">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-2xl font-bold text-pink-700">客人列表</h1>
        <Link
          href="/customers/new"
          className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-full text-sm font-medium transition-colors"
        >
          ➕ 新增客人
        </Link>
      </div>

      {/* Active customers */}
      {active.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
            進行中 ({active.length})
          </h2>
          <div className="space-y-2">
            {active.map(c => (
              <Link key={c.id} href={`/customers/${c.id}`}>
                <div className="bg-white rounded-xl p-4 border border-pink-200 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-gray-800">{c.name}</div>
                      <div className="text-sm text-gray-500 mt-0.5">
                        已繳 {c.paid_count}/{c.total_periods} 期
                        {c.next_due_date && ` · 下期：${formatDate(c.next_due_date)}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-pink-600">
                        ${c.total_amount.toLocaleString()}
                      </div>
                      <MembershipBadge tier={c.membership_tier} />
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-3 bg-pink-100 rounded-full h-1.5">
                    <div
                      className="bg-pink-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${(c.paid_count / c.total_periods) * 100}%` }}
                    />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Completed customers */}
      {completed.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
            已完成 ({completed.length})
          </h2>
          <div className="space-y-2">
            {completed.map(c => (
              <Link key={c.id} href={`/customers/${c.id}`}>
                <div className="bg-white rounded-xl p-4 border border-gray-200 opacity-75 hover:opacity-100 transition-opacity">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-gray-700 flex items-center gap-1">
                        ✅ {c.name}
                      </div>
                      <div className="text-sm text-gray-500">全 {c.total_periods} 期已繳清</div>
                    </div>
                    <MembershipBadge tier={c.membership_tier} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {customers.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-3">👥</div>
          <p>還沒有客人</p>
          <Link href="/customers/new" className="mt-4 inline-block text-pink-500 underline text-sm">
            新增第一位客人
          </Link>
        </div>
      )}
    </div>
  )
}
