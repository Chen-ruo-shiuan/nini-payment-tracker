'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import MembershipBadge from '@/components/MembershipBadge'
import {
  VisitLogWithClient, VisitLogItem, ClientWithStats, MembershipLevel,
  VISIT_LOG_ITEM_TYPES, VISIT_LOG_PAYMENT_STATUSES, VISIT_LOG_PAY_METHODS,
} from '@/types'

interface PickedClient { id: number; name: string; level: MembershipLevel | null }
interface Item { category: string; label: string }
interface InventoryItem { id: number; name: string; spec: string | null; unit: string }

interface Appt {
  id: number
  client_id: number
  client_name: string
  client_level: string
  date: string
  time: string | null
  note: string | null
}

// 服務項目下拉建議，比照結帳頁常用服務／加購
const PRESET_SERVICE_OPTIONS = ['精細光彩', '原液調理', '泡光氧彗', '小顏骨氣', '雨林頭療', '森林癒撥筋', '光澤•護洗癒', '全臉粉清', '深皮超導', '光波嫩膚', '臭氧離子']

function todayLocal() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
}

function uid() { return Math.random().toString(36).slice(2) }

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#faf8f5', border: '1px solid #e0d9d0',
  borderRadius: '6px', color: '#2c2825', fontSize: '0.9rem', outline: 'none', padding: '9px 12px',
}

const itemTagStyle: Record<string, { bg: string; color: string }> = {
  '服務':  { bg: '#f0ebe4', color: '#6b5f54' },
  '產品':  { bg: '#e8f0fc', color: '#2d4f9a' },
  '拿預訂': { bg: '#fdf5e0', color: '#7a5a00' },
}

const paymentStatusStyle: Record<string, { bg: string; color: string }> = {
  '已收費': { bg: '#edf3eb', color: '#4a7a5a' },
  '定金':   { bg: '#fdf5e0', color: '#7a5a00' },
  '未收費': { bg: '#f0ebe4', color: '#9a8f84' },
}

function Label({ children }: { children: React.ReactNode }) {
  return <p style={{ color: '#6b5f54', fontSize: '0.78rem', letterSpacing: '0.06em', marginBottom: '4px' }}>{children}</p>
}

const fmtAmt = (n: number) => `$ ${n.toLocaleString()}`

interface Payment { method: string; amount: string }

const emptyForm = { payment_status: '未收費' as string, next_visit_date: '', note: '', estimatedAmount: '' }

