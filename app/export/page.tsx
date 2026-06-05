'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

interface DiskInfo {
  total: number; used: number; free: number; usedPct: number
  totalFmt: string; usedFmt: string; freeFmt: string
  documents: { count: number; size: number; sizeFmt: string }
}

export default function ExportPage() {
  const [jsonLoading, setJsonLoading]   = useState(false)
  const [jsonDone, setJsonDone]         = useState(false)
  const [zipLoading, setZipLoading]     = useState(false)
  const [zipDone, setZipDone]           = useState(false)
  const [error, setError]               = useState('')
  const [disk, setDisk]                 = useState<DiskInfo | null>(null)
  const [diskError, setDiskError]       = useState(false)

  useEffect(() => {
    fetch('/api/system/disk')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && !d.error) setDisk(d); else setDiskError(true) })
      .catch(() => setDiskError(true))
  }, [])

  async function handleDownload(
    url: string,
    setLoading: (v: boolean) => void,
    setDone: (v: boolean) => void,
    fallbackFilename: string
  ) {
    setLoading(true)
    setDone(false)
    setError('')
    try {
      const res = await fetch(url)
      if (!res.ok) {
        let msg = `HTTP ${res.status}`
        try { const j = await res.json(); msg = j.error || msg } catch { /* ignore */ }
        setError(`下載失敗：${msg}`)
        return
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') ?? ''
      // try UTF-8 encoded filename first, then quoted fallback
      const utf8Match  = disposition.match(/filename\*=UTF-8''([^\s;]+)/)
      const plainMatch = disposition.match(/filename="([^"]+)"/)
      const filename   = utf8Match
        ? decodeURIComponent(utf8Match[1])
        : plainMatch?.[1] ?? fallbackFilename

      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = filename
      a.click()
      URL.revokeObjectURL(objectUrl)
      setDone(true)
    } finally {
      setLoading(false)
    }
  }

  // ── 磁碟使用量顏色 ────────────────────────────────────────────────
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
              {/* 進度條 */}
              <div style={{ background: '#f0ebe4', borderRadius: '6px', height: '10px', overflow: 'hidden' }}>
                <div style={{
                  background: c.bar,
                  width: `${disk.usedPct}%`,
                  height: '100%', borderRadius: '6px',
                  transition: 'width 0.4s ease',
                }} />
              </div>

              {/* 數字行 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '10px' }}>
                {[
                  { label: '已使用', value: disk.usedFmt,  sub: `${disk.usedPct}%`,           color: c.text  },
                  { label: '剩餘',   value: disk.freeFmt,  sub: `${100 - disk.usedPct}%`,      color: '#4a6b52' },
                  { label: '文件',   value: `${disk.documents.count} 份`,
                    sub: disk.documents.sizeFmt, color: '#2d4f9a' },
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
                  marginTop: '10px', background: diskColor(disk.usedPct).bg,
                  border: `1px solid ${diskColor(disk.usedPct).border}`,
                  borderRadius: '6px', padding: '8px 12px',
                  color: diskColor(disk.usedPct).text, fontSize: '0.78rem',
                }}>
                  {disk.usedPct >= 90
                    ? '⚠ 磁碟空間嚴重不足！請儘快聯絡 Railway 擴充容量。'
                    : '📢 磁碟使用率偏高，建議留意剩餘空間。'}
                </div>
              )}
            </>
          )
        })() : diskError ? (
          <div style={{ color: '#c4b8aa', fontSize: '0.8rem' }}>
            無法取得磁碟資訊（本機開發環境不支援）
          </div>
        ) : (
          <div style={{ background: '#f0ebe4', borderRadius: '6px', height: '10px' }}>
            <div style={{ background: '#c4b8aa', width: '30%', height: '100%', borderRadius: '6px', animation: 'pulse 1.5s infinite' }} />
          </div>
        )}
      </div>

      {/* ── 錯誤訊息 ── */}
      {error && (
        <div style={{
          background: '#fdf0f0', border: '1px solid #e8a8a8',
          borderRadius: '6px', padding: '12px',
          color: '#9a4a4a', fontSize: '0.85rem',
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
            ['客人資料',  '基本資料、等級、生日、過敏 / 膚質備註、轉介來源'],
            ['標籤',      '標籤定義 + 客人標籤關聯'],
            ['套組',      '預購套組 + 核銷記錄'],
            ['結帳',      '所有結帳記錄（品項 & 付款方式已內嵌）'],
            ['金流帳本',  '儲值金、金米、購物金明細帳'],
            ['支出 & 分期', '支出記錄、分期合約 & 各期付款'],
            ['日誌追蹤',  '服務日誌、預約記錄、課後追蹤任務'],
            ['庫存',      '庫存品項 + 進出帳'],
            ['設定',      '公休日設定 + 客人文件清單 metadata'],
          ].map(([title, desc]) => (
            <div key={title} style={{ color: '#9a8f84', fontSize: '0.78rem', display: 'flex', gap: '6px', marginBottom: '3px' }}>
              <span style={{ color: '#c4b8aa', flexShrink: 0 }}>•</span>
              <span><span style={{ color: '#6b5f54', fontWeight: 500 }}>{title}：</span>{desc}</span>
            </div>
          ))}
        </div>

        {jsonDone && (
          <div style={{ background: '#edf3eb', border: '1px solid #9ab89e', borderRadius: '6px', padding: '10px', color: '#4a6b52', fontSize: '0.82rem' }}>
            ✓ JSON 備份已下載完成
          </div>
        )}

        <button
          onClick={() => handleDownload('/api/export', setJsonLoading, setJsonDone, 'NINI備份.json')}
          disabled={jsonLoading}
          style={{
            width: '100%',
            background: jsonLoading ? '#c4b8aa' : '#2c2825',
            color: '#f7f4ef', border: 'none', borderRadius: '6px',
            fontSize: '0.9rem', letterSpacing: '0.06em', padding: '11px',
            cursor: jsonLoading ? 'not-allowed' : 'pointer',
          }}>
          {jsonLoading ? '準備中…' : '⬇ 下載資料備份 JSON'}
        </button>
      </div>

      {/* ── 文件 ZIP 備份 ── */}
      <div style={{ background: '#faf8f5', border: '1px solid #e0d9d0', borderRadius: '10px', padding: '16px' }}
        className="space-y-3">
        <div>
          <p style={{ color: '#6b5f54', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
            📁 文件備份（ZIP）
          </p>
          <p style={{ color: '#9a8f84', fontSize: '0.78rem' }}>
            打包 Railway 磁碟上所有客人上傳的文件（同意書、圖片等），
            下載後為 <code style={{ background: '#f0ebe4', borderRadius: '3px', padding: '1px 5px' }}>.zip</code> 壓縮檔。
          </p>
          {disk && (
            <p style={{ color: '#b4aa9e', fontSize: '0.72rem', marginTop: '5px' }}>
              目前共 {disk.documents.count} 份文件，總大小 {disk.documents.sizeFmt}
            </p>
          )}
        </div>

        {zipDone && (
          <div style={{ background: '#edf3eb', border: '1px solid #9ab89e', borderRadius: '6px', padding: '10px', color: '#4a6b52', fontSize: '0.82rem' }}>
            ✓ 文件備份已下載完成
          </div>
        )}

        <button
          onClick={() => handleDownload('/api/export/documents', setZipLoading, setZipDone, 'NINI文件備份.zip')}
          disabled={zipLoading || (disk !== null && disk.documents.count === 0)}
          style={{
            width: '100%',
            background: zipLoading || (disk !== null && disk.documents.count === 0) ? '#c4b8aa' : '#4a6b52',
            color: '#f7f4ef', border: 'none', borderRadius: '6px',
            fontSize: '0.9rem', letterSpacing: '0.06em', padding: '11px',
            cursor: zipLoading || (disk !== null && disk.documents.count === 0) ? 'not-allowed' : 'pointer',
          }}>
          {zipLoading
            ? '打包中…（文件較多時需稍等）'
            : disk?.documents.count === 0
            ? '目前沒有上傳文件'
            : '⬇ 下載文件備份 ZIP'}
        </button>
      </div>

      <p style={{ color: '#c4b8aa', fontSize: '0.72rem', textAlign: 'center' }}>
        建議每週備份一次，JSON + ZIP 一起下載才算完整備份
      </p>
    </div>
  )
}
