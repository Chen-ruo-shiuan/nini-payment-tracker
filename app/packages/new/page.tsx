'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { PAYMENT_METHODS, ClientWithStats, MembershipLevel } from '@/types'
import MembershipBadge from '@/components/MembershipBadge'

const SERVICE_NAMES = [
  '精細光彩', '原液調理', '泡光氧彗', '雨林頭療',
  '小顏骨氣', '森林癒撥筋', '深皮超導', '全臉粉清',
]

// 排除核銷、商品券（不能用商品券買商品券）
const PKG_PAY_METHODS = PAYMENT_METHODS.filter(m => !['核銷', '商品券'].includes(m))

function NewPackageForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const presetClientId = searchParams.get('client_id')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [clients, setClients] = useState<ClientWithStats[]>([])
  const [selectedClient, setSelectedClient] = useState<ClientWithStats | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)

  // Service name
  const [serviceSelect, setServiceSelect] = useState('')
  const [customName, setCustomName] = useState('')
  const finalServiceName = serviceSelect === 'custom' ? customName : serviceSelect

  // Pricing
  const [unitPriceOrig, setUnitPriceOrig] = useState('')   // 單堂原價
  const [totalSessions, setTotalSessions] = useState('1')  // 總堂數
  const [discountPct, setDiscountPct]     = useState('')    // 折扣 (e.g. 88 → 88折)
  const [discountedTotal, setDiscountedTotal] = useState('') // 優惠總價
  const [lastEdited, setLastEdited] = useState<'pct' | 'total' | null>(null)

  // Other fields
  const [paymentMethod, setPaymentMethod] = useState('現金')
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' }))
  const [note, setNote] = useState('')
  const [inclAccum, setInclAccum] = useState(true)
  const [inclPoints, setInclPoints] = useState(true)

  // Derived values
  const origTotal   = Number(unitPriceOrig) * Number(totalSessions)  // 原價小計
  const discTotal   = Number(discountedTotal) || 0                    // 優惠總價（最終預收）
  const unitBooking = discTotal > 0 && Number(totalSessions) > 0      // 記帳單堂價
    ? Math.round(discTotal / Number(totalSessions))
    : (Number(unitPriceOrig) || 0)
  const prepaid = discTotal > 0 ? discTotal : origTotal               // 預收金額

  // 折扣 ↔ 優惠總價 互相聯動
  useEffect(() => {
    if (lastEdited !== 'pct') return
    const pct = Number(discountPct)
    if (origTotal > 0 && pct > 0 && pct <= 100) {
      setDiscountedTotal(String(Math.round(origTotal * pct / 100)))
    }
  }, [discountPct, origTotal, lastEdited])

  useEffect(() => {
    if (lastEdited !== 'total') return
    const tot = Number(discountedTotal)
    if (origTotal > 0 && tot > 0) {
      setDiscountPct(String(Math.round((tot / origTotal) * 100)))
    }
  }, [discountedTotal, origTotal, lastEdited])

  // Client search
  useEffect(() => {
    if (presetClientId) {
      fetch(`/api/clients/${presetClientId}`)
        .then(r => r.json())
        .then(d => { setSelectedClient(d); setClientSearch(d.name) })
    }
  }, [presetClientId])

  const searchClients = useCallback(async (q: string) => {
    if (!q) { setClients([]); return }
    setClients(await (await fetch(`/api/clients?q=${encodeURIComponent(q)}`)).json())
  }, [])

  useEffect(() => {
    if (selectedClient) return
    const t = setTimeout(() => searchClients(clientSearch), 250)
    return () => clearTimeout(t)
  }, [clientSearch, searchClients, selectedClient])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedClient)   { setError('請選擇客人'); return }
    if (!finalServiceName) { setError('請選擇或輸入服務名稱'); return }
    if (!unitPriceOrig)    { setError('請輸入單堂原價'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: selectedClient.id,
          service_name: finalServiceName,
          total_sessions: Number(totalSessions),
          unit_price: unitBooking,
          unit_price_orig: Number(unitPriceOrig) || 0,
          prepaid_amount: prepaid,
          payment_method: paymentMethod,
          date, note,
          include_in_accumulation: inclAccum,
          include_in_points: inclPoints,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || '發生錯誤'); return }
      router.push(`/clients/${selectedClient.id}`)
    } catch { setError('網路錯誤') } finally { setSaving(false) }
  }

  const hasDiscount = discTotal > 0 && discTotal !== origTotal
  const discountRate = origTotal > 0 && discTotal > 0
    ? Math.round((discTotal / origTotal) * 100)
    : null

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 pt-2">
        <Link href="/packages" style={{ color: '#9a8f84', fontSize: '0.9rem' }}>← 套組</Link>
        <h1 style={{ color: '#2c2825', fontSize: '1.2rem', fontWeight: 500 }}>新增套組</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* ── 客人 ── */}
        <Field label="客人 *">
          {selectedClient ? (
            <div style={{ ...iStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#2c2825' }}>{selectedClient.name}</span>
                <MembershipBadge tier={selectedClient.level as MembershipLevel} />
              </div>
              <button type="button" onClick={() => { setSelectedClient(null); setClientSearch('') }}
                style={{ color: '#9a8f84', fontSize: '0.8rem', background: 'none', border: 'none', cursor: 'pointer' }}>
                更換
              </button>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <input value={clientSearch}
                onChange={e => { setClientSearch(e.target.value); setShowDropdown(true) }}
                onFocus={() => setShowDropdown(true)}
                placeholder="搜尋客人…" style={iStyle} />
              {showDropdown && clients.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '0 0 6px 6px', zIndex: 10 }}>
                  {clients.map(c => (
                    <button key={c.id} type="button"
                      onClick={() => { setSelectedClient(c); setClientSearch(c.name); setShowDropdown(false) }}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'none', border: 'none', borderBottom: '1px solid #f0ebe4', cursor: 'pointer', textAlign: 'left' }}>
                      <span style={{ color: '#2c2825' }}>{c.name}</span>
                      <MembershipBadge tier={c.level as MembershipLevel} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </Field>

        {/* ── 服務名稱 ── */}
        <Field label="服務名稱 *">
          <select value={serviceSelect} onChange={e => setServiceSelect(e.target.value)} style={iStyle}>
            <option value="">請選擇服務…</option>
            {SERVICE_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
            <option value="custom">自定義…</option>
          </select>
          {serviceSelect === 'custom' && (
            <input value={customName} onChange={e => setCustomName(e.target.value)}
              placeholder="輸入服務名稱" style={{ ...iStyle, marginTop: '6px' }} autoFocus />
          )}
        </Field>

        {/* ── 定價計算區塊 ── */}
        <div style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '8px', padding: '14px' }}
          className="space-y-3">
          <p style={{ color: '#6b5f54', fontSize: '0.78rem', letterSpacing: '0.06em' }}>定價設定</p>

          {/* 單堂原價 + 總堂數 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Field label="單堂原價 *">
              <input value={unitPriceOrig} onChange={e => setUnitPriceOrig(e.target.value)}
                type="number" min="0" placeholder="例：2500" style={iStyle} />
            </Field>
            <Field label="總堂數 *">
              <input value={totalSessions} onChange={e => setTotalSessions(e.target.value)}
                type="number" min="1" style={iStyle} />
            </Field>
          </div>

          {/* 原價小計（顯示用） */}
          {origTotal > 0 && (
            <div style={{ background: '#f0ede8', borderRadius: '6px', padding: '8px 12px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#9a8f84', fontSize: '0.78rem' }}>原價小計</span>
              <span style={{ color: '#6b5f54', fontSize: '0.88rem', fontWeight: 500 }}>
                $ {origTotal.toLocaleString()}
                <span style={{ color: '#b4aa9e', fontSize: '0.72rem', marginLeft: '6px' }}>
                  （{unitPriceOrig} × {totalSessions} 堂）
                </span>
              </span>
            </div>
          )}

          {/* 折扣 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Field label="折扣（選填）">
              <div style={{ position: 'relative' }}>
                <input value={discountPct}
                  onChange={e => { setDiscountPct(e.target.value); setLastEdited('pct') }}
                  type="number" min="1" max="100" placeholder="例：88"
                  style={iStyle} />
                <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9a8f84', fontSize: '0.82rem', pointerEvents: 'none' }}>
                  折
                </span>
              </div>
            </Field>
            <Field label="優惠總價（選填）">
              <input value={discountedTotal}
                onChange={e => { setDiscountedTotal(e.target.value); setLastEdited('total') }}
                type="number" min="0" placeholder="例：6600"
                style={iStyle} />
            </Field>
          </div>

          {/* 計算結果 */}
          <div style={{ background: hasDiscount ? '#edf3eb' : '#f0ede8', border: `1px solid ${hasDiscount ? '#9ab89e' : '#d9d0c5'}`, borderRadius: '6px', padding: '10px 12px' }}
            className="space-y-1">
            {hasDiscount && discountRate !== null && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b5f54', fontSize: '0.75rem' }}>折扣</span>
                <span style={{ color: '#4a6b52', fontSize: '0.8rem', fontWeight: 500 }}>{discountRate} 折</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b5f54', fontSize: '0.75rem' }}>記帳單堂價</span>
              <span style={{ color: hasDiscount ? '#4a6b52' : '#2c2825', fontSize: '0.88rem', fontWeight: 600 }}>
                $ {unitBooking.toLocaleString()}
                {hasDiscount && Number(unitPriceOrig) > 0 && (
                  <span style={{ color: '#9a8f84', fontSize: '0.7rem', marginLeft: '5px', textDecoration: 'line-through' }}>
                    {Number(unitPriceOrig).toLocaleString()}
                  </span>
                )}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '6px', marginTop: '4px' }}>
              <span style={{ color: '#6b5f54', fontSize: '0.78rem', fontWeight: 500 }}>預收金額</span>
              <span style={{ color: '#2c2825', fontSize: '1rem', fontWeight: 700 }}>
                $ {prepaid.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* ── 付款方式 ── */}
        <Field label="付款方式">
          <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} style={iStyle}>
            {PKG_PAY_METHODS.map(m => <option key={m}>{m}</option>)}
          </select>
        </Field>

        {/* ── 購買日期 ── */}
        <Field label="購買日期">
          <input value={date} onChange={e => setDate(e.target.value)} type="date" style={iStyle} />
        </Field>

        {/* ── 備註 ── */}
        <Field label="備註">
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="選填" style={iStyle} />
        </Field>

        {/* ── 計算設定 ── */}
        <div style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '6px', padding: '12px' }} className="space-y-2">
          <p style={{ color: '#6b5f54', fontSize: '0.78rem', letterSpacing: '0.06em', marginBottom: '6px' }}>計算設定</p>
          {[
            { key: 'inclAccum',  val: inclAccum,  set: setInclAccum,  label: '列入年度消費累積（升等用）' },
            { key: 'inclPoints', val: inclPoints, set: setInclPoints, label: '計入金米點數' },
          ].map(row => (
            <label key={row.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={row.val} onChange={e => row.set(e.target.checked)}
                style={{ accentColor: '#6b5f54', width: '15px', height: '15px' }} />
              <span style={{ color: '#2c2825', fontSize: '0.85rem' }}>{row.label}</span>
            </label>
          ))}
        </div>

        {error && (
          <p style={{ color: '#9a4a4a', fontSize: '0.85rem', background: '#fdf0f0', border: '1px solid #e8a8a8', borderRadius: '5px' }}
            className="px-3 py-2">{error}</p>
        )}

        <button type="submit" disabled={saving || !selectedClient || !finalServiceName || !unitPriceOrig}
          style={{
            width: '100%',
            background: saving || !selectedClient || !finalServiceName || !unitPriceOrig ? '#c4b8aa' : '#2c2825',
            color: '#f7f4ef', border: 'none', borderRadius: '6px',
            fontSize: '0.95rem', padding: '12px',
            cursor: saving || !selectedClient || !finalServiceName || !unitPriceOrig ? 'not-allowed' : 'pointer',
          }}>
          {saving ? '建立中…' : `建立套組　$ ${prepaid.toLocaleString()}`}
        </button>
      </form>
    </div>
  )
}

export default function NewPackagePage() {
  return <Suspense><NewPackageForm /></Suspense>
}

const iStyle: React.CSSProperties = {
  width: '100%', background: '#faf8f5', border: '1px solid #e0d9d0',
  borderRadius: '6px', color: '#2c2825', fontSize: '0.9rem', outline: 'none', padding: '10px 14px',
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label style={{ color: '#6b5f54', fontSize: '0.78rem', letterSpacing: '0.06em' }}>{label}</label>
      {children}
    </div>
  )
}
