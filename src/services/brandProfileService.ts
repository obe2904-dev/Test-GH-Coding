/**
 * Brand Profile Service
 * 
 * Handles all data operations for brand profiles.
 * Centralizes Supabase interactions for easier testing and maintenance.
 */

import { supabase } from '../lib/supabase'
import {
  parseImagePreferencesToJsonb,
  parseThingsToAvoidToJsonb,
  parseCoreOfferingsToJsonb,
  formatImagePreferencesForUI,
  formatThingsToAvoidForUI,
  formatCoreOfferingsForUI
} from './brandProfileMapper'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface BrandProfileForm {
  brand_essence: string
  tone_of_voice: string
  target_audience: string
  core_offerings: string
  content_focus: string
  image_preferences: string
  things_to_avoid: string
  cta_style: string
  communication_goal: string
  recognizable_interior_identity: string
}

export interface BrandProfileData extends BrandProfileForm {
  business_id: string
  last_edited_by?: 'user' | 'ai'
  last_edited_at?: string
}

export interface GenerationOptions {
  forceRegenerate?: boolean
  ignoreConfidenceCheck?: boolean
  ignoreDifferentiationGate?: boolean
}

export interface GenerationResult {
  brandProfile?: BrandProfileForm
  error?: string
  skippedGeneration?: boolean
  reason?: string
  analysisEvidence?: {
    distinctive_hooks_missing?: boolean
    differentiation_confidence_score?: number
    ui_prompt_da?: string
  }
}

async function tryRecoverGeneratedProfileFromDatabase(
  businessId: string,
  maxAgeMs: number
): Promise<BrandProfileForm | null> {
  try {
    const attempts = 5
    const delayMs = 700

    for (let attempt = 1; attempt <= attempts; attempt++) {
      const { data, error } = await supabase
        .from('business_brand_profile')
        .select('updated_at, created_at')
        .eq('business_id', businessId)
        .maybeSingle()

      if (!error && data) {
        const updatedAt = (data as any)?.updated_at
        const createdAt = (data as any)?.created_at
        const bestTimestamp =
          (typeof updatedAt === 'string' && updatedAt) ||
          (typeof createdAt === 'string' && createdAt) ||
          null

        if (bestTimestamp) {
          const tsMs = Date.parse(bestTimestamp)
          if (Number.isFinite(tsMs) && Date.now() - tsMs <= maxAgeMs) {
            // Fetch full profile in UI-ready format
            return await fetchBrandProfile(businessId)
          }
        }
      }

      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }

    return null
  } catch {
    return null
  }
}

// ============================================================================
// USER & BUSINESS ID MANAGEMENT
// ============================================================================

/**
 * Get the business ID for the currently authenticated user
 */
export async function getBusinessIdForUser(): Promise<string | null> {
  try {
    const { data: authData } = await supabase.auth.getUser()
    const user = authData?.user
    
    if (!user) {
      console.error('No authenticated user')
      return null
    }

    const { data: businessData, error } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', user.id)
      .maybeSingle()

    if (error || !businessData) {
      console.error('Failed to find business:', error?.message)
      return null
    }

    return (businessData as any).id
  } catch (error) {
    console.error('Error getting business ID:', error)
    return null
  }
}

// ============================================================================
// FETCH OPERATIONS
// ============================================================================

/**
 * Fetch brand profile for a business
 * Returns formatted data ready for UI display
 */
