'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Tag { id: number; name: string; color: string; client_count: number }

const TAG_COLORS = [
  '#9ab89e', '#c0a88a', '#8ab0c8', '#c4a8d8',
  '#e0a8a8', '#a8c4b0', '#d4b840', '#a89890',
  '#d49870', '#8ab8b0', '#e0b890', '#b8a0c0',
]

const iStyle: React.CSSProperties = {
  width: '100%', background: '#faf8f5', border: '1px solid #e0d9d0',
  borderRadius: '6px', color: '#2c2825', fontSize: '0.88rem',
  outline: 'none', padding: '9px 12px',
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
      {TAG_COLORS.map(c => (
        <button key={c} type="button" onClick={() => onChange(c)}
          style={{
            width: '26px', height: '26px', borderRadius: '50%',
            background: c, border: value === c ? '3px solid #2c2825' : '2px solid transparent',
            cursor: 'pointer', flexShrink: 0, outline: 'none',
          }} />
      ))}
    </div>
  )
}

export default function TagsPage() {
  const [tags, setTags]         = useState<Tag[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)

  // New tag
  const [newName, setNewName]   = useState('')
  const [newColor, setNewColor] = useState(TAG_COLORS[0])
  const [creating, setCreating] = useState(false)
  const [createErr, setCreateErr] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Edit
  const [editingId, setEditingId]   = useState<number | null>(null)
  const [editName, setEditName]     = useState('')
  const [editColor, setEditColor]   = useState('')
  const [saving, setSaving]         = useState(false)
  const [editErr, setEditErr]       = useState('')

  function load() {
    fetch('/api/tags').then(r => r.json()).then((d: Tag[]) => { setTags(d); setLoading(false) })
  }
  useEffect(() => { load() }, [])

  async function createTag(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true); setCreateErr('')
    const res = await fetch('/api/tags', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), color: newColor }),
    })
    setCreating(false)
    if (!res.ok) { const d = await res.json(); setCreateErr(d.error || '建立失敗'); return }
    const created = newName.trim()
    setNewName(''); setNewColor(TAG_COLORS[0]); setShowForm(false)
    load()
    setSuccessMsg(`標籤「${created}」已建立`)
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  function startEdit(tag: Tag) {
    setEditingId(tag.id); setEditName(tag.name); setEditColor(tag.color); setEditErr('')
  }

  async function saveEdit(id: number) {
    if (!editName.trim()) return
    setSaving(true); setEditErr('')
    const res = await fetch(`/api/tags/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName.trim(), color: editColor }),
    })
    setSaving(false)
    if (!res.ok) { const d = await res.json(); setEditErr(d.error || '儲存失敗'); return }
    setEditingId(null); load()
  }

  async function deleteTag(tag: Tag) {
    if (!confirm(`確定刪除標籤「${tag.name}」？\n（${tag.client_count} 位客人會同步移除此標籤）`)) return
    await fetch(`/api/tags/${tag.id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between pt-2">
        <h1 style={{ color: '#2c2825', fontSize: '1.4rem', letterSpacing: '0.05em', fontWeight: 500 }}>
          標籤管理
        </h1>
        <button onClick={() => { setShowForm(v => !v); setCreateErr('') }}
          style={{
            background: showForm ? '#f0ebe4' : '#2c2825',
            color: showForm ? '#6b5f54' : '#f7f4ef',
            border: 'none', borderRadius: '5px',
            fontSize: '0.8rem', padding: '7px 16px', cursor: 'pointer',
          }}>
          {showForm ? '取消' : '＋ 新增標籤'}
        </button>
      </div>

      {/* Success toast */}
      {successMsg && (
        <div style={{
          background: '#edf3eb', border: '1px solid #9ab89e', borderRadius: '6px',
          color: '#4a6b52', fontSize: '0.85rem', padding: '10px 14px',
        }}>
          ✓ {successMsg}
        </div>
      )}

      {/* New tag form */}
      {showForm && (
        <form onSubmit={createTag}
          style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '8px', padding: '14px' }}
          className="space-y-3">
          <p style={{ color: '#6b5f54', fontSize: '0.78rem', letterSpacing: '0.06em' }}>新增標籤</p>
          <div>
            <label style={{ color: '#9a8f84', fontSize: '0.7rem', display: 'block', marginBottom: '4px' }}>標籤名稱</label>
            <input value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="例：敏感肌、固定週五、VIP…" style={iStyle} autoFocus />
          </div>
          <div>
            <label style={{ color: '#9a8f84', fontSize: '0.7rem', display: 'block', marginBottom: '6px' }}>顏色</label>
            <ColorPicker value={newColor} onChange={setNewColor} />
          </div>
          {newName && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: '#9a8f84', fontSize: '0.72rem' }}>預覽：</span>
              <span style={{
                background: newColor + '33', color: newColor,
                border: `1px solid ${newColor}88`,
                borderRadius: '12px', fontSize: '0.75rem', padding: '2px 10px', fontWeight: 500,
              }}>{newName}</span>
            </div>
          )}
          {createErr && <p style={{ color: '#9a4a4a', fontSize: '0.8rem' }}>{createErr}</p>}
          <button type="submit" disabled={creating || !newName.trim()}
            style={{
              width: '100%', background: creating || !newName.trim() ? '#c4b8aa' : '#2c2825',
              color: '#f7f4ef', border: 'none', borderRadius: '5px',
              fontSize: '0.85rem', padding: '9px', cursor: 'pointer',
            }}>
            {creating ? '建立中…' : '建立標籤'}
          </button>
        </form>
      )}

      {/* Tag list */}
      {loading ? (
        <div style={{ color: '#c4b8aa', textAlign: 'center', padding: '40px 0', fontSize: '0.85rem' }}>載入中…</div>
      ) : tags.length === 0 ? (
        <div style={{ color: '#c4b8aa', textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>🏷</div>
          <p style={{ fontSize: '0.85rem' }}>尚無標籤，點右上角新增</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p style={{ color: '#9a8f84', fontSize: '0.72rem', letterSpacing: '0.08em' }}>共 {tags.length} 個標籤</p>
          {tags.map(tag => (
            <div key={tag.id} style={{
              background: '#faf8f5', border: '1px solid #e0d9d0',
              borderRadius: '6px', padding: '12px 14px',
            }}>
              {editingId === tag.id ? (
                <div className="space-y-3">
                  <div>
                    <label style={{ color: '#9a8f84', fontSize: '0.7rem', display: 'block', marginBottom: '4px' }}>名稱</label>
                    <input value={editName} onChange={e => setEditName(e.target.value)} style={iStyle} autoFocus />
                  </div>
                  <div>
                    <label style={{ color: '#9a8f84', fontSize: '0.7rem', display: 'block', marginBottom: '6px' }}>顏色</label>
                    <ColorPicker value={editColor} onChange={setEditColor} />
                  </div>
                  {editName && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: '#9a8f84', fontSize: '0.72rem' }}>預覽：</span>
                      <span style={{
                        background: editColor + '33', color: editColor,
                        border: `1px solid ${editColor}88`,
                        borderRadius: '12px', fontSize: '0.75rem', padding: '2px 10px', fontWeight: 500,
                      }}>{editName}</span>
                    </div>
                  )}
                  {editErr && <p style={{ color: '#9a4a4a', fontSize: '0.8rem' }}>{editErr}</p>}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => saveEdit(tag.id)} disabled={saving || !editName.trim()}
                      style={{ flex: 1, background: '#2c2825', color: '#f7f4ef', border: 'none', borderRadius: '5px', fontSize: '0.82rem', padding: '7px', cursor: 'pointer' }}>
                      {saving ? '儲存中…' : '儲存'}
                    </button>
                    <button onClick={() => setEditingId(null)}
                      style={{ background: 'none', color: '#9a8f84', border: '1px solid #e0d9d0', borderRadius: '5px', fontSize: '0.82rem', padding: '7px 14px', cursor: 'pointer' }}>
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      background: tag.color + '33', color: tag.color,
                      border: `1px solid ${tag.color}88`,
                      borderRadius: '12px', fontSize: '0.82rem', padding: '3px 12px', fontWeight: 500,
                    }}>{tag.name}</span>
                    <Link href={`/clients?tag=${tag.id}`}
                      style={{ color: '#9a8f84', fontSize: '0.72rem', textDecoration: 'none' }}>
                      {tag.client_count} 位客人 →
                    </Link>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => startEdit(tag)}
                      style={{ color: '#6b5f54', fontSize: '0.72rem', background: 'none', border: '1px solid #e0d9d0', borderRadius: '4px', padding: '3px 10px', cursor: 'pointer' }}>
                      編輯
                    </button>
                    <button onClick={() => deleteTag(tag)}
                      style={{ color: '#c4a898', fontSize: '0.72rem', background: 'none', border: 'none', padding: '3px 6px', cursor: 'pointer' }}>
                      刪除
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