export default function VisitLogPage() {
  const [date, setDate] = useState(todayLocal())
  const [visits, setVisits] = useState<VisitLogWithClient[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)

  // Today's appointments (cross-reference from the booking calendar)
  const [appts, setAppts] = useState<Appt[]>([])

  // Inventory (for the 產品／拿預訂 item dropdown suggestions)
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  useEffect(() => {
    fetch('/api/inventory').then(r => r.ok ? r.json() : []).then(setInventory).catch(() => setInventory([]))
  }, [])

  // Client picker
  const [clientSearch, setClientSearch] = useState('')
  const [clients, setClients] = useState<ClientWithStats[]>([])
  const [selectedClient, setSelectedClient] = useState<PickedClient | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)

  const [form, setForm] = useState(emptyForm)
  const [items, setItems] = useState<(Item & { id: string })[]>([{ id: uid(), category: '服務', label: '' }])
  const [payments, setPayments] = useState<(Payment & { id: string })[]>([{ id: uid(), method: '', amount: '' }])

  // Print range
  const [showRange, setShowRange] = useState(false)
  const [rangeFrom, setRangeFrom] = useState(date)
  const [rangeTo, setRangeTo] = useState(date)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/visit-log?date=${date}`)
      .then(r => r.json())
      .then(d => { setVisits(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [date])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch(`/api/appointments?date=${date}`)
      .then(r => r.ok ? r.json() : [])
      .then(setAppts)
      .catch(() => setAppts([]))
  }, [date])

  const searchClients = useCallback(async (q: string) => {
    if (!q) { setClients([]); return }
    setClients(await (await fetch(`/api/clients?q=${encodeURIComponent(q)}`)).json())
  }, [])
  useEffect(() => {
    if (selectedClient) return
    const t = setTimeout(() => searchClients(clientSearch), 250)
    return () => clearTimeout(t)
  }, [clientSearch, searchClients, selectedClient])

  function set(k: keyof typeof emptyForm, v: string) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  function addItemRow() {
    setItems(prev => [...prev, { id: uid(), category: '服務', label: '' }])
  }
  function updateItemRow(id: string, field: 'category' | 'label', value: string) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i))
  }
  function removeItemRow(id: string) {
    setItems(prev => {
      const next = prev.filter(i => i.id !== id)
      return next.length ? next : [{ id: uid(), category: '服務', label: '' }]
    })
  }

  function addPaymentRow() {
    setPayments(prev => [...prev, { id: uid(), method: '', amount: '' }])
  }
  function updatePaymentRow(id: string, field: 'method' | 'amount', value: string) {
    setPayments(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p))
  }
  function removePaymentRow(id: string) {
    setPayments(prev => {
      const next = prev.filter(p => p.id !== id)
      return next.length ? next : [{ id: uid(), method: '', amount: '' }]
    })
  }

  function resetForm() {
    setForm(emptyForm)
    setItems([{ id: uid(), category: '服務', label: '' }])
    setPayments([{ id: uid(), method: '', amount: '' }])
    setSelectedClient(null)
    setClientSearch('')
    setShowDropdown(false)
    setEditingId(null)
  }

  function quickAddFromAppt(a: Appt) {
    setEditingId(null)
    setForm(emptyForm)
    setItems([{ id: uid(), category: '服務', label: '' }])
    setPayments([{ id: uid(), method: '', amount: '' }])
    setSelectedClient({ id: a.client_id, name: a.client_name, level: a.client_level as MembershipLevel })
    setClientSearch(a.client_name)
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    const client_name = selectedClient?.name ?? clientSearch.trim()
    if (!client_name) { setError('請輸入客人姓名'); setSaving(false); return }
    try {
      const body = {
        client_id: selectedClient?.id ?? null,
        client_name,
        date,
        items: items.map(i => ({ category: i.category, label: i.label })),
        payment_status: form.payment_status,
        payments: payments.map(p => ({ method: p.method, amount: p.amount })),
        estimated_amount: form.payment_status === '未收費' && form.estimatedAmount ? Number(form.estimatedAmount) : undefined,
        next_visit_date: form.next_visit_date || null,
        note: form.note || null,
      }
      const url = editingId ? `/api/visit-log/${editingId}` : '/api/visit-log'
      const method = editingId ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || '發生錯誤'); return }
      setShowForm(false)
      resetForm()
      load()
    } catch { setError('網路錯誤') } finally { setSaving(false) }
  }

  async function handleDelete(id: number) {
    if (!confirm('確定刪除此筆紀錄？')) return
    setDeleting(id)
    await fetch(`/api/visit-log/${id}`, { method: 'DELETE' })
    setDeleting(null)
    load()
  }

  function startEdit(v: VisitLogWithClient, forceStatus?: string) {
    setEditingId(v.id)
    setSelectedClient(v.client_id ? { id: v.client_id, name: v.client_name, level: v.client_level } : null)
    setClientSearch(v.client_name)
    setItems(v.items.length
      ? v.items.map(i => ({ id: uid(), category: i.category, label: i.label }))
      : [{ id: uid(), category: '服務', label: '' }])
    setPayments(v.payments?.length
      ? v.payments.map(p => ({ id: uid(), method: p.method, amount: String(p.amount) }))
      : [{ id: uid(), method: '', amount: v.amount != null ? String(v.amount) : '' }])
    setForm({
      payment_status: forceStatus || v.payment_status || (v.paid ? '已收費' : '未收費'),
      next_visit_date: v.next_visit_date || '',
      note: v.note || '',
      estimatedAmount: !v.payments?.length && v.amount != null ? String(v.amount) : '',
    })
    setShowForm(true)
  }

  function quickCharge(v: VisitLogWithClient) {
    startEdit(v, '已收費')
  }

  const isPaidStatus = (s: string) => s !== '未收費'
  // 商品券已於購買時預收，當天不重複計入合計
  const paidTotal = visits.reduce((s, v) => s + (v.payments || []).filter(p => p.method !== '商品券').reduce((s2, p) => s2 + p.amount, 0), 0)
  const loggedClientIds = new Set(visits.map(v => v.client_id).filter(Boolean))
  const pendingAppts = appts.filter(a => !loggedClientIds.has(a.client_id))

  return (
    <div className="space-y-5">
      {/* Datalist suggestions for item labels */}
      <datalist id="service-options">
        {PRESET_SERVICE_OPTIONS.map(s => <option key={s} value={s} />)}
      </datalist>
      <datalist id="inventory-options">
        {inventory.map(i => <option key={i.id} value={i.spec ? `${i.name} ${i.spec}` : i.name} />)}
      </datalist>

      {/* Header */}
      <div className="flex items-start justify-between pt-2">
        <div>
          <h1 style={{ color: '#2c2825', fontSize: '1.4rem', letterSpacing: '0.05em', fontWeight: 500 }}>每日紀錄</h1>
          <p style={{ color: '#9a8f84', fontSize: '0.78rem', marginTop: '2px' }}>
            {visits.length} 筆　已收 {fmtAmt(paidTotal)}
          </p>
        </div>
        <button onClick={() => { if (showForm) resetForm(); setShowForm(v => !v) }}
          style={{
            background: showForm ? '#f0ebe4' : '#2c2825',
            color: showForm ? '#6b5f54' : '#f7f4ef',
            border: 'none', borderRadius: '5px', fontSize: '0.8rem',
          }} className="px-4 py-2">
          {showForm ? '取消' : '＋ 新增'}
        </button>
      </div>

      {/* Date + print controls */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="date" value={date} onChange={e => { setDate(e.target.value); setRangeFrom(e.target.value); setRangeTo(e.target.value) }}
          style={{ ...inputStyle, width: 'auto', minWidth: '140px' }} />
        <Link href={`/visit-log/print?date=${date}`}
          style={{ color: '#6b5f54', fontSize: '0.8rem', border: '1px solid #e0d9d0', borderRadius: '6px', padding: '9px 14px' }}>
          🖨 列印當天
        </Link>
        <button type="button" onClick={() => setShowRange(v => !v)}
          style={{ color: '#6b5f54', fontSize: '0.8rem', background: 'none', border: '1px solid #e0d9d0', borderRadius: '6px', padding: '9px 14px', cursor: 'pointer' }}>
          區間列印
        </button>
      </div>
      {showRange && (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '8px', padding: '12px' }}>
          <input type="date" value={rangeFrom} onChange={e => setRangeFrom(e.target.value)} style={{ ...inputStyle, width: 'auto' }} />
          <span style={{ color: '#9a8f84' }}>～</span>
          <input type="date" value={rangeTo} onChange={e => setRangeTo(e.target.value)} style={{ ...inputStyle, width: 'auto' }} />
          <Link href={`/visit-log/print?from=${rangeFrom}&to=${rangeTo}`}
            style={{ color: '#f7f4ef', background: '#2c2825', fontSize: '0.8rem', borderRadius: '6px', padding: '9px 14px' }}>
            列印區間
          </Link>
        </div>
      )}

      {/* Today's appointments cross-reference */}
      {pendingAppts.length > 0 && (
        <div style={{ background: '#e8f0fc', border: '1px solid #9ab0e8', borderRadius: '8px', padding: '12px 14px' }}>
          <div style={{ color: '#2d4f9a', fontSize: '0.78rem', fontWeight: 600, marginBottom: '8px' }}>
            📅 今日已預約（尚未記錄）
          </div>
          <div className="space-y-2">
            {pendingAppts.map(a => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#2c2825', fontSize: '0.88rem' }}>{a.client_name}</span>
                  {a.client_level && <MembershipBadge tier={a.client_level as MembershipLevel} />}
                  {a.time && <span style={{ color: '#6b5f54', fontSize: '0.78rem' }}>{a.time}</span>}
                </div>
                <button onClick={() => quickAddFromAppt(a)}
                  style={{ color: '#2d4f9a', background: '#fff', border: '1px solid #9ab0e8', borderRadius: '5px', fontSize: '0.75rem', padding: '5px 10px', cursor: 'pointer' }}>
                  ＋ 記錄
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit}
          style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '8px', padding: '16px' }}
          className="space-y-3">
          <p style={{ color: '#6b5f54', fontSize: '0.78rem', letterSpacing: '0.06em', marginBottom: '4px' }}>
            {editingId ? '編輯紀錄' : '新增紀錄'}
          </p>

          <div>
            <Label>客人姓名 *</Label>
            {selectedClient ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#2c2825', fontSize: '0.9rem' }}>{selectedClient.name}</span>
                {selectedClient.level && <MembershipBadge tier={selectedClient.level} />}
                <button type="button" onClick={() => { setSelectedClient(null); setClientSearch('') }}
                  style={{ color: '#9a8f84', fontSize: '0.75rem', background: 'none', border: 'none', cursor: 'pointer' }}>
                  更換
                </button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <input value={clientSearch}
                  onChange={e => { setClientSearch(e.target.value); setShowDropdown(true) }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="輸入姓名（可為未建檔的散客）" style={inputStyle} />
                {showDropdown && clients.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '0 0 6px 6px', zIndex: 20 }}>
                    {clients.map(c => (
                      <button key={c.id} type="button"
                        onClick={() => { setSelectedClient(c); setClientSearch(c.name); setShowDropdown(false) }}
                        style={{ width: '100%', display: 'flex', gap: '8px', alignItems: 'center', padding: '9px 12px', background: 'none', border: 'none', borderBottom: '1px solid #f0ebe4', cursor: 'pointer', textAlign: 'left' }}>
                        <span style={{ color: '#2c2825', fontSize: '0.88rem' }}>{c.name}</span>
                        {c.level && <MembershipBadge tier={c.level} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <Label>今日項目 *</Label>
            <p style={{ color: '#9a8f84', fontSize: '0.72rem', marginTop: '-2px', marginBottom: '6px' }}>
              可直接輸入任何名稱，下拉只是建議清單，不會限制選項
            </p>
            <div className="space-y-2">
              {items.map(item => (
                <div key={item.id} style={{ display: 'flex', gap: '6px' }}>
                  <select value={item.category} onChange={e => updateItemRow(item.id, 'category', e.target.value)}
                    style={{ ...inputStyle, width: '92px', flexShrink: 0, padding: '9px 6px' }}>
                    {VISIT_LOG_ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input value={item.label} onChange={e => updateItemRow(item.id, 'label', e.target.value)}
                    list={item.category === '服務' ? 'service-options' : 'inventory-options'}
                    placeholder={item.category === '產品' ? '自行輸入，例：精華液' : item.category === '拿預訂' ? '自行輸入，例：化妝品組' : '自行輸入，例：泡光氧彗'}
                    style={inputStyle} />
                  <button type="button" onClick={() => removeItemRow(item.id)}
                    style={{ color: '#c4b8aa', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', padding: '0 4px', flexShrink: 0 }}>
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addItemRow}
              style={{ marginTop: '6px', color: '#6b5f54', background: 'none', border: '1px dashed #c4b8aa', borderRadius: '6px', fontSize: '0.8rem', padding: '6px 12px', cursor: 'pointer', width: '100%' }}>
              ＋ 新增項目
            </button>
          </div>

          <div className="space-y-1">
            <Label>付款狀態</Label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {VISIT_LOG_PAYMENT_STATUSES.map(s => {
                const active = form.payment_status === s
                const style = paymentStatusStyle[s]
                return (
                  <button key={s} type="button" onClick={() => set('payment_status', s)}
                    style={{
                      flex: 1, padding: '9px', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer',
                      background: active ? style.bg : '#fff', color: active ? style.color : '#9a8f84',
                      border: `1px solid ${active ? style.color : '#e0d9d0'}`,
                    }}>{s}</button>
                )
              })}
            </div>
          </div>

          {form.payment_status !== '未收費' && (
            <div>
              <Label>付款方式 *（可拆多筆，例如儲值金 + 現金）</Label>
              <div className="space-y-2">
                {payments.map(pay => (
                  <div key={pay.id} style={{ display: 'flex', gap: '6px' }}>
                    <select value={pay.method} onChange={e => updatePaymentRow(pay.id, 'method', e.target.value)}
                      style={{ ...inputStyle, flex: 1 }}>
                      <option value="">請選擇</option>
                      {VISIT_LOG_PAY_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <input type="number" value={pay.amount} onChange={e => updatePaymentRow(pay.id, 'amount', e.target.value)}
                      placeholder="金額" min="0" style={{ ...inputStyle, width: '110px', flexShrink: 0 }} />
                    <button type="button" onClick={() => removePaymentRow(pay.id)}
                      style={{ color: '#c4b8aa', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', padding: '0 4px', flexShrink: 0 }}>
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addPaymentRow}
                style={{ marginTop: '6px', color: '#6b5f54', background: 'none', border: '1px dashed #c4b8aa', borderRadius: '6px', fontSize: '0.8rem', padding: '6px 12px', cursor: 'pointer', width: '100%' }}>
                ＋ 新增付款方式
              </button>
              <p style={{ color: '#9a8f84', fontSize: '0.75rem', marginTop: '6px', textAlign: 'right' }}>
                合計 {fmtAmt(payments.reduce((s, p) => s + (Number(p.amount) || 0), 0))}
              </p>
            </div>
          )}

          {form.payment_status === '未收費' && (
            <div className="space-y-1">
              <Label>預估金額（選填，供未收費時參考，之後收費不會自動加總）</Label>
              <input type="number" value={form.estimatedAmount} onChange={e => set('estimatedAmount', e.target.value)}
                placeholder="0" min="0" style={{ ...inputStyle, width: 'auto', minWidth: '160px' }} />
            </div>
          )}

          <div className="space-y-1">
            <Label>下次預約日期</Label>
            <input type="date" value={form.next_visit_date} onChange={e => set('next_visit_date', e.target.value)}
              style={{ ...inputStyle, width: 'auto', minWidth: '160px' }} />
          </div>

          <div className="space-y-1">
            <Label>備註</Label>
            <input value={form.note} onChange={e => set('note', e.target.value)}
              placeholder="選填" style={inputStyle} />
          </div>

          {error && (
            <p style={{ color: '#9a4a4a', fontSize: '0.82rem', background: '#fdf0f0', border: '1px solid #e8a8a8', borderRadius: '5px', padding: '8px 12px' }}>{error}</p>
          )}

          <button type="submit" disabled={saving}
            style={{
              width: '100%', background: saving ? '#c4b8aa' : '#2c2825',
              color: '#f7f4ef', border: 'none', borderRadius: '6px',
              fontSize: '0.9rem', padding: '11px', cursor: saving ? 'not-allowed' : 'pointer',
            }}>
            {saving ? '儲存中…' : editingId ? '儲存變更' : '儲存紀錄'}
          </button>
        </form>
      )}

      {/* List */}
      {loading ? (
        <div style={{ color: '#c4b8aa', textAlign: 'center', padding: '40px 0', fontSize: '0.85rem' }}>載入中…</div>
      ) : visits.length === 0 ? (
        <div style={{ color: '#c4b8aa', textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: '1.8rem', marginBottom: '10px' }}>—</div>
          <p style={{ fontSize: '0.85rem' }}>{date} 無紀錄</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visits.map(v => {
            const status = v.payment_status || (v.paid ? '已收費' : '未收費')
            const statusStyle = paymentStatusStyle[status] ?? paymentStatusStyle['未收費']
            return (
              <div key={v.id}
                style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '6px', padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ color: '#2c2825', fontSize: '0.95rem', fontWeight: 500 }}>{v.client_name}</span>
                      {v.client_level && <MembershipBadge tier={v.client_level} />}
                      <span style={{
                        fontSize: '0.68rem', padding: '2px 8px', borderRadius: '10px',
                        background: statusStyle.bg, color: statusStyle.color,
                      }}>{status}</span>
                      {!isPaidStatus(status) && (
                        <button onClick={() => quickCharge(v)}
                          style={{ fontSize: '0.68rem', padding: '2px 10px', borderRadius: '10px', background: '#2c2825', color: '#f7f4ef', border: 'none', cursor: 'pointer' }}>
                          收費
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '6px' }}>
                      {(v.items?.length ? v.items : [{ id: 0, category: '服務', label: v.service } as VisitLogItem]).map((it, idx) => {
                        const style = itemTagStyle[it.category] ?? itemTagStyle['服務']
                        return (
                          <span key={it.id || idx} style={{ background: style.bg, color: style.color, fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px' }}>
                            [{it.category}] {it.label}
                          </span>
                        )
                      })}
                    </div>
                    {isPaidStatus(status) && v.payments?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '4px' }}>
                        {v.payments.map(p => (
                          <span key={p.id} style={{ color: '#9a4a4a', fontSize: '0.72rem', background: '#fdf0f0', padding: '2px 8px', borderRadius: '4px' }}>
                            {p.method} {fmtAmt(p.amount)}
                          </span>
                        ))}
                      </div>
                    )}
                    {v.next_visit_date && (
                      <div style={{ color: '#9a8f84', fontSize: '0.75rem', marginTop: '6px' }}>下次預約：{v.next_visit_date}</div>
                    )}
                    {v.note && (
                      <div style={{ color: '#9a8f84', fontSize: '0.78rem', marginTop: '3px' }}>{v.note}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, marginLeft: '8px' }}>
                    {v.amount != null && (
                      isPaidStatus(status) ? (
                        <span style={{ color: '#9a4a4a', fontSize: '0.95rem', fontWeight: 500 }}>{fmtAmt(v.amount)}</span>
                      ) : (
                        <span style={{ color: '#9a8f84', fontSize: '0.85rem' }}>{fmtAmt(v.amount)}（預估）</span>
                      )
                    )}
                    <button onClick={() => startEdit(v)}
                      style={{ color: '#9a8f84', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.78rem', padding: '2px' }}>
                      編輯
                    </button>
                    <button onClick={() => handleDelete(v.id)} disabled={deleting === v.id}
                      style={{ color: '#c4b8aa', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', padding: '2px' }}>
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
