// Brand context builder for get-quick-suggestions
// Assembles brand profile information for AI prompts
// Extracted June 24, 2026

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { BrandProfileRow } from './types.ts'
import { isValidBusinessCharacter } from '../_shared/brand-profile/business-type-detection.ts'
import { extractBrandEssence, extractPositioning, extractUSP } from '../_shared/brand-profile/v5-extractors.ts'
import { matchPersonaWithV5Programmes, matchPersonaToCurrentHour, type PersonaMatchResult } from '../_shared/persona-matcher.ts'

/**
 * Brand context data extracted from business_brand_profile
 */
export interface BrandContext {
  businessCharacterText: string
  targetAudienceText: string
  brandContextDifferentiator: string
  venueIdentityText: string
  venueEnergyText: string
  photographyStyleText: string
  photoTypesToAvoidText: string
  voiceRationaleText: string
  emotionalPromiseText: string
  contentExclusionsText: string
  confirmedFacts: string[]
  confirmedFactsSlotB: string[]
  v5ToneNote: string | undefined
  v5CTAType: string | undefined
  v5ContentAngles: string[]
  toneInstructions: string
}

/**
 * Extract business character from brand profile
 * Handles V5 fallback chain and validates content
 */
export function extractBusinessCharacter(brandProfile: BrandProfileRow | null): string {
  if (!brandProfile) return ''

  const v5Identity = brandProfile.v5_business_identity
  const businessCharacter = v5Identity?.business_description
    ?? (typeof (brandProfile as any).business_character === 'string'
      ? (brandProfile as any).business_character
      : (typeof (brandProfile as any).business_character === 'object' && (brandProfile as any).business_character?.value)
        ? String((brandProfile as any).business_character.value)
        : '')

  // Validate: business_character should be SHORT (< 200 chars), not the full persona
  if (businessCharacter && isValidBusinessCharacter(businessCharacter)) {
    return businessCharacter.trim()
  } else if (businessCharacter && businessCharacter.length > 0) {
    // Corrupted (contains full persona) - extract first meaningful line
    console.warn('⚠️ business_character corrupted (contains persona), extracting first line')
    const firstLine = businessCharacter.split('\n').find(line =>
      line.trim() &&
      !line.includes('Du er Marketing ekspert') &&
      !line.includes('FORRETNING:') &&
      !line.includes('LOKATION:')
    )
    if (firstLine && firstLine.length < 200) {
      return firstLine.trim()
    }
  }

  return ''
}

/**
 * Extract confirmed facts from content strategy
 */
export function extractConfirmedFacts(brandProfile: BrandProfileRow | null): {
  facts: string[]
  slotBFacts: string[]
} {
  const confirmedFacts: string[] = []
  const confirmedFactsSlotB: string[] = []

  if (!brandProfile) return { facts: confirmedFacts, slotBFacts: confirmedFactsSlotB }

  const cs = (brandProfile as any).content_strategy
  if (cs) {
    const csObj = typeof cs === 'string' ? (() => { try { return JSON.parse(cs) } catch { return null } })() : cs
    
    if (Array.isArray(csObj?.brand_anchors) && csObj.brand_anchors.length > 0) {
      const anchors = (csObj.brand_anchors as string[]).slice(0, 3).join('; ')
      confirmedFacts.push(`Brandankre (identitetsmarkører): ${anchors}`)
    }
    
    if (Array.isArray(csObj?.loyalty_hooks) && csObj.loyalty_hooks.length > 0) {
      const hooks = (csObj.loyalty_hooks as string[]).slice(0, 3).join('; ')
      confirmedFacts.push(`Fastholdelsesgrunde (gæster vender tilbage fordi): ${hooks}`)
    }
  }

  return { facts: confirmedFacts, slotBFacts: confirmedFactsSlotB }
}

/**
 * Match persona to current time and business operations
 * Handles V5 programme-based matching with fallback to legacy
 */
