/**
 * useFeatureAccess Hook
 * 
 * Provides type-safe access to tier-based features throughout the application.
 * Integrates with tierStore for real-time tier updates.
 */

import { useMemo } from 'react';
import { useTierStore } from '../stores/tierStore';
import { 
  TIER_FEATURES, 
  getIdeaGenerationModel,
  hasFeature, 
  checkQuota,
  getTierDisplayName,
  getUpgradeComparison,
  type TierFeatures,
  type UserTier 
} from '../config/features';

interface UseFeatureAccessReturn {
  // Current tier info
  tier: UserTier;
  tierDisplayName: string;
  features: TierFeatures;
  
  // Feature checks
  hasFeature: (feature: keyof TierFeatures) => boolean;
  
  // AI Model access
  aiModel: string;
  
  // Quota checks
  checkQuota: (
    quotaType: 'aiGenerations' | 'pdfUploads' | 'websiteAnalysis',
    period: 'dailyLimit' | 'monthlyLimit',
    currentUsage: number
  ) => { allowed: boolean; current: number; limit: number; isUnlimited: boolean; remaining: number };
  
  // Upgrade helpers
  getUpgradeOptions: (feature: keyof TierFeatures) => Array<{
    tier: UserTier;
    displayName: string;
    featureValue: any;
  }>;
  
  // Convenience checks for common features
  canUseAdvancedAnalytics: boolean;
  canUseCustomBranding: boolean;
  canUseAPIAccess: boolean;
  canUseBulkOperations: boolean;
  hasPrioritySupport: boolean;
  hasContentLibrary: boolean;
  
  // Limit accessors
  maxSocialChannels: number;
  maxTeamMembers: number;
  maxScheduledPosts: number;
  storageGB: number;
  maxPDFSizeMB: number;
}

/**
 * Hook to access tier-based features
 */
export function useFeatureAccess(): UseFeatureAccessReturn {
  const { currentTier } = useTierStore();
  
  const tier = currentTier;
  const features = TIER_FEATURES[tier];
  
  // Memoize to prevent unnecessary recalculations
  return useMemo(() => ({
    // Current tier info
    tier,
    tierDisplayName: getTierDisplayName(tier),
    features,
    
    // Feature checks
    hasFeature: (feature: keyof TierFeatures) => hasFeature(tier, feature),
    
    // AI Model access
    aiModel: getIdeaGenerationModel(tier),
    
    // Quota checks
    checkQuota: (
      quotaType: 'aiGenerations' | 'pdfUploads' | 'websiteAnalysis',
      period: 'dailyLimit' | 'monthlyLimit',
      currentUsage: number
    ) => checkQuota(tier, quotaType, period, currentUsage),
    
    // Upgrade helpers
    getUpgradeOptions: (feature: keyof TierFeatures) => getUpgradeComparison(tier, feature),
    
    // Convenience checks for common features
    canUseAdvancedAnalytics: features.advancedAnalytics,
    canUseCustomBranding: features.customBranding,
    canUseAPIAccess: features.apiAccess,
    canUseBulkOperations: features.bulkOperations,
    hasPrioritySupport: features.prioritySupport,
    hasContentLibrary: features.contentLibrary,
    
    // Limit accessors
    maxSocialChannels: features.socialChannels,
    maxTeamMembers: features.teamMembers,
    maxScheduledPosts: features.scheduledPosts,
    storageGB: features.storageGB,
    maxPDFSizeMB: features.pdfUploads.maxSizeMB,
  }), [tier, features]);
}

/**
 * Hook to check if a specific quota is available
 * Returns detailed quota information including remaining usage
 */
export function useQuotaCheck(
  quotaType: 'aiGenerations' | 'pdfUploads' | 'websiteAnalysis',
  period: 'dailyLimit' | 'monthlyLimit'
) {
  const { currentTier } = useTierStore();
  const quotaKey = quotaType === 'aiGenerations' ? 'generations' : quotaType;
  
  // Get current usage from tier store
  const currentUsage = useTierStore(state => {
    if (period === 'dailyLimit') {
      return state.dailyUsage[quotaKey as keyof typeof state.dailyUsage] || 0;
    } else {
      return state.monthlyUsage[quotaKey as keyof typeof state.monthlyUsage] || 0;
    }
  });
  
  return useMemo(() => {
    const result = checkQuota(currentTier, quotaType, period, currentUsage);
    
    return {
      ...result,
      // Add percentage for UI progress bars
      percentageUsed: result.isUnlimited ? 0 : (result.current / result.limit) * 100,
      isNearLimit: !result.isUnlimited && result.remaining <= result.limit * 0.2, // 20% or less remaining
    };
  }, [currentTier, quotaType, period, currentUsage]);
}
