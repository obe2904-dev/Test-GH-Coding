/**
 * Construct brand_voice object for Weekly Plan context from V5 profile
 * 
 * Combines:
 * - V5 identity/voice/examples/guardrails (from brand_profile_v5 JSONB)
 * - Photo analysis data (from business_photo_analysis table)
 * - Operational data (price_level, booking_link)
 * - Legacy brand_context (temporary, until V5.1 includes it)
 */

import type { V5BrandProfile } from '../brand-profile/types-v5.ts'
import { constructBrandVoiceFromV5 } from '../brand-profile/v5-transformers.ts'

interface PhotoAnalysis {
  visual_character: string | null
  interior_identity: string | null
  venue_scene: string | null
}

interface Operations {
  price_level?: number | null
  booking_link?: string | null
}

interface LegacyBrandContext {
  brand_context?: {
    origin_story?: string
    unique_differentiator?: string
    local_landmarks?: string[]
  }
  booking_link?: string | null
}

export function buildWeekContextBrandVoice(
  v5Profile: V5BrandProfile,
  photoAnalysis: PhotoAnalysis | null,
  operations: Operations | null,
  legacyBrandContext: LegacyBrandContext | null
): any {
  // Use V5 transformer to construct base brand_voice object
  const brandVoice = constructBrandVoiceFromV5(v5Profile)
  
  // Add photo analysis data (separate from brand profile)
  if (photoAnalysis) {
    brandVoice.visual_character = photoAnalysis.visual_character || null
    brandVoice.recognizable_interior_identity = photoAnalysis.interior_identity || null
    brandVoice.venue_scene = photoAnalysis.venue_scene || null
  }
  
  // Add price level from operations (tone calibration)
  if (operations?.price_level != null) {
    const map: Record<number, string> = {
      1: 'budget',
      2: 'afslappet/casual',
      3: 'middelklasse',
      4: 'premium/fine-dining',
    }
    brandVoice.price_level = map[operations.price_level as number] ?? null
  }
  
  // Add brand_context (legacy field, kept temporarily)
  if (legacyBrandContext?.brand_context) {
    const bctx = legacyBrandContext.brand_context
    if (typeof bctx === 'object') {
      brandVoice.brand_context = {
        origin_story: typeof bctx.origin_story === 'string' ? bctx.origin_story.trim() : undefined,
        unique_differentiator: typeof bctx.unique_differentiator === 'string' ? bctx.unique_differentiator.trim() : undefined,
        local_landmarks: Array.isArray(bctx.local_landmarks) ? bctx.local_landmarks.filter((s: unknown) => typeof s === 'string') : undefined,
      }
    }
  }
  
  // Add booking_link from operations (operational data)
  brandVoice.booking_link = operations?.booking_link || legacyBrandContext?.booking_link || null
  
  return brandVoice
}
