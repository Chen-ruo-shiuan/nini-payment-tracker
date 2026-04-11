'use client'
import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import MembershipBadge from '@/components/MembershipBadge'
import { CustomerWithInstallments, MembershipTier } from '@/types'

const METHOD_LABEL: Record<string, string> = {
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
    if (!confirm(`確認刪除「${customer?.name}」？`)) return
    await fetch(`/api/customers/${id}`, { method: 'DELETE' })
    router.push('/customers')
  }

  if (loading) return (
    <div className="text-center py-20" style={{ color: '#9a8f84', fontSize: '0.85rem' }}>載入中…</div>
  )
  if (!customer) return (
    <div className="text-center py-20" style={{ color: '#9a8f84' }}>找不到客人</div>
  )

  const paidCount = customer.installments.filter(i => i.paid_at).length
  const totalPaid = customer.installments.filter(i => i.paid_at).reduce((s, i) => s + i.amount, 0)
  const totalDue = customer.installments.reduce((s, i) => s + i.amount, 0)

  return (
    <div className="space-y-6">
      {/* Completion modal */}
      {completionTier && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(44,40,37,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '20px' }}>
          <div style={{ background: '#faf8f5', borderRadius: '8px', padding: '40px 32px', maxWidth: '320px', width: '100%', textAlign: 'center' }}>
            <p style={{ fontSize: '0.7rem', color: '#9a8f84', letterSpacing: '0.15em', marginBottom: '12px' }}>分期完成</p>
            <p style={{ fontSize: '1.1rem', color: '#2c2825', marginBottom: '6px' }}>{customer.name}</p>
            <p style={{ fontSize: '0.82rem', color: '#9a8f84', marginBottom: '20px' }}>已繳清所有款項</p>
            <p style={{ fontSize: '0.7rem', color: '#9a8f84', letterSpacing: '0.1em', marginBottom: '8px' }}>升等會員</p>
            <MembershipBadge tier={completionTier} />
            <button onClick={() => setCompletionTier(null)}
              style={{ marginTop: '24px', width: '100%', background: '#6b5f54', color: '#faf8f5', padding: '10px', borderRadius: '4px', border: 'none', fontSize: '0.85rem', cursor: 'pointer' }}>
              確認
            </button>
          </div>
        </div>
      )}

      <div className="pt-2">
        <Link href="/customers" style={{ color: '#9a8f84', fontSize: '0.78rem' }} className="hover:underline underline-offset-4">
          ← 返回
        </Link>
      </div>

      {/* Customer card */}
      <div style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '6px', padding: '20px' }}>
        <div className="flex items-start justify-between">
          <div>
            <h1 style={{ color: '#2c2825', fontSize: '1.3rem', fontWeight: 500 }}>{customer.name}</h1>
            <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MembershipBadge tier={customer.membership_tier} />
              <span style={{ color: customer.is_completed ? '#4a6b52' : '#9a8f84', fontSize: '0.72rem', letterSpacing: '0.08em' }}>
                {customer.is_completed ? '已完成' : '進行中'}
              </span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#4a6b52', fontSize: '1.1rem', fontWeight: 500 }}>
              $ {totalDue.toLocaleString()}
            </div>
            <div style={{ color: '#9a8f84', fontSize: '0.72rem', marginTop: '3px' }}>
              {METHOD_LABEL[customer.payment_method]}
            </div>
          </div>
        </div>

        <div style={{ marginTop: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.78rem', color: '#9a8f84' }}>
          <span>已繳 {paidCount}/{customer.total_periods} 期</span>
          <span style={{ textAlign: 'right' }}>已付 $ {totalPaid.toLocaleString()}</span>
        </div>

        {/* Progress */}
        <div style={{ background: '#e8e0d8', borderRadius: '99px', height: '2px', marginTop: '12px' }}>
          <div style={{ background: '#9a8f84', height: '2px', borderRadius: '99px', width: `${(paidCount / customer.total_periods) * 100}%`, transition: 'width 0.3s' }} />
        </div>

        {customer.notes && (
          <p style={{ marginTop: '12px', color: '#9a8f84', fontSize: '0.78rem', fontStyle: 'italic' }}>
            {customer.notes}
          </p>
        )}
      </div>

      {/* Installments */}
      <div className="space-y-3">
        <p style={{ color: '#9a8f84', fontSize: '0.7rem', letterSpacing: '0.12em' }} className="uppercase">
          分期明細
        </p>
        {customer.installments.map(inst => {
          const isPaid = !!inst.paid_at
          const isPaying = payingId === inst.id
          const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
          const isOverdue = !isPaid && inst.due_date < today

          return (
            <div key={inst.id} style={{
              background: '#faf8f5',
              border: `1px solid ${isPaid ? '#b8d4be' : isOverdue ? '#d4b896' : '#e0d9d0'}`,
              borderRadius: '6px', padding: '16px',
            }}>
              <div className="flex items-center justify-between">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: isPaid ? '#4a6b52' : isOverdue ? '#9a6a4a' : '#2c2825', fontSize: '0.9rem', fontWeight: 500 }}>
                      第 {inst.period_number} 期
                    </span>
                    {isOverdue && (
                      <span style={{ background: '#f5ede3', color: '#9a6a4a', fontSize: '0.65rem', padding: '1px 6px', borderRadius: '3px', letterSpacing: '0.05em' }}>
                        逾期
                      </span>
                    )}
                  </div>
                  <div style={{ color: '#9a8f84', fontSize: '0.75rem', marginTop: '3px' }}>
                    {isPaid ? `已繳　${formatDate(inst.paid_at!)}` : `應繳　${formatDate(inst.due_date)}`}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ color: isPaid ? '#4a6b52' : '#2c2825', fontSize: '1rem', fontWeight: 500 }}>
                    $ {inst.amount.toLocaleString()}
                  </span>
                  {isPaid ? (
                    <button onClick={() => handleUndoPay(inst.id)} disabled={isPaying}
                      style={{ color: '#c4b8aa', fontSize: '0.72rem', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '2px' }}>
                      取消
                    </button>
                  ) : (
                    <button onClick={() => handlePay(inst.id)} disabled={isPaying}
                      style={{ background: '#6b5f54', color: '#faf8f5', padding: '6px 14px', borderRadius: '4px', fontSize: '0.78rem', border: 'none', cursor: isPaying ? 'not-allowed' : 'pointer', opacity: isPaying ? 0.6 : 1, letterSpacing: '0.04em' }}>
                      {isPaying ? '…' : '已繳'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '10px', paddingBottom: '16px' }}>
        <Link href={`/customers/${id}/edit`}
          style={{ flex: 1, textAlign: 'center', border: '1px solid #e0d9d0', color: '#6b5f54', padding: '10px', borderRadius: '4px', fontSize: '0.82rem', letterSpacing: '0.04em' }}
          className="hover:opacity-70 transition-opacity">
          編輯
        </Link>
        <button onClick={handleDelete}
          style={{ flex: 1, border: '1px solid #d4b0a0', color: '#9a6a4a', padding: '10px', borderRadius: '4px', fontSize: '0.82rem', background: 'none', cursor: 'pointer', letterSpacing: '0.04em' }}
          className="hover:opacity-70 transition-opacity">
          刪除
        </button>
      </div>
    </div>
  )
}
