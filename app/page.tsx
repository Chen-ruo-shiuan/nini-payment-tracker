'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import MembershipBadge from '@/components/MembershipBadge'
import PushSubscribeButton from '@/components/PushSubscribeButton'
import { MembershipLevel } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────
interface DueItem {
  id: number; client_id: number; client_name: string; client_level: string
  period_number: number; due_date: string; amount: number
}
interface ActivePackage {
  id: number; client_id: number; client_name: string; client_level: string
  service_name: string; total_sessions: number; used_sessions: number
  prepaid_amount: number; unit_price: number; date: string
}
interface RecentCheckout {
  id: number; date: string; total_amount: number; note: string | null; client_name: string | null
}
interface OverviewData {
  pkg_prepaid: number; pkg_realized: number; pkg_pending: number
  pkg_total: number; pkg_active: number
  sv_deposited: number; sv_used: number; sv_balance: number
  month_count: number; month_total: number
  installment_outstanding: number; total_clients: number
  overdue: DueItem[]; todayDue: DueItem[]; weekDue: DueItem[]
  activePackages: ActivePackage[]
  recentCheckouts: RecentCheckout[]
  monthCheckouts: RecentCheckout[]
}

// Report types
interface DailyReport {
  type: 'daily'; date: string; total: number
  checkouts: { id: number; date: string; total_amount: number; note: string | null; client_name: string | null; client_level: string | null; items: { category: string; label: string; price: number; qty: number }[] }[]
  payBreakdown: { method: string; total: number }[]
}
interface MonthlyReport {
  type: 'monthly'; month: string; monthTotal: number; monthCount: number
  byDay: { date: string; count: number; total: number }[]
  byMethod: { method: string; total: number; count: number }[]
  byCategory: { category: string; total: number; qty: number }[]
  topServices: { label: string; category: string; total: number; qty: number }[]
}
interface YearlyReport {
  type: 'yearly'; year: string; yearTotal: number
  byMonth: { month: string; count: number; total: number }[]
  pkgStats: { prepaid: number; realized: number }
}
type ReportData = DailyReport | MonthlyReport | YearlyReport | null

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtAmt = (n: number) => `$\u00a0${n.toLocaleString()}`
const fmtShort = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })
const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'short' })
const fmtMonth = (m: string) => {
  const [y, mo] = m.split('-')
  return `${y} 年 ${parseInt(mo)} 月`
}
function thisMonthLabel() {
  return new Date().toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: 'long' })
}
function todayLocal() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
}
function thisMonthStr() {
  return todayLocal().slice(0, 7)
}
function thisYearStr() {
  return todayLocal().slice(0, 4)
}

// ─── Stat Card (expandable) ───────────────────────────────────────────────────
function StatCard({ label, value, sub, color, bg, border, expanded, onClick, children }: {
  label: string; value: string; sub?: string
  color: string; bg: string; border: string
  expanded?: boolean; onClick?: () => void
  children?: React.ReactNode
}) {
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: '8px', overflow: 'hidden' }}>
      <div
        style={{ padding: '14px', cursor: onClick ? 'pointer' : 'default' }}
        onClick={onClick}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ color: '#9a8f84', fontSize: '0.68rem', letterSpacing: '0.08em' }}>{label}</div>
          {onClick && (
            <span style={{ color: '#b4aa9e', fontSize: '0.65rem', marginTop: '1px' }}>
              {expanded ? '▲' : '▼'}
            </span>
          )}
        </div>
        <div style={{ color, fontSize: '1.25rem', fontWeight: 600, marginTop: '4px', letterSpacing: '-0.01em' }}>
          {value}
        </div>
        {sub && <div style={{ color: '#b4aa9e', fontSize: '0.7rem', marginTop: '3px' }}>{sub}</div>}
      </div>
      {expanded && children && (
        <div style={{ borderTop: `1px solid ${border}`, padding: '10px 14px', background: 'rgba(255,255,255,0.5)' }}>
          {children}
        </div>
      )}
    </div>
  )
}

function DetailRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' }}>
      <span style={{ color: muted ? '#b4aa9e' : '#6b5f54', fontSize: '0.75rem' }}>{label}</span>
      <span style={{ color: muted ? '#b4aa9e' : '#2c2825', fontSize: '0.78rem', fontWeight: 500 }}>{value}</span>
    </div>
  )
}

