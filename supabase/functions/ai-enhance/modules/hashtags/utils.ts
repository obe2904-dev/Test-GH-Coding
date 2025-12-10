import { sanitizeForHashtagValue } from '../../tone-cards.ts'
import { INTENT_GROUPS } from './constants.ts'

export interface TokenStat {
  total: number
  descriptorCount: number
  profileCount: number
  maxLength: number
}

export interface IntentDeduplicationState {
  hashtags: string[]
  seenIntent: Set<string>
  seenNormalized: Set<string>
  seenSanitized: Set<string>
}

const { map: INTENT_LOOKUP, keywords: INTENT_KEYWORDS } = (() => {
  const map = new Map<string, string>()
  const keywords = new Set<string>()

  for (const group of INTENT_GROUPS) {
    if (group.length === 0) {
      continue
    }

    const primaryKey = sanitizeForHashtagValue(group[0])
    if (!primaryKey) {
      continue
    }

    keywords.add(primaryKey)
    map.set(primaryKey, primaryKey)
    for (const alias of group) {
      const aliasKey = sanitizeForHashtagValue(alias)
      if (!aliasKey) {
        continue
      }

      map.set(aliasKey, primaryKey)
    }
  }

  return { map, keywords: Array.from(keywords) }
})()

export function hasInformationalBusinessProfile(profile: any): boolean {
  if (!profile || typeof profile !== 'object') {
    return false
  }

  const stringFields = ['business_name', 'business_category', 'address', 'city', 'region', 'country']
  for (const field of stringFields) {
    const value = (profile as Record<string, unknown>)[field]
    if (typeof value === 'string' && value.trim().length > 0) {
      return true
    }
  }

  const keywords = (profile as Record<string, unknown>).keywords
  if (Array.isArray(keywords) && keywords.some((keyword) => typeof keyword === 'string' && keyword.trim().length > 0)) {
    return true
  }

  if (typeof keywords === 'string' && keywords.trim().length > 0) {
    try {
      const parsed = JSON.parse(keywords)
      if (Array.isArray(parsed) && parsed.some((item) => typeof item === 'string' && item.trim().length > 0)) {
        return true
      }
    } catch {
      const parts = keywords.split(/[;,]/).map((part) => part.trim()).filter(Boolean)
      if (parts.length > 0) {
        return true
      }
    }
  }

  return false
}

export function getIntentGroupKey(tag: string): string | null {
  const sanitized = sanitizeForHashtagValue(tag)
  if (!sanitized) {
    return null
  }

  if (INTENT_LOOKUP.has(sanitized)) {
    return INTENT_LOOKUP.get(sanitized) || sanitized
  }

  for (const keyword of INTENT_KEYWORDS) {
    if (sanitized.includes(keyword)) {
      return keyword
    }
  }

  const singular = sanitized.endsWith('s') && sanitized.length > 4 ? sanitized.slice(0, -1) : sanitized
  return singular
}

export function normalizeHashtag(tag: string): string | null {
  if (typeof tag !== 'string') {
    return null
  }

  const trimmed = tag.trim()
  if (!trimmed) {
    return null
  }

  const withoutHash = trimmed.replace(/^#+/, '')
  const cleaned = withoutHash.replace(/[^\p{L}\p{N}]+/gu, '')

  if (!cleaned) {
    return null
  }

  return `#${cleaned}`
}

export function normalizeHashtagList(raw: unknown): string[] {
  const result: string[] = []
  const seen = new Set<string>()

  const addTag = (value: string) => {
    const normalized = normalizeHashtag(value)
    if (!normalized) {
      return
    }
    const key = normalized.toLowerCase()
    if (seen.has(key)) {
      return
    }
    seen.add(key)
    result.push(normalized)
  }

  if (Array.isArray(raw)) {
    raw.forEach((item) => {
      if (typeof item === 'string') {
        addTag(item)
      }
    })
  } else if (typeof raw === 'string') {
    raw.split(/[\s,]+/).forEach(addTag)
  }

  return result
}

function normalizeWordForComparison(word: string): string {
  return word
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .toLowerCase()
}

export function levenshteinDistance(a: string, b: string): number {
  if (a === b) {
    return 0
  }

  if (a.length === 0) {
    return b.length
  }

  if (b.length === 0) {
    return a.length
  }

  const matrix: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))

  for (let i = 0; i <= a.length; i++) {
    matrix[i][0] = i
  }

  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= a.length; i++) {
    const aChar = a.charAt(i - 1)
    for (let j = 1; j <= b.length; j++) {
      const bChar = b.charAt(j - 1)
      const substitutionCost = aChar === bChar ? 0 : 1

      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + substitutionCost
      )
    }
  }

  return matrix[a.length][b.length]
}

