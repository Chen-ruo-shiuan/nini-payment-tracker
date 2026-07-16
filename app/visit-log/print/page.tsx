'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { VisitLogWithClient, VISIT_LOG_PAY_METHODS } from '@/types'

const fmtAmt = (n: number) => `$${n.toLocaleString()}`

const COLS = [
  { label: '日期',   width: '8%' },
  { label: '客人',   width: '7%' },
  { label: '項目',   width: '25%' },
  { label: '付款狀態', width: '7%' },
  { label: '付款方式', width: '16%' },
  { label: '金額',   width: '15%' },
  { label: '下次預約', width: '9%' },
  { label: '備註',   width: '13%' },
]

const cellStyle: React.CSSProperties = {
  border: '1px solid #333', padding: '6px 8px', verticalAlign: 'top', lineHeight: 1.5,
}

function VisitLogPrintContent() {
  const searchParams = useSearchParams()
  const date = searchParams.get('date')
  const from = searchParams.get('from')
  const to   = searchParams.get('to')

  const [visits, setVisits] = useState<VisitLogWithClient[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const qs = date ? `date=${date}` : from && to ? `from=${from}&to=${to}` : ''
    fetch(`/api/visit-log?${qs}`)
      .then(r => r.json())
      .then(d => { setVisits(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [date, from, to])

  const rangeLabel = date ? date : from && to ? `${from} ～ ${to}` : '全部'
  const isPaidStatus = (v: VisitLogWithClient) => (v.payment_status || (v.paid ? '已收費' : '未收費')) !== '未收費'
  const paidCount = visits.filter(isPaidStatus).length

  // 商品券已於預購時收款，當天不重複計入合計／方式統計
  const cashPayments = visits.flatMap(v => (v.payments || []).filter(p => p.method !== '商品券'))
  const paidTotal = cashPayments.reduce((s, p) => s + p.amount, 0)
  const methodTotals = VISIT_LOG_PAY_METHODS
    .filter(m => m !== '商品券')
    .map(m => ({ method: m, total: cashPayments.filter(p => p.method === m).reduce((s, p) => s + p.amount, 0) }))
    .filter(m => m.total > 0)
  const hasVoucher = visits.some(v => (v.payments || []).some(p => p.method === '商品券'))

  return (
    <div style={{ background: '#fff', color: '#000', minHeight: '100vh' }}>
      <div className="no-print" style={{ display: 'flex', gap: '10px', marginBottom: '20px', maxWidth: '190mm', marginLeft: 'auto', marginRight: 'auto' }}>
        <Link href="/visit-log"
          style={{ color: '#6b5f54', fontSize: '0.85rem', border: '1px solid #e0d9d0', borderRadius: '6px', padding: '9px 14px' }}>
          ← 返回
        </Link>
        <button onClick={() => window.print()}
          style={{ background: '#2c2825', color: '#f7f4ef', border: 'none', borderRadius: '6px', fontSize: '0.85rem', padding: '9px 14px', cursor: 'pointer' }}>
          🖨 列印 / 另存 PDF
        </button>
      </div>

      <div style={{ maxWidth: '190mm', margin: '0 auto', padding: '0 4mm' }}>
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>NiNi の 皮膚療癒所</div>
          <div style={{ fontSize: '0.95rem', marginTop: '4px' }}>每日紀錄</div>
          <div style={{ fontSize: '0.85rem', color: '#555', marginTop: '2px' }}>{rangeLabel}</div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#888' }}>載入中…</div>
        ) : visits.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#888' }}>此區間無紀錄</div>
        ) : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '0.78rem' }}>
              <colgroup>
                {COLS.map(c => <col key={c.label} style={{ width: c.width }} />)}
              </colgroup>
              <thead>
                <tr>
                  {COLS.map(c => (
                    <th key={c.label} style={{ ...cellStyle, background: '#f0f0f0', textAlign: 'left' }}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visits.map(v => {
                  const items = v.items?.length ? v.items : (v.service ? [{ id: 0, category: '服務', label: v.service }] : [])
                  return (
                    <tr key={v.id}>
                      <td style={cellStyle}>{v.date}</td>
                      <td style={cellStyle}>{v.client_name}</td>
                      <td style={cellStyle}>
                        {items.map((it, idx) => (
                          <div key={idx}>{`[${it.category}] ${it.label}`}</div>
                        ))}
                      </td>
                      <td style={{ ...cellStyle, textAlign: 'center' }}>{v.payment_status || (v.paid ? '已收費' : '未收費')}</td>
                      <td style={cellStyle}>
                        {v.payments && v.payments.length > 1
                          ? v.payments.map((p, idx) => <div key={idx}>{p.method}</div>)
                          : (v.payments?.[0]?.method || v.payment_method || '')}
                      </td>
                      <td style={{ ...cellStyle, textAlign: 'right' }}>
                        {v.payments && v.payments.length > 1 ? (
                          <>
                            {v.payments.map((p, idx) => <div key={idx}>{fmtAmt(p.amount)}</div>)}
                            <div style={{ borderTop: '1px solid #999', marginTop: '2px', paddingTop: '2px', fontWeight: 700 }}>
                              {fmtAmt(v.amount ?? 0)}
                            </div>
                          </>
                        ) : (isPaidStatus(v) && v.amount != null ? fmtAmt(v.amount) : '')}
                      </td>
                      <td style={cellStyle}>{v.next_visit_date || ''}</td>
                      <td style={cellStyle}>{v.note || ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '14px', fontSize: '0.82rem' }}>
              <span>共 {visits.length} 筆</span>
              <span>已收款 {paidCount} 筆　合計 {fmtAmt(paidTotal)}</span>
            </div>
            {methodTotals.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '4px', fontSize: '0.78rem', color: '#444' }}>
                {methodTotals.map(m => (
                  <span key={m.method}>{m.method} {fmtAmt(m.total)}</span>
                ))}
              </div>
            )}
            {hasVoucher && (
              <div style={{ textAlign: 'right', fontSize: '0.7rem', color: '#888', marginTop: '2px' }}>
                （商品券已於購買時預收，不列入合計）
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function VisitLogPrintPage() {
  return <Suspense><VisitLogPrintContent /></Suspense>
}
