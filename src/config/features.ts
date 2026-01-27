/**
 * Centralized Feature Configuration System
 * 
 * Single source of truth for all tier-based features, quotas, and limits.
 * This ensures consistent enforcement across the entire platform.
 * 
 * Note: AI model configuration has been moved to src/config/ai-models.ts
 */

import type { ContextAccess } from './contextSources'
import { getAIModel } from './ai-models'

export type UserTier = 'free' | 'standardplus' | 'premium';

/**
 * Feature Flags per Tier
 */
export interface TierFeatures {
  // AI Features (models defined in ai-models.ts)
  aiGenerations: {
    dailyLimit: number;
    monthlyLimit: number;
  };
  
  // Content Features
  postsPerDay: number;
  postsPerMonth: number;
  scheduledPosts: number;
  contentLibrary: boolean;
  advancedAnalytics: boolean;
  
  // Platform Features
  socialChannels: number;
  teamMembers: number;
  
  // Storage
  storageGB: number;
  
  // PDF/Document Features
  pdfUploads: {
    dailyLimit: number;
    monthlyLimit: number;
    maxSizeMB: number;
  };
  
  // Website Analysis
  websiteAnalysis: {
    dailyLimit: number;
    monthlyLimit: number;
  };
  
  // Advanced Features
  customBranding: boolean;
  apiAccess: boolean;
  prioritySupport: boolean;
  bulkOperations: boolean;
  
  // Context Access (for intelligent prompt building)
  contextAccess: ContextAccess;
}

/**
 * Complete Tier Configuration
 */
export const TIER_FEATURES: Record<UserTier, TierFeatures> = {
  free: {
    // AI Features (models defined in ai-models.ts)
    aiGenerations: {
      dailyLimit: 10,
      monthlyLimit: 100,
    },
    // Content Features
    postsPerDay: 5,
    postsPerMonth: 50,
    scheduledPosts: 10,
    contentLibrary: false,
    advancedAnalytics: false,
    
    // Platform Features
    socialChannels: 2,
    teamMembers: 1,
    
    // Storage
    storageGB: 1,
    
    // PDF/Document Features
    pdfUploads: {
      dailyLimit: 2,
      monthlyLimit: 10,
      maxSizeMB: 10,
    },
    
    // Website Analysis
    websiteAnalysis: {
      dailyLimit: 2,
      monthlyLimit: 10,
    },
    
    // Advanced Features
    customBranding: false,
    apiAccess: false,
    prioritySupport: false,
    bulkOperations: false,
    
    // Context Access
    contextAccess: {
      business: ['name', 'type', 'vertical', 'basic-hours', 'short-description'],
      externalStatic: ['major-holidays', 'day-time'],
      externalDynamic: [],
      maxTokens: 500,
    },
  },
  
  standardplus: {
    // AI Features (models defined in ai-models.ts)
    aiGenerations: {
      dailyLimit: 50,
      monthlyLimit: 500,
    },
    // Content Features
    postsPerDay: 20,
    postsPerMonth: 200,
    scheduledPosts: 50,
    contentLibrary: true,
    advancedAnalytics: true,
    
    // Platform Features
    socialChannels: 5,
    teamMembers: 3,
    
    // Storage
    storageGB: 10,
    
    // PDF/Document Features
    pdfUploads: {
      dailyLimit: 10,
      monthlyLimit: 100,
      maxSizeMB: 50,
    },
    
    // Website Analysis
    websiteAnalysis: {
      dailyLimit: 10,
      monthlyLimit: 100,
    },
    
    // Advanced Features
    customBranding: true,
    apiAccess: false,
    prioritySupport: true,
    bulkOperations: true,
    
    // Context Access
    contextAccess: {
      business: ['name', 'type', 'vertical', 'location', 'address', 'city', 'hours', 'menu', 'menu-highlights', 'description', 'target-audience', 'vibe', 'tone'],
      externalStatic: ['holidays', 'seasons', 'local-events', 'day-time'],
      externalDynamic: ['nearby-transit'],
      maxTokens: 2000,
      apiLimits: {
        'nearby-transit': 20, // 20 lookups per day
      },
    },
  },
  
  premium: {
    // AI Features (models defined in ai-models.ts)
    aiGenerations: {
      dailyLimit: -1, // unlimited
      monthlyLimit: -1, // unlimited
    },
    // Content Features
    postsPerDay: -1, // unlimited
    postsPerMonth: -1, // unlimited
    scheduledPosts: -1, // unlimited
    contentLibrary: true,
    advancedAnalytics: true,
    
    // Platform Features
    socialChannels: -1, // unlimited
    teamMembers: 10,
    
    // Storage
    storageGB: 100,
    
    // PDF/Document Features
    pdfUploads: {
      dailyLimit: -1, // unlimited
      monthlyLimit: -1, // unlimited
      maxSizeMB: 100,
    },
    
    // Website Analysis
    websiteAnalysis: {
      dailyLimit: -1, // unlimited
      monthlyLimit: -1, // unlimited
    },
    
    // Advanced Features
    customBranding: true,
    apiAccess: true,
    prioritySupport: true,
    bulkOperations: true,
    
    // Context Access
    contextAccess: {
      business: 'all',
      externalStatic: ['holidays', 'seasons', 'local-events', 'trends', 'day-time'],
      externalDynamic: ['weather-basic', 'nearby-transit', 'nearby-attractions'],
      maxTokens: 8000,
      apiLimits: {
        'weather-basic': -1, // Unlimited
        'nearby-transit': -1, // Unlimited
        'nearby-attractions': -1, // Unlimited
      },
    },
  },
};

