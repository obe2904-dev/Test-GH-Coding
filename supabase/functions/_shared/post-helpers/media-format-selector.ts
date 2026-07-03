/**
 * LAYER 7: MEDIA FORMAT & PLATFORM SELECTOR
 * 
 * Determines optimal media format (photo/carousel/reel/video) and finalizes
 * platform assignment based on:
 * - Content type fit
 * - Historical format performance
 * - Business capacity constraints
 * - Platform availability (from profiles.selected_platforms)
 * - Platform balance enforcement
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface OptimizedPostSlot {
  contentType: string
  opportunity: any
  score: number
  platform: string
  scheduledDate: Date
  dayOfWeek: number
  hour: number
  optimizationReason: string
}

export interface FinalPostSpecification extends OptimizedPostSlot {
  format: 'photo' | 'carousel' | 'reel' | 'video'
  formatReason: string
  platformReason: string
}

interface PerformanceData {
  format_performance?: {
    photo?: { avg_engagement: number }
    carousel?: { avg_engagement: number }
    reel?: { avg_engagement: number }
  }
}

// ============================================================================
// FORMAT PREFERENCES BY CONTENT TYPE
// ============================================================================

const FORMAT_PREFERENCES: Record<string, string[]> = {
  // Menu content - photo first (beauty shots), reel for action, carousel for variety
  menu_highlight: ['photo', 'reel', 'carousel'],
  breakfast_menu: ['photo', 'carousel'],
  lunch_menu: ['photo', 'carousel'],
  dinner_menu: ['photo', 'reel', 'carousel'],
  
  // Location & atmosphere - reel for ambiance with sound, photo for static beauty
  location_story: ['photo', 'reel'],
  atmosphere: ['reel', 'photo'],
  
  // Behind-scenes - reel for action/process, carousel for step-by-step, photo for moments
  behind_scenes: ['reel', 'carousel', 'photo'],
  
  // Engagement - keep simple with photo or carousel
  engagement: ['photo', 'carousel'],
  
  // Events - carousel for multiple aspects, photo for single announcement
  event_promotion: ['carousel', 'photo', 'reel'],
  
  // Location announcements (MFV) - photo is fastest
  location_announcement: ['photo'],
}

/**
 * Get format preferences for content type
 */
function getContentFormatPreference(contentType: string): string[] {
  return FORMAT_PREFERENCES[contentType] || ['photo']
}

// ============================================================================
// PLATFORM-FORMAT COMPATIBILITY
// ============================================================================

const PLATFORM_FORMATS: Record<string, string[]> = {
  instagram: ['photo', 'carousel', 'reel'],
  facebook: ['photo', 'carousel', 'reel'],
  tiktok: ['video', 'reel'],
  linkedin: ['photo', 'carousel'],
}

/**
 * Check if platform supports format
 */
function isPlatformCompatible(platform: string, format: string): boolean {
  const supportedFormats = PLATFORM_FORMATS[platform] || ['photo']
  return supportedFormats.includes(format)
}

// ============================================================================
// HISTORICAL PERFORMANCE ANALYSIS
// ============================================================================

/**
 * Check if Reels should be prioritized based on performance
 * Returns true if Reels perform +40% better than photos
 */
function shouldIncreaseReels(performanceData: PerformanceData | null): boolean {
  if (!performanceData || !performanceData.format_performance) {
    return false
  }
  
  const reelEngagement = performanceData.format_performance.reel?.avg_engagement
  const photoEngagement = performanceData.format_performance.photo?.avg_engagement
  
  if (!reelEngagement || !photoEngagement) {
    return false
  }
  
  // If Reels perform +40% better, increase frequency
  return reelEngagement > photoEngagement * 1.4
}

// ============================================================================
// CAPACITY CONSTRAINTS
// ============================================================================

/**
 * Enforce capacity constraints on Reel production
 * Max 40% Reels for small businesses (FSE, SBO)
 * Max 50% Reels for larger businesses
 */
