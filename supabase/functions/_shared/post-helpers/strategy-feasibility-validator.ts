/**
 * STRATEGY FEASIBILITY VALIDATOR
 * 
 * Validates that Layer 0's strategy suggestions are achievable by the business
 * before passing to Layer 6-9 for execution.
 * 
 * Prevents wasted processing on impossible formats/platforms/timing.
 */

import type { PostIdea } from './weekly-strategy-generator.ts'

// ============================================================================
// TYPES
// ============================================================================

export interface BusinessCapabilities {
  // Platform connections
  connectedPlatforms: string[] // e.g., ['facebook', 'instagram']
  
  // Content production capacity
  canProducePhotos: boolean
  canProduceCarousels: boolean
  canProduceReels: boolean
  canProduceVideos: boolean
  canProduceStories: boolean
  
  // Subscription tier limits
  subscriptionTier: 'free' | 'basic' | 'pro' | 'enterprise'
  maxPostsPerWeek: number
  maxReelsPerWeek: number
  maxVideosPerWeek: number
  
  // Business operations
  businessHours?: {
    [day: string]: { open: string; close: string } | null
  }
  hasStaff: boolean
  hasPhotographer: boolean
  hasVideoEquipment: boolean
  
  // Brand constraints
  bannedWords?: string[]
  requiredCertifications?: string[]
}

export interface ValidationResult {
  feasible: boolean
  criticalErrors: ValidationError[]
  warnings: ValidationWarning[]
  suggestions: string[]
}

export interface ValidationError {
  ideaId: number
  ideaTitle: string
  severity: 'critical' | 'blocking'
  category: 'platform' | 'format' | 'capacity' | 'timing' | 'brand'
  message: string
  suggestedFix: string
}

export interface ValidationWarning {
  ideaId: number
  ideaTitle: string
  category: 'quality' | 'optimization' | 'consistency'
  message: string
  impact: 'low' | 'medium' | 'high'
}

// ============================================================================
// MAIN VALIDATION FUNCTION
// ============================================================================

/**
 * Validate entire strategy against business capabilities
 */