export function collapseDuplicatePrefix(text: string): string {
  if (typeof text !== 'string') {
    return text as unknown as string
  }

  const leadingWhitespace = text.match(/^\s*/)?.[0] ?? ''
  const trailingWhitespace = text.match(/\s*$/)?.[0] ?? ''
  const core = text.trim()

  if (!core) {
    return text
  }

  const words = core.split(/\s+/)
  const normalizedWords = words.map((word) => {
    const normalized = normalizeWordForComparison(word)
    if (normalized) {
      return normalized
    }
    return word.replace(/[.,!?;:]+$/g, '').toLowerCase()
  })
  const maxSegmentLength = Math.min(6, Math.floor(words.length / 2))

  for (let segmentLength = 1; segmentLength <= maxSegmentLength; segmentLength++) {
    const firstSegment = normalizedWords.slice(0, segmentLength).join(' ').trim()
    const secondSegment = normalizedWords.slice(segmentLength, segmentLength * 2).join(' ').trim()

    if (!firstSegment || !secondSegment) {
      continue
    }

    if (firstSegment === secondSegment) {
      const collapsed = [...words.slice(0, segmentLength), ...words.slice(segmentLength * 2)].join(' ')
      return `${leadingWhitespace}${collapsed}${trailingWhitespace}`
    }
  }

  return text
}

export function removeDuplicateBusinessName(text: string, businessName?: string): string {
  if (typeof text !== 'string' || !businessName) {
    return text as unknown as string
  }

  const leadingWhitespace = text.match(/^\s*/)?.[0] ?? ''
  const trailingWhitespace = text.match(/\s*$/)?.[0] ?? ''
  const core = text.trim()

  if (!core) {
    return text
  }

  const businessTokens = businessName
    .split(/\s+/)
    .map((token) => normalizeWordForComparison(token))
    .filter(Boolean)

  if (businessTokens.length === 0) {
    return text
  }

  const words = core.split(/\s+/)
  const normalizedWords = words.map((word) => normalizeWordForComparison(word))

  const chunkSize = businessTokens.length
  const requiredLength = chunkSize * 2
  if (normalizedWords.length < requiredLength) {
    return text
  }

  const businessSignature = businessTokens.join(' ')
  const firstChunk = normalizedWords.slice(0, chunkSize).join(' ')
  const secondChunk = normalizedWords.slice(chunkSize, requiredLength).join(' ')

  if (firstChunk && secondChunk && firstChunk === businessSignature && secondChunk === businessSignature) {
    const collapsed = [...words.slice(0, chunkSize), ...words.slice(requiredLength)].join(' ').trim()
    return `${leadingWhitespace}${collapsed}${trailingWhitespace}`
  }

  return text
}

export function extractCandidateWords(value: string | null | undefined, stopWords: Set<string>): string[] {
  if (!value || typeof value !== 'string') {
    return []
  }

  const cleaned = value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9\s-]+/g, ' ')
    .trim()

  if (!cleaned) {
    return []
  }

  return cleaned.split(/\s+/).filter((word) => word.length >= 3 && !stopWords.has(word))
}

export function getBusinessKeywords(businessProfile: any): string[] {
  if (!businessProfile) {
    return []
  }

  const keywords: string[] = []

  if (typeof businessProfile.business_category === 'string') {
    keywords.push(businessProfile.business_category)
  }

  if (typeof businessProfile.city === 'string') {
    keywords.push(businessProfile.city)
  }

  if (typeof businessProfile.region === 'string') {
    keywords.push(businessProfile.region)
  }

  if (typeof businessProfile.address === 'string') {
    keywords.push(...businessProfile.address.split(/[,;]/))
  }

  if (Array.isArray(businessProfile.keywords)) {
    keywords.push(...businessProfile.keywords)
  } else if (typeof businessProfile.keywords === 'string') {
    try {
      const parsed = JSON.parse(businessProfile.keywords)
      if (Array.isArray(parsed)) {
        parsed.forEach((item) => {
          if (typeof item === 'string') {
            keywords.push(item)
          }
        })
      }
    } catch {
      businessProfile.keywords
        .split(/[;,]/)
        .map((item: string) => item.trim())
        .filter(Boolean)
        .forEach((item: string) => keywords.push(item))
    }
  }

  return keywords
}

export function getHashtagTargets(platforms: string[]): { min: number; max: number } {
  const normalized = platforms.map((platform) => platform.toLowerCase())
  const hasInstagram = normalized.includes('instagram')
  const hasFacebook = normalized.includes('facebook')

  if (hasInstagram) {
    return { min: 2, max: 12 }
  }

  if (hasFacebook) {
    return { min: 1, max: 3 }
  }

  return { min: 3, max: 6 }
}

