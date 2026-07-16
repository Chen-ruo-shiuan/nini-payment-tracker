'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { VisitLogWithClient } from '@/types'

const fmtAmt = (n: number) => `$${n.toLocaleString()}`

const COLS = [
  { label: '日期',   width: '8%' },
  { label: '客人',   width: '7%' },
  { label: '項目',   width: '24%' },
  { label: '付款狀態', width: '7%' },
  { label: '付款方式', width: '22%' },
  { label: '金額',   width: '13%' },
  { label: '下次預約', width: '9%' },
  { label: '備註',   width: '10%' },
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
  const paidTotal = visits.filter(isPaidStatus).reduce((s, v) => s + (v.amount || 0), 0)

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
                          ? v.payments.map((p, idx) => <div key={idx}>{`${p.method} ${fmtAmt(p.amount)}`}</div>)
                          : (v.payments?.[0]?.method || v.payment_method || '')}
                      </td>
                      <td style={{ ...cellStyle, textAlign: 'right' }}>{isPaidStatus(v) && v.amount != null ? fmtAmt(v.amount) : ''}</td>
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
          </>
        )}
      </div>
    </div>
  )
}

export default function VisitLogPrintPage() {
  return <Suspense><VisitLogPrintContent /></Suspense>
}
