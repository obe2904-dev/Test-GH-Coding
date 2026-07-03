/**
 * PERFORMANCE TRACKING API
 * 
 * Functions for logging and analyzing post performance.
 * Ready for Instagram/Facebook API integration.
 * 
 * INTEGRATION POINTS:
 * - Call logPostPerformance() after fetching metrics from platforms
 * - Call recalculateBaselines() periodically (daily cron job)
 * - Call getPerformanceAdjustedDistribution() when generating content
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// =====================================================
// TYPES
// =====================================================

export interface PerformanceMetrics {
  reach: number
  impressions?: number // Will default to reach if not provided
  likes: number
  comments: number
  shares: number
  saves?: number // Instagram saves
  clicks?: number // Link clicks
}

export interface PostPerformanceData {
  businessId: string
  postIdeaId?: string // If from post_ideas table
  contentType: string // 'menu_highlight', 'atmosphere_experience', etc.
  platform: 'instagram' | 'facebook' | 'both'
  postedAt: Date
  metrics: PerformanceMetrics
  
  // Optional context (helps learning)
  menuItemsFeatured?: string[]
  locationHooks?: string[]
  weatherCondition?: string
  visualStyle?: string
}

export interface ContentTypeBaseline {
  contentType: string
  avgEngagementRate: number
  avgReach: number
  sampleSize: number
  bestTime?: string
  bestDay?: number
  topPerformingItems?: string[]
  variance: number
}

export interface PerformanceBaselines {
  businessId: string
  overallAvgEngagementRate: number
  overallAvgReach: number
  totalPostsAnalyzed: number
  sufficientData: boolean // TRUE when >= 20 posts
  contentTypeBaselines: Record<string, ContentTypeBaseline>
  platformBaselines: Record<string, {
    avgEngagementRate: number
    avgReach: number
    bestPostingTimes?: string[]
    bestDays?: number[]
  }>
  lastCalculated: Date
}

export interface AdjustedDistribution {
  contentType: string
  baselinePercentage: number
  adjustedPercentage: number
  adjustmentReason: string
  priority: number
}

// =====================================================
// MAIN API FUNCTIONS
// =====================================================

/**
 * Log post performance data
 * 
 * Call this after fetching metrics from Instagram/Facebook API
 * 
 * @example
 * // After fetching from Instagram Insights API
 * await logPostPerformance({
 *   businessId: 'uuid',
 *   contentType: 'menu_highlight',
 *   platform: 'instagram',
 *   postedAt: new Date('2026-01-25T10:30:00Z'),
 *   metrics: {
 *     reach: 1247,
 *     likes: 87,
 *     comments: 12,
 *     shares: 5,
 *     saves: 23,
 *     clicks: 14
 *   },
 *   menuItemsFeatured: ['Burger', 'Fries']
 * })
 */
export async function logPostPerformance(
  data: PostPerformanceData
): Promise<string | null> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('[Performance] Missing Supabase credentials')
      return null
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    const { data: logId, error } = await supabase.rpc('log_post_performance', {
      p_business_id: data.businessId,
      p_post_idea_id: data.postIdeaId || null,
      p_content_type: data.contentType,
      p_platform: data.platform,
      p_posted_at: data.postedAt.toISOString(),
      p_reach: data.metrics.reach,
      p_engagement: data.metrics.likes + data.metrics.comments + data.metrics.shares + (data.metrics.saves || 0),
      p_likes: data.metrics.likes,
      p_comments: data.metrics.comments,
      p_shares: data.metrics.shares,
      p_saves: data.metrics.saves || 0,
      p_clicks: data.metrics.clicks || 0
    })
    
    if (error) {
      console.error('[Performance] Failed to log performance:', error)
      return null
    }
    
    console.log(`[Performance] Logged performance for ${data.contentType} on ${data.platform}`)
    
    // If we have context data, update the log entry
    if (data.menuItemsFeatured || data.locationHooks || data.weatherCondition || data.visualStyle) {
      await supabase
        .from('content_performance_log')
        .update({
          menu_items_featured: data.menuItemsFeatured || null,
          location_hooks: data.locationHooks || null,
          weather_condition: data.weatherCondition || null,
          visual_style: data.visualStyle || null
        })
        .eq('id', logId)
    }
    
    return logId
  } catch (error) {
    console.error('[Performance] Exception in logPostPerformance:', error)
    return null
  }
}