export function validateStrategyFeasibility(
  selectedIdeas: PostIdea[],
  capabilities: BusinessCapabilities
): ValidationResult {
  const criticalErrors: ValidationError[] = []
  const warnings: ValidationWarning[] = []
  const suggestions: string[] = []
  
  console.log('[FeasibilityValidator] Validating', selectedIdeas.length, 'ideas')
  console.log('[FeasibilityValidator] Capabilities:', {
    platforms: capabilities.connectedPlatforms,
    tier: capabilities.subscriptionTier,
    maxPosts: capabilities.maxPostsPerWeek,
    photo: capabilities.canProducePhotos,
    reel: capabilities.canProduceReels,
    video: capabilities.canProduceVideos,
  })
  
  // ========================================================================
  // 1. PLATFORM VALIDATION (DISABLED FOR TESTING)
  // ========================================================================
  
  // 🧪 TESTING MODE: Platform checks disabled
  // Uncomment below to re-enable platform connection validation
  /*
  for (const idea of selectedIdeas) {
    const requestedPlatforms = idea.platforms || []
    const disconnectedPlatforms = requestedPlatforms.filter(
      platform => !capabilities.connectedPlatforms.includes(platform)
    )
    
    if (disconnectedPlatforms.length > 0) {
      criticalErrors.push({
        ideaId: idea.id,
        ideaTitle: idea.title,
        severity: 'critical',
        category: 'platform',
        message: `Cannot post to ${disconnectedPlatforms.join(', ')} - platform not connected`,
        suggestedFix: `Connect ${disconnectedPlatforms[0]} account or regenerate strategy with only connected platforms`
      })
    }
    
    // Check if ALL platforms are disconnected
    if (requestedPlatforms.length > 0 && disconnectedPlatforms.length === requestedPlatforms.length) {
      criticalErrors.push({
        ideaId: idea.id,
        ideaTitle: idea.title,
        severity: 'blocking',
        category: 'platform',
        message: `Idea "${idea.title}" has NO connected platforms`,
        suggestedFix: 'Connect at least one platform before generating posts'
      })
    }
  }
  */
  
  // ========================================================================
  // 2. FORMAT/MEDIA VALIDATION
  // ========================================================================
  
  for (const idea of selectedIdeas) {
    const mediaType = idea.suggested_media?.type || 'photo'
    
    // Map media type to capability check
    const formatCapabilities: Record<string, boolean> = {
      'photo': capabilities.canProducePhotos,
      'carousel': capabilities.canProduceCarousels,
      'reel': capabilities.canProduceReels,
      'video': capabilities.canProduceVideos,
      'story': capabilities.canProduceStories,
    }
    
    const canProduce = formatCapabilities[mediaType]
    
    if (canProduce === false) {
      criticalErrors.push({
        ideaId: idea.id,
        ideaTitle: idea.title,
        severity: 'critical',
        category: 'format',
        message: `Cannot produce ${mediaType} format - business lacks capability`,
        suggestedFix: mediaType === 'video' || mediaType === 'reel' 
          ? 'Upgrade equipment or switch to photo format'
          : 'Enable this format in business settings'
      })
    }
    
    // Warn about video/reel without photographer
    if ((mediaType === 'video' || mediaType === 'reel') && !capabilities.hasPhotographer) {
      warnings.push({
        ideaId: idea.id,
        ideaTitle: idea.title,
        category: 'quality',
        message: `${mediaType} format suggested but no photographer assigned`,
        impact: 'medium'
      })
    }
    
    // Warn about video without equipment
    if ((mediaType === 'video' || mediaType === 'reel') && !capabilities.hasVideoEquipment) {
      warnings.push({
        ideaId: idea.id,
        ideaTitle: idea.title,
        category: 'quality',
        message: `${mediaType} format suggested but no video equipment on file`,
        impact: 'high'
      })
    }
  }
  
  // ========================================================================
  // 3. CAPACITY/TIER VALIDATION (DISABLED FOR TESTING)
  // ========================================================================
  
  // 🧪 TESTING MODE: Tier limits disabled
  // Uncomment below to re-enable subscription tier validation
  /*
  const totalPosts = selectedIdeas.length
  const reelCount = selectedIdeas.filter(i => i.suggested_media?.type === 'reel').length
  const videoCount = selectedIdeas.filter(i => i.suggested_media?.type === 'video').length
  
  if (totalPosts > capabilities.maxPostsPerWeek) {
    criticalErrors.push({
      ideaId: -1,
      ideaTitle: 'Overall Strategy',
      severity: 'blocking',
      category: 'capacity',
      message: `Strategy exceeds post limit: ${totalPosts} posts requested, only ${capabilities.maxPostsPerWeek} allowed on ${capabilities.subscriptionTier} tier`,
      suggestedFix: `Reduce selection to ${capabilities.maxPostsPerWeek} ideas or upgrade subscription`
    })
  }
  
  if (reelCount > capabilities.maxReelsPerWeek) {
    criticalErrors.push({
      ideaId: -1,
      ideaTitle: 'Overall Strategy',
      severity: 'blocking',
      category: 'capacity',
      message: `Too many reels: ${reelCount} suggested, only ${capabilities.maxReelsPerWeek} allowed per week`,
      suggestedFix: 'Reduce reel ideas or upgrade tier for more capacity'
    })
  }
  
  if (videoCount > capabilities.maxVideosPerWeek) {
    criticalErrors.push({
      ideaId: -1,
      ideaTitle: 'Overall Strategy',
      severity: 'blocking',
      category: 'capacity',
      message: `Too many videos: ${videoCount} suggested, only ${capabilities.maxVideosPerWeek} allowed per week`,
      suggestedFix: 'Switch some videos to photos or carousels'
    })
  }
  
  // Warn if approaching limits (80%+ usage)
  if (totalPosts >= capabilities.maxPostsPerWeek * 0.8) {
    warnings.push({
      ideaId: -1,
      ideaTitle: 'Overall Strategy',
      category: 'optimization',
      message: `Using ${Math.round(totalPosts / capabilities.maxPostsPerWeek * 100)}% of weekly post capacity`,
      impact: 'low'
    })
  }
  */
  
  // ========================================================================
  // 4. CONSISTENCY VALIDATION
  // ========================================================================
  
  // Check if all ideas have same deficiency
  const allMissingPlatform = selectedIdeas.every(idea => 
    (idea.platforms || []).every(p => !capabilities.connectedPlatforms.includes(p))
  )
  
  if (allMissingPlatform && selectedIdeas.length > 0) {
    suggestions.push(
      'All ideas target disconnected platforms. Consider connecting platforms before generation.'
    )
  }
  
  // Check format variety
  const formatDistribution: Record<string, number> = {}
  selectedIdeas.forEach(idea => {
    const format = idea.suggested_media?.type || 'photo'
    formatDistribution[format] = (formatDistribution[format] || 0) + 1
  })
  
  if (Object.keys(formatDistribution).length === 1 && selectedIdeas.length > 2) {
    warnings.push({
      ideaId: -1,
      ideaTitle: 'Overall Strategy',
      category: 'consistency',
      message: `All ${selectedIdeas.length} ideas use same format (${Object.keys(formatDistribution)[0]})`,
      impact: 'low'
    })
    suggestions.push('Consider varying formats for better audience engagement')
  }
  
  // ========================================================================
  // 5. SUMMARY & RECOMMENDATIONS
  // ========================================================================
  
  const blockingErrors = criticalErrors.filter(e => e.severity === 'blocking')
  const feasible = blockingErrors.length === 0
  
  if (!feasible) {
    suggestions.push('Fix blocking errors before generating posts')
  } else if (criticalErrors.length > 0) {
    suggestions.push('Critical errors detected - posts may be generated but will have issues')
  }
  
  console.log('[FeasibilityValidator] Validation complete:', {
    feasible,
    blocking: blockingErrors.length,
    critical: criticalErrors.length - blockingErrors.length,
    warnings: warnings.length,
  })
  
  return {
    feasible,
    criticalErrors,
    warnings,
    suggestions,
  }
}

