/**
 * LAYER 4: RECENCY & VARIETY FILTER
 * 
 * Prevents repetition and maintains content diversity.
 * This CAN be built now - doesn't require platform integration.
 * 
 * Checks:
 * 1. Dish repetition (Posted salmon 3 days ago? Skip for now)
 * 2. Post type sequence (Two menu posts in a row? Next must be different)
 * 3. Platform balance (3 Instagram, 0 Facebook? Next goes to Facebook)
 * 4. Visual variety (All close-up food shots? Need atmosphere/people)
 */

// Deno global type declaration
declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
}

export interface PostHistoryItem {
  id: string
  content_type: string // 'menu_highlight', 'atmosphere_experience', etc.
  platform: string // 'instagram', 'facebook', 'both'
  posted_at: Date
  
  // Content analysis
  menu_items_featured: string[] // ['Salmon Plate', 'Ribeye Steak']
  location_hooks: string[] // ['waterfront', 'outdoor seating']
  visual_style: string // 'food_closeup', 'atmosphere', 'people', 'action'
  content_pillar?: string // From brand profile
}

export interface ContentCandidate {
  id: string
  content_type: string
  platform: string | 'both'
  
  // What this content features
  menu_items?: string[]
  location_hooks?: string[]
  visual_style: string
  content_pillar?: string
}

export interface VarietyCheckResult {
  eligible: boolean
  reason?: string
  priority: 'blocked' | 'discouraged' | 'neutral' | 'encouraged' | 'required'
  score: number // 0-100 (higher = more variety)
  
  // Detailed flags
  flags: {
    tooSoonRepeat?: boolean // Same dish posted recently
    typeSequenceBad?: boolean // Too many of same type in a row
    platformImbalance?: boolean // Need to balance platforms
    visualMonotony?: boolean // All same visual style
    needsDiversity?: string // Specific need: 'atmosphere', 'people', etc.
  }
}

// =====================================================
// CONFIGURATION
// =====================================================

const RECENCY_RULES = {
  // How many days before a dish can be repeated
  minDaysBetweenDish: 7,
  minDaysBetweenDishHighlight: 14, // For hero items (signature dishes)
  
  // How many days before same content type
  minDaysBetweenSameType: 3,
  
  // How many days before same location hook
  minDaysBetweenLocationHook: 5,
  
  // How many days for platform balance check
  platformBalanceWindow: 7,
}

const SEQUENCE_RULES = {
  // Max same content type in a row
  maxSameTypeSequence: 2,
  
  // Max same visual style in a row
  maxSameVisualSequence: 3,
  
  // Platform ratio targets (within 7 days)
  platformRatios: {
    instagram: { min: 0.4, max: 0.7 },
    facebook: { min: 0.3, max: 0.6 }
  }
}

const VARIETY_WEIGHTS = {
  // How much each variety factor matters (0-1)
  dishRepetition: 1.0, // Most important
  contentTypeSequence: 0.8,
  platformBalance: 0.7,
  visualVariety: 0.6,
  locationHookDiversity: 0.5
}

// =====================================================
// MAIN FILTER
// =====================================================

/**
 * Check if content candidate passes variety filter
 */
