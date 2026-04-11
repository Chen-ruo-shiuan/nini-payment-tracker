import Link from 'next/link'
import MembershipBadge from '@/components/MembershipBadge'
import PushSubscribeButton from '@/components/PushSubscribeButton'
import { MembershipLevel, DashboardInstallment } from '@/types'

interface DashboardData {
  todayDue: DashboardInstallment[]
  weekDue: DashboardInstallment[]
  overdue: DashboardInstallment[]
  totalClients: number
  activeContracts: number
  totalOutstanding: number
}

async function getDashboard(): Promise<DashboardData> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/dashboard`, { cache: 'no-store' })
    return res.json()
  } catch {
    return { todayDue: [], weekDue: [], overdue: [], totalClients: 0, activeContracts: 0, totalOutstanding: 0 }
  }
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('zh-TW', {
    month: 'long', day: 'numeric', weekday: 'short',
  })
}

function formatAmount(n: number) {
  return `$ ${n.toLocaleString()}`
}

function Section({ label, items, urgent }: { label: string; items: DashboardInstallment[]; urgent?: boolean }) {
  if (!items.length) return null
  return (
    <section className="space-y-2">
      <p style={{ color: '#9a8f84', fontSize: '0.7rem', letterSpacing: '0.12em' }} className="uppercase">
        {label}
      </p>
      {items.map(item => (
        <Link key={item.id} href={`/clients/${item.client_id}`}>
          <div style={{
            background: '#faf8f5',
            border: `1px solid ${urgent ? '#c9a882' : '#e0d9d0'}`,
            borderRadius: '6px',
          }} className="p-4 hover:opacity-80 transition-opacity">
            <div className="flex items-center justify-between">
              <div>
                <div style={{ color: '#2c2825', fontSize: '1rem' }}>{item.client_name}</div>
                <div style={{ color: '#9a8f84', fontSize: '0.78rem', marginTop: '2px' }}>
                  第 {item.period_number} 期　{formatDate(item.due_date)}
                </div>
              </div>
              <div className="text-right space-y-1">
                <div style={{ color: urgent ? '#9a6a4a' : '#4a6b52', fontSize: '1.05rem', fontWeight: 500 }}>
                  {formatAmount(item.amount)}
                </div>
                <MembershipBadge tier={item.client_level as MembershipLevel} />
              </div>
            </div>
          </div>
        </Link>
      ))}
    </section>
  )
}

export default async function Dashboard() {
  const { todayDue, weekDue, overdue, totalClients, activeContracts, totalOutstanding } = await getDashboard()
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

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        {[
          { label: '客人數', value: `${totalClients} 位` },
          { label: '進行中分期', value: `${activeContracts} 件` },
          { label: '未收款總額', value: `$ ${totalOutstanding.toLocaleString()}` },
        ].map(({ label, value }) => (
          <div key={label} style={{
            background: '#faf8f5', border: '1px solid #e0d9d0',
            borderRadius: '5px', padding: '10px', textAlign: 'center',
          }}>
            <div style={{ color: '#9a8f84', fontSize: '0.65rem', letterSpacing: '0.06em' }}>{label}</div>
            <div style={{ color: '#2c2825', fontSize: '0.9rem', fontWeight: 500, marginTop: '2px' }}>{value}</div>
          </div>
        ))}
      </div>

      <Section label="已逾期" items={overdue} urgent />
      <Section label="今日到期" items={todayDue} urgent />
      <Section label="本週到期" items={weekDue} />

      {total === 0 && (
        <div className="text-center py-16" style={{ color: '#c4b8aa' }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>— 無 —</div>
          <p style={{ fontSize: '0.85rem', letterSpacing: '0.08em' }}>本週沒有待繳款項</p>
          <Link href="/installments/new"
            style={{ color: '#9a8f84', fontSize: '0.8rem', marginTop: '16px', display: 'inline-block' }}
            className="underline underline-offset-4">
            新增分期合約
          </Link>
        </div>
      )}
    </div>
  )
}
