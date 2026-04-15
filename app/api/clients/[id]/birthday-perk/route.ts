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

  // For cash: also add 100 to sv_ledger
  if (action === 'cash') {
    db.prepare(`
      INSERT INTO sv_ledger (client_id, amount, note, date) VALUES (?, 100, '生日贈', ?)
    `).run(id, useDate)
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

  // For cash: also remove the sv_ledger entry (find by note + approximate date)
  if (action === 'cash' && perks[useYear]?.cash) {
    db.prepare(`DELETE FROM sv_ledger WHERE client_id = ? AND note = '生日贈' AND date = ?`)
      .run(id, perks[useYear].cash)
  }

  if (perks[useYear]) delete perks[useYear][action]

  db.prepare(`UPDATE clients SET birthday_perks = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(JSON.stringify(perks), id)

  return NextResponse.json({ ok: true })
}
