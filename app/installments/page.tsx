'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import MembershipBadge from '@/components/MembershipBadge'
import { MembershipLevel } from '@/types'

interface ContractRow {
  id: number
  client_id: number
  client_name: string
  client_level: MembershipLevel
  total_amount: number
  payment_method: string
  total_periods: number
  is_completed: number
  unpaid_count: number
  next_due_date: string | null
  remaining_amount: number
  note: string | null
  created_at: string
}

const fmtAmt = (n: number) => `$ ${n.toLocaleString()}`
const fmtShort = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })

function today() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
}

export default function InstallmentsPage() {
  const [contracts, setContracts] = useState<ContractRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'active' | 'all'>('active')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/contracts?status=${filter}`)
      .then(r => r.json())
      .then(data => { setContracts(data); setLoading(false) })
  }, [filter])

  const todayStr = today()

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between pt-2">
        <h1 style={{ color: '#2c2825', fontSize: '1.4rem', letterSpacing: '0.05em', fontWeight: 500 }}>
          分期
        </h1>
        <Link href="/installments/new">
          <button style={{
            background: '#2c2825', color: '#f7f4ef', border: 'none',
            borderRadius: '5px', fontSize: '0.8rem', letterSpacing: '0.06em',
          }} className="px-4 py-2">
            ＋ 新增
          </button>
        </Link>
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: '6px' }}>
        {(['active', 'all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{
              background: filter === f ? '#2c2825' : '#f0ebe4',
              color: filter === f ? '#f7f4ef' : '#6b5f54',
              border: 'none', borderRadius: '4px',
              fontSize: '0.78rem', padding: '5px 14px', cursor: 'pointer',
            }}>
            {f === 'active' ? '進行中' : '全部'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: '#c4b8aa', textAlign: 'center', padding: '40px 0', fontSize: '0.85rem' }}>
          載入中…
        </div>
      ) : contracts.length === 0 ? (
        <div style={{ color: '#c4b8aa', textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: '1.8rem', marginBottom: '10px' }}>— 無 —</div>
          <p style={{ fontSize: '0.85rem', letterSpacing: '0.08em' }}>目前無分期合約</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p style={{ color: '#9a8f84', fontSize: '0.72rem', letterSpacing: '0.08em' }}>
            共 {contracts.length} 件
          </p>
          {contracts.map(c => {
            const isOverdue = c.next_due_date && c.next_due_date < todayStr && !c.is_completed
            return (
              <Link key={c.id} href={`/clients/${c.client_id}`}>
                <div style={{
                  background: '#faf8f5',
                  border: `1px solid ${isOverdue ? '#c9a882' : '#e0d9d0'}`,
                  borderRadius: '6px',
                }} className="p-4 hover:opacity-80 transition-opacity">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ color: '#2c2825', fontSize: '1rem' }}>{c.client_name}</span>
                        <MembershipBadge tier={c.client_level} />
                        {c.is_completed ? (
                          <span style={{ color: '#4a6b52', fontSize: '0.68rem', background: '#edf3eb', border: '1px solid #9ab89e', borderRadius: '4px', padding: '1px 6px' }}>
                            完成
                          </span>
                        ) : null}
                      </div>
                      <div style={{ color: '#9a8f84', fontSize: '0.78rem', marginTop: '4px' }}>
                        {c.payment_method}　{c.total_periods} 期
                        {c.note && `　${c.note}`}
                      </div>
                      {!c.is_completed && c.next_due_date && (
                        <div style={{ color: isOverdue ? '#9a4a4a' : '#6b5f54', fontSize: '0.78rem', marginTop: '2px' }}>
                          下期 {fmtShort(c.next_due_date)}　剩 {c.unpaid_count} 期
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', shrink: '0' } as React.CSSProperties}>
                      <div style={{ color: '#2c2825', fontSize: '1rem', fontWeight: 500 }}>
                        {fmtAmt(c.total_amount)}
                      </div>
                      {c.remaining_amount > 0 && (
                        <div style={{ color: '#9a6a4a', fontSize: '0.78rem', marginTop: '2px' }}>
                          剩 {fmtAmt(c.remaining_amount)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
