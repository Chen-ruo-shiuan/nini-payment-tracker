'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import MembershipBadge from '@/components/MembershipBadge'
import { MembershipLevel } from '@/types'

interface PkgRow {
  id: number; client_id: number; client_name: string; client_level: string
  service_name: string; total_sessions: number; used_sessions: number
  unit_price: number; prepaid_amount: number; payment_method: string
  date: string; note: string | null
}

const fmtAmt = (n: number) => `$ ${n.toLocaleString()}`
const fmtShort = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })

export default function PackagesPage() {
  const [packages, setPackages] = useState<PkgRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'active' | 'all'>('active')
  const [using, setUsing] = useState<number | null>(null)

  function load() {
    setLoading(true)
    fetch(`/api/packages?status=${filter}`)
      .then(r => r.json())
      .then(d => { setPackages(d); setLoading(false) })
  }
  useEffect(load, [filter])

  async function quickUse(pkg: PkgRow) {
    if (!confirm(`核銷「${pkg.client_name}｜${pkg.service_name}」一次？`)) return
    setUsing(pkg.id)
    await fetch(`/api/packages/${pkg.id}/use`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qty: 1 }),
    })
    setUsing(null)
    load()
  }

  async function undoUse(pkg: PkgRow) {
    if (!confirm(`取消「${pkg.client_name}｜${pkg.service_name}」最後一次核銷？`)) return
    setUsing(pkg.id)
    await fetch(`/api/packages/${pkg.id}/use`, { method: 'DELETE' })
    setUsing(null)
    load()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 style={{ color: '#2c2825', fontSize: '1.4rem', letterSpacing: '0.05em', fontWeight: 500 }}>套組</h1>
          <p style={{ color: '#9a8f84', fontSize: '0.78rem', marginTop: '2px' }}>
            {filter === 'active' ? '進行中套組' : '全部套組'}　共 {packages.length} 件
          </p>
        </div>
        <Link href="/packages/new">
          <button style={{ background: '#2c2825', color: '#f7f4ef', border: 'none', borderRadius: '5px', fontSize: '0.8rem' }}
            className="px-4 py-2">＋ 新增</button>
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
        <div style={{ color: '#c4b8aa', textAlign: 'center', padding: '40px 0', fontSize: '0.85rem' }}>載入中…</div>
      ) : packages.length === 0 ? (
        <div style={{ color: '#c4b8aa', textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: '1.8rem', marginBottom: '10px' }}>— 無 —</div>
          <p style={{ fontSize: '0.85rem' }}>{filter === 'active' ? '目前無進行中套組' : '尚無套組記錄'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {packages.map(pkg => {
            const remaining = pkg.total_sessions - pkg.used_sessions
            const pct = pkg.total_sessions > 0 ? (pkg.used_sessions / pkg.total_sessions) * 100 : 0
            const pending = pkg.prepaid_amount - pkg.used_sessions * pkg.unit_price

            return (
              <div key={pkg.id}
                style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '6px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link href={`/clients/${pkg.client_id}`}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ color: '#2c2825', fontSize: '0.95rem' }}>{pkg.client_name}</span>
                        {pkg.client_level && <MembershipBadge tier={pkg.client_level as MembershipLevel} />}
                      </div>
                    </Link>
                    <div style={{ color: '#6b5f54', fontSize: '0.85rem', marginTop: '2px' }}>{pkg.service_name}</div>
                    <div style={{ color: '#9a8f84', fontSize: '0.72rem', marginTop: '2px' }}>
                      {fmtShort(pkg.date)}　{pkg.payment_method}　{fmtAmt(pkg.prepaid_amount)}
                      {pkg.note && `　${pkg.note}`}
                    </div>
                    {/* Progress bar */}
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ background: '#f0ebe4', borderRadius: '4px', height: '5px' }}>
                        <div style={{
                          background: remaining > 0 ? '#9ab89e' : '#c4b8aa',
                          width: `${pct}%`, height: '100%', borderRadius: '4px',
                        }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}>
                        <span style={{ color: '#9a8f84', fontSize: '0.7rem' }}>
                          已用 {pkg.used_sessions} / {pkg.total_sessions} 次
                        </span>
                        {pending > 0 && (
                          <span style={{ color: '#9a6a4a', fontSize: '0.7rem' }}>待履行 {fmtAmt(pending)}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                    <div style={{
                      background: remaining > 0 ? '#edf3eb' : '#f0ebe4',
                      color: remaining > 0 ? '#4a6b52' : '#9a8f84',
                      fontSize: '0.9rem', fontWeight: 600,
                      padding: '4px 10px', borderRadius: '5px',
                    }}>
                      剩 {remaining} 次
                    </div>
                    {remaining > 0 && (
                      <button onClick={() => quickUse(pkg)} disabled={using === pkg.id}
                        style={{
                          background: '#2c2825', color: '#f7f4ef',
                          border: 'none', borderRadius: '4px',
                          fontSize: '0.75rem', padding: '5px 12px',
                          cursor: using === pkg.id ? 'not-allowed' : 'pointer',
                        }}>
                        核銷一次
                      </button>
                    )}
                    {pkg.used_sessions > 0 && (
                      <button onClick={() => undoUse(pkg)} disabled={using === pkg.id}
                        style={{
                          background: 'none', color: '#9a8f84',
                          border: '1px solid #e0d9d0', borderRadius: '4px',
                          fontSize: '0.7rem', padding: '3px 10px',
                          cursor: using === pkg.id ? 'not-allowed' : 'pointer',
                        }}>
                        取消
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
