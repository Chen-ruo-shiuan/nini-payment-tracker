import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'

// Stroke count lookup for common Taiwanese/Chinese surnames
const STROKES: Record<string, number> = {
  '丁': 2, '卜': 2,
  '于': 3, '弓': 3, '大': 3, '山': 3, '川': 3,
  '孔': 4, '方': 4, '文': 4, '毛': 4, '王': 4, '牛': 4, '尹': 4, '元': 4, '公': 4, '仁': 4, '天': 4, '化': 4,
  '白': 5, '石': 5, '包': 5, '丘': 5, '左': 5, '田': 5, '史': 5, '申': 5, '令': 5, '古': 5, '甲': 5, '玉': 5, '付': 5, '司': 5, '平': 5,
  '江': 6, '朱': 6, '任': 6, '安': 6, '伍': 6, '向': 6, '成': 6, '池': 6, '年': 6, '米': 6, '曲': 6, '阮': 6, '邢': 6, '艾': 6, '竹': 6, '羊': 6, '仲': 6,
  '李': 7, '吳': 7, '余': 7, '何': 7, '宋': 7, '杜': 7, '沈': 7, '汪': 7, '辛': 7, '谷': 7, '狄': 7, '呂': 7,
  '林': 8, '周': 8, '岳': 8, '武': 8, '邱': 8, '金': 8, '卓': 8, '易': 8, '明': 8, '季': 8, '孟': 8, '房': 8, '邵': 8, '官': 8, '和': 8, '昌': 8,
  '洪': 9, '姜': 9, '柯': 9, '施': 9, '紀': 9, '胡': 9, '范': 9, '柳': 9, '段': 9, '俞': 9, '侯': 9, '姚': 9, '查': 9, '春': 9, '柏': 9,
  '孫': 10, '徐': 10, '唐': 10, '高': 10, '夏': 10, '倪': 10, '秦': 10, '翁': 10, '袁': 10, '凌': 10, '殷': 10, '耿': 10, '班': 10, '宮': 10, '容': 10,
  '曹': 11, '許': 11, '張': 11, '梁': 11, '陳': 11, '麥': 11, '康': 11, '莊': 11, '崔': 11, '常': 11, '強': 11, '章': 11, '郭': 11, '莫': 11, '連': 11,
  '游': 12, '曾': 12, '湯': 12, '喬': 12, '彭': 12, '黃': 12, '程': 12, '賀': 12, '馮': 12, '舒': 12, '傅': 12, '童': 12, '項': 12, '閔': 12, '覃': 12,
  '葉': 13, '楊': 13, '溫': 13, '葛': 13, '董': 13, '詹': 13, '廉': 13, '楚': 13, '雷': 13, '虞': 13, '路': 13, '萬': 13,
  '趙': 14, '劉': 14, '蔡': 14, '廖': 14, '熊': 14, '管': 14, '齊': 14, '裴': 14, '聞': 14,
  '蔣': 15, '鄭': 15, '潘': 15, '歐': 15, '鄧': 15, '鄒': 15, '魯': 15, '賴': 15, '樊': 15, '褚': 15,
  '盧': 16, '蕭': 16, '錢': 16, '戴': 16, '龍': 16, '霍': 16,
  '謝': 17, '韓': 17,
  '魏': 18, '簡': 18, '顏': 18,
  '關': 19, '龐': 19, '譚': 19, '羅': 19,
  '嚴': 20, '蘇': 20,
  '顧': 21, '藍': 21,
  '龔': 22,
}

function getStrokeCount(char: string): number {
  return STROKES[char] ?? 99
}

export async function GET(req: NextRequest) {
  const db = getDb()
  const search        = req.nextUrl.searchParams.get('q') || ''
  const level         = req.nextUrl.searchParams.get('level') || ''
  const birthdayMonth = req.nextUrl.searchParams.get('birthday_month') || ''

  const conditions: string[] = []
  const bindParams: string[] = []

  if (search) {
    conditions.push('c.name LIKE ?')
    bindParams.push(`%${search}%`)
  }
  if (level) {
    conditions.push('c.level = ?')
    bindParams.push(level)
  }
  if (birthdayMonth) {
    const mm = String(Number(birthdayMonth)).padStart(2, '0')
    conditions.push("c.birthday IS NOT NULL AND SUBSTR(c.birthday, 1, 2) = ?")
    bindParams.push(mm)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const clients = db.prepare(`
    SELECT c.*,
      COALESCE((SELECT SUM(amount) FROM sv_ledger WHERE client_id = c.id), 0) as stored_value,
      (SELECT COUNT(*) FROM installment_contracts WHERE client_id = c.id AND is_completed = 0) as active_contracts,
      (SELECT MIN(i.due_date) FROM installments i
        JOIN installment_contracts ic ON ic.id = i.contract_id
        WHERE ic.client_id = c.id AND i.paid_at IS NULL) as next_due_date,
      (SELECT COUNT(*) FROM packages p
        WHERE p.client_id = c.id AND p.used_sessions < p.total_sessions) as active_packages
    FROM clients c
    ${where}
    ORDER BY c.name ASC
  `).all(...bindParams) as Array<{ id: number; name: string; level: string; [key: string]: unknown }>

  // Apply stroke-count sort when no free-text search (preserve search-relevance order otherwise)
  if (!search) {
    clients.sort((a, b) => {
      const sa = getStrokeCount(a.name[0])
      const sb = getStrokeCount(b.name[0])
      if (sa !== sb) return sa - sb
      return a.name.localeCompare(b.name, 'zh-TW')
    })
  }

  return NextResponse.json(clients)
}

export async function POST(req: NextRequest) {
  const db = getDb()
  const body = await req.json()
  const { name, phone, note, level, level_since, birthday } = body

  if (!name) return NextResponse.json({ error: '請輸入姓名' }, { status: 400 })

  const result = db.prepare(`
    INSERT INTO clients (name, phone, note, level, level_since, birthday)
    VALUES (@name, @phone, @note, @level, @level_since, @birthday)
  `).run({
    name,
    phone: phone || null,
    note: note || null,
    level: level || '癒米',
    level_since: level_since || null,
    birthday: birthday || null,
  })

  return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 })
}
