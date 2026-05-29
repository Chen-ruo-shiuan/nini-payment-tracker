import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// POST /api/packages/[id]/claim-completion
// 領取完成鼓勵：自動建立 1 堂附加套組，並標記原套組 completion_claimed = 1
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = getDb()

  const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(id) as {
    id: number; client_id: number; service_name: string;
    total_sessions: number; used_sessions: number;
    opened_date: string | null; last_session_date_calc?: string;
    completion_bonus_desc: string | null; completion_weeks: number | null;
    completion_bonus_service: string | null; completion_bonus_price: number | null;
    completion_claimed: number;
  } | undefined

  if (!pkg) return NextResponse.json({ error: '找不到套組' }, { status: 404 })
  if (pkg.completion_claimed) return NextResponse.json({ error: '已領取過了' }, { status: 400 })
  if (!pkg.completion_bonus_service) return NextResponse.json({ error: '未設定附加課程名稱' }, { status: 400 })

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })

  const run = db.transaction(() => {
    // 建立 1 堂附加套組
    const res = db.prepare(`
      INSERT INTO packages
        (client_id, service_name, total_sessions, used_sessions,
         unit_price, unit_price_orig, prepaid_amount, payment_method,
         include_in_accumulation, include_in_points, note, date)
      VALUES (?, ?, 1, 0, ?, ?, 0, '贈品', 0, 0, ?, ?)
    `).run(
      pkg.client_id,
      pkg.completion_bonus_service,
      0,                               // unit_price = 0（贈品不收費，讓利 = orig - 0）
      pkg.completion_bonus_price ?? 0, // unit_price_orig 保留市價，報表 pkgDiscount 自動算入讓利
      `完成鼓勵：${pkg.service_name}`,
      today,
    )

    // 標記已領取
    db.prepare('UPDATE packages SET completion_claimed = 1 WHERE id = ?').run(pkg.id)

    return { new_package_id: Number(res.lastInsertRowid) }
  })

  const result = run()
  return NextResponse.json(result, { status: 201 })
}