// ─── Due Section ──────────────────────────────────────────────────────────────
function DueSection({ label, items, urgent }: { label: string; items: DueItem[]; urgent?: boolean }) {
  if (!items.length) return null
  return (
    <div className="space-y-2">
      <p style={{ color: urgent ? '#9a4a4a' : '#9a8f84', fontSize: '0.7rem', letterSpacing: '0.12em' }}>
        {label}
      </p>
      {items.map(item => (
        <Link key={item.id} href={`/clients/${item.client_id}`}>
          <div style={{
            background: '#faf8f5',
            border: `1px solid ${urgent ? '#c9a882' : '#e0d9d0'}`,
            borderRadius: '6px',
          }} className="p-3 hover:opacity-80 transition-opacity">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span style={{ color: '#2c2825', fontSize: '0.95rem' }}>{item.client_name}</span>
                  {item.client_level && <MembershipBadge tier={item.client_level as MembershipLevel} />}
                </div>
                <div style={{ color: '#9a8f84', fontSize: '0.75rem', marginTop: '2px' }}>
                  第 {item.period_number} 期　{fmtDate(item.due_date)}
                </div>
              </div>
              <div style={{ color: urgent ? '#9a6a4a' : '#4a6b52', fontSize: '1rem', fontWeight: 500 }}>
                {fmtAmt(item.amount)}
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}

// ─── Package Progress ─────────────────────────────────────────────────────────
function PackageRow({ pkg }: { pkg: ActivePackage }) {
  const remaining = pkg.total_sessions - pkg.used_sessions
  const pct = pkg.total_sessions > 0 ? (pkg.used_sessions / pkg.total_sessions) * 100 : 0
  const realized = pkg.used_sessions * pkg.unit_price
  const pending = pkg.prepaid_amount - realized

  return (
    <Link href={`/clients/${pkg.client_id}`}>
      <div style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '6px', padding: '12px' }}
        className="hover:opacity-80 transition-opacity">
        <div className="flex items-start justify-between gap-3">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="flex items-center gap-2 flex-wrap">
              <span style={{ color: '#2c2825', fontSize: '0.88rem' }}>{pkg.client_name}</span>
              {pkg.client_level && <MembershipBadge tier={pkg.client_level as MembershipLevel} />}
            </div>
            <div style={{ color: '#6b5f54', fontSize: '0.8rem', marginTop: '2px' }}>{pkg.service_name}</div>
            <div style={{ marginTop: '6px' }}>
              <div style={{ background: '#f0ebe4', borderRadius: '4px', height: '5px', overflow: 'hidden' }}>
                <div style={{ background: '#9ab89e', width: `${pct}%`, height: '100%', borderRadius: '4px' }} />
              </div>
              <div style={{ color: '#9a8f84', fontSize: '0.7rem', marginTop: '2px' }}>
                已用 {pkg.used_sessions} / {pkg.total_sessions} 次
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' } as React.CSSProperties}>
            <div style={{ color: '#4a6b52', fontSize: '0.82rem', fontWeight: 500 }}>剩 {remaining} 次</div>
            {pending > 0 && (
              <div style={{ color: '#9a6a4a', fontSize: '0.72rem', marginTop: '2px' }}>
                待履行 {fmtAmt(pending)}
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ color: '#9a8f84', fontSize: '0.7rem', letterSpacing: '0.12em' }}
      className="uppercase">{children}</p>
  )
}

// ─── Report Views ─────────────────────────────────────────────────────────────
function DailyReportView({ data }: { data: DailyReport }) {
  return (
    <div className="space-y-4">
      {/* Summary */}
      <div style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '8px', padding: '14px' }}
        className="space-y-1">
        <DetailRow label="結帳筆數" value={`${data.checkouts.length} 筆`} />
        <DetailRow label="合計金額" value={fmtAmt(data.total)} />
        {data.payBreakdown.map(p => (
          <DetailRow key={p.method} label={`　└ ${p.method}`} value={fmtAmt(p.total)} muted />
        ))}
      </div>

      {/* Checkout list */}
      {data.checkouts.length === 0 ? (
        <p style={{ color: '#c4b8aa', textAlign: 'center', fontSize: '0.85rem', padding: '20px 0' }}>無結帳記錄</p>
      ) : (
        <div className="space-y-2">
          {data.checkouts.map(co => (
            <div key={co.id} style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '6px', padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ color: '#2c2825', fontSize: '0.9rem' }}>{co.client_name ?? '（未綁定）'}</span>
                    {co.client_level && <MembershipBadge tier={co.client_level as MembershipLevel} />}
                  </div>
                  {co.note && <div style={{ color: '#9a8f84', fontSize: '0.75rem', marginTop: '2px' }}>{co.note}</div>}
                  <div style={{ marginTop: '4px' }} className="space-y-0.5">
                    {co.items.map((it, i) => (
                      <div key={i} style={{ color: '#9a8f84', fontSize: '0.72rem' }}>
                        {it.label}　×{it.qty}　{fmtAmt(it.price * it.qty)}
                      </div>
                    ))}
                  </div>
                </div>
                <span style={{ color: '#4a6b52', fontSize: '0.95rem', fontWeight: 500, flexShrink: 0, marginLeft: '8px' }}>
                  {fmtAmt(co.total_amount)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MonthlyReportView({ data }: { data: MonthlyReport }) {
  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div style={{ background: '#edf3eb', border: '1px solid #9ab89e', borderRadius: '8px', padding: '12px' }}>
          <div style={{ color: '#9a8f84', fontSize: '0.68rem' }}>月結帳總額</div>
          <div style={{ color: '#4a6b52', fontSize: '1.1rem', fontWeight: 600, marginTop: '3px' }}>{fmtAmt(data.monthTotal)}</div>
          <div style={{ color: '#b4aa9e', fontSize: '0.68rem', marginTop: '2px' }}>{data.monthCount} 筆</div>
        </div>
        <div style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '8px', padding: '12px' }}>
          <div style={{ color: '#9a8f84', fontSize: '0.68rem' }}>日均</div>
          <div style={{ color: '#2c2825', fontSize: '1.1rem', fontWeight: 600, marginTop: '3px' }}>
            {data.byDay.length > 0 ? fmtAmt(Math.round(data.monthTotal / data.byDay.length)) : '$\u00a00'}
          </div>
          <div style={{ color: '#b4aa9e', fontSize: '0.68rem', marginTop: '2px' }}>{data.byDay.length} 個結帳日</div>
        </div>
      </div>

      {/* By method */}
      {data.byMethod.length > 0 && (
        <div>
          <SectionLabel>付款方式</SectionLabel>
          <div style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '8px', padding: '12px', marginTop: '6px' }}
            className="space-y-1">
            {data.byMethod.map(m => (
              <DetailRow key={m.method} label={m.method} value={`${fmtAmt(m.total)}　(${m.count} 筆)`} />
            ))}
          </div>
        </div>
      )}

      {/* By category */}
      {data.byCategory.length > 0 && (
        <div>
          <SectionLabel>消費類別</SectionLabel>
          <div style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '8px', padding: '12px', marginTop: '6px' }}
            className="space-y-1">
            {data.byCategory.map(c => (
              <DetailRow key={c.category} label={c.category} value={`${fmtAmt(c.total)}　×${c.qty}`} />
            ))}
          </div>
        </div>
      )}

      {/* Top services */}
      {data.topServices.length > 0 && (
        <div>
          <SectionLabel>熱門服務</SectionLabel>
          <div style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '8px', padding: '12px', marginTop: '6px' }}
            className="space-y-1">
            {data.topServices.map((s, i) => (
              <DetailRow key={i} label={`${i + 1}. ${s.label}`} value={`${fmtAmt(s.total)}　×${s.qty}`} />
            ))}
          </div>
        </div>
      )}

      {/* By day */}
      {data.byDay.length > 0 && (
        <div>
          <SectionLabel>每日明細</SectionLabel>
          <div style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '8px', padding: '12px', marginTop: '6px' }}
            className="space-y-1">
            {data.byDay.map(d => (
              <DetailRow key={d.date} label={fmtShort(d.date)} value={`${fmtAmt(d.total)}　${d.count} 筆`} />
            ))}
          </div>
        </div>
      )}

      {data.byDay.length === 0 && (
        <p style={{ color: '#c4b8aa', textAlign: 'center', fontSize: '0.85rem', padding: '20px 0' }}>本月無結帳記錄</p>
      )}
    </div>
  )
}

