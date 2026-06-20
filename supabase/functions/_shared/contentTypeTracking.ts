/**
 * Content Type System - Phase B: Tracking & Analytics
 * 
 * Calculates type staleness and drift for content variety optimization.
 * This phase LOGS results only - no behavior changes yet.
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import {
  ContentType,
  TypeMix,
  TypeStaleness,
  TypeDrift,
  DEFAULT_TYPE_MIX,
  validateTypeMix,
} from './contentTypeSystem.ts';

/**
 * Calculate type staleness based on historical posts
 * 
 * @param supabaseClient - Supabase client with service role access
 * @param businessId - Business UUID
 * @param lookbackWeeks - How many weeks to look back (default 8)
 * @returns Array of staleness scores per type
 */
export async function calculateTypeStaleness(
  supabaseClient: SupabaseClient,
  businessId: string,
  lookbackWeeks = 8
): Promise<TypeStaleness[]> {
  const lookbackDate = new Date();
  lookbackDate.setDate(lookbackDate.getDate() - lookbackWeeks * 7);
  
  // Fetch recent posts with content_type
  const { data: recentPlans, error } = await supabaseClient
    .from('weekly_content_plans')
    .select('posts, created_at')
    .eq('business_id', businessId)
    .gte('week_start', lookbackDate.toISOString().split('T')[0])
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('[calculateTypeStaleness] Error fetching plans:', error);
    return [];
  }
  
  // Extract all posts with content_type
  const postsWithType: { content_type: ContentType; created_at: string }[] = [];
  
  recentPlans?.forEach((plan: any) => {
    if (Array.isArray(plan.posts)) {
      plan.posts.forEach((post: any) => {
        if (post.content_type) {
          postsWithType.push({
            content_type: post.content_type as ContentType,
            created_at: plan.created_at,
          });
        }
      });
    }
  });
  
  // Calculate staleness per type
  const allTypes: ContentType[] = ['PRODUCT', 'EXPERIENCE', 'OCCASION', 'RETENTION'];
  const now = new Date();
  
  const staleness: TypeStaleness[] = allTypes.map(type => {
    const postsOfType = postsWithType.filter(p => p.content_type === type);
    
    if (postsOfType.length === 0) {
      // Never used - maximum staleness
      return {
        type,
        lastUsed: null,
        daysSince: null,
        priority: 1.0,
      };
    }
    
    // Find most recent post of this type
    const mostRecent = postsOfType.reduce((latest, current) => {
      return new Date(current.created_at) > new Date(latest.created_at) ? current : latest;
    });
    
    const daysSince = Math.floor(
      (now.getTime() - new Date(mostRecent.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    // Priority increases linearly with days (cap at 30 days = 1.0)
    const priority = Math.min(daysSince / 30, 1.0);
    
    return {
      type,
      lastUsed: mostRecent.created_at,
      daysSince,
      priority,
    };
  });
  
  return staleness;
}

/**
 * Calculate type drift (actual vs target distribution)
 * 
 * @param supabaseClient - Supabase client
 * @param businessId - Business UUID
 * @param targetMix - Target type distribution (from business_brand_profile)
 * @param lookbackWeeks - How many weeks to analyze (default 8)
 * @returns Array of drift calculations per type
 */
export async function calculateTypeDrift(
  supabaseClient: SupabaseClient,
  businessId: string,
  targetMix: TypeMix,
  lookbackWeeks = 8
): Promise<TypeDrift[]> {
  const lookbackDate = new Date();
  lookbackDate.setDate(lookbackDate.getDate() - lookbackWeeks * 7);
  
  // Validate target mix
  if (!validateTypeMix(targetMix)) {
    console.warn('[calculateTypeDrift] Invalid target mix, using defaults:', targetMix);
    targetMix = { ...DEFAULT_TYPE_MIX };
  }
  
  // Fetch recent posts
  const { data: recentPlans, error } = await supabaseClient
    .from('weekly_content_plans')
    .select('posts')
    .eq('business_id', businessId)
    .gte('week_start', lookbackDate.toISOString().split('T')[0]);
  
  if (error) {
    console.error('[calculateTypeDrift] Error fetching plans:', error);
    return [];
  }
  
  // Count posts per type
  const typeCounts: Record<ContentType, number> = {
    PRODUCT: 0,
    EXPERIENCE: 0,
    OCCASION: 0,
    RETENTION: 0,
  };
  
  let totalPosts = 0;
  
  recentPlans?.forEach((plan: any) => {
    if (Array.isArray(plan.posts)) {
      plan.posts.forEach((post: any) => {
        if (post.content_type) {
          const type = post.content_type as ContentType;
          typeCounts[type]++;
          totalPosts++;
        }
      });
    }
  });
  
  // If no posts with types yet, return zero drift with maximum correction
  if (totalPosts === 0) {
    return ['PRODUCT', 'EXPERIENCE', 'OCCASION', 'RETENTION'].map(type => ({
      type: type as ContentType,
      target: targetMix[type.toLowerCase() as keyof TypeMix],
      actual: 0,
      drift: -targetMix[type.toLowerCase() as keyof TypeMix],
      correction: 2.0, // Maximum correction - all types maximally underrepresented
    }));
  }
  
  // Calculate drift per type
  const drift: TypeDrift[] = (['PRODUCT', 'EXPERIENCE', 'OCCASION', 'RETENTION'] as ContentType[]).map(type => {
    const typeKey = type.toLowerCase() as keyof TypeMix;
    const target = targetMix[typeKey];
    const actual = typeCounts[type] / totalPosts;
    const driftValue = actual - target;
    
    // Correction factor: if under-represented, increase priority; if over, decrease
    // Scale: -0.5 to +0.5 drift → 0.0 to 2.0 correction multiplier
    const correction = Math.max(0.0, Math.min(2.0, 1.0 - driftValue * 2));
    
    return {
      type,
      target,
      actual,
      drift: driftValue,
      correction,
    };
  });
  
  return drift;
}

/**
 * Get combined staleness + drift report for logging
 * 
 * @param supabaseClient - Supabase client
 * @param businessId - Business UUID
 * @param targetMix - Target type distribution
 * @returns Combined analytics object
 */
export async function getTypeAnalytics(
  supabaseClient: SupabaseClient,
  businessId: string,
  targetMix: TypeMix = { ...DEFAULT_TYPE_MIX }
) {
  const [staleness, drift] = await Promise.all([
    calculateTypeStaleness(supabaseClient, businessId),
    calculateTypeDrift(supabaseClient, businessId, targetMix),
  ]);
  
  // Combine into single report
  const analytics = {
    staleness: staleness.map(s => ({
      type: s.type,
      last_used: s.lastUsed,
      days_since: s.daysSince,
      staleness_priority: s.priority.toFixed(2),
    })),
    drift: drift.map(d => ({
      type: d.type,
      target_pct: (d.target * 100).toFixed(1) + '%',
      actual_pct: (d.actual * 100).toFixed(1) + '%',
      drift_pct: (d.drift * 100).toFixed(1) + '%',
      correction_multiplier: d.correction.toFixed(2),
    })),
    summary: {
      most_stale: staleness.length > 0 
        ? staleness.reduce((max, current) => 
            current.priority > max.priority ? current : max
          ).type
        : 'PRODUCT',
      most_underrepresented: drift.length > 0
        ? drift.reduce((max, current) => 
            current.drift < max.drift ? current : max
          ).type
        : 'PRODUCT',
    },
  };
  
  return analytics;
}
