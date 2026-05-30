import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// GET /api/packages?client_id=&status=active|all
export async function GET(req: NextRequest) {
  const db = getDb()
  const clientId = req.nextUrl.searchParams.get('client_id')
  const status   = req.nextUrl.searchParams.get('status') || 'active'

  let where = status === 'active' ? 'p.used_sessions < p.total_sessions' : '1=1'
  if (clientId) where += ` AND p.client_id = ${Number(clientId)}`

  const packages = db.prepare(`
    SELECT p.*, c.name AS client_name, c.level AS client_level
    FROM packages p
    JOIN clients c ON c.id = p.client_id
    WHERE ${where}
    ORDER BY p.date DESC
  `).all()

  return NextResponse.json(packages)
}

// POST /api/packages
export async function POST(req: NextRequest) {
  const db = getDb()
  const body = await req.json()
  const {
    client_id, service_name, total_sessions,
    unit_price, unit_price_orig, prepaid_amount, payment_method,
    date, note, include_in_accumulation, include_in_points,
    timing_note, bonus_desc, timing_max_weeks, bonus_active, expiry_date,
    completion_bonus_desc, completion_weeks, completion_bonus_service, completion_bonus_price,
  } = body

  if (!client_id)    return NextResponse.json({ error: '請選擇客人' }, { status: 400 })
  if (!service_name) return NextResponse.json({ error: '請輸入服務名稱' }, { status: 400 })
  if (!total_sessions || total_sessions < 1)
    return NextResponse.json({ error: '請輸入堂數' }, { status: 400 })

  const finalDate = date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
  const finalAmount = Number(prepaid_amount) || 0
  const finalMethod = payment_method || '現金'

  let pkgId: bigint | number = 0

  try { db.transaction(() => {
    const res = db.prepare(`
      INSERT INTO packages
        (client_id, service_name, total_sessions, used_sessions,
         unit_price, unit_price_orig, prepaid_amount, payment_method,
         include_in_accumulation, include_in_points, note, date,
         timing_note, bonus_desc, timing_max_weeks, bonus_active, expiry_date,
         completion_bonus_desc, completion_weeks, completion_bonus_service, completion_bonus_price)
      VALUES
        (@client_id, @service_name, @total_sessions, 0,
         @unit_price, @unit_price_orig, @prepaid_amount, @payment_method,
         @include_in_acc, @include_in_pts, @note, @date,
         @timing_note, @bonus_desc, @timing_max_weeks, @bonus_active, @expiry_date,
         @completion_bonus_desc, @completion_weeks, @completion_bonus_service, @completion_bonus_price)
    `).run({
      client_id: Number(client_id),
      service_name,
      total_sessions:  Number(total_sessions),
      unit_price:      Number(unit_price)      || 0,
      unit_price_orig: Number(unit_price_orig) || 0,
      prepaid_amount:  finalAmount,
      payment_method:  finalMethod,
      include_in_acc: include_in_accumulation ? 1 : 0,
      include_in_pts: include_in_points       ? 1 : 0,
      note:  note  || null,
      date:  finalDate,
      timing_note:      timing_note      || null,
      bonus_desc:       bonus_desc       || null,
      timing_max_weeks: timing_max_weeks ? Number(timing_max_weeks) : null,
      bonus_active:          bonus_desc ? 1 : 0,
      expiry_date:           expiry_date           || null,
      completion_bonus_desc:    completion_bonus_desc    || null,
      completion_weeks:         completion_weeks ? Number(completion_weeks) : null,
      completion_bonus_service: completion_bonus_service || null,
      completion_bonus_price:   completion_bonus_price ? Number(completion_bonus_price) : null,
    })
    pkgId = res.lastInsertRowid

    // 若以儲值金付款，自動扣除儲值金餘額
    if (finalMethod === '儲值金' && finalAmount > 0) {
      db.prepare(`
        INSERT INTO sv_ledger (client_id, amount, paid_amount, note, date, payment_method, include_in_accumulation)
        VALUES (?, ?, NULL, ?, ?, NULL, 0)
      `).run(
        Number(client_id),
        -finalAmount,
        `套組扣款：${service_name}`,
        finalDate,
      )
    }
  })() } catch (err) {
    console.error('[Package POST Error]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }

  return NextResponse.json({ id: pkgId }, { status: 201 })
}