function respectCapacityConstraints(
  proposedFormat: string,
  recentFormats: string[],
  businessType: string
): string {
  if (proposedFormat !== 'reel') {
    return proposedFormat
  }
  
  if (recentFormats.length === 0) {
    return proposedFormat // No history, allow Reel
  }
  
  // Count recent Reels (last 10 posts)
  const reelCount = recentFormats.filter(f => f === 'reel').length
  const reelPercentage = reelCount / recentFormats.length
  
  // Max percentages by business type
  const maxReelPercentage = ['FSE', 'SBO'].includes(businessType) ? 0.4 : 0.5
  
  if (reelPercentage >= maxReelPercentage) {
    return 'photo' // Fallback to photo (safest, fastest)
  }
  
  return proposedFormat
}

// ============================================================================
// PLATFORM AVAILABILITY
// ============================================================================

/**
 * Get business's available platforms from profiles.selected_platforms
 */
async function getAvailablePlatforms(
  userId: string,
  supabaseClient: any
): Promise<string[]> {
  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('selected_platforms')
    .eq('id', userId)
    .single()
  
  return profile?.selected_platforms || ['instagram'] // Default to Instagram
}

// ============================================================================
// PLATFORM BALANCE ENFORCEMENT
// ============================================================================

/**
 * Enforce platform balancing rules:
 * 1. No more than 3 consecutive posts to same platform
 * 2. No platform neglected for >7 posts
 */
function enforceBalancing(
  proposedPlatform: string,
  recentPlatforms: string[],
  availablePlatforms: string[]
): string {
  if (availablePlatforms.length === 1) {
    return availablePlatforms[0] // Single platform - no balancing needed
  }
  
  if (recentPlatforms.length === 0) {
    return proposedPlatform // No history, use proposed
  }
  
  // Rule 1: Last 3 posts all same platform?
  const last3 = recentPlatforms.slice(-3)
  if (last3.length === 3 && last3.every(p => p === last3[0])) {
    // Force switch to different platform
    const otherPlatforms = availablePlatforms.filter(p => p !== last3[0])
    if (otherPlatforms.length > 0) {
      return otherPlatforms[0]
    }
  }
  
  // Rule 2: Platform neglected (not used in last 7)?
  const last7 = recentPlatforms.slice(-7)
  for (const platform of availablePlatforms) {
    if (!last7.includes(platform) && last7.length >= 7) {
      // This platform hasn't been used in 7 posts
      return platform
    }
  }
  
  return proposedPlatform
}

// ============================================================================
// REASON GENERATION
// ============================================================================

/**
 * Generate human-readable explanation of format choice
 */
function generateFormatReason(
  format: string,
  contentType: string,
  performanceDriven: boolean
): string {
  const reasons: Record<string, string> = {
    photo: 'Single image for quick production and clear focus',
    carousel: 'Multiple images to showcase variety',
    reel: 'Short video for dynamic content and high engagement',
    video: 'Video format for platform requirements',
  }
  
  let reason = reasons[format] || 'Optimal format for content type'
  
  if (format === 'reel' && performanceDriven) {
    reason += ' (Reels performing +40% better for this business)'
  }
  
  return reason
}

/**
 * Generate human-readable explanation of platform choice
 */
function generatePlatformReason(
  platform: string,
  format: string,
  wasEnforced: boolean
): string {
  if (wasEnforced) {
    return `Assigned to ${platform} for platform balance (preventing neglect)`
  }
  
  const reasons: Record<string, string> = {
    instagram: 'Instagram optimized for visual content',
    facebook: 'Facebook for community engagement',
    tiktok: 'TikTok for video-first content',
    linkedin: 'LinkedIn for professional audience',
  }
  
  return reasons[platform] || `Posted to ${platform}`
}

// ============================================================================
// MAIN SELECTION FUNCTION
// ============================================================================

/**
 * Select media format and finalize platform assignment
 */
