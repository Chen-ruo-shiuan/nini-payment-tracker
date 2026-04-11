'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import MembershipBadge from '@/components/MembershipBadge'
import {
  Client, MembershipLevel, InstallmentContract, Installment,
  Package, SvLedgerEntry, TEA_QUOTA, LEVEL_POINTS, YODOMO_MILESTONES
} from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContractWithInstallments extends InstallmentContract {
  installments: Installment[]
}

interface ClientDetail extends Client {
  stored_value: number
  active_contracts: number
  next_due_date: string | null
  active_packages: number
  contracts: ContractWithInstallments[]
  packages: Package[]
  sv_ledger: SvLedgerEntry[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })

const fmtShort = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })

const fmtAmt = (n: number) => `$ ${n.toLocaleString()}`

function today() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{
        color: active ? '#2c2825' : '#9a8f84',
        borderBottom: active ? '2px solid #6b5f54' : '2px solid transparent',
        background: 'none', border: 'none',
        fontSize: '0.82rem', letterSpacing: '0.06em',
        padding: '6px 10px', cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}>
      {label}
    </button>
  )
}

function InstallmentRow({ inst, onPay, onUnpay }: {
  inst: Installment
  onPay: (id: number) => void
  onUnpay: (id: number) => void
}) {
  const [loading, setLoading] = useState(false)
  const isPaid = !!inst.paid_at
  const isOverdue = !isPaid && inst.due_date < today()

  async function toggle() {
    setLoading(true)
    if (isPaid) {
      await fetch(`/api/installments/${inst.id}/pay`, { method: 'DELETE' })
      onUnpay(inst.id)
    } else {
      await fetch(`/api/installments/${inst.id}/pay`, { method: 'POST' })
      onPay(inst.id)
    }
    setLoading(false)
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 0', borderBottom: '1px solid #f0ebe4',
    }}>
      <div>
        <span style={{ color: '#9a8f84', fontSize: '0.75rem', marginRight: '8px' }}>第 {inst.period_number} 期</span>
        <span style={{
          color: isPaid ? '#9a8f84' : isOverdue ? '#9a4a4a' : '#2c2825',
          fontSize: '0.85rem',
          textDecoration: isPaid ? 'line-through' : 'none',
        }}>
          {fmtShort(inst.due_date)}
        </span>
        {inst.paid_at && (
          <span style={{ color: '#9a8f84', fontSize: '0.72rem', marginLeft: '6px' }}>
            （{fmtShort(inst.paid_at.slice(0, 10))} 繳）
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ color: isPaid ? '#9a8f84' : '#2c2825', fontSize: '0.9rem' }}>
          {fmtAmt(inst.amount)}
        </span>
        <button onClick={toggle} disabled={loading}
          style={{
            background: isPaid ? '#f0ebe4' : '#2c2825',
            color: isPaid ? '#9a8f84' : '#f7f4ef',
            border: 'none', borderRadius: '4px',
            fontSize: '0.72rem', padding: '4px 10px',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}>
          {isPaid ? '取消' : '繳納'}
        </button>
      </div>
    </div>
  )
}

