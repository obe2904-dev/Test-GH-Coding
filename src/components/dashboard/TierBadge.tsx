interface TierBadgeProps {
  tier: 'Smart' | 'Pro';
}

export function TierBadge({ tier }: TierBadgeProps) {
  const baseClasses = 'text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap';
  const tierClasses = tier === 'Smart' 
    ? 'bg-[#e6f5f0] text-[#0A7D5F]'
    : 'bg-[#ede9fb] text-[#5B4FCF]';
  
  return (
    <span className={`${baseClasses} ${tierClasses}`}>
      {tier}
    </span>
  );
}
