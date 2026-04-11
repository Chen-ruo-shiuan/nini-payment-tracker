export type MembershipTier = '甜癒米' | '療癒米' | '悟癒米'
export type PaymentMethod = 'cash' | 'transfer' | 'card' | 'other'

export interface Customer {
  id: number
  name: string
  total_amount: number
  installment_amount: number
  payment_method: PaymentMethod
  total_periods: number
  membership_tier: MembershipTier
  notes: string | null
  is_completed: number
  created_at: string
  updated_at: string
}

export interface Installment {
  id: number
  customer_id: number
  period_number: number
  due_date: string
  paid_at: string | null
  amount: number
  created_at: string
}

export interface InstallmentWithCustomer extends Installment {
  customer_name: string
  membership_tier: MembershipTier
}

export interface CustomerWithInstallments extends Customer {
  installments: Installment[]
}

export interface PushSubscriptionRecord {
  id: number
  endpoint: string
  p256dh: string
  auth: string
  user_agent: string | null
  created_at: string
}
