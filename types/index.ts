// ═══════════════════════════════
//  Constants
// ═══════════════════════════════
export const MEMBERSHIP_LEVELS = ['癒米', '甜癒米', '療癒米', '悟癒米'] as const
export type MembershipLevel = typeof MEMBERSHIP_LEVELS[number]

// 每消費 1000 元獲得的金米點數（1點 = 1元）
// 癒米 0%、甜癒米 2%（20點）、療癒米 4%（40點）、悟癒米 5%（50點）
export const LEVEL_POINTS: Record<MembershipLevel, number> = {
  '癒米': 0, '甜癒米': 20, '療癒米': 40, '悟癒米': 50
}
export const LEVEL_THRESHOLDS: Record<MembershipLevel, number> = {
  '癒米': 0, '甜癒米': 38000, '療癒米': 48000, '悟癒米': 58000
}
export const NEXT_LEVEL: Partial<Record<MembershipLevel, MembershipLevel>> = {
  '癒米': '甜癒米', '甜癒米': '療癒米', '療癒米': '悟癒米'
}
export const TEA_QUOTA: Record<MembershipLevel, number> = {
  '癒米': 0, '甜癒米': 1, '療癒米': 2, '悟癒米': 3
}
export const YODOMO_THRESHOLD = 3000
export const YODOMO_MILESTONES = [2, 4, 6]

// 生日禮品（各等級）
export const BIRTHDAY_GIFT: Record<MembershipLevel, string> = {
  '癒米': '膠囊旅行組', '甜癒米': '原液旅行組', '療癒米': '安瓶調理', '悟癒米': '客製調理'
}
// 慶祝收成禮（甜癒米以上）
export const HARVEST_GIFT: Partial<Record<MembershipLevel, string>> = {
  '甜癒米': '保養旅行組', '療癒米': '純露正裝 × 1', '悟癒米': '原液正裝 × 1'
}

export const PAYMENT_METHODS = ['現金', '匯款', 'LINE Pay', '分期', '核銷', '儲值金', '金米', '購物金', '商品券', '優惠折扣'] as const
export type PaymentMethod = typeof PAYMENT_METHODS[number]

export const ITEM_CATEGORIES = ['服務', '商品券', '產品', '加購', '活動'] as const
export type ItemCategory = typeof ITEM_CATEGORIES[number]

export const EXPENSE_CATEGORIES = ['食材耗材', '設備維護', '行銷廣告', '房租水電', '薪資', '其他'] as const

// ═══════════════════════════════
//  Client
// ═══════════════════════════════
export interface Client {
  id: number
  name: string
  phone: string | null
  note: string | null
  level: MembershipLevel
  level_since: string | null
  birthday: string | null
  points: number
  yodomo_card_points: number
  yodomo_total_cards: number
  yodomo_redeemed: string  // JSON string: number[]
  tea_usage: string        // JSON string: Record<string, number>
  birthday_perks: string   // JSON string: Record<year, {donation?:string, cash?:string, gift?:string}>
  harvest_given: string | null  // date string when harvest gift was given
  shopping_credit: number  // 購物金餘額
  next_appointment: string | null  // 下次預約日期 YYYY-MM-DD
  allergy_note: string | null      // 過敏成分/物質
  medical_note: string | null      // 特殊健康狀況（懷孕、疾病、藥物）
  skin_note: string | null         // 皮膚注意事項
  referred_by_id: number | null    // 介紹人 client_id
  referral_source: string | null   // 介紹來源（朋友介紹/IG/路過…）
  legacy_id: string | null
  created_at: string
  updated_at: string
}

export interface ClientWithStats extends Client {
  stored_value: number            // computed from sv_ledger
  active_contracts: number        // count of incomplete installment contracts
  next_due_date: string | null    // nearest unpaid installment due
  active_packages: number         // packages with remaining sessions
  next_appointment_date: string | null // 下次預約日期（from appointment_logs）
  overdue_task_days: number | null // 最嚴重逾期天數（有任務且超過上限）
}

// ═══════════════════════════════
//  Installment Contract
// ═══════════════════════════════
export interface InstallmentContract {
  id: number
  client_id: number
  total_amount: number
  payment_method: string
  total_periods: number
  note: string | null
  is_completed: number
  created_at: string
  updated_at: string
}

export interface InstallmentContractWithClient extends InstallmentContract {
  client_name: string
  client_level: MembershipLevel
}

export interface ContractWithInstallments extends InstallmentContract {
  client_name: string
  client_level: MembershipLevel
  installments: Installment[]
}

// ═══════════════════════════════
//  Installment (period)
// ═══════════════════════════════
export interface Installment {
  id: number
  contract_id: number
  client_id: number
  period_number: number
  due_date: string
  paid_at: string | null
  amount: number
  created_at: string
}

export interface InstallmentWithClient extends Installment {
  client_name: string
  client_level: MembershipLevel
}

