'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MembershipTier, PaymentMethod } from '@/types'

const TIERS: MembershipTier[] = ['甜癒米', '療癒米', '悟癒米']
const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: '現金' },
  { value: 'transfer', label: '轉帳' },
  { value: 'card', label: '刷卡' },
  { value: 'other', label: '其他' },
]

const fieldStyle = {
  border: '1px solid #e0d9d0',
  borderRadius: '4px',
  padding: '8px 12px',
  width: '100%',
  background: '#faf8f5',
  color: '#2c2825',
  fontSize: '0.9rem',
  outline: 'none',
}

const labelStyle = {
  display: 'block',
  color: '#9a8f84',
  fontSize: '0.72rem',
  letterSpacing: '0.1em',
  marginBottom: '6px',
}

export default function NewCustomerPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    total_amount: '',
    payment_method: 'cash' as PaymentMethod,
    total_periods: '3',
    membership_tier: '甜癒米' as MembershipTier,
    notes: '',
  })
  // Each period: { date, amount }
  const [periods, setPeriods] = useState([
    { date: '', amount: '' },
    { date: '', amount: '' },
    { date: '', amount: '' },
  ])

  const periodCount = parseInt(form.total_periods) || 3

  const handlePeriodsChange = (val: string) => {
    const n = parseInt(val) || 3
    setForm(f => ({ ...f, total_periods: val }))
    setPeriods(prev => {
      const arr = [...prev]
      while (arr.length < n) arr.push({ date: '', amount: '' })
      return arr.slice(0, n)
    })
  }

  const setPeriod = (i: number, key: 'date' | 'amount', val: string) => {
    setPeriods(prev => prev.map((p, idx) => idx === i ? { ...p, [key]: val } : p))
  }

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (periods.some(p => !p.date || !p.amount)) {
      alert('請填寫每期的日期與金額')
      return
    }
    setLoading(true)
    try {
      // Calculate total from periods if not manually entered
      const totalFromPeriods = periods.reduce((sum, p) => sum + (parseInt(p.amount) || 0), 0)
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          total_amount: parseInt(form.total_amount) || totalFromPeriods,
          installment_amount: parseInt(periods[0].amount) || 0,
          payment_method: form.payment_method,
          total_periods: periodCount,
          membership_tier: form.membership_tier,
          notes: form.notes || null,
          due_dates: periods.map(p => p.date),
          period_amounts: periods.map(p => parseInt(p.amount) || 0),
        }),
      })
      const data = await res.json()
      if (res.ok) router.push(`/customers/${data.id}`)
      else alert(data.error || '新增失敗')
    } catch {
      alert('網路錯誤')
    }
    setLoading(false)
  }

  return (
    <div className="space-y-7">
      <div className="pt-2">
        <h1 style={{ color: '#2c2825', fontSize: '1.4rem', letterSpacing: '0.05em', fontWeight: 500 }}>
          新增客人
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Name */}
        <div>
          <label style={labelStyle}>客人姓名</label>
          <input required style={fieldStyle} placeholder="姓名"
            value={form.name} onChange={e => set('name', e.target.value)} />
        </div>

        {/* Total amount */}
        <div>
          <label style={labelStyle}>總金額（選填，可由各期加總自動計算）</label>
          <input type="number" min="0" style={fieldStyle} placeholder="留空則自動加總各期金額"
            value={form.total_amount} onChange={e => set('total_amount', e.target.value)} />
        </div>

        {/* Method & Periods */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={labelStyle}>付款方式</label>
            <select style={fieldStyle} value={form.payment_method}
              onChange={e => set('payment_method', e.target.value)}>
              {METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>期數</label>
            <select style={fieldStyle} value={form.total_periods}
              onChange={e => handlePeriodsChange(e.target.value)}>
              <option value="3">3 期</option>
              <option value="4">4 期</option>
            </select>
          </div>
        </div>

        {/* Per-period date & amount */}
        <div>
          <label style={labelStyle}>各期日期與金額</label>
          <div className="space-y-3">
            {Array.from({ length: periodCount }).map((_, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: '10px', alignItems: 'center' }}>
                <span style={{ color: '#9a8f84', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                  第 {i + 1} 期
                </span>
                <input required type="date" style={fieldStyle}
                  value={periods[i]?.date || ''}
                  onChange={e => setPeriod(i, 'date', e.target.value)} />
                <input required type="number" min="0" style={fieldStyle} placeholder="金額"
                  value={periods[i]?.amount || ''}
                  onChange={e => setPeriod(i, 'amount', e.target.value)} />
              </div>
            ))}
          </div>
          {/* Auto-sum */}
          {periods.some(p => p.amount) && (
            <p style={{ color: '#9a8f84', fontSize: '0.75rem', marginTop: '8px' }}>
              各期合計：$ {periods.reduce((s, p) => s + (parseInt(p.amount) || 0), 0).toLocaleString()}
            </p>
          )}
        </div>

        {/* Membership tier */}
        <div>
          <label style={labelStyle}>完成後升等會員</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {TIERS.map(tier => (
              <button key={tier} type="button" onClick={() => set('membership_tier', tier)}
                style={{
                  flex: 1, padding: '8px', borderRadius: '4px', fontSize: '0.82rem',
                  border: form.membership_tier === tier ? '1px solid #6b5f54' : '1px solid #e0d9d0',
                  background: form.membership_tier === tier ? '#6b5f54' : '#faf8f5',
                  color: form.membership_tier === tier ? '#faf8f5' : '#9a8f84',
                  transition: 'all 0.15s',
                }}>
                {tier}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label style={labelStyle}>備註（選填）</label>
          <textarea style={{ ...fieldStyle, resize: 'none' }} rows={2} placeholder="…"
            value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>

        <button type="submit" disabled={loading}
          style={{
            width: '100%', background: loading ? '#c4b8aa' : '#6b5f54', color: '#faf8f5',
            padding: '12px', borderRadius: '4px', fontSize: '0.9rem', letterSpacing: '0.08em',
            border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
          }}>
          {loading ? '儲存中…' : '儲存'}
        </button>
      </form>
    </div>
  )
}
