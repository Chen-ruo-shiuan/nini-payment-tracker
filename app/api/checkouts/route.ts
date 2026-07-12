import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { LEVEL_POINTS, YODOMO_THRESHOLD } from '@/types'

export const runtime = 'nodejs'

// GET /api/checkouts?client_id=&date=YYYY-MM-DD&limit=20
export async function GET(req: NextRequest) {
  const db = getDb()
  const clientId  = req.nextUrl.searchParams.get('client_id')
  const date      = req.nextUrl.searchParams.get('date')
  const month     = req.nextUrl.searchParams.get('month')   // YYYY-MM
  const searchId  = req.nextUrl.searchParams.get('id')      // single checkout id
  const limit     = Number(req.nextUrl.searchParams.get('limit') || '20')

  const conditions: string[] = []
  const binds: (string | number)[] = []

  if (clientId) { conditions.push('co.client_id = ?');       binds.push(clientId) }
  if (date)     { conditions.push('co.date = ?');             binds.push(date) }
  if (month)    { conditions.push("co.date LIKE ?");          binds.push(month + '-%') }
  if (searchId) { conditions.push('co.id = ?');               binds.push(Number(searchId)) }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  binds.push(limit)

  const checkouts = db.prepare(`
    SELECT co.*, c.name AS client_name
    FROM checkouts co LEFT JOIN clients c ON c.id = co.client_id
    ${where}
    ORDER BY co.created_at DESC LIMIT ?
  `).all(...binds)

  for (const co of checkouts as { id: number; items?: unknown[]; payments?: unknown[] }[]) {
    co.items = db.prepare(`
      SELECT ci.*, p.bonus_desc, p.timing_note, p.bonus_active
      FROM checkout_items ci
      LEFT JOIN packages p ON p.id = ci.pkg_id
      WHERE ci.checkout_id = ?
    `).all(co.id)
    co.payments = db.prepare('SELECT * FROM checkout_payments WHERE checkout_id = ?').all(co.id)
  }
  return NextResponse.json(checkouts)
}

