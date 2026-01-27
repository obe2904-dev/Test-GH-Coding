import { getHashtagPlan, getHashtagGuidance, sanitizeForHashtagValue } from '../tone-cards.ts'
import { resolveLocaleConfig } from './locales.ts'
import { ensureHashtagCoverage } from './hashtags/core/coverage.ts'
import { requestHashtagGroupPayload } from './hashtags/core/openai.ts'
import { buildHashtagPrompt } from './hashtags/core/prompt.ts'
import { createSpellingContext } from './hashtags/core/spelling.ts'
import { EnhancedContent, HashtagGroups } from './hashtags/core/types.ts'
import { buildHashtagLocaleResources } from './hashtags/language-data.ts'
import {
  collapseDuplicatePrefix,
  extractCandidateWords,
  normalizeHashtag,
  removeDuplicateBusinessName,
  createHashtagVariant,
  removeLeadingPostalCode,
} from './hashtags/utils.ts'
import { resolveContentContext } from './context/index.ts'

export type { EnhancedContent, HashtagGroups } from './hashtags/core/types.ts'

export interface HashtagGenerationInput {
  includeHashtags: boolean
  platforms: string[]
  businessProfile: any
  language: string
  userTier: string
  aiModel: string
  enhancedContent: EnhancedContent
  originalText: string
}

export interface HashtagGenerationResult {
  hashtags: string[]
  hashtagGroups: HashtagGroups
  hashtagGuidance: string
}

interface PrimaryInstagramPromptContext {
  cityLabel: string
  countryLabel: string
  seasonLabel: string
  toneDescription: string
  businessDescription: string
  primaryMax: number
  instagramRange: { min: number; max: number }
  activeEvents: string[]
  text: string
}

function buildLocationLabel(value?: string | null): string {
  return value?.trim() ? value.trim() : ''
}

function formatSeasonName(season: string): string {
  const map: Record<string, string> = {
    winter: 'winter',
    spring: 'spring',
    summer: 'summer',
    autumn: 'autumn'
  }
  return map[season] ?? season
}

function describePrimaryPrompt(context: PrimaryInstagramPromptContext): string {
  const eventDetail = context.activeEvents.length > 0
    ? `Upcoming or current events: ${context.activeEvents.join(', ')}.`
    : ''

  return [
    'Task:',
    `Recommend high-quality hashtags for ${context.businessDescription} in ${context.cityLabel || context.countryLabel || 'the local area'}, ${context.countryLabel || context.cityLabel || ''}, using ${context.toneDescription}.`,
    '',
    'Post text:',
    `"${context.text}"`,
    '',
    'Important hashtag logic:',
    '• Facebook hashtags must stay broad, simple, and low in number. Focus on brand, location, or mood. Avoid niche food items for Facebook.',
    '• Instagram hashtags may include more specific, seasonal, and content-based ideas (e.g., drinks, menu items). Instagram supports niche discovery.',
    '',
    'Requirements:',
    `1. Provide up to ${context.primaryMax} primary hashtags for Facebook (they must also work on Instagram). Focus on brand, location, and seasonal mood.`,
    `2. Provide ${context.instagramRange.min}–${context.instagramRange.max} additional Instagram-only hashtags designed to expand reach with seasonal or niche topics.`,
    '3. Skip irrelevant hashtags; quality beats quantity.',
    `4. Ensure every hashtag feels natural for ${context.businessDescription} during ${context.seasonLabel}. ${eventDetail}`.trim(),
    '5. Avoid spammy or overly generic tags.',
    '',
    'Output format (MUST be valid JSON):',
    '{',
    '  "primary": ["#tag"],',
    '  "instagram_only": ["#tag"]',
    '}'
  ].join('\n')
}

