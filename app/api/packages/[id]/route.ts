import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// PATCH /api/packages/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = getDb()

  const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(id) as {
    id: number; client_id: number
  } | undefined
  if (!pkg) return NextResponse.json({ error: '找不到套組' }, { status: 404 })

  const body = await req.json()
  const {
    service_name, total_sessions, used_sessions,
    unit_price, unit_price_orig, prepaid_amount, payment_method,
    date, note,
    include_in_accumulation, include_in_points,
  } = body

  db.prepare(`
    UPDATE packages SET
      service_name            = @service_name,
      total_sessions          = @total_sessions,
      used_sessions           = @used_sessions,
      unit_price              = @unit_price,
      unit_price_orig         = @unit_price_orig,
      prepaid_amount          = @prepaid_amount,
      payment_method          = @payment_method,
      date                    = @date,
      note                    = @note,
      include_in_accumulation = @include_in_accumulation,
      include_in_points       = @include_in_points
    WHERE id = @id
  `).run({
    id: Number(id),
    service_name:            service_name ?? '',
    total_sessions:          Number(total_sessions)   || 0,
    used_sessions:           Number(used_sessions)    || 0,
    unit_price:              Number(unit_price)        || 0,
    unit_price_orig:         Number(unit_price_orig)   || 0,
    prepaid_amount:          Number(prepaid_amount)    || 0,
    payment_method:          payment_method || '現金',
    date:                    date || '',
    note:                    note || null,
    include_in_accumulation: include_in_accumulation ? 1 : 0,
    include_in_points:       include_in_points        ? 1 : 0,
  })

  return NextResponse.json({ success: true })
}

// DELETE /api/packages/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = getDb()

  const pkg = db.prepare('SELECT id, client_id, service_name, payment_method FROM packages WHERE id = ?').get(id) as {
    id: number; client_id: number; service_name: string; payment_method: string
  } | undefined
  if (!pkg) return NextResponse.json({ error: '找不到套組' }, { status: 404 })

  db.transaction(() => {
    // Delete any linked installment contracts (when payment_method was 分期)
    if (pkg.payment_method === '分期') {
      const contracts = db.prepare(
        `SELECT id FROM installment_contracts WHERE client_id = ? AND note LIKE ?`
      ).all(pkg.client_id, `套組：${pkg.service_name}%`) as { id: number }[]
      for (const c of contracts) {
        db.prepare('DELETE FROM installment_contracts WHERE id = ?').run(c.id)
      }
    }
    // Delete package (FK: checkout_items.pkg_id → SET NULL, sessions.package_id → SET NULL)
    db.prepare('DELETE FROM packages WHERE id = ?').run(id)
  })()

  return NextResponse.json({ success: true })
}