export async function fetchBrandProfile(businessId: string): Promise<BrandProfileForm | null> {
  try {
    // Load brand profile
    const { data: brandData, error: brandError } = await supabase
      .from('business_brand_profile')
      .select('*')
      .eq('business_id', businessId)
      .maybeSingle()

    // Load business profile for target audience (legacy field)
    const { data: profileData, error: profileError } = await supabase
      .from('business_profile')
      .select('*')
      .eq('business_id', businessId)
      .maybeSingle()

    if (brandError) {
      console.error('Failed to load brand profile:', brandError.message)
    }

    if (profileError) {
      console.error('Failed to load business profile:', profileError.message)
    }

    if (!brandData) {
      return null
    }

    // Map to UI format
    const coreOfferingsStructured =
      (brandData as any)?.core_offerings_jsonb ??
      (brandData as any)?.core_offerings ??
      null

    const imagePrefsStructured =
      (brandData as any)?.image_preferences_jsonb ??
      (brandData as any)?.image_preferences ??
      null

    const thingsToAvoidStructured =
      (brandData as any)?.things_to_avoid_jsonb ??
      (brandData as any)?.things_to_avoid ??
      null

    return {
      brand_essence: (brandData as any)?.brand_essence ?? '',
      tone_of_voice: (brandData as any)?.tone_of_voice ?? (brandData as any)?.voice_style ?? '',
      target_audience: (brandData as any)?.target_audience ?? (profileData as any)?.target_audience ?? '',
      core_offerings: formatCoreOfferingsForUI(coreOfferingsStructured),
      content_focus: (brandData as any)?.content_focus ?? '',
      image_preferences: formatImagePreferencesForUI(imagePrefsStructured),
      things_to_avoid: formatThingsToAvoidForUI(thingsToAvoidStructured),
      cta_style: (brandData as any)?.cta_style ?? (brandData as any)?.cta_preference ?? '',
      communication_goal: (brandData as any)?.communication_goal ?? '',
      recognizable_interior_identity: (brandData as any)?.recognizable_interior_identity ?? ''
    }
  } catch (error) {
    console.error('Unexpected error fetching brand profile:', error)
    return null
  }
}

// ============================================================================
// SAVE OPERATIONS
// ============================================================================

/**
 * Helper: Safely convert form field to string for database storage
 * Handles both string inputs (from user) and object inputs (from AI generation)
 */
function toDbString(value: any): string | null {
  if (!value) return null
  if (typeof value === 'string') return value.trim() || null
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value).trim() || null
}

/**
 * Helper: Safely parse field to JSONB
 * If already an object, return it. If string, parse it.
 */
function toJsonb(value: any, parser: (text: string) => any): any {
  if (!value) return null
  if (typeof value === 'object') return value // Already JSONB from AI
  if (typeof value === 'string') return parser(value.trim())
  return null
}

/**
 * Save brand profile for a business
 * Handles both user-edited and AI-generated profiles
 */
