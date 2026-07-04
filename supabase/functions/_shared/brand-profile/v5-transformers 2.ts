/**
 * V5 Brand Profile Transformers
 * 
 * Utility functions to transform V5 JSONB structure into formats expected by
 * legacy Weekly Plan prompts. This enables clean migration without rewriting
 * all prompts at once.
 * 
 * @version 5.0
 * @date May 9, 2026
 */

import type { 
  V5BrandProfile, 
  V5Programme,
  V5Identity,
  V5Voice 
} from './types-v5.ts'

// ============================================================================
// PROGRAMME AGGREGATION - Business-wide strategy from programme-level data
// ============================================================================

/**
 * Extract programme-specific brand anchors
 * 
 * Maps each programme type to its distinctive brand-building anchor.
 * Called per-programme during content strategy aggregation.
 * 
 * @param programme - V5Programme object
 * @param anchors - Array to accumulate anchors (mutated)
 */
function extractProgrammeBrandAnchors(programme: V5Programme, anchors: string[]) {
  const { type, name } = programme
  
  switch (type) {
    // Fine dining & dinner programmes → culinary craft
    case 'dinner':
    case 'fine_dining':
    case 'evening_dining':
      anchors.push(`${name} håndværk`)
      break
    
    // Brunch → weekend experience and quality
    case 'brunch':
    case 'weekend_brunch':
      anchors.push(`${name}-oplevelse`)
      break
    
    // Lunch → quality and freshness
    case 'lunch':
    case 'daily_lunch':
      anchors.push(`${name}-kvalitet`)
      break
    
    // Bar programmes → cocktail craft and atmosphere
    case 'bar':
    case 'evening_bar':
    case 'cocktail_bar':
      anchors.push(`${name}-håndværk`)
      break
    
    // Coffee programmes → coffee culture
    case 'coffee':
    case 'specialty_coffee':
    case 'cafe':
      anchors.push(`Kaffekultur`)
      break
    
    // Bakery → fresh baking
    case 'bakery':
    case 'patisserie':
      anchors.push(`Frisk bagning`)
      break
    
    // Wine bar → wine programme
    case 'wine_bar':
      anchors.push(`Vinprogram`)
      break
    
    // Tapas/sharing → food presentation
    case 'tapas':
    case 'sharing_plates':
      anchors.push(`Mad-præsentation`)
      break
    
    // Default for other programme types
    default:
      // Don't add generic anchor here - let the fallback handle it
      break
  }
}

/**
 * Extract menu-based brand anchors
 * 
 * Derives brand anchors from menu signature themes and craft signals.
 * Examples: "Hjemmelavet pasta", "Specialty kaffe", "Økologiske råvarer"
 * 
 * @param menuOverview - Optional menu context
 * @param anchors - Array to accumulate anchors (mutated)
 */
function extractMenuBrandAnchors(
  menuOverview: { signature_themes?: string[]; craft_signals?: string[] } | undefined,
  anchors: string[]
) {
  if (!menuOverview) return
  
  // Extract from craft signals (homemade, artisan, etc.)
  if (menuOverview.craft_signals && menuOverview.craft_signals.length > 0) {
    // Take first 2 craft signals as brand anchors
    menuOverview.craft_signals.slice(0, 2).forEach(signal => {
      anchors.push(signal)
    })
  }
  
  // Extract from signature themes (if distinctive and not too generic)
  if (menuOverview.signature_themes && menuOverview.signature_themes.length > 0) {
    // Take first signature theme if it's specific enough
    const firstTheme = menuOverview.signature_themes[0]
    const genericThemes = ['mad', 'drikke', 'menu', 'retter']
    const isSpecific = !genericThemes.some(generic => firstTheme.toLowerCase().includes(generic))
    
    if (isSpecific) {
      anchors.push(firstTheme)
    }
  }
}

/**
 * Extract location-based brand anchors
 * 
 * Derives brand anchors from geographic positioning and location advantages.
 * Examples: "Placering ved åen", "Havnekig", "Indre by-stemning"
 * 
 * @param geoContext - Optional geographic context
 * @param anchors - Array to accumulate anchors (mutated)
 */
function extractLocationBrandAnchors(
  geoContext: { signature_reference?: string; location_type?: string } | undefined,
  anchors: string[]
) {
  if (!geoContext) return
  
  // Use signature reference if available (e.g., "ved åen", "Nyhavn")
  if (geoContext.signature_reference) {
    anchors.push(`Placering ${geoContext.signature_reference}`)
  }
  
  // Map location_type to brand anchor
  if (geoContext.location_type) {
    const locationTypeMap: Record<string, string> = {
      'waterfront_leisure': 'Vandkant-oplevelse',
      'downtown_commercial': 'Bymidten',
      'residential_neighborhood': 'Nabolagsstemning',
      'tourist_area': 'Turistområde',
      'cultural_district': 'Kulturkvarter'
    }
    
    const anchor = locationTypeMap[geoContext.location_type]
    if (anchor) {
      anchors.push(anchor)
    }
  }
}

