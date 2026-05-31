'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { MEMBERSHIP_LEVELS } from '@/types'
import ClientTagsSection from '@/components/ClientTagsSection'

export default function EditClientPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '', phone: '', note: '', level: '癒米', level_since: '', birthday: '',
    allergy_note: '', medical_note: '', skin_note: '',
  })

  useEffect(() => {
    fetch(`/api/clients/${id}`)
      .then(r => r.json())
      .then(data => {
        setForm({
          name: data.name || '',
          phone: data.phone || '',
          note: data.note || '',
          level: data.level || '癒米',
          level_since: data.level_since || '',
          birthday: data.birthday || '',
          allergy_note: data.allergy_note || '',
          medical_note: data.medical_note || '',
          skin_note: data.skin_note || '',
        })
        setLoading(false)
      })
  }, [id])

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('請輸入姓名'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || '發生錯誤'); return }
      router.push(`/clients/${id}`)
    } catch {
      setError('網路錯誤，請重試')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div style={{ color: '#c4b8aa', textAlign: 'center', padding: '60px 0' }}>載入中…</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 pt-2">
        <Link href={`/clients/${id}`} style={{ color: '#9a8f84', fontSize: '0.9rem' }}>← 返回</Link>
        <h1 style={{ color: '#2c2825', fontSize: '1.2rem', fontWeight: 500 }}>編輯客人</h1>
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
            placeholder="備註（選填）" rows={2}
            style={{ ...inputStyle, resize: 'none' }} />
        </Field>

        {/* ── 健康注意事項 ── */}
        <div style={{ borderTop: '1px solid #e0d9d0', paddingTop: '16px' }}>
          <p style={{ color: '#9a6a2a', fontSize: '0.75rem', letterSpacing: '0.06em', marginBottom: '12px' }}>
            ⚠ 健康注意事項
          </p>
          <div className="space-y-4">
            <Field label="過敏成分 / 物質">
              <textarea value={form.allergy_note} onChange={e => set('allergy_note', e.target.value)}
                placeholder="例：對水楊酸過敏、對香精過敏、對蝦蟹過敏…"
                rows={2} style={{ ...inputStyle, resize: 'none' }} />
            </Field>
            <Field label="特殊健康狀況（懷孕、疾病、長期藥物）">
              <textarea value={form.medical_note} onChange={e => set('medical_note', e.target.value)}
                placeholder="例：懷孕中、有甲狀腺亢進、長期服用抗凝血藥物…"
                rows={2} style={{ ...inputStyle, resize: 'none' }} />
            </Field>
            <Field label="皮膚特殊注意事項">
              <textarea value={form.skin_note} onChange={e => set('skin_note', e.target.value)}
                placeholder="例：有雷射術後修護需避開特定步驟、右臉有傷口…"
                rows={2} style={{ ...inputStyle, resize: 'none' }} />
            </Field>
          </div>
        </div>

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
          {saving ? '儲存中…' : '儲存變更'}
        </button>
      </form>

      {/* 標籤獨立於 form 之外，避免 nested form 衝突 */}
      <ClientTagsSection clientId={id} />
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
