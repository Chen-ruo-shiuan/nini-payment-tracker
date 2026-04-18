'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import MembershipBadge from '@/components/MembershipBadge'
import { MembershipLevel } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Financials {
  prepaid: number; outstanding: number
  pkgRealized: number; svUsed: number; pointsUsed: number
  installmentReceived: number; installmentOutstanding: number
  checkoutTotal: number
  byPayMethod: { method: string; total: number }[]
}
interface ReportData {
  type: string
  // daily
  date?: string; checkouts?: unknown[]; categoryBreakdown?: {category:string;total:number;qty:number}[]
  // monthly
  month?: string
  byDay?: {date:string;count:number;total:number}[]
  byMethod?: {method:string;total:number;count:number}[]
  byCategory?: {category:string;total:number;qty:number}[]
  topServices?: {label:string;category:string;total:number;qty:number}[]
  topProducts?: {label:string;total:number;qty:number}[]
  topClients?: {id:number;name:string;level:string;total:number;visits:number}[]
  monthTotal?: number; monthCount?: number
  // yearly
  year?: string
  byMonth?: {month:string;count:number;total:number}[]
  pkgStats?: {prepaid:number;realized:number;outstanding:number}
  yearTotal?: number
  // shared
  payBreakdown?: {method:string;total:number}[]
  total?: number
  financials?: Financials
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtAmt = (n: number) => `$ ${Math.round(n).toLocaleString()}`
function getTaipeiToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
}
function getTaipeiMonth() { return getTaipeiToday().slice(0, 7) }
function getTaipeiYear()  { return getTaipeiToday().slice(0, 4) }

type PeriodType = '日' | '月' | '年'

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = '#2c2825', bg = '#faf8f5', border = '#e0d9d0' }: {
  label: string; value: string; sub?: string
  color?: string; bg?: string; border?: string
}) {
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: '7px', padding: '12px', flex: 1, minWidth: 0 }}>
      <div style={{ color: '#9a8f84', fontSize: '0.65rem', letterSpacing: '0.07em', marginBottom: '4px' }}>{label}</div>
      <div style={{ color, fontSize: '0.95rem', fontWeight: 600 }}>{value}</div>
      {sub && <div style={{ color: '#b4aa9e', fontSize: '0.65rem', marginTop: '2px' }}>{sub}</div>}
    </div>
  )
}

