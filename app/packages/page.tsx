'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import MembershipBadge from '@/components/MembershipBadge'
import { MembershipLevel, PAYMENT_METHODS } from '@/types'

interface PkgRow {
  id: number; client_id: number; client_name: string; client_level: string
  service_name: string; total_sessions: number; used_sessions: number
  unit_price: number; unit_price_orig: number; prepaid_amount: number; payment_method: string
  date: string; note: string | null
  include_in_accumulation: number; include_in_points: number
}

interface EditForm {
  service_name: string; total_sessions: string; used_sessions: string
  unit_price: string; unit_price_orig: string; prepaid_amount: string; payment_method: string
  date: string; note: string
  include_in_accumulation: boolean; include_in_points: boolean
}

const fmtAmt = (n: number) => `$ ${n.toLocaleString()}`
const fmtShort = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })

const EDIT_PAY_METHODS = PAYMENT_METHODS.filter(m => !['核銷', '商品券'].includes(m))

function addMonths(dateStr: string, n: number) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setMonth(d.getMonth() + n)
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
}

interface InstPeriod { due_date: string; amount: string; paid_at?: string | null }
interface ContractRow { id: number; payment_method: string; note: string | null }
interface InstRow { due_date: string; amount: number; paid_at: string | null }

export default function PackagesPage() {
  const [packages, setPackages] = useState<PkgRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'active' | 'all'>('active')
  const [search, setSearch] = useState('')
  const [using, setUsing] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [editInstPeriods, setEditInstPeriods] = useState<InstPeriod[]>([])
  const [editInstPayMethod, setEditInstPayMethod] = useState('現金')
  const [editInstContractId, setEditInstContractId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)

  function load() {
    setLoading(true)
    fetch(`/api/packages?status=${filter}`)
      .then(r => r.json())
      .then(d => { setPackages(d); setLoading(false) })
  }
  useEffect(load, [filter])

  const filtered = search.trim()
    ? packages.filter(p =>
        p.client_name.toLowerCase().includes(search.toLowerCase()) ||
        p.service_name.toLowerCase().includes(search.toLowerCase())
      )
    : packages

  async function quickUse(pkg: PkgRow) {
    if (!confirm(`核銷「${pkg.client_name}｜${pkg.service_name}」一次？`)) return
    setUsing(pkg.id)
    await fetch(`/api/packages/${pkg.id}/use`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qty: 1 }),
    })
    setUsing(null)
    load()
  }

  async function undoUse(pkg: PkgRow) {
    if (!confirm(`取消「${pkg.client_name}｜${pkg.service_name}」最後一次核銷？`)) return
    setUsing(pkg.id)
    await fetch(`/api/packages/${pkg.id}/use`, { method: 'DELETE' })
    setUsing(null)
    load()
  }

  async function startEdit(pkg: PkgRow) {
    setEditingId(pkg.id)
    setEditForm({
      service_name:    pkg.service_name,
      total_sessions:  String(pkg.total_sessions),
      used_sessions:   String(pkg.used_sessions),
      unit_price:      String(pkg.unit_price),
      unit_price_orig: String(pkg.unit_price_orig || pkg.unit_price),
      prepaid_amount:  String(pkg.prepaid_amount),
      payment_method:  pkg.payment_method,
      date:            pkg.date,
      note:            pkg.note ?? '',
      include_in_accumulation: pkg.include_in_accumulation === 1,
      include_in_points:       pkg.include_in_points === 1,
    })
    setEditInstPeriods([])
    setEditInstPayMethod('現金')
    setEditInstContractId(null)
    if (pkg.payment_method === '分期') {
      try {
        const contracts: ContractRow[] = await fetch(`/api/contracts?client_id=${pkg.client_id}`).then(r => r.json())
        const matching = contracts.find(c => c.note?.includes(pkg.service_name)) ?? contracts[0] ?? null
        if (matching) {
          const full = await fetch(`/api/contracts/${matching.id}`).then(r => r.json())
          setEditInstContractId(matching.id)
          setEditInstPayMethod(matching.payment_method || '現金')
          setEditInstPeriods((full.installments as InstRow[]).map(inst => ({
            due_date: inst.due_date,
            amount: String(inst.amount),
            paid_at: inst.paid_at,
          })))
        }
      } catch { /* ignore */ }
    }
  }

  async function saveEdit(id: number) {
    if (!editForm) return
    setSaving(true)
    await fetch(`/api/packages/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...editForm,
        total_sessions:  Number(editForm.total_sessions),
        used_sessions:   Number(editForm.used_sessions),
        unit_price:      Number(editForm.unit_price),
        unit_price_orig: Number(editForm.unit_price_orig),
        prepaid_amount:  Number(editForm.prepaid_amount),
      }),
    })
    if (editForm.payment_method === '分期' && editInstPeriods.length > 0) {
      const hasPaid = editInstPeriods.some(p => p.paid_at)
      if (editInstContractId && !hasPaid) {
        await fetch(`/api/contracts/${editInstContractId}`, { method: 'DELETE' })
      }
      if (!editInstContractId || !hasPaid) {
        const pkg = packages.find(p => p.id === id)
        if (pkg) {
          await fetch('/api/contracts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client_id: pkg.client_id,
              payment_method: editInstPayMethod,
              note: `套組：${editForm.service_name}`,
              periods: editInstPeriods.map(p => ({ due_date: p.due_date, amount: Number(p.amount) })),
            }),
          })
        }
      }
    }
    setSaving(false)
    setEditingId(null)
    setEditForm(null)
    setEditInstPeriods([])
    setEditInstPayMethod('現金')
    setEditInstContractId(null)
    load()
  }

  async function deletePkg(pkg: PkgRow) {
    if (!confirm(`確定刪除「${pkg.client_name}｜${pkg.service_name}」套組？\n此操作無法復原，相關分期合約也會一併刪除。`)) return
    setDeleting(pkg.id)
    await fetch(`/api/packages/${pkg.id}`, { method: 'DELETE' })
    setDeleting(null)
    load()
  }

  function ef(k: keyof EditForm, v: string | boolean) {
    setEditForm(f => f ? { ...f, [k]: v } : f)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 style={{ color: '#2c2825', fontSize: '1.4rem', letterSpacing: '0.05em', fontWeight: 500 }}>套組</h1>
          <p style={{ color: '#9a8f84', fontSize: '0.78rem', marginTop: '2px' }}>
            {filter === 'active' ? '進行中套組' : '全部套組'}　共 {packages.length} 件
            {search && filtered.length !== packages.length && (
              <span style={{ color: '#c4b8aa' }}>　搜尋結果 {filtered.length} 件</span>
            )}
          </p>
        </div>
        <Link href="/packages/new">
          <button style={{ background: '#2c2825', color: '#f7f4ef', border: 'none', borderRadius: '5px', fontSize: '0.8rem' }}
            className="px-4 py-2">＋ 新增</button>
        </Link>
      </div>

      {/* Filter + Search */}
      <div className="space-y-2">
        <div style={{ display: 'flex', gap: '6px' }}>
          {(['active', 'all'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{
                background: filter === f ? '#2c2825' : '#f0ebe4',
                color: filter === f ? '#f7f4ef' : '#6b5f54',
                border: 'none', borderRadius: '4px',
                fontSize: '0.78rem', padding: '5px 14px', cursor: 'pointer',
              }}>
              {f === 'active' ? '進行中' : '全部'}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="搜尋客人姓名 / 服務名稱…"
          style={{
            width: '100%', background: '#faf8f5', border: '1px solid #e0d9d0',
            borderRadius: '6px', color: '#2c2825', fontSize: '0.88rem',
            outline: 'none', padding: '9px 12px',
          }}
        />
      </div>

      {loading ? (
        <div style={{ color: '#c4b8aa', textAlign: 'center', padding: '40px 0', fontSize: '0.85rem' }}>載入中…</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: '#c4b8aa', textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: '1.8rem', marginBottom: '10px' }}>— 無 —</div>
          <p style={{ fontSize: '0.85rem' }}>
            {search ? `找不到「${search}」相關套組` : filter === 'active' ? '目前無進行中套組' : '尚無套組記錄'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(pkg => {
            const remaining = pkg.total_sessions - pkg.used_sessions
            const pct = pkg.total_sessions > 0 ? (pkg.used_sessions / pkg.total_sessions) * 100 : 0
            const pending = pkg.prepaid_amount - pkg.used_sessions * pkg.unit_price
            const isEditing = editingId === pkg.id

            return (
              <div key={pkg.id}
                style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '6px', padding: '14px' }}>

                {/* ── View mode ── */}
                {!isEditing && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link href={`/clients/${pkg.client_id}`}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ color: '#2c2825', fontSize: '0.95rem' }}>{pkg.client_name}</span>
                          {pkg.client_level && <MembershipBadge tier={pkg.client_level as MembershipLevel} />}
                        </div>
                      </Link>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', flexWrap: 'wrap' }}>
                        <span style={{ color: '#6b5f54', fontSize: '0.85rem' }}>{pkg.service_name}</span>
                        {pkg.include_in_accumulation === 1 ? (
                          <span style={{ fontSize: '0.65rem', color: '#4a6b52', background: '#edf3eb', border: '1px solid #9ab89e', borderRadius: '10px', padding: '1px 7px' }}>
                            計入年度
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.65rem', color: '#9a8f84', background: '#f0ebe4', border: '1px solid #d9d0c5', borderRadius: '10px', padding: '1px 7px' }}>
                            不計入年度
                          </span>
                        )}
                      </div>
                      <div style={{ color: '#9a8f84', fontSize: '0.72rem', marginTop: '2px' }}>
                        {fmtShort(pkg.date)}　{pkg.payment_method}　{fmtAmt(pkg.prepaid_amount)}
                        {pkg.note && `　${pkg.note}`}
                      </div>
                      {/* Progress bar */}
                      <div style={{ marginTop: '8px' }}>
                        <div style={{ background: '#f0ebe4', borderRadius: '4px', height: '5px' }}>
                          <div style={{
                            background: remaining > 0 ? '#9ab89e' : '#c4b8aa',
                            width: `${pct}%`, height: '100%', borderRadius: '4px',
                          }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}>
                          <span style={{ color: '#9a8f84', fontSize: '0.7rem' }}>
                            已用 {pkg.used_sessions} / {pkg.total_sessions} 次
                          </span>
                          {pending > 0 && (
                            <span style={{ color: '#9a6a4a', fontSize: '0.7rem' }}>待履行 {fmtAmt(pending)}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                      <div style={{
                        background: remaining > 0 ? '#edf3eb' : '#f0ebe4',
                        color: remaining > 0 ? '#4a6b52' : '#9a8f84',
                        fontSize: '0.9rem', fontWeight: 600,
                        padding: '4px 10px', borderRadius: '5px',
                      }}>
                        剩 {remaining} 次
                      </div>
                      {remaining > 0 && (
                        <button onClick={() => quickUse(pkg)} disabled={using === pkg.id}
                          style={{
                            background: '#2c2825', color: '#f7f4ef',
                            border: 'none', borderRadius: '4px',
                            fontSize: '0.75rem', padding: '5px 12px',
                            cursor: using === pkg.id ? 'not-allowed' : 'pointer',
                          }}>
                          核銷一次
                        </button>
                      )}
                      {pkg.used_sessions > 0 && (
                        <button onClick={() => undoUse(pkg)} disabled={using === pkg.id}
                          style={{
                            background: 'none', color: '#9a8f84',
                            border: '1px solid #e0d9d0', borderRadius: '4px',
                            fontSize: '0.7rem', padding: '3px 10px',
                            cursor: using === pkg.id ? 'not-allowed' : 'pointer',
                          }}>
                          取消
                        </button>
                      )}
                      <button onClick={() => startEdit(pkg)}
                        style={{
                          background: 'none', color: '#9a8f84',
                          border: '1px solid #e0d9d0', borderRadius: '4px',
                          fontSize: '0.7rem', padding: '3px 10px', cursor: 'pointer',
                        }}>
                        編輯
                      </button>
                      <button onClick={() => deletePkg(pkg)} disabled={deleting === pkg.id}
                        style={{
                          background: 'none', color: '#9a4a4a',
                          border: '1px solid #e8c4c4', borderRadius: '4px',
                          fontSize: '0.7rem', padding: '3px 10px',
                          cursor: deleting === pkg.id ? 'not-allowed' : 'pointer',
                        }}>
                        {deleting === pkg.id ? '…' : '刪除'}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Edit mode ── */}
                {isEditing && editForm && (
                  <div className="space-y-3">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Link href={`/clients/${pkg.client_id}`}>
                          <span style={{ color: '#2c2825', fontSize: '0.9rem', fontWeight: 500 }}>{pkg.client_name}</span>
                        </Link>
                        {pkg.client_level && <MembershipBadge tier={pkg.client_level as MembershipLevel} />}
                      </div>
                      <span style={{ color: '#c4b8aa', fontSize: '0.72rem' }}>編輯模式</span>
                    </div>

                    {/* Service name */}
                    <div>
                      <FLabel>服務名稱</FLabel>
                      <input value={editForm.service_name} onChange={e => ef('service_name', e.target.value)}
                        style={iStyle} />
                    </div>

                    {/* Sessions + price row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <FLabel>總堂數</FLabel>
                        <input value={editForm.total_sessions} onChange={e => ef('total_sessions', e.target.value)}
                          type="number" min="1" style={iStyle} />
                      </div>
                      <div>
                        <FLabel>已用堂數</FLabel>
                        <input value={editForm.used_sessions} onChange={e => ef('used_sessions', e.target.value)}
                          type="number" min="0" style={iStyle} />
                      </div>
                      <div>
                        <FLabel>單堂原價</FLabel>
                        <input value={editForm.unit_price_orig} onChange={e => ef('unit_price_orig', e.target.value)}
                          type="number" min="0" style={iStyle} />
                      </div>
                      <div>
                        <FLabel>記帳單堂價（優惠後）</FLabel>
                        <input value={editForm.unit_price} onChange={e => ef('unit_price', e.target.value)}
                          type="number" min="0" style={iStyle} />
                      </div>
                    </div>

                    {/* Amount + method row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <FLabel>預收金額</FLabel>
                        <input value={editForm.prepaid_amount} onChange={e => ef('prepaid_amount', e.target.value)}
                          type="number" min="0" style={iStyle} />
                      </div>
                      <div>
                        <FLabel>付款方式</FLabel>
                        <select value={editForm.payment_method} onChange={e => ef('payment_method', e.target.value)}
                          style={iStyle}>
                          {EDIT_PAY_METHODS.map(m => <option key={m}>{m}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* ── 分期設定 ── */}
                    {editForm.payment_method === '分期' && (
                      <div style={{ background: '#f5f2ee', borderRadius: '6px', padding: '12px' }}
                        className="space-y-3">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <FLabel>分期設定</FLabel>
                          <div style={{ display: 'flex', gap: '5px' }}>
                            {[2,3,4,6].map(n => (
                              <button key={n} type="button"
                                onClick={() => {
                                  const totalAmt = Number(editForm.prepaid_amount)
                                  const base = Math.floor(totalAmt / n)
                                  const rem  = totalAmt - base * (n - 1)
                                  setEditInstPeriods(Array.from({ length: n }, (_, i) => ({
                                    due_date: addMonths(editForm.date, i),
                                    amount: String(i === n - 1 ? rem : base),
                                  })))
                                }}
                                style={{
                                  background: editInstPeriods.length === n ? '#2c2825' : '#f0ebe4',
                                  color: editInstPeriods.length === n ? '#f7f4ef' : '#6b5f54',
                                  border: 'none', borderRadius: '4px',
                                  fontSize: '0.72rem', padding: '3px 10px', cursor: 'pointer',
                                }}>
                                {n}期
                              </button>
                            ))}
                          </div>
                        </div>
                        {editInstContractId !== null && editInstPeriods.some(p => p.paid_at) && (
                          <p style={{ color: '#9a6a4a', fontSize: '0.72rem', background: '#fdf5ee', borderRadius: '4px', padding: '6px 10px' }}>
                            ⚠ 此合約已有付款記錄，僅供查看。如需修改請至分期管理頁面。
                          </p>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <div>
                            <FLabel>每期付款方式</FLabel>
                            <select value={editInstPayMethod}
                              onChange={e => setEditInstPayMethod(e.target.value)}
                              disabled={editInstContractId !== null && editInstPeriods.some(p => p.paid_at)}
                              style={iStyle}>
                              {['現金','匯款','LINE Pay'].map(m => <option key={m}>{m}</option>)}
                            </select>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '4px' }}>
                            <span style={{
                              color: editInstPeriods.reduce((s,p) => s+Number(p.amount), 0) === Number(editForm.prepaid_amount) ? '#4a6b52' : '#9a4a4a',
                              fontSize: '0.78rem',
                            }}>
                              合計 ${editInstPeriods.reduce((s,p) => s+Number(p.amount), 0).toLocaleString()}
                              {editInstPeriods.reduce((s,p) => s+Number(p.amount), 0) !== Number(editForm.prepaid_amount) &&
                                ` ≠ $${Number(editForm.prepaid_amount).toLocaleString()}`}
                            </span>
                          </div>
                        </div>
                        {editInstPeriods.map((p, i) => (
                          <div key={i} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr auto', gap: '8px', alignItems: 'center' }}>
                            <span style={{ color: '#9a8f84', fontSize: '0.75rem', minWidth: '36px' }}>
                              第{i+1}期{p.paid_at ? ' ✓' : ''}
                            </span>
                            <input value={p.due_date}
                              onChange={e => setEditInstPeriods(ps => ps.map((x,j) => j===i ? {...x, due_date: e.target.value} : x))}
                              type="date" style={iStyle} disabled={!!p.paid_at} />
                            <input value={p.amount}
                              onChange={e => setEditInstPeriods(ps => ps.map((x,j) => j===i ? {...x, amount: e.target.value} : x))}
                              type="number" min="0" style={iStyle} disabled={!!p.paid_at} />
                            {!p.paid_at ? (
                              <button type="button"
                                onClick={() => setEditInstPeriods(ps => ps.filter((_,j) => j!==i))}
                                style={{ color: '#9a4a4a', background: 'none', border: 'none', fontSize: '1rem', cursor: 'pointer', padding: '0 4px' }}>×</button>
                            ) : (
                              <span style={{ color: '#4a6b52', fontSize: '0.72rem', padding: '0 4px' }}>已付</span>
                            )}
                          </div>
                        ))}
                        {(editInstContractId === null || !editInstPeriods.some(p => p.paid_at)) && (
                          <button type="button"
                            onClick={() => setEditInstPeriods(ps => [...ps, { due_date: addMonths(editForm.date, ps.length), amount: '' }])}
                            style={{ color: '#9a8f84', background: 'none', border: '1px dashed #e0d9d0', borderRadius: '5px', fontSize: '0.78rem', padding: '5px 0', width: '100%', cursor: 'pointer' }}>
                            ＋ 新增一期
                          </button>
                        )}
                      </div>
                    )}

                    {/* Date + note */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <FLabel>日期</FLabel>
                        <input value={editForm.date} onChange={e => ef('date', e.target.value)}
                          type="date" style={iStyle} />
                      </div>
                      <div>
                        <FLabel>備註</FLabel>
                        <input value={editForm.note} onChange={e => ef('note', e.target.value)}
                          placeholder="選填" style={iStyle} />
                      </div>
                    </div>

                    {/* Accumulation toggles */}
                    <div style={{ background: '#f5f2ee', borderRadius: '6px', padding: '10px 12px' }} className="space-y-2">
                      <FLabel>累積設定</FLabel>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={editForm.include_in_accumulation}
                          onChange={e => ef('include_in_accumulation', e.target.checked)}
                          style={{ accentColor: '#6b5f54', width: '15px', height: '15px' }} />
                        <span style={{ color: '#2c2825', fontSize: '0.85rem' }}>計入年度課程消費（升等用）</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={editForm.include_in_points}
                          onChange={e => ef('include_in_points', e.target.checked)}
                          style={{ accentColor: '#6b5f54', width: '15px', height: '15px' }} />
                        <span style={{ color: '#2c2825', fontSize: '0.85rem' }}>計入金米積分</span>
                      </label>
                    </div>

                    {/* Save / Cancel */}
                    <div style={{ display: 'flex', gap: '8px', paddingTop: '2px' }}>
                      <button onClick={() => saveEdit(pkg.id)} disabled={saving}
                        style={{
                          flex: 1, background: '#2c2825', color: '#f7f4ef',
                          border: 'none', borderRadius: '5px', fontSize: '0.85rem',
                          padding: '10px', cursor: saving ? 'not-allowed' : 'pointer',
                        }}>
                        {saving ? '儲存中…' : '儲存'}
                      </button>
                      <button onClick={() => { setEditingId(null); setEditForm(null); setEditInstPeriods([]); setEditInstPayMethod('現金'); setEditInstContractId(null) }}
                        style={{
                          flex: 1, background: 'none', color: '#6b5f54',
                          border: '1px solid #e0d9d0', borderRadius: '5px',
                          fontSize: '0.85rem', padding: '10px', cursor: 'pointer',
                        }}>
                        取消
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const iStyle: React.CSSProperties = {
  width: '100%', background: '#fff', border: '1px solid #e0d9d0',
  borderRadius: '5px', color: '#2c2825', fontSize: '0.85rem',
  outline: 'none', padding: '7px 10px', marginTop: '3px',
}

function FLabel({ children }: { children: React.ReactNode }) {
  return <p style={{ color: '#9a8f84', fontSize: '0.7rem', letterSpacing: '0.05em' }}>{children}</p>
}
