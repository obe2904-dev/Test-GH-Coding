import { create } from 'zustand'

export type Tier = 'free' | 'standardplus' | 'premium'

interface TierLimits {
  aiIdeasPerDay: number
  captionGenerationsPerDay: number
  photoFeedbackLevel: 'lite' | 'full' | 'full-batch'
  scheduledPostsPerMonth: number
  maxChannels: number
  autoReplies: boolean
  cohortInsights: 'none' | 'summary' | 'deep'
  maxUsers: number
  storageGB: number
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
  
  // Tier limits
  getTierLimits: (tier: Tier) => TierLimits
  
  // Quota checks
  canUseAiIdeas: () => boolean
  canUseCaptionGeneration: () => boolean
  canSchedulePost: () => boolean
  
  // Quota usage
  incrementAiIdeas: () => void
  incrementCaptionGeneration: () => void
  incrementScheduledPost: () => void
  
  // Tier management
  setTier: (tier: Tier) => void
  
  // Reset quotas (called daily/monthly)
  resetDailyQuotas: () => void
  resetMonthlyQuotas: () => void
}

const TIER_LIMITS: Record<Tier, TierLimits> = {
  free: {
    aiIdeasPerDay: 3,
    captionGenerationsPerDay: 5,
    photoFeedbackLevel: 'lite',
    scheduledPostsPerMonth: 3,
    maxChannels: 1,
    autoReplies: false,
    cohortInsights: 'none',
    maxUsers: 1,
    storageGB: 0.1 // 100MB
  },
  standardplus: {
    aiIdeasPerDay: Infinity,
    captionGenerationsPerDay: Infinity,
    photoFeedbackLevel: 'full',
    scheduledPostsPerMonth: Infinity,
    maxChannels: 3,
    autoReplies: false, // Draft suggestions only
    cohortInsights: 'summary',
    maxUsers: 3,
    storageGB: 5
  },
  premium: {
    aiIdeasPerDay: Infinity,
    captionGenerationsPerDay: Infinity,
    photoFeedbackLevel: 'full-batch',
    scheduledPostsPerMonth: Infinity,
    maxChannels: 6,
    autoReplies: true, // Rules-based auto + escalation
    cohortInsights: 'deep',
    maxUsers: 10,
    storageGB: 50
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

  resetDailyQuotas: () => {
    const today = new Date().toISOString().split('T')[0]
    set((state) => ({
      quotaUsage: {
        ...state.quotaUsage,
        aiIdeasToday: 0,
        captionGenerationsToday: 0,
        lastResetDate: today
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
      }
    }))
  }
}))
