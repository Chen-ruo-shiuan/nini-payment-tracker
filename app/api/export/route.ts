import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// GET /api/export  → 下載完整資料備份（JSON）
export async function GET() {
  const db = getDb()

  const clients = db.prepare(`SELECT * FROM clients ORDER BY id`).all()
  const svLedger = db.prepare(`SELECT * FROM sv_ledger ORDER BY id`).all()
  const pointsLedger = db.prepare(`SELECT * FROM points_ledger ORDER BY id`).all()
  const packages = db.prepare(`SELECT * FROM packages ORDER BY id`).all()
  const checkouts = db.prepare(`SELECT * FROM checkouts ORDER BY id`).all()
  const checkoutItems = db.prepare(`SELECT * FROM checkout_items ORDER BY id`).all()
  const checkoutPayments = db.prepare(`SELECT * FROM checkout_payments ORDER BY id`).all()
  const expenses = db.prepare(`SELECT * FROM expenses ORDER BY id`).all()
  const installmentContracts = db.prepare(`SELECT * FROM installment_contracts ORDER BY id`).all()
  const installments = db.prepare(`SELECT * FROM installments ORDER BY id`).all()

  // 整合 checkout_items / checkout_payments 到 checkouts 內（方便閱讀）
  const coMap = new Map<number, { items: unknown[]; payments: unknown[] }>()
  for (const co of checkouts as { id: number }[]) {
    coMap.set(co.id, { items: [], payments: [] })
  }
  for (const item of checkoutItems as { checkout_id: number }[]) {
    coMap.get(item.checkout_id)?.items.push(item)
  }
  for (const pay of checkoutPayments as { checkout_id: number }[]) {
    coMap.get(pay.checkout_id)?.payments.push(pay)
  }
  const checkoutsWithDetail = (checkouts as { id: number }[]).map(co => ({
    ...co,
    items: coMap.get(co.id)?.items ?? [],
    payments: coMap.get(co.id)?.payments ?? [],
  }))

  const now = new Date().toLocaleDateString('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).replace(/\//g, '-')

  const payload = {
    exportedAt: new Date().toISOString(),
    exportedDate: now,
    version: 2,
    clients,
    sv_ledger: svLedger,
    points_ledger: pointsLedger,
    packages,
    checkouts: checkoutsWithDetail,
    expenses,
    installment_contracts: installmentContracts,
    installments,
  }

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="NINI備份_${now}.json"`,
    },
  })
}
