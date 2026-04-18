// ═══════════════════════════════
//  Constants
// ═══════════════════════════════
export const MEMBERSHIP_LEVELS = ['癒米', '甜癒米', '療癒米', '悟癒米'] as const
export type MembershipLevel = typeof MEMBERSHIP_LEVELS[number]

export const LEVEL_POINTS: Record<MembershipLevel, number> = {
  '癒米': 1, '甜癒米': 2, '療癒米': 4, '悟癒米': 5
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

export const PAYMENT_METHODS = ['現金', '匯款', 'LINE Pay', '分期', '核銷', '儲值金', '金米', '商品券', '優惠折扣'] as const
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
  legacy_id: string | null
  created_at: string
  updated_at: string
}

export interface ClientWithStats extends Client {
  stored_value: number            // computed from sv_ledger
  active_contracts: number        // count of incomplete installment contracts
  next_due_date: string | null    // nearest unpaid installment due
  active_packages: number         // packages with remaining sessions
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
  prepaid_amount: number
  payment_method: string
  include_in_accumulation: number
  include_in_points: number
  note: string | null
  date: string
  legacy_id: string | null
  created_at: string
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
  paid_amount: number | null   // 實際收款；null = 無折扣（paid = amount）
  payment_method: string | null
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
