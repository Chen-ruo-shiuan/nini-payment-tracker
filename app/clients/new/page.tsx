'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MEMBERSHIP_LEVELS } from '@/types'

export default function NewClientPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [duplicateWarning, setDuplicateWarning] = useState(false)
  const [form, setForm] = useState({
    name: '',
    phone: '',
    note: '',
    level: '癒米',
    level_since: '',
    birthday: '',
  })

  const set = (k: string, v: string) => {
    setForm(prev => ({ ...prev, [k]: v }))
    if (k === 'name') setDuplicateWarning(false)
  }

  async function submit() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || '發生錯誤'); return }
      router.push(`/clients/${data.id}`)
    } catch {
      setError('網路錯誤，請重試')
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('請輸入姓名'); return }

    // Check for duplicate name (only if warning not already shown)
    if (!duplicateWarning) {
      const res = await fetch(`/api/clients?q=${encodeURIComponent(form.name.trim())}`)
      const existing = await res.json() as { name: string }[]
      const exactMatch = existing.some(c => c.name === form.name.trim())
      if (exactMatch) {
        setDuplicateWarning(true)
        return
      }
    }

    await submit()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 pt-2">
        <Link href="/clients" style={{ color: '#9a8f84', fontSize: '0.9rem' }}>← 客人</Link>
        <h1 style={{ color: '#2c2825', fontSize: '1.2rem', fontWeight: 500 }}>新增客人</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="姓名 *">
          <input value={form.name} onChange={e => set('name', e.target.value)}
            placeholder="客人姓名" {...inputProps} />
        </Field>

        <Field label="電話">
          <input value={form.phone} onChange={e => set('phone', e.target.value)}
            placeholder="09xx-xxx-xxx" type="tel" {...inputProps} />
        </Field>

        <Field label="會員等級">
          <select value={form.level} onChange={e => set('level', e.target.value)} {...inputProps}>
            {MEMBERSHIP_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </Field>

        <Field label="升等日期">
          <input value={form.level_since} onChange={e => set('level_since', e.target.value)}
            type="date" {...inputProps} />
        </Field>

        <Field label="生日（月-日）">
          <input value={form.birthday} onChange={e => set('birthday', e.target.value)}
            type="text" placeholder="03-15" pattern="\d{2}-\d{2}" maxLength={5} {...inputProps} />
        </Field>

        <Field label="備註">
          <textarea value={form.note} onChange={e => set('note', e.target.value)}
            placeholder="備註（選填）" rows={3}
            style={{ ...inputStyle, resize: 'none' }} />
        </Field>

        {/* Duplicate name warning */}
        {duplicateWarning && (
          <div style={{ background: '#fdf5e0', border: '1px solid #e0c055', borderRadius: '6px', padding: '12px 14px' }}>
            <p style={{ color: '#7a5a00', fontSize: '0.85rem', marginBottom: '10px' }}>
              已有一筆「{form.name}」的客人資料，是否仍要新增？
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={submit} disabled={saving}
                style={{ background: '#2c2825', color: '#f7f4ef', border: 'none', borderRadius: '5px', fontSize: '0.82rem', padding: '6px 16px', cursor: 'pointer' }}>
                {saving ? '建立中…' : '仍要新增'}
              </button>
              <button type="button" onClick={() => setDuplicateWarning(false)}
                style={{ background: 'none', color: '#6b5f54', border: '1px solid #e0d9d0', borderRadius: '5px', fontSize: '0.82rem', padding: '6px 16px', cursor: 'pointer' }}>
                取消
              </button>
            </div>
          </div>
        )}

        {error && (
          <p style={{ color: '#9a4a4a', fontSize: '0.85rem', background: '#fdf0f0', border: '1px solid #e8a8a8', borderRadius: '5px' }}
            className="px-3 py-2">
            {error}
          </p>
        )}

        {!duplicateWarning && (
          <button type="submit" disabled={saving}
            style={{
              width: '100%', background: saving ? '#c4b8aa' : '#2c2825',
              color: '#f7f4ef', border: 'none', borderRadius: '6px',
              fontSize: '0.95rem', letterSpacing: '0.06em', padding: '12px',
              cursor: saving ? 'not-allowed' : 'pointer',
            }}>
            {saving ? '儲存中…' : '建立客人'}
          </button>
        )}
      </form>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#faf8f5', border: '1px solid #e0d9d0',
  borderRadius: '6px', color: '#2c2825', fontSize: '0.9rem',
  outline: 'none', padding: '10px 14px',
}
const inputProps = { style: inputStyle }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label style={{ color: '#6b5f54', fontSize: '0.78rem', letterSpacing: '0.06em' }}>
        {label}
      </label>
      {children}
    </div>
  )
}