export async function matchCurrentPersona(
  supabase: SupabaseClient,
  businessId: string,
  brandProfile: BrandProfileRow | null,
  now: Date
): Promise<PersonaMatchResult> {
  // Fetch V5 programmes
  const { data: v5Programmes } = await supabase
    .from('business_programme_profiles')
    .select('programme_type, programme_name, time_windows, operating_days, audience_segments, decision_timing')
    .eq('business_id', businessId)

  const { data: businessOps } = await supabase
    .from('business_operations')
    .select('reservation_required, accepts_walk_ins, booking_url')
    .eq('business_id', businessId)
    .single()

  let personaMatch: PersonaMatchResult

  if (v5Programmes && v5Programmes.length > 0 && businessOps) {
    // V5 PATH: Programme-based matching
    console.log(`[V5] Using programme-based matching (${v5Programmes.length} programmes)`)

    const businessOpsData = {
      reservation_required: businessOps.reservation_required ?? false,
      accepts_walk_ins: businessOps.accepts_walk_ins ?? true,
      booking_url: businessOps.booking_url ?? null,
    }

    personaMatch = await matchPersonaWithV5Programmes(
      v5Programmes as any,
      businessOpsData,
      now.getHours(),
      now.getDay(),
      supabase,
      businessId
    )

    console.log(`[V5] Matched: ${personaMatch.audienceText}`)
    console.log(`[V5] Tone: ${personaMatch.tone_note}`)
    console.log(`[V5] CTA: ${personaMatch.cta_type}`)
  } else {
    // FALLBACK PATH: Legacy matching
    console.log(`[V5] Falling back to legacy matching`)
    const rawAudienceSegments = (brandProfile as any)?.audience_segments

    personaMatch = await matchPersonaToCurrentHour(
      null,
      rawAudienceSegments,
      now.getHours(),
      now.getDay(),
      now.getMonth(),
      supabase,
      businessId
    )
  }

  return personaMatch
}

/**
 * Build complete brand context from brand profile
 */
export async function buildBrandContext(
  supabase: SupabaseClient,
  businessId: string,
  brandProfile: BrandProfileRow | null,
  now: Date
): Promise<BrandContext> {
  // Extract basic information
  const businessCharacterText = extractBusinessCharacter(brandProfile)
  const { facts, slotBFacts } = extractConfirmedFacts(brandProfile)
  
  // Extract brand differentiator
  const differentiator = extractUSP(brandProfile)
  const brandContextDifferentiator = (differentiator && differentiator.trim().length > 5)
    ? differentiator.trim()
    : ''

  // Match persona
  const personaMatch = await matchCurrentPersona(supabase, businessId, brandProfile, now)

  // Extract venue identity from V5
  const v5Identity = brandProfile?.v5_business_identity
  const venueIdentityText = v5Identity?.venue_identity
    ? typeof v5Identity.venue_identity === 'string'
      ? v5Identity.venue_identity
      : JSON.stringify(v5Identity.venue_identity)
    : ''

  const venueEnergyText = v5Identity?.venue_energy ?? ''

  // Extract photography style
  const photographyStyleText = v5Identity?.photography_style ?? ''
  const photoTypesToAvoidText = v5Identity?.photography_avoid
    ? Array.isArray(v5Identity.photography_avoid)
      ? v5Identity.photography_avoid.join(', ')
      : v5Identity.photography_avoid
    : ''

  // Extract voice and emotional promise
  const v5Voice = brandProfile?.v5_brand_voice
  const voiceRationaleText = v5Voice?.voice_rationale ?? ''
  const emotionalPromiseText = v5Voice?.emotional_promise ?? ''

  // Extract content exclusions
  const contentExclusionsText = v5Voice?.content_exclusions
    ? Array.isArray(v5Voice.content_exclusions)
      ? v5Voice.content_exclusions.join(', ')
      : v5Voice.content_exclusions
    : ''

  // Build tone instructions (simplified - can be expanded)
  let toneInstructions = ''
  if (brandProfile?.tone_of_voice) {
    const tov = brandProfile.tone_of_voice as any
    if (typeof tov === 'object' && tov?.value) {
      toneInstructions = tov.value
    } else if (typeof tov === 'string') {
      toneInstructions = tov
    }
  }

  return {
    businessCharacterText,
    targetAudienceText: personaMatch.audienceText,
    brandContextDifferentiator,
    venueIdentityText,
    venueEnergyText,
    photographyStyleText,
    photoTypesToAvoidText,
    voiceRationaleText,
    emotionalPromiseText,
    contentExclusionsText,
    confirmedFacts: facts,
    confirmedFactsSlotB: slotBFacts,
    v5ToneNote: personaMatch.tone_note,
    v5CTAType: personaMatch.cta_type,
    v5ContentAngles: personaMatch.content_angles || [],
    toneInstructions,
  }
}
