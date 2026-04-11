'use client'
import { useState } from 'react'
import Link from 'next/link'

interface ImportStats {
  clients: number
  sv: number
  packages: number
  checkouts: number
  expenses: number
  skipped: number
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportStats | null>(null)
  const [error, setError] = useState('')

  async function handleImport() {
    if (!file) return
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const text = await file.text()
      const json = JSON.parse(text)

      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '匯入失敗')
      } else {
        setResult(data.stats)
      }
    } catch (e) {
      setError(`錯誤：${e}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 pt-2">
        <Link href="/" style={{ color: '#9a8f84', fontSize: '0.9rem' }}>← 總覽</Link>
        <h1 style={{ color: '#2c2825', fontSize: '1.2rem', fontWeight: 500 }}>匯入舊系統資料</h1>
      </div>

      {/* 說明 */}
      <div style={{
        background: '#faf8f5', border: '1px solid #e0d9d0',
        borderRadius: '6px', padding: '16px',
      }} className="space-y-2">
        <p style={{ color: '#6b5f54', fontSize: '0.85rem', fontWeight: 500 }}>匯入內容</p>
        {[
          '客人基本資料（姓名、等級、生日、備註）',
          '儲值金初始餘額',
          '套組記錄（含已核銷次數，從結帳記錄計算）',
          '結帳記錄（含品項與付款方式）',
          '支出記錄',
        ].map(item => (
          <div key={item} style={{ color: '#9a8f84', fontSize: '0.8rem', display: 'flex', gap: '6px' }}>
            <span>•</span><span>{item}</span>
          </div>
        ))}
        <p style={{ color: '#c4b8aa', fontSize: '0.75rem', marginTop: '8px' }}>
          ※ 重複匯入安全：已存在的資料會自動略過，不會重複建立
        </p>
      </div>

      {/* 檔案選擇 */}
      <div className="space-y-3">
        <label style={{ color: '#6b5f54', fontSize: '0.78rem', letterSpacing: '0.06em' }}>
          選擇 JSON 備份檔案
        </label>
        <div style={{
          border: '2px dashed #e0d9d0', borderRadius: '8px',
          padding: '30px', textAlign: 'center', cursor: 'pointer',
          background: file ? '#f5f2ee' : '#faf8f5',
        }}
          onClick={() => document.getElementById('file-input')?.click()}>
          <input id="file-input" type="file" accept=".json"
            style={{ display: 'none' }}
            onChange={e => setFile(e.target.files?.[0] ?? null)} />
          {file ? (
            <div>
              <div style={{ color: '#4a6b52', fontSize: '0.9rem', fontWeight: 500 }}>✓ {file.name}</div>
              <div style={{ color: '#9a8f84', fontSize: '0.75rem', marginTop: '4px' }}>
                {(file.size / 1024).toFixed(1)} KB
              </div>
            </div>
          ) : (
            <div>
              <div style={{ color: '#c4b8aa', fontSize: '1.5rem', marginBottom: '8px' }}>⊕</div>
              <div style={{ color: '#9a8f84', fontSize: '0.85rem' }}>點此選擇 JSON 檔案</div>
              <div style={{ color: '#c4b8aa', fontSize: '0.75rem', marginTop: '4px' }}>
                格式：NINI備份_YYYY-MM-DD.json
              </div>
            </div>
          )}
        </div>
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

      {result && (
        <div style={{
          background: '#edf3eb', border: '1px solid #9ab89e',
          borderRadius: '6px', padding: '16px',
        }} className="space-y-2">
          <p style={{ color: '#4a6b52', fontSize: '0.9rem', fontWeight: 500 }}>✓ 匯入完成</p>
          {[
            { label: '客人', value: result.clients },
            { label: '儲值金記錄', value: result.sv },
            { label: '套組', value: result.packages },
            { label: '結帳記錄', value: result.checkouts },
            { label: '支出記錄', value: result.expenses },
            { label: '略過（已存在）', value: result.skipped },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: '#6b5f54' }}>{label}</span>
              <span style={{ color: '#2c2825', fontWeight: 500 }}>{value} 筆</span>
            </div>
          ))}
          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #9ab89e' }}>
            <Link href="/clients"
              style={{
                display: 'inline-block', background: '#2c2825', color: '#f7f4ef',
                borderRadius: '5px', fontSize: '0.85rem', padding: '8px 20px',
                textDecoration: 'none',
              }}>
              前往客人列表 →
            </Link>
          </div>
        </div>
      )}

      <button
        onClick={handleImport}
        disabled={!file || loading}
        style={{
          width: '100%',
          background: !file || loading ? '#c4b8aa' : '#2c2825',
          color: '#f7f4ef', border: 'none', borderRadius: '6px',
          fontSize: '0.95rem', letterSpacing: '0.06em', padding: '12px',
          cursor: !file || loading ? 'not-allowed' : 'pointer',
        }}>
        {loading ? '匯入中，請稍候…' : '開始匯入'}
      </button>
    </div>
  )
}