/**
 * Aggregate programme-level commercial orientations into business-wide strategy
 * 
 * V5 stores commercial strategy per-programme, but Weekly Plan prompts expect
 * a single business-wide strategy. This function aggregates across programmes.
 * 
 * RETURNS ContentStrategy-compatible structure matching types.ts interface:
 * - goal_blend (not default_goal_split) with build_brand/retain_loyalty (not strengthen_brand/retain_regulars)
 * - content_category_weights with product_menu/craving_visual/behind_scenes/team_people percentages
 * - primary_goal, footfall_signals, brand_anchors, loyalty_hooks
 * 
 * @param programmes - V5Programme array
 * @param menuOverview - Optional menu context for signature themes and craft signals
 * @param geoContext - Optional geographic context for location-based anchors
 */
export function deriveContentStrategy(
  programmes: V5Programme[],
  menuOverview?: { signature_themes?: string[]; craft_signals?: string[] },
  geoContext?: { signature_reference?: string; location_type?: string }
) {
  if (!programmes || programmes.length === 0) {
    return null
  }
  
  // Calculate weighted average of goal splits
  const aggregateGoals = programmes.reduce((acc, prog) => {
    const split = prog.commercialOrientation?.baseline_goal_split
    if (split) {
      acc.drive_footfall += split.drive_footfall || 0
      acc.build_brand += split.strengthen_brand || 0  // FIXED: map strengthen_brand → build_brand
      acc.retain_loyalty += split.retain_regulars || 0  // FIXED: map retain_regulars → retain_loyalty
    }
    return acc
  }, { drive_footfall: 0, build_brand: 0, retain_loyalty: 0 })
  
  const count = programmes.length
  
  // Normalize to 100%
  const total = aggregateGoals.drive_footfall + aggregateGoals.build_brand + aggregateGoals.retain_loyalty
  const goal_blend = {
    drive_footfall: total > 0 ? Math.round((aggregateGoals.drive_footfall / total) * 100) : 33,
    build_brand: total > 0 ? Math.round((aggregateGoals.build_brand / total) * 100) : 33,
    retain_loyalty: total > 0 ? Math.round((aggregateGoals.retain_loyalty / total) * 100) : 34
  }
  
  // Derive primary goal
  const primary_goal = goal_blend.drive_footfall >= 45 ? 'drive_footfall' 
    : goal_blend.build_brand >= 45 ? 'build_brand'
    : goal_blend.retain_loyalty >= 45 ? 'retain_loyalty'
    : 'drive_footfall'  // Default to footfall for balanced businesses
  
  // Derive content_category_weights from programme types
  // If multi-programme (3+), reduce menu focus; if single-focus, increase menu
  const isMultiProgramme = programmes.length >= 3
  const hasDinner = programmes.some(p => p.type === 'dinner' || p.type === 'evening_bar')
  const hasBrunch = programmes.some(p => p.type === 'brunch')
  
  const content_category_weights = isMultiProgramme 
    ? { product_menu: 30, craving_visual: 30, behind_scenes: 25, team_people: 15 }  // Balanced
    : hasDinner 
    ? { product_menu: 40, craving_visual: 30, behind_scenes: 20, team_people: 10 }  // Menu-focused for dinner
    : hasBrunch
    ? { product_menu: 35, craving_visual: 30, behind_scenes: 20, team_people: 15 }  // Visual-focused for brunch
    : { product_menu: 35, craving_visual: 25, behind_scenes: 25, team_people: 15 }  // Default
  
  // Extract signals from programme data
  const footfall_signals: string[] = []
  const brand_anchors: string[] = []
  const loyalty_hooks: string[] = []
  
  programmes.forEach(p => {
    if (p.commercialOrientation?.decision_timing === 'spontaneous') {
      footfall_signals.push(`${p.name} (spontan besøg)`)
    }
    
    // ✅ ENRICHED: Extract programme-specific brand anchors
    extractProgrammeBrandAnchors(p, brand_anchors)
    
    if (p.timeWindow?.recurring) {
      loyalty_hooks.push(p.name)
    }
  })
  
  // ✅ NEW: Extract menu-based brand anchors
  extractMenuBrandAnchors(menuOverview, brand_anchors)
  
  // ✅ NEW: Extract location-based brand anchors
  extractLocationBrandAnchors(geoContext, brand_anchors)
  
  // Fallback to sensible defaults if no signals found
  if (footfall_signals.length === 0) footfall_signals.push('daglig trafik')
  if (brand_anchors.length === 0) brand_anchors.push('kvalitet og håndværk')
  if (loyalty_hooks.length === 0) loyalty_hooks.push('fast ugentligt besøg')
  
  return {
    primary_goal,
    goal_blend,  // FIXED: renamed from default_goal_split
    footfall_signals,
    brand_anchors,
    loyalty_hooks,
    content_category_weights,  // ADDED: required for strategy modulator
    programmes_summary: programmes.map(p => ({
      name: p.name,
      type: p.type,
      timing: p.commercialOrientation?.decision_timing || 'mixed',
      primary_goal: getPrimaryGoal(p.commercialOrientation?.baseline_goal_split)
    }))
  }
}

