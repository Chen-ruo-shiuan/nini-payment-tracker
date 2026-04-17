import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// DELETE /api/checkouts/[id]
// Reverses: package used_sessions, sv_ledger entries for 儲值金 payments
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = getDb()

  const checkout = db.prepare('SELECT * FROM checkouts WHERE id = ?').get(id) as {
    id: number; client_id: number | null; date: string; note: string | null;
    total_amount: number; incl_points: number; incl_yodomo: number
  } | undefined

  if (!checkout) return NextResponse.json({ error: '找不到結帳記錄' }, { status: 404 })

  const items = db.prepare('SELECT * FROM checkout_items WHERE checkout_id = ?').all(id) as {
    id: number; category: string; label: string; price: number; qty: number; pkg_id: number | null
  }[]

  const payments = db.prepare('SELECT * FROM checkout_payments WHERE checkout_id = ?').all(id) as {
    id: number; method: string; amount: number
  }[]

  const run = db.transaction(() => {
    // 1. Reverse package session deductions
    for (const item of items) {
      if (item.category === '商品券' && item.pkg_id) {
        db.prepare('UPDATE packages SET used_sessions = MAX(0, used_sessions - ?) WHERE id = ?')
          .run(item.qty, item.pkg_id)
      }
    }

    // 2. Reverse sv_ledger entries for 儲值金 payments
    if (checkout.client_id) {
      for (const pay of payments) {
        if (pay.method === '儲值金') {
          db.prepare(`
            DELETE FROM sv_ledger
            WHERE client_id = ? AND note = ? AND date = ? AND amount = ?
          `).run(checkout.client_id, `結帳 #${id} 儲值金消費`, checkout.date, -pay.amount)
        }
      }
    }

    // 3. Delete checkout record (CASCADE deletes checkout_items and checkout_payments)
    db.prepare('DELETE FROM checkouts WHERE id = ?').run(id)
  })

  run()
  return NextResponse.json({ success: true })
}
