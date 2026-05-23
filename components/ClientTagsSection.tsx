'use client'
import { useState, useEffect } from 'react'

interface Tag { id: number; name: string; color: string }

const TAG_COLORS = [
  '#9ab89e', '#c0a88a', '#8ab0c8', '#c4a8d8',
  '#e0a8a8', '#a8c4b0', '#d4b840', '#a89890',
  '#d49870', '#8ab8b0', '#e0b890', '#b8a0c0',
]

export default function ClientTagsSection({ clientId }: { clientId: string | number }) {
  const [clientTags, setClientTags] = useState<Tag[]>([])
  const [allTags, setAllTags]       = useState<Tag[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [newName, setNewName]       = useState('')
  const [newColor, setNewColor]     = useState(TAG_COLORS[0])
  const [creating, setCreating]     = useState(false)

  function loadClientTags() {
    fetch(`/api/clients/${clientId}/tags`).then(r => r.json()).then(setClientTags)
  }
  function loadAllTags() {
    fetch('/api/tags').then(r => r.json()).then(setAllTags)
  }
  useEffect(() => { loadClientTags(); loadAllTags() }, [clientId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function addTag(tagId: number) {
    await fetch(`/api/clients/${clientId}/tags`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_id: tagId }),
    })
    loadClientTags()
    setShowPicker(false)
  }

  async function removeTag(tagId: number) {
    await fetch(`/api/clients/${clientId}/tags/${tagId}`, { method: 'DELETE' })
    loadClientTags()
  }

  async function createAndAdd() {
    if (!newName.trim()) return
    setCreating(true)
    const res = await fetch('/api/tags', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), color: newColor }),
    })
    if (res.ok) {
      const { id } = await res.json()
      await fetch(`/api/clients/${clientId}/tags`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag_id: id }),
      })
      loadClientTags()
      loadAllTags()
    }
    setCreating(false)
    setNewName(''); setNewColor(TAG_COLORS[0])
    setShowPicker(false)
  }

  const unattached = allTags.filter(t => !clientTags.some(ct => ct.id === t.id))

  return (
    <div className="space-y-1.5">
      <label style={{ color: '#6b5f54', fontSize: '0.78rem', letterSpacing: '0.06em' }}>標籤</label>

      {/* Current tags + add button */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', minHeight: '32px' }}>
        {clientTags.length === 0 && !showPicker && (
          <span style={{ color: '#c4b8aa', fontSize: '0.78rem' }}>尚無標籤</span>
        )}
        {clientTags.map(tag => (
          <span key={tag.id} style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            background: tag.color + '28', color: tag.color,
            border: `1px solid ${tag.color}70`,
            borderRadius: '12px', fontSize: '0.78rem', padding: '3px 8px 3px 11px',
            fontWeight: 500,
          }}>
            {tag.name}
            <button onClick={() => removeTag(tag.id)} title="移除"
              style={{ background: 'none', border: 'none', color: tag.color, cursor: 'pointer', fontSize: '0.85rem', lineHeight: 1, padding: '0 2px', opacity: 0.7 }}>
              ✕
            </button>
          </span>
        ))}
        <button onClick={() => setShowPicker(v => !v)}
          style={{
            background: showPicker ? '#f0ebe4' : 'none',
            border: '1px dashed #c4b8aa', borderRadius: '12px',
            color: '#9a8f84', fontSize: '0.75rem', padding: '3px 12px', cursor: 'pointer',
          }}>
          ＋ 新增標籤
        </button>
      </div>

      {/* Picker panel */}
      {showPicker && (
        <div style={{
          background: '#fdf9f5', border: '1px solid #e0d9d0', borderRadius: '8px',
          padding: '12px', marginTop: '4px',
        }}>
          {/* Existing unattached tags */}
          {unattached.length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              <p style={{ color: '#9a8f84', fontSize: '0.68rem', letterSpacing: '0.06em', marginBottom: '6px' }}>選擇已有標籤</p>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {unattached.map(tag => (
                  <button key={tag.id} onClick={() => addTag(tag.id)}
                    style={{
                      background: tag.color + '28', color: tag.color,
                      border: `1px solid ${tag.color}70`,
                      borderRadius: '12px', fontSize: '0.78rem', padding: '3px 12px',
                      cursor: 'pointer', fontWeight: 500,
                    }}>
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Divider */}
          {unattached.length > 0 && (
            <div style={{ borderTop: '1px solid #e8e2db', margin: '10px 0' }} />
          )}

          {/* Create new tag inline */}
          <p style={{ color: '#9a8f84', fontSize: '0.68rem', letterSpacing: '0.06em', marginBottom: '6px' }}>建立新標籤</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input
              value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="標籤名稱…"
              style={{
                background: '#fff', border: '1px solid #e0d9d0', borderRadius: '6px',
                color: '#2c2825', fontSize: '0.85rem', outline: 'none', padding: '7px 12px',
              }}
              autoFocus
            />
            {/* Color swatches */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {TAG_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setNewColor(c)}
                  style={{
                    width: '22px', height: '22px', borderRadius: '50%', background: c,
                    border: newColor === c ? '3px solid #2c2825' : '2px solid transparent',
                    cursor: 'pointer', flexShrink: 0, outline: 'none',
                  }} />
              ))}
            </div>
            {/* Preview */}
            {newName.trim() && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#9a8f84', fontSize: '0.68rem' }}>預覽：</span>
                <span style={{
                  background: newColor + '33', color: newColor,
                  border: `1px solid ${newColor}88`,
                  borderRadius: '12px', fontSize: '0.75rem', padding: '2px 10px', fontWeight: 500,
                }}>{newName}</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                disabled={creating || !newName.trim()}
                onClick={createAndAdd}
                style={{
                  flex: 1, background: creating || !newName.trim() ? '#c4b8aa' : '#2c2825',
                  color: '#f7f4ef', border: 'none', borderRadius: '5px',
                  fontSize: '0.8rem', padding: '7px', cursor: 'pointer',
                }}>
                {creating ? '建立中…' : '建立並新增'}
              </button>
              <button type="button" onClick={() => { setShowPicker(false); setNewName('') }}
                style={{
                  background: 'none', border: '1px solid #e0d9d0', borderRadius: '5px',
                  color: '#9a8f84', fontSize: '0.8rem', padding: '7px 14px', cursor: 'pointer',
                }}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