// POST /api/checkouts
export async function POST(req: NextRequest) {
  const db = getDb()
  const body = await req.json()
  const {
    client_id, date, note,
    items,          // { category, label, price, qty, pkg_id? }[]
    payments,       // { method, amount }[]
    incl_course, incl_product, incl_yodomo, incl_points,
  } = body

  if (!items?.length)    return NextResponse.json({ error: '請新增消費品項' }, { status: 400 })
  if (!payments?.length) return NextResponse.json({ error: '請新增付款方式' }, { status: 400 })

  const createdBy = req.headers.get('x-username') || null

  // totalAmount = 實收金額（已扣除品項折扣）
  const totalAmount = (items as { price: number; qty: number; discount?: number }[])
    .reduce((s, i) => s + i.price * i.qty - (i.discount ?? 0), 0)

  const run = db.transaction(() => {
    // ── 1. Insert checkout ───────────────────────────────────────────────────
    const coRes = db.prepare(`
      INSERT INTO checkouts (client_id, date, note, total_amount, incl_course, incl_product, incl_yodomo, incl_points, points_earned, yodomo_earned, created_by)
      VALUES (@client_id, @date, @note, @total_amount, @incl_course, @incl_product, @incl_yodomo, @incl_points, 0, 0, @created_by)
    `).run({
      client_id: client_id ?? null,
      date: date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' }),
      note: note || null,
      total_amount: totalAmount,
      incl_course:  incl_course  ? 1 : 0,
      incl_product: incl_product ? 1 : 0,
      incl_yodomo:  incl_yodomo  ? 1 : 0,
      incl_points:  incl_points  ? 1 : 0,
      created_by:   createdBy,
    })
    const coId = Number(coRes.lastInsertRowid)

    // ── 2. Items ─────────────────────────────────────────────────────────────
    for (const item of items as { category: string; label: string; price: number; qty: number; pkg_id?: number; discount?: number }[]) {
      db.prepare(`
        INSERT INTO checkout_items (checkout_id, category, label, price, qty, pkg_id, discount)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(coId, item.category, item.label, item.price, item.qty, item.pkg_id ?? null, item.discount ?? 0)

      // 商品券: increment used_sessions，並在首次使用時設定開封日
      if (item.category === '商品券' && item.pkg_id) {
        const pkgRow = db.prepare('SELECT used_sessions, opened_date FROM packages WHERE id = ?')
          .get(item.pkg_id) as { used_sessions: number; opened_date: string | null } | undefined
        const coDate = date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
        const newOpened = pkgRow?.opened_date || coDate
        db.prepare(`UPDATE packages SET used_sessions = used_sessions + ?, opened_date = COALESCE(opened_date, ?) WHERE id = ?`)
          .run(item.qty, newOpened, item.pkg_id)
      }
    }

    // ── 3. Payments ──────────────────────────────────────────────────────────
    let pointsEarned = 0
    let yodomoEarned = 0
    for (const pay of payments as { method: string; amount: number }[]) {
      db.prepare(`
        INSERT INTO checkout_payments (checkout_id, method, amount) VALUES (?, ?, ?)
      `).run(coId, pay.method, pay.amount)

      // 儲值金 → deduct sv_ledger
      if (pay.method === '儲值金' && client_id) {
        db.prepare(`
          INSERT INTO sv_ledger (client_id, amount, note, date)
          VALUES (?, ?, ?, ?)
        `).run(
          client_id, -pay.amount, `結帳 #${coId} 儲值金消費`,
          date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
        )
      }

      // 購物金 → deduct shopping_credit_ledger
      if (pay.method === '購物金' && client_id) {
        const coDate = date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
        db.prepare(`
          INSERT INTO shopping_credit_ledger (client_id, delta, note, date)
          VALUES (?, ?, ?, ?)
        `).run(client_id, -pay.amount, `結帳 #${coId} 購物金抵扣`, coDate)
        // 重新計算餘額
        const { total } = db.prepare(
          `SELECT COALESCE(SUM(delta), 0) AS total FROM shopping_credit_ledger WHERE client_id = ?`
        ).get(client_id) as { total: number }
        db.prepare(`UPDATE clients SET shopping_credit = ?, updated_at = datetime('now') WHERE id = ?`)
          .run(total, client_id)
      }
    }

    // ── 4. Points & Yodomo earned ────────────────────────────────────────────
    if (client_id && (incl_points || incl_yodomo)) {
      const client = db.prepare('SELECT level, points, yodomo_card_points, yodomo_total_cards FROM clients WHERE id = ?')
        .get(client_id) as { level: string; points: number; yodomo_card_points: number; yodomo_total_cards: number } | undefined

      if (client) {
        // Qualifying amount
        const qualifyingAmount =
          (items as { category: string; price: number; qty: number }[])
            .filter(i => {
              if (['服務', '加購', '活動'].includes(i.category)) return incl_course
              if (i.category === '產品') return incl_product
              return false
            })
            .reduce((s, i) => s + i.price * i.qty, 0)

        if (incl_points && qualifyingAmount > 0) {
          const rate = LEVEL_POINTS[client.level as keyof typeof LEVEL_POINTS] ?? 0
          pointsEarned = Math.floor(qualifyingAmount / 1000) * rate
          if (pointsEarned > 0) {
            db.prepare(`UPDATE clients SET points = points + ?, updated_at = datetime('now') WHERE id = ?`)
              .run(pointsEarned, client_id)
          }
        }

        if (incl_yodomo && qualifyingAmount > 0) {
          yodomoEarned = Math.floor(qualifyingAmount / YODOMO_THRESHOLD)
          if (yodomoEarned > 0) {
            db.prepare(`UPDATE clients SET yodomo_card_points = yodomo_card_points + ?, updated_at = datetime('now') WHERE id = ?`)
              .run(yodomoEarned, client_id)
          }
        }

        // 回寫到 checkouts，方便刪除時正確扣回
        if (pointsEarned > 0 || yodomoEarned > 0) {
          db.prepare(`UPDATE checkouts SET points_earned = ?, yodomo_earned = ? WHERE id = ?`)
            .run(pointsEarned, yodomoEarned, coId)
        }
      }
    }

    // ── 5. 自動課後追蹤（結帳後 +2 天）────────────────────────────────────────
    if (client_id) {
      const coDate = date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
      const due = new Date(coDate + 'T00:00:00')
      due.setDate(due.getDate() + 2)
      const dueStr = due.toLocaleDateString('en-CA')
      db.prepare(`
        INSERT INTO follow_up_tasks (client_id, checkout_id, due_date, note)
        VALUES (?, ?, ?, ?)
      `).run(client_id, coId, dueStr, `結帳後 2 天追蹤`)
    }

    // ── 6. 自動寫入產品紀錄（category='產品' 的品項）────────────────────────
    if (client_id) {
      const coDate = date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
      for (const item of items as { category: string; label: string; price: number; qty: number }[]) {
        if (item.category !== '產品') continue
        db.prepare(`
          INSERT INTO product_usage_logs
            (client_id, date, product_name, record_type, checkout_id, note)
          VALUES (?, ?, ?, '店內購買', ?, ?)
        `).run(
          client_id, coDate,
          item.label.trim(),
          coId,
          item.qty > 1 ? `數量 ${item.qty}` : null
        )
      }
    }

    // ── 7. 自動扣庫存（產品名稱與 inventory_items.name 完全比對）──────────
    {
      const coDate = date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
      for (const item of items as { category: string; label: string; price: number; qty: number }[]) {
        if (item.category !== '產品') continue
        const invItem = db.prepare(
          `SELECT id FROM inventory_items WHERE TRIM(LOWER(name)) = TRIM(LOWER(?))`
        ).get(item.label.trim()) as { id: number } | undefined
        if (!invItem) continue

        // 插入出庫紀錄
        db.prepare(`
          INSERT INTO inventory_ledger (item_id, delta, reason, date, note)
          VALUES (?, ?, '結帳銷售', ?, ?)
        `).run(invItem.id, -item.qty, coDate, `結帳 #${coId}`)

        // 更新現有庫存數量
        db.prepare(`
          UPDATE inventory_items
          SET current_qty = (SELECT COALESCE(SUM(delta), 0) FROM inventory_ledger WHERE item_id = @id),
              updated_at = datetime('now')
          WHERE id = @id
        `).run({ id: invItem.id })
      }
    }

    return { id: coId, pointsEarned, yodomoEarned, totalAmount }
  })

  try {
    const result = run()
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    console.error('[Checkout Error]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