/**
 * Get primary goal from goal split
 */
function getPrimaryGoal(split: any): string {
  if (!split) return 'balanced'
  
  const goals = [
    { name: 'drive_footfall', value: split.drive_footfall || 0 },
    { name: 'strengthen_brand', value: split.strengthen_brand || 0 },
    { name: 'retain_regulars', value: split.retain_regulars || 0 }
  ]
  
  const primary = goals.sort((a, b) => b.value - a.value)[0]
  return primary.value > 40 ? primary.name : 'balanced'
}

/**
 * Aggregate audience segments from all programmes into target_audience
 * 
 * Legacy prompts expect a single "primary" audience. This derives it from
 * programme-level segments.
 */
export function deriveTargetAudience(programmes: V5Programme[]) {
  if (!programmes || programmes.length === 0) {
    return null
  }
  
  const allSegments = programmes.flatMap(p => p.audienceSegments || [])
  
  if (allSegments.length === 0) {
    return null
  }
  
  // Group by motivation, weighted by confidence
  const byMotivation = allSegments.reduce((acc, seg) => {
    const motivation = seg.motivation || 'general'
    acc[motivation] = (acc[motivation] || 0) + (seg.confidence || 0.5)
    return acc
  }, {} as Record<string, number>)
  
  // Find primary motivation
  const primary = Object.entries(byMotivation)
    .sort(([,a], [,b]) => b - a)[0]?.[0]
  
  // Get all segment names
  const segments = allSegments.map(s => s.segment_name).filter(Boolean)
  
  return {
    primary: primary || 'experience_seeking',
    segments: [...new Set(segments)], // Deduplicate
    motivations: Object.keys(byMotivation),
    confidence: Math.max(...allSegments.map(s => s.confidence || 0.5))
  }
}

/**
 * Select active programme based on day/time
 * 
 * Used for time-aware content strategy selection
 */
export function getActiveProgramme(
  programmes: V5Programme[], 
  targetDay: string, 
  targetTime: string = '12:00'
): V5Programme | null {
  
  if (!programmes || programmes.length === 0) {
    return null
  }
  
  // Normalize day name
  const dayLower = targetDay.toLowerCase()
  
  // Filter programmes matching day
  const dayMatches = programmes.filter(p => 
    p.daysOfWeek && p.daysOfWeek.some(d => d.toLowerCase() === dayLower)
  )
  
  if (dayMatches.length === 0) {
    // Return dominant programme (highest confidence)
    return getDominantProgramme(programmes)
  }
  
  // Parse target time (HH:MM → HHMM integer)
  const currentTime = parseInt(targetTime.replace(':', ''))
  
  // Filter by time window
  const timeMatches = dayMatches.filter(p => {
    if (!p.timeWindow) return false
    const start = parseInt(p.timeWindow.start.replace(':', ''))
    const end = parseInt(p.timeWindow.end.replace(':', ''))
    return currentTime >= start && currentTime <= end
  })
  
  // Return first time match, or first day match, or dominant
  return timeMatches[0] || dayMatches[0] || getDominantProgramme(programmes)
}

/**
 * Get dominant programme (highest confidence or first)
 */
export function getDominantProgramme(programmes: V5Programme[]): V5Programme | null {
  if (!programmes || programmes.length === 0) {
    return null
  }
  
  // Sort by confidence (high confidence wins)
  const sorted = [...programmes].sort((a, b) => {
    const confA = a.confidence === 'high' ? 3 : a.confidence === 'medium' ? 2 : 1
    const confB = b.confidence === 'high' ? 3 : b.confidence === 'medium' ? 2 : 1
    return confB - confA
  })
  
  return sorted[0]
}

// ============================================================================
// BRAND VOICE CONSTRUCTION - V5 → Legacy WeekContext.brand_voice
// ============================================================================