export function dedupeHashtagsByIntent(tags: string[]): IntentDeduplicationState {
  const state: IntentDeduplicationState = {
    hashtags: [],
    seenIntent: new Set<string>(),
    seenNormalized: new Set<string>(),
    seenSanitized: new Set<string>(),
  }

  tags.forEach((tag) => {
    if (typeof tag !== 'string') {
      return
    }

    const normalized = normalizeHashtag(tag)
    if (!normalized) {
      return
    }

    const lower = normalized.toLowerCase()
    if (state.seenNormalized.has(lower)) {
      return
    }

    const sanitizedKey = sanitizeForHashtagValue(normalized)
    if (!sanitizedKey) {
      return
    }

    if (state.seenSanitized.has(sanitizedKey)) {
      return
    }

    const MIN_SIMILAR_LENGTH = 6
    const MAX_SIMILAR_DIFF = 6

    for (const existing of state.seenSanitized) {
      if (existing.length < MIN_SIMILAR_LENGTH || sanitizedKey.length < MIN_SIMILAR_LENGTH) {
        continue
      }

      if (sanitizedKey.length > existing.length) {
        if (
          sanitizedKey.endsWith(existing) &&
          sanitizedKey.length - existing.length <= MAX_SIMILAR_DIFF
        ) {
          return
        }
      } else if (existing.length > sanitizedKey.length) {
        if (
          existing.endsWith(sanitizedKey) &&
          existing.length - sanitizedKey.length <= MAX_SIMILAR_DIFF
        ) {
          return
        }
      }
    }

    const intentKey = getIntentGroupKey(normalized)
    if (intentKey && state.seenIntent.has(intentKey)) {
      return
    }

    state.hashtags.push(normalized)
    state.seenNormalized.add(lower)
    state.seenSanitized.add(sanitizedKey)

    if (intentKey) {
      state.seenIntent.add(intentKey)
    }
  })

  return state
}

export function tryFillHashtagsToMin(
  state: {
    hashtags: string[]
    seenIntent: Set<string>
    seenNormalized: Set<string>
    seenSanitized?: Set<string>
  },
  min: number,
  sources: Iterable<string>[],
  options?: { isAllowedTag?: (tag: string) => boolean }
) {
  const isAllowedTag = options?.isAllowedTag

  for (const source of sources) {
    for (const candidate of source) {
      if (state.hashtags.length >= min) {
        break
      }

      if (isAllowedTag && !isAllowedTag(candidate)) {
        continue
      }

      const normalized = normalizeHashtag(candidate)
      if (!normalized) {
        continue
      }

      const lower = normalized.toLowerCase()
      if (state.seenNormalized.has(lower)) {
        continue
      }

      const intentKey = getIntentGroupKey(normalized)
      if (intentKey && state.seenIntent.has(intentKey)) {
        continue
      }

      state.hashtags.push(normalized)
      state.seenNormalized.add(lower)
      if (state.seenSanitized) {
        const sanitized = sanitizeForHashtagValue(normalized)
        if (sanitized) {
          state.seenSanitized.add(sanitized)
        }
      }
      if (intentKey) {
        state.seenIntent.add(intentKey)
      }
    }
  }
}

export function buildLocationHashtagFromProfile(businessProfile: any): string | null {
  if (!businessProfile) {
    return null
  }

  const cityCandidate = typeof businessProfile.city === 'string' ? removeLeadingPostalCode(businessProfile.city) : null
  const regionCandidate = typeof businessProfile.region === 'string' ? removeLeadingPostalCode(businessProfile.region) : null
  const addressCandidate = typeof businessProfile.address === 'string'
    ? removeLeadingPostalCode(businessProfile.address.split(',')[0] ?? null)
    : null

  const locationSlug = sanitizeForHashtagValue(cityCandidate || regionCandidate || addressCandidate)
  if (!locationSlug) {
    return null
  }

  const categorySlug = sanitizeForHashtagValue(businessProfile.business_category || '') || 'business'

  return normalizeHashtag(`${locationSlug}${categorySlug}`)
}

export function buildBrandedHashtagFromTemplate(brandedTemplate: string | undefined, businessProfile: any): string | null {
  const businessSlug = sanitizeForHashtagValue(businessProfile?.business_name)
  if (!businessSlug) {
    return null
  }

  if (!brandedTemplate) {
    return normalizeHashtag(businessSlug)
  }

  const replaced = brandedTemplate.replace('{businessName}', businessSlug)
  return normalizeHashtag(replaced)
}