/**
 * Helper functions re-exported from ai-models.ts for backward compatibility
 */
export { getAIModel, getSpellingCheckModel } from './ai-models'

/**
 * Get AI model for idea generation (most common use case)
 */
export function getIdeaGenerationModel(tier: UserTier): string {
  return getAIModel('ideaGeneration', tier)
}

/**
 * Helper function to check if a feature is available for a tier
 */
export function hasFeature(tier: UserTier, feature: keyof TierFeatures): boolean {
  const value = TIER_FEATURES[tier][feature];
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return true; // for objects/complex features, assume available
}

/**
 * Helper function to check quota limits
 * Returns: { allowed: boolean, current: number, limit: number, isUnlimited: boolean }
 */
export function checkQuota(
  tier: UserTier,
  quotaType: 'aiGenerations' | 'pdfUploads' | 'websiteAnalysis',
  period: 'dailyLimit' | 'monthlyLimit',
  currentUsage: number
): { allowed: boolean; current: number; limit: number; isUnlimited: boolean; remaining: number } {
  const limit = TIER_FEATURES[tier][quotaType][period];
  const isUnlimited = limit === -1;
  
  return {
    allowed: isUnlimited || currentUsage < limit,
    current: currentUsage,
    limit: isUnlimited ? Infinity : limit,
    isUnlimited,
    remaining: isUnlimited ? Infinity : Math.max(0, limit - currentUsage),
  };
}

/**
 * Helper function to get user-friendly tier name
 */
export function getTierDisplayName(tier: UserTier): string {
  const names: Record<UserTier, string> = {
    free: 'Free',
    standardplus: 'Standard Plus',
    premium: 'Premium',
  };
  return names[tier];
}

/**
 * Helper function to get tier comparison for upgrade prompts
 */
export function getUpgradeComparison(currentTier: UserTier, feature: keyof TierFeatures) {
  const tiers: UserTier[] = ['free', 'standardplus', 'premium'];
  const currentIndex = tiers.indexOf(currentTier);
  
  return tiers
    .slice(currentIndex + 1)
    .map(tier => ({
      tier,
      displayName: getTierDisplayName(tier),
      featureValue: TIER_FEATURES[tier][feature],
    }));
}
