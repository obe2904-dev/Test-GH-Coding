import { useTierStore } from '@/stores/tierStore';

export type SubscriptionTier = 'smart' | 'pro';

interface UseSubscriptionTierResult {
  tier: SubscriptionTier;
  isSmart: boolean;
  isPro: boolean;
  canAccessFeature: (feature: string) => boolean;
}

/**
 * Hook to detect user's subscription tier and check feature access
 */
export function useSubscriptionTier(): UseSubscriptionTierResult {
  const currentTier = useTierStore((state) => state.currentTier);

  // Map tier names: 'free' → 'smart' (default), 'standardplus' → 'smart', 'premium' → 'pro'
  const tier: SubscriptionTier = 
    currentTier === 'premium' ? 'pro' : 'smart';
  
  const isSmart = tier === 'smart';
  const isPro = tier === 'pro';

  /**
   * Check if user can access a specific feature
   * Features locked to Pro tier:
   * - edit_operations (edit operations page)
   * - unlimited_goals (create more than 3 goals)
   * - edit_brand_profile (regenerate brand profile)
   * - edit_location (edit location intelligence)
   * - edit_visual_identity (re-analyze visual identity)
   * - advanced_analytics (deep performance insights)
   */
  const canAccessFeature = (feature: string): boolean => {
    if (isPro) return true; // Pro tier has access to everything

    // Smart tier locked features
    const proOnlyFeatures = [
      'edit_operations',
      'unlimited_goals',
      'edit_brand_profile',
      'edit_location',
      'edit_visual_identity',
      'advanced_analytics',
    ];

    return !proOnlyFeatures.includes(feature);
  };

  return {
    tier,
    isSmart,
    isPro,
    canAccessFeature,
  };
}