/**
 * Recalculate baselines from performance log
 * 
 * Call this:
 * - After logging new performance data
 * - Daily via cron job
 * - When user requests updated insights
 * 
 * @example
 * // In a daily cron job
 * for (const businessId of activeBusinessIds) {
 *   await recalculateBaselines(businessId)
 * }
 */
export async function recalculateBaselines(
  businessId: string
): Promise<PerformanceBaselines | null> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('[Performance] Missing Supabase credentials')
      return null
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    const { data, error } = await supabase.rpc('calculate_content_baselines', {
      p_business_id: businessId
    })
    
    if (error) {
      console.error('[Performance] Failed to calculate baselines:', error)
      return null
    }
    
    console.log(`[Performance] Calculated baselines for business ${businessId}`)
    console.log(`  → ${data.total_posts_analyzed} posts analyzed`)
    console.log(`  → Overall engagement: ${data.overall_avg_engagement_rate}%`)
    console.log(`  → Sufficient data: ${data.sufficient_data}`)
    
    // Parse and return structured data
    const baselines: PerformanceBaselines = {
      businessId,
      overallAvgEngagementRate: data.overall_avg_engagement_rate,
      overallAvgReach: data.overall_avg_reach,
      totalPostsAnalyzed: data.total_posts_analyzed,
      sufficientData: data.sufficient_data,
      contentTypeBaselines: parseContentTypeBaselines(data.baselines),
      platformBaselines: parsePlatformBaselines(data.platform_baselines),
      lastCalculated: new Date()
    }
    
    return baselines
  } catch (error) {
    console.error('[Performance] Exception in recalculateBaselines:', error)
    return null
  }
}

/**
 * Get performance-adjusted content distribution
 * 
 * Returns Layer 2 distribution adjusted by actual performance.
 * Falls back to static baselines if insufficient data.
 * 
 * Use this instead of static content_distribution_rules when generating content.
 * 
 * @example
 * const distribution = await getPerformanceAdjustedDistribution(businessId, 'FSE')
 * 
 * // If data exists:
 * // menu_highlight: 40% → 48% (high performer, +20%)
 * // atmosphere: 25% → 20% (low performer, -20%)
 * 
 * // If no data yet:
 * // Returns Layer 2 defaults unchanged
 */
export async function getPerformanceAdjustedDistribution(
  businessId: string,
  businessType: string
): Promise<AdjustedDistribution[]> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('[Performance] Missing Supabase credentials')
      return []
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    const { data, error } = await supabase.rpc('get_performance_adjusted_distribution', {
      p_business_id: businessId,
      p_business_type: businessType
    })
    
    if (error) {
      console.error('[Performance] Failed to get adjusted distribution:', error)
      return []
    }
    
    const distribution: AdjustedDistribution[] = data.map((row: any) => ({
      contentType: row.content_type,
      baselinePercentage: parseFloat(row.baseline_percentage),
      adjustedPercentage: parseFloat(row.adjusted_percentage),
      adjustmentReason: row.adjustment_reason,
      priority: row.priority
    }))
    
    // Log adjustments for debugging
    const hasAdjustments = distribution.some(d => 
      Math.abs(d.adjustedPercentage - d.baselinePercentage) > 0.01
    )
    
    if (hasAdjustments) {
      console.log(`[Performance] Distribution adjusted for ${businessId}:`)
      for (const item of distribution) {
        if (Math.abs(item.adjustedPercentage - item.baselinePercentage) > 0.01) {
          console.log(`  → ${item.contentType}: ${item.baselinePercentage}% → ${item.adjustedPercentage}% (${item.adjustmentReason})`)
        }
      }
    } else {
      console.log(`[Performance] Using default baselines for ${businessId} (insufficient data)`)
    }
    
    return distribution
  } catch (error) {
    console.error('[Performance] Exception in getPerformanceAdjustedDistribution:', error)
    return []
  }
}

/**
 * Get current baselines for a business
 * 
 * Use this to show performance insights in UI
 */
