'use client'
import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MembershipTier, PaymentMethod } from '@/types'

const TIERS: MembershipTier[] = ['甜癒米', '療癒米', '悟癒米']
const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: '現金' },
  { value: 'transfer', label: '轉帳' },
  { value: 'card', label: '刷卡' },
  { value: 'other', label: '其他' },
]

const fieldStyle = {
  border: '1px solid #e0d9d0', borderRadius: '4px', padding: '8px 12px',
  width: '100%', background: '#faf8f5', color: '#2c2825', fontSize: '0.9rem', outline: 'none',
}
const labelStyle = {
  display: 'block', color: '#9a8f84', fontSize: '0.72rem',
  letterSpacing: '0.1em', marginBottom: '6px',
}

export default function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', total_amount: '', payment_method: 'cash' as PaymentMethod,
    membership_tier: '甜癒米' as MembershipTier, notes: '',
  })

  useEffect(() => {
    fetch(`/api/customers/${id}`).then(r => r.json()).then(data => {
      setForm({
        name: data.name,
        total_amount: String(data.total_amount),
        payment_method: data.payment_method,
        membership_tier: data.membership_tier,
        notes: data.notes || '',
      })
      setLoading(false)
    })
  }, [id])

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await fetch(`/api/customers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, total_amount: parseInt(form.total_amount) || 0, installment_amount: 0 }),
    })
    router.push(`/customers/${id}`)
  }

  if (loading) return <div className="text-center py-20" style={{ color: '#9a8f84', fontSize: '0.85rem' }}>載入中…</div>

  return (
    <div className="space-y-7">
      <div className="pt-2">
        <Link href={`/customers/${id}`} style={{ color: '#9a8f84', fontSize: '0.78rem' }} className="hover:underline underline-offset-4">← 返回</Link>
        <h1 style={{ color: '#2c2825', fontSize: '1.4rem', letterSpacing: '0.05em', fontWeight: 500, marginTop: '12px' }}>編輯客人</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label style={labelStyle}>客人姓名</label>
          <input required style={fieldStyle} value={form.name} onChange={e => set('name', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>總金額</label>
          <input type="number" min="0" style={fieldStyle} value={form.total_amount} onChange={e => set('total_amount', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>付款方式</label>
          <select style={fieldStyle} value={form.payment_method} onChange={e => set('payment_method', e.target.value)}>
            {METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
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
                }}>
                {tier}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={labelStyle}>備註</label>
          <textarea style={{ ...fieldStyle, resize: 'none' }} rows={2}
            value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>
        <button type="submit" disabled={saving}
          style={{ width: '100%', background: saving ? '#c4b8aa' : '#6b5f54', color: '#faf8f5', padding: '12px', borderRadius: '4px', fontSize: '0.9rem', letterSpacing: '0.08em', border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? '儲存中…' : '儲存'}
        </button>
      </form>
    </div>
  )
}
