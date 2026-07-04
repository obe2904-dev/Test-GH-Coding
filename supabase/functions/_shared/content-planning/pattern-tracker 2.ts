// supabase/functions/_shared/content-planning/pattern-tracker.ts
// Pattern tracking: analyzes recent posting patterns to ensure variety
// Prevents repetitive content types and identifies posting gaps

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Content pattern summary for a time period
 */
export interface PatternSummary {
  weekday: number  // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  weekdayName: string  // 'Monday', 'Tuesday', etc.
  content_type: string  // 'product', 'experience', 'atmosphere', etc.
  count: number  // How many posts of this type on this weekday
}

/**
 * Pattern analysis result
 */
export interface PatternAnalysis {
  recentPatterns: PatternSummary[]  // Pattern summary by weekday
  overusedTypes: string[]  // Content types posted too frequently (>40% of total)
  underusedTypes: string[]  // Content types never or rarely posted (<10% of total)
  recommendedTypes: string[]  // Content types that should be posted next for balance
  daysSinceLastPost: number | null  // Days since last post (any type)
}

/**
 * Analyze posting patterns over the last N days
 * 
 * Provides insights into content variety and posting cadence.
 * Helps ensure balanced content mix across weekdays.
 * 
 * @param supabase - Supabase client instance
 * @param businessId - Business UUID
 * @param lookbackDays - How many days to analyze (default: 14)
 * @returns Pattern analysis with recommendations
 * 
 * @example
 * ```ts
 * const analysis = await analyzePostingPatterns(supabase, businessId, 14)
 * 
 * if (analysis.overusedTypes.includes('product')) {
 *   console.log('Too many product posts recently, suggest experience/atmosphere')
 * }
 * 
 * // Use recommendedTypes to pick next content type
 * const nextType = analysis.recommendedTypes[0] || 'product'
 * ```
 */
export async function analyzePostingPatterns(
  supabase: SupabaseClient,
  businessId: string,
  lookbackDays: number = 14
): Promise<PatternAnalysis> {
  
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - lookbackDays)

  // Step 1: Fetch recent posts with content_type
  // Uses idx_posts_pattern_history (business_id, posted_at DESC, content_type)
  const { data: posts, error } = await supabase
    .from('posts')
    .select('posted_at, content_type, menu_item_name')
    .eq('business_id', businessId)
    .gte('posted_at', cutoffDate.toISOString())
    .not('content_type', 'is', null)
    .order('posted_at', { ascending: false })

  if (error) {
    console.error('❌ Failed to fetch posting patterns:', error)
    // Return empty analysis on error
    return {
      recentPatterns: [],
      overusedTypes: [],
      underusedTypes: [],
      recommendedTypes: ['product', 'experience'],
      daysSinceLastPost: null
    }
  }

  if (!posts || posts.length === 0) {
    console.warn('⚠️ No recent posts found for pattern analysis')
    return {
      recentPatterns: [],
      overusedTypes: [],
      underusedTypes: [],
      recommendedTypes: ['product', 'experience'],
      daysSinceLastPost: null
    }
  }

  // Step 2: Calculate days since last post
  const lastPostDate = new Date(posts[0].posted_at)
  const now = new Date()
  const daysSinceLastPost = Math.floor((now.getTime() - lastPostDate.getTime()) / (1000 * 60 * 60 * 24))

  // Step 3: Group posts by weekday and content_type
  const patternMap = new Map<string, number>()  // Key: "weekday:content_type"
  const typeCount = new Map<string, number>()   // Key: "content_type"

  for (const post of posts) {
    const date = new Date(post.posted_at)
    const weekday = date.getUTCDay()  // 0-6
    const contentType = post.content_type || 'unknown'

    const key = `${weekday}:${contentType}`
    patternMap.set(key, (patternMap.get(key) || 0) + 1)
    typeCount.set(contentType, (typeCount.get(contentType) || 0) + 1)
  }

  // Step 4: Build pattern summary
  const recentPatterns: PatternSummary[] = []
  const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  for (const [key, count] of patternMap.entries()) {
    const [weekdayStr, contentType] = key.split(':')
    const weekday = parseInt(weekdayStr, 10)
    
    recentPatterns.push({
      weekday,
      weekdayName: weekdayNames[weekday],
      content_type: contentType,
      count
    })
  }

  // Sort by weekday, then by count (descending)
  recentPatterns.sort((a, b) => {
    if (a.weekday !== b.weekday) return a.weekday - b.weekday
    return b.count - a.count
  })

  // Step 5: Identify overused and underused content types
  const totalPosts = posts.length
  const allTypes = ['product', 'experience', 'occasion', 'atmosphere', 'retention', 'team']
  
  const overusedTypes: string[] = []
  const underusedTypes: string[] = []

  for (const type of allTypes) {
    const count = typeCount.get(type) || 0
    const percentage = (count / totalPosts) * 100

    if (percentage > 40) {
      overusedTypes.push(type)
    } else if (percentage < 10) {
      underusedTypes.push(type)
    }
  }

  // Step 6: Generate recommendations
  // Recommend underused types first, then types not overused
  const recommendedTypes: string[] = [
    ...underusedTypes,
    ...allTypes.filter(t => !overusedTypes.includes(t) && !underusedTypes.includes(t))
  ]

  return {
    recentPatterns,
    overusedTypes,
    underusedTypes,
    recommendedTypes,
    daysSinceLastPost
  }
}

