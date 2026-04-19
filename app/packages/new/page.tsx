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

function addMonths(dateStr: string, n: number) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setMonth(d.getMonth() + n)
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
}

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
  const [discountMode, setDiscountMode]   = useState<'折數' | '折價'>('折數')
  const [discountPct, setDiscountPct]     = useState('')    // 折扣 (e.g. 88 → 88折)
  const [discountFlat, setDiscountFlat]   = useState('')    // 折扣金額 (e.g. 420 → 減420元)
  const [discountedTotal, setDiscountedTotal] = useState('') // 優惠總價
  const [lastEdited, setLastEdited] = useState<'pct' | 'flat' | 'total' | null>(null)

  // Other fields
  const [paymentMethod, setPaymentMethod] = useState('現金')
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' }))
  const [note, setNote] = useState('')
  const [inclAccum, setInclAccum] = useState(true)
  const [inclPoints, setInclPoints] = useState(true)

  // 分期設定
  interface InstPeriod { due_date: string; amount: string }
  const [instPeriods, setInstPeriods] = useState<InstPeriod[]>([])
  const [instPayMethod, setInstPayMethod] = useState('現金')

  // 當付款方式切換為分期時，自動產生預設期數
  useEffect(() => {
    if (paymentMethod !== '分期') { setInstPeriods([]); return }
    if (instPeriods.length > 0) return  // 已有設定，不覆蓋
    const totalAmt = prepaid
    if (totalAmt <= 0) return
    const periods = 3
    const base = Math.floor(totalAmt / periods)
    const rem  = totalAmt - base * (periods - 1)
    setInstPeriods(Array.from({ length: periods }, (_, i) => ({
      due_date: addMonths(date, i),
      amount: String(i === periods - 1 ? rem : base),
    })))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentMethod])

  // Derived values
  const origTotal   = Number(unitPriceOrig) * Number(totalSessions)  // 原價小計
  const discTotal   = Number(discountedTotal) || 0                    // 優惠總價（最終預收）
  const unitBooking = discTotal > 0 && Number(totalSessions) > 0      // 記帳單堂價
    ? Math.round(discTotal / Number(totalSessions))
    : (Number(unitPriceOrig) || 0)
  const prepaid = discTotal > 0 ? discTotal : origTotal               // 預收金額

  // 折數 → 優惠總價
  useEffect(() => {
    if (discountMode !== '折數' || lastEdited !== 'pct') return
    const pct = Number(discountPct)
    if (origTotal > 0 && pct > 0 && pct <= 100)
      setDiscountedTotal(String(Math.round(origTotal * pct / 100)))
  }, [discountPct, origTotal, lastEdited, discountMode])

  // 折價 → 優惠總價
  useEffect(() => {
    if (discountMode !== '折價' || lastEdited !== 'flat') return
    const flat = Number(discountFlat)
    if (origTotal > 0 && flat >= 0)
      setDiscountedTotal(String(Math.max(0, origTotal - flat)))
  }, [discountFlat, origTotal, lastEdited, discountMode])

  // 優惠總價 → 反算折扣輸入
  useEffect(() => {
    if (lastEdited !== 'total') return
    const tot = Number(discountedTotal)
    if (origTotal > 0 && tot > 0) {
      if (discountMode === '折數')
        setDiscountPct(String(Math.round((tot / origTotal) * 100)))
      else
        setDiscountFlat(String(Math.max(0, origTotal - tot)))
    }
  }, [discountedTotal, origTotal, lastEdited, discountMode])

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
    if (paymentMethod === '分期') {
      if (instPeriods.length === 0) { setError('請設定分期期數'); return }
      if (instPeriods.some(p => !p.amount || !p.due_date)) { setError('請填寫所有分期金額和日期'); return }
      const instTotal = instPeriods.reduce((s, p) => s + Number(p.amount), 0)
      if (instTotal !== prepaid) { setError(`分期合計 $${instTotal.toLocaleString()} 與預收金額 $${prepaid.toLocaleString()} 不符`); return }
    }
    setSaving(true); setError('')
    try {
      // 1. 建立套組
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

      // 2. 若付款方式為分期，同步建立分期合約
      if (paymentMethod === '分期') {
        const cRes = await fetch('/api/contracts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: selectedClient.id,
            payment_method: instPayMethod,
            note: `套組：${finalServiceName}`,
            periods: instPeriods.map(p => ({ due_date: p.due_date, amount: Number(p.amount) })),
          }),
        })
        if (!cRes.ok) { setError('套組建立成功，但分期合約建立失敗'); return }
      }

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
          <div className="space-y-2">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#9a8f84', fontSize: '0.72rem' }}>折扣方式</span>
              {(['折數', '折價'] as const).map(mode => (
                <button key={mode} type="button"
                  onClick={() => { setDiscountMode(mode); setDiscountPct(''); setDiscountFlat(''); setDiscountedTotal(''); setLastEdited(null) }}
                  style={{
                    background: discountMode === mode ? '#2c2825' : '#f0ebe4',
                    color: discountMode === mode ? '#f7f4ef' : '#6b5f54',
                    border: 'none', borderRadius: '4px',
                    fontSize: '0.72rem', padding: '3px 10px', cursor: 'pointer',
                  }}>
                  {mode}
                </button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {discountMode === '折數' ? (
                <Field label="折數（選填）">
                  <div style={{ position: 'relative' }}>
                    <input value={discountPct}
                      onChange={e => { setDiscountPct(e.target.value); setLastEdited('pct') }}
                      type="number" min="1" max="100" placeholder="例：88"
                      style={iStyle} />
                    <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9a8f84', fontSize: '0.82rem', pointerEvents: 'none' }}>折</span>
                  </div>
                </Field>
              ) : (
                <Field label="折扣金額（選填）">
                  <div style={{ position: 'relative' }}>
                    <input value={discountFlat}
                      onChange={e => { setDiscountFlat(e.target.value); setLastEdited('flat') }}
                      type="number" min="0" placeholder="例：420"
                      style={iStyle} />
                    <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9a8f84', fontSize: '0.82rem', pointerEvents: 'none' }}>元</span>
                  </div>
                </Field>
              )}
              <Field label="優惠總價（選填）">
                <input value={discountedTotal}
                  onChange={e => { setDiscountedTotal(e.target.value); setLastEdited('total') }}
                  type="number" min="0" placeholder="例：6600"
                  style={iStyle} />
              </Field>
            </div>
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

        {/* ── 分期設定（付款方式為分期時展開）── */}
        {paymentMethod === '分期' && (
          <div style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '8px', padding: '14px' }}
            className="space-y-3">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ color: '#6b5f54', fontSize: '0.78rem', letterSpacing: '0.06em' }}>分期設定</p>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[2,3,4,6].map(n => (
                  <button key={n} type="button"
                    onClick={() => {
                      const totalAmt = prepaid
                      const base = Math.floor(totalAmt / n)
                      const rem  = totalAmt - base * (n - 1)
                      setInstPeriods(Array.from({ length: n }, (_, i) => ({
                        due_date: addMonths(date, i),
                        amount: String(i === n - 1 ? rem : base),
                      })))
                    }}
                    style={{ background: instPeriods.length === n ? '#2c2825' : '#f0ebe4', color: instPeriods.length === n ? '#f7f4ef' : '#6b5f54', border: 'none', borderRadius: '4px', fontSize: '0.72rem', padding: '3px 10px', cursor: 'pointer' }}>
                    {n}期
                  </button>
                ))}
              </div>
            </div>

            {/* 分期付款方式 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <Field label="每期付款方式">
                <select value={instPayMethod} onChange={e => setInstPayMethod(e.target.value)} style={iStyle}>
                  {['現金','匯款','LINE Pay'].map(m => <option key={m}>{m}</option>)}
                </select>
              </Field>
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '2px' }}>
                <span style={{ color: instPeriods.reduce((s,p)=>s+Number(p.amount),0) === prepaid ? '#4a6b52' : '#9a4a4a', fontSize: '0.78rem' }}>
                  合計 ${instPeriods.reduce((s,p)=>s+Number(p.amount),0).toLocaleString()}
                  {instPeriods.reduce((s,p)=>s+Number(p.amount),0) !== prepaid && ` ≠ $${prepaid.toLocaleString()}`}
                </span>
              </div>
            </div>

            {/* 各期明細 */}
            {instPeriods.map((p, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr auto', gap: '8px', alignItems: 'center' }}>
                <span style={{ color: '#9a8f84', fontSize: '0.78rem', minWidth: '32px' }}>第{i+1}期</span>
                <input value={p.due_date}
                  onChange={e => setInstPeriods(ps => ps.map((x,j) => j===i ? {...x, due_date: e.target.value} : x))}
                  type="date" style={iStyle} />
                <input value={p.amount}
                  onChange={e => setInstPeriods(ps => ps.map((x,j) => j===i ? {...x, amount: e.target.value} : x))}
                  type="number" min="0" style={iStyle} />
                <button type="button"
                  onClick={() => setInstPeriods(ps => ps.filter((_,j) => j!==i))}
                  style={{ color: '#9a4a4a', background: 'none', border: 'none', fontSize: '1rem', cursor: 'pointer', padding: '0 4px' }}>×</button>
              </div>
            ))}
            <button type="button"
              onClick={() => setInstPeriods(ps => [...ps, { due_date: addMonths(date, ps.length), amount: '' }])}
              style={{ color: '#9a8f84', background: 'none', border: '1px dashed #e0d9d0', borderRadius: '5px', fontSize: '0.78rem', padding: '5px 0', width: '100%', cursor: 'pointer' }}>
              ＋ 新增一期
            </button>
          </div>
        )}

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
