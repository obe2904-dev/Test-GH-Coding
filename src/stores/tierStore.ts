import { create } from 'zustand'
import { 
  type UserTier, 
  TIER_QUOTAS, 
  checkQuota
} from '../config/quotas'

export type Tier = UserTier

// Legacy interface for backward compatibility
interface TierLimits {
  aiIdeasPerDay: number
  captionGenerationsPerDay: number
  scheduledPostsPerMonth: number
  maxChannels: number
  autoReplies: boolean
  cohortInsights: 'none' | 'summary' | 'deep'
  maxUsers: number
  storageGB: number
}

interface DailyUsage {
  generations: number
  pdfUploads: number
  websiteAnalysis: number
}

interface MonthlyUsage {
  generations: number
  pdfUploads: number
  websiteAnalysis: number
  scheduledPosts: number
}

interface QuotaUsage {
  aiIdeasToday: number
  captionGenerationsToday: number
  scheduledPostsThisMonth: number
  lastResetDate: string
  lastMonthResetDate: string
}

interface TierState {
  currentTier: Tier
  quotaUsage: QuotaUsage
  dailyUsage: DailyUsage
  monthlyUsage: MonthlyUsage
  
  // Tier limits (legacy - kept for backward compatibility)
  getTierLimits: (tier: Tier) => TierLimits
  
  // Quota checks (legacy)
  canUseAiIdeas: () => boolean
  canUseCaptionGeneration: () => boolean
  canSchedulePost: () => boolean
  
  // New quota checks aligned with centralized config
  canUseFeature: (quotaType: 'aiGenerations' | 'pdfUploads' | 'websiteAnalysis', period: 'daily' | 'monthly') => boolean
  
  // Quota usage (legacy)
  incrementAiIdeas: () => void
  incrementCaptionGeneration: () => void
  incrementScheduledPost: () => void
  
  // New quota tracking
  incrementUsage: (quotaType: 'generations' | 'pdfUploads' | 'websiteAnalysis', period: 'daily' | 'monthly') => void
  
  // Tier management
  setTier: (tier: Tier) => void
  
  // Reset quotas (called daily/monthly)
  resetDailyQuotas: () => void
  resetMonthlyQuotas: () => void
}

// ⚠️ LEGACY TIER_LIMITS - DO NOT MODIFY DIRECTLY
// This is kept for backward compatibility with old components.
// All values are now sourced from: src/config/quotas.ts (SINGLE SOURCE OF TRUTH)
// To change quotas: Edit config/quotas.ts only - changes will apply here automatically.
// TODO: Deprecate this after migrating all components to use TIER_QUOTAS directly.
const TIER_LIMITS: Record<Tier, TierLimits> = {
  free: {
    aiIdeasPerDay: TIER_QUOTAS.free.aiGenerations.daily,
    captionGenerationsPerDay: TIER_QUOTAS.free.aiGenerations.daily,
    scheduledPostsPerMonth: TIER_QUOTAS.free.scheduledPosts,
    maxChannels: TIER_QUOTAS.free.socialChannels,
    autoReplies: TIER_QUOTAS.free.autoReplies,
    cohortInsights: 'none',
    maxUsers: TIER_QUOTAS.free.teamMembers,
    storageGB: TIER_QUOTAS.free.storageGB
  },
  standardplus: {
    aiIdeasPerDay: TIER_QUOTAS.standardplus.aiGenerations.daily === -1 ? Infinity : TIER_QUOTAS.standardplus.aiGenerations.daily,
    captionGenerationsPerDay: TIER_QUOTAS.standardplus.aiGenerations.daily === -1 ? Infinity : TIER_QUOTAS.standardplus.aiGenerations.daily,
    scheduledPostsPerMonth: TIER_QUOTAS.standardplus.scheduledPosts === -1 ? Infinity : TIER_QUOTAS.standardplus.scheduledPosts,
    maxChannels: TIER_QUOTAS.standardplus.socialChannels,
    autoReplies: TIER_QUOTAS.standardplus.autoReplies,
    cohortInsights: 'summary',
    maxUsers: TIER_QUOTAS.standardplus.teamMembers,
    storageGB: TIER_QUOTAS.standardplus.storageGB
  },
  premium: {
    aiIdeasPerDay: Infinity,
    captionGenerationsPerDay: Infinity,
    scheduledPostsPerMonth: Infinity,
    maxChannels: TIER_QUOTAS.premium.socialChannels === -1 ? Infinity : TIER_QUOTAS.premium.socialChannels,
    autoReplies: TIER_QUOTAS.premium.autoReplies,
    cohortInsights: 'deep',
    maxUsers: TIER_QUOTAS.premium.teamMembers,
    storageGB: TIER_QUOTAS.premium.storageGB
  }
}

