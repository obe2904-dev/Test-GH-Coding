/**
 * Brand Profile Database Operations
 * 
 * Handles persistence of brand profiles to Supabase.
 * Includes legacy column support for backwards compatibility.
 */

import type { BrandProfile, LocationIntelligence } from './types.ts'

/**
 * Converts a value to JSON string for legacy TEXT columns.
 */
function toJsonString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/**
 * Derives structured JSONB from core_offerings text.
 * Parses bullet points into meal_anchors and experience_service_anchors.
 * 
 * @param coreOfferingsText - The core offerings text to parse
 * @returns Structured JSONB object
 */
function deriveCoreOfferingsJsonb(coreOfferingsText: unknown): any {
  if (coreOfferingsText === null || coreOfferingsText === undefined) return null

  // If already an object, return as-is
  if (typeof coreOfferingsText === 'object') {
    return coreOfferingsText
  }

  if (typeof coreOfferingsText !== 'string') {
    return { raw_text: String(coreOfferingsText) }
  }

  const text = coreOfferingsText.trim()
  if (!text) return null

  // If it looks like JSON, try parsing (for forward/backward compatibility)
  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      return JSON.parse(text)
    } catch {
      // fall through to parsing
    }
  }

  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)

  const bullets = lines
    .filter(l => l.startsWith('- ') || l.startsWith('• '))
    .map(l => l.replace(/^[-•]\s+/, '').trim())
    .filter(Boolean)

  const unknowns: string[] = []
  const anchors: string[] = []

  for (const item of bullets) {
    if (/^uklart om\b/i.test(item) || /^unclear\b/i.test(item)) {
      unknowns.push(item)
    } else {
      anchors.push(item)
    }
  }

  return {
    meal_anchors: anchors.slice(0, 3),
    experience_service_anchors: anchors.slice(3, 5),
    unknowns,
    raw_text: text
  }
}

/**
 * Extracts the example phrases (Eksempel: lines) from a tone_of_voice value string.
 * These become `typical_openings` — the register-only example sentences shown in the UI.
 * 
 * Input  : "- Brug du-form\nEksempel: \"Trænger du til en pause?\"\nEksempel: \"Det er tid til noget godt\""
 * Output : ["Trænger du til en pause?", "Det er tid til noget godt"]
 */
function extractEksempelLines(tovValue: string | null | undefined): string[] {
  if (!tovValue || typeof tovValue !== 'string') return []
  return tovValue
    .split('\n')
    .filter(l => l.trimStart().startsWith('Eksempel:'))
    .map(l => l.replace(/^\s*Eksempel:\s*"?/, '').replace(/"?\s*$/, '').trim())
    .filter(Boolean)
}

/**
 * Saves a brand profile to the database.
 * 
 * Supports both new JSONB columns and legacy TEXT columns.
 * Automatically falls back to legacy-only if JSONB columns don't exist.
 * 
 * @param supabase - Supabase client instance
 * @param businessId - UUID of the business
 * @param brandProfile - The brand profile to save
 */
