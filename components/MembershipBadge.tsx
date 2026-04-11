import { MembershipTier } from '@/types'

const tierStyle: Record<MembershipTier, string> = {
  '甜癒米': 'bg-pink-100 text-pink-700 border-pink-300',
  '療癒米': 'bg-emerald-100 text-emerald-700 border-emerald-300',
  '悟癒米': 'bg-purple-100 text-purple-700 border-purple-300',
}

export default function MembershipBadge({ tier }: { tier: MembershipTier }) {
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full border ${tierStyle[tier]}`}>
      {tier}
    </span>
  )
}