// ═══════════════════════════════
//  Package & Session
// ═══════════════════════════════
export interface Package {
  id: number
  client_id: number
  service_name: string
  total_sessions: number
  used_sessions: number
  unit_price: number
  unit_price_orig: number
  prepaid_amount: number
  payment_method: string
  include_in_accumulation: number
  include_in_points: number
  note: string | null
  date: string
  legacy_id: string | null
  created_at: string
  // 鼓勵任務
  timing_note: string | null       // 顯示用，例如「3-4 週」
  bonus_desc: string | null        // 贈品說明，例如「B5熱導+頸部」
  timing_max_weeks: number | null  // 計算用上限週數，例如 4
  bonus_active: number             // 1=進行中，0=已撤銷
  extension_count: number          // 已展延次數，最多 2
  expiry_date: string | null       // 建議使用期限（整個套組）
  opened_date: string | null            // 開封日（第一次施作日，任務回訪從此開始）
  completion_bonus_desc: string | null    // 完成鼓勵說明（顯示用）
  completion_weeks: number | null         // 完成鼓勵期限（週數，例：8 = 2個月）
  completion_bonus_service: string | null // 達標後建立的套組名稱
  completion_bonus_price: number | null   // 達標套組的價值（用於記帳）
  completion_claimed: number              // 0=未領取，1=已領取
  last_session_date: string | null      // API 計算，上次施作日期
}

export interface PackageWithClient extends Package {
  client_name: string
  remaining: number
}

export interface Session {
  id: number
  package_id: number | null
  client_id: number
  service_name: string
  amount: number
  date: string
  note: string | null
  created_at: string
}

// ═══════════════════════════════
//  Checkout
// ═══════════════════════════════
export interface CheckoutItem {
  id?: number
  checkout_id?: number
  category: ItemCategory
  label: string
  price: number
  qty: number
}

export interface CheckoutPayment {
  id?: number
  checkout_id?: number
  method: string
  amount: number
}

export interface Checkout {
  id: number
  client_id: number | null
  date: string
  note: string | null
  total_amount: number
  incl_course: number
  incl_product: number
  incl_yodomo: number
  incl_points: number
  created_at: string
}

export interface CheckoutWithDetails extends Checkout {
  client_name: string | null
  items: CheckoutItem[]
  payments: CheckoutPayment[]
}

// ═══════════════════════════════
//  Stored Value
// ═══════════════════════════════
export interface SvLedgerEntry {
  id: number
  client_id: number
  amount: number
  paid_amount: number | null        // 實際收款；null = 無折扣（paid = amount）
  payment_method: string | null
  include_in_accumulation: number   // 1 = 計入年度消費升等
  note: string | null
  date: string
  created_at: string
}

// ═══════════════════════════════
//  Expense
// ═══════════════════════════════
export interface Expense {
  id: number
  date: string
  category: string
  note: string | null
  amount: number
  pay_method: string
  created_at: string
}

// ═══════════════════════════════
//  Visit Log (每日紀錄)
// ═══════════════════════════════
export const VISIT_LOG_ITEM_TYPES = ['服務', '產品', '拿預訂'] as const
export type VisitLogItemType = typeof VISIT_LOG_ITEM_TYPES[number]

export const VISIT_LOG_PAYMENT_STATUSES = ['未收費', '已收費', '定金'] as const
export type VisitLogPaymentStatus = typeof VISIT_LOG_PAYMENT_STATUSES[number]

export const VISIT_LOG_PAY_METHODS = ['匯款', '現金', 'LINE Pay', '儲值金', '金米', '商品券'] as const

export interface VisitLogItem {
  id: number
  visit_log_id: number
  category: string
  label: string
}

export interface VisitLogPayment {
  id: number
  visit_log_id: number
  method: string
  amount: number
}

export interface VisitLog {
  id: number
  client_id: number | null
  client_name: string
  date: string
  service: string  // 舊欄位，改由 items 摘要自動帶入，僅供相容顯示用
  paid: number      // 0 | 1，由 payment_status 推導，僅供相容顯示用
  payment_status: VisitLogPaymentStatus
  payment_method: string | null  // 舊欄位，改由 payments 摘要自動帶入，僅供相容顯示用
  amount: number | null          // 由 payments 加總自動帶入
  next_visit_date: string | null
  note: string | null
  created_at: string
  updated_at: string
}

export interface VisitLogWithClient extends VisitLog {
  client_level: MembershipLevel | null
  payments: VisitLogPayment[]
  items: VisitLogItem[]
}

// ═══════════════════════════════
//  Dashboard
// ═══════════════════════════════
export interface DashboardInstallment {
  id: number
  client_id: number
  contract_id: number
  client_name: string
  client_level: MembershipLevel
  period_number: number
  due_date: string
  amount: number
}

// ═══════════════════════════════
//  Legacy (keep for migration)
// ═══════════════════════════════
export type MembershipTier = MembershipLevel  // alias for compatibility
