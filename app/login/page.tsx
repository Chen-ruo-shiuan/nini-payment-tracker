'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get('from') || '/'

  const [pw, setPw]         = useState('')
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      })
      if (res.ok) {
        router.replace(from)
        router.refresh()
      } else {
        setError('密碼錯誤，請再試一次')
        setPw('')
      }
    } catch {
      setError('網路錯誤，請稍後再試')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f0ebe4', fontFamily: 'system-ui,"PingFang TC","Microsoft JhengHei",sans-serif',
    }}>
      <div style={{
        background: '#faf8f5', borderRadius: '14px', padding: '40px 36px',
        width: '320px', boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
        border: '1px solid #e0d9d0',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#2c2825', letterSpacing: '0.04em' }}>
            NINIの皮膚療癒所
          </div>
          <div style={{ fontSize: '0.8rem', color: '#9a8f84', marginTop: '6px' }}>
            管理系統
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '0.8rem', color: '#706c68', display: 'block', marginBottom: '6px' }}>
              密碼
            </label>
            <input
              type="password"
              value={pw}
              onChange={e => setPw(e.target.value)}
              placeholder="請輸入密碼"
              autoFocus
              autoComplete="current-password"
              style={{
                width: '100%', padding: '10px 12px',
                border: `1px solid ${error ? '#c0504a' : '#ddd8d0'}`,
                borderRadius: '8px', fontSize: '0.9rem', background: '#fff',
                color: '#2c2825', outline: 'none', boxSizing: 'border-box',
              }}
            />
            {error && (
              <div style={{ fontSize: '0.75rem', color: '#c0504a', marginTop: '6px' }}>{error}</div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !pw}
            style={{
              width: '100%', padding: '11px',
              background: loading || !pw ? '#b5b0a8' : '#2c2825',
              color: '#f7f4ef', border: 'none', borderRadius: '8px', fontSize: '0.9rem',
              fontWeight: '500', cursor: loading || !pw ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', letterSpacing: '0.04em',
            }}
          >
            {loading ? '驗證中…' : '進入系統'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: '#c4b8aa', fontSize: '0.68rem', marginTop: '20px' }}>
          此系統僅供授權人員使用
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
