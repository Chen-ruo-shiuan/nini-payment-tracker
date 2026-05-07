import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

function getTaipeiToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
}

// POST /api/clients/[id]/birthday-perk
// body: { action: 'donation'|'cash'|'gift'|'harvest', date: string, year?: string }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const { action, date, year } = await req.json()

  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id) as {
    id: number; birthday_perks: string; harvest_given: string | null
  } | undefined
  if (!client) return NextResponse.json({ error: '找不到客人' }, { status: 404 })

  const useDate = date || getTaipeiToday()

  if (action === 'harvest') {
    db.prepare(`UPDATE clients SET harvest_given = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(useDate, id)
    return NextResponse.json({ ok: true })
  }

  // annual perks: donation, cash, gift
  const useYear = year || useDate.slice(0, 4)
  const perks: Record<string, Record<string, string>> = (() => {
    try { return JSON.parse(client.birthday_perks || '{}') } catch { return {} }
  })()
  if (!perks[useYear]) perks[useYear] = {}
  perks[useYear][action] = useDate

  // For cash: add $100 to shopping_credit_ledger (生日金屬購物金，非儲值金)
  if (action === 'cash') {
    db.prepare(`
      INSERT INTO shopping_credit_ledger (client_id, delta, note, date) VALUES (?, 100, '生日金 $100', ?)
    `).run(id, useDate)
    // 重新計算購物金餘額
    const { total } = db.prepare(
      `SELECT COALESCE(SUM(delta), 0) AS total FROM shopping_credit_ledger WHERE client_id = ?`
    ).get(id) as { total: number }
    db.prepare(`UPDATE clients SET shopping_credit = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(total, id)
  }

  db.prepare(`UPDATE clients SET birthday_perks = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(JSON.stringify(perks), id)

  return NextResponse.json({ ok: true })
}

// DELETE /api/clients/[id]/birthday-perk
// body: { action: 'donation'|'cash'|'gift'|'harvest', year?: string }
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDb()
  const { action, year } = await req.json()

  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id) as {
    id: number; birthday_perks: string; harvest_given: string | null
  } | undefined
  if (!client) return NextResponse.json({ error: '找不到客人' }, { status: 404 })

  if (action === 'harvest') {
    db.prepare(`UPDATE clients SET harvest_given = NULL, updated_at = datetime('now') WHERE id = ?`).run(id)
    return NextResponse.json({ ok: true })
  }

  const useYear = year || new Date().getFullYear().toString()
  const perks: Record<string, Record<string, string>> = (() => {
    try { return JSON.parse(client.birthday_perks || '{}') } catch { return {} }
  })()

  // For cash: remove from shopping_credit_ledger and recalculate
  if (action === 'cash' && perks[useYear]?.cash) {
    db.prepare(`DELETE FROM shopping_credit_ledger WHERE client_id = ? AND note = '生日金 $100' AND date = ?`)
      .run(id, perks[useYear].cash)
    const { total } = db.prepare(
      `SELECT COALESCE(SUM(delta), 0) AS total FROM shopping_credit_ledger WHERE client_id = ?`
    ).get(id) as { total: number }
    db.prepare(`UPDATE clients SET shopping_credit = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(total, id)
  }

  if (perks[useYear]) delete perks[useYear][action]

  db.prepare(`UPDATE clients SET birthday_perks = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(JSON.stringify(perks), id)

  return NextResponse.json({ ok: true })
}