/**
 * Construct legacy brand_voice object from V5 profile
 * 
 * This creates the WeekContext.brand_voice structure that Phase 1/2 prompts expect,
 * sourced from V5 JSONB layers instead of legacy columns.
 */
export function constructBrandVoiceFromV5(v5Profile: V5BrandProfile) {
  const identity = v5Profile.identity
  const voice = v5Profile.voice
  const examples = v5Profile.writing_examples
  const guardrails = v5Profile.guardrails
  const programmes = v5Profile.programmes || []
  
  return {
    // ── LAYER 3: Identity → brand_voice mappings ──
    brand_essence: identity.brand_essence,
    positioning: identity.positioning,
    identity_keywords: identity.core_values, // Map core_values → keywords
    what_makes_us_different: identity.what_makes_us_different,
    identity_confidence: identity.identity_confidence,
    identity_reasoning: identity.identity_reasoning,
    
    // ── LAYER 5A: Voice → brand_voice mappings ──
    tone_rules: voice.tone_rules,
    personality_traits: voice.personality_traits,
    formality_level: voice.formality_level,
    humor_style: voice.humor_style,
    sentence_structure: voice.sentence_structure,
    voice_confidence: voice.voice_confidence,
    voice_reasoning: voice.voice_reasoning,
    
    // Construct tone_of_voice object for backward compatibility
    tone_of_voice: {
      primary_tone: voice.formality_level,
      attributes: voice.personality_traits,
      formality_level: voice.formality_level,
      humor: voice.humor_style
    },
    
    // Map personality_traits → tone_keywords for legacy prompts
    tone_keywords: voice.personality_traits,
    
    // ── LAYER 5B: Writing Examples → brand_voice mappings ──
    typical_openings: examples.typical_openings,
    typical_closings: examples.typical_closings,
    signature_phrases: examples.signature_phrases,
    good_examples: examples.good_examples || [],
    
    // ── LAYER 5C: Guardrails → brand_voice mappings ──
    never_say: guardrails.never_say,
    content_exclusions: guardrails.content_exclusions,
    factual_constraints: guardrails.factual_constraints,
    seasonal_notes: guardrails.seasonal_notes || [],
    
    // ── LAYERS 1-2-4: Programme Data (AGGREGATE) ──
    content_strategy: deriveContentStrategy(
      programmes,
      // Extract menu context for brand anchors
      v5Profile.layer_0_intelligence?.menu_overview ? {
        signature_themes: v5Profile.layer_0_intelligence.menu_overview.signature_themes,
        craft_signals: voice.tone_dna?.culinary_character?.craft_signals
      } : undefined,
      // Extract geographic context for brand anchors
      v5Profile.layer_0_intelligence?.geographic_context ? {
        signature_reference: v5Profile.layer_0_intelligence.geographic_context.signature_reference,
        location_type: v5Profile.layer_0_intelligence.geographic_context.location_type
      } : undefined
    ),
    target_audience: deriveTargetAudience(programmes),
    programmes_summary: programmes.map(p => ({
      name: p.name,
      type: p.type,
      timeWindow: p.timeWindow,
      commercialOrientation: p.commercialOrientation
    }))
  }
}

// ============================================================================
// CONTEXT HELPERS - For Phase 1/2 prompts
// ============================================================================

/**
 * Get tone rules as formatted string for prompts
 */
export function formatToneRules(voice: V5Voice): string {
  if (!voice.tone_rules || voice.tone_rules.length === 0) {
    return 'Ikke specificeret'
  }
  
  return voice.tone_rules
    .map((rule, i) => `${i + 1}. ${rule}`)
    .join('\n')
}

/**
 * Get guardrails as formatted string for prompts
 */
export function formatGuardrails(guardrails: any): string {
  const parts: string[] = []
  
  if (guardrails.never_say?.length > 0) {
    parts.push(`❌ Undgå altid: ${guardrails.never_say.slice(0, 5).join(', ')}`)
  }
  
  if (guardrails.content_exclusions?.length > 0) {
    parts.push(`⛔ Emner vi IKKE dækker: ${guardrails.content_exclusions.slice(0, 3).join('; ')}`)
  }
  
  if (guardrails.factual_constraints?.length > 0) {
    parts.push(`📋 Faktuelle krav:\n${guardrails.factual_constraints.map((c: string) => `• ${c}`).join('\n')}`)
  }
  
  return parts.join('\n\n')
}

/**
 * Get core values as formatted string
 */
export function formatCoreValues(identity: V5Identity): string {
  if (!identity.core_values || identity.core_values.length === 0) {
    return 'Ikke specificeret'
  }
  
  return identity.core_values
    .map(v => `• ${v}`)
    .join('\n')
}
