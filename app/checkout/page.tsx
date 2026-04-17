'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import MembershipBadge from '@/components/MembershipBadge'
import { PAYMENT_METHODS, ClientWithStats, MembershipLevel, LEVEL_POINTS, YODOMO_THRESHOLD } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Item  { id: string; category: string; label: string; price: string; qty: number; pkg_id?: number; custom?: boolean }
interface Pay   { id: string; method: string; amount: string }
interface PkgOption { id: number; service_name: string; remaining: number; unit_price: number }

const PRESET_SERVICES  = ['精細光彩', '原液調理', '泡光氧彗', '小顏骨氣', '雨林頭療', '森林癒撥筋']
const PRESET_ADDONS    = ['全臉粉清', '深皮超導', '光波嫩膚', '臭氧離子']
const LS_PRODUCTS_KEY  = 'nini_custom_products'

function getStoredProducts(): string[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(LS_PRODUCTS_KEY) || '[]') } catch { return [] }
}
function saveProduct(name: string) {
  if (typeof window === 'undefined' || !name) return
  const list = getStoredProducts()
  if (!list.includes(name)) localStorage.setItem(LS_PRODUCTS_KEY, JSON.stringify([name, ...list].slice(0, 30)))
}
interface DailyCheckout {
  id: number; client_id: number | null; client_name: string | null
  date: string; note: string | null; total_amount: number
  incl_course: number; incl_product: number
  items: { id: number; category: string; label: string; price: number; qty: number; pkg_id?: number }[]
  payments: { id: number; method: string; amount: number }[]
}

const CATEGORIES = ['服務', '商品券', '產品', '加購', '活動'] as const
const PAY_METHODS = PAYMENT_METHODS.filter(m => !['分期', '核銷'].includes(m))