// ============================================================================
// HELPER: Extract capabilities from business profile
// ============================================================================

/**
 * Build capabilities object from database records
 */
export function buildCapabilitiesFromProfile(
  businessProfile: any,
  connectedPlatforms: any[],
  subscriptionData: any
): BusinessCapabilities {
  // Parse connected platforms
  const platformNames = connectedPlatforms
    .filter(p => p.is_active)
    .map(p => p.platform_name)
  
  // Determine content production capabilities
  // 🧪 TESTING MODE: All formats enabled, no tier restrictions
  const canProducePhotos = true
  const canProduceCarousels = true
  const canProduceReels = true // Enabled for testing
  const canProduceVideos = true // Enabled for testing
  const canProduceStories = true
  
  // Tier-based limits (TESTING: All tiers have unlimited capacity)
  const tierLimits: Record<string, { posts: number; reels: number; videos: number }> = {
    'free': { posts: 100, reels: 100, videos: 100 }, // Testing: Unlimited
    'basic': { posts: 100, reels: 100, videos: 100 },
    'pro': { posts: 100, reels: 100, videos: 100 },
    'enterprise': { posts: 100, reels: 100, videos: 100 },
  }
  
  const tier = subscriptionData?.tier || 'free'
  const limits = tierLimits[tier] || tierLimits['free']
  
  return {
    connectedPlatforms: platformNames,
    canProducePhotos,
    canProduceCarousels,
    canProduceReels,
    canProduceVideos,
    canProduceStories,
    subscriptionTier: tier,
    maxPostsPerWeek: limits.posts,
    maxReelsPerWeek: limits.reels,
    maxVideosPerWeek: limits.videos,
    businessHours: businessProfile?.business_hours,
    hasStaff: businessProfile?.staff_count > 0,
    hasPhotographer: businessProfile?.has_photographer || false,
    hasVideoEquipment: businessProfile?.has_video_equipment || false,
    bannedWords: businessProfile?.banned_words || [],
    requiredCertifications: businessProfile?.certifications || [],
  }
}

// ============================================================================
// HELPER: Format validation report for display
// ============================================================================

export function formatValidationReport(result: ValidationResult): string {
  const lines: string[] = []
  
  lines.push('='.repeat(60))
  lines.push('STRATEGY FEASIBILITY VALIDATION REPORT')
  lines.push('='.repeat(60))
  lines.push('')
  
  if (result.feasible) {
    lines.push('✅ FEASIBLE - Strategy can be executed')
  } else {
    lines.push('❌ NOT FEASIBLE - Blocking errors detected')
  }
  
  lines.push('')
  
  if (result.criticalErrors.length > 0) {
    lines.push('CRITICAL ERRORS:')
    lines.push('-'.repeat(60))
    result.criticalErrors.forEach(err => {
      lines.push(`[${err.severity.toUpperCase()}] ${err.category}`)
      lines.push(`  Idea: ${err.ideaTitle} (#${err.ideaId})`)
      lines.push(`  Issue: ${err.message}`)
      lines.push(`  Fix: ${err.suggestedFix}`)
      lines.push('')
    })
  }
  
  if (result.warnings.length > 0) {
    lines.push('WARNINGS:')
    lines.push('-'.repeat(60))
    result.warnings.forEach(warn => {
      lines.push(`[${warn.impact.toUpperCase()} IMPACT] ${warn.category}`)
      lines.push(`  Idea: ${warn.ideaTitle} (#${warn.ideaId})`)
      lines.push(`  Note: ${warn.message}`)
      lines.push('')
    })
  }
  
  if (result.suggestions.length > 0) {
    lines.push('SUGGESTIONS:')
    lines.push('-'.repeat(60))
    result.suggestions.forEach((s, i) => {
      lines.push(`${i + 1}. ${s}`)
    })
    lines.push('')
  }
  
  lines.push('='.repeat(60))
  
  return lines.join('\n')
}