function normalizeHashtagComponent(part?: string | null): string {
  if (!part || typeof part !== 'string') {
    return ''
  }

  const cleaned = part
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
    .trim()

  if (!cleaned) {
    return ''
  }

  const segments = cleaned.split(/[\s-]+/)

  return segments
    .map((segment) => {
      if (!segment) return ''
      if (/^\d+$/.test(segment)) {
        return segment
      }
      const lower = segment.toLowerCase()
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join('')
}

export function createHashtagVariant(...parts: (string | null | undefined)[]) {
  const normalizedParts = parts
    .map((part) => normalizeHashtagComponent(part))
    .filter((value) => value.length > 0)

  if (normalizedParts.length === 0) {
    return null
  }

  const combined = normalizedParts.join('')
  const key = sanitizeForHashtagValue(combined)

  if (!key) {
    return null
  }

  return {
    hashtag: `#${combined}`,
    key,
  }
}

export function rankHashtagsForFacebook(
  hashtags: string[],
  context: {
    tokenStats: Map<string, TokenStat>
    descriptorKeywordKeys: Set<string>
    strongKeywordKeys: Set<string>
    locationKeys: Set<string>
    brandedKey: string | null
    priorityKeys: Set<string>
    keywordCandidateKeys: Set<string>
    toneCardHashtags: Set<string>
    flavorModifierKeys: Set<string>
    aiCandidateKeys?: Set<string>
  }
) {
  const scored = hashtags.map((originalTag, index) => {
    const normalized = normalizeHashtag(originalTag)
    if (!normalized) {
      return {
        tag: originalTag,
        score: Number.NEGATIVE_INFINITY,
        index,
      }
    }

    const key = sanitizeForHashtagValue(normalized)
    if (!key) {
      return {
        tag: normalized,
        score: Number.NEGATIVE_INFINITY,
        index,
      }
    }

    let score = 0

    if (context.brandedKey && key === context.brandedKey) {
      score += 200
    }

    if (context.locationKeys.has(key)) {
      score += 150
    }

    if (context.priorityKeys.has(key)) {
      score += 45
    }

    if (context.keywordCandidateKeys.has(key)) {
      score += 30
    }

    if (context.aiCandidateKeys?.has(key)) {
      score += 32
    }

    if (context.toneCardHashtags.has(key)) {
      score += 12
    }

    const stats = context.tokenStats.get(key)
    if (stats) {
      score += stats.total * 6
      if (stats.descriptorCount >= stats.total && stats.total > 0) {
        score -= 18
      } else if (stats.total > 0) {
        score += 18
      }
      if (stats.maxLength >= 8) {
        score += 4
      }
      if (stats.profileCount > 0) {
        score -= 6
      }
    } else {
      if (context.strongKeywordKeys.has(key)) {
        score += 10
      }
    }

    if (context.descriptorKeywordKeys.has(key)) {
      score -= 12
    }

    if (context.flavorModifierKeys.has(key)) {
      score -= 14
    }

    score += Math.min(key.length, 14)
    score -= index * 0.1

    return {
      tag: normalized,
      score,
      index,
    }
  })

  scored.sort((a, b) => {
    if (a.score === b.score) {
      return a.index - b.index
    }
    return b.score - a.score
  })

  return scored.map((entry) => entry.tag)
}

export function buildLocationHashtagVariants(businessProfile: any, _locale?: { stopWords: Set<string> }) {
  const seen = new Set<string>()
  const hashtags: string[] = []
  const keys: string[] = []

  if (!businessProfile) {
    return { hashtags, keys }
  }

  const addVariant = (...parts: (string | null | undefined)[]) => {
    const variant = createHashtagVariant(...parts)
    if (!variant) return
    if (seen.has(variant.key)) return
    seen.add(variant.key)
    hashtags.push(variant.hashtag)
    keys.push(variant.key)
  }

  const city = typeof businessProfile.city === 'string' ? removeLeadingPostalCode(businessProfile.city) : null
  const region = typeof businessProfile.region === 'string' ? removeLeadingPostalCode(businessProfile.region) : null

  if (city) {
    addVariant(city)
  }

  if (region && !city) {
    addVariant(region)
  }

  const maxVariants = 2
  if (hashtags.length > maxVariants) {
    return {
      hashtags: hashtags.slice(0, maxVariants),
      keys: keys.slice(0, maxVariants),
    }
  }

  return { hashtags, keys }
}

export function removeLeadingPostalCode(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const cleaned = trimmed.replace(/^\d+\s*/u, '')
  return cleaned || trimmed
}