export function checkContentVariety(
  candidate: ContentCandidate,
  recentPosts: PostHistoryItem[],
  lookbackDays: number = 14
): VarietyCheckResult {
  const flags: VarietyCheckResult['flags'] = {}
  let score = 100 // Start perfect, deduct for issues
  let priority: VarietyCheckResult['priority'] = 'neutral'
  
  // Filter to relevant timeframe
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - lookbackDays)
  const recentFiltered = recentPosts.filter(p => p.posted_at >= cutoffDate)
  
  if (recentFiltered.length === 0) {
    // No recent posts - all content welcome
    return {
      eligible: true,
      priority: 'neutral',
      score: 100,
      flags: {}
    }
  }
  
  // =====================================================
  // CHECK 1: Dish Repetition
  // =====================================================
  if (candidate.menu_items && candidate.menu_items.length > 0) {
    const dishRepeatCheck = checkDishRepetition(
      candidate.menu_items,
      recentFiltered
    )
    
    if (dishRepeatCheck.blocked) {
      score -= 40
      flags.tooSoonRepeat = true
      priority = 'blocked'
    } else if (dishRepeatCheck.discouraged) {
      score -= 20
      flags.tooSoonRepeat = true
      if (priority === 'neutral') priority = 'discouraged'
    }
  }
  
  // =====================================================
  // CHECK 2: Content Type Sequence
  // =====================================================
  const sequenceCheck = checkContentTypeSequence(
    candidate.content_type,
    recentFiltered
  )
  
  if (sequenceCheck.blocked) {
    score -= 30
    flags.typeSequenceBad = true
    if (priority !== 'blocked') priority = 'blocked'
  } else if (sequenceCheck.discouraged) {
    score -= 15
    flags.typeSequenceBad = true
    if (priority === 'neutral') priority = 'discouraged'
  }
  
  // =====================================================
  // CHECK 3: Platform Balance
  // =====================================================
  const platformCheck = checkPlatformBalance(
    candidate.platform,
    recentFiltered
  )
  
  if (platformCheck.required) {
    score += 20 // Bonus for needed platform
    flags.platformImbalance = true
    if (priority === 'neutral') priority = 'encouraged'
  } else if (platformCheck.discouraged) {
    score -= 15
    flags.platformImbalance = true
    if (priority === 'neutral') priority = 'discouraged'
  }
  
  // =====================================================
  // CHECK 4: Visual Variety
  // =====================================================
  const visualCheck = checkVisualVariety(
    candidate.visual_style,
    recentFiltered
  )
  
  if (visualCheck.needed) {
    score += 15 // Bonus for needed visual style
    flags.needsDiversity = visualCheck.neededStyle
    if (priority === 'neutral' || priority === 'discouraged') {
      priority = 'encouraged'
    }
  } else if (visualCheck.monotony) {
    score -= 10
    flags.visualMonotony = true
  }
  
  // =====================================================
  // FINAL DECISION
  // =====================================================
  const eligible = priority !== 'blocked' && score >= 40
  
  return {
    eligible,
    priority: eligible ? priority : 'blocked',
    score: Math.max(0, Math.min(100, score)),
    reason: !eligible ? generateBlockReason(flags) : undefined,
    flags
  }
}

// =====================================================
// CHECK FUNCTIONS
// =====================================================

/**
 * Check if dish has been posted too recently
 */
function checkDishRepetition(
  dishesInCandidate: string[],
  recentPosts: PostHistoryItem[]
): { blocked: boolean; discouraged: boolean; daysSince?: number } {
  const now = new Date()
  
  for (const dish of dishesInCandidate) {
    const dishLower = dish.toLowerCase()
    
    for (const post of recentPosts) {
      if (!post.menu_items_featured) continue
      
      for (const postedDish of post.menu_items_featured) {
        if (postedDish.toLowerCase().includes(dishLower) || 
            dishLower.includes(postedDish.toLowerCase())) {
          
          const daysSince = Math.floor(
            (now.getTime() - post.posted_at.getTime()) / (1000 * 60 * 60 * 24)
          )
          
          // Check if it's a hero/signature item (appears in multiple posts)
          const isHeroItem = recentPosts.filter(p => 
            p.menu_items_featured?.some(d => 
              d.toLowerCase().includes(dishLower)
            )
          ).length >= 3
          
          const minDays = isHeroItem 
            ? RECENCY_RULES.minDaysBetweenDishHighlight 
            : RECENCY_RULES.minDaysBetweenDish
          
          if (daysSince < minDays * 0.5) {
            return { blocked: true, discouraged: false, daysSince }
          } else if (daysSince < minDays) {
            return { blocked: false, discouraged: true, daysSince }
          }
        }
      }
    }
  }
  
  return { blocked: false, discouraged: false }
}

/**
 * Check content type sequence
 */