export async function getBaselines(
  businessId: string
): Promise<PerformanceBaselines | null> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseKey) {
      return null
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    const { data, error } = await supabase
      .from('content_type_baselines')
      .select('*')
      .eq('business_id', businessId)
      .single()
    
    if (error || !data) {
      return null
    }
    
    return {
      businessId,
      overallAvgEngagementRate: data.overall_avg_engagement_rate,
      overallAvgReach: data.overall_avg_reach,
      totalPostsAnalyzed: data.total_posts_analyzed,
      sufficientData: data.sufficient_data,
      contentTypeBaselines: parseContentTypeBaselines(data.baselines),
      platformBaselines: parsePlatformBaselines(data.platform_baselines),
      lastCalculated: new Date(data.last_calculated)
    }
  } catch (error) {
    console.error('[Performance] Exception in getBaselines:', error)
    return null
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function parseContentTypeBaselines(jsonb: any): Record<string, ContentTypeBaseline> {
  const result: Record<string, ContentTypeBaseline> = {}
  
  if (!jsonb || typeof jsonb !== 'object') {
    return result
  }
  
  for (const [type, data] of Object.entries(jsonb)) {
    const typeData = data as any
    result[type] = {
      contentType: type,
      avgEngagementRate: typeData.avg_engagement_rate || 0,
      avgReach: typeData.avg_reach || 0,
      sampleSize: typeData.sample_size || 0,
      bestTime: typeData.best_time,
      bestDay: typeData.best_day,
      topPerformingItems: typeData.top_performing_items || [],
      variance: typeData.variance || 0
    }
  }
  
  return result
}

function parsePlatformBaselines(jsonb: any): Record<string, any> {
  if (!jsonb || typeof jsonb !== 'object') {
    return {}
  }
  
  return jsonb
}

// =====================================================
// INTEGRATION PLACEHOLDER FUNCTIONS
// =====================================================
// These will be implemented when Instagram/Facebook API is integrated

/**
 * PLACEHOLDER: Fetch performance from Instagram Insights API
 * 
 * Implementation needed:
 * 1. Get Instagram Business Account ID
 * 2. Call /insights endpoint with metrics: reach, impressions, engagement
 * 3. Call /media/{id}/insights for specific post metrics
 * 4. Parse response and call logPostPerformance()
 * 
 * @see https://developers.facebook.com/docs/instagram-api/reference/ig-media/insights
 */
export async function fetchInstagramInsights(
  instagramAccountId: string,
  postId: string
): Promise<PerformanceMetrics | null> {
  // TODO: Implement Instagram Insights API integration
  console.log('[Performance] Instagram Insights API not yet implemented')
  console.log('  → Account:', instagramAccountId)
  console.log('  → Post:', postId)
  console.log('  → Metrics needed: reach, impressions, engagement, likes, comments, saves')
  
  return null
}

/**
 * PLACEHOLDER: Fetch performance from Facebook Graph API
 * 
 * Implementation needed:
 * 1. Get Page ID and post ID
 * 2. Call /{post-id}/insights with metrics: post_impressions, post_engaged_users
 * 3. Call /{post-id}?fields=reactions,comments,shares
 * 4. Parse response and call logPostPerformance()
 * 
 * @see https://developers.facebook.com/docs/graph-api/reference/v19.0/insights
 */
export async function fetchFacebookInsights(
  pageId: string,
  postId: string
): Promise<PerformanceMetrics | null> {
  // TODO: Implement Facebook Graph API integration
  console.log('[Performance] Facebook Graph API not yet implemented')
  console.log('  → Page:', pageId)
  console.log('  → Post:', postId)
  console.log('  → Metrics needed: reach, impressions, reactions, comments, shares, link_clicks')
  
  return null
}

/**
 * PLACEHOLDER: Batch fetch performance for recent posts
 * 
 * Implementation needed:
 * 1. Query posts from last 7-30 days
 * 2. For each post, fetch metrics from platform API
 * 3. Call logPostPerformance() for each
 * 4. Call recalculateBaselines() after batch complete
 * 
 * Trigger: Daily cron job
 */
export async function batchFetchRecentPerformance(
  businessId: string
): Promise<number> {
  // TODO: Implement batch performance fetching
  console.log('[Performance] Batch performance fetching not yet implemented')
  console.log('  → Business:', businessId)
  console.log('  → Will fetch all posts from last 30 days')
  console.log('  → Will call Instagram + Facebook APIs')
  
  return 0 // Return count of posts updated
}

// =====================================================
// EXPORT
// =====================================================

export default {
  logPostPerformance,
  recalculateBaselines,
  getPerformanceAdjustedDistribution,
  getBaselines,
  
  // Placeholders for future implementation
  fetchInstagramInsights,
  fetchFacebookInsights,
  batchFetchRecentPerformance
}
