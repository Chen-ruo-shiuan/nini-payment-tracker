'use client'
import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MembershipTier, PaymentMethod } from '@/types'

const MEMBERSHIP_TIERS: MembershipTier[] = ['甜癒米', '療癒米', '悟癒米']
const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: '現金' },
  { value: 'transfer', label: '轉帳' },
  { value: 'card', label: '刷卡' },
  { value: 'other', label: '其他' },
]

export default function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    total_amount: '',
    installment_amount: '',
    payment_method: 'cash' as PaymentMethod,
    membership_tier: '甜癒米' as MembershipTier,
    notes: '',
  })

  useEffect(() => {
    fetch(`/api/customers/${id}`).then(r => r.json()).then(data => {
      setForm({
        name: data.name,
        total_amount: String(data.total_amount),
        installment_amount: String(data.installment_amount),
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
      body: JSON.stringify({
        ...form,
        total_amount: parseInt(form.total_amount),
        installment_amount: parseInt(form.installment_amount),
      }),
    })
    router.push(`/customers/${id}`)
  }

  if (loading) return <div className="text-center py-20 text-gray-400">載入中...</div>

  return (
    <div className="space-y-6">
      <div className="pt-2">
        <Link href={`/customers/${id}`} className="text-sm text-pink-500 hover:underline">
          ← 返回
        </Link>
        <h1 className="text-2xl font-bold text-pink-700 mt-2">編輯客人</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">客人姓名 *</label>
          <input
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-400"
            value={form.name} onChange={e => set('name', e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">總金額</label>
            <input
              type="number" min="0"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-400"
              value={form.total_amount} onChange={e => set('total_amount', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">分期金額</label>
            <input
              type="number" min="0"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-400"
              value={form.installment_amount} onChange={e => set('installment_amount', e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">付款方式</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-400"
            value={form.payment_method} onChange={e => set('payment_method', e.target.value)}
          >
            {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">完成後升等會員</label>
          <div className="flex gap-2">
            {MEMBERSHIP_TIERS.map(tier => (
              <button key={tier} type="button" onClick={() => set('membership_tier', tier)}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors
                  ${form.membership_tier === tier
                    ? tier === '甜癒米' ? 'bg-pink-500 border-pink-500 text-white'
                    : tier === '療癒米' ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'bg-purple-500 border-purple-500 text-white'
                    : 'border-gray-200 text-gray-600'}`}
              >
                {tier}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">備註</label>
          <textarea
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-400 resize-none"
            rows={2} value={form.notes} onChange={e => set('notes', e.target.value)}
          />
        </div>
        <button
          type="submit" disabled={saving}
          className="w-full bg-pink-500 hover:bg-pink-600 disabled:bg-pink-300 text-white py-3 rounded-xl font-semibold transition-colors"
        >
          {saving ? '儲存中...' : '儲存變更'}
        </button>
      </form>
    </div>
  )
}