function checkContentTypeSequence(
  contentType: string,
  recentPosts: PostHistoryItem[]
): { blocked: boolean; discouraged: boolean } {
  // Get last N posts (most recent first)
  const sorted = [...recentPosts].sort((a, b) => 
    b.posted_at.getTime() - a.posted_at.getTime()
  )
  
  // Count consecutive same type
  let sameTypeStreak = 0
  for (const post of sorted) {
    if (post.content_type === contentType) {
      sameTypeStreak++
    } else {
      break
    }
  }
  
  if (sameTypeStreak >= SEQUENCE_RULES.maxSameTypeSequence) {
    return { blocked: true, discouraged: false }
  } else if (sameTypeStreak >= SEQUENCE_RULES.maxSameTypeSequence - 1) {
    return { blocked: false, discouraged: true }
  }
  
  // Check if same type posted very recently (within 3 days)
  const veryRecentSameType = sorted.slice(0, 2).some(p => 
    p.content_type === contentType
  )
  
  if (veryRecentSameType) {
    const daysSince = Math.floor(
      (new Date().getTime() - sorted[0].posted_at.getTime()) / (1000 * 60 * 60 * 24)
    )
    
    if (daysSince < RECENCY_RULES.minDaysBetweenSameType) {
      return { blocked: false, discouraged: true }
    }
  }
  
  return { blocked: false, discouraged: false }
}

/**
 * Check platform balance
 */
function checkPlatformBalance(
  candidatePlatform: string,
  recentPosts: PostHistoryItem[]
): { required: boolean; discouraged: boolean; requiredPlatform?: string } {
  // Count posts per platform in recent window
  const platformCounts = {
    instagram: 0,
    facebook: 0,
    both: 0
  }
  
  for (const post of recentPosts) {
    const platform = post.platform.toLowerCase()
    if (platform in platformCounts) {
      platformCounts[platform as keyof typeof platformCounts]++
    }
  }
  
  const total = platformCounts.instagram + platformCounts.facebook + platformCounts.both
  
  if (total === 0) {
    return { required: false, discouraged: false }
  }
  
  // Calculate ratios (count 'both' as 0.5 for each)
  const instagramTotal = platformCounts.instagram + (platformCounts.both * 0.5)
  const facebookTotal = platformCounts.facebook + (platformCounts.both * 0.5)
  
  const instagramRatio = instagramTotal / total
  const facebookRatio = facebookTotal / total
  
  const candidateNormalized = candidatePlatform.toLowerCase()
  
  // Check if a platform is severely underrepresented
  if (facebookRatio < SEQUENCE_RULES.platformRatios.facebook.min && 
      candidateNormalized === 'facebook') {
    return { required: true, discouraged: false, requiredPlatform: 'facebook' }
  }
  
  if (instagramRatio < SEQUENCE_RULES.platformRatios.instagram.min && 
      candidateNormalized === 'instagram') {
    return { required: true, discouraged: false, requiredPlatform: 'instagram' }
  }
  
  // Check if a platform is overrepresented
  if (instagramRatio > SEQUENCE_RULES.platformRatios.instagram.max && 
      candidateNormalized === 'instagram') {
    return { required: false, discouraged: true }
  }
  
  if (facebookRatio > SEQUENCE_RULES.platformRatios.facebook.max && 
      candidateNormalized === 'facebook') {
    return { required: false, discouraged: true }
  }
  
  return { required: false, discouraged: false }
}

/**
 * Check visual variety
 */