// ─── Bar ──────────────────────────────────────────────────────────────────────
function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
        <span style={{ color: '#2c2825', fontSize: '0.8rem' }}>{label}</span>
        <span style={{ color: '#6b5f54', fontSize: '0.78rem' }}>{fmtAmt(value)}</span>
      </div>
      <div style={{ background: '#f0ebe4', borderRadius: '4px', height: '5px' }}>
        <div style={{ background: color, width: `${pct}%`, height: '100%', borderRadius: '4px', transition: 'width 0.4s' }} />
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [period, setPeriod] = useState<PeriodType>('月')
  const [day,    setDay]    = useState(getTaipeiToday())
  const [month,  setMonth]  = useState(getTaipeiMonth())
  const [year,   setYear]   = useState(getTaipeiYear())
  const [data,   setData]   = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      let url = '/api/reports?'
      if (period === '日') url += `type=daily&date=${day}`
      else if (period === '月') url += `type=monthly&month=${month}`
      else url += `type=yearly&year=${year}`
      const res = await fetch(url)
      setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [period, day, month, year])

  useEffect(() => { fetchReport() }, [fetchReport])

  const fin = data?.financials

  return (
    <div className="space-y-5">
      <div className="pt-2">
        <h1 style={{ color: '#2c2825', fontSize: '1.4rem', fontWeight: 500, letterSpacing: '0.05em' }}>報表</h1>
      </div>

      {/* Period selector + date picker */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {(['日','月','年'] as PeriodType[]).map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            style={{
              background: period === p ? '#2c2825' : '#faf8f5',
              color: period === p ? '#f7f4ef' : '#6b5f54',
              border: `1px solid ${period === p ? '#2c2825' : '#e0d9d0'}`,
              borderRadius: '20px', fontSize: '0.8rem', padding: '5px 16px', cursor: 'pointer',
            }}>{p}</button>
        ))}
        <div style={{ flex: 1 }} />
        {period === '日' && (
          <input type="date" value={day} onChange={e => setDay(e.target.value)}
            style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '6px', color: '#2c2825', fontSize: '0.82rem', padding: '5px 10px', outline: 'none' }} />
        )}
        {period === '月' && (
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '6px', color: '#2c2825', fontSize: '0.82rem', padding: '5px 10px', outline: 'none' }} />
        )}
        {period === '年' && (
          <select value={year} onChange={e => setYear(e.target.value)}
            style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '6px', color: '#2c2825', fontSize: '0.82rem', padding: '5px 10px', outline: 'none' }}>
            {Array.from({ length: 5 }, (_, i) => String(Number(getTaipeiYear()) - i)).map(y => (
              <option key={y} value={y}>{y} 年</option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div style={{ color: '#c4b8aa', textAlign: 'center', padding: '60px 0' }}>載入中…</div>
      ) : data && (
        <div className="space-y-4">

          {/* ── 財務總覽 ── */}
          <section className="space-y-3">
            <p style={{ color: '#6b5f54', fontSize: '0.72rem', letterSpacing: '0.1em' }}>財務總覽</p>

            {/* 實際收到的金流 */}
            <div style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '8px', padding: '14px' }}>
              <p style={{ color: '#9a8f84', fontSize: '0.68rem', letterSpacing: '0.08em', marginBottom: '8px' }}>實際收到款項（現金流）</p>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                <StatCard
                  label="結帳總額"
                  value={fmtAmt(data.total ?? data.monthTotal ?? data.yearTotal ?? 0)}
                  color="#2c2825" bg="#f5f2ee" border="#d9d0c5"
                />
                {period !== '日' && fin?.installmentReceived != null && fin.installmentReceived > 0 && (
                  <StatCard
                    label="分期已收"
                    value={fmtAmt(fin.installmentReceived)}
                    color="#4a6b52" bg="#edf3eb" border="#9ab89e"
                  />
                )}
              </div>
              {/* 付款方式明細 */}
              {fin?.byPayMethod && fin.byPayMethod.length > 0 && (() => {
                const cashMethods = fin.byPayMethod.filter(m => ['現金','匯款','LINE Pay','LinePay'].includes(m.method))
                const preMethods  = fin.byPayMethod.filter(m => ['商品券','儲值金','金米'].includes(m.method))
                const otherMethods = fin.byPayMethod.filter(m => !['現金','匯款','LINE Pay','LinePay','商品券','儲值金','金米'].includes(m.method))
                return (
                  <div className="space-y-1">
                    {cashMethods.length > 0 && (
                      <div style={{ borderBottom: '1px dashed #e0d9d0', paddingBottom: '6px', marginBottom: '6px' }}>
                        <p style={{ color: '#b4aa9e', fontSize: '0.65rem', marginBottom: '4px' }}>── 現金流入</p>
                        {cashMethods.map(m => (
                          <div key={m.method} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                            <span style={{ color: '#6b5f54', fontSize: '0.78rem' }}>{m.method}</span>
                            <span style={{ color: '#2c2825', fontSize: '0.8rem', fontWeight: 500 }}>{fmtAmt(m.total)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {preMethods.length > 0 && (
                      <div style={{ borderBottom: '1px dashed #e0d9d0', paddingBottom: '6px', marginBottom: '6px' }}>
                        <p style={{ color: '#b4aa9e', fontSize: '0.65rem', marginBottom: '4px' }}>── 履行預收</p>
                        {preMethods.map(m => (
                          <div key={m.method} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                            <span style={{ color: '#6b5f54', fontSize: '0.78rem' }}>{m.method}</span>
                            <span style={{ color: '#2c2825', fontSize: '0.8rem', fontWeight: 500 }}>{fmtAmt(m.total)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {otherMethods.map(m => (
                      <div key={m.method} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                        <span style={{ color: '#6b5f54', fontSize: '0.78rem' }}>{m.method}</span>
                        <span style={{ color: '#2c2825', fontSize: '0.8rem', fontWeight: 500 }}>{fmtAmt(m.total)}</span>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>

            {/* 預收 & 待履行 */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <StatCard
                label="預收套組總額"
                value={fmtAmt(fin?.prepaid ?? 0)}
                color="#2d4f9a" bg="#e8f0fc" border="#9ab0e8"
              />
              <StatCard
                label="待履行（套組）"
                value={fmtAmt(fin?.outstanding ?? 0)}
                sub="未核銷 × 單價"
                color="#9a6a4a" bg="#fdf0e6" border="#e8cba8"
              />
            </div>

            {/* 分期 */}
            {period !== '日' && (
              <div style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '8px', padding: '12px 14px' }}>
                <p style={{ color: '#9a8f84', fontSize: '0.68rem', letterSpacing: '0.08em', marginBottom: '8px' }}>分期款項</p>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <StatCard
                    label="分期已收"
                    value={fmtAmt(fin?.installmentReceived ?? 0)}
                    color="#4a6b52" bg="#edf3eb" border="#9ab89e"
                  />
                  <StatCard
                    label="分期未收（全部）"
                    value={fmtAmt(fin?.installmentOutstanding ?? 0)}
                    color="#9a4a4a" bg="#fdf0f0" border="#e8a8a8"
                  />
                </div>
              </div>
            )}
          </section>

          {/* ── 付款方式 ── */}
          {(data.payBreakdown ?? data.byMethod) && (
            <section style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '8px', padding: '14px' }}>
              <p style={{ color: '#6b5f54', fontSize: '0.72rem', letterSpacing: '0.1em', marginBottom: '10px' }}>付款方式</p>
              {(data.payBreakdown ?? data.byMethod ?? []).map((m: {method:string;total:number}) => (
                <Bar key={m.method} label={m.method} value={m.total}
                  max={Math.max(...(data.payBreakdown ?? data.byMethod ?? []).map((x: {total:number}) => x.total))}
                  color="#9ab89e" />
              ))}
            </section>
          )}

          {/* ── 月/年趨勢 ── */}
          {period === '月' && data.byDay && data.byDay.length > 0 && (
            <section style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '8px', padding: '14px' }}>
              <p style={{ color: '#6b5f54', fontSize: '0.72rem', letterSpacing: '0.1em', marginBottom: '10px' }}>
                每日營收　共 {data.monthCount} 筆
              </p>
              {data.byDay.map(d => (
                <div key={d.date} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f0ebe4', fontSize: '0.8rem' }}>
                  <span style={{ color: '#9a8f84' }}>
                    {new Date(d.date + 'T00:00:00').toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}
                  </span>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <span style={{ color: '#9a8f84', fontSize: '0.72rem' }}>{d.count} 筆</span>
                    <span style={{ color: '#2c2825' }}>{fmtAmt(d.total)}</span>
                  </div>
                </div>
              ))}
            </section>
          )}

          {period === '年' && data.byMonth && data.byMonth.length > 0 && (
            <section style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '8px', padding: '14px' }}>
              <p style={{ color: '#6b5f54', fontSize: '0.72rem', letterSpacing: '0.1em', marginBottom: '10px' }}>
                月度營收　{data.year} 年
              </p>
              {(() => {
                const maxVal = Math.max(...data.byMonth!.map(m => m.total))
                return data.byMonth!.map(m => (
                  <div key={m.month} style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span style={{ color: '#2c2825', fontSize: '0.8rem' }}>{m.month.slice(5)} 月</span>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <span style={{ color: '#9a8f84', fontSize: '0.72rem' }}>{m.count} 筆</span>
                        <span style={{ color: '#6b5f54', fontSize: '0.8rem' }}>{fmtAmt(m.total)}</span>
                      </div>
                    </div>
                    <div style={{ background: '#f0ebe4', borderRadius: '4px', height: '5px' }}>
                      <div style={{ background: '#9ab89e', width: `${maxVal > 0 ? (m.total / maxVal) * 100 : 0}%`, height: '100%', borderRadius: '4px' }} />
                    </div>
                  </div>
                ))
              })()}
            </section>
          )}

          {/* ── 品類分布 ── */}
          {(data.byCategory ?? data.categoryBreakdown) && (
            <section style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '8px', padding: '14px' }}>
              <p style={{ color: '#6b5f54', fontSize: '0.72rem', letterSpacing: '0.1em', marginBottom: '10px' }}>品類分布</p>
              {(() => {
                const cats = data.byCategory ?? data.categoryBreakdown ?? []
                const maxVal = Math.max(...cats.map((c: {total:number}) => c.total))
                const COLORS: Record<string, string> = {
                  '服務': '#9ab89e', '加購': '#a8c4b0', '商品券': '#c4b8aa',
                  '產品': '#b8a8d0', '活動': '#d4c8a0',
                }
                return cats.map((c: {category:string;total:number;qty:number}) => (
                  <Bar key={c.category} label={`${c.category}（${c.qty} 次）`} value={c.total} max={maxVal} color={COLORS[c.category] ?? '#c4b8aa'} />
                ))
              })()}
            </section>
          )}

          {/* ── 課程排行 ── */}
          {data.topServices && data.topServices.length > 0 && (
            <section style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '8px', padding: '14px' }}>
              <p style={{ color: '#6b5f54', fontSize: '0.72rem', letterSpacing: '0.1em', marginBottom: '10px' }}>課程排行</p>
              {data.topServices.map((s, i) => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: '1px solid #f0ebe4' }}>
                  <span style={{ color: i < 3 ? '#7a5a00' : '#b4aa9e', fontSize: '0.75rem', minWidth: '18px', fontWeight: i < 3 ? 600 : 400 }}>
                    {i + 1}
                  </span>
                  <span style={{ color: '#2c2825', fontSize: '0.82rem', flex: 1 }}>{s.label}</span>
                  <span style={{ color: '#9a8f84', fontSize: '0.72rem' }}>{s.qty} 次</span>
                  <span style={{ color: '#6b5f54', fontSize: '0.78rem' }}>{fmtAmt(s.total)}</span>
                </div>
              ))}
            </section>
          )}

          {/* ── 保養品排行 ── */}
          {data.topProducts && data.topProducts.length > 0 && (
            <section style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '8px', padding: '14px' }}>
              <p style={{ color: '#6b5f54', fontSize: '0.72rem', letterSpacing: '0.1em', marginBottom: '10px' }}>保養品排行</p>
              {data.topProducts.map((s, i) => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: '1px solid #f0ebe4' }}>
                  <span style={{ color: i < 3 ? '#5a4a6b' : '#b4aa9e', fontSize: '0.75rem', minWidth: '18px', fontWeight: i < 3 ? 600 : 400 }}>
                    {i + 1}
                  </span>
                  <span style={{ color: '#2c2825', fontSize: '0.82rem', flex: 1 }}>{s.label}</span>
                  <span style={{ color: '#9a8f84', fontSize: '0.72rem' }}>{s.qty} 次</span>
                  <span style={{ color: '#6b5f54', fontSize: '0.78rem' }}>{fmtAmt(s.total)}</span>
                </div>
              ))}
            </section>
          )}

          {/* ── 客人消費排行 ── */}
          {data.topClients && data.topClients.length > 0 && (
            <section style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '8px', padding: '14px' }}>
              <p style={{ color: '#6b5f54', fontSize: '0.72rem', letterSpacing: '0.1em', marginBottom: '10px' }}>客人消費排行</p>
              {data.topClients.map((c, i) => (
                <Link key={c.id} href={`/clients/${c.id}`}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: '1px solid #f0ebe4', textDecoration: 'none' }}>
                  <span style={{ color: i < 3 ? '#7a5a00' : '#b4aa9e', fontSize: '0.75rem', minWidth: '18px', fontWeight: i < 3 ? 600 : 400 }}>
                    {i + 1}
                  </span>
                  <span style={{ color: '#2c2825', fontSize: '0.88rem', flex: 1 }}>{c.name}</span>
                  <MembershipBadge tier={c.level as MembershipLevel} />
                  <span style={{ color: '#9a8f84', fontSize: '0.72rem' }}>{c.visits} 次</span>
                  <span style={{ color: '#4a6b52', fontSize: '0.82rem', fontWeight: 500 }}>{fmtAmt(c.total)}</span>
                </Link>
              ))}
            </section>
          )}

          {/* ── 套組狀況（年報） ── */}
          {period === '年' && data.pkgStats && (
            <section style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '8px', padding: '14px' }}>
              <p style={{ color: '#6b5f54', fontSize: '0.72rem', letterSpacing: '0.1em', marginBottom: '10px' }}>所有套組狀況</p>
              <div style={{ display: 'flex', gap: '6px' }}>
                <StatCard label="預收" value={fmtAmt(data.pkgStats.prepaid)} color="#2d4f9a" bg="#e8f0fc" border="#9ab0e8" />
                <StatCard label="已核銷" value={fmtAmt(data.pkgStats.realized)} color="#4a6b52" bg="#edf3eb" border="#9ab89e" />
                <StatCard label="待履行" value={fmtAmt(data.pkgStats.outstanding)} color="#9a6a4a" bg="#fdf0e6" border="#e8cba8" />
              </div>
            </section>
          )}

        </div>
      )}
    </div>
  )
}
