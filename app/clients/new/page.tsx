'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MEMBERSHIP_LEVELS } from '@/types'

export default function NewClientPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    phone: '',
    note: '',
    level: '甜癒米',
    level_since: '',
    birthday: '',
  })

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('請輸入姓名'); return }
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

        <Field label="生日">
          <input value={form.birthday} onChange={e => set('birthday', e.target.value)}
            type="date" {...inputProps} />
        </Field>

        <Field label="備註">
          <textarea value={form.note} onChange={e => set('note', e.target.value)}
            placeholder="備註（選填）" rows={3}
            style={{ ...inputStyle, resize: 'none' }} />
        </Field>

        {error && (
          <p style={{ color: '#9a4a4a', fontSize: '0.85rem', background: '#fdf0f0', border: '1px solid #e8a8a8', borderRadius: '5px' }}
            className="px-3 py-2">
            {error}
          </p>
        )}

        <button type="submit" disabled={saving}
          style={{
            width: '100%', background: saving ? '#c4b8aa' : '#2c2825',
            color: '#f7f4ef', border: 'none', borderRadius: '6px',
            fontSize: '0.95rem', letterSpacing: '0.06em', padding: '12px',
            cursor: saving ? 'not-allowed' : 'pointer',
          }}>
          {saving ? '儲存中…' : '建立客人'}
        </button>
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