function YearlyReportView({ data }: { data: YearlyReport }) {
  const maxVal = Math.max(...data.byMonth.map(m => m.total), 1)
  return (
    <div className="space-y-4">
      {/* Summary */}
      <div style={{ background: '#fdf5e0', border: '1px solid #e0c055', borderRadius: '8px', padding: '14px' }}>
        <div style={{ color: '#9a8f84', fontSize: '0.68rem' }}>{data.year} 年結帳總額</div>
        <div style={{ color: '#7a5a00', fontSize: '1.25rem', fontWeight: 600, marginTop: '4px' }}>{fmtAmt(data.yearTotal)}</div>
        {data.pkgStats && (
          <div style={{ color: '#b4aa9e', fontSize: '0.7rem', marginTop: '4px' }}>
            套組預收 {fmtAmt(data.pkgStats.prepaid ?? 0)}　已核銷 {fmtAmt(data.pkgStats.realized ?? 0)}
          </div>
        )}
      </div>

      {/* Bar chart by month */}
      {data.byMonth.length > 0 ? (
        <div>
          <SectionLabel>每月結帳</SectionLabel>
          <div style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '8px', padding: '12px', marginTop: '6px' }}
            className="space-y-2">
            {data.byMonth.map(m => (
              <div key={m.month}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span style={{ color: '#6b5f54', fontSize: '0.75rem' }}>{fmtMonth(m.month)}</span>
                  <span style={{ color: '#2c2825', fontSize: '0.75rem', fontWeight: 500 }}>{fmtAmt(m.total)}</span>
                </div>
                <div style={{ background: '#f0ebe4', borderRadius: '3px', height: '6px', overflow: 'hidden' }}>
                  <div style={{
                    background: '#9ab89e',
                    width: `${(m.total / maxVal) * 100}%`,
                    height: '100%', borderRadius: '3px',
                  }} />
                </div>
                <div style={{ color: '#b4aa9e', fontSize: '0.68rem', marginTop: '1px' }}>{m.count} 筆</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p style={{ color: '#c4b8aa', textAlign: 'center', fontSize: '0.85rem', padding: '20px 0' }}>本年無結帳記錄</p>
      )}
    </div>
  )
}

// ─── Reports Tab ──────────────────────────────────────────────────────────────
function ReportsTab() {
  const [reportType, setReportType] = useState<'daily' | 'monthly' | 'yearly'>('monthly')
  const [reportDate, setReportDate] = useState(todayLocal())
  const [reportMonth, setReportMonth] = useState(thisMonthStr())
  const [reportYear, setReportYear] = useState(thisYearStr())
  const [reportData, setReportData] = useState<ReportData>(null)
  const [loading, setLoading] = useState(false)

  const fetchReport = useCallback(async () => {
    setLoading(true)
    let url = `/api/reports?type=${reportType}`
    if (reportType === 'daily')   url += `&date=${reportDate}`
    if (reportType === 'monthly') url += `&month=${reportMonth}`
    if (reportType === 'yearly')  url += `&year=${reportYear}`
    const res = await fetch(url)
    const d = await res.json()
    setReportData(d)
    setLoading(false)
  }, [reportType, reportDate, reportMonth, reportYear])

  useEffect(() => { fetchReport() }, [fetchReport])

  const subtabs: { key: 'daily' | 'monthly' | 'yearly'; label: string }[] = [
    { key: 'daily',   label: '日報' },
    { key: 'monthly', label: '月報' },
    { key: 'yearly',  label: '年報' },
  ]

  return (
    <div className="space-y-4">
      {/* Sub-tab picker */}
      <div style={{ display: 'flex', gap: '6px' }}>
        {subtabs.map(t => (
          <button key={t.key} onClick={() => setReportType(t.key)}
            style={{
              background: reportType === t.key ? '#6b5f54' : '#f0ebe4',
              color: reportType === t.key ? '#f7f4ef' : '#6b5f54',
              border: 'none', borderRadius: '4px',
              fontSize: '0.78rem', padding: '5px 16px', cursor: 'pointer',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Date picker */}
      {reportType === 'daily' && (
        <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)}
          style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '6px', color: '#2c2825', fontSize: '0.9rem', padding: '8px 12px', width: '100%', outline: 'none' }} />
      )}
      {reportType === 'monthly' && (
        <input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)}
          style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '6px', color: '#2c2825', fontSize: '0.9rem', padding: '8px 12px', width: '100%', outline: 'none' }} />
      )}
      {reportType === 'yearly' && (
        <select value={reportYear} onChange={e => setReportYear(e.target.value)}
          style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '6px', color: '#2c2825', fontSize: '0.9rem', padding: '8px 12px', width: '100%', outline: 'none' }}>
          {Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i)).map(y => (
            <option key={y} value={y}>{y} 年</option>
          ))}
        </select>
      )}

      {/* Report content */}
      {loading ? (
        <div style={{ color: '#c4b8aa', textAlign: 'center', padding: '30px 0', fontSize: '0.85rem' }}>載入中…</div>
      ) : reportData && reportData.type === 'daily' ? (
        <DailyReportView data={reportData as DailyReport} />
      ) : reportData && reportData.type === 'monthly' ? (
        <MonthlyReportView data={reportData as MonthlyReport} />
      ) : reportData && reportData.type === 'yearly' ? (
        <YearlyReportView data={reportData as YearlyReport} />
      ) : null}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function OverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'套組' | '分期' | '本月' | '報表'>('套組')
  const [expandedCard, setExpandedCard] = useState<'prepaid' | 'realized' | 'pending' | 'month' | null>(null)

  function toggleCard(card: typeof expandedCard) {
    setExpandedCard(prev => prev === card ? null : card)
  }

  useEffect(() => {
    fetch('/api/overview')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ color: '#c4b8aa', textAlign: 'center', padding: '60px 0', fontSize: '0.85rem' }}>
        載入中…
      </div>
    )
  }

  if (!data) {
    return (
      <div style={{ color: '#c4b8aa', textAlign: 'center', padding: '60px 0' }}>
        載入失敗，請重新整理
      </div>
    )
  }

  const totalDue = data.overdue.length + data.todayDue.length + data.weekDue.length

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between pt-2">
        <div>
          <h1 style={{ color: '#2c2825', fontSize: '1.4rem', letterSpacing: '0.05em', fontWeight: 500 }}>
            總覽
          </h1>
          <p style={{ color: '#9a8f84', fontSize: '0.78rem', marginTop: '3px' }}>
            {thisMonthLabel()}　共 {data.total_clients} 位客人
          </p>
        </div>
        <PushSubscribeButton />
      </div>

      {/* ── 預收 vs 實收 stat cards ── */}
      <div className="space-y-2">
        <SectionLabel>預收 vs 實收</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>

          {/* 預收總額 */}
          <StatCard
            label="預收總額"
            value={fmtAmt(data.pkg_prepaid + data.sv_deposited)}
            sub={`套組 ＋ 儲值`}
            color="#7a5a00" bg="#fdf5e0" border="#e0c055"
            expanded={expandedCard === 'prepaid'}
            onClick={() => toggleCard('prepaid')}
          >
            <div className="space-y-1">
              <DetailRow label="套組預收" value={fmtAmt(data.pkg_prepaid)} />
              <DetailRow label="儲值加值" value={fmtAmt(data.sv_deposited)} />
              <DetailRow label="儲值餘額" value={fmtAmt(data.sv_balance)} muted />
            </div>
          </StatCard>

          {/* 已實收 */}
          <StatCard
            label="已實收"
            value={fmtAmt(data.pkg_realized + data.sv_used)}
            sub={`核銷 ＋ 儲值消費`}
            color="#4a6b52" bg="#edf3eb" border="#9ab89e"
            expanded={expandedCard === 'realized'}
            onClick={() => toggleCard('realized')}
          >
            <div className="space-y-1">
              <DetailRow label="課程核銷" value={fmtAmt(data.pkg_realized)} />
              <DetailRow label="儲值消費" value={fmtAmt(data.sv_used)} />
              <DetailRow label="合計" value={fmtAmt(data.pkg_realized + data.sv_used)} muted />
            </div>
          </StatCard>

          {/* 待履行 */}
          <StatCard
            label="待履行"
            value={fmtAmt(data.pkg_pending)}
            sub={`${data.pkg_active} 件套組進行中`}
            color="#9a4a4a" bg="#fdf0f0" border="#e8a8a8"
            expanded={expandedCard === 'pending'}
            onClick={() => toggleCard('pending')}
          >
            <div className="space-y-2">
              {data.activePackages.length === 0 ? (
                <p style={{ color: '#c4b8aa', fontSize: '0.75rem', textAlign: 'center', padding: '8px 0' }}>無進行中套組</p>
              ) : (
                data.activePackages.slice(0, 5).map(pkg => {
                  const pending = pkg.prepaid_amount - pkg.used_sessions * pkg.unit_price
                  return (
                    <Link key={pkg.id} href={`/clients/${pkg.client_id}`}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #f0ebe4' }}>
                        <div>
                          <div style={{ color: '#2c2825', fontSize: '0.78rem' }}>{pkg.client_name}</div>
                          <div style={{ color: '#9a8f84', fontSize: '0.7rem' }}>{pkg.service_name}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: '#4a6b52', fontSize: '0.75rem' }}>
                            剩 {pkg.total_sessions - pkg.used_sessions} 次
                          </div>
                          {pending > 0 && (
                            <div style={{ color: '#9a4a4a', fontSize: '0.7rem' }}>{fmtAmt(pending)}</div>
                          )}
                        </div>
                      </div>
                    </Link>
                  )
                })
              )}
              {data.activePackages.length > 5 && (
                <p style={{ color: '#b4aa9e', fontSize: '0.7rem', textAlign: 'center' }}>
                  還有 {data.activePackages.length - 5} 件…
                </p>
              )}
            </div>
          </StatCard>

          {/* 本月結帳 */}
          <StatCard
            label={`${thisMonthLabel().slice(-2)} 結帳`}
            value={fmtAmt(data.month_total)}
            sub={`共 ${data.month_count} 筆記錄`}
            color="#2d4f9a" bg="#e8f0fc" border="#9ab0e8"
            expanded={expandedCard === 'month'}
            onClick={() => toggleCard('month')}
          >
            <div className="space-y-1">
              {data.monthCheckouts.slice(0, 6).map(co => (
                <div key={co.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #d0dcf0' }}>
                  <div>
                    <span style={{ color: '#2c2825', fontSize: '0.75rem' }}>{co.client_name ?? '—'}</span>
                    {co.note && <span style={{ color: '#9a8f84', fontSize: '0.7rem', marginLeft: '6px' }}>{co.note}</span>}
                    <span style={{ color: '#9ab0e8', fontSize: '0.68rem', marginLeft: '6px' }}>{fmtShort(co.date)}</span>
                  </div>
                  <span style={{ color: '#2d4f9a', fontSize: '0.75rem', fontWeight: 500 }}>{fmtAmt(co.total_amount)}</span>
                </div>
              ))}
              {data.monthCheckouts.length > 6 && (
                <p style={{ color: '#b4aa9e', fontSize: '0.7rem', textAlign: 'center' }}>
                  還有 {data.monthCheckouts.length - 6} 筆…
                </p>
              )}
              <div style={{ paddingTop: '4px' }}>
                <button onClick={() => { setExpandedCard(null); setActiveTab('報表') }}
                  style={{ color: '#2d4f9a', fontSize: '0.7rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  查看月報 →
                </button>
              </div>
            </div>
          </StatCard>
        </div>
        <p style={{ color: '#c4b8aa', fontSize: '0.68rem', paddingLeft: '2px' }}>
          ＊ 預收含套組預購及儲值加值；實收含課程核銷及儲值消費
        </p>
      </div>

      {/* ── 分期待收小卡 ── */}
      {data.installment_outstanding > 0 && (
        <div style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '8px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#6b5f54', fontSize: '0.82rem' }}>分期待收款</span>
          <span style={{ color: '#9a6a4a', fontSize: '1rem', fontWeight: 600 }}>{fmtAmt(data.installment_outstanding)}</span>
        </div>
      )}

      {/* ── 付款警示 ── */}
      {totalDue > 0 && (
        <div className="space-y-3">
          <SectionLabel>付款提醒</SectionLabel>
          <DueSection label="已逾期" items={data.overdue} urgent />
          <DueSection label="今日到期" items={data.todayDue} urgent />
          <DueSection label="本週到期" items={data.weekDue} />
        </div>
      )}

      {/* ── 四分頁切換 ── */}
      <div className="space-y-3">
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {((['套組', '分期', '本月', '報表'] as const)).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{
                background: activeTab === tab ? '#2c2825' : '#f0ebe4',
                color: activeTab === tab ? '#f7f4ef' : '#6b5f54',
                border: 'none', borderRadius: '4px',
                fontSize: '0.78rem', padding: '5px 14px', cursor: 'pointer',
              }}>
              {tab === '套組' ? `套組 (${data.pkg_active})` : tab === '分期' ? `分期 (${totalDue})` : tab}
            </button>
          ))}
        </div>

        {/* 套組進度 */}
        {activeTab === '套組' && (
          <div className="space-y-2">
            {data.activePackages.length === 0 ? (
              <p style={{ color: '#c4b8aa', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>
                目前無進行中套組
              </p>
            ) : (
              data.activePackages.map(pkg => <PackageRow key={pkg.id} pkg={pkg} />)
            )}
          </div>
        )}

        {/* 分期待繳 */}
        {activeTab === '分期' && (
          <div className="space-y-3">
            {totalDue === 0 ? (
              <p style={{ color: '#c4b8aa', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>
                本週無待繳款項 🌿
              </p>
            ) : (
              <>
                <DueSection label="已逾期" items={data.overdue} urgent />
                <DueSection label="今日到期" items={data.todayDue} urgent />
                <DueSection label="本週到期" items={data.weekDue} />
              </>
            )}
          </div>
        )}

        {/* 本月結帳 */}
        {activeTab === '本月' && (
          <div className="space-y-2">
            {data.monthCheckouts.length === 0 ? (
              <p style={{ color: '#c4b8aa', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>
                本月尚無結帳記錄
              </p>
            ) : (
              (() => {
                const byDate = new Map<string, RecentCheckout[]>()
                for (const co of data.monthCheckouts) {
                  const arr = byDate.get(co.date) ?? []
                  arr.push(co)
                  byDate.set(co.date, arr)
                }
                return Array.from(byDate.entries()).map(([date, items]) => (
                  <div key={date}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                      <span style={{ color: '#9a8f84', fontSize: '0.75rem' }}>{fmtDate(date)}</span>
                      <span style={{ color: '#9a8f84', fontSize: '0.72rem' }}>
                        {items.length} 筆　{fmtAmt(items.reduce((s, i) => s + i.total_amount, 0))}
                      </span>
                    </div>
                    {items.map(co => (
                      <div key={co.id} style={{
                        background: '#faf8f5', border: '1px solid #e0d9d0',
                        borderRadius: '5px', padding: '10px 12px', marginBottom: '5px',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}>
                        <div>
                          <span style={{ color: '#2c2825', fontSize: '0.88rem' }}>{co.client_name ?? '（未綁定客人）'}</span>
                          {co.note && <span style={{ color: '#9a8f84', fontSize: '0.75rem', marginLeft: '8px' }}>{co.note}</span>}
                        </div>
                        <span style={{ color: '#4a6b52', fontSize: '0.9rem', fontWeight: 500 }}>
                          {fmtAmt(co.total_amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                ))
              })()
            )}
          </div>
        )}

        {/* 報表 */}
        {activeTab === '報表' && <ReportsTab />}
      </div>

      {/* ── 快速操作 ── */}
      {data.total_clients === 0 && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Link href="/import"
            style={{ color: '#9a8f84', fontSize: '0.85rem' }}
            className="underline underline-offset-4">
            匯入舊系統資料 →
          </Link>
        </div>
      )}
    </div>
  )
}
