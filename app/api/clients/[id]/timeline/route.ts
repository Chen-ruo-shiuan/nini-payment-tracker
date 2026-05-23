import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()

  type Row = {
    key: string; type: string; date: string
    amount: number; title: string
    subtitle: string | null; note: string | null; detail: string | null
  }
  const entries: Row[] = []

  // ── 結帳 ─────────────────────────────────────────────────────────────────────
  const checkouts = db.prepare(`
    SELECT c.id, c.date, c.total_amount, c.note,
      (SELECT json_group_array(json_object(
         'cat',  ci.category, 'label', ci.label,
         'price', ci.price,   'qty',   ci.qty))
       FROM checkout_items ci WHERE ci.checkout_id = c.id) AS items_json,
      (SELECT json_group_array(json_object('method', cp.method, 'amount', cp.amount))
       FROM checkout_payments cp WHERE cp.checkout_id = c.id) AS pays_json
    FROM checkouts c
    WHERE c.client_id = ?
    ORDER BY c.date DESC, c.id DESC
  `).all(id) as {
    id: number; date: string; total_amount: number; note: string | null
    items_json: string; pays_json: string
  }[]

  for (const co of checkouts) {
    entries.push({
      key: `co_${co.id}`, type: 'checkout', date: co.date,
      amount: co.total_amount, title: '結帳',
      subtitle: null, note: co.note,
      detail: JSON.stringify({
        items: JSON.parse(co.items_json  || '[]'),
        pays:  JSON.parse(co.pays_json   || '[]'),
      }),
    })
  }

  // ── 套組購買 ─────────────────────────────────────────────────────────────────
  const pkgs = db.prepare(`
    SELECT id, date, service_name, total_sessions, prepaid_amount, payment_method, note
    FROM packages WHERE client_id = ?
    ORDER BY date DESC, id DESC
  `).all(id) as {
    id: number; date: string; service_name: string; total_sessions: number
    prepaid_amount: number; payment_method: string; note: string | null
  }[]

  for (const pkg of pkgs) {
    entries.push({
      key: `pkg_${pkg.id}`, type: 'package', date: pkg.date,
      amount: pkg.prepaid_amount, title: '購買套組',
      subtitle: `${pkg.service_name} × ${pkg.total_sessions} 堂`,
      note: pkg.note,
      detail: JSON.stringify({ payment_method: pkg.payment_method }),
    })
  }

  // ── 套組核銷（使用記錄）────────────────────────────────────────────────────
  const sessions = db.prepare(`
    SELECT id, date, service_name, note
    FROM sessions WHERE client_id = ?
    ORDER BY date DESC, id DESC
  `).all(id) as { id: number; date: string; service_name: string; note: string | null }[]

  for (const sess of sessions) {
    entries.push({
      key: `sess_${sess.id}`, type: 'session', date: sess.date,
      amount: 0, title: '核銷',
      subtitle: sess.service_name, note: sess.note, detail: null,
    })
  }

  // ── 分期已收 ─────────────────────────────────────────────────────────────────
  const installments = db.prepare(`
    SELECT i.id, i.paid_at AS date, i.amount, i.period_number,
           ic.note AS contract_note, ic.total_periods
    FROM installments i
    JOIN installment_contracts ic ON ic.id = i.contract_id
    WHERE i.client_id = ? AND i.paid_at IS NOT NULL
    ORDER BY i.paid_at DESC, i.id DESC
  `).all(id) as {
    id: number; date: string; amount: number
    period_number: number; contract_note: string | null; total_periods: number
  }[]

  for (const inst of installments) {
    entries.push({
      key: `inst_${inst.id}`, type: 'installment', date: inst.date,
      amount: inst.amount, title: '分期收款',
      subtitle: `第 ${inst.period_number}／${inst.total_periods} 期${inst.contract_note ? `　${inst.contract_note}` : ''}`,
      note: null, detail: null,
    })
  }

  // ── 儲值金 ───────────────────────────────────────────────────────────────────
  const svRows = db.prepare(`
    SELECT id, date, amount, note, payment_method
    FROM sv_ledger WHERE client_id = ?
    ORDER BY date DESC, id DESC
  `).all(id) as {
    id: number; date: string; amount: number
    note: string | null; payment_method: string | null
  }[]

  for (const sv of svRows) {
    entries.push({
      key: `sv_${sv.id}`, type: 'sv', date: sv.date,
      amount: sv.amount,
      title: sv.amount >= 0 ? '儲值' : '儲值扣款',
      subtitle: sv.payment_method || null,
      note: sv.note, detail: null,
    })
  }

  // ── 金米 ─────────────────────────────────────────────────────────────────────
  const ptRows = db.prepare(`
    SELECT id, date, delta, note FROM points_ledger WHERE client_id = ?
    ORDER BY date DESC, id DESC
  `).all(id) as { id: number; date: string; delta: number; note: string | null }[]

  for (const pt of ptRows) {
    entries.push({
      key: `pt_${pt.id}`, type: 'points', date: pt.date,
      amount: pt.delta,
      title: pt.delta >= 0 ? '金米累積' : '金米扣除',
      subtitle: null, note: pt.note, detail: null,
    })
  }

  // ── 購物金 ───────────────────────────────────────────────────────────────────
  const scRows = db.prepare(`
    SELECT id, date, delta, note FROM shopping_credit_ledger WHERE client_id = ?
    ORDER BY date DESC, id DESC
  `).all(id) as { id: number; date: string; delta: number; note: string | null }[]

  for (const sc of scRows) {
    entries.push({
      key: `sc_${sc.id}`, type: 'shopping_credit', date: sc.date,
      amount: sc.delta,
      title: sc.delta >= 0 ? '購物金存入' : '購物金使用',
      subtitle: null, note: sc.note, detail: null,
    })
  }

  // 按日期 desc 排序，同日按 key desc（確保 checkout 在最前）
  entries.sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date)
    return b.key.localeCompare(a.key)
  })

  return NextResponse.json(entries)
}
