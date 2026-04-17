'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import MembershipBadge from '@/components/MembershipBadge'
import {
  Client, MembershipLevel, InstallmentContract, Installment,
  Package, SvLedgerEntry, TEA_QUOTA, LEVEL_POINTS, YODOMO_MILESTONES,
  BIRTHDAY_GIFT, HARVEST_GIFT, NEXT_LEVEL, LEVEL_THRESHOLDS,
} from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────
interface ContractWithInstallments extends InstallmentContract {
  installments: Installment[]
}
interface CheckoutItem {
  id: number; checkout_id: number; category: string; label: string; price: number; qty: number; pkg_id?: number
}
interface CheckoutPayment {
  id: number; checkout_id: number; method: string; amount: number
}
interface Checkout {
  id: number; client_id: number | null; date: string; note: string | null
  total_amount: number; incl_course: number; created_at: string
  items: CheckoutItem[]; payments: CheckoutPayment[]
}
interface ClientDetail extends Client {
  stored_value: number
  active_contracts: number
  next_due_date: string | null
  active_packages: number
  contracts: ContractWithInstallments[]
  packages: Package[]
  sv_ledger: SvLedgerEntry[]
  checkouts: Checkout[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })
const fmtShort = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })
const fmtAmt = (n: number) => `$ ${n.toLocaleString()}`
function todayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
}
function thisMonth() {
  return todayStr().slice(0, 7)
}

// ─── Level colors ─────────────────────────────────────────────────────────────
const LEVEL_COLOR: Record<string, { bg: string; color: string; border: string }> = {
  '癒米':   { bg: '#f0ede8', color: '#706c68', border: '#c8c4be' },
  '甜癒米': { bg: '#fce8f0', color: '#9a3060', border: '#e8a0c0' },
  '療癒米': { bg: '#e8f0fc', color: '#2d4f9a', border: '#9ab0e8' },
  '悟癒米': { bg: '#fdf5e0', color: '#7a5a00', border: '#e0c055' },
}

// ─── Tab Button ───────────────────────────────────────────────────────────────
function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      color: active ? '#2c2825' : '#9a8f84',
      borderBottom: active ? '2px solid #6b5f54' : '2px solid transparent',
      background: 'none', border: 'none',
      fontSize: '0.82rem', letterSpacing: '0.06em',
      padding: '6px 10px', cursor: 'pointer', whiteSpace: 'nowrap',
    }}>{label}</button>
  )
}

