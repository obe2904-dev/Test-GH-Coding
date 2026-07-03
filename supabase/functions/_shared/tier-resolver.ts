// supabase/functions/_shared/tier-resolver.ts
// Single source of truth for subscription tier resolution
// Eliminates inconsistency between businesses.stripe_subscription_tier and business_tiers.subscription_tier

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export type TierName = 'free' | 'standardplus' | 'premium'
export type LegacyTierName = 'smart' | 'pro'

export interface TierResolution {
  /** Raw tier from database */
  tier: TierName
  /** True if standardplus or premium */
  isPaidTier: boolean
  /** True if premium */
  isProTier: boolean
  /** Legacy tier name for weekly strategies ('smart' | 'pro') */
  legacyTier: LegacyTierName
}

/**
 * Resolves subscription tier for a business from the authoritative source.
 * 
 * Single source of truth: businesses.stripe_subscription_tier
 * 
 * @param supabase - Supabase client (service role or user context)
 * @param businessId - Business UUID
 * @returns Tier resolution with all derived flags
 */
export async function getBusinessTier(
  supabase: SupabaseClient,
  businessId: string
): Promise<TierResolution> {
  const { data, error } = await supabase
    .from('businesses')
    .select('stripe_subscription_tier, stripe_subscription_status')
    .eq('id', businessId)
    .single()

  if (error) {
    console.warn(`[tier-resolver] Failed to fetch tier for ${businessId}:`, error.message)
    // Graceful degradation: default to free tier
    return {
      tier: 'free',
      isPaidTier: false,
      isProTier: false,
      legacyTier: 'smart',
    }
  }

  // Map stripe tier to internal tier system
  const rawTier = data?.stripe_subscription_tier as TierName | null
  const tier: TierName = rawTier || 'free'

  // Derive flags
  const isPaidTier = tier === 'standardplus' || tier === 'premium'
  const isProTier = tier === 'premium'
  
  // Map to legacy tier names used in weekly strategies
  const legacyTier: LegacyTierName = tier === 'premium' ? 'pro' : 'smart'

  console.log(`[tier-resolver] Business ${businessId}: tier=${tier}, isPaid=${isPaidTier}, isPro=${isProTier}, legacy=${legacyTier}`)

  return {
    tier,
    isPaidTier,
    isProTier,
    legacyTier,
  }
}

/**
 * Validates subscription status and returns whether the subscription is active.
 * 
 * @param status - Stripe subscription status
 * @returns True if subscription is active/trialing
 */
export function isSubscriptionActive(status?: string | null): boolean {
  if (!status) return false
  return status === 'active' || status === 'trialing'
}
