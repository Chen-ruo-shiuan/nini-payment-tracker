'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function ExportPage() {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function handleExport() {
    setLoading(true)
    setDone(false)
    setError('')
    try {
      const res = await fetch('/api/export')
      if (!res.ok) {
        let msg = `HTTP ${res.status}`
        try { const j = await res.json(); msg = j.error || msg } catch { /* ignore */ }
        setError(`匯出失敗：${msg}`)
        return
      }

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
        <p style={{ color: '#6b5f54', fontSize: '0.85rem', fontWeight: 500 }}>備份內容（v3）</p>
        {[
          ['客人資料', '基本資料、等級、生日、過敏 / 膚質備註、轉介來源'],
          ['標籤',     '標籤定義 + 客人標籤關聯'],
          ['套組',     '預購套組 + 核銷記錄（sessions）'],
          ['結帳',     '所有結帳記錄（品項 & 付款方式已內嵌）'],
          ['金流帳本', '儲值金、金米、購物金明細帳'],
          ['支出',     '支出記錄'],
          ['分期',     '分期合約 + 各期付款'],
          ['日誌追蹤', '服務日誌、預約記錄、課後追蹤任務'],
          ['產品',     '產品使用紀錄（product_usage_logs）'],
          ['庫存',     '庫存品項 + 進出帳（inventory_items / inventory_ledger）'],
          ['設定',     '公休日設定 + 客人文件清單（metadata）'],
        ].map(([title, desc]) => (
          <div key={title} style={{ color: '#9a8f84', fontSize: '0.8rem', display: 'flex', gap: '6px' }}>
            <span style={{ color: '#c4b8aa', flexShrink: 0 }}>•</span>
            <span><span style={{ color: '#6b5f54', fontWeight: 500 }}>{title}：</span>{desc}</span>
          </div>
        ))}
        <p style={{ color: '#c4b8aa', fontSize: '0.72rem', marginTop: '10px' }}>
          ※ 格式：JSON。客人上傳的文件實際檔案存於伺服器磁碟，JSON 內只含清單 metadata，
          如需完整備份請另行下載 <code>/data/documents/</code> 資料夾。
        </p>
      </div>

      {error && (
        <div style={{
          background: '#fdf0f0', border: '1px solid #e8a8a8',
          borderRadius: '6px', padding: '12px',
          color: '#9a4a4a', fontSize: '0.85rem',
        }}>
          {error}
        </div>
      )}

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
