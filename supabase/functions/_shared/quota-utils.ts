/// <reference path="./types.d.ts" />

/**
 * Shared quota validation utilities for Edge Functions
 * 
 * BUSINESS-LEVEL QUOTAS:
 * - Tier/plan is stored at business level (businesses.plan)
 * - All team members of a business share the same quota
 * - Quota usage is tracked at business level, not user level
 */

// @deno-types="npm:@supabase/supabase-js@2"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export type UserTier = 'free' | 'standardplus' | 'premium'
type QuotaType = 'aiGenerations' | 'pdfUploads' | 'websiteAnalysis'
type QuotaPeriod = 'daily' | 'monthly' | 'weekly'

type UsageColumn =
  | 'ai_generations_today'
  | 'ai_generations_this_month'
  | 'pdf_uploads_today'
  | 'pdf_uploads_this_month'
  | 'website_analysis_today'
  | 'website_analysis_this_month'

interface BusinessUsage {
  plan?: string | null
  ai_generations_today?: number | null
  ai_generations_this_month?: number | null
  pdf_uploads_today?: number | null
  pdf_uploads_this_month?: number | null
  website_analysis_today?: number | null
  website_analysis_this_month?: number | null
}

/**
 * Tier quotas - must match src/config/quotas.ts
 * Update both files when changing limits
 */
export const TIER_QUOTAS = {
  free: {
    aiGenerations: { daily: 100, monthly: 100 },
    pdfUploads: { daily: 2, monthly: 10 },
    websiteAnalysis: { daily: 2, monthly: 10 },
    videoUploads: { weekly: 2 },
  },
  standardplus: {
    aiGenerations: { daily: 100, monthly: 1000 },
    pdfUploads: { daily: 20, monthly: 200 },
    websiteAnalysis: { daily: 20, monthly: 200 },
    videoUploads: { weekly: -1 },
  },
  premium: {
    aiGenerations: { daily: -1, monthly: -1 },
    pdfUploads: { daily: -1, monthly: -1 },
    websiteAnalysis: { daily: -1, monthly: -1 },
    videoUploads: { weekly: -1 },
  },
} as const

export interface QuotaCheck {
  allowed: boolean
  tier: UserTier
  current: number
  limit: number
  reason?: string
}

// Column mapping for quota types
const columnMap: Record<QuotaType, Partial<Record<QuotaPeriod, UsageColumn>>> = {
  aiGenerations: {
    daily: 'ai_generations_today',
    monthly: 'ai_generations_this_month'
  },
  pdfUploads: {
    daily: 'pdf_uploads_today',
    monthly: 'pdf_uploads_this_month'
  },
  websiteAnalysis: {
    daily: 'website_analysis_today',
    monthly: 'website_analysis_this_month'
  }
  // videoUploads removed - database column 'video_uploads_this_week' does not exist
}

/**
 * Get user's business tier and current usage from database
 * Now fetches from business level, not user level
 */
