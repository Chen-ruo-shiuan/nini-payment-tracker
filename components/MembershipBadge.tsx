import { MembershipTier } from '@/types'

const tierStyle: Record<MembershipTier, { bg: string; color: string; border: string }> = {
  '甜癒米': { bg: '#f5ede3', color: '#8b6a4a', border: '#d4b896' },
  '療癒米': { bg: '#e8ede6', color: '#4a6b52', border: '#9ab89e' },
  '悟癒米': { bg: '#e8e6ed', color: '#5a4a6b', border: '#a89ab8' },
}

export default function MembershipBadge({ tier }: { tier: MembershipTier }) {
  const s = tierStyle[tier]
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontSize: '0.7rem', letterSpacing: '0.05em' }}
      className="inline-block px-2 py-0.5 rounded">
      {tier}
    </span>
  )
}
