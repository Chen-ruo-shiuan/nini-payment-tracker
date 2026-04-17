import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// ─── PATCH /api/checkouts/[id] ───────────────────────────────────────────────
// Reverses old side effects, applies new ones, updates the record in one tx.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = getDb()

  const checkout = db.prepare('SELECT * FROM checkouts WHERE id = ?').get(id) as {
    id: number; client_id: number | null; date: string
  } | undefined
  if (!checkout) return NextResponse.json({ error: '找不到結帳記錄' }, { status: 404 })

  const oldItems = db.prepare('SELECT * FROM checkout_items WHERE checkout_id = ?').all(id) as {
    category: string; qty: number; pkg_id: number | null
  }[]
  const oldPayments = db.prepare('SELECT * FROM checkout_payments WHERE checkout_id = ?').all(id) as {
    method: string; amount: number
  }[]

  const body = await req.json()
  const {
    date, note,
    items,    // { category, label, price, qty, pkg_id? }[]
    payments, // { method, amount }[]
    incl_course, incl_product,
  } = body

  if (!items?.length)    return NextResponse.json({ error: '請新增消費品項' }, { status: 400 })
  if (!payments?.length) return NextResponse.json({ error: '請新增付款方式' }, { status: 400 })

  const totalAmount = (items as { price: number; qty: number }[])
    .reduce((s, i) => s + i.price * i.qty, 0)

  const run = db.transaction(() => {
    // ── 1. Reverse old side effects ────────────────────────────────────────────
    // Restore package sessions
    for (const item of oldItems) {
      if (item.category === '商品券' && item.pkg_id) {
        db.prepare('UPDATE packages SET used_sessions = MAX(0, used_sessions - ?) WHERE id = ?')
          .run(item.qty, item.pkg_id)
      }
    }
    // Remove old sv_ledger entries
    if (checkout.client_id) {
      for (const pay of oldPayments) {
        if (pay.method === '儲值金') {
          db.prepare(`DELETE FROM sv_ledger WHERE client_id = ? AND note = ? AND date = ? AND amount = ?`)
            .run(checkout.client_id, `結帳 #${id} 儲值金消費`, checkout.date, -pay.amount)
        }
      }
    }

    // ── 2. Update checkout record ─────────────────────────────────────────────
    db.prepare(`
      UPDATE checkouts SET
        date = ?, note = ?, total_amount = ?,
        incl_course = ?, incl_product = ?
      WHERE id = ?
    `).run(
      date || checkout.date,
      note || null,
      totalAmount,
      incl_course ? 1 : 0,
      incl_product ? 1 : 0,
      Number(id)
    )

    // ── 3. Replace items ──────────────────────────────────────────────────────
    db.prepare('DELETE FROM checkout_items WHERE checkout_id = ?').run(id)
    for (const item of items as { category: string; label: string; price: number; qty: number; pkg_id?: number }[]) {
      db.prepare(`
        INSERT INTO checkout_items (checkout_id, category, label, price, qty, pkg_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(Number(id), item.category, item.label, item.price, item.qty, item.pkg_id ?? null)

      if (item.category === '商品券' && item.pkg_id) {
        db.prepare('UPDATE packages SET used_sessions = used_sessions + ? WHERE id = ?')
          .run(item.qty, item.pkg_id)
      }
    }

    // ── 4. Replace payments ───────────────────────────────────────────────────
    const newDate = date || checkout.date
    db.prepare('DELETE FROM checkout_payments WHERE checkout_id = ?').run(id)
    for (const pay of payments as { method: string; amount: number }[]) {
      db.prepare(`INSERT INTO checkout_payments (checkout_id, method, amount) VALUES (?, ?, ?)`)
        .run(Number(id), pay.method, pay.amount)

      if (pay.method === '儲值金' && checkout.client_id) {
        db.prepare(`INSERT INTO sv_ledger (client_id, amount, note, date) VALUES (?, ?, ?, ?)`)
          .run(checkout.client_id, -pay.amount, `結帳 #${id} 儲值金消費`, newDate)
      }
    }
  })

  run()
  return NextResponse.json({ success: true })
}

// ─── DELETE /api/checkouts/[id] ──────────────────────────────────────────────
// Reverses: package used_sessions, sv_ledger entries for 儲值金 payments
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = getDb()

  const checkout = db.prepare('SELECT * FROM checkouts WHERE id = ?').get(id) as {
    id: number; client_id: number | null; date: string
  } | undefined

  if (!checkout) return NextResponse.json({ error: '找不到結帳記錄' }, { status: 404 })

  const items = db.prepare('SELECT * FROM checkout_items WHERE checkout_id = ?').all(id) as {
    category: string; qty: number; pkg_id: number | null
  }[]

  const payments = db.prepare('SELECT * FROM checkout_payments WHERE checkout_id = ?').all(id) as {
    method: string; amount: number
  }[]

  const run = db.transaction(() => {
    for (const item of items) {
      if (item.category === '商品券' && item.pkg_id) {
        db.prepare('UPDATE packages SET used_sessions = MAX(0, used_sessions - ?) WHERE id = ?')
          .run(item.qty, item.pkg_id)
      }
    }

    if (checkout.client_id) {
      for (const pay of payments) {
        if (pay.method === '儲值金') {
          db.prepare(`DELETE FROM sv_ledger WHERE client_id = ? AND note = ? AND date = ? AND amount = ?`)
            .run(checkout.client_id, `結帳 #${id} 儲值金消費`, checkout.date, -pay.amount)
        }
      }
    }

    db.prepare('DELETE FROM checkouts WHERE id = ?').run(id)
  })

  run()
  return NextResponse.json({ success: true })
}
