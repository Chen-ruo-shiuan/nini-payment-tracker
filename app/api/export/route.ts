import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// GET /api/export  → 下載完整資料備份（JSON）
export async function GET() {
  try {
    const db = getDb()

    // ── 客人核心 ──────────────────────────────────────────────────────
    const clients       = db.prepare(`SELECT * FROM clients ORDER BY id`).all()
    const tags          = db.prepare(`SELECT * FROM tags ORDER BY id`).all()
    const clientTags    = db.prepare(`SELECT * FROM client_tags ORDER BY client_id, tag_id`).all()

    // ── 套組 & 核銷 ────────────────────────────────────────────────────
    const packages      = db.prepare(`SELECT * FROM packages ORDER BY id`).all()
    const sessions      = db.prepare(`SELECT * FROM sessions ORDER BY id`).all()

    // ── 結帳 ──────────────────────────────────────────────────────────
    const checkouts     = db.prepare(`SELECT * FROM checkouts ORDER BY id`).all()
    const checkoutItems = db.prepare(`SELECT * FROM checkout_items ORDER BY id`).all()
    const checkoutPays  = db.prepare(`SELECT * FROM checkout_payments ORDER BY id`).all()

    // 整合 checkout_items / checkout_payments 到 checkouts 內（方便閱讀）
    const coMap = new Map<number, { items: unknown[]; payments: unknown[] }>()
    for (const co of checkouts as { id: number }[]) {
      coMap.set(co.id, { items: [], payments: [] })
    }
    for (const item of checkoutItems as { checkout_id: number }[]) {
      coMap.get(item.checkout_id)?.items.push(item)
    }
    for (const pay of checkoutPays as { checkout_id: number }[]) {
      coMap.get(pay.checkout_id)?.payments.push(pay)
    }
    const checkoutsWithDetail = (checkouts as { id: number }[]).map(co => ({
      ...co,
      items:    coMap.get(co.id)?.items    ?? [],
      payments: coMap.get(co.id)?.payments ?? [],
    }))

    // ── 金流帳本 ──────────────────────────────────────────────────────
    const svLedger              = db.prepare(`SELECT * FROM sv_ledger ORDER BY id`).all()
    const pointsLedger          = db.prepare(`SELECT * FROM points_ledger ORDER BY id`).all()
    const shoppingCreditLedger  = db.prepare(`SELECT * FROM shopping_credit_ledger ORDER BY id`).all()

    // ── 支出 & 分期 ────────────────────────────────────────────────────
    const expenses              = db.prepare(`SELECT * FROM expenses ORDER BY id`).all()
    const installmentContracts  = db.prepare(`SELECT * FROM installment_contracts ORDER BY id`).all()
    const installments          = db.prepare(`SELECT * FROM installments ORDER BY id`).all()

    // ── 日誌 & 預約 ────────────────────────────────────────────────────
    const serviceLogs           = db.prepare(`SELECT * FROM service_logs ORDER BY id`).all()
    const appointmentLogs       = db.prepare(`SELECT * FROM appointment_logs ORDER BY id`).all()
    const followUpTasks         = db.prepare(`SELECT * FROM follow_up_tasks ORDER BY id`).all()
    const productUsageLogs      = db.prepare(`SELECT * FROM product_usage_logs ORDER BY id`).all()

    // ── 庫存 ──────────────────────────────────────────────────────────
    const inventoryItems        = db.prepare(`SELECT * FROM inventory_items ORDER BY id`).all()
    const inventoryLedger       = db.prepare(`SELECT * FROM inventory_ledger ORDER BY id`).all()

    // ── 其他設定 ──────────────────────────────────────────────────────
    const closedDays            = db.prepare(`SELECT * FROM closed_days ORDER BY date`).all()
    // 文件清單只備份 metadata（實際檔案存於磁碟，不含在 JSON 中）
    const clientDocuments       = db.prepare(`SELECT * FROM client_documents ORDER BY id`).all()

    const now = new Date().toLocaleDateString('zh-TW', {
      timeZone: 'Asia/Taipei',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).replace(/\//g, '-')

    const payload = {
      exportedAt:   new Date().toISOString(),
      exportedDate: now,
      version:      3,

      // ── 客人核心
      clients,
      tags,
      client_tags: clientTags,

      // ── 套組
      packages,
      sessions,

      // ── 結帳（品項 & 付款方式已內嵌）
      checkouts: checkoutsWithDetail,

      // ── 金流帳本
      sv_ledger:              svLedger,
      points_ledger:          pointsLedger,
      shopping_credit_ledger: shoppingCreditLedger,

      // ── 支出 & 分期
      expenses,
      installment_contracts: installmentContracts,
      installments,

      // ── 日誌 & 追蹤
      service_logs:        serviceLogs,
      appointment_logs:    appointmentLogs,
      follow_up_tasks:     followUpTasks,
      product_usage_logs:  productUsageLogs,

      // ── 庫存
      inventory_items:  inventoryItems,
      inventory_ledger: inventoryLedger,

      // ── 設定
      closed_days:      closedDays,
      // 注意：client_documents 只含 metadata，實際檔案需另行備份 /data/documents/ 資料夾
      client_documents: clientDocuments,
    }

    const filename = `NINI備份_${now}.json`
    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    })
  } catch (err) {
    console.error('[Export Error]', err)
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    )
  }
}
