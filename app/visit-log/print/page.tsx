'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { VisitLogWithClient } from '@/types'

const fmtAmt = (n: number) => `$ ${n.toLocaleString()}`

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
      <div className="no-print" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <Link href="/visit-log"
          style={{ color: '#6b5f54', fontSize: '0.85rem', border: '1px solid #e0d9d0', borderRadius: '6px', padding: '9px 14px' }}>
          ← 返回
        </Link>
        <button onClick={() => window.print()}
          style={{ background: '#2c2825', color: '#f7f4ef', border: 'none', borderRadius: '6px', fontSize: '0.85rem', padding: '9px 14px', cursor: 'pointer' }}>
          🖨 列印 / 另存 PDF
        </button>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
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
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                {['日期', '客人', '項目', '付款狀態', '付款方式', '金額', '下次預約', '備註'].map(h => (
                  <th key={h} style={{ border: '1px solid #999', padding: '6px 8px', background: '#f0f0f0', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visits.map(v => (
                <tr key={v.id}>
                  <td style={{ border: '1px solid #999', padding: '6px 8px' }}>{v.date}</td>
                  <td style={{ border: '1px solid #999', padding: '6px 8px' }}>{v.client_name}</td>
                  <td style={{ border: '1px solid #999', padding: '6px 8px' }}>
                    {(v.items?.length ? v.items : []).map(i => `[${i.category}] ${i.label}`).join('、') || v.service}
                  </td>
                  <td style={{ border: '1px solid #999', padding: '6px 8px', textAlign: 'center' }}>{v.payment_status || (v.paid ? '已收費' : '未收費')}</td>
                  <td style={{ border: '1px solid #999', padding: '6px 8px' }}>
                    {(v.payments?.length ? v.payments.map(p => `${p.method} ${fmtAmt(p.amount)}`).join('、') : v.payment_method) || ''}
                  </td>
                  <td style={{ border: '1px solid #999', padding: '6px 8px', textAlign: 'right' }}>{isPaidStatus(v) && v.amount != null ? fmtAmt(v.amount) : ''}</td>
                  <td style={{ border: '1px solid #999', padding: '6px 8px' }}>{v.next_visit_date || ''}</td>
                  <td style={{ border: '1px solid #999', padding: '6px 8px' }}>{v.note || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '14px', fontSize: '0.85rem' }}>
            <span>共 {visits.length} 筆</span>
            <span>已收款 {paidCount} 筆　合計 {fmtAmt(paidTotal)}</span>
          </div>
        </>
      )}
    </div>
  )
}

export default function VisitLogPrintPage() {
  return <Suspense><VisitLogPrintContent /></Suspense>
}