export const useTierStore = create<TierState>((set, get) => ({
  currentTier: 'free', // Default to free
  quotaUsage: {
    aiIdeasToday: 0,
    captionGenerationsToday: 0,
    scheduledPostsThisMonth: 0,
    lastResetDate: new Date().toISOString().split('T')[0],
    lastMonthResetDate: new Date().toISOString().substring(0, 7) // YYYY-MM
  },
  dailyUsage: {
    generations: 0,
    pdfUploads: 0,
    websiteAnalysis: 0,
  },
  monthlyUsage: {
    generations: 0,
    pdfUploads: 0,
    websiteAnalysis: 0,
    scheduledPosts: 0,
  },

  getTierLimits: (tier: Tier) => TIER_LIMITS[tier],

  canUseAiIdeas: () => {
    const state = get()
    const limits = TIER_LIMITS[state.currentTier]
    
    // Check if daily quota reset needed
    const today = new Date().toISOString().split('T')[0]
    if (state.quotaUsage.lastResetDate !== today) {
      get().resetDailyQuotas()
    }
    
    return state.quotaUsage.aiIdeasToday < limits.aiIdeasPerDay
  },

  canUseCaptionGeneration: () => {
    const state = get()
    const limits = TIER_LIMITS[state.currentTier]
    
    // Check if daily quota reset needed
    const today = new Date().toISOString().split('T')[0]
    if (state.quotaUsage.lastResetDate !== today) {
      get().resetDailyQuotas()
    }
    
    return state.quotaUsage.captionGenerationsToday < limits.captionGenerationsPerDay
  },

  canSchedulePost: () => {
    const state = get()
    const limits = TIER_LIMITS[state.currentTier]
    
    // Check if monthly quota reset needed
    const thisMonth = new Date().toISOString().substring(0, 7)
    if (state.quotaUsage.lastMonthResetDate !== thisMonth) {
      get().resetMonthlyQuotas()
    }
    
    return state.quotaUsage.scheduledPostsThisMonth < limits.scheduledPostsPerMonth
  },

  incrementAiIdeas: () => {
    set((state) => ({
      quotaUsage: {
        ...state.quotaUsage,
        aiIdeasToday: state.quotaUsage.aiIdeasToday + 1
      }
    }))
  },

  incrementCaptionGeneration: () => {
    set((state) => ({
      quotaUsage: {
        ...state.quotaUsage,
        captionGenerationsToday: state.quotaUsage.captionGenerationsToday + 1
      }
    }))
  },

  incrementScheduledPost: () => {
    set((state) => ({
      quotaUsage: {
        ...state.quotaUsage,
        scheduledPostsThisMonth: state.quotaUsage.scheduledPostsThisMonth + 1
      }
    }))
  },

  setTier: (tier: Tier) => {
    set({ currentTier: tier })
  },

  canUseFeature: (quotaType: 'aiGenerations' | 'pdfUploads' | 'websiteAnalysis', period: 'daily' | 'monthly') => {
    const state = get()
    
    // Check if reset needed
    if (period === 'daily') {
      const today = new Date().toISOString().split('T')[0]
      if (state.quotaUsage.lastResetDate !== today) {
        get().resetDailyQuotas()
      }
    } else {
      const thisMonth = new Date().toISOString().substring(0, 7)
      if (state.quotaUsage.lastMonthResetDate !== thisMonth) {
        get().resetMonthlyQuotas()
      }
    }
    
    // Get current usage
    const usageKey = quotaType === 'aiGenerations' ? 'generations' : quotaType
    const currentUsage = period === 'daily' 
      ? state.dailyUsage[usageKey as keyof DailyUsage]
      : state.monthlyUsage[usageKey as keyof MonthlyUsage]
    
    // Use centralized quota checker
    const result = checkQuota(state.currentTier, period, quotaType, currentUsage)
    return result.allowed
  },

  incrementUsage: (quotaType: 'generations' | 'pdfUploads' | 'websiteAnalysis', period: 'daily' | 'monthly') => {
    set((state) => {
      if (period === 'daily') {
        return {
          dailyUsage: {
            ...state.dailyUsage,
            [quotaType]: state.dailyUsage[quotaType] + 1
          }
        }
      } else {
        return {
          monthlyUsage: {
            ...state.monthlyUsage,
            [quotaType]: state.monthlyUsage[quotaType] + 1
          }
        }
      }
    })
  },

  resetDailyQuotas: () => {
    const today = new Date().toISOString().split('T')[0]
    set((state) => ({
      quotaUsage: {
        ...state.quotaUsage,
        aiIdeasToday: 0,
        captionGenerationsToday: 0,
        lastResetDate: today
      },
      dailyUsage: {
        generations: 0,
        pdfUploads: 0,
        websiteAnalysis: 0,
      }
    }))
  },

  resetMonthlyQuotas: () => {
    const thisMonth = new Date().toISOString().substring(0, 7)
    set((state) => ({
      quotaUsage: {
        ...state.quotaUsage,
        scheduledPostsThisMonth: 0,
        lastMonthResetDate: thisMonth
      },
      monthlyUsage: {
        generations: 0,
        pdfUploads: 0,
        websiteAnalysis: 0,
        scheduledPosts: 0,
      }
    }))
  }
}))