export async function generateHashtags(input: HashtagGenerationInput): Promise<HashtagGenerationResult> {
  const {
    includeHashtags,
    platforms,
    businessProfile,
    language,
    userTier,
    aiModel,
    enhancedContent,
    originalText,
  } = input

  const locale = resolveLocaleConfig({
    language,
    country: businessProfile?.country ?? null,
  })

  const localeResources = buildHashtagLocaleResources(locale.languageCode)
  const { flavorModifierKeys } = localeResources
  const canonicalDisplayLookup = localeResources.canonicalDisplayMap
  const languageLabel = locale.languageLabel

  const profileCity = typeof businessProfile?.city === 'string' ? removeLeadingPostalCode(businessProfile.city) : null
  const profileCountry = typeof businessProfile?.country === 'string' ? businessProfile.country : null
  const cityKey = profileCity ? sanitizeForHashtagValue(profileCity) : null
  const countryKey = profileCountry ? sanitizeForHashtagValue(profileCountry) : null
  const cityCountryVariant = cityKey && countryKey ? createHashtagVariant(profileCity, profileCountry) : null
  const cityCountryHashtag = cityCountryVariant?.hashtag ?? null

  const enforceLocationForTag = (tag: string): string | null => {
    const normalized = normalizeHashtag(tag)
    if (!normalized) {
      return null
    }

    if (cityKey && countryKey && cityCountryHashtag) {
      const key = sanitizeForHashtagValue(normalized)
      if (key && key === `${countryKey}${cityKey}`) {
        return cityCountryHashtag
      }
    }

    return normalized
  }

  const normalizeAndDedupeWithLocation = (tags: string[]): string[] => {
    const result: string[] = []
    const seen = new Set<string>()

    tags.forEach((tag) => {
      const adjusted = enforceLocationForTag(tag)
      if (!adjusted) {
        return
      }
      const lower = adjusted.toLowerCase()
      if (seen.has(lower)) {
        return
      }
      seen.add(lower)
      result.push(adjusted)
    })

    return result
  }

  console.log('📋 Business Profile received:', JSON.stringify(businessProfile, null, 2))
  
  const plan = getHashtagPlan(
    businessProfile?.business_category || 'Default',
    locale.languageCode,
    businessProfile?.country,
  )
  
  console.log('📊 Hashtag Plan:', JSON.stringify(plan, null, 2))

  const contentContext = resolveContentContext({
    platforms,
    businessProfile,
    language,
    tier: userTier,
    enhancedContent: {
      text: enhancedContent.text,
      headline: enhancedContent.headline ?? null,
      hashtags: enhancedContent.hashtags ?? []
    }
  })

  const hashtagGuidance = includeHashtags && businessProfile?.business_category
    ? getHashtagGuidance(businessProfile.business_category, locale.languageCode, businessProfile)
    : ''

  const emptyGroups: HashtagGroups = {
    primary: [],
    local: [],
    foodie: [],
    extras: [],
  }

  if (!includeHashtags) {
    return {
      hashtags: [],
      hashtagGroups: emptyGroups,
      hashtagGuidance,
    }
  }

  let hashtagGroups: HashtagGroups = { ...emptyGroups }
  let rawHashtagPool: string[] = []
  let priorityHashtags: string[] = []

  let applySpellingCorrections: (tags: string[]) => string[] = (tags) => normalizeAndDedupeWithLocation(tags)

  const topicKeywords = Array.from(new Set([
    ...extractCandidateWords(enhancedContent.text, locale.stopWords),
    ...extractCandidateWords(enhancedContent.headline || '', locale.stopWords),
  ])).slice(0, 6)

  const spellingContext = createSpellingContext({
    canonicalDisplayLookup,
    originalText,
    enhancedContent: {
      text: enhancedContent.text,
      headline: enhancedContent.headline ?? null,
    },
  })

  const baseApplySpellingCorrections = spellingContext.applySpellingCorrections
  applySpellingCorrections = (tags: string[]) => normalizeAndDedupeWithLocation(baseApplySpellingCorrections(tags))

  const topicKeywordDisplays = topicKeywords.map((keyword) => {
    const display = spellingContext.keywordDisplayMap.get(keyword)
    return display ?? keyword
  })

  // Generate hashtags with proper 4-category structure
  try {
    const hashtagPrompt = buildHashtagPrompt({
      plan,
      businessProfile,
      languageLabel,
      platforms,
      enhancedContent,
      topicKeywords,
      topicKeywordDisplays,
      hashtagGuidance,
      season: formatSeasonName(contentContext.location.season),
      activeEvents: contentContext.location.activeEvents.map((e) => e.label),
    })

    const parsed = await requestHashtagGroupPayload({
      aiModel,
      prompt: hashtagPrompt,
    })

    if (parsed && typeof parsed === 'object') {
      const bucketLookup = parsed as Record<string, unknown>
      const normalizeGroup = (value: unknown): string[] => {
        if (!Array.isArray(value)) return []
        return value.filter((item): item is string => typeof item === 'string')
      }

      // New structure: separate facebook and instagram objects
      const facebook = bucketLookup.facebook as Record<string, unknown> | undefined
      const instagram = bucketLookup.instagram as Record<string, unknown> | undefined

      // Collect Facebook hashtags (always shown on Facebook)
      const facebookBrand = facebook ? normalizeGroup(facebook.brand) : []
      const facebookLocation = facebook ? normalizeGroup(facebook.location) : []
      const facebookMood = facebook ? normalizeGroup(facebook.mood) : []

      // Collect Instagram-specific hashtags (added to Facebook hashtags for Instagram)
      const instagramFoodie = instagram ? normalizeGroup(instagram.foodie) : []
      const instagramExtras = instagram ? normalizeGroup(instagram.extras) : []

      // Map to our 4-category structure:
      // - primary: Facebook brand + mood hashtags (used on both platforms)
      // - local: Facebook location hashtags (used on both platforms)
      // - foodie: Instagram-specific food hashtags (Instagram only)
      // - extras: Instagram-specific extras hashtags (Instagram only)
      hashtagGroups = {
        primary: applySpellingCorrections([...facebookBrand, ...facebookMood]),
        local: applySpellingCorrections([...facebookLocation]),
        foodie: applySpellingCorrections([...instagramFoodie]),
        extras: applySpellingCorrections([...instagramExtras]),
      }

      console.log('📦 Parsed hashtag structure:', {
        facebook: { brand: facebookBrand, location: facebookLocation, mood: facebookMood },
        instagram: { foodie: instagramFoodie, extras: instagramExtras },
        mapped: hashtagGroups
      })

      // Since AI now generates clean, structured hashtags, use them directly
      // Collect all hashtags for the flat array (maintaining order: primary, local, foodie, extras)
      const allHashtags = [
        ...hashtagGroups.primary,
        ...hashtagGroups.local,
        ...hashtagGroups.foodie,
        ...hashtagGroups.extras,
      ]

      // Deduplicate while preserving order
      const seen = new Set<string>()
      rawHashtagPool = allHashtags.filter(tag => {
        const normalized = tag.toLowerCase()
        if (seen.has(normalized)) return false
        seen.add(normalized)
        return true
      })

      priorityHashtags = [...rawHashtagPool]
      
      console.log('✅ Final hashtag distribution:', {
        total: rawHashtagPool.length,
        byCategory: {
          primary: hashtagGroups.primary.length,
          local: hashtagGroups.local.length,
          foodie: hashtagGroups.foodie.length,
          extras: hashtagGroups.extras.length
        }
      })
    }
  } catch (error) {
    console.error('Hashtag generation pipeline failed:', error)
    if (Array.isArray(enhancedContent.hashtags)) {
      const corrected = applySpellingCorrections(enhancedContent.hashtags)
      rawHashtagPool = [...corrected]
      priorityHashtags = [...corrected]
    }
  }

  // Since AI now generates clean structured hashtags in facebook/instagram format,
  // we can use them directly without complex coverage logic
  
  // Use the already deduplicated and ordered hashtags
  const allHashtags = priorityHashtags.length > 0 
    ? priorityHashtags 
    : [...hashtagGroups.primary, ...hashtagGroups.local, ...hashtagGroups.foodie, ...hashtagGroups.extras]

  return {
    hashtags: allHashtags,
    hashtagGroups: hashtagGroups,
    hashtagGuidance,
  }
}

export function applyPostProcessing(
  content: { text?: string; headline?: string },
  businessName?: string,
) {
  if (content.text) {
    content.text = collapseDuplicatePrefix(content.text)
    content.text = removeDuplicateBusinessName(content.text, businessName)
  }

  if (content.headline) {
    content.headline = collapseDuplicatePrefix(content.headline)
    content.headline = removeDuplicateBusinessName(content.headline, businessName)
  }
}