// ─── Installment Row ──────────────────────────────────────────────────────────
function InstallmentRow({ inst, onPay, onUnpay }: {
  inst: Installment; onPay: (id: number, paidAt: string) => void; onUnpay: (id: number) => void
}) {
  const [loading, setLoading] = useState(false)
  const [payDate, setPayDate] = useState(todayStr)
  const isPaid = !!inst.paid_at
  const isOverdue = !isPaid && inst.due_date < todayStr()

  async function toggle() {
    setLoading(true)
    if (isPaid) {
      await fetch(`/api/installments/${inst.id}/pay`, { method: 'DELETE' })
      onUnpay(inst.id)
    } else {
      await fetch(`/api/installments/${inst.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paid_at: payDate }),
      })
      onPay(inst.id, payDate)
    }
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0ebe4' }}>
      <div>
        <span style={{ color: '#9a8f84', fontSize: '0.75rem', marginRight: '8px' }}>第 {inst.period_number} 期</span>
        <span style={{ color: isPaid ? '#9a8f84' : isOverdue ? '#9a4a4a' : '#2c2825', fontSize: '0.85rem', textDecoration: isPaid ? 'line-through' : 'none' }}>
          {fmtShort(inst.due_date)}
        </span>
        {inst.paid_at && (
          <span style={{ color: '#9a8f84', fontSize: '0.72rem', marginLeft: '6px' }}>
            （{fmtShort(inst.paid_at.slice(0, 10))} 繳）
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: isPaid ? '#9a8f84' : '#2c2825', fontSize: '0.9rem' }}>{fmtAmt(inst.amount)}</span>
        {!isPaid && (
          <input
            type="date"
            value={payDate}
            onChange={e => setPayDate(e.target.value)}
            style={{ border: '1px solid #ddd8d0', borderRadius: '4px', fontSize: '0.72rem', padding: '3px 6px', color: '#4a4642', background: '#faf8f5' }}
          />
        )}
        <button onClick={toggle} disabled={loading} style={{
          background: isPaid ? '#f0ebe4' : '#2c2825', color: isPaid ? '#9a8f84' : '#f7f4ef',
          border: 'none', borderRadius: '4px', fontSize: '0.72rem', padding: '4px 10px',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}>{isPaid ? '取消' : '繳納'}</button>
      </div>
    </div>
  )
}

function ContractCard({ contract, onChange }: {
  contract: ContractWithInstallments; onChange: () => void
}) {
  const [open, setOpen] = useState(false)
  const [insts, setInsts] = useState(contract.installments)
  const paidCount = insts.filter(i => i.paid_at).length
  const remaining = insts.filter(i => !i.paid_at).reduce((s, i) => s + i.amount, 0)

  function handlePay(id: number, paidAt: string) {
    setInsts(prev => prev.map(i => i.id === id ? { ...i, paid_at: paidAt } : i))
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
          <div style={{ color: '#2c2825', fontSize: '0.9rem' }}>{contract.payment_method}　{fmtAmt(contract.total_amount)}</div>
          <div style={{ color: '#9a8f84', fontSize: '0.75rem', marginTop: '2px' }}>
            {paidCount}/{insts.length} 期已繳{remaining > 0 && `　剩餘 ${fmtAmt(remaining)}`}{contract.is_completed ? '　✓ 完成' : ''}
          </div>
        </div>
        <div style={{ color: '#9a8f84' }}>{open ? '▲' : '▼'}</div>
      </div>
      {open && (
        <div style={{ borderTop: '1px solid #e0d9d0', padding: '0 12px 12px' }}>
          {insts.map(inst => <InstallmentRow key={inst.id} inst={inst} onPay={handlePay} onUnpay={handleUnpay} />)}
          {contract.note && <p style={{ color: '#9a8f84', fontSize: '0.78rem', marginTop: '8px' }}>{contract.note}</p>}
          <button onClick={deleteContract} style={{ color: '#9a8f84', fontSize: '0.72rem', marginTop: '8px', background: 'none', border: 'none', cursor: 'pointer' }}>刪除合約</button>
        </div>
      )}
    </div>
  )
}

// ─── Benefits Tab (interactive) ───────────────────────────────────────────────
function BenefitsTab({ client, refresh }: { client: ClientDetail; refresh: () => void }) {
  const id = client.id
  const level = (client.level || '癒米') as MembershipLevel
  const lc = LEVEL_COLOR[level] ?? LEVEL_COLOR['癒米']
  const isPendingUpgrade = !!(client.level_since && client.level_since > todayStr())
  const effectiveLevel: MembershipLevel = isPendingUpgrade ? '癒米' : level
  const teaQuota = TEA_QUOTA[effectiveLevel]
  const pointRate = LEVEL_POINTS[effectiveLevel]

  // tea_usage: {"YYYY-MM": ["YYYY-MM-DD", ...]}
  const teaUsage: Record<string, string[]> = (() => {
    try {
      const raw = JSON.parse(client.tea_usage || '{}')
      // Support both old (count) and new (array) format
      const result: Record<string, string[]> = {}
      for (const [k, v] of Object.entries(raw)) {
        result[k] = Array.isArray(v) ? v : []
      }
      return result
    } catch { return {} }
  })()
  const month = thisMonth()
  const teaDates = teaUsage[month] ?? []
  const [teaLoading, setTeaLoading] = useState<number | null>(null)

  // membership duration
  const since = client.level_since
  let duration = ''
  if (since && !isPendingUpgrade) {
    const start = new Date(since)
    const now = new Date()
    const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
    const y = Math.floor(months / 12); const m = months % 12
    duration = y > 0 ? `${y} 年 ${m} 個月` : `${m} 個月`
  }

  // 生日福利
  const bdayPerks: Record<string, Record<string, string>> = (() => {
    try { return JSON.parse(client.birthday_perks || '{}') } catch { return {} }
  })()
  const thisYear = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' }).slice(0, 4)
  const thisYearPerks = bdayPerks[thisYear] ?? {}
  const [bdLoading, setBdLoading] = useState<string | null>(null)

  async function recordBdPerk(action: string, undo = false) {
    setBdLoading(action)
    const date = undo ? undefined : (prompt('請輸入日期（YYYY-MM-DD）', todayStr()) || todayStr())
    if (!undo && !date) { setBdLoading(null); return }
    await fetch(`/api/clients/${id}/birthday-perk`, {
      method: undo ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, date, year: thisYear }),
    })
    setBdLoading(null)
    refresh()
  }

  async function recordHarvest(undo = false) {
    setBdLoading('harvest')
    const date = undo ? undefined : (prompt('請輸入日期（YYYY-MM-DD）', todayStr()) || todayStr())
    if (!undo && !date) { setBdLoading(null); return }
    await fetch(`/api/clients/${id}/birthday-perk`, {
      method: undo ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'harvest', date }),
    })
    setBdLoading(null)
    refresh()
  }

  // yodomo
  const cardPoints = client.yodomo_card_points
  const yodomoRedeemed: number[] = (() => {
    try { return JSON.parse(client.yodomo_redeemed || '[]') } catch { return [] }
  })()
  const [yodomoLoading, setYodomoLoading] = useState(false)

  // points adjust
  const [ptDelta, setPtDelta] = useState('')
  const [ptNote, setPtNote] = useState('')
  const [ptLoading, setPtLoading] = useState(false)
  const [showPtForm, setShowPtForm] = useState(false)

  // yodomo adjust
  const [ydDelta, setYdDelta] = useState('')
  const [ydNote, setYdNote] = useState('')
  const [showYdForm, setShowYdForm] = useState(false)

  async function recordTea(slotIndex: number) {
    setTeaLoading(slotIndex)
    const date = prompt('請輸入日期（YYYY-MM-DD）', todayStr())
    if (!date) { setTeaLoading(null); return }
    await fetch(`/api/clients/${id}/tea`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date }),
    })
    setTeaLoading(null)
    refresh()
  }

  async function cancelTea(date: string) {
    if (!confirm(`確定取消 ${fmtShort(date)} 的下午茶記錄？`)) return
    await fetch(`/api/clients/${id}/tea`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date }),
    })
    refresh()
  }

  async function adjustPoints(e: React.FormEvent) {
    e.preventDefault()
    if (!ptDelta) return
    setPtLoading(true)
    await fetch(`/api/clients/${id}/points`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delta: Number(ptDelta), note: ptNote }),
    })
    setPtDelta(''); setPtNote(''); setShowPtForm(false); setPtLoading(false)
    refresh()
  }

  async function adjustYodomo(e: React.FormEvent) {
    e.preventDefault()
    if (!ydDelta) return
    setYodomoLoading(true)
    await fetch(`/api/clients/${id}/yodomo`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delta: Number(ydDelta), note: ydNote }),
    })
    setYdDelta(''); setYdNote(''); setShowYdForm(false); setYodomoLoading(false)
    refresh()
  }

  async function redeemYodomo(milestone: number) {
    if (!confirm(`確定兌換癒多多 ${milestone} 次里程碑？`)) return
    setYodomoLoading(true)
    const res = await fetch(`/api/clients/${id}/yodomo`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ redeem: milestone }),
    })
    const data = await res.json()
    if (!res.ok) alert(data.error)
    setYodomoLoading(false)
    refresh()
  }

  return (
    <div className="space-y-5">

      {/* ── 會員期間 ── */}
      <BenefitSection label="會員期間">
        <div style={{ color: '#2c2825', fontSize: '0.9rem' }}>
          {since ? `${fmtDate(since)} 起` : '未設定升等日期'}
          {duration && <span style={{ color: '#9a8f84', marginLeft: '10px', fontSize: '0.82rem' }}>（{duration}）</span>}
        </div>
      </BenefitSection>

      {/* ── 金米 ── */}
      <BenefitSection label={`金米　千元 ${pointRate} 點`} color="#7a5a00" bg="#fdf5e0" border="#d4a830">
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ color: '#7a5a00', fontSize: '1.6rem', fontWeight: 600 }}>{client.points}</span>
            <span style={{ color: '#9a8f84', fontSize: '0.82rem' }}>點</span>
          </div>
          <button onClick={() => setShowPtForm(v => !v)} style={{
            background: 'none', border: '1px solid #e0c055', color: '#7a5a00',
            borderRadius: '4px', fontSize: '0.72rem', padding: '3px 10px', cursor: 'pointer',
          }}>調整</button>
        </div>
        {showPtForm && (
          <form onSubmit={adjustPoints} style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <input value={ptDelta} onChange={e => setPtDelta(e.target.value)}
              placeholder="增減點數（負數為扣除）" type="number" style={{ ...miniInput, flex: '1', minWidth: '140px' }} />
            <input value={ptNote} onChange={e => setPtNote(e.target.value)}
              placeholder="備註（選填）" style={{ ...miniInput, flex: '1', minWidth: '100px' }} />
            <button type="submit" disabled={ptLoading} style={miniBtn}>確認</button>
          </form>
        )}
      </BenefitSection>

      {/* ── 迎賓下午茶 ── */}
      <BenefitSection label={`迎賓下午茶　本月 ${teaQuota} 次`} color="#1a6b5a" bg="#e6f5f0" border="#5ab89e">
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
          {Array.from({ length: teaQuota }).map((_, i) => {
            const date = teaDates[i]
            return date ? (
              // Used slot
              <div key={i} style={{
                background: '#e6f5f0', border: '1px solid #5ab89e',
                borderRadius: '8px', padding: '6px 10px', fontSize: '0.75rem',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                <span style={{ color: '#1a6b5a' }}>☕ {fmtShort(date)}</span>
                <button onClick={() => cancelTea(date)} style={{
                  background: 'none', border: 'none', color: '#c4b8aa',
                  cursor: 'pointer', fontSize: '0.8rem', lineHeight: 1, padding: '0 2px',
                }}>✕</button>
              </div>
            ) : (
              // Empty slot
              <button key={i} onClick={() => recordTea(i)}
                disabled={teaLoading === i}
                style={{
                  background: '#faf8f5', border: '1px dashed #d9d0c5',
                  borderRadius: '8px', padding: '6px 12px', fontSize: '0.75rem',
                  color: '#9a8f84', cursor: 'pointer',
                }}>
                第 {i + 1} 次　＋記錄
              </button>
            )
          })}
        </div>
        <p style={{ color: '#9a8f84', fontSize: '0.72rem' }}>
          本月已使用 {teaDates.length}/{teaQuota} 次
          　{new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' })}
        </p>
      </BenefitSection>

      {/* ── 癒多多集點 ── */}
      <BenefitSection label="癒多多集點卡" color="#7a3d8a" bg="#f5eaf8" border="#d4a8e0">
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ color: '#7a3d8a', fontSize: '1.6rem', fontWeight: 600 }}>{cardPoints}</span>
            <span style={{ color: '#9a8f84', fontSize: '0.82rem' }}>點</span>
            <span style={{ color: '#b4aa9e', fontSize: '0.75rem' }}>（第 {client.yodomo_total_cards + 1} 輪）</span>
          </div>
          <button onClick={() => setShowYdForm(v => !v)} style={{
            background: 'none', border: '1px solid #d4a8e0', color: '#7a3d8a',
            borderRadius: '4px', fontSize: '0.72rem', padding: '3px 10px', cursor: 'pointer',
          }}>調整</button>
        </div>

        {showYdForm && (
          <form onSubmit={adjustYodomo} style={{ marginBottom: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <input value={ydDelta} onChange={e => setYdDelta(e.target.value)}
              placeholder="增減點數（負數為扣除）" type="number" style={{ ...miniInput, flex: '1', minWidth: '140px' }} />
            <input value={ydNote} onChange={e => setYdNote(e.target.value)}
              placeholder="備註（選填）" style={{ ...miniInput, flex: '1', minWidth: '100px' }} />
            <button type="submit" disabled={yodomoLoading} style={miniBtn}>確認</button>
          </form>
        )}

        {/* Milestones */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {YODOMO_MILESTONES.map(m => {
            const redeemed = yodomoRedeemed.includes(m)
            const reachable = cardPoints >= m && !redeemed
            return (
              <div key={m} style={{
                borderRadius: '20px', fontSize: '0.78rem', padding: '5px 14px',
                background: redeemed ? '#c4a8d0' : reachable ? '#e8c8f0' : '#f0ebe4',
                color: redeemed ? '#fff' : reachable ? '#7a3d8a' : '#b4aa9e',
                border: `1px solid ${redeemed ? '#b898c8' : reachable ? '#d4a8e0' : '#e0d9d0'}`,
                display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                <span>{m} 點</span>
                {redeemed && <span>✓ 已兌換</span>}
                {reachable && (
                  <button onClick={() => redeemYodomo(m)} disabled={yodomoLoading} style={{
                    background: '#7a3d8a', color: '#fff', border: 'none',
                    borderRadius: '10px', fontSize: '0.68rem', padding: '2px 8px', cursor: 'pointer',
                  }}>兌換</button>
                )}
              </div>
            )
          })}
        </div>
      </BenefitSection>

      {/* ── 生日福利 ── */}
      {client.birthday && (
        <BenefitSection label={`🎂 生日福利　${client.birthday.replace('-', '月').replace(/(\d+)$/, '$1日')}`} color="#9a5060" bg="#fce8f0" border="#e8a0b8">
          {isPendingUpgrade && (
            <p style={{ color: '#b4aa9e', fontSize: '0.75rem', marginBottom: '8px' }}>⚠ 升等日期尚未到，福利依「癒米」等級計算</p>
          )}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {/* 公益捐款（甜癒米以上） */}
            {['甜癒米','療癒米','悟癒米'].includes(effectiveLevel) && (
              <PerkBtn
                label="公益捐款" done={!!thisYearPerks.donation} doneDate={thisYearPerks.donation}
                loading={bdLoading === 'donation'}
                onRecord={() => recordBdPerk('donation')}
                onUndo={() => recordBdPerk('donation', true)}
              />
            )}
            {/* 生日金 $100（甜癒米以上） */}
            {['甜癒米','療癒米','悟癒米'].includes(effectiveLevel) && (
              <PerkBtn
                label="生日金 $100" done={!!thisYearPerks.cash} doneDate={thisYearPerks.cash}
                loading={bdLoading === 'cash'}
                onRecord={() => recordBdPerk('cash')}
                onUndo={() => recordBdPerk('cash', true)}
              />
            )}
            {/* 生日禮（全等級） */}
            <PerkBtn
              label={`生日禮：${BIRTHDAY_GIFT[effectiveLevel]}`} done={!!thisYearPerks.gift} doneDate={thisYearPerks.gift}
              loading={bdLoading === 'gift'}
              onRecord={() => recordBdPerk('gift')}
              onUndo={() => recordBdPerk('gift', true)}
            />
          </div>
        </BenefitSection>
      )}

      {/* ── 慶祝收成 ── */}
      {HARVEST_GIFT[effectiveLevel] && (
        <BenefitSection label="🌾 慶祝收成" color="#6b7a4a" bg="#f0f5e8" border="#c0d098">
          <PerkBtn
            label={`收成禮：${HARVEST_GIFT[effectiveLevel]}`}
            done={!!client.harvest_given} doneDate={client.harvest_given ?? undefined}
            loading={bdLoading === 'harvest'}
            onRecord={() => recordHarvest()}
            onUndo={() => recordHarvest(true)}
          />
          <p style={{ color: '#9a8f84', fontSize: '0.72rem', marginTop: '6px' }}>於會員期滿時發放</p>
        </BenefitSection>
      )}
    </div>
  )
}

// ─── Perk Button ──────────────────────────────────────────────────────────────
function PerkBtn({ label, done, doneDate, loading, onRecord, onUndo }: {
  label: string; done: boolean; doneDate?: string;
  loading: boolean; onRecord: () => void; onUndo: () => void
}) {
  return (
    <div style={{
      borderRadius: '8px', border: `1px solid ${done ? '#9ab89e' : '#ddd8d0'}`,
      background: done ? '#edf3eb' : '#faf8f5',
      padding: '8px 12px', minWidth: '120px',
    }}>
      <div style={{ fontSize: '0.78rem', color: done ? '#4a6b52' : '#706c68', marginBottom: '4px' }}>
        {done ? '✓ ' : ''}{label}
      </div>
      {done && doneDate && (
        <div style={{ fontSize: '0.68rem', color: '#9a8f84', marginBottom: '4px' }}>{fmtShort(doneDate)}</div>
      )}
      <button
        onClick={done ? onUndo : onRecord}
        disabled={loading}
        style={{
          fontSize: '0.68rem', padding: '2px 8px', border: `1px solid ${done ? '#c4b8aa' : '#4a6b52'}`,
          borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer',
          background: done ? '#f0ede8' : '#2c2825', color: done ? '#9a8f84' : '#f7f4ef',
          fontFamily: 'inherit',
        }}
      >
        {loading ? '…' : done ? '取消' : '記錄'}
      </button>
    </div>
  )
}

// ─── Stored Value Tab ─────────────────────────────────────────────────────────
const SV_PAY_METHODS = ['現金', '匯款', 'LINE Pay', '信用卡', '其他'] as const

function StoredValueTab({ client, refresh }: { client: ClientDetail; refresh: () => void }) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(todayStr())
  const [payMethod, setPayMethod] = useState('現金')
  const [saving, setSaving] = useState(false)

  async function addEntry(e: React.FormEvent) {
    e.preventDefault()
    if (!amount) return
    setSaving(true)
    await fetch('/api/sv-ledger', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: client.id, amount: Number(amount), note, date, payment_method: Number(amount) > 0 ? payMethod : null }),
    })
    setAmount(''); setNote(''); setSaving(false)
    refresh()
  }

  return (
    <div className="space-y-4">
      <div style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '6px', padding: '16px', textAlign: 'center' }}>
        <div style={{ color: '#9a8f84', fontSize: '0.78rem', letterSpacing: '0.08em' }}>儲值餘額</div>
        <div style={{ color: '#2c2825', fontSize: '1.8rem', fontWeight: 500, marginTop: '4px' }}>{fmtAmt(client.stored_value)}</div>
      </div>
      <form onSubmit={addEntry} style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '6px', padding: '14px' }} className="space-y-3">
        <p style={{ color: '#6b5f54', fontSize: '0.78rem', letterSpacing: '0.06em' }}>新增儲值 / 扣款</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="金額（負數為扣款）" type="number" style={inputStyle} />
          <input value={date} onChange={e => setDate(e.target.value)} type="date" style={inputStyle} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <select value={payMethod} onChange={e => setPayMethod(e.target.value)} style={inputStyle}>
            {SV_PAY_METHODS.map(m => <option key={m}>{m}</option>)}
          </select>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="備註（選填）" style={inputStyle} />
        </div>
        <button type="submit" disabled={saving || !amount} style={{
          background: saving || !amount ? '#c4b8aa' : '#2c2825', color: '#f7f4ef',
          border: 'none', borderRadius: '5px', fontSize: '0.85rem', padding: '8px 20px', cursor: 'pointer',
        }}>{saving ? '儲存中…' : '新增'}</button>
      </form>
      <div className="space-y-1">
        {client.sv_ledger.length === 0 && (
          <p style={{ color: '#c4b8aa', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>尚無儲值記錄</p>
        )}
        {(client.sv_ledger as (SvLedgerEntry & { payment_method?: string })[]).map(e => (
          <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0ebe4' }}>
            <div>
              <span style={{ color: '#9a8f84', fontSize: '0.75rem' }}>{fmtShort(e.date)}</span>
              {e.payment_method && e.amount > 0 && (
                <span style={{ color: '#9a8f84', fontSize: '0.72rem', marginLeft: '6px', background: '#f0ebe4', borderRadius: '8px', padding: '1px 6px' }}>{e.payment_method}</span>
              )}
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
function PackagesTab({ client, refresh }: { client: ClientDetail; refresh: () => void }) {
  const [recalcing, setRecalcing] = useState<number | null>(null)

  async function recalc(pkgId: number) {
    setRecalcing(pkgId)
    await fetch(`/api/packages/${pkgId}/recalc`, { method: 'POST' })
    setRecalcing(null)
    refresh()
  }

  return (
    <div className="space-y-2">
      {client.packages.length === 0 && (
        <p style={{ color: '#c4b8aa', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>尚無套組</p>
      )}
      {client.packages.map(pkg => {
        const remaining = pkg.total_sessions - pkg.used_sessions
        const pct = pkg.total_sessions > 0 ? (pkg.used_sessions / pkg.total_sessions) * 100 : 0
        return (
          <div key={pkg.id} style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '6px', padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#2c2825', fontSize: '0.9rem' }}>{pkg.service_name}</div>
                <div style={{ color: '#9a8f84', fontSize: '0.75rem', marginTop: '2px' }}>
                  {fmtShort(pkg.date)}　{pkg.payment_method}
                </div>
                {/* Progress bar */}
                <div style={{ marginTop: '8px' }}>
                  <div style={{ background: '#f0ebe4', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                    <div style={{
                      background: remaining > 0 ? '#9ab89e' : '#c4b8aa',
                      width: `${pct}%`, height: '100%', borderRadius: '4px',
                      transition: 'width 0.3s',
                    }} />
                  </div>
                  <div style={{ color: '#9a8f84', fontSize: '0.72rem', marginTop: '3px' }}>
                    已用 {pkg.used_sessions} / {pkg.total_sessions} 次
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right', marginLeft: '12px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                <div style={{ color: remaining > 0 ? '#4a6b52' : '#9a8f84', fontSize: '0.9rem', fontWeight: 500 }}>
                  剩 {remaining} 次
                </div>
                <div style={{ color: '#9a8f84', fontSize: '0.75rem' }}>{fmtAmt(pkg.prepaid_amount)}</div>
                <button onClick={() => recalc(pkg.id)} disabled={recalcing === pkg.id}
                  style={{ color: '#9a8f84', fontSize: '0.65rem', background: 'none', border: '1px solid #e0d9d0', borderRadius: '4px', padding: '2px 7px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {recalcing === pkg.id ? '…' : '重新計算'}
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Consumption Tab ─────────────────────────────────────────────────────────
function ConsumptionTab({ client, refresh }: { client: ClientDetail; refresh: () => void }) {
  const [deleting, setDeleting] = useState<number | null>(null)

  async function deleteCheckout(co: Checkout) {
    if (!confirm(`確定刪除 ${fmtShort(co.date)} 的消費記錄（${fmtAmt(co.total_amount)}）？\n套組核銷堂數將一併還原。`)) return
    setDeleting(co.id)
    await fetch(`/api/checkouts/${co.id}`, { method: 'DELETE' })
    setDeleting(null)
    refresh()
  }

  const currentYear = new Date().getFullYear().toString()

  // Aggregate stats from checkout history
  const allItems = client.checkouts.flatMap(co => co.items ?? [])
  const courseSpendig = allItems
    .filter(i => ['服務', '加購', '活動'].includes(i.category))
    .reduce((s, i) => s + i.price * i.qty, 0)
  const productSpending = allItems
    .filter(i => i.category === '產品')
    .reduce((s, i) => s + i.price * i.qty, 0)
  const visitCount = client.checkouts.length

  // Service & product frequency maps
  const serviceMap: Record<string, { count: number; amount: number }> = {}
  const productMap: Record<string, { count: number; amount: number }> = {}

  for (const co of client.checkouts) {
    for (const item of co.items) {
      const key = item.label
      const amt = item.price * item.qty
      if (['服務', '套組核銷', '加購', '活動'].includes(item.category)) {
        if (!serviceMap[key]) serviceMap[key] = { count: 0, amount: 0 }
        serviceMap[key].count += item.qty
        serviceMap[key].amount += amt
      } else if (item.category === '產品') {
        if (!productMap[key]) productMap[key] = { count: 0, amount: 0 }
        productMap[key].count += item.qty
        productMap[key].amount += amt
      }
    }
  }

  const topServices = Object.entries(serviceMap).sort((a, b) => b[1].count - a[1].count).slice(0, 5)
  const topProducts = Object.entries(productMap).sort((a, b) => b[1].count - a[1].count).slice(0, 5)

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        {[
          { label: '課程累積', value: fmtAmt(courseSpendig), color: '#4a6b52' },
          { label: '保養品累積', value: fmtAmt(productSpending), color: '#5a4a6b' },
          { label: '到訪次數', value: `${visitCount} 次`, color: '#6b5f54' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '6px', padding: '10px', textAlign: 'center' }}>
            <div style={{ color: '#9a8f84', fontSize: '0.65rem', letterSpacing: '0.05em' }}>{label}</div>
            <div style={{ color, fontSize: '0.88rem', fontWeight: 500, marginTop: '2px' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Service preferences */}
      {topServices.length > 0 && (
        <div style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '6px', padding: '12px' }}>
          <p style={{ color: '#6b5f54', fontSize: '0.72rem', letterSpacing: '0.08em', marginBottom: '8px' }}>常做課程</p>
          <div className="space-y-2">
            {topServices.map(([name, { count, amount }]) => (
              <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#2c2825', fontSize: '0.82rem' }}>{name}</span>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ color: '#9a8f84', fontSize: '0.72rem' }}>{count} 次</span>
                  <span style={{ color: '#6b5f54', fontSize: '0.78rem' }}>{fmtAmt(amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Product preferences */}
      {topProducts.length > 0 && (
        <div style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '6px', padding: '12px' }}>
          <p style={{ color: '#6b5f54', fontSize: '0.72rem', letterSpacing: '0.08em', marginBottom: '8px' }}>常購產品</p>
          <div className="space-y-2">
            {topProducts.map(([name, { count, amount }]) => (
              <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#2c2825', fontSize: '0.82rem' }}>{name}</span>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ color: '#9a8f84', fontSize: '0.72rem' }}>{count} 次</span>
                  <span style={{ color: '#6b5f54', fontSize: '0.78rem' }}>{fmtAmt(amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Checkout history */}
      <div>
        <p style={{ color: '#6b5f54', fontSize: '0.72rem', letterSpacing: '0.08em', marginBottom: '8px' }}>消費明細</p>
        {client.checkouts.length === 0 ? (
          <p style={{ color: '#c4b8aa', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>尚無消費記錄</p>
        ) : (
          <div className="space-y-2">
            {client.checkouts.map(co => (
              <div key={co.id} style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '6px', padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ color: '#9a8f84', fontSize: '0.75rem' }}>{fmtShort(co.date)}</span>
                      <span style={{ color: '#2c2825', fontSize: '0.88rem', fontWeight: 500 }}>{fmtAmt(co.total_amount)}</span>
                      {co.note && <span style={{ color: '#9a8f84', fontSize: '0.72rem' }}>{co.note}</span>}
                    </div>
                    <div className="space-y-0.5">
                      {co.items.map(item => (
                        <div key={item.id} style={{ display: 'flex', gap: '6px', fontSize: '0.75rem' }}>
                          <span style={{ color: '#b4aa9e', minWidth: '44px' }}>{item.category}</span>
                          <span style={{ color: '#4a4642' }}>{item.label}</span>
                          {item.qty > 1 && <span style={{ color: '#9a8f84' }}>×{item.qty}</span>}
                          <span style={{ color: '#6b5f54', marginLeft: 'auto' }}>{fmtAmt(item.price * item.qty)}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: '4px', display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                      {co.payments.map(pay => (
                        <span key={pay.id} style={{ fontSize: '0.68rem', color: '#9a8f84', background: '#f0ebe4', borderRadius: '10px', padding: '1px 7px' }}>
                          {pay.method} {fmtAmt(pay.amount)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => deleteCheckout(co)} disabled={deleting === co.id}
                    style={{ color: '#c4b8aa', fontSize: '0.68rem', background: 'none', border: '1px solid #e0d9d0', borderRadius: '4px', padding: '2px 7px', cursor: 'pointer', flexShrink: 0 }}>
                    {deleting === co.id ? '…' : '刪除'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
type Tab = '分期' | '福利' | '套組' | '儲值' | '消費紀錄'
const TABS: Tab[] = ['分期', '福利', '套組', '儲值', '消費紀錄']

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
      setClient(await res.json())
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

  if (loading) return <div style={{ color: '#c4b8aa', textAlign: 'center', padding: '60px 0' }}>載入中…</div>
  if (!client) return null

  const level = (client.level || '癒米') as MembershipLevel
  const lc = LEVEL_COLOR[level] ?? LEVEL_COLOR['癒米']
  const isPendingUpgrade = !!(client.level_since && client.level_since > todayStr())
  const effectiveLevel: MembershipLevel = isPendingUpgrade ? '癒米' : level

  // Annual course spending for upgrade progress (current year, incl_course checkouts)
  const currentYear = new Date().getFullYear().toString()
  // 套組核銷 is excluded — it was already counted when the package was purchased
  const annualCourseSpending = client.checkouts
    .filter(co => co.incl_course && co.date.startsWith(currentYear))
    .flatMap(co => co.items ?? [])
    .filter(item => ['服務', '加購', '活動'].includes(item.category))
    .reduce((s, item) => s + item.price * item.qty, 0)

  const nextLevel = NEXT_LEVEL[effectiveLevel]
  const nextThreshold = nextLevel ? LEVEL_THRESHOLDS[nextLevel] : null
  const upgradeGap = nextThreshold ? Math.max(0, nextThreshold - annualCourseSpending) : 0
  const upgradePct = nextThreshold ? Math.min(100, Math.round((annualCourseSpending / nextThreshold) * 100)) : 100

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="pt-2">
        <div className="flex items-start justify-between">
          <div>
            <Link href="/clients" style={{ color: '#9a8f84', fontSize: '0.82rem' }}>← 客人</Link>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
              <h1 style={{ color: '#2c2825', fontSize: '1.4rem', fontWeight: 500 }}>{client.name}</h1>
              {client.level && (() => {
                const isPending = !!(client.level_since && client.level_since > todayStr())
                return (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ opacity: isPending ? 0.4 : 1 }}><MembershipBadge tier={level} /></span>
                    {isPending && (
                      <span style={{ fontSize: '0.68rem', color: '#b4aa9e', background: '#f0ede8', border: '1px solid #ddd8d0', borderRadius: '4px', padding: '1px 6px' }}>
                        待升等 {client.level_since}
                      </span>
                    )}
                  </span>
                )
              })()}
            </div>
            {client.phone && <div style={{ color: '#9a8f84', fontSize: '0.82rem', marginTop: '2px' }}>{client.phone}</div>}
            {client.note && <div style={{ color: '#6b5f54', fontSize: '0.8rem', marginTop: '4px' }}>{client.note}</div>}
            {client.birthday && <div style={{ color: '#b4aa9e', fontSize: '0.75rem', marginTop: '2px' }}>🎂 {client.birthday.replace('-', '月').replace(/(\d+)$/, '$1日')}</div>}
          </div>
          <Link href={`/clients/${id}/edit`} style={{ color: '#9a8f84', fontSize: '0.8rem', marginTop: '28px' }}>編輯</Link>
        </div>

        {/* Quick stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '14px' }}>
          {[
            { label: '金米', value: `${client.points} 點`, color: '#7a5a00', bg: '#fdf5e0', border: '#e0c055' },
            { label: '儲值', value: fmtAmt(client.stored_value), color: '#2d4f9a', bg: '#e8f0fc', border: '#9ab0e8' },
            { label: '分期中', value: `${client.active_contracts} 件`, color: '#9a6a4a', bg: '#fdf0e6', border: '#e8cba8' },
            { label: '套組', value: `${client.active_packages} 件`, color: '#4a6b52', bg: '#edf3eb', border: '#9ab89e' },
          ].map(({ label, value, color, bg, border }) => (
            <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: '5px', padding: '8px', textAlign: 'center' }}>
              <div style={{ color: '#9a8f84', fontSize: '0.65rem', letterSpacing: '0.05em' }}>{label}</div>
              <div style={{ color, fontSize: '0.82rem', marginTop: '2px', fontWeight: 500 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Upgrade progress */}
        {nextLevel ? (
          <div style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '6px', padding: '10px 12px', marginTop: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ color: '#6b5f54', fontSize: '0.72rem', letterSpacing: '0.06em' }}>
                升等進度　{effectiveLevel} → {nextLevel}
              </span>
              <span style={{ color: '#9a8f84', fontSize: '0.72rem' }}>
                {fmtAmt(annualCourseSpending)} / {fmtAmt(nextThreshold!)}
              </span>
            </div>
            <div style={{ background: '#e0d9d0', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
              <div style={{
                background: upgradePct >= 100 ? '#9ab89e' : lc.border,
                width: `${upgradePct}%`, height: '100%', borderRadius: '4px',
                transition: 'width 0.4s',
              }} />
            </div>
            <div style={{ marginTop: '4px', color: '#9a8f84', fontSize: '0.68rem' }}>
              {upgradeGap > 0
                ? `還差 ${fmtAmt(upgradeGap)} 可升 ${nextLevel}`
                : `已達 ${nextLevel} 門檻`}
            </div>
          </div>
        ) : (
          <div style={{ background: '#fdf5e0', border: '1px solid #e0c055', borderRadius: '6px', padding: '8px 12px', marginTop: '8px', textAlign: 'center' }}>
            <span style={{ color: '#7a5a00', fontSize: '0.72rem' }}>已是最高等級 悟癒米</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e0d9d0', overflowX: 'auto' }}>
        {TABS.map(t => <TabBtn key={t} label={t} active={tab === t} onClick={() => setTab(t)} />)}
      </div>

      {tab === '分期' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: '#9a8f84', fontSize: '0.78rem' }}>分期合約 {client.contracts.length} 件</span>
            <Link href={`/installments/new?client_id=${id}`}
              style={{ color: '#2c2825', fontSize: '0.78rem', background: '#f0ebe4', border: '1px solid #d9d0c5', borderRadius: '4px' }}
              className="px-3 py-1.5">＋ 新增合約</Link>
          </div>
          {client.contracts.length === 0
            ? <p style={{ color: '#c4b8aa', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>尚無分期合約</p>
            : client.contracts.map(c => <ContractCard key={c.id} contract={c} onChange={load} />)}
        </div>
      )}

      {tab === '福利' && <BenefitsTab client={client} refresh={load} />}
      {tab === '套組' && <PackagesTab client={client} refresh={load} />}
      {tab === '儲值' && <StoredValueTab client={client} refresh={load} />}
      {tab === '消費紀錄' && <ConsumptionTab client={client} refresh={load} />}

      {/* Delete */}
      <div style={{ borderTop: '1px solid #f0ebe4', paddingTop: '16px', marginTop: '8px' }}>
        <button onClick={deleteClient} style={{ color: '#9a8f84', fontSize: '0.75rem', background: 'none', border: 'none', cursor: 'pointer' }}>刪除此客人</button>
      </div>
    </div>
  )
}

// ─── Shared styles ─────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', background: '#faf8f5', border: '1px solid #e0d9d0',
  borderRadius: '6px', color: '#2c2825', fontSize: '0.88rem',
  outline: 'none', padding: '9px 12px',
}
const miniInput: React.CSSProperties = {
  background: '#faf8f5', border: '1px solid #e0d9d0',
  borderRadius: '5px', color: '#2c2825', fontSize: '0.82rem',
  outline: 'none', padding: '6px 10px',
}
const miniBtn: React.CSSProperties = {
  background: '#2c2825', color: '#f7f4ef', border: 'none',
  borderRadius: '5px', fontSize: '0.82rem', padding: '6px 14px', cursor: 'pointer',
}

function BenefitSection({ label, children, color = '#6b5f54', bg = '#faf8f5', border = '#e0d9d0' }: {
  label: string; children: React.ReactNode
  color?: string; bg?: string; border?: string
}) {
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: '8px', padding: '14px' }}>
      <p style={{ color, fontSize: '0.72rem', letterSpacing: '0.1em', marginBottom: '10px', fontWeight: 500 }}>{label}</p>
      {children}
    </div>
  )
}