export async function getUserQuota(
  userId: string,
  quotaType: QuotaType,
  period: QuotaPeriod
): Promise<QuotaCheck> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log(`🔍 getUserQuota called for user: ${userId}, quota: ${quotaType}, period: ${period}`)

  // First, get user's plan from profiles table
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .maybeSingle()
  
  if (profileError) {
    console.error(`❌ Error fetching profile for user ${userId}:`, profileError)
  }
  
  const userPlan = (profile?.plan as UserTier) || 'free'
  console.log(`👤 User plan from profile: ${userPlan}`)

  // Get user's business (as owner or team member) for usage data
  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('id, ai_generations_today, ai_generations_this_month, pdf_uploads_today, pdf_uploads_this_month, website_analysis_today, website_analysis_this_month')
    .eq('owner_id', userId)
    .maybeSingle()
  
  if (businessError) {
    console.error(`❌ Error fetching business for owner_id ${userId}:`, businessError)
  } else if (business) {
    console.log(`✅ Found business as owner: ${business.id}`)
  } else {
    console.log(`⚠️ No business found for owner_id: ${userId}, checking team members...`)
  }

  let businessData = business as BusinessUsage | null

  // If not owner, check if team member
  if (!businessData) {
    const { data: teamMember, error: teamError } = await supabase
      .from('business_team_members')
      .select('business_id')
      .eq('user_id', userId)
      .not('accepted_at', 'is', null)
      .maybeSingle()
    
    if (teamError) {
      console.error(`❌ Error checking team membership:`, teamError)
    } else if (teamMember) {
      console.log(`✅ Found team membership: business_id ${teamMember.business_id}`)
      const { data: teamBusiness, error: teamBusinessError } = await supabase
        .from('businesses')
        .select('id, ai_generations_today, ai_generations_this_month, pdf_uploads_today, pdf_uploads_this_month, website_analysis_today, website_analysis_this_month')
        .eq('id', teamMember.business_id)
        .maybeSingle()
      
      if (teamBusinessError) {
        console.error(`❌ Error fetching team business:`, teamBusinessError)
      }
      businessData = teamBusiness as BusinessUsage | null
    } else {
      console.log(`⚠️ No team membership found for user: ${userId}`)
    }
  }

  if (!businessData) {
    console.error(`❌ QUOTA CHECK FAILED: No business found for user ${userId}`)
    return {
      allowed: false,
      tier: userPlan,
      current: 0,
      limit: 0,
      reason: 'No business found for user'
    }
  }
  
  console.log(`✅ Using business: ${businessData.id}, plan: ${userPlan}`)

  // Get tier from user's profile plan
  const tier: UserTier = userPlan
  
  // Get usage from the correct column
  const columnKey = columnMap[quotaType][period]
  if (!columnKey) {
    throw new Error(`No column mapping found for ${quotaType} ${period}`)
  }
  const current = Number((businessData as any)[columnKey] ?? 0)
  const limit = TIER_QUOTAS[tier][quotaType][period as keyof typeof TIER_QUOTAS[typeof tier][typeof quotaType]]
  const isUnlimited = limit === -1
  
  const periodLabel = period === 'daily' ? 'Daily' : period === 'weekly' ? 'Weekly' : 'Monthly'
  
  return {
    allowed: isUnlimited || current < limit,
    tier,
    current,
    limit: isUnlimited ? -1 : limit,
    reason: isUnlimited || current < limit 
      ? undefined 
      : `${periodLabel} quota exceeded (${current}/${limit})`
  }
}

/**
 * Increment usage counter in database (at business level)
 */
export async function incrementQuota(
  userId: string,
  quotaType: QuotaType
): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  // Get user's business ID
  const { data: businessId } = await supabase.rpc('get_user_business_id', { user_id: userId })
  
  if (!businessId) {
    console.error('Failed to get business ID for user:', userId)
    return
  }

  // Handle different quota types
  if (quotaType === 'aiGenerations') {
    // Use existing RPC for AI generations (increments both daily and monthly)
    const { error } = await supabase.rpc('increment_ai_generation_business', { business_uuid: businessId })
    if (error) {
      console.error('Failed to increment AI generation quota:', error)
    }
  } else if (quotaType === 'videoUploads') {
    // Increment video uploads (weekly counter)
    const { error } = await supabase
      .from('businesses')
      .update({ video_uploads_this_week: supabase.raw('video_uploads_this_week + 1') })
      .eq('id', businessId)
    
    if (error) {
      console.error('Failed to increment video upload quota:', error)
    }
  } else {
    // For other quota types, we'd add handling here
    console.warn(`incrementQuota not fully implemented for ${quotaType}`)
  }
}

/**
 * Extract user ID from JWT token in Authorization header
 */
export function getUserIdFromAuth(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  try {
    const token = authHeader.substring(7)
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.sub || null
  } catch {
    return null
  }
}
