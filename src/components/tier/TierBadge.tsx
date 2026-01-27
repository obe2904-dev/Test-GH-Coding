import { useTranslation } from 'react-i18next';
import type { SubscriptionTier } from '@/hooks/useSubscriptionTier';

interface TierBadgeProps {
  tier: SubscriptionTier;
  showLabel?: boolean;
}

export function TierBadge({ tier, showLabel = true }: TierBadgeProps) {
  const { t } = useTranslation('tier');

  const colors = {
    smart: 'bg-blue-100 text-blue-800 border-blue-300',
    pro: 'bg-purple-100 text-purple-800 border-purple-300',
  };

  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border text-xs font-semibold ${colors[tier]}`}>
      {tier === 'pro' && '⭐'}
      {tier === 'smart' && '🤖'}
      {showLabel && t(`tier.${tier}`)}
    </span>
  );
}
