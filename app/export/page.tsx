'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface DiskInfo {
  total: number; used: number; free: number; usedPct: number
  totalFmt: string; usedFmt: string; freeFmt: string
  documents: { count: number; size: number; sizeFmt: string }
}

export default function ExportPage() {
  const [jsonLoading, setJsonLoading] = useState(false)
  const [jsonDone, setJsonDone]       = useState(false)
  const [error, setError]             = useState('')
  const [disk, setDisk]               = useState<DiskInfo | null>(null)
  const [diskError, setDiskError]     = useState(false)
  const [cleaning, setCleaning]       = useState(false)
  const [cleanResult, setCleanResult] = useState<{ deleted: number; files: string[] } | null>(null)

  const loadDisk = useCallback(() => {
    fetch('/api/system/disk')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && !d.error) setDisk(d); else setDiskError(true) })
      .catch(() => setDiskError(true))
  }, [])

  useEffect(() => { loadDisk() }, [loadDisk])

  async function handleJsonDownload() {
    setJsonLoading(true)
    setJsonDone(false)
    setError('')
    try {
      const res = await fetch('/api/export')
      if (!res.ok) {
        let msg = `HTTP ${res.status}`
        try { const j = await res.json(); msg = j.error || msg } catch { /* ignore */ }
        setError(`下載失敗：${msg}`)
        return
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const utf8Match  = disposition.match(/filename\*=UTF-8''([^\s;]+)/)
      const plainMatch = disposition.match(/filename="([^"]+)"/)
      const filename   = utf8Match
        ? decodeURIComponent(utf8Match[1])
        : plainMatch?.[1] ?? 'NINI備份.json'

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
      setJsonDone(true)
    } finally {
      setJsonLoading(false)
    }
  }

  async function handleCleanup() {
    if (!confirm('確定要清除磁碟上找不到對應客人記錄的孤立檔案嗎？此操作無法復原。')) return
    setCleaning(true)
    setCleanResult(null)
    try {
      const res = await fetch('/api/system/cleanup-orphans', { method: 'POST' })
      const d = await res.json()
      setCleanResult(d)
      loadDisk() // 重新整理磁碟用量
    } catch {
      setError('清除失敗，請稍後再試')
    } finally {
      setCleaning(false)
    }
  }

  function diskColor(pct: number) {
    if (pct >= 90) return { bar: '#c0504a', text: '#9a3a3a', bg: '#fdf0f0', border: '#e8a8a8' }
    if (pct >= 70) return { bar: '#c8940a', text: '#7a5a00', bg: '#fdf8e0', border: '#e8c96a' }
    return { bar: '#9ab89e', text: '#3a7a42', bg: '#edf3eb', border: '#7ab884' }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 pt-2">
        <Link href="/" style={{ color: '#9a8f84', fontSize: '0.9rem' }}>← 總覽</Link>
        <h1 style={{ color: '#2c2825', fontSize: '1.2rem', fontWeight: 500 }}>匯出備份</h1>
      </div>

      {/* ── 磁碟使用量 ── */}
      <div style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '10px', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ color: '#6b5f54', fontSize: '0.85rem', fontWeight: 600 }}>💾 磁碟使用量</span>
          {disk && (
            <span style={{ color: '#9a8f84', fontSize: '0.75rem' }}>
              {disk.usedFmt} / {disk.totalFmt}
            </span>
          )}
        </div>

        {disk ? (() => {
          const c = diskColor(disk.usedPct)
          return (
            <>
              <div style={{ background: '#f0ebe4', borderRadius: '6px', height: '10px', overflow: 'hidden' }}>
                <div style={{
                  background: c.bar, width: `${disk.usedPct}%`,
                  height: '100%', borderRadius: '6px', transition: 'width 0.4s ease',
                }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '10px' }}>
                {[
                  { label: '已使用', value: disk.usedFmt,  sub: `${disk.usedPct}%`,      color: c.text    },
                  { label: '剩餘',   value: disk.freeFmt,  sub: `${100 - disk.usedPct}%`, color: '#4a6b52' },
                  { label: '文件',   value: `${disk.documents.count} 份`,
                    sub: disk.documents.sizeFmt,  color: '#2d4f9a' },
                ].map(({ label, value, sub, color }) => (
                  <div key={label} style={{
                    background: '#fff', border: '1px solid #e0d9d0',
                    borderRadius: '8px', padding: '10px',
                  }}>
                    <div style={{ color: '#9a8f84', fontSize: '0.65rem', marginBottom: '3px' }}>{label}</div>
                    <div style={{ color, fontSize: '0.9rem', fontWeight: 600 }}>{value}</div>
                    <div style={{ color: '#b4aa9e', fontSize: '0.65rem', marginTop: '2px' }}>{sub}</div>
                  </div>
                ))}
              </div>

              {disk.usedPct >= 80 && (
                <div style={{
                  marginTop: '10px', background: c.bg, border: `1px solid ${c.border}`,
                  borderRadius: '6px', padding: '8px 12px', color: c.text, fontSize: '0.78rem',
                }}>
                  {disk.usedPct >= 90
                    ? '⚠ 磁碟空間嚴重不足！請儘快聯絡 Railway 擴充容量。'
                    : '📢 磁碟使用率偏高，建議留意剩餘空間。'}
                </div>
              )}
            </>
          )
        })() : diskError ? (
          <div style={{ color: '#c4b8aa', fontSize: '0.8rem' }}>無法取得磁碟資訊（本機開發環境不支援）</div>
        ) : (
          <div style={{ background: '#f0ebe4', borderRadius: '6px', height: '10px' }}>
            <div style={{ background: '#c4b8aa', width: '30%', height: '100%', borderRadius: '6px' }} />
          </div>
        )}
      </div>

      {/* ── 孤立檔案清除 ── */}
      <div style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '10px', padding: '16px' }}
        className="space-y-3">
        <div>
          <p style={{ color: '#6b5f54', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>
            🗑 清除孤立文件
          </p>
          <p style={{ color: '#9a8f84', fontSize: '0.78rem' }}>
            掃描磁碟上沒有對應客人記錄的殘留檔案（例如上傳失敗後留下的），安全刪除以釋放空間。
          </p>
        </div>

        {cleanResult && (
          <div style={{
            background: cleanResult.deleted > 0 ? '#edf3eb' : '#faf8f5',
            border: `1px solid ${cleanResult.deleted > 0 ? '#9ab89e' : '#e0d9d0'}`,
            borderRadius: '6px', padding: '10px 12px',
            color: cleanResult.deleted > 0 ? '#3a7a42' : '#9a8f84', fontSize: '0.82rem',
          }}>
            {cleanResult.deleted > 0
              ? `✓ 已清除 ${cleanResult.deleted} 個孤立檔案`
              : '✓ 沒有孤立檔案，磁碟乾淨'}
          </div>
        )}

        <button
          onClick={handleCleanup}
          disabled={cleaning}
          style={{
            width: '100%', padding: '10px',
            background: cleaning ? '#c4b8aa' : '#9a6a4a',
            color: '#f7f4ef', border: 'none', borderRadius: '6px',
            fontSize: '0.85rem', cursor: cleaning ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}>
          {cleaning ? '掃描中…' : '🔍 掃描並清除孤立檔案'}
        </button>
      </div>

      {/* ── 錯誤訊息 ── */}
      {error && (
        <div style={{
          background: '#fdf0f0', border: '1px solid #e8a8a8',
          borderRadius: '6px', padding: '12px', color: '#9a4a4a', fontSize: '0.85rem',
        }}>
          {error}
        </div>
      )}

      {/* ── JSON 備份 ── */}
      <div style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '10px', padding: '16px' }}
        className="space-y-3">
        <div>
          <p style={{ color: '#6b5f54', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px' }}>
            📋 資料備份（JSON）
          </p>
          {[
            ['客人資料',    '基本資料、等級、生日、過敏 / 膚質備註、轉介來源'],
            ['標籤',        '標籤定義 + 客人標籤關聯'],
            ['套組',        '預購套組 + 核銷記錄'],
            ['結帳',        '所有結帳記錄（品項 & 付款方式已內嵌）'],
            ['金流帳本',    '儲值金、金米、購物金明細帳'],
            ['支出 & 分期', '支出記錄、分期合約 & 各期付款'],
            ['日誌追蹤',   '服務日誌、預約記錄、課後追蹤任務'],
            ['庫存',        '庫存品項 + 進出帳'],
            ['設定',        '公休日設定 + 客人文件清單 metadata'],
          ].map(([title, desc]) => (
            <div key={title} style={{ color: '#9a8f84', fontSize: '0.78rem', display: 'flex', gap: '6px', marginBottom: '3px' }}>
              <span style={{ color: '#c4b8aa', flexShrink: 0 }}>•</span>
              <span><span style={{ color: '#6b5f54', fontWeight: 500 }}>{title}：</span>{desc}</span>
            </div>
          ))}
          <p style={{ color: '#c4b8aa', fontSize: '0.72rem', marginTop: '8px' }}>
            ※ 客人上傳的文件實際檔案存於伺服器磁碟，請另行保留原始掃描檔備份。
          </p>
        </div>

        {jsonDone && (
          <div style={{ background: '#edf3eb', border: '1px solid #9ab89e', borderRadius: '6px', padding: '10px', color: '#4a6b52', fontSize: '0.82rem' }}>
            ✓ JSON 備份已下載完成
          </div>
        )}

        <button
          onClick={handleJsonDownload}
          disabled={jsonLoading}
          style={{
            width: '100%', padding: '11px',
            background: jsonLoading ? '#c4b8aa' : '#2c2825',
            color: '#f7f4ef', border: 'none', borderRadius: '6px',
            fontSize: '0.9rem', letterSpacing: '0.06em',
            cursor: jsonLoading ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}>
          {jsonLoading ? '準備中…' : '⬇ 下載資料備份 JSON'}
        </button>
      </div>

      <p style={{ color: '#c4b8aa', fontSize: '0.72rem', textAlign: 'center' }}>
        建議每週定期備份 · 檔名格式：NINI備份_YYYY-MM-DD.json
      </p>
    </div>
  )
}
