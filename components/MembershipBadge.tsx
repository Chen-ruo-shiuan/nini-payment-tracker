import { MembershipLevel } from '@/types'

const levelStyle: Record<MembershipLevel, { bg: string; color: string; border: string }> = {
  '甜癒米': { bg: '#fce8f0', color: '#9a3060', border: '#e8a0c0' },  // 粉色
  '療癒米': { bg: '#e8f0fc', color: '#2d4f9a', border: '#9ab0e8' },  // 藍色
  '悟癒米': { bg: '#fdf5e0', color: '#7a5a00', border: '#e0c055' },  // 黃色
}

export default function MembershipBadge({ tier }: { tier: MembershipLevel }) {
  const s = levelStyle[tier] ?? levelStyle['甜癒米']
  return (
    <span style={{
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      fontSize: '0.7rem', letterSpacing: '0.05em',
    }} className="inline-block px-2 py-0.5 rounded">
      {tier}
    </span>
  )
}
