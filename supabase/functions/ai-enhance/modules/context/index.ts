import type { EnhancedContent } from '../hashtags/core/types.ts'
import { resolveLocationContext, type LocationContext } from './location.ts'
import { getToneDescription, getHashtagPlan } from '../../tone-cards.ts'

interface BusinessProfileInput {
  business_name?: string | null
  business_category?: string | null
  description?: string | null
  city?: string | null
  country?: string | null
  tone?: string | null
}

export interface ToneContext {
  category: string | null
  toneDescription: string | null
  voiceGuidance: string | null
  defaultHashtags: string[]
}

export interface TierContext {
  tier: string
  aiModel: string
  maxHashtags: number
}

export interface ContentContext {
  location: LocationContext
  tone: ToneContext
  tier: TierContext
  business: {
    name: string | null
    category: string | null
    description: string | null
  }
  platforms: string[]
  enhancedContent: EnhancedContent
}

const DEFAULT_TIER_MODELS: Record<string, { model: string; maxHashtags: number }> = {
  free: { model: 'gpt-4o-mini', maxHashtags: 8 },
  standardplus: { model: 'gpt-4o', maxHashtags: 15 },
  premium: { model: 'gpt-4o', maxHashtags: 20 }
}

function resolveTierContext(tier?: string | null): TierContext {
  const normalized = (tier || 'free').toLowerCase()
  const settings = DEFAULT_TIER_MODELS[normalized] ?? DEFAULT_TIER_MODELS.free
  return {
    tier: normalized,
    aiModel: settings.model,
    maxHashtags: settings.maxHashtags
  }
}

function resolveToneContext(profile: BusinessProfileInput, language: string): ToneContext {
  const category = profile.business_category ?? null
  const toneDescription = category ? getToneDescription(category, language) : null
  const defaultPlan = getHashtagPlan(category || 'Default', language, profile.country)

  return {
    category,
    toneDescription,
    voiceGuidance: toneDescription,
    defaultHashtags: [
      ...defaultPlan.shared,
      ...defaultPlan.instagramOnly,
      ...(defaultPlan.seasonal ?? [])
    ].filter(Boolean)
  }
}

export function resolveContentContext(params: {
  platforms: string[]
  businessProfile: BusinessProfileInput
  language: string
  tier?: string | null
  enhancedContent: EnhancedContent
}): ContentContext {
  const tier = resolveTierContext(params.tier)
  const location = resolveLocationContext({
    country: params.businessProfile.country,
    city: params.businessProfile.city
  })

  const tone = resolveToneContext(params.businessProfile, params.language)

  return {
    location,
    tone,
    tier,
    business: {
      name: params.businessProfile.business_name ?? null,
      category: params.businessProfile.business_category ?? null,
      description: params.businessProfile.description ?? null
    },
    enhancedContent: params.enhancedContent,
    platforms: params.platforms
  }
}
