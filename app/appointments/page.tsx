'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ClientWithStats, MembershipLevel } from '@/types'
import MembershipBadge from '@/components/MembershipBadge'

interface Appt {
  id: number
  client_id: number
  client_name: string
  client_level: string
  date: string
  time: string | null
  note: string | null
}

// ── 日期工具 ──────────────────────────────────────────────────────────────────
function toTaipei(d: Date) {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
}
function todayStr() {
  return toTaipei(new Date())
}
// 取得該日期所在週的週一
function weekStart(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const dow = d.getDay() // 0=Sun
  const diff = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + diff)
  return toTaipei(d)
}
function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return toTaipei(d)
}
function fmtDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('zh-TW', {
    month: 'numeric', day: 'numeric', weekday: 'short',
  })
}
function fmtMonth(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`
}

const DAY_NAMES = ['一', '二', '三', '四', '五', '六', '日']
const LEVEL_COLOR: Record<string, string> = {
  '一般': '#9a8f84', '銀': '#7a8a9a', '金': '#9a7a00', '黑金': '#2c2825',
}

export default function AppointmentsPage() {
  const today = todayStr()
  const [weekMon, setWeekMon] = useState(() => weekStart(today))
  const [appts, setAppts]     = useState<Appt[]>([])
  const [loading, setLoading] = useState(false)

  // 新增表單
  const [addDay, setAddDay]         = useState<string | null>(null)
  const [addTime, setAddTime]       = useState('')
  const [addNote, setAddNote]       = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [clientSearch, setClientSearch]   = useState('')
  const [clientResults, setClientResults] = useState<ClientWithStats[]>([])
  const [selClient, setSelClient]         = useState<ClientWithStats | null>(null)

  const weekEnd = addDays(weekMon, 6)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekMon, i))

  // 抓這週的預約
  const fetchWeek = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/appointments?from=${weekMon}&to=${weekEnd}`)
    setAppts(await res.json())
    setLoading(false)
  }, [weekMon, weekEnd])

  useEffect(() => { fetchWeek() }, [fetchWeek])

  // 客人搜尋
  useEffect(() => {
    if (selClient) return
    if (!clientSearch) { setClientResults([]); return }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/clients?q=${encodeURIComponent(clientSearch)}`)
      setClientResults(await r.json())
    }, 250)
    return () => clearTimeout(t)
  }, [clientSearch, selClient])

  function prevWeek() { setWeekMon(addDays(weekMon, -7)) }
  function nextWeek() { setWeekMon(addDays(weekMon, 7)) }
  function thisWeek() { setWeekMon(weekStart(today)) }

  function openAdd(day: string) {
    setAddDay(day); setAddTime(''); setAddNote(''); setSelClient(null); setClientSearch('')
  }
  function closeAdd() { setAddDay(null) }

  async function submitAdd() {
    if (!selClient || !addDay) return
    setAddLoading(true)
    await fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: selClient.id, date: addDay, time: addTime || null, note: addNote || null }),
    })
    setAddLoading(false)
    closeAdd()
    fetchWeek()
  }

  async function deleteAppt(id: number) {
    if (!confirm('確定刪除這筆預約？')) return
    await fetch(`/api/appointments/${id}`, { method: 'DELETE' })
    fetchWeek()
  }

  // 今天在不在這週
  const isThisWeek = weekMon <= today && today <= weekEnd
  // 這週月份標題
  const monthLabel = fmtMonth(weekMon) === fmtMonth(weekEnd)
    ? fmtMonth(weekMon)
    : `${fmtMonth(weekMon)} ─ ${fmtMonth(weekEnd)}`

  return (
    <div className="space-y-4">
      {/* ── 標題列 ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px' }}>
        <h1 style={{ color: '#2c2825', fontSize: '1.1rem', fontWeight: 500 }}>📅 預約總覽</h1>
        <span style={{ color: '#9a8f84', fontSize: '0.75rem' }}>{monthLabel}</span>
      </div>

      {/* ── 週導覽 ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button onClick={prevWeek} style={navBtn}>‹ 上週</button>
        {!isThisWeek && (
          <button onClick={thisWeek} style={{ ...navBtn, background: '#2c2825', color: '#f7f4ef' }}>本週</button>
        )}
        <div style={{ flex: 1 }} />
        <button onClick={nextWeek} style={navBtn}>下週 ›</button>
      </div>

      {/* ── 每天的預約 ── */}
      {loading ? (
        <p style={{ color: '#b4aa9e', fontSize: '0.82rem', textAlign: 'center', padding: '20px 0' }}>載入中…</p>
      ) : (
        <div className="space-y-2">
          {days.map((day, i) => {
            const dayAppts = appts.filter(a => a.date === day).sort((a, b) => {
              if (!a.time && !b.time) return 0
              if (!a.time) return 1
              if (!b.time) return -1
              return a.time.localeCompare(b.time)
            })
            const isToday = day === today
            const isPast  = day < today
            const isAddingHere = addDay === day

            return (
              <div key={day}
                style={{
                  border: `1px solid ${isToday ? '#c4622d' : '#e0d9d0'}`,
                  borderRadius: '8px',
                  background: isToday ? '#fff8f5' : isPast ? '#faf8f5' : '#fff',
                  overflow: 'hidden',
                  opacity: isPast && !isToday ? 0.75 : 1,
                }}>
                {/* 日期 header */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: isToday ? '#fef0ea' : 'transparent',
                  borderBottom: dayAppts.length > 0 || isAddingHere ? '1px solid #f0ebe4' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontSize: '0.72rem', fontWeight: isToday ? 700 : 400,
                      color: isToday ? '#c4622d' : '#2c2825',
                    }}>
                      {`週${DAY_NAMES[i]}`}
                    </span>
                    <span style={{
                      fontSize: '0.78rem', color: isToday ? '#c4622d' : isPast ? '#b4aa9e' : '#6b5f54',
                      fontWeight: isToday ? 600 : 400,
                    }}>
                      {new Date(day + 'T00:00:00').toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}
                    </span>
                    {isToday && (
                      <span style={{ fontSize: '0.62rem', background: '#c4622d', color: '#fff', borderRadius: '10px', padding: '1px 7px' }}>今天</span>
                    )}
                    {dayAppts.length > 0 && (
                      <span style={{ fontSize: '0.62rem', background: '#edf3eb', color: '#4a6b52', borderRadius: '10px', padding: '1px 7px' }}>
                        {dayAppts.length} 位
                      </span>
                    )}
                  </div>
                  <button type="button" onClick={() => isAddingHere ? closeAdd() : openAdd(day)}
                    style={{ fontSize: '0.7rem', color: isAddingHere ? '#9a4a4a' : '#9a8f84', background: 'none', border: '1px dashed #d9d0c5', borderRadius: '10px', padding: '2px 10px', cursor: 'pointer' }}>
                    {isAddingHere ? '取消' : '＋ 新增'}
                  </button>
                </div>

                {/* 新增表單 */}
                {isAddingHere && (
                  <div style={{ padding: '10px 12px', background: '#faf8f5', borderBottom: dayAppts.length > 0 ? '1px solid #f0ebe4' : 'none' }}>
                    {/* 客人搜尋 */}
                    {!selClient ? (
                      <div style={{ position: 'relative', marginBottom: '8px' }}>
                        <input value={clientSearch} onChange={e => setClientSearch(e.target.value)}
                          placeholder="搜尋客人名字…"
                          style={{ width: '100%', border: '1px solid #e0d9d0', borderRadius: '6px', padding: '7px 12px', fontSize: '0.82rem', background: '#fff', color: '#2c2825', outline: 'none', boxSizing: 'border-box' }} />
                        {clientResults.length > 0 && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e0d9d0', borderRadius: '0 0 6px 6px', zIndex: 20 }}>
                            {clientResults.map(c => (
                              <button key={c.id} type="button"
                                onClick={() => { setSelClient(c); setClientSearch(c.name); setClientResults([]) }}
                                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'none', border: 'none', borderBottom: '1px solid #f0ebe4', cursor: 'pointer', textAlign: 'left' }}>
                                <span style={{ color: '#2c2825', fontSize: '0.82rem' }}>{c.name}</span>
                                <MembershipBadge tier={c.level as MembershipLevel} />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', background: '#f0ebe4', borderRadius: '6px', padding: '6px 10px' }}>
                        <span style={{ color: '#2c2825', fontSize: '0.82rem', flex: 1 }}>{selClient.name}</span>
                        <MembershipBadge tier={selClient.level as MembershipLevel} />
                        <button type="button" onClick={() => { setSelClient(null); setClientSearch('') }}
                          style={{ color: '#9a8f84', background: 'none', border: 'none', fontSize: '0.75rem', cursor: 'pointer' }}>更換</button>
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                      <div>
                        <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '3px' }}>時段</label>
                        <input value={addTime} onChange={e => setAddTime(e.target.value)}
                          type="time"
                          style={{ width: '100%', border: '1px solid #e0d9d0', borderRadius: '6px', padding: '6px 10px', fontSize: '0.82rem', background: '#fff', color: '#2c2825', outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '3px' }}>備註</label>
                        <input value={addNote} onChange={e => setAddNote(e.target.value)}
                          placeholder="選填"
                          style={{ width: '100%', border: '1px solid #e0d9d0', borderRadius: '6px', padding: '6px 10px', fontSize: '0.82rem', background: '#fff', color: '#2c2825', outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                    </div>
                    <button onClick={submitAdd} disabled={!selClient || addLoading}
                      style={{ width: '100%', background: selClient ? '#2c2825' : '#c4b8aa', color: '#f7f4ef', border: 'none', borderRadius: '5px', fontSize: '0.82rem', padding: '7px', cursor: selClient ? 'pointer' : 'not-allowed' }}>
                      {addLoading ? '新增中…' : '確認新增'}
                    </button>
                  </div>
                )}

                {/* 預約列表 */}
                {dayAppts.map((a, ai) => (
                  <div key={a.id} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 12px',
                    borderBottom: ai < dayAppts.length - 1 ? '1px solid #f5f2ee' : 'none',
                  }}>
                    {/* 時間 */}
                    <div style={{ minWidth: '38px', textAlign: 'center' }}>
                      {a.time ? (
                        <span style={{ fontSize: '0.72rem', color: '#6b5f54', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{a.time}</span>
                      ) : (
                        <span style={{ fontSize: '0.65rem', color: '#c4b8aa' }}>—</span>
                      )}
                    </div>
                    {/* 客人 */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Link href={`/clients/${a.client_id}`}
                          style={{ color: LEVEL_COLOR[a.client_level] ?? '#2c2825', fontSize: '0.88rem', fontWeight: 500, textDecoration: 'none' }}>
                          {a.client_name}
                        </Link>
                        <MembershipBadge tier={a.client_level as MembershipLevel} />
                      </div>
                      {a.note && <p style={{ color: '#9a8f84', fontSize: '0.72rem', margin: 0, marginTop: '1px' }}>{a.note}</p>}
                    </div>
                    {/* 刪除 */}
                    <button onClick={() => deleteAppt(a.id)}
                      style={{ color: '#c4b8aa', background: 'none', border: 'none', fontSize: '1rem', cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}>
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const navBtn: React.CSSProperties = {
  background: '#f0ebe4', color: '#6b5f54', border: 'none',
  borderRadius: '5px', fontSize: '0.78rem', padding: '5px 14px', cursor: 'pointer',
}
