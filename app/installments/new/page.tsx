'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { PAYMENT_METHODS, ClientWithStats, MembershipLevel } from '@/types'
import MembershipBadge from '@/components/MembershipBadge'

interface Period {
  due_date: string
  amount: string
}

function today() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
}

function addMonths(dateStr: string, n: number) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setMonth(d.getMonth() + n)
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
}

function NewContractForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const presetClientId = searchParams.get('client_id')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [clients, setClients] = useState<ClientWithStats[]>([])
  const [selectedClient, setSelectedClient] = useState<ClientWithStats | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)

  const [payment_method, setPaymentMethod] = useState('現金')
  const [note, setNote] = useState('')
  const [totalInput, setTotalInput] = useState('')
  const [periods, setPeriods] = useState<Period[]>([
    { due_date: addMonths(today(), 1), amount: '' },
    { due_date: addMonths(today(), 2), amount: '' },
    { due_date: addMonths(today(), 3), amount: '' },
  ])

  // Load preset client
  useEffect(() => {
    if (presetClientId) {
      fetch(`/api/clients/${presetClientId}`)
        .then(r => r.json())
        .then(data => {
          setSelectedClient(data)
          setClientSearch(data.name)
        })
    }
  }, [presetClientId])

  // Search clients
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

  function selectClient(c: ClientWithStats) {
    setSelectedClient(c)
    setClientSearch(c.name)
    setShowDropdown(false)
    setClients([])
  }

  function clearClient() {
    setSelectedClient(null)
    setClientSearch('')
  }

  // Auto-fill period amounts from total
  function autoDistribute() {
    const total = Number(totalInput)
    if (!total || periods.length === 0) return
    const base = Math.floor(total / periods.length)
    const remainder = total - base * periods.length
    setPeriods(prev => prev.map((p, i) => ({
      ...p,
      amount: String(i === prev.length - 1 ? base + remainder : base),
    })))
  }

  function setPeriodCount(n: number) {
    setPeriods(prev => {
      const next: Period[] = []
      for (let i = 0; i < n; i++) {
        next.push(prev[i] ?? { due_date: addMonths(today(), i + 1), amount: '' })
      }
      return next
    })
  }

  function updatePeriod(i: number, k: keyof Period, v: string) {
    setPeriods(prev => prev.map((p, idx) => idx === i ? { ...p, [k]: v } : p))
  }

  const computedTotal = periods.reduce((s, p) => s + (Number(p.amount) || 0), 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedClient) { setError('請選擇客人'); return }
    const parsedPeriods = periods.map(p => ({ due_date: p.due_date, amount: Number(p.amount) || 0 }))
    if (parsedPeriods.some(p => !p.due_date)) { setError('請填寫所有期的日期'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: selectedClient.id,
          payment_method,
          note,
          periods: parsedPeriods,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || '發生錯誤'); return }
      router.push(`/clients/${selectedClient.id}`)
    } catch {
      setError('網路錯誤，請重試')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 pt-2">
        <Link href="/installments" style={{ color: '#9a8f84', fontSize: '0.9rem' }}>← 分期</Link>
        <h1 style={{ color: '#2c2825', fontSize: '1.2rem', fontWeight: 500 }}>新增分期合約</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Client selector */}
        <div className="space-y-1.5">
          <label style={labelStyle}>客人 *</label>
          {selectedClient ? (
            <div style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '6px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#2c2825' }}>{selectedClient.name}</span>
                <MembershipBadge tier={selectedClient.level as MembershipLevel} />
              </div>
              <button type="button" onClick={clearClient}
                style={{ color: '#9a8f84', fontSize: '0.8rem', background: 'none', border: 'none', cursor: 'pointer' }}>
                更換
              </button>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <input value={clientSearch}
                onChange={e => { setClientSearch(e.target.value); setShowDropdown(true) }}
                onFocus={() => setShowDropdown(true)}
                placeholder="輸入姓名搜尋…" {...inputProps} />
              {showDropdown && clients.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0,
                  background: '#faf8f5', border: '1px solid #e0d9d0',
                  borderRadius: '0 0 6px 6px', zIndex: 10, maxHeight: '200px', overflowY: 'auto',
                }}>
                  {clients.map(c => (
                    <button key={c.id} type="button"
                      onClick={() => selectClient(c)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        width: '100%', padding: '10px 14px', background: 'none',
                        border: 'none', borderBottom: '1px solid #f0ebe4',
                        cursor: 'pointer', textAlign: 'left',
                      }}>
                      <span style={{ color: '#2c2825', fontSize: '0.9rem' }}>{c.name}</span>
                      <MembershipBadge tier={c.level as MembershipLevel} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Payment method */}
        <div className="space-y-1.5">
          <label style={labelStyle}>付款方式</label>
          <select value={payment_method} onChange={e => setPaymentMethod(e.target.value)} {...inputProps}>
            {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {/* Period count + total */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div className="space-y-1.5">
            <label style={labelStyle}>期數</label>
            <select value={periods.length}
              onChange={e => setPeriodCount(Number(e.target.value))} {...inputProps}>
              {[1, 2, 3, 4, 5, 6, 8, 10, 12].map(n => (
                <option key={n} value={n}>{n} 期</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label style={labelStyle}>總金額（自動分配用）</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input value={totalInput} onChange={e => setTotalInput(e.target.value)}
                placeholder="選填" type="number" {...inputProps} style={{ ...inputStyle, flex: 1 }} />
              <button type="button" onClick={autoDistribute}
                style={{
                  background: '#f0ebe4', color: '#6b5f54', border: '1px solid #e0d9d0',
                  borderRadius: '6px', fontSize: '0.75rem', padding: '0 10px', cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}>
                分配
              </button>
            </div>
          </div>
        </div>

        {/* Per-period fields */}
        <div className="space-y-2">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={labelStyle}>各期明細</label>
            <span style={{ color: '#9a8f84', fontSize: '0.75rem' }}>
              合計 $ {computedTotal.toLocaleString()}
            </span>
          </div>
          {periods.map((p, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: '8px', alignItems: 'center' }}>
              <span style={{ color: '#9a8f84', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>第 {i + 1} 期</span>
              <input value={p.due_date} onChange={e => updatePeriod(i, 'due_date', e.target.value)}
                type="date" {...inputProps} />
              <input value={p.amount} onChange={e => updatePeriod(i, 'amount', e.target.value)}
                placeholder="金額" type="number" {...inputProps} />
            </div>
          ))}
        </div>

        {/* Note */}
        <div className="space-y-1.5">
          <label style={labelStyle}>備註</label>
          <input value={note} onChange={e => setNote(e.target.value)}
            placeholder="備註（選填）" {...inputProps} />
        </div>

        {error && (
          <p style={{ color: '#9a4a4a', fontSize: '0.85rem', background: '#fdf0f0', border: '1px solid #e8a8a8', borderRadius: '5px' }}
            className="px-3 py-2">
            {error}
          </p>
        )}

        <button type="submit" disabled={saving}
          style={{
            width: '100%', background: saving ? '#c4b8aa' : '#2c2825',
            color: '#f7f4ef', border: 'none', borderRadius: '6px',
            fontSize: '0.95rem', letterSpacing: '0.06em', padding: '12px',
            cursor: saving ? 'not-allowed' : 'pointer',
          }}>
          {saving ? '建立中…' : '建立分期合約'}
        </button>
      </form>
    </div>
  )
}

export default function NewInstallmentPage() {
  return (
    <Suspense>
      <NewContractForm />
    </Suspense>
  )
}

const labelStyle: React.CSSProperties = { color: '#6b5f54', fontSize: '0.78rem', letterSpacing: '0.06em' }
const inputStyle: React.CSSProperties = {
  width: '100%', background: '#faf8f5', border: '1px solid #e0d9d0',
  borderRadius: '6px', color: '#2c2825', fontSize: '0.9rem',
  outline: 'none', padding: '10px 14px',
}
const inputProps = { style: inputStyle }
