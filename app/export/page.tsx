'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function ExportPage() {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleExport() {
    setLoading(true)
    setDone(false)
    try {
      const res = await fetch('/api/export')
      if (!res.ok) { alert('匯出失敗，請稍後再試'); return }

      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const match = disposition.match(/filename="([^"]+)"/)
      const filename = match?.[1] ?? 'NINI備份.json'

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      setDone(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 pt-2">
        <Link href="/" style={{ color: '#9a8f84', fontSize: '0.9rem' }}>← 總覽</Link>
        <h1 style={{ color: '#2c2825', fontSize: '1.2rem', fontWeight: 500 }}>匯出備份</h1>
      </div>

      {/* 說明 */}
      <div style={{
        background: '#faf8f5', border: '1px solid #e0d9d0',
        borderRadius: '6px', padding: '16px',
      }} className="space-y-2">
        <p style={{ color: '#6b5f54', fontSize: '0.85rem', fontWeight: 500 }}>備份內容</p>
        {[
          '所有客人資料（等級、生日、備註）',
          '儲值金明細帳（sv_ledger）',
          '金米明細帳（points_ledger）',
          '預購套組記錄',
          '所有結帳記錄（含品項與付款方式）',
          '支出記錄',
          '分期合約與各期付款',
        ].map(item => (
          <div key={item} style={{ color: '#9a8f84', fontSize: '0.8rem', display: 'flex', gap: '6px' }}>
            <span>•</span><span>{item}</span>
          </div>
        ))}
        <p style={{ color: '#c4b8aa', fontSize: '0.75rem', marginTop: '8px' }}>
          ※ 檔案格式：JSON，可作為資料備份或轉移使用
        </p>
      </div>

      {done && (
        <div style={{
          background: '#edf3eb', border: '1px solid #9ab89e',
          borderRadius: '6px', padding: '12px',
          color: '#4a6b52', fontSize: '0.85rem',
        }}>
          ✓ 備份已下載完成
        </div>
      )}

      <button
        onClick={handleExport}
        disabled={loading}
        style={{
          width: '100%',
          background: loading ? '#c4b8aa' : '#2c2825',
          color: '#f7f4ef', border: 'none', borderRadius: '6px',
          fontSize: '0.95rem', letterSpacing: '0.06em', padding: '12px',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}>
        {loading ? '準備中…' : '⬇ 下載備份 JSON'}
      </button>

      <p style={{ color: '#c4b8aa', fontSize: '0.75rem', textAlign: 'center' }}>
        建議定期備份，檔名格式：NINI備份_YYYY-MM-DD.json
      </p>
    </div>
  )
}
