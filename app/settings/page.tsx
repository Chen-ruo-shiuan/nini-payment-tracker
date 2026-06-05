'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRole } from '@/components/RoleProvider'
import { useRouter } from 'next/navigation'

interface User {
  id: number
  username: string
  role: string
  display_name: string | null
  active: number
  created_at: string
}

const card: React.CSSProperties = {
  background: '#faf8f5', border: '1px solid #e0d9d0',
  borderRadius: '12px', padding: '20px', marginBottom: '16px',
}
const label: React.CSSProperties = {
  fontSize: '0.75rem', color: '#706c68', display: 'block', marginBottom: '5px',
}
const input: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid #ddd8d0',
  borderRadius: '8px', fontSize: '0.875rem', background: '#fff',
  color: '#2c2825', outline: 'none', boxSizing: 'border-box',
  fontFamily: 'inherit',
}
const btn = (variant: 'primary' | 'danger' | 'ghost' = 'primary'): React.CSSProperties => ({
  padding: '8px 16px', border: 'none', borderRadius: '8px',
  fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
  background: variant === 'primary' ? '#2c2825' : variant === 'danger' ? '#c0504a' : '#e8e3dc',
  color: variant === 'ghost' ? '#5c5752' : '#f7f4ef',
})

export default function SettingsPage() {
  const { role } = useRole()
  const router   = useRouter()

  const [users, setUsers]         = useState<User[]>([])
  const [loading, setLoading]     = useState(true)
  const [editId, setEditId]       = useState<number | null>(null)
  const [editName, setEditName]   = useState('')
  const [editPw, setEditPw]       = useState('')
  const [newUser, setNewUser]     = useState({ username: '', password: '', display_name: '' })
  const [msg, setMsg]             = useState('')
  const [saving, setSaving]       = useState(false)

  // Redirect non-owners
  useEffect(() => {
    if (role !== null && role !== 'owner') {
      router.replace('/')
    }
  }, [role, router])

  const loadUsers = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/auth/users')
    if (res.ok) setUsers(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  function flash(text: string) {
    setMsg(text)
    setTimeout(() => setMsg(''), 3000)
  }

  function startEdit(u: User) {
    setEditId(u.id)
    setEditName(u.display_name || '')
    setEditPw('')
  }

  async function saveEdit(id: number) {
    setSaving(true)
    const body: Record<string, unknown> = { display_name: editName }
    if (editPw) body.password = editPw
    const res = await fetch(`/api/auth/users/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (res.ok) {
      setEditId(null)
      flash('已儲存')
      loadUsers()
    } else {
      const d = await res.json()
      flash(d.error || '儲存失敗')
    }
  }

  async function toggleActive(u: User) {
    const res = await fetch(`/api/auth/users/${u.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: u.active ? 0 : 1 }),
    })
    if (res.ok) { flash(u.active ? '已停用' : '已啟用'); loadUsers() }
    else { const d = await res.json(); flash(d.error || '操作失敗') }
  }

  async function createUser() {
    if (!newUser.username || !newUser.password) return
    setSaving(true)
    const res = await fetch('/api/auth/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newUser, role: 'staff' }),
    })
    setSaving(false)
    if (res.ok) {
      setNewUser({ username: '', password: '', display_name: '' })
      flash('員工帳號已建立')
      loadUsers()
    } else {
      const d = await res.json()
      flash(d.error || '建立失敗')
    }
  }

  if (role === null) return null // waiting for auth check

  return (
    <div>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#2c2825', marginBottom: '20px', marginTop: '8px' }}>
        ⚙️ 帳號管理
      </h2>

      {msg && (
        <div style={{
          background: '#eaf4ea', border: '1px solid #a8d4a8', borderRadius: '8px',
          padding: '10px 14px', fontSize: '0.8rem', color: '#3a6e3a', marginBottom: '16px',
        }}>
          {msg}
        </div>
      )}

      {/* Existing users */}
      <div style={card}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#4a403a', marginBottom: '14px' }}>
          使用者列表
        </div>
        {loading ? (
          <div style={{ color: '#9a8f84', fontSize: '0.8rem' }}>載入中…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {users.map(u => (
              <div key={u.id} style={{
                border: '1px solid #e0d9d0', borderRadius: '10px', padding: '14px',
                background: u.active ? '#fff' : '#f5f0eb', opacity: u.active ? 1 : 0.7,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: editId === u.id ? '12px' : 0 }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#2c2825' }}>
                      {u.display_name || u.username}
                    </span>
                    <span style={{ marginLeft: '8px', fontSize: '0.7rem', color: '#9a8f84' }}>@{u.username}</span>
                    <span style={{
                      marginLeft: '8px', fontSize: '0.65rem', padding: '2px 7px',
                      borderRadius: '10px', background: u.role === 'owner' ? '#2c2825' : '#e8e3dc',
                      color: u.role === 'owner' ? '#f7f4ef' : '#5c5752',
                    }}>
                      {u.role === 'owner' ? '老闆' : '員工'}
                    </span>
                    {!u.active && (
                      <span style={{ marginLeft: '6px', fontSize: '0.65rem', color: '#c0504a' }}>已停用</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {editId !== u.id && (
                      <button style={btn('ghost')} onClick={() => startEdit(u)}>編輯</button>
                    )}
                    {u.username !== 'owner' && (
                      <button style={btn(u.active ? 'danger' : 'primary')} onClick={() => toggleActive(u)}>
                        {u.active ? '停用' : '啟用'}
                      </button>
                    )}
                  </div>
                </div>

                {editId === u.id && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <label style={label}>顯示名稱</label>
                      <input style={input} value={editName} onChange={e => setEditName(e.target.value)}
                        placeholder={u.username} />
                    </div>
                    <div>
                      <label style={label}>新密碼（留空不修改）</label>
                      <input style={input} type="password" value={editPw} onChange={e => setEditPw(e.target.value)}
                        placeholder="輸入新密碼" autoComplete="new-password" />
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button style={btn('primary')} onClick={() => saveEdit(u.id)} disabled={saving}>
                        {saving ? '儲存中…' : '儲存'}
                      </button>
                      <button style={btn('ghost')} onClick={() => setEditId(null)}>取消</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create new staff */}
      <div style={card}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#4a403a', marginBottom: '14px' }}>
          新增員工帳號
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <label style={label}>帳號 *</label>
            <input style={input} value={newUser.username}
              onChange={e => setNewUser(p => ({ ...p, username: e.target.value }))}
              placeholder="英文 / 數字" autoComplete="off" />
          </div>
          <div>
            <label style={label}>密碼 *</label>
            <input style={input} type="password" value={newUser.password}
              onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))}
              placeholder="請設定密碼" autoComplete="new-password" />
          </div>
          <div>
            <label style={label}>顯示名稱（選填）</label>
            <input style={input} value={newUser.display_name}
              onChange={e => setNewUser(p => ({ ...p, display_name: e.target.value }))}
              placeholder="例如：小美" />
          </div>
          <button
            style={{ ...btn('primary'), width: '100%', padding: '11px' }}
            onClick={createUser}
            disabled={saving || !newUser.username || !newUser.password}
          >
            {saving ? '建立中…' : '建立帳號'}
          </button>
        </div>
      </div>
    </div>
  )
}
