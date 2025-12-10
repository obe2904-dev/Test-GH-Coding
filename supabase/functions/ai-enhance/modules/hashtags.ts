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

  let simplePrimaryTags: string[] | null = null
  let simpleInstagramTags: string[] | null = null

  try {
    const cityLabel = buildLocationLabel(contentContext.location.city?.displayName || businessProfile?.city)
    const countryLabel = buildLocationLabel(contentContext.location.countryName || businessProfile?.country)
    const businessDescription = businessProfile?.description
      ? businessProfile.description
      : `a cozy, welcoming ${businessProfile?.business_category || 'business'}`
    const toneDescription = contentContext.tone.toneDescription
      || 'a warm, conversational tone that makes customers feel at home and highlights comfort, quality, and the social experience'
    const primaryMax = Math.min(3, contentContext.tier.maxHashtags)
    const instagramMax = contentContext.tier.tier === 'free'
      ? Math.min(5, contentContext.tier.maxHashtags)
      : Math.min(8, contentContext.tier.maxHashtags)
    const promptPayload: PrimaryInstagramPromptContext = {
      cityLabel,
      countryLabel,
      toneDescription,
      businessDescription,
      primaryMax,
      instagramRange: {
        min: contentContext.tier.tier === 'free' ? 3 : 3,
        max: instagramMax
      },
      seasonLabel: formatSeasonName(contentContext.location.season),
      activeEvents: contentContext.location.activeEvents.map((event) => event.label),
      text: enhancedContent.text?.trim() || ''
    }

    // Use Danish/localized prompt instead of English
    const localizedPrompt = buildHashtagPrompt({
      plan,
      businessProfile,
      languageLabel,
      platforms,
      enhancedContent,
      topicKeywords,
      topicKeywordDisplays,
      hashtagGuidance,
    })

    const parsed = await requestHashtagGroupPayload({
      aiModel,
      prompt: localizedPrompt,
    })

    if (parsed && typeof parsed === 'object') {
      const bucketLookup = parsed as Record<string, unknown>
      const normalizeGroup = (value: unknown): string[] => {
        if (!Array.isArray(value)) return []
        return value.filter((item): item is string => typeof item === 'string')
      }

      const primaryList = normalizeGroup(
        bucketLookup.primary ?? bucketLookup.facebook ?? bucketLookup.facebookTags
      )
      const instagramList = normalizeGroup(
        bucketLookup.instagram_only ?? bucketLookup.instagram ?? bucketLookup.instagramTags
      )

      if (primaryList.length > 0) {
        simplePrimaryTags = primaryList
        simpleInstagramTags = instagramList
      }
    }
  } catch (error) {
    console.error('Simple hashtag request failed:', error)
  }

  if (simplePrimaryTags) {
    const normalizedPrimary = applySpellingCorrections(simplePrimaryTags)
    const normalizedInstagram = applySpellingCorrections(simpleInstagramTags ?? [])

    const primarySet = new Set(normalizedPrimary.map((tag) => tag.toLowerCase()))
    const instagramExtras = normalizedInstagram.filter((tag) => !primarySet.has(tag.toLowerCase()))

    const combined = [...normalizedPrimary, ...instagramExtras]

    const finalGroups: HashtagGroups = {
      primary: [...normalizedPrimary],
      local: [],
      foodie: [],
      extras: instagramExtras,
    }

    return {
      hashtags: combined,
      hashtagGroups: finalGroups,
      hashtagGuidance,
    }
  }

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

      hashtagGroups = {
        primary: applySpellingCorrections(normalizeGroup(bucketLookup.primary)),
        local: applySpellingCorrections(normalizeGroup(bucketLookup.local)),
        foodie: applySpellingCorrections(normalizeGroup(bucketLookup.foodie)),
        extras: applySpellingCorrections(normalizeGroup(bucketLookup.extras)),
      }

      const dedupe = new Set<string>()
      rawHashtagPool = []

      ;(['primary', 'local', 'foodie', 'extras'] as const).forEach((groupKey) => {
        hashtagGroups[groupKey] = applySpellingCorrections(hashtagGroups[groupKey])
        hashtagGroups[groupKey].forEach((tag) => {
          const normalized = normalizeHashtag(tag)
          if (!normalized) {
            return
          }
          const lower = normalized.toLowerCase()
          if (dedupe.has(lower)) {
            return
          }
          dedupe.add(lower)
          rawHashtagPool.push(normalized)
        })
      })

      priorityHashtags = applySpellingCorrections([...rawHashtagPool])
    }
  } catch (error) {
    console.error('Hashtag generation pipeline failed:', error)
    if (Array.isArray(enhancedContent.hashtags)) {
      const corrected = applySpellingCorrections(enhancedContent.hashtags)
      rawHashtagPool = [...corrected]
      priorityHashtags = [...corrected]
    }
  }

  if (priorityHashtags.length === 0) {
    priorityHashtags = [
      ...hashtagGroups.primary,
      ...hashtagGroups.local,
      ...hashtagGroups.foodie,
    ]
  }

  const normalizedPriority = Array.from(
    new Set(priorityHashtags.map((tag) => normalizeHashtag(tag) || tag)),
  ).filter((tag): tag is string => typeof tag === 'string')

  const finalHashtags = ensureHashtagCoverage({
    plan,
    rawHashtags: rawHashtagPool,
    platforms,
    text: enhancedContent.text,
    headline: enhancedContent.headline,
    businessProfile,
    userTier,
    priorityHashtags: normalizedPriority,
    originalText,
    locale,
    flavorModifierKeys,
  })

  const correctedFinalHashtags = applySpellingCorrections(finalHashtags)

  const assigned = new Set<string>()
  const finalSet = new Map<string, string>()
  correctedFinalHashtags.forEach((tag) => {
    finalSet.set(tag.toLowerCase(), tag)
  })

  const orderedGroups: [keyof HashtagGroups, string[]][] = [
    ['primary', []],
    ['local', []],
    ['foodie', []],
    ['extras', []],
  ]

  orderedGroups.forEach(([groupKey, destination]) => {
    hashtagGroups[groupKey].forEach((tag) => {
      const normalized = tag.toLowerCase()
      if (finalSet.has(normalized) && !assigned.has(normalized)) {
        destination.push(finalSet.get(normalized)!)
        assigned.add(normalized)
      }
    })
  })

  correctedFinalHashtags.forEach((tag) => {
    const normalized = tag.toLowerCase()
    if (!assigned.has(normalized)) {
      orderedGroups.find(([key]) => key === 'extras')?.[1].push(tag)
      assigned.add(normalized)
    }
  })

  const finalGroups: HashtagGroups = {
    primary: orderedGroups[0][1],
    local: orderedGroups[1][1],
    foodie: orderedGroups[2][1],
    extras: orderedGroups[3][1],
  }

  return {
    hashtags: correctedFinalHashtags,
    hashtagGroups: finalGroups,
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
