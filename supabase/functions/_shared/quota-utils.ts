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
type QuotaPeriod = 'daily' | 'monthly'

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
  },
  standardplus: {
    aiGenerations: { daily: 100, monthly: 1000 },
    pdfUploads: { daily: 20, monthly: 200 },
    websiteAnalysis: { daily: 20, monthly: 200 },
  },
  premium: {
    aiGenerations: { daily: -1, monthly: -1 },
    pdfUploads: { daily: -1, monthly: -1 },
    websiteAnalysis: { daily: -1, monthly: -1 },
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
const columnMap: Record<QuotaType, Record<QuotaPeriod, UsageColumn>> = {
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

  // Get user's business (as owner or team member)
  const { data: business } = await supabase
    .from('businesses')
    .select('id, plan, ai_generations_today, ai_generations_this_month, pdf_uploads_today, pdf_uploads_this_month, website_analysis_today, website_analysis_this_month')
    .eq('owner_id', userId)
    .maybeSingle()

  let businessData = business as BusinessUsage | null

  // If not owner, check if team member
  if (!businessData) {
    const { data: teamMember } = await supabase
      .from('business_team_members')
      .select('business_id')
      .eq('user_id', userId)
      .not('accepted_at', 'is', null)
      .maybeSingle()

    if (teamMember) {
      const { data: teamBusiness } = await supabase
        .from('businesses')
        .select('id, plan, ai_generations_today, ai_generations_this_month, pdf_uploads_today, pdf_uploads_this_month, website_analysis_today, website_analysis_this_month')
        .eq('id', teamMember.business_id)
        .maybeSingle()
      
      businessData = teamBusiness as BusinessUsage | null
    }
  }

  if (!businessData) {
    return {
      allowed: false,
      tier: 'free',
      current: 0,
      limit: 0,
      reason: 'No business found for user'
    }
  }

  // Get tier from business plan
  const tier: UserTier = (businessData.plan as UserTier) || 'free'
  
  // Get usage from the correct column
  const columnKey = columnMap[quotaType][period]
  const current = Number((businessData as any)[columnKey] ?? 0)
  const limit = TIER_QUOTAS[tier][quotaType][period]
  const isUnlimited = limit === -1
  
  return {
    allowed: isUnlimited || current < limit,
    tier,
    current,
    limit: isUnlimited ? -1 : limit,
    reason: isUnlimited || current < limit 
      ? undefined 
      : `${period === 'daily' ? 'Daily' : 'Monthly'} quota exceeded (${current}/${limit})`
  }
}

/**
 * Increment usage counter in database (at business level)
 */
export async function incrementQuota(
  userId: string,
  _quotaType: QuotaType
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

  // Increment both daily and monthly counters at business level
  const { error } = await supabase.rpc('increment_ai_generation_business', { business_uuid: businessId })
  
  if (error) {
    console.error('Failed to increment business quota:', error)
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
