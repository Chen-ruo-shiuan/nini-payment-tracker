'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { PAYMENT_METHODS, ClientWithStats, MembershipLevel } from '@/types'
import MembershipBadge from '@/components/MembershipBadge'

function uid() { return Math.random().toString(36).slice(2) }

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

  // Payment (multi-method support; 分期 is handled as a special single-method case)
  interface PkgPay { id: string; method: string; amount: string }
  const [pkgPays, setPkgPays] = useState<PkgPay[]>([{ id: uid(), method: '現金', amount: '' }])
  const paymentMethod = pkgPays[0]?.method || '現金'  // for backward compat / 分期 detection
  const setPaymentMethod = (m: string) => setPkgPays(prev => [{ ...prev[0], method: m }, ...prev.slice(1)])
  const PKG_ROW_METHODS = PAYMENT_METHODS.filter(m => !['核銷', '商品券', '分期'].includes(m))

  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' }))
  const [note, setNote] = useState('')
  const [inclAccum, setInclAccum] = useState(true)
  const [inclPoints, setInclPoints] = useState(true)

  // 完成鼓勵
  const [completionBonusDesc, setCompletionBonusDesc]       = useState('')
  const [completionBonusService, setCompletionBonusService] = useState('')
  const [completionBonusPrice, setCompletionBonusPrice]     = useState('')
  const [completionWeeks, setCompletionWeeks]               = useState('')
  const [showCompletion, setShowCompletion]                 = useState(false)
  const [cbTemplateLoaded, setCbTemplateLoaded]             = useState(false)  // 是否已套用範本

  // localStorage 範本：依服務名稱儲存完成鼓勵設定
  const CB_KEY = (svcName: string) => `nini_cb_${svcName}`

  function saveCbTemplate(svcName: string) {
    if (!svcName || (!completionBonusService && !completionWeeks)) return
    try {
      localStorage.setItem(CB_KEY(svcName), JSON.stringify({
        service: completionBonusService,
        price:   completionBonusPrice,
        weeks:   completionWeeks,
        desc:    completionBonusDesc,
      }))
    } catch { /* ignore */ }
  }

  function loadCbTemplate(svcName: string): boolean {
    try {
      const raw = localStorage.getItem(CB_KEY(svcName))
      if (!raw) return false
      const t = JSON.parse(raw)
      setCompletionBonusService(t.service || '')
      setCompletionBonusPrice(t.price || '')
      setCompletionWeeks(t.weeks || '')
      setCompletionBonusDesc(t.desc || '')
      return true
    } catch { return false }
  }

  // 展開完成鼓勵 + 服務名稱已定時，自動套用上次同服務的設定
  useEffect(() => {
    if (!showCompletion || !finalServiceName) return
    // 只在欄位全空時才自動套用（避免覆蓋手動輸入）
    if (completionBonusService || completionBonusPrice || completionWeeks) return
    const loaded = loadCbTemplate(finalServiceName)
    setCbTemplateLoaded(loaded)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCompletion, finalServiceName])

  // 鼓勵任務
  const [bonusDesc, setBonusDesc]           = useState('')        // 贈品說明
  const [timingNote, setTimingNote]         = useState('')        // 回訪週期顯示文字
  const [timingMaxWeeks, setTimingMaxWeeks] = useState('')        // 最長週數（計算用）
  const [expiryDate, setExpiryDate]         = useState('')        // 建議使用期限
  const [showTask, setShowTask]             = useState(false)     // 展開/收起
  const [taskTemplateLoaded, setTaskTemplateLoaded] = useState(false)

  const TASK_KEY = (svcName: string) => `nini_task_${svcName}`

  function saveTaskTemplate(svcName: string) {
    if (!svcName || (!bonusDesc && !timingNote && !timingMaxWeeks)) return
    try {
      localStorage.setItem(TASK_KEY(svcName), JSON.stringify({
        bonusDesc, timingNote, timingMaxWeeks,
      }))
    } catch { /* ignore */ }
  }

  function loadTaskTemplate(svcName: string): boolean {
    try {
      const raw = localStorage.getItem(TASK_KEY(svcName))
      if (!raw) return false
      const t = JSON.parse(raw)
      setBonusDesc(t.bonusDesc || '')
      setTimingNote(t.timingNote || '')
      setTimingMaxWeeks(t.timingMaxWeeks || '')
      return true
    } catch { return false }
  }

  // 展開鼓勵任務 + 服務名稱已定時，自動套用同服務上次設定
  useEffect(() => {
    if (!showTask || !finalServiceName) return
    if (bonusDesc || timingNote || timingMaxWeeks) return
    const loaded = loadTaskTemplate(finalServiceName)
    setTaskTemplateLoaded(loaded)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTask, finalServiceName])

  // 購買日改變時，自動更新期限預設（6個月後）
  function autoExpiry(d: string) {
    if (!d) return ''
    const dt = new Date(d + 'T00:00:00')
    dt.setMonth(dt.getMonth() + 6)
    return dt.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
  }

  // 分期設定
  interface InstPeriod { due_date: string; amount: string }
  const [instPeriods, setInstPeriods] = useState<InstPeriod[]>([])
  const [instPayMethod, setInstPayMethod] = useState('現金')

  // 分期模式：新建 or 加入現有
  type InstMode = 'new' | 'existing'
  const [instMode, setInstMode] = useState<InstMode>('new')
  interface ExistingContract { id: number; note: string | null; total_amount: number; remaining_amount: number; unpaid_count: number; total_periods: number; next_due_date: string | null }
  const [existingContracts, setExistingContracts] = useState<ExistingContract[]>([])
  const [selectedContractId, setSelectedContractId] = useState<number | null>(null)
  // 加入現有計劃時，要新增到合約的期數
  const [addPeriods, setAddPeriods] = useState<InstPeriod[]>([])

  // 當切換到「加入現有」時，撈取該客人的進行中分期計劃
  useEffect(() => {
    if (paymentMethod !== '分期' || instMode !== 'existing' || !selectedClient) {
      setExistingContracts([]); setSelectedContractId(null); setAddPeriods([]); return
    }
    fetch(`/api/contracts?client_id=${selectedClient.id}&status=active`)
      .then(r => r.json())
      .then((data: ExistingContract[]) => {
        setExistingContracts(data)
        if (data.length > 0) setSelectedContractId(data[0].id)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instMode, paymentMethod, selectedClient])

  // Derived values（必須在使用 prepaid 的 useEffect 之前宣告）
  const origTotal   = Number(unitPriceOrig) * Number(totalSessions)  // 原價小計
  const discTotal   = Number(discountedTotal) || 0                    // 優惠總價（最終預收）
  const unitBooking = discTotal > 0 && Number(totalSessions) > 0      // 記帳單堂價
    ? Math.round(discTotal / Number(totalSessions))
    : (Number(unitPriceOrig) || 0)
  const prepaid = discTotal > 0 ? discTotal : origTotal               // 預收金額

  // 選好合約 / prepaid 改變時，自動預填此套組的新增期數（1期 = 全額）
  useEffect(() => {
    if (instMode !== 'existing' || !selectedContractId || prepaid <= 0) { setAddPeriods([]); return }
    setAddPeriods([{ due_date: addMonths(date, 0), amount: String(prepaid) }])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedContractId, prepaid, instMode])

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
    if (paymentMethod === '分期' && instMode === 'new') {
      if (instPeriods.length === 0) { setError('請設定分期期數'); return }
      if (instPeriods.some(p => !p.amount || !p.due_date)) { setError('請填寫所有分期金額和日期'); return }
      const instTotal = instPeriods.reduce((s, p) => s + Number(p.amount), 0)
      if (instTotal !== prepaid) { setError(`分期合計 $${instTotal.toLocaleString()} 與預收金額 $${prepaid.toLocaleString()} 不符`); return }
    }
    if (paymentMethod === '分期' && instMode === 'existing') {
      if (!selectedContractId) { setError('請選擇要加入的分期計劃'); return }
    }
    setSaving(true); setError('')
    try {
      // 1. 建立套組
      // Build payments array; for 分期 keep legacy single-method field
      const payLoaded = paymentMethod === '分期'
        ? [{ method: '分期', amount: prepaid }]
        : pkgPays.filter(p => p.amount !== '' && Number(p.amount) > 0).map(p => ({ method: p.method, amount: Number(p.amount) }))

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
          payments: payLoaded,
          date, note,
          include_in_accumulation: inclAccum,
          include_in_points: inclPoints,
          bonus_desc:            bonusDesc            || null,
          timing_note:           timingNote           || null,
          timing_max_weeks:      timingMaxWeeks       ? Number(timingMaxWeeks) : null,
          expiry_date:           expiryDate           || null,
          completion_bonus_desc:    completionBonusDesc    || null,
          completion_bonus_service: completionBonusService || null,
          completion_bonus_price:   completionBonusPrice   ? Number(completionBonusPrice) : null,
          completion_weeks:         completionWeeks        ? Number(completionWeeks) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || '發生錯誤'); return }

      // 若有填寫完成鼓勵，儲存為此服務名稱的範本
      if (showCompletion && finalServiceName && (completionBonusService || completionWeeks)) {
        saveCbTemplate(finalServiceName)
      }
      // 若有填寫鼓勵任務，儲存為此服務名稱的範本
      if (showTask && finalServiceName && (bonusDesc || timingNote || timingMaxWeeks)) {
        saveTaskTemplate(finalServiceName)
      }

      // 2. 若付款方式為分期
      if (paymentMethod === '分期') {
        if (instMode === 'new') {
          // 新建分期合約
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
        if (instMode === 'existing' && selectedContractId) {
          // 將此套組金額平均分攤到現有未收期數
          const pRes = await fetch(`/api/contracts/${selectedContractId}/periods`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: prepaid }),
          })
          if (!pRes.ok) { setError('套組建立成功，但更新分期金額失敗'); return }
        }
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
              <button type="button" onClick={() => { setSelectedClient(null); setClientSearch(''); setInstMode('new'); setExistingContracts([]); setSelectedContractId(null) }}
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

        {/* ── 付款方式（多元付款）── */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label style={{ color: '#9a8f84', fontSize: '0.8rem' }}>付款方式</label>
            {paymentMethod !== '分期' && (
              <button type="button"
                onClick={() => setPkgPays(prev => [...prev, { id: uid(), method: '現金', amount: '' }])}
                style={{ color: '#6b5f54', fontSize: '0.72rem', background: 'none', border: '1px solid #d9d0c5', borderRadius: '4px', padding: '2px 9px', cursor: 'pointer' }}>
                + 加入付款
              </button>
            )}
          </div>

          {/* 分期模式：保留原本單選 */}
          {paymentMethod === '分期' ? (
            <select value="分期" onChange={e => setPaymentMethod(e.target.value)} style={iStyle}>
              {PKG_PAY_METHODS.map(m => <option key={m}>{m}</option>)}
            </select>
          ) : (
            <div className="space-y-2">
              {pkgPays.map((pay, idx) => {
                const remaining = prepaid - pkgPays.filter((_, i) => i !== idx).reduce((s, p) => s + (Number(p.amount) || 0), 0)
                return (
                  <div key={pay.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '6px', alignItems: 'center' }}>
                    <select value={pay.method}
                      onChange={e => {
                        const m = e.target.value
                        if (m === '分期') {
                          setPaymentMethod('分期')
                          setPkgPays([{ id: uid(), method: '分期', amount: String(prepaid) }])
                        } else {
                          setPkgPays(prev => prev.map(p => p.id === pay.id ? { ...p, method: m } : p))
                        }
                      }}
                      style={iStyle}>
                      {PKG_PAY_METHODS.map(m => <option key={m}>{m}</option>)}
                      <option value="分期">分期</option>
                    </select>
                    <div style={{ position: 'relative' }}>
                      <input value={pay.amount}
                        onChange={e => setPkgPays(prev => prev.map(p => p.id === pay.id ? { ...p, amount: e.target.value } : p))}
                        onFocus={() => {
                          if (pay.amount === '' && remaining > 0)
                            setPkgPays(prev => prev.map(p => p.id === pay.id ? { ...p, amount: String(remaining) } : p))
                        }}
                        type="number" min="0" placeholder={`$ ${remaining.toLocaleString()}`} style={iStyle} />
                    </div>
                    {pkgPays.length > 1 && (
                      <button type="button"
                        onClick={() => setPkgPays(prev => prev.filter(p => p.id !== pay.id))}
                        style={{ color: '#c4b8aa', background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', padding: '0 2px' }}>
                        ×
                      </button>
                    )}
                  </div>
                )
              })}
              {/* Payment total vs prepaid check */}
              {(() => {
                const payTotal = pkgPays.reduce((s, p) => s + (Number(p.amount) || 0), 0)
                const diff = prepaid - payTotal
                if (prepaid <= 0 || pkgPays.length <= 1) return null
                return (
                  <div style={{ fontSize: '0.72rem', color: diff === 0 ? '#4a6b52' : '#9a4a4a', background: diff === 0 ? '#edf3eb' : '#fdf0f0', border: `1px solid ${diff === 0 ? '#9ab89e' : '#e8a8a8'}`, borderRadius: '4px', padding: '4px 10px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>付款合計</span>
                    <span>{diff === 0 ? `✓ $${payTotal.toLocaleString()} 已全額` : `$${payTotal.toLocaleString()} / 應付 $${prepaid.toLocaleString()}（差 $${Math.abs(diff).toLocaleString()}）`}</span>
                  </div>
                )
              })()}
            </div>
          )}
        </div>

        {/* ── 分期設定（付款方式為分期時展開）── */}
        {paymentMethod === '分期' && (
          <div style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '8px', padding: '14px' }}
            className="space-y-3">
            <p style={{ color: '#6b5f54', fontSize: '0.78rem', letterSpacing: '0.06em' }}>分期設定</p>

            {/* 新建 / 加入現有 切換 */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {([['new','新建分期計劃'],['existing','加入現有計劃']] as const).map(([mode, label]) => (
                <button key={mode} type="button"
                  onClick={() => { setInstMode(mode); if (mode === 'new') { setSelectedContractId(null) } }}
                  style={{
                    background: instMode === mode ? '#2c2825' : '#f0ebe4',
                    color: instMode === mode ? '#f7f4ef' : '#6b5f54',
                    border: 'none', borderRadius: '5px',
                    fontSize: '0.78rem', padding: '5px 14px', cursor: 'pointer',
                  }}>
                  {label}
                </button>
              ))}
            </div>

            {/* ── 加入現有計劃 ── */}
            {instMode === 'existing' && (
              <div className="space-y-2">
                {!selectedClient ? (
                  <p style={{ color: '#b4aa9e', fontSize: '0.78rem' }}>請先選擇客人</p>
                ) : existingContracts.length === 0 ? (
                  <p style={{ color: '#9a4a4a', fontSize: '0.78rem', background: '#fdf0f0', border: '1px solid #e8a8a8', borderRadius: '5px', padding: '8px 12px' }}>
                    此客人目前沒有進行中的分期計劃，請改用「新建分期計劃」
                  </p>
                ) : (
                  <>
                    <p style={{ color: '#9a8f84', fontSize: '0.72rem' }}>選擇要加入的分期計劃：</p>
                    {existingContracts.map(c => (
                      <button key={c.id} type="button"
                        onClick={() => setSelectedContractId(c.id)}
                        style={{
                          width: '100%', textAlign: 'left', padding: '10px 12px',
                          background: selectedContractId === c.id ? '#edf3eb' : '#f5f2ee',
                          border: `1px solid ${selectedContractId === c.id ? '#9ab89e' : '#e0d9d0'}`,
                          borderRadius: '6px', cursor: 'pointer',
                        }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <span style={{ color: '#2c2825', fontSize: '0.82rem', fontWeight: selectedContractId === c.id ? 600 : 400 }}>
                              {c.note || `分期計劃 #${c.id}`}
                            </span>
                            <div style={{ color: '#9a8f84', fontSize: '0.7rem', marginTop: '2px' }}>
                              尚餘 {c.unpaid_count} 期未收
                              {c.next_due_date && `　下期：${c.next_due_date}`}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ color: '#9a4a4a', fontSize: '0.78rem', fontWeight: 500 }}>
                              待收 ${(c.remaining_amount ?? 0).toLocaleString()}
                            </div>
                            <div style={{ color: '#b4aa9e', fontSize: '0.68rem' }}>
                              合計 ${c.total_amount.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                    {/* 分攤說明 */}
                    {selectedContractId && prepaid > 0 && (() => {
                      const sel = existingContracts.find(c => c.id === selectedContractId)
                      const unpaid = sel?.unpaid_count ?? 0
                      return (
                        <div style={{ borderTop: '1px dashed #e0d9d0', paddingTop: '10px', marginTop: '4px',
                          background: '#edf3eb', border: '1px solid #9ab89e', borderRadius: '6px', padding: '10px 12px' }}>
                          <p style={{ color: '#4a6b52', fontSize: '0.78rem', fontWeight: 500, marginBottom: '4px' }}>
                            建立後自動處理
                          </p>
                          {unpaid > 0 ? (
                            <p style={{ color: '#6b5f54', fontSize: '0.75rem' }}>
                              此套組 <strong>${prepaid.toLocaleString()}</strong> 將平均分攤到現有 {unpaid} 期未收款項中
                              （每期 +${Math.floor(prepaid / unpaid).toLocaleString()}）
                            </p>
                          ) : (
                            <p style={{ color: '#6b5f54', fontSize: '0.75rem' }}>
                              現有期數已全數收款，將自動新增一期 ${prepaid.toLocaleString()}
                            </p>
                          )}
                        </div>
                      )
                    })()}
                  </>
                )}
              </div>
            )}

            {/* ── 新建分期計劃 ── */}
            {instMode === 'new' && (<>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#9a8f84', fontSize: '0.72rem' }}>快速分期</span>
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
            </>)}
          </div>
        )}

        {/* ── 購買日期 ── */}
        <Field label="購買日期">
          <input value={date} onChange={e => {
            setDate(e.target.value)
            if (showTask) setExpiryDate(autoExpiry(e.target.value))
          }} type="date" style={iStyle} />
        </Field>

        {/* ── 備註 ── */}
        <Field label="備註">
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="選填" style={iStyle} />
        </Field>

        {/* ── 鼓勵任務（選填）── */}
        <div style={{ background: '#faf8f5', border: `1px solid ${showTask ? '#c4a8d8' : '#e0d9d0'}`, borderRadius: '8px', overflow: 'hidden' }}>
          <button type="button"
            onClick={() => {
              setShowTask(v => !v)
              if (!showTask && !expiryDate) setExpiryDate(autoExpiry(date))
            }}
            style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer' }}>
            <span style={{ color: showTask ? '#7a3d8a' : '#6b5f54', fontSize: '0.78rem', letterSpacing: '0.06em' }}>
              🎁 鼓勵任務（選填）
            </span>
            <span style={{ color: '#9a8f84', fontSize: '0.75rem' }}>{showTask ? '▲' : '▼'}</span>
          </button>
          {showTask && (
            <div style={{ borderTop: '1px solid #e8d8f0', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ color: '#9a8f84', fontSize: '0.72rem', margin: 0 }}>
                若客人確認可達標，建立時即啟動任務（首次施作起開始計算回訪倒數）
              </p>

              {/* 範本提示列 */}
              {taskTemplateLoaded && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f5eaf8', border: '1px solid #c4a0d8', borderRadius: '6px', padding: '7px 12px' }}>
                  <span style={{ color: '#7a3d8a', fontSize: '0.72rem' }}>✓ 已自動套用「{finalServiceName}」的上次設定</span>
                  <button type="button"
                    onClick={() => {
                      setBonusDesc('')
                      setTimingNote('')
                      setTimingMaxWeeks('')
                      setTaskTemplateLoaded(false)
                    }}
                    style={{ color: '#9a4a4a', background: 'none', border: 'none', fontSize: '0.7rem', cursor: 'pointer', padding: '0' }}>
                    清除重填
                  </button>
                </div>
              )}

              {/* 無範本但有儲存記錄時，顯示手動套用按鈕 */}
              {!taskTemplateLoaded && finalServiceName && (() => {
                try {
                  const raw = localStorage.getItem(TASK_KEY(finalServiceName))
                  if (!raw) return null
                  const t = JSON.parse(raw)
                  return (
                    <button type="button"
                      onClick={() => { loadTaskTemplate(finalServiceName); setTaskTemplateLoaded(true) }}
                      style={{ alignSelf: 'flex-start', color: '#7a3d8a', background: '#f5eaf8', border: '1px solid #c4a0d8', borderRadius: '5px', fontSize: '0.72rem', padding: '4px 10px', cursor: 'pointer' }}>
                      📋 套用上次「{t.bonusDesc || finalServiceName}」設定
                    </button>
                  )
                } catch { return null }
              })()}

              <Field label="贈品說明">
                <SelectOrInput
                  presets={BONUS_DESC_PRESETS}
                  value={bonusDesc}
                  onChange={v => { setBonusDesc(v); setTaskTemplateLoaded(false) }}
                  placeholder="輸入自訂贈品說明"
                />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <Field label="回訪週期（顯示用）">
                  <input value={timingNote} onChange={e => { setTimingNote(e.target.value); setTaskTemplateLoaded(false) }}
                    placeholder="例：3-4週" style={iStyle} />
                </Field>
                <Field label="最長週數（計算用）">
                  <input value={timingMaxWeeks} onChange={e => { setTimingMaxWeeks(e.target.value); setTaskTemplateLoaded(false) }}
                    type="number" min="1" placeholder="例：4" style={iStyle} />
                </Field>
              </div>

              <Field label="建議使用期限">
                <input value={expiryDate} onChange={e => setExpiryDate(e.target.value)}
                  type="date" style={iStyle} />
                <p style={{ color: '#b4aa9e', fontSize: '0.7rem', marginTop: '4px', margin: '4px 0 0' }}>
                  預設購買日起 6 個月（每次自動更新，不記憶）
                </p>
              </Field>

              {bonusDesc && (
                <div style={{ background: '#f5eaf8', border: '1px solid #c4a8d8', borderRadius: '6px', padding: '10px 12px', fontSize: '0.78rem', color: '#7a3d8a' }}>
                  🎁 {bonusDesc}
                  {timingNote && <span style={{ color: '#9a6ab0', marginLeft: '8px' }}>（{timingNote}回訪）</span>}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── 完成鼓勵（選填）── */}
        <div style={{ background: '#faf8f5', border: `1px solid ${showCompletion ? '#c4a0d8' : '#e0d9d0'}`, borderRadius: '8px', overflow: 'hidden' }}>
          <button type="button"
            onClick={() => setShowCompletion(v => !v)}
            style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer' }}>
            <span style={{ color: showCompletion ? '#7a4a9a' : '#6b5f54', fontSize: '0.78rem', letterSpacing: '0.06em' }}>
              🎯 完成鼓勵（選填）
            </span>
            <span style={{ color: '#9a8f84', fontSize: '0.75rem' }}>{showCompletion ? '▲' : '▼'}</span>
          </button>
          {showCompletion && (
            <div style={{ borderTop: '1px solid #e8d8f0', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ color: '#9a8f84', fontSize: '0.72rem', margin: 0 }}>
                在期限內完成全部堂數，即獲得附加課程（從開封日起算）
              </p>

              {/* 範本提示列 */}
              {cbTemplateLoaded && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f0ebf8', border: '1px solid #c4a0d8', borderRadius: '6px', padding: '7px 12px' }}>
                  <span style={{ color: '#7a4a9a', fontSize: '0.72rem' }}>✓ 已自動套用「{finalServiceName}」的上次設定</span>
                  <button type="button"
                    onClick={() => {
                      setCompletionBonusService('')
                      setCompletionBonusPrice('')
                      setCompletionWeeks('')
                      setCompletionBonusDesc('')
                      setCbTemplateLoaded(false)
                    }}
                    style={{ color: '#9a4a4a', background: 'none', border: 'none', fontSize: '0.7rem', cursor: 'pointer', padding: '0' }}>
                    清除重填
                  </button>
                </div>
              )}

              {/* 無範本時，若服務名稱已選可手動查找 */}
              {!cbTemplateLoaded && finalServiceName && (() => {
                try {
                  const raw = localStorage.getItem(CB_KEY(finalServiceName))
                  if (!raw) return null
                  // 有範本但欄位已有輸入（未觸發自動套用），顯示「套用上次」按鈕
                  const t = JSON.parse(raw)
                  return (
                    <button type="button"
                      onClick={() => { loadCbTemplate(finalServiceName); setCbTemplateLoaded(true) }}
                      style={{ alignSelf: 'flex-start', color: '#7a4a9a', background: '#f5eaf8', border: '1px solid #c4a0d8', borderRadius: '5px', fontSize: '0.72rem', padding: '4px 10px', cursor: 'pointer' }}>
                      📋 套用上次「{t.service || finalServiceName}」設定
                    </button>
                  )
                } catch { return null }
              })()}

              <Field label="附加課程名稱（商品券名稱）">
                <SelectOrInput
                  presets={COMPLETION_SERVICE_PRESETS}
                  value={completionBonusService}
                  onChange={v => { setCompletionBonusService(v); setCbTemplateLoaded(false) }}
                  placeholder="輸入自訂課程名稱"
                />
              </Field>
              <Field label="附加課程單價">
                <SelectOrInput
                  presets={COMPLETION_PRICE_PRESETS}
                  value={completionBonusPrice}
                  onChange={v => { setCompletionBonusPrice(v); setCbTemplateLoaded(false) }}
                  placeholder="輸入自訂金額"
                  type="number"
                />
              </Field>
              <Field label="附加說明（顯示用）">
                <input value={completionBonusDesc} onChange={e => { setCompletionBonusDesc(e.target.value); setCbTemplateLoaded(false) }}
                  placeholder="例：附加泡光氧彗（梅）$2,880" style={iStyle} />
              </Field>
              <Field label="完成期限（週）">
                <input value={completionWeeks} onChange={e => { setCompletionWeeks(e.target.value); setCbTemplateLoaded(false) }}
                  type="number" min="1" max="52" placeholder="例：8（= 約 2 個月）" style={iStyle} />
              </Field>
              {completionBonusService && completionWeeks && (
                <div style={{ background: '#f0ebf8', border: '1px solid #c4a8d8', borderRadius: '6px', padding: '10px 12px', fontSize: '0.78rem', color: '#7a4a9a' }}>
                  🎯 {completionWeeks} 週內完成所有堂數，可獲得：{completionBonusService}
                  {completionBonusPrice && <span style={{ marginLeft: '6px', color: '#9a6ab0' }}>${Number(completionBonusPrice).toLocaleString()}</span>}
                </div>
              )}
            </div>
          )}
        </div>

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

// ── 下拉選單 + 自訂義輸入 ──────────────────────────────────────────────────────
const BONUS_DESC_PRESETS = [
  'B5熱導+頸部',
  '臉部芳草精油+頸部',
  '臉部芳草精油撥筋',
  '原液調理一種',
  '原液調理一種+頸部+下頷線',
  '頭部刮舒+封膜',
]
const COMPLETION_SERVICE_PRESETS = ['泡光氧彗(梅)']
const COMPLETION_PRICE_PRESETS   = ['2880']

function SelectOrInput({
  presets, value, onChange, placeholder, type = 'text',
}: {
  presets: string[]
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: 'text' | 'number'
}) {
  const [customMode, setCustomMode] = useState(() => value !== '' && !presets.includes(value))

  useEffect(() => {
    if (presets.includes(value))    setCustomMode(false)
    else if (value !== '')          setCustomMode(true)
  }, [value, presets])

  const selectVal = customMode ? '__custom__' : value

  return (
    <div>
      <select
        value={selectVal}
        onChange={e => {
          if (e.target.value === '__custom__') { setCustomMode(true); onChange('') }
          else                                 { setCustomMode(false); onChange(e.target.value) }
        }}
        style={iStyle}
      >
        <option value="">— 請選擇 —</option>
        {presets.map(p => <option key={p} value={p}>{p}</option>)}
        <option value="__custom__">自訂義</option>
      </select>
      {customMode && (
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ ...iStyle, marginTop: '6px' }}
          autoFocus
          min={type === 'number' ? 0 : undefined}
        />
      )}
    </div>
  )
}