export async function saveBrandProfile(
  businessId: string,
  form: BrandProfileForm,
  editedBy: 'user' | 'ai' = 'user'
): Promise<{ success: boolean; error?: string }> {
  try {
    // Update business_profile with target audience (legacy compatibility)
    const { error: profileError } = await supabase
      .from('business_profile')
      .upsert({
        business_id: businessId,
        target_audience: toDbString(form.target_audience),
        updated_at: new Date().toISOString()
      } as any, { onConflict: 'business_id' })

    if (profileError) {
      console.error('Failed to save business_profile:', profileError.message)
    }

    // Update business_brand_profile with all fields
    const { error: brandError } = await supabase
      .from('business_brand_profile')
      .upsert({
        business_id: businessId,
        brand_essence: toDbString(form.brand_essence),
        tone_of_voice: toDbString(form.tone_of_voice),
        target_audience: toDbString(form.target_audience),
        core_offerings: toDbString(form.core_offerings),
        core_offerings_jsonb: toJsonb(form.core_offerings, parseCoreOfferingsToJsonb),
        content_focus: toDbString(form.content_focus),
        image_preferences: toDbString(form.image_preferences),
        image_preferences_jsonb: toJsonb(form.image_preferences, parseImagePreferencesToJsonb),
        things_to_avoid: toDbString(form.things_to_avoid),
        things_to_avoid_jsonb: toJsonb(form.things_to_avoid, parseThingsToAvoidToJsonb),
        cta_style: toDbString(form.cta_style),
        communication_goal: toDbString(form.communication_goal),
        recognizable_interior_identity: toDbString(form.recognizable_interior_identity),
        last_edited_by: editedBy,
        last_edited_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as any, { onConflict: 'business_id' })

    if (brandError) {
      console.error('Failed to save brand profile:', brandError.message)
      return {
        success: false,
        error: brandError.message
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Unexpected error saving brand profile:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// ============================================================================
// GENERATION OPERATIONS
// ============================================================================

/**
 * Generate brand profile using AI
 * Calls the brand-profile-generator Edge Function
 */
export async function generateBrandProfile(
  businessId: string,
  options: GenerationOptions = {}
): Promise<GenerationResult> {
  try {
    console.log('Calling brand-profile-generator with businessId:', businessId)

    const body: Record<string, unknown> = { businessId }
    if (typeof options.forceRegenerate === 'boolean') body.forceRegenerate = options.forceRegenerate
    if (typeof options.ignoreDifferentiationGate === 'boolean') body.ignoreDifferentiationGate = options.ignoreDifferentiationGate
    // Backwards-compat only. Prefer ignoreDifferentiationGate.
    if (typeof options.ignoreConfidenceCheck === 'boolean') body.ignoreConfidenceCheck = options.ignoreConfidenceCheck

    const { data, error } = await supabase.functions.invoke('brand-profile-generator', { body })

    console.log('Response received:', { data, error })

    if (error) {
      console.error('Brand generation error:', error)

      // Supabase functions errors come in a few shapes:
      // - FunctionsHttpError: context is a Response
      // - FunctionsFetchError: context often contains { url, method, fetchError/cause }
      const ctx = (error as any)?.context
      try {
        console.error('Edge function error context keys:', ctx ? Object.keys(ctx) : null)
      } catch {
        // ignore
      }

      const maybeResponse: any = ctx?.response ?? ctx
      if (maybeResponse && typeof maybeResponse.status === 'number') {
        console.error('Error status:', maybeResponse.status)
        console.error('Error statusText:', maybeResponse.statusText)

        // Handle 409 Conflict - Generation already in progress
        if (maybeResponse.status === 409) {
          console.warn('Generation already in progress (409)')
          
          if (typeof maybeResponse.text === 'function') {
            try {
              const text = await maybeResponse.text()
              const json = JSON.parse(text)
              const lockAgeMinutes = json?.lockAgeMinutes || 0
              
              console.log(`Another generation request is active (${lockAgeMinutes.toFixed(1)} min old)`)
              
              return {
                error: lockAgeMinutes > 5
                  ? 'Der genereres allerede en brandprofil, men den tager usædvanlig lang tid. Kontakt support hvis dette fortsætter.'
                  : 'Der genereres allerede en brandprofil — prøv igen om lidt.'
              }
            } catch (e) {
              console.error('Failed to parse 409 response:', e)
            }
          }
          
          return {
            error: 'Der genereres allerede en brandprofil — prøv igen om lidt.'
          }
        }

        // Handle 429 Rate Limiting gracefully
        if (maybeResponse.status === 429) {
          if (typeof maybeResponse.text === 'function') {
            try {
              const text = await maybeResponse.text()
              const json = JSON.parse(text)
              const retryAfterMs = json?.retryAfterMs || 4000
              const retryAfterSeconds = Math.ceil(retryAfterMs / 1000)
              
              console.warn(`Rate limited (429) - retrying after ${retryAfterMs}ms...`)
              
              // Show friendly message
              console.log(`Vi er lidt for hurtige lige nu — prøver igen om ${retryAfterSeconds} sek.`)
              
              // Wait and retry once
              await new Promise(resolve => setTimeout(resolve, retryAfterMs))
              
              console.log('Retrying after rate limit delay...')
              const retryResult = await supabase.functions.invoke('brand-profile-generator', { body })
              
              if (retryResult.error) {
                // Check if retry also got 429
                const retryCtx = (retryResult.error as any)?.context
                const retryResponse: any = retryCtx?.response ?? retryCtx
                const retryIs429 = retryResponse && retryResponse.status === 429
                
                if (retryIs429) {
                  console.warn('⚠️ Retry also got rate limited (429) - genuine OpenAI capacity issue')
                  return {
                    error: `OpenAI har stadig kapacitetsproblemer. Vent ${Math.ceil((retryAfterMs * 1.5) / 1000)} sek. og prøv igen.`
                  }
                }
                
                // Some other error on retry
                console.error('⚠️ Retry failed with different error:', retryResult.error)
                return {
                  error: retryResult.error.message || 'Kunne ikke generere brand profil efter ventetid.'
                }
              }
              
              // Retry succeeded
              console.log('✅ Retry after rate limit succeeded')
              return {
                brandProfile: retryResult.data?.brandProfile,
                skippedGeneration: Boolean(retryResult.data?.skippedGeneration),
                reason: retryResult.data?.reason,
                analysisEvidence: retryResult.data?.analysisEvidence
              }
            } catch (e) {
              console.error('Failed to handle 429 response:', e)
              return {
                error: 'Vi er lidt for hurtige lige nu. Vent et øjeblik og prøv igen.'
              }
            }
          }
          
          return {
            error: 'Vi er lidt for hurtige lige nu. Vent et øjeblik og prøv igen.'
          }
        }

        if (typeof maybeResponse.text === 'function') {
          try {
            const text = await maybeResponse.text()
            console.error('Error response body:', text)
            try {
              const json = JSON.parse(text)
              console.error('Error response JSON:', json)
              return { error: json.error || json.message || error.message }
            } catch {
              // not JSON
            }
          } catch (e) {
            console.error('Could not read error response text:', e)
          }
        }
      }

      // Fetch/network failures: surface the underlying cause if present
      const fetchCause: any = ctx?.fetchError ?? ctx?.cause
      const causeMessage =
        (fetchCause && typeof fetchCause.message === 'string' && fetchCause.message) ||
        (fetchCause && typeof fetchCause === 'string' && fetchCause) ||
        ''
      const urlHint = typeof ctx?.url === 'string' ? ` (${ctx.url})` : ''

      // Recovery: if the function completed but the client connection dropped,
      // the profile may still have been saved. If we see a very recent update,
      // treat the operation as successful.
      const recoverable =
        String(error.message || '').toLowerCase().includes('failed to send a request') ||
        String(causeMessage || '').toLowerCase().includes('failed to fetch') ||
        String(causeMessage || '').toLowerCase().includes('networkerror')

      if (recoverable) {
        const recovered = await tryRecoverGeneratedProfileFromDatabase(businessId, 3 * 60 * 1000)
        if (recovered) {
          console.warn('Recovered brand profile from database after invoke failure')
          return {
            brandProfile: recovered
          }
        }
      }

      return {
        error:
          (causeMessage
            ? `Kunne ikke kontakte Edge Function${urlHint}: ${causeMessage}`
            : error.message || 'Kunne ikke generere brand profil. Prøv igen.')
      }
    }

    if (data?.error) {
      console.error('Brand generation returned error:', data.error)
      return {
        error: data.error
      }
    }

    const wasSkipped = Boolean((data as any)?.skippedGeneration)
    
    if (wasSkipped) {
      console.log('⚠️ Generation was skipped:', (data as any)?.reason)
    }

    return {
      brandProfile: data?.brandProfile,
      skippedGeneration: wasSkipped,
      reason: (data as any)?.reason,
      analysisEvidence: (data as any)?.analysisEvidence
    }
  } catch (error) {
    console.error('Unexpected error during brand generation:', error)
    return {
      error: 'Uventet fejl. Prøv igen.'
    }
  }
}

/**
 * Generate and auto-save brand profile
 * Combines generation + save in one operation
 */
export async function generateAndSaveBrandProfile(
  businessId: string,
  options: GenerationOptions = {}
): Promise<GenerationResult & { savedSuccessfully?: boolean }> {
  const result = await generateBrandProfile(businessId, options)
  
  if (result.error || !result.brandProfile) {
    return result
  }

  // Auto-save generated profile
  console.log('💾 Auto-saving generated brand profile...')
  const saveResult = await saveBrandProfile(businessId, result.brandProfile, 'ai')
  
  if (!saveResult.success) {
    console.error('Failed to auto-save generated profile:', saveResult.error)
    return {
      ...result,
      savedSuccessfully: false,
      error: 'Brand profil blev genereret, men kunne ikke gemmes. Gem manuelt.'
    }
  }

  console.log('✅ Brand profile generated and saved successfully')
  return {
    ...result,
    savedSuccessfully: true
  }
}
