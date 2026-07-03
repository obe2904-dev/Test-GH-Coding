import { useSubscriptionTier } from '@/hooks/useSubscriptionTier';
import { UpgradePrompt } from './UpgradePrompt';

interface TierGuardProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgrade?: boolean;
}

/**
 * Guard component that shows content only if user's tier allows access
 * If not, shows upgrade prompt or custom fallback
 */
export function TierGuard({ 
  feature, 
  children, 
  fallback,
  showUpgrade = true 
}: TierGuardProps) {
  const { canAccessFeature } = useSubscriptionTier();

  if (canAccessFeature(feature)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (showUpgrade) {
    return <UpgradePrompt compact />;
  }

  return null;
}
