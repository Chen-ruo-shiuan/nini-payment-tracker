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

  const existing = db.prepare('SELECT * FROM packages WHERE id = ?').get(id) as {
    id: number; client_id: number; service_name: string; total_sessions: number; used_sessions: number;
    unit_price: number; unit_price_orig: number; prepaid_amount: number; payment_method: string;
    date: string; note: string | null; include_in_accumulation: number; include_in_points: number;
    timing_note: string | null; bonus_desc: string | null; timing_max_weeks: number | null;
    bonus_active: number; extension_count: number; expiry_date: string | null; opened_date: string | null;
    completion_bonus_desc: string | null; completion_weeks: number | null;
    completion_bonus_service: string | null; completion_bonus_price: number | null; completion_claimed: number; legacy_id: string | null;
  } | undefined
  if (!existing) return NextResponse.json({ error: '找不到套組' }, { status: 404 })

  const body = await req.json()

  // Only override fields that are explicitly included in the body — prevents
  // partial saves (e.g. editing only incentive fields) from zeroing out other columns.
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k)

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
      include_in_points       = @include_in_points,
      timing_note             = @timing_note,
      bonus_desc              = @bonus_desc,
      timing_max_weeks        = @timing_max_weeks,
      bonus_active            = @bonus_active,
      extension_count         = @extension_count,
      expiry_date             = @expiry_date,
      opened_date             = @opened_date,
      completion_bonus_desc    = @completion_bonus_desc,
      completion_weeks         = @completion_weeks,
      completion_bonus_service = @completion_bonus_service,
      completion_bonus_price   = @completion_bonus_price
    WHERE id = @id
  `).run({
    id: Number(id),
    service_name:            has('service_name')            ? (body.service_name ?? '')        : existing.service_name,
    total_sessions:          has('total_sessions')          ? (Number(body.total_sessions) || 0) : existing.total_sessions,
    used_sessions:           has('used_sessions')           ? (Number(body.used_sessions)  || 0) : existing.used_sessions,
    unit_price:              has('unit_price')              ? (Number(body.unit_price)       || 0) : existing.unit_price,
    unit_price_orig:         has('unit_price_orig')         ? (Number(body.unit_price_orig)  || 0) : existing.unit_price_orig,
    prepaid_amount:          has('prepaid_amount')          ? (Number(body.prepaid_amount)   || 0) : existing.prepaid_amount,
    payment_method:          has('payment_method')          ? (body.payment_method || '現金')  : existing.payment_method,
    date:                    has('date')                    ? (body.date || '')                : existing.date,
    note:                    has('note')                    ? (body.note || null)              : existing.note,
    include_in_accumulation: has('include_in_accumulation') ? (body.include_in_accumulation ? 1 : 0) : existing.include_in_accumulation,
    include_in_points:       has('include_in_points')       ? (body.include_in_points       ? 1 : 0) : existing.include_in_points,
    timing_note:             has('timing_note')             ? (body.timing_note || null)      : existing.timing_note,
    bonus_desc:              has('bonus_desc')              ? (body.bonus_desc || null)        : existing.bonus_desc,
    timing_max_weeks:        has('timing_max_weeks')        ? (body.timing_max_weeks ? Number(body.timing_max_weeks) : null) : existing.timing_max_weeks,
    bonus_active:            has('bonus_active')            ? (body.bonus_active ? 1 : 0)     : existing.bonus_active,
    extension_count:         has('extension_count')         ? (Number(body.extension_count) || 0) : existing.extension_count,
    expiry_date:             has('expiry_date')             ? (body.expiry_date || null)       : existing.expiry_date,
    opened_date:             has('opened_date')             ? (body.opened_date || null)       : existing.opened_date,
    completion_bonus_desc:    has('completion_bonus_desc')    ? (body.completion_bonus_desc || null)    : existing.completion_bonus_desc,
    completion_weeks:         has('completion_weeks')         ? (body.completion_weeks ? Number(body.completion_weeks) : null) : existing.completion_weeks,
    completion_bonus_service: has('completion_bonus_service') ? (body.completion_bonus_service || null)  : existing.completion_bonus_service,
    completion_bonus_price:   has('completion_bonus_price')   ? (body.completion_bonus_price ? Number(body.completion_bonus_price) : null) : existing.completion_bonus_price,
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

  const pkg = db.prepare('SELECT id, client_id, service_name, payment_method, include_in_points, points_earned FROM packages WHERE id = ?').get(id) as {
    id: number; client_id: number; service_name: string; payment_method: string;
    include_in_points: number; points_earned: number
  } | undefined
  if (!pkg) return NextResponse.json({ error: '找不到套組' }, { status: 404 })

  db.transaction(() => {
    // 還原金米點數
    if (pkg.include_in_points && (pkg.points_earned ?? 0) > 0) {
      db.prepare(`UPDATE clients SET points = MAX(0, points - ?), updated_at = datetime('now') WHERE id = ?`)
        .run(pkg.points_earned, pkg.client_id)
    }
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
