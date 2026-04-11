'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import MembershipBadge from '@/components/MembershipBadge'
import { ClientWithStats, MembershipLevel } from '@/types'

function formatAmount(n: number) {
  return `$ ${n.toLocaleString()}`
}

function ClientCard({ client }: { client: ClientWithStats }) {
  return (
    <Link href={`/clients/${client.id}`}>
      <div style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '6px' }}
        className="p-4 hover:opacity-80 transition-opacity">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span style={{ color: '#2c2825', fontSize: '1rem' }}>{client.name}</span>
              <MembershipBadge tier={client.level as MembershipLevel} />
            </div>
            {client.phone && (
              <div style={{ color: '#9a8f84', fontSize: '0.78rem', marginTop: '2px' }}>{client.phone}</div>
            )}
            <div className="flex gap-3 mt-2 flex-wrap">
              {client.active_contracts > 0 && (
                <span style={{ color: '#9a6a4a', fontSize: '0.72rem', background: '#fdf0e6', border: '1px solid #e8cba8', borderRadius: '4px' }}
                  className="px-2 py-0.5">
                  分期 {client.active_contracts} 件
                </span>
              )}
              {client.active_packages > 0 && (
                <span style={{ color: '#4a6b52', fontSize: '0.72rem', background: '#edf3eb', border: '1px solid #9ab89e', borderRadius: '4px' }}
                  className="px-2 py-0.5">
                  套組 {client.active_packages} 件
                </span>
              )}
              {client.stored_value > 0 && (
                <span style={{ color: '#5a4a6b', fontSize: '0.72rem', background: '#eeedf5', border: '1px solid #a89ab8', borderRadius: '4px' }}
                  className="px-2 py-0.5">
                  儲值 {formatAmount(client.stored_value)}
                </span>
              )}
            </div>
          </div>
          {client.next_due_date && (
            <div className="text-right shrink-0">
              <div style={{ color: '#9a8f84', fontSize: '0.68rem' }}>下期到期</div>
              <div style={{ color: '#9a6a4a', fontSize: '0.8rem' }}>
                {new Date(client.next_due_date + 'T00:00:00').toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientWithStats[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchClients = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/clients?q=${encodeURIComponent(search)}`)
      const data = await res.json()
      setClients(data)
    } catch {
      setClients([])
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    const t = setTimeout(fetchClients, 250)
    return () => clearTimeout(t)
  }, [fetchClients])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between pt-2">
        <h1 style={{ color: '#2c2825', fontSize: '1.4rem', letterSpacing: '0.05em', fontWeight: 500 }}>
          客人
        </h1>
        <Link href="/clients/new">
          <button style={{
            background: '#2c2825', color: '#f7f4ef', border: 'none',
            borderRadius: '5px', fontSize: '0.8rem', letterSpacing: '0.06em',
          }} className="px-4 py-2">
            ＋ 新增
          </button>
        </Link>
      </div>

      <input
        type="search"
        placeholder="搜尋客人姓名…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          width: '100%', background: '#faf8f5', border: '1px solid #e0d9d0',
          borderRadius: '6px', color: '#2c2825', fontSize: '0.9rem',
          outline: 'none', padding: '10px 14px',
        }}
      />

      {loading ? (
        <div style={{ color: '#c4b8aa', textAlign: 'center', padding: '40px 0', fontSize: '0.85rem' }}>
          載入中…
        </div>
      ) : clients.length === 0 ? (
        <div style={{ color: '#c4b8aa', textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: '1.8rem', marginBottom: '10px' }}>— 無 —</div>
          <p style={{ fontSize: '0.85rem', letterSpacing: '0.08em' }}>
            {search ? '找不到符合的客人' : '尚無客人資料'}
          </p>
          {!search && (
            <Link href="/clients/new"
              style={{ color: '#9a8f84', fontSize: '0.8rem', marginTop: '12px', display: 'inline-block' }}
              className="underline underline-offset-4">
              新增第一位客人
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p style={{ color: '#9a8f84', fontSize: '0.72rem', letterSpacing: '0.08em' }}>
            共 {clients.length} 位客人
          </p>
          {clients.map(c => <ClientCard key={c.id} client={c} />)}
        </div>
      )}
    </div>
  )
}
