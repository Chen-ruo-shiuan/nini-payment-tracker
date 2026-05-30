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

interface ClosedDay {
  date: string
  type: '公休' | '休假'
  note: string | null
}

// 常用時段
const QUICK_TIMES = ['11:00', '13:30', '16:00', '18:00']

// ── 日期工具 ──────────────────────────────────────────────────────────────────
function toTaipei(d: Date) {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
}
function todayStr() { return toTaipei(new Date()) }
function weekStart(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const dow = d.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + diff)
  return toTaipei(d)
}
function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return toTaipei(d)
}
function fmtMonth(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`
}

const DAY_NAMES = ['一', '二', '三', '四', '五', '六', '日']

const CLOSED_STYLES: Record<string, { bg: string; border: string; color: string; badge: string; badgeBg: string }> = {
  '公休': { bg: '#f5f2ee', border: '#d9d0c5', color: '#9a8f84', badge: '公休', badgeBg: '#e8e0d8' },
  '休假': { bg: '#fdf5f0', border: '#e8c4a8', color: '#9a6a40', badge: '休假', badgeBg: '#f5dcc8' },
}

export default function AppointmentsPage() {
  const today = todayStr()
  const [weekMon, setWeekMon] = useState(() => weekStart(today))
  const [appts, setAppts]       = useState<Appt[]>([])
  const [closedDays, setClosedDays] = useState<ClosedDay[]>([])
  const [loading, setLoading]   = useState(false)

  // 新增預約表單
  const [addDay, setAddDay]         = useState<string | null>(null)
  const [addTime, setAddTime]       = useState('')
  const [addNote, setAddNote]       = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [clientSearch, setClientSearch]   = useState('')
  const [clientResults, setClientResults] = useState<ClientWithStats[]>([])
  const [selClient, setSelClient]         = useState<ClientWithStats | null>(null)

  // 公休/休假設定
  const [closedMenuDay, setClosedMenuDay] = useState<string | null>(null)

  const weekEnd = addDays(weekMon, 6)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekMon, i))

  const fetchWeek = useCallback(async () => {
    setLoading(true)
    const [apptRes, closedRes] = await Promise.all([
      fetch(`/api/appointments?from=${weekMon}&to=${weekEnd}`),
      fetch(`/api/closed-days?from=${weekMon}&to=${weekEnd}`),
    ])
    setAppts(await apptRes.json())
    setClosedDays(await closedRes.json())
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
    setAddDay(day); setAddTime(''); setAddNote('')
    setSelClient(null); setClientSearch(''); setClientResults([])
    setClosedMenuDay(null)
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

  async function setClosedDay(date: string, type: '公休' | '休假' | null) {
    if (type === null) {
      await fetch(`/api/closed-days?date=${date}`, { method: 'DELETE' })
    } else {
      await fetch('/api/closed-days', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, type }),
      })
    }
    setClosedMenuDay(null)
    fetchWeek()
  }

  const isThisWeek = weekMon <= today && today <= weekEnd
  const monthLabel = fmtMonth(weekMon) === fmtMonth(weekEnd)
    ? fmtMonth(weekMon)
    : `${fmtMonth(weekMon)} ─ ${fmtMonth(weekEnd)}`

  const closedMap = Object.fromEntries(closedDays.map(c => [c.date, c]))

  return (
    <div className="space-y-4">
      {/* ── 標題 ── */}
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

      {/* ── 每天 ── */}
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
            const isToday      = day === today
            const isPast       = day < today
            const isAddingHere = addDay === day
            const closed       = closedMap[day]
            const cs           = closed ? CLOSED_STYLES[closed.type] : null
            const isClosedMenu = closedMenuDay === day

            return (
              <div key={day} style={{
                border: `1px solid ${isToday ? '#c4622d' : cs ? cs.border : '#e0d9d0'}`,
                borderRadius: '8px',
                background: cs ? cs.bg : isToday ? '#fff8f5' : isPast ? '#faf8f5' : '#fff',
                overflow: 'hidden',
                opacity: isPast && !isToday ? 0.78 : 1,
              }}>

                {/* ── 日期 header ── */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: isToday ? '#fef0ea' : cs ? cs.bg : 'transparent',
                  borderBottom: (dayAppts.length > 0 || isAddingHere || isClosedMenu) ? '1px solid #f0ebe4' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: isToday ? 700 : 400, color: isToday ? '#c4622d' : cs ? cs.color : '#2c2825' }}>
                      週{DAY_NAMES[i]}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: isToday ? '#c4622d' : isPast ? '#b4aa9e' : cs ? cs.color : '#6b5f54', fontWeight: isToday ? 600 : 400 }}>
                      {new Date(day + 'T00:00:00').toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}
                    </span>
                    {isToday && <span style={{ fontSize: '0.6rem', background: '#c4622d', color: '#fff', borderRadius: '10px', padding: '1px 7px' }}>今天</span>}
                    {cs && <span style={{ fontSize: '0.62rem', background: cs.badgeBg, color: cs.color, borderRadius: '10px', padding: '1px 8px', fontWeight: 500 }}>{cs.badge}</span>}
                    {!cs && dayAppts.length > 0 && (
                      <span style={{ fontSize: '0.62rem', background: '#edf3eb', color: '#4a6b52', borderRadius: '10px', padding: '1px 7px' }}>
                        {dayAppts.length} 位
                      </span>
                    )}
                  </div>

                  {/* 右側操作按鈕 */}
                  <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                    {/* 公休/休假 設定按鈕 */}
                    <button type="button"
                      onClick={() => { setClosedMenuDay(isClosedMenu ? null : day); closeAdd() }}
                      style={{ fontSize: '0.65rem', color: cs ? cs.color : '#b4aa9e', background: 'none', border: `1px solid ${cs ? cs.border : '#e0d9d0'}`, borderRadius: '8px', padding: '2px 8px', cursor: 'pointer' }}>
                      {cs ? '取消' : '休'}
                    </button>
                    {/* 新增預約 */}
                    {!cs && (
                      <button type="button"
                        onClick={() => isAddingHere ? closeAdd() : openAdd(day)}
                        style={{ fontSize: '0.7rem', color: isAddingHere ? '#9a4a4a' : '#9a8f84', background: 'none', border: '1px dashed #d9d0c5', borderRadius: '10px', padding: '2px 10px', cursor: 'pointer' }}>
                        {isAddingHere ? '取消' : '＋'}
                      </button>
                    )}
                  </div>
                </div>

                {/* ── 公休/休假 選單 ── */}
                {isClosedMenu && (
                  <div style={{ padding: '10px 12px', display: 'flex', gap: '8px', alignItems: 'center', background: '#faf8f5', borderBottom: '1px solid #f0ebe4' }}>
                    <span style={{ color: '#9a8f84', fontSize: '0.72rem' }}>標記為：</span>
                    {(['公休', '休假'] as const).map(t => (
                      <button key={t} type="button"
                        onClick={() => setClosedDay(day, closed?.type === t ? null : t)}
                        style={{
                          fontSize: '0.75rem', padding: '4px 14px', border: 'none', borderRadius: '5px', cursor: 'pointer',
                          background: closed?.type === t ? (t === '公休' ? '#9a8f84' : '#c4622d') : '#e0d9d0',
                          color: closed?.type === t ? '#fff' : '#6b5f54',
                          fontWeight: closed?.type === t ? 600 : 400,
                        }}>
                        {t === '公休' ? '🗓 公休日' : '🌴 休假日'}
                      </button>
                    ))}
                    {closed && (
                      <button type="button" onClick={() => setClosedDay(day, null)}
                        style={{ fontSize: '0.7rem', color: '#9a4a4a', background: 'none', border: '1px solid #e8c8c8', borderRadius: '5px', padding: '3px 10px', cursor: 'pointer', marginLeft: 'auto' }}>
                        移除標記
                      </button>
                    )}
                  </div>
                )}

                {/* ── 新增預約表單 ── */}
                {isAddingHere && !cs && (
                  <div style={{ padding: '10px 12px', background: '#faf8f5', borderBottom: dayAppts.length > 0 ? '1px solid #f0ebe4' : 'none' }}>
                    {/* 客人搜尋 */}
                    {!selClient ? (
                      <div style={{ position: 'relative', marginBottom: '8px' }}>
                        <input value={clientSearch} onChange={e => setClientSearch(e.target.value)}
                          placeholder="搜尋客人名字…"
                          style={inputStyle} />
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

                    {/* 快速時段按鈕 */}
                    <div style={{ marginBottom: '8px' }}>
                      <p style={{ color: '#9a8f84', fontSize: '0.68rem', marginBottom: '5px' }}>選擇時段</p>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {QUICK_TIMES.map(t => (
                          <button key={t} type="button"
                            onClick={() => setAddTime(addTime === t ? '' : t)}
                            style={{
                              padding: '5px 14px', border: 'none', borderRadius: '5px', cursor: 'pointer',
                              fontSize: '0.82rem', fontWeight: addTime === t ? 600 : 400,
                              background: addTime === t ? '#2c2825' : '#e0d9d0',
                              color: addTime === t ? '#f7f4ef' : '#6b5f54',
                            }}>
                            {t}
                          </button>
                        ))}
                        {/* 自訂時段 */}
                        <input value={QUICK_TIMES.includes(addTime) ? '' : addTime}
                          onChange={e => setAddTime(e.target.value)}
                          type="time"
                          placeholder="自訂"
                          style={{ width: '90px', border: '1px solid #e0d9d0', borderRadius: '5px', padding: '4px 8px', fontSize: '0.78rem', background: !QUICK_TIMES.includes(addTime) && addTime ? '#2c2825' : '#fff', color: !QUICK_TIMES.includes(addTime) && addTime ? '#f7f4ef' : '#2c2825', outline: 'none' }} />
                      </div>
                    </div>

                    {/* 備註 */}
                    <input value={addNote} onChange={e => setAddNote(e.target.value)}
                      placeholder="備註（選填）"
                      style={{ ...inputStyle, marginBottom: '8px' }} />

                    <button onClick={submitAdd} disabled={!selClient || addLoading}
                      style={{ width: '100%', background: selClient ? '#2c2825' : '#c4b8aa', color: '#f7f4ef', border: 'none', borderRadius: '5px', fontSize: '0.82rem', padding: '7px', cursor: selClient ? 'pointer' : 'not-allowed' }}>
                      {addLoading ? '新增中…' : addTime ? `確認新增　${addTime}` : '確認新增'}
                    </button>
                  </div>
                )}

                {/* ── 預約列表 ── */}
                {dayAppts.map((a, ai) => (
                  <div key={a.id} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 12px',
                    borderBottom: ai < dayAppts.length - 1 ? '1px solid #f5f2ee' : 'none',
                    opacity: cs ? 0.5 : 1,
                  }}>
                    <div style={{ minWidth: '40px', textAlign: 'center' }}>
                      {a.time
                        ? <span style={{ fontSize: '0.75rem', color: '#6b5f54', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{a.time}</span>
                        : <span style={{ fontSize: '0.65rem', color: '#c4b8aa' }}>—</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Link href={`/clients/${a.client_id}`}
                          style={{ color: '#2c2825', fontSize: '0.88rem', fontWeight: 500, textDecoration: 'none' }}>
                          {a.client_name}
                        </Link>
                        <MembershipBadge tier={a.client_level as MembershipLevel} />
                      </div>
                      {a.note && <p style={{ color: '#9a8f84', fontSize: '0.72rem', margin: 0, marginTop: '1px' }}>{a.note}</p>}
                    </div>
                    <button onClick={() => deleteAppt(a.id)}
                      style={{ color: '#c4b8aa', background: 'none', border: 'none', fontSize: '1rem', cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}>×</button>
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

const inputStyle: React.CSSProperties = {
  width: '100%', border: '1px solid #e0d9d0', borderRadius: '6px',
  padding: '7px 12px', fontSize: '0.82rem', background: '#fff',
  color: '#2c2825', outline: 'none', boxSizing: 'border-box',
}
