/**
 * Brand Profile Database Operations
 * 
 * Handles persistence of brand profiles to Supabase.
 * Includes legacy column support for backwards compatibility.
 */

import type { BrandProfile } from './types.ts'

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
  versionHash?: string
): Promise<void> {
  // Prepare data for database
  const profileData = {
    business_id: businessId,
    brand_essence: brandProfile.brand_essence.value,
    tone_of_voice: brandProfile.tone_of_voice.value,
    tone_model: brandProfile.tone_model,  // NEW: Structured tone model (JSONB)
    // Legacy TEXT columns (kept as fallback for older clients)
    things_to_avoid: toJsonString(brandProfile.things_to_avoid.value),
    target_audience: brandProfile.target_audience.value,
    core_offerings: brandProfile.core_offerings.value,
    content_focus: brandProfile.content_focus.value,
    content_pillars: toJsonString(brandProfile.content_pillars.value),
    cta_style: brandProfile.cta_style.value,
    communication_goal: brandProfile.communication_goal.value,
    recognizable_interior_identity: brandProfile.recognizable_interior_identity?.value || null,
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
    ...(versionHash && { version_hash: versionHash })
  }

  // Save to database
  const { error } = await supabase
    .from('business_brand_profile')
    .upsert(profileData, { onConflict: 'business_id' })

  // Safety: if migrations haven't been applied yet, retry without JSONB columns
  if (error) {
    const msg = String(error.message || '')
    const missingNewColumn =
      msg.includes('image_preferences_jsonb') ||
      msg.includes('things_to_avoid_jsonb') ||
      msg.includes('core_offerings_jsonb') ||
      msg.includes('content_pillars_jsonb') ||
      msg.includes('content_pillars')

    if (missingNewColumn) {
      const legacyOnly = { ...profileData }
      delete (legacyOnly as any).image_preferences_jsonb
      delete (legacyOnly as any).things_to_avoid_jsonb
      delete (legacyOnly as any).core_offerings_jsonb
      delete (legacyOnly as any).content_pillars_jsonb
      // content_pillars is a new legacy TEXT column; drop if migration not applied
      delete (legacyOnly as any).content_pillars

      const { error: retryError } = await supabase
        .from('business_brand_profile')
        .upsert(legacyOnly, { onConflict: 'business_id' })

      if (retryError) {
        throw new Error(`Failed to save brand profile (legacy retry): ${retryError.message}`)
      }

      console.log('✅ Brand profile saved to database (legacy retry; some newer columns missing)')
      return
    }

    throw new Error(`Failed to save brand profile: ${msg}`)
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
