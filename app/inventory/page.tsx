'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

const CATEGORIES = ['精華/原液', '消耗品', '銷售產品', '其他'] as const
type Category = typeof CATEGORIES[number]

const UNITS = ['瓶', '支', '格', 'ml', '包', '盒', '組', '個', '條', '片']
const REASONS_IN  = ['補貨', '期初庫存', '退貨入庫', '手動調整']
const REASONS_OUT = ['日常消耗', '客人使用', '損耗', '手動調整']

interface InventoryItem {
  id: number
  name: string
  category: Category
  unit: string
  current_qty: number
  low_stock_threshold: number
  note: string | null
  created_at: string
}

const CAT_COLOR: Record<Category, { bg: string; color: string; border: string }> = {
  '精華/原液': { bg: '#eef4fb', color: '#2d4f9a', border: '#9ab0e8' },
  '消耗品':   { bg: '#f7f4ef', color: '#6b5f54', border: '#c8c4be' },
  '銷售產品': { bg: '#edf3eb', color: '#3a7a42', border: '#7ab884' },
  '其他':     { bg: '#faf8f5', color: '#9a8f84', border: '#e0d9d0' },
}

const sInput: React.CSSProperties = {
  background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '5px',
  color: '#2c2825', fontSize: '0.85rem', outline: 'none', padding: '8px 12px',
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filterCat, setFilterCat] = useState<Category | 'all'>('all')
  const [showLowOnly, setShowLowOnly] = useState(false)

  // Add form
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', category: '精華/原液' as Category, unit: '瓶', initial_qty: '', low_stock_threshold: '2', note: '' })
  const [addSaving, setAddSaving] = useState(false)

  // Edit
  const [editId, setEditId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ name: '', category: '精華/原液' as Category, unit: '瓶', low_stock_threshold: '2', note: '' })

  // Adjust
  const [adjustId, setAdjustId] = useState<number | null>(null)
  const [adjustForm, setAdjustForm] = useState({ direction: 'in' as 'in' | 'out', qty: '', reason: '補貨', date: '', note: '' })
  const [adjusting, setAdjusting] = useState(false)

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })

  async function load() {
    setLoading(true)
    const res = await fetch('/api/inventory')
    const data = await res.json()
    setItems(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAddSaving(true)
    const res = await fetch('/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...addForm, initial_qty: Number(addForm.initial_qty) || 0 }),
    })
    if (res.ok) {
      setAddForm({ name: '', category: '精華/原液', unit: '瓶', initial_qty: '', low_stock_threshold: '2', note: '' })
      setShowAdd(false)
      await load()
    }
    setAddSaving(false)
  }

  async function handleEdit(id: number) {
    await fetch(`/api/inventory/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...editForm, low_stock_threshold: Number(editForm.low_stock_threshold) }),
    })
    setEditId(null)
    await load()
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`確定要刪除「${name}」？相關庫存紀錄也會一併刪除。`)) return
    await fetch(`/api/inventory/${id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(i => i.id !== id))
  }

  async function handleAdjust(id: number) {
    if (!adjustForm.qty || isNaN(Number(adjustForm.qty))) return
    setAdjusting(true)
    const delta = adjustForm.direction === 'in' ? Math.abs(Number(adjustForm.qty)) : -Math.abs(Number(adjustForm.qty))
    const res = await fetch(`/api/inventory/${id}/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        delta,
        reason: adjustForm.reason,
        date: adjustForm.date || today,
        note: adjustForm.note || null,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      setItems(prev => prev.map(i => i.id === id ? { ...i, current_qty: data.current_qty } : i))
      setAdjustId(null)
    }
    setAdjusting(false)
  }

  function startEdit(item: InventoryItem) {
    setEditForm({ name: item.name, category: item.category, unit: item.unit, low_stock_threshold: String(item.low_stock_threshold), note: item.note || '' })
    setEditId(item.id)
    setAdjustId(null)
  }

  function startAdjust(item: InventoryItem) {
    setAdjustForm({ direction: 'in', qty: '', reason: '補貨', date: today, note: '' })
    setAdjustId(item.id)
    setEditId(null)
  }

  // Filter
  const displayed = items.filter(i => {
    if (filterCat !== 'all' && i.category !== filterCat) return false
    if (showLowOnly && i.current_qty > i.low_stock_threshold) return false
    return true
  })
  const lowCount = items.filter(i => i.current_qty <= i.low_stock_threshold).length

  // Group by category
  const grouped = CATEGORIES.reduce((acc, cat) => {
    const list = displayed.filter(i => i.category === cat)
    if (list.length > 0) acc[cat] = list
    return acc
  }, {} as Record<Category, InventoryItem[]>)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-3">
          <Link href="/" style={{ color: '#9a8f84', fontSize: '0.85rem' }}>← 首頁</Link>
          <h1 style={{ color: '#2c2825', fontSize: '1.1rem', fontWeight: 500 }}>庫存管理</h1>
        </div>
        <button onClick={() => { setShowAdd(s => !s); setEditId(null); setAdjustId(null) }}
          style={{ background: '#2c2825', color: '#f7f4ef', border: 'none', borderRadius: '6px', fontSize: '0.82rem', padding: '7px 14px', cursor: 'pointer' }}>
          + 新增品項
        </button>
      </div>

      {/* Low stock banner */}
      {lowCount > 0 && (
        <div style={{ background: '#fdf5e0', border: '1px solid #e0c055', borderLeft: '4px solid #c8940a', borderRadius: '6px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#7a5a00', fontSize: '0.85rem' }}>⚠ 有 {lowCount} 個品項庫存不足</span>
          <button onClick={() => setShowLowOnly(s => !s)}
            style={{ background: showLowOnly ? '#c8940a' : '#fff', color: showLowOnly ? '#fff' : '#7a5a00', border: '1px solid #c8940a', borderRadius: '4px', fontSize: '0.75rem', padding: '3px 10px', cursor: 'pointer' }}>
            {showLowOnly ? '顯示全部' : '只看不足'}
          </button>
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <form onSubmit={handleAdd} style={{ background: '#f7f4ef', border: '1px solid #e0d9d0', borderRadius: '8px', padding: '14px' }}>
          <p style={{ color: '#6b5f54', fontSize: '0.82rem', fontWeight: 500, marginBottom: '12px' }}>新增庫存品項</p>
          <div className="space-y-3">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={{ color: '#9a8f84', fontSize: '0.72rem', display: 'block', marginBottom: '3px' }}>品項名稱 *</label>
                <input type="text" value={addForm.name} onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="EX：玻尿酸原液" style={{ ...sInput, width: '100%' }} required />
              </div>
              <div>
                <label style={{ color: '#9a8f84', fontSize: '0.72rem', display: 'block', marginBottom: '3px' }}>類別</label>
                <select value={addForm.category} onChange={e => setAddForm(p => ({ ...p, category: e.target.value as Category }))} style={{ ...sInput, width: '100%' }}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              <div>
                <label style={{ color: '#9a8f84', fontSize: '0.72rem', display: 'block', marginBottom: '3px' }}>單位</label>
                <select value={addForm.unit} onChange={e => setAddForm(p => ({ ...p, unit: e.target.value }))} style={{ ...sInput, width: '100%' }}>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color: '#9a8f84', fontSize: '0.72rem', display: 'block', marginBottom: '3px' }}>初始庫存</label>
                <input type="number" value={addForm.initial_qty} min="0" step="0.5"
                  onChange={e => setAddForm(p => ({ ...p, initial_qty: e.target.value }))}
                  placeholder="0" style={{ ...sInput, width: '100%' }} />
              </div>
              <div>
                <label style={{ color: '#9a8f84', fontSize: '0.72rem', display: 'block', marginBottom: '3px' }}>安全庫存量</label>
                <input type="number" value={addForm.low_stock_threshold} min="0" step="0.5"
                  onChange={e => setAddForm(p => ({ ...p, low_stock_threshold: e.target.value }))}
                  placeholder="2" style={{ ...sInput, width: '100%' }} />
              </div>
            </div>
            <div>
              <label style={{ color: '#9a8f84', fontSize: '0.72rem', display: 'block', marginBottom: '3px' }}>備註</label>
              <input type="text" value={addForm.note} onChange={e => setAddForm(p => ({ ...p, note: e.target.value }))}
                placeholder="品牌、規格…" style={{ ...sInput, width: '100%' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button type="submit" disabled={addSaving}
              style={{ flex: 1, background: addSaving ? '#c4b8aa' : '#2c2825', color: '#f7f4ef', border: 'none', borderRadius: '6px', fontSize: '0.85rem', padding: '9px', cursor: addSaving ? 'not-allowed' : 'pointer' }}>
              {addSaving ? '儲存中…' : '新增'}
            </button>
            <button type="button" onClick={() => setShowAdd(false)}
              style={{ flex: 1, background: '#e0d9d0', color: '#6b5f54', border: 'none', borderRadius: '6px', fontSize: '0.85rem', padding: '9px', cursor: 'pointer' }}>
              取消
            </button>
          </div>
        </form>
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
        {(['all', ...CATEGORIES] as const).map(cat => (
          <button key={cat} onClick={() => setFilterCat(cat)}
            style={{
              whiteSpace: 'nowrap', padding: '5px 12px', borderRadius: '20px', fontSize: '0.78rem', cursor: 'pointer', border: 'none',
              background: filterCat === cat ? '#2c2825' : '#f0ece6',
              color: filterCat === cat ? '#f7f4ef' : '#6b5f54',
            }}>
            {cat === 'all' ? `全部（${items.length}）` : `${cat}（${items.filter(i => i.category === cat).length}）`}
          </button>
        ))}
      </div>

      {/* Items */}
      {loading ? (
        <p style={{ color: '#9a8f84', textAlign: 'center', padding: '30px 0' }}>載入中…</p>
      ) : displayed.length === 0 ? (
        <p style={{ color: '#b4aa9e', textAlign: 'center', padding: '30px 0', fontSize: '0.85rem' }}>
          {showLowOnly ? '目前無庫存不足品項 🎉' : '尚無品項，點上方「+ 新增品項」開始'}
        </p>
      ) : (
        <div className="space-y-6">
          {(Object.keys(grouped) as Category[]).map(cat => (
            <div key={cat}>
              <p style={{ color: CAT_COLOR[cat].color, fontSize: '0.72rem', letterSpacing: '0.08em', fontWeight: 600, marginBottom: '8px', paddingLeft: '4px' }}>
                {cat}
              </p>
              <div className="space-y-3">
                {grouped[cat].map(item => {
                  const isLow = item.current_qty <= item.low_stock_threshold
                  const cc = CAT_COLOR[item.category]
                  return (
                    <div key={item.id} style={{ border: `1px solid ${isLow ? '#e8c96a' : cc.border}`, borderRadius: '8px', background: isLow ? '#fdf8ee' : cc.bg, overflow: 'hidden' }}>
                      {/* Item header */}
                      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ color: '#2c2825', fontSize: '0.92rem', fontWeight: 500 }}>{item.name}</span>
                            {isLow && <span style={{ background: '#f0c040', color: '#7a5a00', fontSize: '0.68rem', padding: '1px 7px', borderRadius: '10px', fontWeight: 600 }}>⚠ 不足</span>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                            <span style={{ color: isLow ? '#9a6a00' : cc.color, fontSize: '1rem', fontWeight: 600 }}>
                              {item.current_qty}
                              <span style={{ fontSize: '0.75rem', marginLeft: '3px', fontWeight: 400, color: '#9a8f84' }}>{item.unit}</span>
                            </span>
                            <span style={{ color: '#b4aa9e', fontSize: '0.72rem' }}>安全庫存 {item.low_stock_threshold}{item.unit}</span>
                          </div>
                          {item.note && <p style={{ color: '#9a8f84', fontSize: '0.72rem', marginTop: '2px' }}>{item.note}</p>}
                        </div>
                        <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
                          <button onClick={() => startAdjust(item)}
                            style={{ background: '#2c2825', color: '#f7f4ef', border: 'none', borderRadius: '5px', fontSize: '0.75rem', padding: '5px 10px', cursor: 'pointer' }}>
                            調整
                          </button>
                          <button onClick={() => startEdit(item)}
                            style={{ background: 'none', border: '1px solid #e0d9d0', borderRadius: '5px', color: '#9a8f84', fontSize: '0.75rem', padding: '5px 8px', cursor: 'pointer' }}>
                            編輯
                          </button>
                          <button onClick={() => handleDelete(item.id, item.name)}
                            style={{ background: 'none', border: '1px solid #e8a8a8', borderRadius: '5px', color: '#9a6060', fontSize: '0.75rem', padding: '5px 8px', cursor: 'pointer' }}>
                            刪除
                          </button>
                        </div>
                      </div>

                      {/* Edit form */}
                      {editId === item.id && (
                        <div style={{ borderTop: '1px solid #e0d9d0', padding: '12px 14px', background: '#fff' }}>
                          <div className="space-y-2">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                              <div>
                                <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '2px' }}>品名</label>
                                <input type="text" value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} style={{ ...sInput, width: '100%', fontSize: '0.8rem' }} />
                              </div>
                              <div>
                                <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '2px' }}>類別</label>
                                <select value={editForm.category} onChange={e => setEditForm(p => ({ ...p, category: e.target.value as Category }))} style={{ ...sInput, width: '100%', fontSize: '0.8rem' }}>
                                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                              </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                              <div>
                                <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '2px' }}>單位</label>
                                <select value={editForm.unit} onChange={e => setEditForm(p => ({ ...p, unit: e.target.value }))} style={{ ...sInput, width: '100%', fontSize: '0.8rem' }}>
                                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                              </div>
                              <div>
                                <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '2px' }}>安全庫存量</label>
                                <input type="number" value={editForm.low_stock_threshold} min="0" step="0.5" onChange={e => setEditForm(p => ({ ...p, low_stock_threshold: e.target.value }))} style={{ ...sInput, width: '100%', fontSize: '0.8rem' }} />
                              </div>
                            </div>
                            <div>
                              <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '2px' }}>備註</label>
                              <input type="text" value={editForm.note} onChange={e => setEditForm(p => ({ ...p, note: e.target.value }))} style={{ ...sInput, width: '100%', fontSize: '0.8rem' }} />
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                            <button onClick={() => handleEdit(item.id)}
                              style={{ flex: 1, background: '#2c2825', color: '#f7f4ef', border: 'none', borderRadius: '5px', fontSize: '0.8rem', padding: '7px', cursor: 'pointer' }}>
                              儲存
                            </button>
                            <button onClick={() => setEditId(null)}
                              style={{ flex: 1, background: '#e0d9d0', color: '#6b5f54', border: 'none', borderRadius: '5px', fontSize: '0.8rem', padding: '7px', cursor: 'pointer' }}>
                              取消
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Adjust form */}
                      {adjustId === item.id && (
                        <div style={{ borderTop: '1px solid #e0d9d0', padding: '12px 14px', background: '#fff' }}>
                          <div className="space-y-2">
                            {/* In / Out toggle */}
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {(['in', 'out'] as const).map(dir => (
                                <button key={dir} type="button"
                                  onClick={() => setAdjustForm(p => ({ ...p, direction: dir, reason: dir === 'in' ? '補貨' : '日常消耗' }))}
                                  style={{
                                    flex: 1, border: 'none', borderRadius: '5px', fontSize: '0.82rem', padding: '7px', cursor: 'pointer',
                                    background: adjustForm.direction === dir ? (dir === 'in' ? '#3a7a42' : '#9a4a4a') : '#f0ece6',
                                    color: adjustForm.direction === dir ? '#fff' : '#6b5f54',
                                  }}>
                                  {dir === 'in' ? '＋ 補貨 / 入庫' : '－ 消耗 / 出庫'}
                                </button>
                              ))}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                              <div>
                                <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '2px' }}>數量</label>
                                <input type="number" value={adjustForm.qty} min="0.5" step="0.5"
                                  onChange={e => setAdjustForm(p => ({ ...p, qty: e.target.value }))}
                                  placeholder="0" style={{ ...sInput, width: '100%', fontSize: '0.82rem' }} />
                              </div>
                              <div>
                                <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '2px' }}>原因</label>
                                <select value={adjustForm.reason}
                                  onChange={e => setAdjustForm(p => ({ ...p, reason: e.target.value }))}
                                  style={{ ...sInput, width: '100%', fontSize: '0.82rem' }}>
                                  {(adjustForm.direction === 'in' ? REASONS_IN : REASONS_OUT).map(r => (
                                    <option key={r} value={r}>{r}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <div>
                              <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '2px' }}>日期</label>
                              <input type="date" value={adjustForm.date}
                                onChange={e => setAdjustForm(p => ({ ...p, date: e.target.value }))}
                                style={{ ...sInput, width: '100%', fontSize: '0.82rem' }} />
                            </div>
                            <div>
                              <label style={{ color: '#9a8f84', fontSize: '0.68rem', display: 'block', marginBottom: '2px' }}>備註</label>
                              <input type="text" value={adjustForm.note}
                                onChange={e => setAdjustForm(p => ({ ...p, note: e.target.value }))}
                                placeholder="選填" style={{ ...sInput, width: '100%', fontSize: '0.82rem' }} />
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                            <button onClick={() => handleAdjust(item.id)} disabled={adjusting}
                              style={{
                                flex: 1, border: 'none', borderRadius: '5px', fontSize: '0.82rem', padding: '8px', cursor: adjusting ? 'not-allowed' : 'pointer',
                                background: adjusting ? '#c4b8aa' : (adjustForm.direction === 'in' ? '#3a7a42' : '#9a4a4a'),
                                color: '#fff',
                              }}>
                              {adjusting ? '儲存中…' : '確認'}
                            </button>
                            <button onClick={() => setAdjustId(null)}
                              style={{ flex: 1, background: '#e0d9d0', color: '#6b5f54', border: 'none', borderRadius: '5px', fontSize: '0.82rem', padding: '8px', cursor: 'pointer' }}>
                              取消
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