function ContractCard({ contract, onChange }: {
  contract: ContractWithInstallments
  onChange: () => void
}) {
  const [open, setOpen] = useState(false)
  const [insts, setInsts] = useState(contract.installments)

  const paidCount = insts.filter(i => i.paid_at).length
  const totalCount = insts.length
  const remaining = insts.filter(i => !i.paid_at).reduce((s, i) => s + i.amount, 0)

  function handlePay(id: number) {
    setInsts(prev => prev.map(i => i.id === id ? { ...i, paid_at: new Date().toISOString() } : i))
    onChange()
  }
  function handleUnpay(id: number) {
    setInsts(prev => prev.map(i => i.id === id ? { ...i, paid_at: null } : i))
    onChange()
  }

  async function deleteContract() {
    if (!confirm('確定要刪除此分期合約？')) return
    await fetch(`/api/contracts/${contract.id}`, { method: 'DELETE' })
    onChange()
  }

  return (
    <div style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '6px', marginBottom: '10px' }}>
      <div className="p-3 cursor-pointer flex items-center justify-between" onClick={() => setOpen(o => !o)}>
        <div>
          <div style={{ color: '#2c2825', fontSize: '0.9rem' }}>
            {contract.payment_method}　{fmtAmt(contract.total_amount)}
          </div>
          <div style={{ color: '#9a8f84', fontSize: '0.75rem', marginTop: '2px' }}>
            {paidCount}/{totalCount} 期已繳
            {remaining > 0 && `　剩餘 ${fmtAmt(remaining)}`}
            {contract.is_completed ? '　✓ 完成' : ''}
          </div>
        </div>
        <div style={{ color: '#9a8f84', fontSize: '0.9rem' }}>{open ? '▲' : '▼'}</div>
      </div>

      {open && (
        <div style={{ borderTop: '1px solid #e0d9d0', padding: '0 12px 12px' }}>
          {insts.map(inst => (
            <InstallmentRow key={inst.id} inst={inst} onPay={handlePay} onUnpay={handleUnpay} />
          ))}
          {contract.note && (
            <p style={{ color: '#9a8f84', fontSize: '0.78rem', marginTop: '8px' }}>{contract.note}</p>
          )}
          <button onClick={deleteContract}
            style={{ color: '#9a8f84', fontSize: '0.72rem', marginTop: '8px', background: 'none', border: 'none', cursor: 'pointer' }}>
            刪除合約
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Benefits Tab ─────────────────────────────────────────────────────────────

function BenefitsTab({ client }: { client: ClientDetail }) {
  const level = client.level as MembershipLevel
  const teaQuota = TEA_QUOTA[level]
  const pointRate = LEVEL_POINTS[level]
  const teaUsage: Record<string, number> = JSON.parse(client.tea_usage || '{}')
  const thisMonth = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' }).slice(0, 7)
  const teaThisMonth = teaUsage[thisMonth] || 0
  const yedomoRedeemed: number[] = JSON.parse(client.yodomo_redeemed || '[]')

  // Membership duration
  const since = client.level_since
  let duration = ''
  if (since) {
    const start = new Date(since)
    const now = new Date()
    const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
    const years = Math.floor(months / 12)
    const rem = months % 12
    duration = years > 0 ? `${years} 年 ${rem} 個月` : `${rem} 個月`
  }

  const cardPoints = client.yodomo_card_points
  const nextMilestone = YODOMO_MILESTONES.find(m => m > (yedomoRedeemed.length * 2 > 0 ? Math.max(...yedomoRedeemed) : 0) && cardPoints < m)

  return (
    <div className="space-y-5">
      {/* 會員期間 */}
      <Section label="會員期間">
        <div style={{ color: '#2c2825', fontSize: '0.9rem' }}>
          {since ? `${fmtDate(since)} 入會` : '未設定升等日期'}
          {duration && <span style={{ color: '#9a8f84', marginLeft: '10px', fontSize: '0.82rem' }}>（{duration}）</span>}
        </div>
      </Section>

      {/* 金米 */}
      <Section label={`金米　（${pointRate} 點 / 千元）`}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span style={{ color: '#2c2825', fontSize: '1.5rem', fontWeight: 500 }}>{client.points}</span>
          <span style={{ color: '#9a8f84', fontSize: '0.82rem' }}>點</span>
        </div>
      </Section>

      {/* 下午茶 */}
      <Section label={`下午茶　（每月 ${teaQuota} 次）`}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {Array.from({ length: teaQuota }).map((_, i) => (
            <div key={i} style={{
              width: '36px', height: '36px', borderRadius: '50%',
              background: i < teaThisMonth ? '#d4b896' : '#f0ebe4',
              border: `1px solid ${i < teaThisMonth ? '#c4a882' : '#e0d9d0'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1rem',
            }}>
              {i < teaThisMonth ? '☕' : '○'}
            </div>
          ))}
        </div>
        <p style={{ color: '#9a8f84', fontSize: '0.75rem', marginTop: '4px' }}>
          本月已使用 {teaThisMonth}/{teaQuota} 次
        </p>
      </Section>

      {/* 癒多多 */}
      <Section label="癒多多　（集點卡）">
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {YODOMO_MILESTONES.map(m => {
            const redeemed = yedomoRedeemed.includes(m)
            const reached = cardPoints >= m
            return (
              <div key={m} style={{
                padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem',
                background: redeemed ? '#9ab89e' : reached ? '#d4b896' : '#f0ebe4',
                color: redeemed ? '#fff' : reached ? '#6b4a2a' : '#9a8f84',
                border: `1px solid ${redeemed ? '#9ab89e' : reached ? '#c4a882' : '#e0d9d0'}`,
              }}>
                {m} 次 {redeemed ? '✓ 已兌換' : reached ? '可兌換' : ''}
              </div>
            )
          })}
        </div>
        <div style={{ color: '#9a8f84', fontSize: '0.75rem', marginTop: '6px' }}>
          累積 {cardPoints} 次（第 {client.yodomo_total_cards} 張卡）
          {nextMilestone && `　下個里程碑：${nextMilestone} 次`}
        </div>
      </Section>
    </div>
  )
}

// ─── Stored Value Tab ─────────────────────────────────────────────────────────

function StoredValueTab({ client, refresh }: { client: ClientDetail; refresh: () => void }) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(today())
  const [saving, setSaving] = useState(false)

  async function addEntry(e: React.FormEvent) {
    e.preventDefault()
    if (!amount) return
    setSaving(true)
    await fetch('/api/sv-ledger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: client.id, amount: Number(amount), note, date }),
    })
    setAmount('')
    setNote('')
    setSaving(false)
    refresh()
  }

  return (
    <div className="space-y-4">
      <div style={{
        background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '6px',
        padding: '16px', textAlign: 'center',
      }}>
        <div style={{ color: '#9a8f84', fontSize: '0.78rem', letterSpacing: '0.08em' }}>儲值餘額</div>
        <div style={{ color: '#2c2825', fontSize: '1.8rem', fontWeight: 500, marginTop: '4px' }}>
          {fmtAmt(client.stored_value)}
        </div>
      </div>

      <form onSubmit={addEntry} style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '6px', padding: '14px' }}
        className="space-y-3">
        <p style={{ color: '#6b5f54', fontSize: '0.78rem', letterSpacing: '0.06em' }}>新增儲值 / 扣款</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <input value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="金額（負數為扣款）" type="number" {...inputProps} />
          <input value={date} onChange={e => setDate(e.target.value)} type="date" {...inputProps} />
        </div>
        <input value={note} onChange={e => setNote(e.target.value)}
          placeholder="備註（選填）" {...inputProps} />
        <button type="submit" disabled={saving || !amount}
          style={{
            background: saving || !amount ? '#c4b8aa' : '#2c2825',
            color: '#f7f4ef', border: 'none', borderRadius: '5px',
            fontSize: '0.85rem', padding: '8px 20px', cursor: 'pointer',
          }}>
          {saving ? '儲存中…' : '新增'}
        </button>
      </form>

      <div className="space-y-1">
        {client.sv_ledger.length === 0 && (
          <p style={{ color: '#c4b8aa', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>
            尚無儲值記錄
          </p>
        )}
        {client.sv_ledger.map(e => (
          <div key={e.id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 0', borderBottom: '1px solid #f0ebe4',
          }}>
            <div>
              <span style={{ color: '#9a8f84', fontSize: '0.75rem' }}>{fmtShort(e.date)}</span>
              {e.note && <span style={{ color: '#6b5f54', fontSize: '0.8rem', marginLeft: '8px' }}>{e.note}</span>}
            </div>
            <span style={{ color: e.amount >= 0 ? '#4a6b52' : '#9a4a4a', fontSize: '0.9rem', fontWeight: 500 }}>
              {e.amount >= 0 ? '+' : ''}{fmtAmt(e.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Packages Tab ─────────────────────────────────────────────────────────────

function PackagesTab({ client }: { client: ClientDetail }) {
  return (
    <div className="space-y-2">
      {client.packages.length === 0 && (
        <p style={{ color: '#c4b8aa', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>
          尚無套組
        </p>
      )}
      {client.packages.map(pkg => {
        const remaining = pkg.total_sessions - pkg.used_sessions
        return (
          <div key={pkg.id} style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '6px', padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ color: '#2c2825', fontSize: '0.9rem' }}>{pkg.service_name}</div>
                <div style={{ color: '#9a8f84', fontSize: '0.75rem', marginTop: '2px' }}>
                  {fmtShort(pkg.date)}　{pkg.payment_method}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: remaining > 0 ? '#2c2825' : '#9a8f84', fontSize: '0.9rem' }}>
                  剩 {remaining} / {pkg.total_sessions} 次
                </div>
                <div style={{ color: '#9a8f84', fontSize: '0.75rem' }}>
                  {fmtAmt(pkg.prepaid_amount)}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = '分期' | '福利' | '套組' | '儲值'

const TABS: Tab[] = ['分期', '福利', '套組', '儲值']

export default function ClientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [client, setClient] = useState<ClientDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('分期')

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${id}`)
      if (!res.ok) { router.push('/clients'); return }
      const data = await res.json()
      setClient(data)
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => { load() }, [load])

  async function deleteClient() {
    if (!confirm(`確定要刪除「${client?.name}」？此操作無法復原。`)) return
    await fetch(`/api/clients/${id}`, { method: 'DELETE' })
    router.push('/clients')
  }

  if (loading) {
    return <div style={{ color: '#c4b8aa', textAlign: 'center', padding: '60px 0' }}>載入中…</div>
  }
  if (!client) return null

  const level = client.level as MembershipLevel

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="pt-2">
        <div className="flex items-start justify-between">
          <div>
            <Link href="/clients" style={{ color: '#9a8f84', fontSize: '0.82rem' }}>← 客人</Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
              <h1 style={{ color: '#2c2825', fontSize: '1.4rem', fontWeight: 500 }}>{client.name}</h1>
              <MembershipBadge tier={level} />
            </div>
            {client.phone && (
              <div style={{ color: '#9a8f84', fontSize: '0.82rem', marginTop: '2px' }}>{client.phone}</div>
            )}
            {client.note && (
              <div style={{ color: '#6b5f54', fontSize: '0.8rem', marginTop: '4px' }}>{client.note}</div>
            )}
          </div>
          <Link href={`/clients/${id}/edit`}
            style={{ color: '#9a8f84', fontSize: '0.8rem', marginTop: '28px' }}>
            編輯
          </Link>
        </div>

        {/* Quick stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '14px' }}>
          {[
            { label: '金米', value: `${client.points} 點` },
            { label: '儲值', value: fmtAmt(client.stored_value) },
            { label: '分期中', value: `${client.active_contracts} 件` },
            { label: '套組', value: `${client.active_packages} 件` },
          ].map(({ label, value }) => (
            <div key={label} style={{
              background: '#faf8f5', border: '1px solid #e0d9d0',
              borderRadius: '5px', padding: '8px', textAlign: 'center',
            }}>
              <div style={{ color: '#9a8f84', fontSize: '0.65rem', letterSpacing: '0.05em' }}>{label}</div>
              <div style={{ color: '#2c2825', fontSize: '0.82rem', marginTop: '2px' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e0d9d0', overflowX: 'auto' }}>
        {TABS.map(t => <TabBtn key={t} label={t} active={tab === t} onClick={() => setTab(t)} />)}
      </div>

      {/* Tab content */}
      {tab === '分期' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: '#9a8f84', fontSize: '0.78rem', letterSpacing: '0.06em' }}>
              分期合約 {client.contracts.length} 件
            </span>
            <Link href={`/installments/new?client_id=${id}`}
              style={{ color: '#2c2825', fontSize: '0.78rem', background: '#f0ebe4', border: '1px solid #d9d0c5', borderRadius: '4px' }}
              className="px-3 py-1.5">
              ＋ 新增合約
            </Link>
          </div>
          {client.contracts.length === 0 ? (
            <p style={{ color: '#c4b8aa', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>
              尚無分期合約
            </p>
          ) : (
            client.contracts.map(c => (
              <ContractCard key={c.id} contract={c} onChange={load} />
            ))
          )}
        </div>
      )}

      {tab === '福利' && <BenefitsTab client={client} />}
      {tab === '套組' && <PackagesTab client={client} />}
      {tab === '儲值' && <StoredValueTab client={client} refresh={load} />}

      {/* Delete */}
      <div style={{ borderTop: '1px solid #f0ebe4', paddingTop: '16px', marginTop: '8px' }}>
        <button onClick={deleteClient}
          style={{ color: '#9a8f84', fontSize: '0.75rem', background: 'none', border: 'none', cursor: 'pointer' }}>
          刪除此客人
        </button>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#faf8f5', border: '1px solid #e0d9d0',
  borderRadius: '6px', color: '#2c2825', fontSize: '0.88rem',
  outline: 'none', padding: '9px 12px',
}
const inputProps = { style: inputStyle }

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ color: '#9a8f84', fontSize: '0.72rem', letterSpacing: '0.1em', marginBottom: '8px' }}>{label}</p>
      {children}
    </div>
  )
}
