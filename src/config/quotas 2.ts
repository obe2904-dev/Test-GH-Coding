/**
 * 🎯 CENTRALIZED QUOTA CONFIGURATION
 * 
 * Single file to manage all tier limits and quotas.
 * Edit this file to adjust limits - changes apply everywhere automatically.
 * 
 * -1 = Unlimited
 */

export type UserTier = 'free' | 'standardplus' | 'premium'

/**
 * Display names for tiers (UI only)
 */
export const TIER_DISPLAY_NAMES: Record<UserTier, string> = {
  free: 'Free',
  standardplus: 'Smart',
  premium: 'Pro',
}

/**
 * All quota limits organized by tier
 */
export interface TierQuotas {
  // AI Generation Quotas
  aiGenerations: {
    daily: number
    monthly: number
  }
  
  // Content Creation
  postsPerDay: number
  postsPerMonth: number
  scheduledPosts: number
  
  // Platform Features
  socialChannels: number
  teamMembers: number
  
  // Storage
  storageGB: number
  
  // Document Processing
  pdfUploads: {
    daily: number
    monthly: number
    maxSizeMB: number
  }
  
  // Website Analysis
  websiteAnalysis: {
    daily: number
    monthly: number
  }
  
  // Photo Features
  photoUploadsPerPost: number
  photoAnalysisLevel: 'basic' | 'advanced' | 'premium'

  // Carousel Features
  carousel: {
    enabled: boolean
    aiOrganise: boolean
    aiOrganisePerDay: number   // -1 = unlimited
    dragAndDrop: boolean       // false = arrow buttons only (Smart); true = full drag (Pro)
    slideCaption: boolean      // per-slide text field, Pro only
    goalBased: boolean         // goal selector, Pro only
  }
  
  // Advanced Features
  customBranding: boolean
  apiAccess: boolean
  prioritySupport: boolean
  autoReplies: boolean
}

/**
 * 📊 QUOTA LIMITS BY TIER
 * 
 * Adjust these numbers to change limits across the entire platform
 */
export const TIER_QUOTAS: Record<UserTier, TierQuotas> = {
  free: {
    // AI Generation - TESTING MODE (Production: daily: 3, monthly: 10)
    aiGenerations: {
      daily: 100,  // TESTING: 100 (Production: 3)
      monthly: 100,  // TESTING: 100 (Production: 10)
    },
    
    // Content Creation - Free tier production limits
    postsPerDay: 3,
    postsPerMonth: 30,
    scheduledPosts: 10,
    
    // Platform Features - Minimal
    socialChannels: 2,
    teamMembers: 1,
    
    // Storage - Basic
    storageGB: 1,
    
    // Document Processing - Free tier production limits
    pdfUploads: {
      daily: 1,
      monthly: 5,
      maxSizeMB: 10,
    },
    
    // Website Analysis - Free tier production limits
    websiteAnalysis: {
      daily: 1,
      monthly: 5,
    },
    
    // Photo Features - Basic
    photoUploadsPerPost: 1,
    photoAnalysisLevel: 'basic',

    // Carousel Features - Disabled for Free
    carousel: {
      enabled: false,
      aiOrganise: false,
      aiOrganisePerDay: 0,
      dragAndDrop: false,
      slideCaption: false,
      goalBased: false,
    },
    
    // Advanced Features - None
    customBranding: false,
    apiAccess: false,
    prioritySupport: false,
    autoReplies: false,
  },
  
  standardplus: {
    // AI Generation - TESTING MODE (Production: daily: 3, monthly: 90)
    aiGenerations: {
      daily: 100,  // TESTING: 100 (Production: 3)
      monthly: 100,  // TESTING: 100 (Production: 90)
    },
    
    // Content Creation - High
    postsPerDay: 50,
    postsPerMonth: 500,
    scheduledPosts: 100,
    
    // Platform Features - Expanded
    socialChannels: 5,
    teamMembers: 3,
    
    // Storage - Expanded
    storageGB: 10,
    
    // Document Processing - High
    pdfUploads: {
      daily: 20,
      monthly: 200,
      maxSizeMB: 50,
    },
    
    // Website Analysis - High
    websiteAnalysis: {
      daily: 20,
      monthly: 200,
    },
    
    // Photo Features - Advanced
    photoUploadsPerPost: 5,
    photoAnalysisLevel: 'advanced',

    // Carousel Features - Smart (arrows only, no goal/slide caption)
    carousel: {
      enabled: true,
      aiOrganise: true,
      aiOrganisePerDay: 10,
      dragAndDrop: false,
      slideCaption: false,
      goalBased: false,
    },
    
    // Advanced Features - Some
    customBranding: true,
    apiAccess: false,
    prioritySupport: true,
    autoReplies: false,
  },
  
  premium: {
    // AI Generation - TESTING MODE (Production: daily: 5, monthly: 150)
    aiGenerations: {
      daily: 100,  // TESTING: 100 (Production: 5)
      monthly: 100,  // TESTING: 100 (Production: 150)
    },
    
    // Content Creation - Unlimited
    postsPerDay: -1,
    postsPerMonth: -1,
    scheduledPosts: -1,
    
    // Platform Features - Unlimited
    socialChannels: -1,
    teamMembers: 10,
    
    // Storage - Large
    storageGB: 100,
    
    // Document Processing - Unlimited
    pdfUploads: {
      daily: -1,
      monthly: -1,
      maxSizeMB: 100,
    },
    
    // Website Analysis - Unlimited
    websiteAnalysis: {
      daily: -1,
      monthly: -1,
    },
    
    // Photo Features - Premium
    photoUploadsPerPost: 10,
    photoAnalysisLevel: 'premium',

    // Carousel Features - Pro (full feature set)
    carousel: {
      enabled: true,
      aiOrganise: true,
      aiOrganisePerDay: -1,
      dragAndDrop: true,
      slideCaption: true,
      goalBased: true,
    },
    
    // Advanced Features - All
    customBranding: true,
    apiAccess: true,
    prioritySupport: true,
    autoReplies: true,
  },
}

/**
 * Helper: Get quotas for a tier
 */
export function getQuotas(tier: UserTier): TierQuotas {
  return TIER_QUOTAS[tier]
}

/**
 * Helper: Get display name for a tier
 */
export function getTierDisplayName(tier: UserTier): string {
  return TIER_DISPLAY_NAMES[tier]
}

/**
 * Helper: Check if quota allows action
 * Returns: { allowed: boolean, current: number, limit: number, remaining: number }
 */
export function checkQuota(
  tier: UserTier,
  quotaType: 'daily' | 'monthly',
  category: 'aiGenerations' | 'pdfUploads' | 'websiteAnalysis',
  currentUsage: number
): { allowed: boolean; current: number; limit: number; remaining: number; isUnlimited: boolean } {
  const quotas = TIER_QUOTAS[tier]
  const limit = quotas[category][quotaType]
  const isUnlimited = limit === -1
  
  return {
    allowed: isUnlimited || currentUsage < limit,
    current: currentUsage,
    limit: isUnlimited ? Infinity : limit,
    remaining: isUnlimited ? Infinity : Math.max(0, limit - currentUsage),
    isUnlimited,
  }
}

/**
 * Helper: Check if a boolean feature is enabled
 */
export function hasFeature(tier: UserTier, feature: keyof TierQuotas): boolean {
  const value = TIER_QUOTAS[tier][feature]
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  return true
}

/**
 * Helper: Format quota display text
 */
export function formatQuotaDisplay(current: number, limit: number): string {
  return limit === -1 ? `${current}/∞` : `${current}/${limit}`
}