function checkVisualVariety(
  candidateVisual: string,
  recentPosts: PostHistoryItem[]
): { needed: boolean; monotony: boolean; neededStyle?: string } {
  const sorted = [...recentPosts].sort((a, b) => 
    b.posted_at.getTime() - a.posted_at.getTime()
  )
  
  // Count consecutive same visual style
  let sameVisualStreak = 0
  for (const post of sorted) {
    if (post.visual_style === candidateVisual) {
      sameVisualStreak++
    } else {
      break
    }
  }
  
  if (sameVisualStreak >= SEQUENCE_RULES.maxSameVisualSequence) {
    return { needed: false, monotony: true }
  }
  
  // Check if certain visual styles are missing
  const lastN = sorted.slice(0, 6)
  const visualCounts: Record<string, number> = {}
  
  for (const post of lastN) {
    visualCounts[post.visual_style] = (visualCounts[post.visual_style] || 0) + 1
  }
  
  // If 80%+ are food_closeup, we need variety
  const foodCloseupRatio = (visualCounts['food_closeup'] || 0) / lastN.length
  if (foodCloseupRatio >= 0.8 && candidateVisual !== 'food_closeup') {
    return { needed: true, monotony: false, neededStyle: candidateVisual }
  }
  
  // If no atmosphere/people shots in last 6, we need them
  const hasAtmosphere = lastN.some(p => p.visual_style === 'atmosphere')
  const hasPeople = lastN.some(p => p.visual_style === 'people')
  
  if (!hasAtmosphere && candidateVisual === 'atmosphere') {
    return { needed: true, monotony: false, neededStyle: 'atmosphere' }
  }
  
  if (!hasPeople && candidateVisual === 'people') {
    return { needed: true, monotony: false, neededStyle: 'people' }
  }
  
  return { needed: false, monotony: false }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Generate human-readable block reason
 */
function generateBlockReason(flags: VarietyCheckResult['flags']): string {
  const reasons: string[] = []
  
  if (flags.tooSoonRepeat) {
    reasons.push('Dish posted too recently')
  }
  
  if (flags.typeSequenceBad) {
    reasons.push('Too many similar post types in a row')
  }
  
  if (flags.platformImbalance) {
    reasons.push('Platform needs balancing')
  }
  
  if (flags.visualMonotony) {
    reasons.push('Visual style too repetitive')
  }
  
  return reasons.join('; ')
}

/**
 * Batch check multiple candidates and return sorted by variety score
 */
export function rankCandidatesByVariety(
  candidates: ContentCandidate[],
  recentPosts: PostHistoryItem[],
  lookbackDays: number = 14
): Array<ContentCandidate & { varietyCheck: VarietyCheckResult }> {
  const results = candidates.map(candidate => ({
    ...candidate,
    varietyCheck: checkContentVariety(candidate, recentPosts, lookbackDays)
  }))
  
  // Sort by:
  // 1. Eligibility (eligible first)
  // 2. Priority (required > encouraged > neutral > discouraged > blocked)
  // 3. Score (higher first)
  return results.sort((a, b) => {
    // Eligible vs blocked
    if (a.varietyCheck.eligible !== b.varietyCheck.eligible) {
      return a.varietyCheck.eligible ? -1 : 1
    }
    
    // Priority order
    const priorityOrder = { required: 0, encouraged: 1, neutral: 2, discouraged: 3, blocked: 4 }
    const priorityDiff = priorityOrder[a.varietyCheck.priority] - priorityOrder[b.varietyCheck.priority]
    if (priorityDiff !== 0) return priorityDiff
    
    // Score
    return b.varietyCheck.score - a.varietyCheck.score
  })
}

/**
 * Get variety recommendations for UI display
 */
export function getVarietyRecommendations(
  recentPosts: PostHistoryItem[],
  lookbackDays: number = 7
): string[] {
  const recommendations: string[] = []
  
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - lookbackDays)
  const recent = recentPosts.filter(p => p.posted_at >= cutoffDate)
  
  if (recent.length === 0) return recommendations
  
  // Check content type balance
  const typeCounts: Record<string, number> = {}
  for (const post of recent) {
    typeCounts[post.content_type] = (typeCounts[post.content_type] || 0) + 1
  }
  
  const total = recent.length
  for (const [type, count] of Object.entries(typeCounts)) {
    if (count / total > 0.6) {
      recommendations.push(`Consider varying from ${type} posts (${Math.round(count/total*100)}% of recent posts)`)
    }
  }
  
  // Check visual variety
  const visualCounts: Record<string, number> = {}
  for (const post of recent) {
    visualCounts[post.visual_style] = (visualCounts[post.visual_style] || 0) + 1
  }
  
  if ((visualCounts['food_closeup'] || 0) / total > 0.7) {
    recommendations.push('Mix in some atmosphere or lifestyle shots')
  }
  
  // Check platform balance
  const platformCounts = {
    instagram: 0,
    facebook: 0
  }
  
  for (const post of recent) {
    if (post.platform === 'instagram' || post.platform === 'both') platformCounts.instagram++
    if (post.platform === 'facebook' || post.platform === 'both') platformCounts.facebook++
  }
  
  const instagramRatio = platformCounts.instagram / total
  const facebookRatio = platformCounts.facebook / total
  
  if (instagramRatio < 0.3) {
    recommendations.push('Balance platforms: more Instagram posts needed')
  } else if (facebookRatio < 0.3) {
    recommendations.push('Balance platforms: more Facebook posts needed')
  }
  
  return recommendations
}
