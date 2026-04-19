'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import MembershipBadge from '@/components/MembershipBadge'
import { ClientWithStats, MembershipLevel, MEMBERSHIP_LEVELS } from '@/types'

function formatAmount(n: number) {
  return `$ ${n.toLocaleString()}`
}

const ALL_LEVELS = ['全部', ...MEMBERSHIP_LEVELS] as const

function daysUntilBirthday(mmdd: string): number {
  const [mm, dd] = mmdd.split('-').map(Number)
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
  const today = new Date(todayStr + 'T00:00:00')
  let bday = new Date(today.getFullYear(), mm - 1, dd)
  if (bday < today) bday = new Date(today.getFullYear() + 1, mm - 1, dd)
  return Math.round((bday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function ClientCard({ client, onDelete, showBirthday }: {
  client: ClientWithStats; onDelete: (id: number) => void; showBirthday?: boolean
}) {
  const days = showBirthday && client.birthday ? daysUntilBirthday(client.birthday) : null
  const [mm, dd] = client.birthday ? client.birthday.split('-') : []

  return (
    <div style={{ display: 'flex', background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '6px' }}>
      {/* Main clickable area */}
      <Link href={`/clients/${client.id}`} style={{ flex: 1, minWidth: 0, padding: '14px 16px' }}
        className="hover:opacity-80 transition-opacity">
        <div className="flex items-center gap-2 flex-wrap">
          <span style={{ color: '#2c2825', fontSize: '1rem' }}>{client.name}</span>
          <MembershipBadge tier={client.level as MembershipLevel} />
        </div>
        {client.phone && (
          <div style={{ color: '#9a8f84', fontSize: '0.78rem', marginTop: '2px' }}>{client.phone}</div>
        )}
        {showBirthday && client.birthday && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
            <span style={{ color: '#9a4a7a', fontSize: '0.8rem' }}>🎂 {Number(mm)} 月 {Number(dd)} 日</span>
            <span style={{
              fontSize: '0.72rem',
              color: days === 0 ? '#c4622d' : days !== null && days <= 7 ? '#9a6a4a' : '#9a8f84',
              fontWeight: days !== null && days <= 7 ? 600 : 400,
            }}>
              {days === 0 ? '🎉 今天！' : days !== null ? `還有 ${days} 天` : ''}
            </span>
          </div>
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
      </Link>

      {/* Right column: next due date + delete — separate from the link */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', padding: '10px 10px 10px 0', flexShrink: 0, gap: '6px' }}>
        {client.next_due_date ? (
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#9a8f84', fontSize: '0.68rem' }}>下期到期</div>
            <div style={{ color: '#9a6a4a', fontSize: '0.8rem' }}>
              {new Date(client.next_due_date + 'T00:00:00').toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}
            </div>
          </div>
        ) : <div />}
        <button
          onClick={() => onDelete(client.id)}
          style={{ color: '#c4b8aa', background: 'none', border: '1px solid #e0d9d0', borderRadius: '4px', fontSize: '0.68rem', padding: '2px 8px', cursor: 'pointer' }}>
          刪除
        </button>
      </div>
    </div>
  )
}

const currentMonth = new Date().getMonth() + 1

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientWithStats[]>([])
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState<string>('全部')
  const [birthdayMonth, setBirthdayMonth] = useState<number>(currentMonth)
  const [loading, setLoading] = useState(true)

  const isBirthdayMode = levelFilter === '壽星'

  const fetchClients = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (isBirthdayMode) {
        params.set('birthday_month', String(birthdayMonth))
      } else if (levelFilter !== '全部') {
        params.set('level', levelFilter)
      }
      const res = await fetch(`/api/clients?${params.toString()}`)
      const data: ClientWithStats[] = await res.json()
      // In birthday mode: sort by day within the month
      if (isBirthdayMode) {
        data.sort((a, b) => {
          const da = a.birthday ? Number(a.birthday.split('-')[1]) : 99
          const db = b.birthday ? Number(b.birthday.split('-')[1]) : 99
          return da - db
        })
      }
      setClients(data)
    } catch {
      setClients([])
    } finally {
      setLoading(false)
    }
  }, [search, levelFilter, birthdayMonth, isBirthdayMode])

  useEffect(() => {
    const t = setTimeout(fetchClients, 250)
    return () => clearTimeout(t)
  }, [fetchClients])

  async function deleteClient(id: number) {
    const client = clients.find(c => c.id === id)
    if (!confirm(`確定要刪除「${client?.name}」？此操作無法復原。`)) return
    await fetch(`/api/clients/${id}`, { method: 'DELETE' })
    setClients(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div className="space-y-4">
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

      {/* Level + Birthday filter */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {ALL_LEVELS.map(l => (
          <button key={l} onClick={() => setLevelFilter(l)}
            style={{
              background: levelFilter === l ? '#2c2825' : '#faf8f5',
              color: levelFilter === l ? '#f7f4ef' : '#6b5f54',
              border: `1px solid ${levelFilter === l ? '#2c2825' : '#e0d9d0'}`,
              borderRadius: '20px', fontSize: '0.75rem', padding: '4px 12px', cursor: 'pointer',
            }}>
            {l}
          </button>
        ))}
        <button onClick={() => setLevelFilter('壽星')}
          style={{
            background: isBirthdayMode ? '#9a4a7a' : '#faf8f5',
            color: isBirthdayMode ? '#f7f4ef' : '#9a4a7a',
            border: `1px solid ${isBirthdayMode ? '#9a4a7a' : '#d4a8c8'}`,
            borderRadius: '20px', fontSize: '0.75rem', padding: '4px 12px', cursor: 'pointer',
          }}>
          🎂 壽星
        </button>
      </div>

      {/* Birthday month selector */}
      {isBirthdayMode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fdf5fa', border: '1px solid #d4a8c8', borderRadius: '8px', padding: '10px 14px' }}>
          <span style={{ color: '#9a4a7a', fontSize: '0.78rem' }}>月份</span>
          <select value={birthdayMonth} onChange={e => setBirthdayMonth(Number(e.target.value))}
            style={{ background: '#fff', border: '1px solid #d4a8c8', borderRadius: '6px', color: '#2c2825', fontSize: '0.85rem', outline: 'none', padding: '4px 10px', cursor: 'pointer' }}>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>{i + 1} 月</option>
            ))}
          </select>
          <span style={{ color: '#9a8f84', fontSize: '0.75rem' }}>
            {birthdayMonth} 月壽星　共 {clients.length} 位
          </span>
        </div>
      )}

      {loading ? (
        <div style={{ color: '#c4b8aa', textAlign: 'center', padding: '40px 0', fontSize: '0.85rem' }}>
          載入中…
        </div>
      ) : clients.length === 0 ? (
        <div style={{ color: '#c4b8aa', textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: '1.8rem', marginBottom: '10px' }}>— 無 —</div>
          <p style={{ fontSize: '0.85rem', letterSpacing: '0.08em' }}>
            {isBirthdayMode
              ? `${birthdayMonth} 月沒有壽星`
              : search || levelFilter !== '全部' ? '找不到符合的客人' : '尚無客人資料'}
          </p>
          {!search && levelFilter === '全部' && (
            <Link href="/clients/new"
              style={{ color: '#9a8f84', fontSize: '0.8rem', marginTop: '12px', display: 'inline-block' }}
              className="underline underline-offset-4">
              新增第一位客人
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {!isBirthdayMode && (
            <p style={{ color: '#9a8f84', fontSize: '0.72rem', letterSpacing: '0.08em' }}>
              共 {clients.length} 位客人
            </p>
          )}
          {clients.map(c => (
            <ClientCard key={c.id} client={c} onDelete={deleteClient} showBirthday={isBirthdayMode} />
          ))}
        </div>
      )}
    </div>
  )
}
