'use client'
import { useState, useEffect, useCallback } from 'react'
import { PAYMENT_METHODS } from '@/types'

const EXPENSE_CATEGORIES = ['食材耗材', '設備器材', '薪資', '租金', '行銷廣告', '交通', '雜支']
const PAY_METHODS = ['店內現金', ...PAYMENT_METHODS.filter(m => m !== '現金'), '現金']

interface Expense {
  id: number; date: string; category: string; note: string | null
  amount: number; pay_method: string
}

const fmtAmt = (n: number) => `$ ${n.toLocaleString()}`
const fmtShort = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })

function todayLocal() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
}
function thisMonthStr() { return todayLocal().slice(0, 7) }

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#faf8f5', border: '1px solid #e0d9d0',
  borderRadius: '6px', color: '#2c2825', fontSize: '0.9rem', outline: 'none', padding: '9px 12px',
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(thisMonthStr())
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<number | null>(null)

  const [form, setForm] = useState({
    date: todayLocal(),
    category: '食材耗材',
    note: '',
    amount: '',
    pay_method: '店內現金',
  })

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/expenses?month=${month}`)
      .then(r => r.json())
      .then(d => { setExpenses(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [month])

  useEffect(() => { load() }, [load])

  function set(k: string, v: string) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || '發生錯誤'); return }
      setShowForm(false)
      setForm({ date: todayLocal(), category: '食材耗材', note: '', amount: '', pay_method: '店內現金' })
      load()
    } catch { setError('網路錯誤') } finally { setSaving(false) }
  }

  async function handleDelete(id: number) {
    if (!confirm('確定刪除此筆支出？')) return
    setDeleting(id)
    await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
    setDeleting(null)
    load()
  }

  // Group by date
  const byDate = new Map<string, Expense[]>()
  for (const exp of expenses) {
    const arr = byDate.get(exp.date) ?? []
    arr.push(exp)
    byDate.set(exp.date, arr)
  }

  const monthTotal = expenses.reduce((s, e) => s + e.amount, 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between pt-2">
        <div>
          <h1 style={{ color: '#2c2825', fontSize: '1.4rem', letterSpacing: '0.05em', fontWeight: 500 }}>支出</h1>
          <p style={{ color: '#9a8f84', fontSize: '0.78rem', marginTop: '2px' }}>
            {expenses.length} 筆　合計 {fmtAmt(monthTotal)}
          </p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          style={{
            background: showForm ? '#f0ebe4' : '#2c2825',
            color: showForm ? '#6b5f54' : '#f7f4ef',
            border: 'none', borderRadius: '5px', fontSize: '0.8rem',
          }} className="px-4 py-2">
          {showForm ? '取消' : '＋ 新增'}
        </button>
      </div>

      {/* Month picker */}
      <input type="month" value={month} onChange={e => setMonth(e.target.value)}
        style={{ ...inputStyle, width: 'auto', minWidth: '140px' }} />

      {/* New expense form */}
      {showForm && (
        <form onSubmit={handleSubmit}
          style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '8px', padding: '16px' }}
          className="space-y-3">
          <p style={{ color: '#6b5f54', fontSize: '0.78rem', letterSpacing: '0.06em', marginBottom: '4px' }}>新增支出</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="space-y-1">
              <label style={{ color: '#6b5f54', fontSize: '0.75rem' }}>日期</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={inputStyle} />
            </div>
            <div className="space-y-1">
              <label style={{ color: '#6b5f54', fontSize: '0.75rem' }}>金額 *</label>
              <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)}
                placeholder="0" min="1" style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="space-y-1">
              <label style={{ color: '#6b5f54', fontSize: '0.75rem' }}>類別</label>
              <select value={form.category} onChange={e => set('category', e.target.value)} style={inputStyle}>
                {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label style={{ color: '#6b5f54', fontSize: '0.75rem' }}>付款方式</label>
              <select value={form.pay_method} onChange={e => set('pay_method', e.target.value)} style={inputStyle}>
                {PAY_METHODS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label style={{ color: '#6b5f54', fontSize: '0.75rem' }}>備註</label>
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
            {saving ? '儲存中…' : '儲存支出'}
          </button>
        </form>
      )}

      {/* List */}
      {loading ? (
        <div style={{ color: '#c4b8aa', textAlign: 'center', padding: '40px 0', fontSize: '0.85rem' }}>載入中…</div>
      ) : expenses.length === 0 ? (
        <div style={{ color: '#c4b8aa', textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: '1.8rem', marginBottom: '10px' }}>—</div>
          <p style={{ fontSize: '0.85rem' }}>本月無支出記錄</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(byDate.entries()).map(([date, items]) => {
            const dayTotal = items.reduce((s, e) => s + e.amount, 0)
            return (
              <div key={date}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #f0ebe4', marginBottom: '6px' }}>
                  <span style={{ color: '#9a8f84', fontSize: '0.75rem' }}>{fmtShort(date)}</span>
                  <span style={{ color: '#9a8f84', fontSize: '0.72rem' }}>{items.length} 筆　{fmtAmt(dayTotal)}</span>
                </div>
                <div className="space-y-2">
                  {items.map(exp => (
                    <div key={exp.id}
                      style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '6px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            background: '#f0ebe4', color: '#6b5f54',
                            fontSize: '0.68rem', padding: '2px 8px', borderRadius: '3px',
                          }}>{exp.category}</span>
                          <span style={{ color: '#9a8f84', fontSize: '0.72rem' }}>{exp.pay_method}</span>
                        </div>
                        {exp.note && (
                          <div style={{ color: '#2c2825', fontSize: '0.85rem', marginTop: '4px' }}>{exp.note}</div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, marginLeft: '8px' }}>
                        <span style={{ color: '#9a4a4a', fontSize: '0.95rem', fontWeight: 500 }}>
                          {fmtAmt(exp.amount)}
                        </span>
                        <button onClick={() => handleDelete(exp.id)} disabled={deleting === exp.id}
                          style={{ color: '#c4b8aa', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', padding: '2px' }}>
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
