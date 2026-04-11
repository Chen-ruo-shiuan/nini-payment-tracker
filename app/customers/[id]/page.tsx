'use client'
import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import MembershipBadge from '@/components/MembershipBadge'
import { CustomerWithInstallments, MembershipTier } from '@/types'

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: '現金', transfer: '轉帳', card: '刷卡', other: '其他'
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('zh-TW', {
    year: 'numeric', month: 'long', day: 'numeric'
  })
}

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [customer, setCustomer] = useState<CustomerWithInstallments | null>(null)
  const [loading, setLoading] = useState(true)
  const [payingId, setPayingId] = useState<number | null>(null)
  const [completionTier, setCompletionTier] = useState<MembershipTier | null>(null)

  const load = async () => {
    const res = await fetch(`/api/customers/${id}`)
    if (res.ok) setCustomer(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  const handlePay = async (installmentId: number) => {
    if (!confirm('確認標記為已繳？')) return
    setPayingId(installmentId)
    const res = await fetch(`/api/installments/${installmentId}/pay`, { method: 'POST' })
    const data = await res.json()
    if (data.completed) setCompletionTier(data.membershipTier)
    await load()
    setPayingId(null)
  }

  const handleUndoPay = async (installmentId: number) => {
    if (!confirm('確認取消已繳？')) return
    setPayingId(installmentId)
    await fetch(`/api/installments/${installmentId}/pay`, { method: 'DELETE' })
    await load()
    setPayingId(null)
  }

  const handleDelete = async () => {
    if (!confirm(`確認刪除「${customer?.name}」的資料？此動作無法復原`)) return
    await fetch(`/api/customers/${id}`, { method: 'DELETE' })
    router.push('/customers')
  }

  if (loading) return <div className="text-center py-20 text-gray-400">載入中...</div>
  if (!customer) return <div className="text-center py-20 text-gray-400">找不到客人</div>

  const paidCount = customer.installments.filter(i => i.paid_at).length

  return (
    <div className="space-y-6">
      {/* Completion Modal */}
      {completionTier && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 text-center max-w-sm w-full shadow-2xl">
            <div className="text-5xl mb-3">🎉</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">分期完成！</h2>
            <p className="text-gray-600 mb-4">
              <span className="font-semibold">{customer.name}</span> 已繳清所有款項
            </p>
            <p className="text-sm text-gray-500 mb-4">升等會員</p>
            <MembershipBadge tier={completionTier} />
            <button
              onClick={() => setCompletionTier(null)}
              className="mt-6 w-full bg-pink-500 text-white py-2 rounded-xl font-medium"
            >
              確認
            </button>
          </div>
        </div>
      )}

      {/* Back */}
      <div className="pt-2">
        <Link href="/customers" className="text-sm text-pink-500 hover:underline">
          ← 返回客人列表
        </Link>
      </div>

      {/* Customer info */}
      <div className="bg-white rounded-2xl p-5 border border-pink-200">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{customer.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <MembershipBadge tier={customer.membership_tier} />
              {customer.is_completed ? (
                <span className="text-xs text-emerald-600 font-medium">✅ 已完成</span>
              ) : (
                <span className="text-xs text-amber-600 font-medium">進行中</span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-pink-600">
              ${customer.total_amount.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500">
              每期 ${customer.installment_amount.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
          <div>
            <span className="text-gray-500">付款方式</span>
            <span className="ml-2 font-medium">{PAYMENT_METHOD_LABEL[customer.payment_method]}</span>
          </div>
          <div>
            <span className="text-gray-500">期數</span>
            <span className="ml-2 font-medium">{paidCount}/{customer.total_periods} 期</span>
          </div>
          {customer.notes && (
            <div className="col-span-2">
              <span className="text-gray-500">備註</span>
              <span className="ml-2 font-medium">{customer.notes}</span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-4 bg-pink-100 rounded-full h-2">
          <div
            className="bg-pink-500 h-2 rounded-full transition-all"
            style={{ width: `${(paidCount / customer.total_periods) * 100}%` }}
          />
        </div>
      </div>

      {/* Installments */}
      <div>
        <h2 className="text-base font-bold text-gray-700 mb-3">分期明細</h2>
        <div className="space-y-3">
          {customer.installments.map(inst => {
            const isPaid = !!inst.paid_at
            const isPaying = payingId === inst.id
            const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
            const isOverdue = !isPaid && inst.due_date < today

            return (
              <div
                key={inst.id}
                className={`bg-white rounded-xl p-4 border transition-colors
                  ${isPaid ? 'border-emerald-200' : isOverdue ? 'border-red-300' : 'border-pink-200'}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-bold ${isPaid ? 'text-emerald-600' : isOverdue ? 'text-red-600' : 'text-gray-800'}`}>
                        第 {inst.period_number} 期
                      </span>
                      {isOverdue && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">逾期</span>}
                    </div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      {isPaid
                        ? `已繳 · ${formatDate(inst.paid_at!)}`
                        : `應繳日：${formatDate(inst.due_date)}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-bold text-lg ${isPaid ? 'text-emerald-600' : 'text-pink-600'}`}>
                      ${inst.amount.toLocaleString()}
                    </span>
                    {isPaid ? (
                      <button
                        onClick={() => handleUndoPay(inst.id)}
                        disabled={isPaying}
                        className="text-xs text-gray-400 hover:text-red-500 underline"
                      >
                        取消
                      </button>
                    ) : (
                      <button
                        onClick={() => handlePay(inst.id)}
                        disabled={isPaying}
                        className="bg-pink-500 hover:bg-pink-600 disabled:bg-pink-300 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                      >
                        {isPaying ? '...' : '標記已繳'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pb-4">
        <Link
          href={`/customers/${id}/edit`}
          className="flex-1 text-center border border-pink-300 text-pink-600 py-2.5 rounded-xl font-medium hover:bg-pink-50 transition-colors"
        >
          編輯資料
        </Link>
        <button
          onClick={handleDelete}
          className="flex-1 border border-red-200 text-red-500 py-2.5 rounded-xl font-medium hover:bg-red-50 transition-colors"
        >
          刪除客人
        </button>
      </div>
    </div>
  )
}
