'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MembershipTier, PaymentMethod } from '@/types'

const MEMBERSHIP_TIERS: MembershipTier[] = ['甜癒米', '療癒米', '悟癒米']
const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: '現金' },
  { value: 'transfer', label: '轉帳' },
  { value: 'card', label: '刷卡' },
  { value: 'other', label: '其他' },
]

export default function NewCustomerPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    total_amount: '',
    installment_amount: '',
    payment_method: 'cash' as PaymentMethod,
    total_periods: '3',
    membership_tier: '甜癒米' as MembershipTier,
    notes: '',
  })
  const [dueDates, setDueDates] = useState(['', '', ''])

  const periods = parseInt(form.total_periods) || 3

  // sync dueDates array length with periods
  const handlePeriodsChange = (val: string) => {
    const n = parseInt(val) || 3
    setForm(f => ({ ...f, total_periods: val }))
    setDueDates(prev => {
      const arr = [...prev]
      while (arr.length < n) arr.push('')
      return arr.slice(0, n)
    })
  }

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (dueDates.some(d => !d)) {
      alert('請填寫所有期的繳款日期')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          total_amount: parseInt(form.total_amount),
          installment_amount: parseInt(form.installment_amount),
          total_periods: periods,
          due_dates: dueDates,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        router.push(`/customers/${data.id}`)
      } else {
        alert(data.error || '新增失敗')
      }
    } catch {
      alert('網路錯誤')
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="pt-2">
        <h1 className="text-2xl font-bold text-pink-700">新增客人</h1>
        <p className="text-sm text-gray-500 mt-1">填寫分期資訊</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">客人姓名 *</label>
          <input
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-400"
            placeholder="例：小明"
            value={form.name}
            onChange={e => set('name', e.target.value)}
          />
        </div>

        {/* Amounts */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">總金額 *</label>
            <input
              required type="number" min="0"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-400"
              placeholder="18000"
              value={form.total_amount}
              onChange={e => set('total_amount', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">分期金額 *</label>
            <input
              required type="number" min="0"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-400"
              placeholder="6000"
              value={form.installment_amount}
              onChange={e => set('installment_amount', e.target.value)}
            />
          </div>
        </div>

        {/* Payment method & periods */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">付款方式</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-400"
              value={form.payment_method}
              onChange={e => set('payment_method', e.target.value)}
            >
              {PAYMENT_METHODS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">期數</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-400"
              value={form.total_periods}
              onChange={e => handlePeriodsChange(e.target.value)}
            >
              <option value="3">3 期</option>
              <option value="4">4 期</option>
            </select>
          </div>
        </div>

        {/* Due dates per period */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">各期繳款日期 *</label>
          <div className="space-y-2">
            {Array.from({ length: periods }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-sm text-gray-500 w-10 text-right">第 {i + 1} 期</span>
                <input
                  required type="date"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-400"
                  value={dueDates[i] || ''}
                  onChange={e => {
                    const arr = [...dueDates]
                    arr[i] = e.target.value
                    setDueDates(arr)
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Membership tier */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">完成後升等會員</label>
          <div className="flex gap-2">
            {MEMBERSHIP_TIERS.map(tier => (
              <button
                key={tier} type="button"
                onClick={() => set('membership_tier', tier)}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors
                  ${form.membership_tier === tier
                    ? tier === '甜癒米' ? 'bg-pink-500 border-pink-500 text-white'
                    : tier === '療癒米' ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'bg-purple-500 border-purple-500 text-white'
                    : 'border-gray-200 text-gray-600 hover:border-pink-300'
                  }`}
              >
                {tier}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">備註</label>
          <textarea
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-400 resize-none"
            rows={2}
            placeholder="選填..."
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
          />
        </div>

        <button
          type="submit" disabled={loading}
          className="w-full bg-pink-500 hover:bg-pink-600 disabled:bg-pink-300 text-white py-3 rounded-xl font-semibold text-base transition-colors"
        >
          {loading ? '儲存中...' : '✅ 儲存客人'}
        </button>
      </form>
    </div>
  )
}
