'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { PAYMENT_METHODS, ClientWithStats, MembershipLevel } from '@/types'
import MembershipBadge from '@/components/MembershipBadge'

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

  const [form, setForm] = useState({
    service_name: '',
    total_sessions: '1',
    unit_price: '',
    prepaid_amount: '',
    payment_method: '現金',
    date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' }),
    note: '',
    include_in_accumulation: true,
    include_in_points: true,
  })

  useEffect(() => {
    if (presetClientId) {
      fetch(`/api/clients/${presetClientId}`)
        .then(r => r.json())
        .then(d => { setSelectedClient(d); setClientSearch(d.name) })
    }
  }, [presetClientId])

  const searchClients = useCallback(async (q: string) => {
    if (!q) { setClients([]); return }
    const res = await fetch(`/api/clients?q=${encodeURIComponent(q)}`)
    setClients(await res.json())
  }, [])

  useEffect(() => {
    if (selectedClient) return
    const t = setTimeout(() => searchClients(clientSearch), 250)
    return () => clearTimeout(t)
  }, [clientSearch, searchClients, selectedClient])

  function set(k: string, v: string | boolean) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  // Auto-fill prepaid from unit_price × sessions
  useEffect(() => {
    const u = Number(form.unit_price), s = Number(form.total_sessions)
    if (u > 0 && s > 0) set('prepaid_amount', String(u * s))
  }, [form.unit_price, form.total_sessions])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedClient) { setError('請選擇客人'); return }
    if (!form.service_name) { setError('請輸入服務名稱'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, client_id: selectedClient.id }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || '發生錯誤'); return }
      router.push(`/clients/${selectedClient.id}`)
    } catch { setError('網路錯誤') } finally { setSaving(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 pt-2">
        <Link href="/packages" style={{ color: '#9a8f84', fontSize: '0.9rem' }}>← 套組</Link>
        <h1 style={{ color: '#2c2825', fontSize: '1.2rem', fontWeight: 500 }}>新增套組</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Client */}
        <Field label="客人 *">
          {selectedClient ? (
            <div style={{ ...inputStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                placeholder="搜尋客人…" style={inputStyle} />
              {showDropdown && clients.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '0 0 6px 6px', zIndex: 10 }}>
                  {clients.map(c => (
                    <button key={c.id} type="button" onClick={() => { setSelectedClient(c); setClientSearch(c.name); setShowDropdown(false) }}
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

        <Field label="服務名稱 *">
          <input value={form.service_name} onChange={e => set('service_name', e.target.value)}
            placeholder="例：泡光氧彗、雨林頭療…" style={inputStyle} />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <Field label="總堂數 *">
            <input value={form.total_sessions} onChange={e => set('total_sessions', e.target.value)}
              type="number" min="1" style={inputStyle} />
          </Field>
          <Field label="單堂單價">
            <input value={form.unit_price} onChange={e => set('unit_price', e.target.value)}
              type="number" placeholder="0" style={inputStyle} />
          </Field>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <Field label="預收金額">
            <input value={form.prepaid_amount} onChange={e => set('prepaid_amount', e.target.value)}
              type="number" placeholder="自動計算" style={inputStyle} />
          </Field>
          <Field label="付款方式">
            <select value={form.payment_method} onChange={e => set('payment_method', e.target.value)} style={inputStyle}>
              {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
            </select>
          </Field>
        </div>

        <Field label="購買日期">
          <input value={form.date} onChange={e => set('date', e.target.value)} type="date" style={inputStyle} />
        </Field>

        <Field label="備註">
          <input value={form.note} onChange={e => set('note', e.target.value)} placeholder="選填" style={inputStyle} />
        </Field>

        {/* Flags */}
        <div style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '6px', padding: '12px' }} className="space-y-2">
          <p style={{ color: '#6b5f54', fontSize: '0.78rem', letterSpacing: '0.06em', marginBottom: '8px' }}>計算設定</p>
          {[
            { key: 'include_in_accumulation', label: '列入年度消費累積' },
            { key: 'include_in_points',       label: '計入金米點數' },
          ].map(({ key, label }) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={form[key as keyof typeof form] as boolean}
                onChange={e => set(key, e.target.checked)}
                style={{ accentColor: '#6b5f54', width: '15px', height: '15px' }} />
              <span style={{ color: '#2c2825', fontSize: '0.85rem' }}>{label}</span>
            </label>
          ))}
        </div>

        {error && (
          <p style={{ color: '#9a4a4a', fontSize: '0.85rem', background: '#fdf0f0', border: '1px solid #e8a8a8', borderRadius: '5px' }}
            className="px-3 py-2">{error}</p>
        )}

        <button type="submit" disabled={saving}
          style={{
            width: '100%', background: saving ? '#c4b8aa' : '#2c2825',
            color: '#f7f4ef', border: 'none', borderRadius: '6px',
            fontSize: '0.95rem', padding: '12px', cursor: saving ? 'not-allowed' : 'pointer',
          }}>
          {saving ? '建立中…' : '建立套組'}
        </button>
      </form>
    </div>
  )
}

export default function NewPackagePage() {
  return <Suspense><NewPackageForm /></Suspense>
}

const inputStyle: React.CSSProperties = {
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