export async function selectMediaFormatAndPlatform(
  optimizedSlot: OptimizedPostSlot,
  businessId: string,
  userId: string,
  supabaseClient: any
): Promise<FinalPostSpecification> {
  
  // Fetch business context
  const { data: profile } = await supabaseClient
    .from('business_profile')
    .select('business_type')
    .eq('business_id', businessId)
    .single()
  
  const businessType = profile?.business_type || 'FSE'
  
  // Fetch available platforms
  const availablePlatforms = await getAvailablePlatforms(userId, supabaseClient)
  
  // Fetch recent performance data
  const { data: performanceLog } = await supabaseClient
    .from('content_performance_log')
    .select('format, platform')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(10)
  
  const recentFormats = performanceLog?.map((p: any) => p.format) || []
  const recentPlatforms = performanceLog?.map((p: any) => p.platform) || []
  
  // Fetch format performance baselines
  const { data: baselines } = await supabaseClient
    .from('content_type_baselines')
    .select('format_performance')
    .eq('business_id', businessId)
    .single()
  
  const performanceData: PerformanceData | null = baselines || null
  
  // ============================================================================
  // PHASE 1: FORMAT SELECTION
  // ============================================================================
  
  // Step 1: Get content type preferences
  const formatPreferences = getContentFormatPreference(optimizedSlot.contentType)
  
  // Step 2: Check if Reels should be prioritized
  const shouldPrioritizeReels = shouldIncreaseReels(performanceData)
  
  let selectedFormat = formatPreferences[0] // Default to first preference
  
  if (shouldPrioritizeReels && formatPreferences.includes('reel')) {
    selectedFormat = 'reel'
  }
  
  // Step 3: Apply capacity constraints
  selectedFormat = respectCapacityConstraints(
    selectedFormat,
    recentFormats,
    businessType
  )
  
  // ============================================================================
  // PHASE 2: PLATFORM FINALIZATION
  // ============================================================================
  
  let finalPlatform = optimizedSlot.platform
  let wasEnforced = false
  
  // Step 1: Check if proposed platform is available
  if (!availablePlatforms.includes(finalPlatform)) {
    finalPlatform = availablePlatforms[0] // Use first available
  }
  
  // Step 2: Check format compatibility with platform
  if (!isPlatformCompatible(finalPlatform, selectedFormat)) {
    // Find compatible platform
    const compatiblePlatform = availablePlatforms.find(p => 
      isPlatformCompatible(p, selectedFormat)
    )
    if (compatiblePlatform) {
      finalPlatform = compatiblePlatform
    } else {
      // No compatible platform - fallback format
      selectedFormat = 'photo' // Photo works on all platforms
    }
  }
  
  // Step 3: Apply balance enforcement
  const balancedPlatform = enforceBalancing(
    finalPlatform,
    recentPlatforms,
    availablePlatforms
  )
  
  if (balancedPlatform !== finalPlatform) {
    wasEnforced = true
    finalPlatform = balancedPlatform
    
    // Recheck format compatibility after balancing
    if (!isPlatformCompatible(finalPlatform, selectedFormat)) {
      selectedFormat = 'photo' // Safe fallback
    }
  }
  
  // Generate reasons
  const formatReason = generateFormatReason(
    selectedFormat,
    optimizedSlot.contentType,
    shouldPrioritizeReels
  )
  
  const platformReason = generatePlatformReason(
    finalPlatform,
    selectedFormat,
    wasEnforced
  )
  
  return {
    ...optimizedSlot,
    format: selectedFormat as 'photo' | 'carousel' | 'reel' | 'video',
    platform: finalPlatform,
    formatReason,
    platformReason,
  }
}

// ============================================================================
// EXPORT FOR TESTING
// ============================================================================

export const testHelpers = {
  getContentFormatPreference,
  isPlatformCompatible,
  shouldIncreaseReels,
  respectCapacityConstraints,
  enforceBalancing,
  generateFormatReason,
  generatePlatformReason,
  FORMAT_PREFERENCES,
  PLATFORM_FORMATS,
}
