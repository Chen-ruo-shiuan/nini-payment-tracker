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
  return `$ ${n.toLocaleString()}`
}

function Section({ label, items, urgent }: { label: string; items: DashboardItem[]; urgent?: boolean }) {
  if (!items.length) return null
  return (
    <section className="space-y-2">
      <p style={{ color: '#9a8f84', fontSize: '0.7rem', letterSpacing: '0.12em' }} className="uppercase">
        {label}
      </p>
      {items.map(item => (
        <Link key={item.id} href={`/customers/${item.customer_id}`}>
          <div style={{
            background: '#faf8f5',
            border: `1px solid ${urgent ? '#c9a882' : '#e0d9d0'}`,
            borderRadius: '6px',
          }} className="p-4 hover:opacity-80 transition-opacity">
            <div className="flex items-center justify-between">
              <div>
                <div style={{ color: '#2c2825', fontSize: '1rem' }}>{item.customer_name}</div>
                <div style={{ color: '#9a8f84', fontSize: '0.78rem', marginTop: '2px' }}>
                  第 {item.period_number} 期　{formatDate(item.due_date)}
                </div>
              </div>
              <div className="text-right space-y-1">
                <div style={{ color: urgent ? '#9a6a4a' : '#4a6b52', fontSize: '1.05rem', fontWeight: 500 }}>
                  {formatAmount(item.amount)}
                </div>
                <MembershipBadge tier={item.membership_tier} />
              </div>
            </div>
          </div>
        </Link>
      ))}
    </section>
  )
}

export default async function Dashboard() {
  const { todayDue, weekDue, overdue } = await getDashboard()
  const total = todayDue.length + weekDue.length + overdue.length

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between pt-2">
        <div>
          <h1 style={{ color: '#2c2825', fontSize: '1.4rem', letterSpacing: '0.05em', fontWeight: 500 }}>
            付款總覽
          </h1>
          <p style={{ color: '#9a8f84', fontSize: '0.8rem', marginTop: '4px' }}>
            {total === 0 ? '本週無待繳款項' : `共 ${total} 筆待繳`}
          </p>
        </div>
        <PushSubscribeButton />
      </div>

      <Section label="已逾期" items={overdue} urgent />
      <Section label="今日到期" items={todayDue} urgent />
      <Section label="本週到期" items={weekDue} />

      {total === 0 && (
        <div className="text-center py-20" style={{ color: '#c4b8aa' }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>— 無 —</div>
          <p style={{ fontSize: '0.85rem', letterSpacing: '0.08em' }}>本週沒有待繳款項</p>
          <Link href="/customers/new"
            style={{ color: '#9a8f84', fontSize: '0.8rem', marginTop: '16px', display: 'inline-block' }}
            className="underline underline-offset-4">
            新增客人
          </Link>
        </div>
      )}
    </div>
  )
}