/**
 * Get posting frequency by weekday
 * Returns which days of the week have the most/least posts
 * 
 * @param supabase - Supabase client instance
 * @param businessId - Business UUID
 * @param lookbackDays - How many days to analyze (default: 30)
 * @returns Array of weekday frequencies sorted by count (descending)
 */
export async function getWeekdayFrequency(
  supabase: SupabaseClient,
  businessId: string,
  lookbackDays: number = 30
): Promise<Array<{ weekday: number; weekdayName: string; count: number }>> {
  
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - lookbackDays)

  const { data: posts, error } = await supabase
    .from('posts')
    .select('posted_at')
    .eq('business_id', businessId)
    .gte('posted_at', cutoffDate.toISOString())

  if (error || !posts) {
    console.error('❌ Failed to fetch weekday frequency:', error)
    return []
  }

  const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const weekdayCount = new Map<number, number>()

  for (const post of posts) {
    const date = new Date(post.posted_at)
    const weekday = date.getUTCDay()
    weekdayCount.set(weekday, (weekdayCount.get(weekday) || 0) + 1)
  }

  const result = Array.from(weekdayCount.entries()).map(([weekday, count]) => ({
    weekday,
    weekdayName: weekdayNames[weekday],
    count
  }))

  // Sort by count descending (most frequent days first)
  result.sort((a, b) => b.count - a.count)

  return result
}

/**
 * Check if specific content patterns should be avoided today
 * Prevents posting the same content_type + weekday combination too often
 * 
 * @param supabase - Supabase client instance
 * @param businessId - Business UUID
 * @param contentType - Content type to check
 * @param targetWeekday - Weekday to check (0-6, default: today)
 * @param lookbackWeeks - How many weeks to look back (default: 4)
 * @returns true if this pattern was already used recently (should avoid)
 */
export async function shouldAvoidPattern(
  supabase: SupabaseClient,
  businessId: string,
  contentType: string,
  targetWeekday?: number,
  lookbackWeeks: number = 4
): Promise<boolean> {
  
  const weekday = targetWeekday ?? new Date().getUTCDay()
  const lookbackDays = lookbackWeeks * 7

  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - lookbackDays)

  // Count how many times this content_type was posted on this weekday
  const { data: posts, error } = await supabase
    .from('posts')
    .select('posted_at')
    .eq('business_id', businessId)
    .eq('content_type', contentType)
    .gte('posted_at', cutoffDate.toISOString())

  if (error || !posts) {
    return false  // Fail open: allow pattern
  }

  // Count occurrences on this weekday
  let occurrences = 0
  for (const post of posts) {
    const date = new Date(post.posted_at)
    if (date.getUTCDay() === weekday) {
      occurrences++
    }
  }

  // Avoid if this pattern appeared 3+ times in the lookback period
  // (e.g., "product on Monday" happened 3+ times in last 4 weeks)
  return occurrences >= 3
}

/**
 * Get recommended content type for next post
 * Balances content variety based on recent posting patterns
 * 
 * @param supabase - Supabase client instance
 * @param businessId - Business UUID
 * @returns Recommended content_type string
 */
export async function getRecommendedContentType(
  supabase: SupabaseClient,
  businessId: string
): Promise<string> {
  
  const analysis = await analyzePostingPatterns(supabase, businessId, 14)
  
  // Return first recommended type, or 'product' as fallback
  return analysis.recommendedTypes[0] || 'product'
}