function uid() { return Math.random().toString(36).slice(2) }
function today() { return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' }) }

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtAmt = (n: number) => `$ ${n.toLocaleString()}`

export default function CheckoutPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ id: number; pointsEarned: number; yodomoEarned: number; totalAmount: number } | null>(null)

  // Daily log
  const [logDate, setLogDate] = useState(today())
  const [dailyLog, setDailyLog] = useState<DailyCheckout[]>([])
  const [logLoading, setLogLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // Log edit
  const [editingLogId, setEditingLogId] = useState<number | null>(null)
  const [editItems, setEditItems] = useState<Item[]>([])
  const [editPays, setEditPays] = useState<Pay[]>([])
  const [editNote, setEditNote] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editInclCourse, setEditInclCourse] = useState(true)
  const [editInclProduct, setEditInclProduct] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)

  const fetchDailyLog = useCallback(async (d: string) => {
    setLogLoading(true)
    try {
      const res = await fetch(`/api/checkouts?date=${d}&limit=100`)
      setDailyLog(await res.json())
    } finally {
      setLogLoading(false)
    }
  }, [])

  useEffect(() => { fetchDailyLog(logDate) }, [logDate, fetchDailyLog])

  async function deleteLog(id: number) {
    if (!confirm('確定刪除這筆結帳紀錄？')) return
    setDeletingId(id)
    await fetch(`/api/checkouts/${id}`, { method: 'DELETE' })
    setDeletingId(null)
    fetchDailyLog(logDate)
  }

  function startLogEdit(co: DailyCheckout) {
    setEditingLogId(co.id)
    setEditDate(co.date)
    setEditNote(co.note ?? '')
    setEditInclCourse(!!(co as DailyCheckout & { incl_course?: number }).incl_course)
    setEditInclProduct(!!(co as DailyCheckout & { incl_product?: number }).incl_product)
    setEditItems(co.items.map(i => ({
      id: uid(), category: i.category, label: i.label,
      price: String(i.price), qty: i.qty,
      pkg_id: (i as typeof i & { pkg_id?: number }).pkg_id,
    })))
    setEditPays(co.payments.map(p => ({
      id: uid(), method: p.method, amount: String(p.amount),
    })))
  }

  async function saveLogEdit(coId: number) {
    if (editItems.some(i => !i.label || !i.price)) { alert('請填寫完整品項名稱和金額'); return }
    const eTot = editItems.reduce((s, i) => s + (Number(i.price) || 0) * i.qty, 0)
    const pTot = editPays.reduce((s, p) => s + (Number(p.amount) || 0), 0)
    if (Math.round(eTot - pTot) !== 0) { alert(`付款金額與消費金額不符，差距 $${Math.abs(eTot - pTot).toLocaleString()}`); return }
    setSavingEdit(true)
    const res = await fetch(`/api/checkouts/${coId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: editDate,
        note: editNote,
        incl_course: editInclCourse,
        incl_product: editInclProduct,
        items: editItems.map(i => ({ category: i.category, label: i.label, price: Number(i.price), qty: i.qty, pkg_id: i.pkg_id })),
        payments: editPays.map(p => ({ method: p.method, amount: Number(p.amount) })),
      }),
    })
    setSavingEdit(false)
    if (!res.ok) { alert('儲存失敗'); return }
    setEditingLogId(null)
    fetchDailyLog(logDate)
  }

  // Client
  const [clientSearch, setClientSearch] = useState('')
  const [clients, setClients] = useState<ClientWithStats[]>([])
  const [selectedClient, setSelectedClient] = useState<ClientWithStats | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [clientPkgs, setClientPkgs] = useState<PkgOption[]>([])

  // Form
  const [date, setDate] = useState(today())
  const [note, setNote] = useState('')
  const [items, setItems] = useState<Item[]>([{ id: uid(), category: '服務', label: '', price: '', qty: 1 }])
  const [pays,  setPays]  = useState<Pay[]>([{ id: uid(), method: '現金', amount: '' }])
  const [inclCourse,  setInclCourse]  = useState(true)
  const [inclProduct, setInclProduct] = useState(false)
  const [inclYodomo,  setInclYodomo]  = useState(false)
  const [inclPoints,  setInclPoints]  = useState(false)

  // Custom product memory
  const [customProducts, setCustomProducts] = useState<string[]>([])
  useEffect(() => { setCustomProducts(getStoredProducts()) }, [])

  // Client search
  const searchClients = useCallback(async (q: string) => {
    if (!q) { setClients([]); return }
    setClients(await (await fetch(`/api/clients?q=${encodeURIComponent(q)}`)).json())
  }, [])
  useEffect(() => {
    if (selectedClient) return
    const t = setTimeout(() => searchClients(clientSearch), 250)
    return () => clearTimeout(t)
  }, [clientSearch, searchClients, selectedClient])

  // Load client packages when client selected
  useEffect(() => {
    if (!selectedClient) { setClientPkgs([]); return }
    fetch(`/api/packages?client_id=${selectedClient.id}&status=active`)
      .then(r => r.json())
      .then((pkgs: { id: number; service_name: string; total_sessions: number; used_sessions: number; unit_price: number }[]) =>
        setClientPkgs(pkgs.map(p => ({
          id: p.id, service_name: p.service_name,
          remaining: p.total_sessions - p.used_sessions,
          unit_price: p.unit_price,
        }))))
  }, [selectedClient])

  // Auto-fill payment amount from items total
  const itemsTotal = items.reduce((s, i) => s + (Number(i.price) || 0) * i.qty, 0)
  const paysTotal  = pays.reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const diff       = itemsTotal - paysTotal  // >0 未足額  <0 超額

  function autoFillPay() {
    if (pays.length === 1) setPays(p => p.map((pay, i) => i === 0 ? { ...pay, amount: String(itemsTotal) } : pay))
  }

  // Items
  function addItem() { setItems(p => [...p, { id: uid(), category: '服務', label: '', price: '', qty: 1 }]) }
  function removeItem(id: string) { setItems(p => p.filter(i => i.id !== id)) }
  function setItem(id: string, k: keyof Item, v: string | number) {
    setItems(p => p.map(i => i.id === id ? { ...i, [k]: v } : i))
  }
  function setPkgItem(id: string, pkgId: number) {
    const pkg = clientPkgs.find(p => p.id === pkgId)
    if (!pkg) return
    setItems(p => p.map(i => i.id === id ? {
      ...i, category: '商品券', label: pkg.service_name,
      price: String(pkg.unit_price), pkg_id: pkgId,
    } : i))
  }

  // Payments
  function addPay()  { setPays(p => [...p, { id: uid(), method: '現金', amount: '' }]) }
  function removePay(id: string) { setPays(p => p.filter(p => p.id !== id)) }
  function setPay(id: string, k: keyof Pay, v: string) {
    setPays(p => p.map(pay => pay.id === id ? { ...pay, [k]: v } : pay))
  }

  // Points preview — 商品券 excluded (already counted at package purchase)
  const qualifyingAmt = items
    .filter(i => {
      if (['服務', '加購', '活動'].includes(i.category)) return inclCourse
      if (i.category === '產品') return inclProduct
      return false
    })
    .reduce((s, i) => s + (Number(i.price) || 0) * i.qty, 0)

  const level = selectedClient?.level as MembershipLevel
  const ptRate = LEVEL_POINTS[level] ?? 1
  const ptPreview = inclPoints ? Math.floor(qualifyingAmt / 1000) * ptRate : 0
  const ydPreview = inclYodomo ? Math.floor(qualifyingAmt / YODOMO_THRESHOLD) : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (items.some(i => !i.label || !i.price)) { alert('請填寫完整品項名稱和金額'); return }
    if (Math.round(diff) !== 0) { alert(`付款金額與消費金額不符，差距 ${fmtAmt(Math.abs(diff))}`); return }

    setSaving(true)
    try {
      const res = await fetch('/api/checkouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: selectedClient?.id ?? null,
          date, note,
          items: items.map(i => ({ category: i.category, label: i.label, price: Number(i.price), qty: i.qty, pkg_id: i.pkg_id })),
          payments: pays.map(p => ({ method: p.method, amount: Number(p.amount) })),
          incl_course: inclCourse, incl_product: inclProduct,
          incl_yodomo: inclYodomo, incl_points: inclPoints,
        }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error || '發生錯誤'); return }
      setResult(data)
      fetchDailyLog(date)
    } catch { alert('網路錯誤') } finally { setSaving(false) }
  }

  function reset() {
    setResult(null); setSelectedClient(null); setClientSearch(''); setClientPkgs([])
    setItems([{ id: uid(), category: '服務', label: '', price: '', qty: 1 }])
    setPays([{ id: uid(), method: '現金', amount: '' }])
    setNote(''); setDate(today())
    setInclCourse(true); setInclProduct(false); setInclYodomo(false); setInclPoints(false)
  }

  // ── Success screen ──────────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="space-y-5 pt-4">
        <div style={{ textAlign: 'center', padding: '30px 0' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>✓</div>
          <h2 style={{ color: '#2c2825', fontSize: '1.3rem', fontWeight: 500 }}>結帳完成</h2>
          <p style={{ color: '#9a8f84', fontSize: '0.9rem', marginTop: '6px' }}>
            {fmtAmt(result.totalAmount)}
          </p>
          {(result.pointsEarned > 0 || result.yodomoEarned > 0) && (
            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {result.pointsEarned > 0 && (
                <span style={{ background: '#fdf5e0', color: '#7a5a00', border: '1px solid #e0c055', borderRadius: '20px', fontSize: '0.82rem', padding: '4px 14px' }}>
                  ＋{result.pointsEarned} 金米
                </span>
              )}
              {result.yodomoEarned > 0 && (
                <span style={{ background: '#f5eaf8', color: '#7a3d8a', border: '1px solid #d4a8e0', borderRadius: '20px', fontSize: '0.82rem', padding: '4px 14px' }}>
                  ＋{result.yodomoEarned} 癒多多點
                </span>
              )}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={reset}
            style={{ flex: 1, background: '#f0ebe4', color: '#2c2825', border: 'none', borderRadius: '6px', fontSize: '0.9rem', padding: '12px', cursor: 'pointer' }}>
            繼續結帳
          </button>
          {selectedClient && (
            <button onClick={() => router.push(`/clients/${selectedClient.id}`)}
              style={{ flex: 1, background: '#2c2825', color: '#f7f4ef', border: 'none', borderRadius: '6px', fontSize: '0.9rem', padding: '12px', cursor: 'pointer' }}>
              查看客人
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Form ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <div className="pt-2">
        <h1 style={{ color: '#2c2825', fontSize: '1.4rem', letterSpacing: '0.05em', fontWeight: 500 }}>結帳</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── 客人 & 日期 ── */}
        <div style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '8px', padding: '14px' }} className="space-y-3">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', alignItems: 'start' }}>
            {/* Client selector */}
            <div>
              <Label>客人</Label>
              {selectedClient ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <span style={{ color: '#2c2825', fontSize: '0.9rem' }}>{selectedClient.name}</span>
                  <MembershipBadge tier={selectedClient.level as MembershipLevel} />
                  <button type="button" onClick={() => { setSelectedClient(null); setClientSearch('') }}
                    style={{ color: '#9a8f84', fontSize: '0.75rem', background: 'none', border: 'none', cursor: 'pointer' }}>
                    更換
                  </button>
                </div>
              ) : (
                <div style={{ position: 'relative', marginTop: '4px' }}>
                  <input value={clientSearch}
                    onChange={e => { setClientSearch(e.target.value); setShowDropdown(true) }}
                    onFocus={() => setShowDropdown(true)}
                    placeholder="搜尋客人（可略過）" style={{ ...iStyle, fontSize: '0.85rem' }} />
                  {showDropdown && clients.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '0 0 6px 6px', zIndex: 20 }}>
                      {clients.map(c => (
                        <button key={c.id} type="button"
                          onClick={() => { setSelectedClient(c); setClientSearch(c.name); setShowDropdown(false) }}
                          style={{ width: '100%', display: 'flex', gap: '8px', alignItems: 'center', padding: '9px 12px', background: 'none', border: 'none', borderBottom: '1px solid #f0ebe4', cursor: 'pointer', textAlign: 'left' }}>
                          <span style={{ color: '#2c2825', fontSize: '0.88rem' }}>{c.name}</span>
                          {c.level && <MembershipBadge tier={c.level as MembershipLevel} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {selectedClient && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                  {selectedClient.stored_value > 0 && (
                    <span style={{ color: '#2d4f9a', fontSize: '0.72rem', background: '#e8f0fc', border: '1px solid #9ab0e8', borderRadius: '10px', padding: '2px 8px' }}>
                      儲值 {fmtAmt(selectedClient.stored_value)}
                    </span>
                  )}
                  {selectedClient.points > 0 && (
                    <span style={{ color: '#7a5a00', fontSize: '0.72rem', background: '#fdf5e0', border: '1px solid #e0c055', borderRadius: '10px', padding: '2px 8px' }}>
                      金米 {selectedClient.points} 點
                    </span>
                  )}
                </div>
              )}
            </div>
            {/* Date */}
            <div>
              <Label>日期</Label>
              <input value={date} onChange={e => setDate(e.target.value)} type="date"
                style={{ ...iStyle, fontSize: '0.85rem', width: 'auto', marginTop: '4px' }} />
            </div>
          </div>
        </div>

        {/* ── 消費品項 ── */}
        <div style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '8px', padding: '14px' }} className="space-y-3">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Label>消費品項</Label>
            <span style={{ color: '#9a8f84', fontSize: '0.78rem' }}>小計 {fmtAmt(itemsTotal)}</span>
          </div>

          {items.map((item, idx) => (
            <div key={item.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto auto', gap: '6px', alignItems: 'center' }}>
              {/* Category */}
              <select value={item.category}
                onChange={e => {
                  setItems(p => p.map(i => i.id === item.id
                    ? { ...i, category: e.target.value, label: '', custom: false, pkg_id: undefined }
                    : i))
                }}
                style={{ ...iStyle, fontSize: '0.78rem', padding: '6px 8px', width: 'auto' }}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>

              {/* Name — smart selector per category */}
              {item.category === '商品券' ? (
                clientPkgs.length > 0 ? (
                  <select value={item.pkg_id ?? ''} onChange={e => setPkgItem(item.id, Number(e.target.value))}
                    style={{ ...iStyle, fontSize: '0.82rem', padding: '6px 8px' }}>
                    <option value="">選擇套組…</option>
                    {clientPkgs.map(p => (
                      <option key={p.id} value={p.id}>{p.service_name}（剩 {p.remaining} 次）</option>
                    ))}
                  </select>
                ) : (
                  <input value={item.label} onChange={e => setItem(item.id, 'label', e.target.value)}
                    placeholder="套組名稱" style={{ ...iStyle, fontSize: '0.82rem', padding: '6px 8px' }} />
                )
              ) : item.category === '服務' ? (
                item.custom ? (
                  <input value={item.label} onChange={e => setItem(item.id, 'label', e.target.value)}
                    placeholder="服務名稱" autoFocus style={{ ...iStyle, fontSize: '0.82rem', padding: '6px 8px' }} />
                ) : (
                  <select value={item.label}
                    onChange={e => {
                      if (e.target.value === '__custom__') setItem(item.id, 'custom', 1)
                      else setItem(item.id, 'label', e.target.value)
                    }}
                    style={{ ...iStyle, fontSize: '0.82rem', padding: '6px 8px' }}>
                    <option value="">選擇服務…</option>
                    {PRESET_SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                    <option value="__custom__">自定義…</option>
                  </select>
                )
              ) : item.category === '加購' ? (
                item.custom ? (
                  <input value={item.label} onChange={e => setItem(item.id, 'label', e.target.value)}
                    placeholder="加購項目" autoFocus style={{ ...iStyle, fontSize: '0.82rem', padding: '6px 8px' }} />
                ) : (
                  <select value={item.label}
                    onChange={e => {
                      if (e.target.value === '__custom__') setItem(item.id, 'custom', 1)
                      else setItem(item.id, 'label', e.target.value)
                    }}
                    style={{ ...iStyle, fontSize: '0.82rem', padding: '6px 8px' }}>
                    <option value="">選擇加購…</option>
                    {PRESET_ADDONS.map(s => <option key={s} value={s}>{s}</option>)}
                    <option value="__custom__">自定義…</option>
                  </select>
                )
              ) : item.category === '產品' ? (
                item.custom ? (
                  <input value={item.label}
                    onChange={e => setItem(item.id, 'label', e.target.value)}
                    onBlur={e => { if (e.target.value) { saveProduct(e.target.value); setCustomProducts(getStoredProducts()) } }}
                    placeholder="產品名稱" autoFocus style={{ ...iStyle, fontSize: '0.82rem', padding: '6px 8px' }} />
                ) : (
                  <select value={item.label}
                    onChange={e => {
                      if (e.target.value === '__custom__') setItem(item.id, 'custom', 1)
                      else setItem(item.id, 'label', e.target.value)
                    }}
                    style={{ ...iStyle, fontSize: '0.82rem', padding: '6px 8px' }}>
                    <option value="">選擇產品…</option>
                    {customProducts.map(s => <option key={s} value={s}>{s}</option>)}
                    <option value="__custom__">新增產品…</option>
                  </select>
                )
              ) : (
                <input value={item.label} onChange={e => setItem(item.id, 'label', e.target.value)}
                  placeholder="品項名稱" style={{ ...iStyle, fontSize: '0.82rem', padding: '6px 8px' }} />
              )}

              {/* Price */}
              <input value={item.price} onChange={e => setItem(item.id, 'price', e.target.value)}
                type="number" placeholder="金額"
                style={{ ...iStyle, fontSize: '0.82rem', padding: '6px 8px', width: '80px' }} />

              {/* Qty */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <button type="button" onClick={() => setItem(item.id, 'qty', Math.max(1, item.qty - 1))}
                  style={{ ...qBtn, background: item.qty > 1 ? '#f0ebe4' : '#faf8f5' }}>−</button>
                <span style={{ color: '#2c2825', fontSize: '0.82rem', minWidth: '18px', textAlign: 'center' }}>{item.qty}</span>
                <button type="button" onClick={() => setItem(item.id, 'qty', item.qty + 1)}
                  style={{ ...qBtn, background: '#f0ebe4' }}>＋</button>
              </div>

              {/* Delete */}
              {idx > 0 && (
                <button type="button" onClick={() => removeItem(item.id)}
                  style={{ color: '#c4b8aa', background: 'none', border: 'none', fontSize: '1rem', cursor: 'pointer' }}>✕</button>
              )}
            </div>
          ))}

          <button type="button" onClick={addItem}
            style={{ color: '#9a8f84', background: 'none', border: '1px dashed #d9d0c5', borderRadius: '5px', fontSize: '0.8rem', padding: '6px 14px', cursor: 'pointer', width: '100%' }}>
            ＋ 新增品項
          </button>
        </div>

        {/* ── 付款方式 ── */}
        <div style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '8px', padding: '14px' }} className="space-y-3">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Label>付款方式</Label>
            <button type="button" onClick={autoFillPay}
              style={{ color: '#9a8f84', background: 'none', border: '1px solid #e0d9d0', borderRadius: '4px', fontSize: '0.72rem', padding: '3px 10px', cursor: 'pointer' }}>
              自動填入 {fmtAmt(itemsTotal)}
            </button>
          </div>

          {pays.map((pay, idx) => (
            <div key={pay.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '8px', alignItems: 'center' }}>
              <select value={pay.method} onChange={e => setPay(pay.id, 'method', e.target.value)}
                style={{ ...iStyle, fontSize: '0.82rem', padding: '6px 8px', width: 'auto' }}>
                {PAY_METHODS.map(m => <option key={m}>{m}</option>)}
              </select>
              <input value={pay.amount} onChange={e => setPay(pay.id, 'amount', e.target.value)}
                type="number" placeholder="金額" style={{ ...iStyle, fontSize: '0.82rem', padding: '6px 8px' }} />
              {idx > 0 && (
                <button type="button" onClick={() => removePay(pay.id)}
                  style={{ color: '#c4b8aa', background: 'none', border: 'none', fontSize: '1rem', cursor: 'pointer' }}>✕</button>
              )}
            </div>
          ))}

          <button type="button" onClick={addPay}
            style={{ color: '#9a8f84', background: 'none', border: '1px dashed #d9d0c5', borderRadius: '5px', fontSize: '0.8rem', padding: '6px 14px', cursor: 'pointer', width: '100%' }}>
            ＋ 新增付款方式
          </button>

          {/* Reconciliation */}
          <div style={{
            background: Math.round(diff) === 0 ? '#edf3eb' : '#fdf0f0',
            border: `1px solid ${Math.round(diff) === 0 ? '#9ab89e' : '#e8a8a8'}`,
            borderRadius: '6px', padding: '10px 12px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ color: '#6b5f54', fontSize: '0.82rem' }}>
              已分配 {fmtAmt(paysTotal)}
            </span>
            <span style={{
              color: Math.round(diff) === 0 ? '#4a6b52' : '#9a4a4a',
              fontSize: '0.85rem', fontWeight: 500,
            }}>
              {Math.round(diff) === 0 ? '✓ 已全額' : diff > 0 ? `尚差 ${fmtAmt(diff)}` : `超額 ${fmtAmt(-diff)}`}
            </span>
          </div>
        </div>

        {/* ── 備註 ── */}
        <input value={note} onChange={e => setNote(e.target.value)}
          placeholder="備註（選填）" style={iStyle} />

        {/* ── 累積設定 ── */}
        <div style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '8px', padding: '14px' }} className="space-y-3">
          <Label>累積設定</Label>
          <div className="space-y-2">
            {[
              { key: 'inclCourse',  val: inclCourse,  set: setInclCourse,  label: '計入年度課程消費統計' },
              { key: 'inclProduct', val: inclProduct, set: setInclProduct, label: '計入保養品消費統計' },
            ].map(row => (
              <label key={row.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={row.val} onChange={e => row.set(e.target.checked)}
                  style={{ accentColor: '#6b5f54', width: '15px', height: '15px' }} />
                <span style={{ color: '#2c2825', fontSize: '0.85rem' }}>{row.label}</span>
              </label>
            ))}

            {selectedClient && (
              <>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={inclYodomo} onChange={e => setInclYodomo(e.target.checked)}
                    style={{ accentColor: '#6b5f54', width: '15px', height: '15px' }} />
                  <span style={{ color: '#2c2825', fontSize: '0.85rem' }}>
                    癒多多集點
                    {inclYodomo && ydPreview > 0 && (
                      <span style={{ color: '#7a3d8a', marginLeft: '8px', fontSize: '0.78rem' }}>
                        ＋{ydPreview} 點
                      </span>
                    )}
                  </span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={inclPoints} onChange={e => setInclPoints(e.target.checked)}
                    style={{ accentColor: '#6b5f54', width: '15px', height: '15px' }} />
                  <span style={{ color: '#2c2825', fontSize: '0.85rem' }}>
                    金米計算（{level} {ptRate}點/千元）
                    {inclPoints && ptPreview > 0 && (
                      <span style={{ color: '#7a5a00', marginLeft: '8px', fontSize: '0.78rem' }}>
                        ＋{ptPreview} 點
                      </span>
                    )}
                  </span>
                </label>
              </>
            )}
          </div>
        </div>

        {/* ── Submit ── */}
        <button type="submit" disabled={saving || Math.round(diff) !== 0}
          style={{
            width: '100%',
            background: saving || Math.round(diff) !== 0 ? '#c4b8aa' : '#2c2825',
            color: '#f7f4ef', border: 'none', borderRadius: '6px',
            fontSize: '1rem', letterSpacing: '0.06em', padding: '14px',
            cursor: saving || Math.round(diff) !== 0 ? 'not-allowed' : 'pointer',
          }}>
          {saving ? '處理中…' : `確認結帳　${fmtAmt(itemsTotal)}`}
        </button>
      </form>

      {/* ── 當日紀錄 ── */}
      <div style={{ borderTop: '2px solid #e0d9d0', paddingTop: '20px', marginTop: '8px' }} className="space-y-3">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ color: '#2c2825', fontSize: '1rem', fontWeight: 500, letterSpacing: '0.05em' }}>當日紀錄</h2>
          <input
            type="date" value={logDate}
            onChange={e => setLogDate(e.target.value)}
            style={{ ...iStyle, width: 'auto', fontSize: '0.85rem', padding: '6px 10px' }}
          />
        </div>

        {logLoading ? (
          <p style={{ color: '#c4b8aa', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>載入中…</p>
        ) : dailyLog.length === 0 ? (
          <p style={{ color: '#c4b8aa', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>
            {logDate} 無結帳紀錄
          </p>
        ) : (() => {
          // Summary by payment method
          const methodTotals: Record<string, number> = {}
          let grandTotal = 0
          for (const co of dailyLog) {
            grandTotal += co.total_amount
            for (const pay of co.payments) {
              methodTotals[pay.method] = (methodTotals[pay.method] ?? 0) + pay.amount
            }
          }
          return (
            <>
              {/* Day summary bar */}
              <div style={{ background: '#2c2825', borderRadius: '8px', padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ color: '#c4b8aa', fontSize: '0.72rem', letterSpacing: '0.08em' }}>
                    共 {dailyLog.length} 筆
                  </span>
                  <span style={{ color: '#f7f4ef', fontSize: '1.1rem', fontWeight: 600 }}>
                    {fmtAmt(grandTotal)}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {Object.entries(methodTotals).map(([method, amt]) => (
                    <span key={method} style={{ fontSize: '0.72rem', color: '#c4b8aa', background: 'rgba(255,255,255,0.08)', borderRadius: '10px', padding: '2px 10px' }}>
                      {method} {fmtAmt(amt)}
                    </span>
                  ))}
                </div>
              </div>

              {/* Individual records */}
              {dailyLog.map(co => {
                const isEditingThis = editingLogId === co.id
                const editTotal = editItems.reduce((s, i) => s + (Number(i.price) || 0) * i.qty, 0)
                const editPayTotal = editPays.reduce((s, p) => s + (Number(p.amount) || 0), 0)
                const editDiff = editTotal - editPayTotal

                return (
                  <div key={co.id} style={{ background: '#faf8f5', border: `1px solid ${isEditingThis ? '#9ab89e' : '#e0d9d0'}`, borderRadius: '6px', padding: '10px 12px' }}>
                    {/* ── View mode ── */}
                    {!isEditingThis && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            {co.client_id ? (
                              <Link href={`/clients/${co.client_id}`} style={{ color: '#2c2825', fontSize: '0.88rem', fontWeight: 500 }}>
                                {co.client_name ?? '未知客人'}
                              </Link>
                            ) : (
                              <span style={{ color: '#9a8f84', fontSize: '0.88rem' }}>散客</span>
                            )}
                            <span style={{ color: '#2c2825', fontSize: '0.88rem', fontWeight: 500, marginLeft: 'auto' }}>
                              {fmtAmt(co.total_amount)}
                            </span>
                          </div>
                          <div className="space-y-0.5">
                            {co.items.map(item => (
                              <div key={item.id} style={{ display: 'flex', gap: '6px', fontSize: '0.75rem' }}>
                                <span style={{ color: '#b4aa9e', minWidth: '44px' }}>{item.category}</span>
                                <span style={{ color: '#4a4642' }}>{item.label}</span>
                                {item.qty > 1 && <span style={{ color: '#9a8f84' }}>×{item.qty}</span>}
                                <span style={{ color: '#6b5f54', marginLeft: 'auto' }}>{fmtAmt(item.price * item.qty)}</span>
                              </div>
                            ))}
                          </div>
                          <div style={{ marginTop: '4px', display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                            {co.payments.map(pay => (
                              <span key={pay.id} style={{ fontSize: '0.68rem', color: '#9a8f84', background: '#f0ebe4', borderRadius: '10px', padding: '1px 7px' }}>
                                {pay.method} {fmtAmt(pay.amount)}
                              </span>
                            ))}
                            {co.note && <span style={{ fontSize: '0.68rem', color: '#9a8f84' }}>{co.note}</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                          <button onClick={() => startLogEdit(co)}
                            style={{ color: '#6b5f54', fontSize: '0.68rem', background: 'none', border: '1px solid #e0d9d0', borderRadius: '4px', padding: '2px 7px', cursor: 'pointer' }}>
                            編輯
                          </button>
                          <button onClick={() => deleteLog(co.id)} disabled={deletingId === co.id}
                            style={{ color: '#c4b8aa', fontSize: '0.68rem', background: 'none', border: '1px solid #e0d9d0', borderRadius: '4px', padding: '2px 7px', cursor: 'pointer' }}>
                            {deletingId === co.id ? '…' : '刪除'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ── Edit mode ── */}
                    {isEditingThis && (
                      <div className="space-y-3">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#2c2825', fontSize: '0.85rem', fontWeight: 500 }}>
                            {co.client_name ?? '散客'} 編輯中
                          </span>
                          <input value={editDate} onChange={e => setEditDate(e.target.value)} type="date"
                            style={{ ...iStyle, width: 'auto', fontSize: '0.8rem', padding: '4px 8px' }} />
                        </div>

                        {/* Items */}
                        <div style={{ borderTop: '1px solid #f0ebe4', paddingTop: '8px' }} className="space-y-2">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#6b5f54', fontSize: '0.72rem', letterSpacing: '0.05em' }}>消費品項</span>
                            <span style={{ color: '#9a8f84', fontSize: '0.72rem' }}>小計 {fmtAmt(editTotal)}</span>
                          </div>
                          {editItems.map((item, idx) => (
                            <div key={item.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto auto', gap: '4px', alignItems: 'center' }}>
                              <select value={item.category}
                                onChange={e => setEditItems(p => p.map(i => i.id === item.id ? { ...i, category: e.target.value, label: '', pkg_id: undefined } : i))}
                                style={{ ...iStyle, fontSize: '0.75rem', padding: '4px 6px', width: 'auto' }}>
                                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                              </select>
                              <input value={item.label}
                                onChange={e => setEditItems(p => p.map(i => i.id === item.id ? { ...i, label: e.target.value } : i))}
                                placeholder="品項名稱" style={{ ...iStyle, fontSize: '0.8rem', padding: '4px 6px' }} />
                              <input value={item.price}
                                onChange={e => setEditItems(p => p.map(i => i.id === item.id ? { ...i, price: e.target.value } : i))}
                                type="number" placeholder="金額" style={{ ...iStyle, fontSize: '0.8rem', padding: '4px 6px', width: '72px' }} />
                              <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                <button type="button" onClick={() => setEditItems(p => p.map(i => i.id === item.id ? { ...i, qty: Math.max(1, i.qty - 1) } : i))}
                                  style={{ ...qBtn, background: item.qty > 1 ? '#f0ebe4' : '#faf8f5' }}>−</button>
                                <span style={{ color: '#2c2825', fontSize: '0.8rem', minWidth: '16px', textAlign: 'center' }}>{item.qty}</span>
                                <button type="button" onClick={() => setEditItems(p => p.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i))}
                                  style={{ ...qBtn, background: '#f0ebe4' }}>＋</button>
                              </div>
                              {idx > 0 && (
                                <button type="button" onClick={() => setEditItems(p => p.filter(i => i.id !== item.id))}
                                  style={{ color: '#c4b8aa', background: 'none', border: 'none', fontSize: '0.9rem', cursor: 'pointer' }}>✕</button>
                              )}
                            </div>
                          ))}
                          <button type="button" onClick={() => setEditItems(p => [...p, { id: uid(), category: '服務', label: '', price: '', qty: 1 }])}
                            style={{ color: '#9a8f84', background: 'none', border: '1px dashed #d9d0c5', borderRadius: '4px', fontSize: '0.75rem', padding: '4px 10px', cursor: 'pointer', width: '100%' }}>
                            ＋ 新增品項
                          </button>
                        </div>

                        {/* Payments */}
                        <div style={{ borderTop: '1px solid #f0ebe4', paddingTop: '8px' }} className="space-y-2">
                          <span style={{ color: '#6b5f54', fontSize: '0.72rem', letterSpacing: '0.05em' }}>付款方式</span>
                          {editPays.map((pay, idx) => (
                            <div key={pay.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '4px', alignItems: 'center' }}>
                              <select value={pay.method} onChange={e => setEditPays(p => p.map(pp => pp.id === pay.id ? { ...pp, method: e.target.value } : pp))}
                                style={{ ...iStyle, fontSize: '0.78rem', padding: '4px 6px', width: 'auto' }}>
                                {PAY_METHODS.map(m => <option key={m}>{m}</option>)}
                              </select>
                              <input value={pay.amount} onChange={e => setEditPays(p => p.map(pp => pp.id === pay.id ? { ...pp, amount: e.target.value } : pp))}
                                type="number" placeholder="金額" style={{ ...iStyle, fontSize: '0.8rem', padding: '4px 6px' }} />
                              {idx > 0 && (
                                <button type="button" onClick={() => setEditPays(p => p.filter(pp => pp.id !== pay.id))}
                                  style={{ color: '#c4b8aa', background: 'none', border: 'none', fontSize: '0.9rem', cursor: 'pointer' }}>✕</button>
                              )}
                            </div>
                          ))}
                          <button type="button" onClick={() => setEditPays(p => [...p, { id: uid(), method: '現金', amount: '' }])}
                            style={{ color: '#9a8f84', background: 'none', border: '1px dashed #d9d0c5', borderRadius: '4px', fontSize: '0.75rem', padding: '4px 10px', cursor: 'pointer', width: '100%' }}>
                            ＋ 新增付款方式
                          </button>
                          {/* Balance check */}
                          <div style={{
                            background: Math.round(editDiff) === 0 ? '#edf3eb' : '#fdf0f0',
                            border: `1px solid ${Math.round(editDiff) === 0 ? '#9ab89e' : '#e8a8a8'}`,
                            borderRadius: '4px', padding: '6px 10px',
                            display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem',
                          }}>
                            <span style={{ color: '#6b5f54' }}>已分配 {fmtAmt(editPayTotal)}</span>
                            <span style={{ color: Math.round(editDiff) === 0 ? '#4a6b52' : '#9a4a4a', fontWeight: 500 }}>
                              {Math.round(editDiff) === 0 ? '✓ 已全額' : editDiff > 0 ? `尚差 ${fmtAmt(editDiff)}` : `超額 ${fmtAmt(-editDiff)}`}
                            </span>
                          </div>
                        </div>

                        {/* Note + accumulation */}
                        <div style={{ borderTop: '1px solid #f0ebe4', paddingTop: '8px' }} className="space-y-2">
                          <input value={editNote} onChange={e => setEditNote(e.target.value)}
                            placeholder="備註（選填）" style={{ ...iStyle, fontSize: '0.82rem', padding: '6px 10px' }} />
                          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                              <input type="checkbox" checked={editInclCourse} onChange={e => setEditInclCourse(e.target.checked)}
                                style={{ accentColor: '#6b5f54' }} />
                              <span style={{ color: '#2c2825', fontSize: '0.8rem' }}>計入年度課程消費</span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                              <input type="checkbox" checked={editInclProduct} onChange={e => setEditInclProduct(e.target.checked)}
                                style={{ accentColor: '#6b5f54' }} />
                              <span style={{ color: '#2c2825', fontSize: '0.8rem' }}>計入保養品消費</span>
                            </label>
                          </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => saveLogEdit(co.id)} disabled={savingEdit || Math.round(editDiff) !== 0}
                            style={{
                              flex: 1, background: savingEdit || Math.round(editDiff) !== 0 ? '#c4b8aa' : '#2c2825',
                              color: '#f7f4ef', border: 'none', borderRadius: '5px',
                              fontSize: '0.82rem', padding: '8px', cursor: savingEdit ? 'not-allowed' : 'pointer',
                            }}>
                            {savingEdit ? '儲存中…' : '儲存'}
                          </button>
                          <button onClick={() => setEditingLogId(null)}
                            style={{ flex: 1, background: 'none', color: '#6b5f54', border: '1px solid #e0d9d0', borderRadius: '5px', fontSize: '0.82rem', padding: '8px', cursor: 'pointer' }}>
                            取消
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </>
          )
        })()}
      </div>
    </div>
  )
}

const iStyle: React.CSSProperties = {
  width: '100%', background: '#faf8f5', border: '1px solid #e0d9d0',
  borderRadius: '6px', color: '#2c2825', fontSize: '0.9rem', outline: 'none', padding: '10px 14px',
}
const qBtn: React.CSSProperties = {
  border: '1px solid #e0d9d0', borderRadius: '4px', color: '#6b5f54',
  fontSize: '0.9rem', width: '24px', height: '24px', cursor: 'pointer', padding: 0, lineHeight: 1,
}
function Label({ children }: { children: React.ReactNode }) {
  return <p style={{ color: '#6b5f54', fontSize: '0.78rem', letterSpacing: '0.06em' }}>{children}</p>
}
