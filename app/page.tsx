import Link from 'next/link'
import MembershipBadge from '@/components/MembershipBadge'
import PushSubscribeButton from '@/components/PushSubscribeButton'
import { MembershipTier } from '@/types'

interface DashboardItem {
  id: number
  customer_id: number
  customer_name: string
  period_number: number
  due_date: string
  amount: number
  membership_tier: MembershipTier
}

interface DashboardData {
  todayDue: DashboardItem[]
  weekDue: DashboardItem[]
  overdue: DashboardItem[]
}

async function getDashboard(): Promise<DashboardData> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/dashboard`, { cache: 'no-store' })
    return res.json()
  } catch {
    return { todayDue: [], weekDue: [], overdue: [] }
  }
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('zh-TW', {
    month: 'long', day: 'numeric', weekday: 'short'
  })
}

function formatAmount(n: number) {
  return `$${n.toLocaleString()}`
}

function PaymentCard({ item, urgent }: { item: DashboardItem; urgent?: boolean }) {
  return (
    <Link href={`/customers/${item.customer_id}`}>
      <div className={`bg-white rounded-xl p-4 border ${urgent ? 'border-red-300' : 'border-pink-200'} hover:shadow-md transition-shadow`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-gray-800">{item.customer_name}</div>
            <div className="text-sm text-gray-500 mt-0.5">
              第 {item.period_number} 期 · {formatDate(item.due_date)}
            </div>
          </div>
          <div className="text-right">
            <div className={`font-bold text-lg ${urgent ? 'text-red-600' : 'text-pink-600'}`}>
              {formatAmount(item.amount)}
            </div>
            <MembershipBadge tier={item.membership_tier} />
          </div>
        </div>
      </div>
    </Link>
  )
}

export default async function Dashboard() {
  const { todayDue, weekDue, overdue } = await getDashboard()
  const total = todayDue.length + weekDue.length + overdue.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-2xl font-bold text-pink-700">付款總覽</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total === 0 ? '本週無待繳款項 🎉' : `共 ${total} 筆待繳`}
          </p>
        </div>
        <PushSubscribeButton />
      </div>

      {/* Overdue */}
      {overdue.length > 0 && (
        <section>
          <h2 className="text-base font-bold text-red-600 mb-2 flex items-center gap-1">
            ⚠️ 已逾期 ({overdue.length})
          </h2>
          <div className="space-y-2">
            {overdue.map(item => <PaymentCard key={item.id} item={item} urgent />)}
          </div>
        </section>
      )}

      {/* Today */}
      {todayDue.length > 0 && (
        <section>
          <h2 className="text-base font-bold text-orange-600 mb-2 flex items-center gap-1">
            🔴 今天到期 ({todayDue.length})
          </h2>
          <div className="space-y-2">
            {todayDue.map(item => <PaymentCard key={item.id} item={item} urgent />)}
          </div>
        </section>
      )}

      {/* This week */}
      {weekDue.length > 0 && (
        <section>
          <h2 className="text-base font-bold text-amber-600 mb-2 flex items-center gap-1">
            📅 本週到期 ({weekDue.length})
          </h2>
          <div className="space-y-2">
            {weekDue.map(item => <PaymentCard key={item.id} item={item} />)}
          </div>
        </section>
      )}

      {total === 0 && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-3">🌸</div>
          <p>本週沒有待繳款項</p>
          <Link href="/customers/new" className="mt-4 inline-block text-pink-500 underline text-sm">
            新增客人
          </Link>
        </div>
      )}
    </div>
  )
}