export async function saveBrandProfile(
  supabase: any,
  businessId: string,
  brandProfile: BrandProfile,
  qualityStatus?: 'green' | 'yellow' | 'red',
  generationErrors?: any[],
  versionHash?: string,
  locationIntelligence?: LocationIntelligence | null,
  voiceOptions?: any | null,
  voiceArchetype?: string | null
): Promise<void> {
  // Pre-fetch protected fields — content_strategy is written once and survives regeneration.
  // typical_openings is always refreshed from the latest Eksempel: lines on every regeneration.
  // To enable owner-lock for manually curated openings, apply ADD_TYPICAL_OPENINGS_LOCKED_COLUMN.sql
  // and update this select to include typical_openings_locked.
  const { data: existingRow } = await supabase
    .from('business_brand_profile')
    .select('content_strategy')
    .eq('business_id', businessId)
    .maybeSingle()
  const hasExistingContentStrategy = existingRow?.content_strategy != null

  // Prepare data for database
  const profileData = {
    business_id: businessId,
    updated_at: new Date().toISOString(), // ✅ FIX: always force update detected by poller
    brand_essence: brandProfile.brand_essence.value,
    tone_of_voice: brandProfile.tone_of_voice.value,
    tone_model: brandProfile.tone_model,  // NEW: Structured tone model (JSONB)

    // V2 Brand Profile fields (Marts 2026)
    ...(brandProfile.brand_essence_elaboration?.value !== undefined && {
      brand_essence_elaboration: brandProfile.brand_essence_elaboration.value
    }),
    ...(brandProfile.identity_keywords?.value !== undefined && {
      identity_keywords: brandProfile.identity_keywords.value
    }),
    ...(brandProfile.voice_constraints?.value !== undefined && {
      voice_constraints: brandProfile.voice_constraints.value
    }),
    // Plain-text business descriptor consumed by WeekContext.business_character
    ...(brandProfile.business_character !== undefined && {
      business_character: brandProfile.business_character
    }),

    // Voice derivation rationale — why these rules, what signals were used
    ...((brandProfile as any).voice_rationale !== undefined && {
      voice_rationale: (brandProfile as any).voice_rationale
    }),

    // Content strategy — drives Phase 1 slot assignment (goal_mode + content_category per post)
    // PROTECTED: only written once; regeneration does NOT overwrite a manually curated strategy.
    ...(brandProfile.content_strategy !== undefined && !hasExistingContentStrategy && {
      content_strategy: brandProfile.content_strategy
    }),

    // Legacy TEXT columns (kept as fallback for older clients)
    things_to_avoid: toJsonString(brandProfile.things_to_avoid.value),
    target_audience: brandProfile.target_audience.value,
    core_offerings: brandProfile.core_offerings.value,
    content_focus: brandProfile.content_focus.value,
    content_pillars: toJsonString(brandProfile.content_pillars.value),
    cta_style: brandProfile.cta_style.value,
    communication_goal: brandProfile.communication_goal.value,
    image_preferences: toJsonString(brandProfile.image_preferences.value),

    // New JSONB columns (source of truth)
    things_to_avoid_jsonb: brandProfile.things_to_avoid.value,
    image_preferences_jsonb: brandProfile.image_preferences.value,
    core_offerings_jsonb: deriveCoreOfferingsJsonb(brandProfile.core_offerings.value),
    content_pillars_jsonb: brandProfile.content_pillars.value,

    // Lifecycle columns (when migration is applied)
    // generated_at: new Date().toISOString(),
    // last_edited_by: 'ai',
    // last_edited_at: new Date().toISOString()

    // Quality tracking (when migration is applied)
    ...(qualityStatus && { quality_status: qualityStatus }),
    ...(generationErrors && { generation_errors: generationErrors }),
    
    // Version hash for change detection (when migration is applied)
    ...(versionHash && { version_hash: versionHash }),

    // Location intelligence — deterministic, zero-latency, queryable by post generator
    ...(locationIntelligence !== undefined && { location_intelligence: locationIntelligence }),

    // Voice archetype options — both generated options (recommended + alternative)
    ...(voiceOptions !== undefined && voiceOptions !== null && { voice_options: voiceOptions }),
    // Active archetype key (= recommended on first generation; changes when owner uses "Skift stemme")
    ...(voiceArchetype !== undefined && voiceArchetype !== null && { voice_archetype: voiceArchetype }),

    // Derive typical_openings from the Eksempel: lines in tone_of_voice.value.
    // Always refreshed on regeneration — ensures stale openings from old prompt versions are replaced.
    typical_openings: extractEksempelLines(brandProfile.tone_of_voice.value),
  }

  // Save to database
  const { error } = await supabase
    .from('business_brand_profile')
    .upsert(profileData, { onConflict: 'business_id' })

  // Safety: if migrations haven't been applied yet, retry with only guaranteed base columns
  if (error) {
    const baseOnly = {
      business_id: profileData.business_id,
      updated_at: new Date().toISOString(), // ✅ FIX: also required in fallback path
      brand_essence: profileData.brand_essence,
      tone_of_voice: profileData.tone_of_voice,
      things_to_avoid: profileData.things_to_avoid,
      target_audience: profileData.target_audience,
      core_offerings: profileData.core_offerings,
      content_focus: profileData.content_focus,
      cta_style: profileData.cta_style,
      communication_goal: profileData.communication_goal,
      image_preferences: profileData.image_preferences,
    }
    const { error: retryError } = await supabase
      .from('business_brand_profile')
      .upsert(baseOnly, { onConflict: 'business_id' })
    if (retryError) {
      throw new Error(`Failed to save brand profile (legacy retry): ${retryError.message}`)
    }
    console.log('✅ Brand profile saved to database (base-only retry; newer columns not yet migrated)')
    return
  }

  console.log('✅ Brand profile saved to database')
}

/**
 * Fetches an existing brand profile from the database.
 * 
 * @param supabase - Supabase client instance
 * @param businessId - UUID of the business
 * @returns The brand profile record or null
 */
export async function fetchBrandProfile(
  supabase: any,
  businessId: string
): Promise<any | null> {
  const { data, error } = await supabase
    .from('business_brand_profile')
    .select('*')
    .eq('business_id', businessId)
    .maybeSingle()
  
  if (error) {
    console.warn('⚠️ Failed to fetch brand profile:', error.message)
    return null
  }
  
  return data
}

/**
 * Deletes a brand profile from the database.
 * 
 * @param supabase - Supabase client instance
 * @param businessId - UUID of the business
 */
export async function deleteBrandProfile(
  supabase: any,
  businessId: string
): Promise<void> {
  const { error } = await supabase
    .from('business_brand_profile')
    .delete()
    .eq('business_id', businessId)
  
  if (error) {
    throw new Error(`Failed to delete brand profile: ${error.message}`)
  }
  
  console.log('✅ Brand profile deleted from database')
}
