import {
  getSeasonForCountry,
  sanitizeForHashtagValue,
  type HashtagPlan,
  type Season
} from '../../../tone-cards.ts'
import { type LocaleConfig } from '../../locales.ts'
import {
  BANNED_GENERIC_HASHTAG_KEYS,
  FACEBOOK_CONCEPT_KEYWORDS,
  GENERIC_CATEGORY_KEYWORDS,
  SEASONAL_CONTEXT_KEYWORDS,
  SEASON_KEYWORD_MAP,
  WEAK_CONTEXT_KEYWORDS
} from '../constants.ts'
import {
  buildBrandedHashtagFromTemplate,
  buildLocationHashtagFromProfile,
  buildLocationHashtagVariants,
  createHashtagVariant,
  dedupeHashtagsByIntent,
  extractCandidateWords,
  getBusinessKeywords,
  getHashtagTargets,
  getIntentGroupKey,
  hasInformationalBusinessProfile,
  normalizeHashtag,
  normalizeHashtagList,
  rankHashtagsForFacebook,
  removeLeadingPostalCode,
  TokenStat,
  tryFillHashtagsToMin
} from '../utils.ts'

export interface HashtagCoverageOptions {
  plan: HashtagPlan
  rawHashtags: unknown
  platforms: string[]
  text: string
  headline?: string | null
  businessProfile: any
  userTier: string
  priorityHashtags?: string[]
  originalText?: string
  locale: LocaleConfig
  flavorModifierKeys: Set<string>
}

function getCurrentSeasonForFiltering(country?: string | null): Season | null {
  return getSeasonForCountry(country ?? undefined)
}

function detectSeasonFromTagKey(tagKey: string): Season | null {
  for (const [season, keywords] of Object.entries(SEASON_KEYWORD_MAP) as [Season, string[]][]) {
    if (keywords.some((keyword) => tagKey.includes(keyword))) {
      return season
    }
  }
  return null
}

export function ensureHashtagCoverage(options: HashtagCoverageOptions): string[] {
  const {
    plan,
    rawHashtags,
    platforms,
    text,
    headline,
    businessProfile,
    priorityHashtags = [],
    originalText,
    locale,
    flavorModifierKeys
  } = options

  let { min, max } = getHashtagTargets(platforms)
  const hasInstagram = platforms.some((platform) => platform.toLowerCase() === 'instagram')
  const hasFacebook = platforms.some((platform) => platform.toLowerCase() === 'facebook')

  if (hasInstagram) {
    min = 0
  }

  if (hasInstagram && !hasFacebook && !hasInformationalBusinessProfile(businessProfile)) {
    max = Math.min(max, 4)
  }

  const currentSeason = getCurrentSeasonForFiltering(businessProfile?.country)

  const toneCardHashtags = new Set<string>()
  const contextKeywords = new Set<string>()
  const allowedKeywords = new Set<string>()

  const addKeywordsToSet = (target: Set<string>, words: string[]) => {
    words.forEach((word) => {
      const key = sanitizeForHashtagValue(word)
      if (key) {
        target.add(key)
      }
    })
  }

  plan.shared.forEach((tag) => {
    const key = sanitizeForHashtagValue(tag)
    if (key) toneCardHashtags.add(key)
  })
  plan.instagramOnly.forEach((tag) => {
    const key = sanitizeForHashtagValue(tag)
    if (key) toneCardHashtags.add(key)
  })
  plan.seasonal.forEach((tag) => {
    const key = sanitizeForHashtagValue(tag)
    if (key) toneCardHashtags.add(key)
  })

  addKeywordsToSet(contextKeywords, extractCandidateWords(text, locale.stopWords))
  addKeywordsToSet(contextKeywords, extractCandidateWords(headline || '', locale.stopWords))

  if (originalText) {
    const originalWords = extractCandidateWords(originalText, locale.stopWords)
    addKeywordsToSet(contextKeywords, originalWords)
    addKeywordsToSet(allowedKeywords, originalWords)
  }

  const businessKeywordStrings = getBusinessKeywords(businessProfile)
  businessKeywordStrings.forEach((keyword) => {
    const extracted = extractCandidateWords(keyword, locale.stopWords)
    addKeywordsToSet(contextKeywords, extracted)
    addKeywordsToSet(allowedKeywords, extracted)
  })

  if (!originalText) {
    addKeywordsToSet(allowedKeywords, extractCandidateWords(text, locale.stopWords))
  }

  const locationVariants = buildLocationHashtagVariants(businessProfile, locale)
  locationVariants.keys.forEach((key) => {
    contextKeywords.add(key)
    allowedKeywords.add(key)
  })
  const locationKeywordSet = new Set(locationVariants.keys)

  const normalizedFromAI = normalizeHashtagList(rawHashtags)
  const aiCandidateKeys = new Set<string>()
  normalizedFromAI.forEach((tag) => {
    const key = sanitizeForHashtagValue(tag)
    if (key) {
      aiCandidateKeys.add(key)
    }
  })

  const priorityKeySet = new Set<string>()
  priorityHashtags.forEach((tag) => {
    const normalized = normalizeHashtag(tag)
    if (!normalized) {
      return
    }
    const key = sanitizeForHashtagValue(normalized)
    if (!key) {
      return
    }
    priorityKeySet.add(key)
  })

  const sharedBucket: string[] = []
  const instagramBucket: string[] = []
  const used = new Set<string>()
  const intentGroups = new Set<string>()
  const facebookConceptKeywords = new Set<string>()
  let brandedHashtagNormalized: string | null = null
  let brandedHashtagKey: string | null = null

  const matchesSeasonalContext = (tagKey: string) => {
    const required = SEASONAL_CONTEXT_KEYWORDS[tagKey]
    if (!required || required.length === 0) {
      return true
    }
    return required.some((keyword) => contextKeywords.has(keyword))
  }

  const referenceKeywords = allowedKeywords.size > 0 ? allowedKeywords : contextKeywords

  const tagMatchesContext = (tagKey: string) => {
    if (!tagKey) return false

    if (GENERIC_CATEGORY_KEYWORDS.has(tagKey)) return true

    if (toneCardHashtags.has(tagKey)) {
      if (referenceKeywords.has(tagKey)) return true

      for (const keyword of referenceKeywords) {
        if (keyword.length < 3) continue
        if (tagKey.includes(keyword) || keyword.includes(tagKey)) return true
      }

      return false
    }

    if (referenceKeywords.has(tagKey)) return true

    for (const keyword of referenceKeywords) {
      if (keyword.length < 3) continue
      if (tagKey.includes(keyword) || keyword.includes(tagKey)) return true
    }

    return false
  }

  const addPriorityTag = (tag: string | null | undefined) => {
    if (hasFacebook) {
      addShared(tag)
    } else if (hasInstagram) {
      addInstagram(tag)
    } else {
      addShared(tag)
    }
  }

  const isTagAllowed = (tag: string) => {
    const key = sanitizeForHashtagValue(tag)
    if (!key) return false

    const isBrandedTag = !!brandedHashtagKey && key === brandedHashtagKey

    if (!isBrandedTag && key.length < 3) return false

    if (!isBrandedTag && BANNED_GENERIC_HASHTAG_KEYS.has(key)) return false

    if (!isBrandedTag && !tagMatchesContext(key)) return false

    if (!isBrandedTag) {
      const detectedSeason = detectSeasonFromTagKey(key)
      if (detectedSeason && detectedSeason !== currentSeason) {
        return false
      }

      if (!matchesSeasonalContext(key)) {
        return false
      }
    }

    if (hasFacebook && !isBrandedTag) {
      const lower = key.toLowerCase()
      for (const kw of FACEBOOK_CONCEPT_KEYWORDS) {
        if (lower.includes(kw)) {
          if (facebookConceptKeywords.has(kw)) {
            return false
          }
        }
      }
    }

    return true
  }

  const addTag = (
    bucket: string[],
    tag: string | null | undefined,
    options: {
      intentGroupSet?: Set<string>
      bucketType: 'shared' | 'instagram'
    }
  ) => {
    if (!tag || typeof tag !== 'string') return false

    const normalized = normalizeHashtag(tag)
    if (!normalized) return false
    if (!isTagAllowed(normalized)) return false

    const lower = normalized.toLowerCase()
    if (used.has(lower)) return false

    let conceptKeyword: string | null = null
    if (options.bucketType === 'shared' && hasFacebook) {
      for (const keyword of FACEBOOK_CONCEPT_KEYWORDS) {
        if (lower.includes(keyword)) {
          conceptKeyword = keyword
          if (facebookConceptKeywords.has(keyword)) {
            return false
          }
          break
        }
      }
    }

    if (options.intentGroupSet) {
      const intentKey = getIntentGroupKey(normalized)
      if (intentKey && options.intentGroupSet.has(intentKey)) {
        return false
      }
      bucket.push(normalized)
      used.add(lower)
      if (intentKey) {
        options.intentGroupSet.add(intentKey)
      }
      if (conceptKeyword) {
        facebookConceptKeywords.add(conceptKeyword)
      }
      return true
    }

    bucket.push(normalized)
    used.add(lower)
    if (conceptKeyword) {
      facebookConceptKeywords.add(conceptKeyword)
    }
    return true
  }

  const addShared = (tag: string | null | undefined) =>
    addTag(sharedBucket, tag, { intentGroupSet: intentGroups, bucketType: 'shared' })
  const addInstagram = (tag: string | null | undefined) =>
    addTag(instagramBucket, tag, { intentGroupSet: intentGroups, bucketType: 'instagram' })

  priorityHashtags.forEach(addPriorityTag)

  plan.shared.forEach(addShared)

  const locationHashtag = buildLocationHashtagFromProfile(businessProfile)
  const brandedHashtag = buildBrandedHashtagFromTemplate(plan.branded, businessProfile)
  brandedHashtagNormalized = brandedHashtag ? normalizeHashtag(brandedHashtag) : null
  brandedHashtagKey = brandedHashtagNormalized
    ? sanitizeForHashtagValue(brandedHashtagNormalized)
    : null

  const seasonalContextTags = plan.seasonal.filter((tag) => {
    const key = sanitizeForHashtagValue(tag)
    return !!key && matchesSeasonalContext(key)
  })
  const limitedSeasonalTags = seasonalContextTags.slice(0, 1)

  if (hasFacebook) {
    addShared(locationHashtag)
    addShared(brandedHashtag)
  } else if (hasInstagram) {
    addInstagram(locationHashtag)
    addInstagram(brandedHashtag)
  }

  if (hasInstagram) {
    normalizedFromAI.forEach((tag) => addInstagram(tag))
  } else if (hasFacebook) {
    normalizedFromAI.forEach((tag) => addShared(tag))
  } else {
    normalizedFromAI.forEach((tag) => addShared(tag))
  }

  if (hasInstagram) {
    if (locationVariants.hashtags.length > 0) {
      addInstagram(locationVariants.hashtags[0])
    }

    plan.instagramOnly.forEach(addInstagram)
    limitedSeasonalTags.forEach(addInstagram)
  } else if (hasFacebook) {
    limitedSeasonalTags.forEach(addShared)
  }

  const profileFallbackSet = new Set<string>()
  const addProfileFallbackTag = (tag: string | null | undefined) => {
    if (!tag || typeof tag !== 'string') return
    const normalized = normalizeHashtag(tag)
    if (!normalized) return
    profileFallbackSet.add(normalized)
  }

  const addProfileFallbackValue = (value: string | null | undefined) => {
    if (!value || typeof value !== 'string') return
    const cleaned = removeLeadingPostalCode(value)
    if (!cleaned) return
    const key = sanitizeForHashtagValue(cleaned)
    if (!key) return
    addProfileFallbackTag(`#${key}`)
  }

  addProfileFallbackTag(locationHashtag)
  addProfileFallbackTag(brandedHashtag)
  locationVariants.hashtags.forEach(addProfileFallbackTag)

  addProfileFallbackValue(businessProfile?.business_category)
  addProfileFallbackValue(businessProfile?.business_name)
  addProfileFallbackValue(businessProfile?.city)
  addProfileFallbackValue(businessProfile?.region)
  addProfileFallbackValue(businessProfile?.country)
  businessKeywordStrings.forEach(addProfileFallbackValue)

  const profileFallbackTags = Array.from(profileFallbackSet)

  const profileKeywordBlacklist = new Set<string>(locationKeywordSet)
  if (brandedHashtagKey) profileKeywordBlacklist.add(brandedHashtagKey)
  const businessNameKey = sanitizeForHashtagValue(businessProfile?.business_name)
  if (businessNameKey) profileKeywordBlacklist.add(businessNameKey)
  const businessCategoryKey = sanitizeForHashtagValue(businessProfile?.business_category)
  if (businessCategoryKey) profileKeywordBlacklist.add(businessCategoryKey)

  type KeywordToken = {
    display: string
    key: string
    isStop: boolean
    isDescriptor: boolean
    isProfile: boolean
    isBanned: boolean
    length: number
  }

  const keywordDisplayMap = new Map<string, string>()
  const collectKeywordDisplays = (value: string | null | undefined) => {
    if (!value || typeof value !== 'string') return
    const tokens = value.match(/\p{L}[\p{L}\p{N}]*/gu) || []
    tokens.forEach((token) => {
      const key = sanitizeForHashtagValue(token)
      if (!key) return
      if (!keywordDisplayMap.has(key)) {
        keywordDisplayMap.set(key, token)
      }
    })
  }

  collectKeywordDisplays(text)
  collectKeywordDisplays(headline)
  if (originalText) {
    collectKeywordDisplays(originalText)
  }

  const textTokens: KeywordToken[] = []
  const collectTokens = (value: string | null | undefined) => {
    if (!value || typeof value !== 'string') return
    const startingLength = textTokens.length
    const tokenRegex = /\p{L}[\p{L}\p{N}]*/gu
    let match: RegExpExecArray | null
    while ((match = tokenRegex.exec(value)) !== null) {
      const rawToken = match[0]
      const key = sanitizeForHashtagValue(rawToken)
      if (!key) continue
      textTokens.push({
        display: keywordDisplayMap.get(key) ?? rawToken,
        key,
        isStop: locale.stopWords.has(key),
        isDescriptor: WEAK_CONTEXT_KEYWORDS.has(key),
        isProfile: false,
        isBanned: BANNED_GENERIC_HASHTAG_KEYS.has(key),
        length: key.length
      })
    }

    if (textTokens.length > startingLength) {
      textTokens.push({
        display: '',
        key: '',
        isStop: true,
        isDescriptor: true,
        isProfile: false,
        isBanned: true,
        length: 0
      })
    }
  }

  collectTokens(text)
  collectTokens(headline)
  if (originalText) {
    collectTokens(originalText)
  }

  textTokens.forEach((token) => {
    if (profileKeywordBlacklist.has(token.key)) {
      token.isProfile = true
    }
  })

  const tokenStats = new Map<string, TokenStat>()

  textTokens.forEach((token) => {
    if (!token.key) {
      return
    }
    const current = tokenStats.get(token.key) ?? {
      total: 0,
      descriptorCount: 0,
      profileCount: 0,
      maxLength: token.length,
    }
    current.total += 1
    if (token.isDescriptor) {
      current.descriptorCount += 1
    }
    if (token.isProfile) {
      current.profileCount += 1
    }
    if (token.length > current.maxLength) {
      current.maxLength = token.length
    }
    tokenStats.set(token.key, current)
  })

  const descriptorKeywordKeys = new Set<string>(flavorModifierKeys)
  const strongKeywordKeys = new Set<string>()

  tokenStats.forEach((stats, key) => {
    if (stats.descriptorCount > 0) {
      descriptorKeywordKeys.add(key)
    }

    if (stats.total > stats.descriptorCount) {
      strongKeywordKeys.add(key)
    }

    if (stats.profileCount > 0) {
      descriptorKeywordKeys.add(key)
    }
  })

  interface KeywordCandidate {
    key: string
    hashtag: string
    score?: number
  }

  const keywordPhraseCandidates: KeywordCandidate[] = []
  const keywordCandidateKeys = new Set<string>()

  const coreKeywordCandidates: KeywordCandidate[] = []

  const pushKeywordCandidate = (key: string, hashtag: string) => {
    if (!key || keywordCandidateKeys.has(key)) return
    keywordCandidateKeys.add(key)
    keywordPhraseCandidates.push({ key, hashtag })
  }

  const maxPhraseLength = 2
  for (let length = Math.min(maxPhraseLength, textTokens.length); length >= 1; length--) {
    for (let index = 0; index <= textTokens.length - length; index++) {
      const slice = textTokens.slice(index, index + length)

      if (slice.some((token) => token.isBanned || token.isStop)) {
        continue
      }

      if (length === 1) {
        const [item] = slice
        if (item.isDescriptor) continue
        if (item.length < 4) continue
      } else {
        const hasStrongToken = slice.some((token) => !token.isDescriptor && token.length >= 4)
        if (!hasStrongToken) continue
      }

      const parts = slice.map((token) => token.display)
      const variant = createHashtagVariant(...parts)
      if (!variant) continue
      if (variant.key.length < 4) continue
      if (profileKeywordBlacklist.has(variant.key)) continue
      pushKeywordCandidate(variant.key, variant.hashtag)
    }
  }

  tokenStats.forEach((stats, key) => {
    if (!key) return
    if (stats.total === 0) return
    if (stats.total <= stats.descriptorCount) return
    if (stats.profileCount > 0) return
    if (flavorModifierKeys.has(key)) return
    if (profileKeywordBlacklist.has(key)) return
    if (key.length < 4) return

    const display = keywordDisplayMap.get(key) ?? key
    const variant = createHashtagVariant(display)
    if (!variant) return

    const score = stats.total * 10 + Math.min(stats.maxLength, 12)
    coreKeywordCandidates.push({ key: variant.key, hashtag: variant.hashtag, score })
  })

  coreKeywordCandidates
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .forEach((candidate) => {
      if (keywordCandidateKeys.has(candidate.key)) {
        return
      }
      keywordCandidateKeys.add(candidate.key)
      keywordPhraseCandidates.unshift(candidate)
    })

  const addKeywordPhraseHashtags = (
    state: ReturnType<typeof dedupeHashtagsByIntent>,
    limit: number,
    options?: { forbidWeak?: boolean }
  ) => {
    if (keywordPhraseCandidates.length === 0) return
    let added = 0
    for (const candidate of keywordPhraseCandidates) {
      if (added >= limit) break
      if (state.seenSanitized.has(candidate.key)) continue

      if (options?.forbidWeak && flavorModifierKeys.has(candidate.key)) {
        continue
      }

      if (!isTagAllowed(candidate.hashtag)) continue

      const lower = candidate.hashtag.toLowerCase()
      if (state.seenNormalized.has(lower)) continue

      const intentKey = getIntentGroupKey(candidate.hashtag)
      if (intentKey && state.seenIntent.has(intentKey)) continue

      state.hashtags.push(candidate.hashtag)
      state.seenNormalized.add(lower)
      state.seenSanitized.add(candidate.key)
      if (intentKey) {
        state.seenIntent.add(intentKey)
      }
      added += 1
    }
  }

  const ensureCounts = (targetBucket: 'shared' | 'instagram') => {
    const total = sharedBucket.length + instagramBucket.length
    if (total >= min) return

    const insert = targetBucket === 'shared' ? addShared : addInstagram
    let added = 0
    for (const candidate of profileFallbackTags) {
      if (sharedBucket.length + instagramBucket.length >= min) break

      if (targetBucket === 'instagram' && added >= 1) {
        break
      }

      if (insert(candidate)) {
        if (targetBucket === 'instagram') {
          added += 1
        }
      }
    }
  }

  if (hasInstagram) {
    if (min > 0) {
      ensureCounts('instagram')
    }

    const deduped = dedupeHashtagsByIntent([...sharedBucket, ...instagramBucket])

    addKeywordPhraseHashtags(deduped, 3)

    if (brandedHashtagNormalized) {
      const brandedLower = brandedHashtagNormalized.toLowerCase()
      if (!deduped.seenNormalized.has(brandedLower)) {
        deduped.hashtags.unshift(brandedHashtagNormalized)
        deduped.seenNormalized.add(brandedLower)
        const brandedIntent = getIntentGroupKey(brandedHashtagNormalized)
        if (brandedIntent) {
          deduped.seenIntent.add(brandedIntent)
        }
      }
    }

    const sources: Iterable<string>[] = []
    if (normalizedFromAI.length > 0) sources.push(normalizedFromAI)
    if (profileFallbackTags.length > 0) sources.push(profileFallbackTags)

    if (deduped.hashtags.length === 0 && sources.length > 0) {
      tryFillHashtagsToMin(deduped, 1, sources, { isAllowedTag: isTagAllowed })
    }

    if (hasFacebook && deduped.hashtags.length > 1) {
      const ranked = rankHashtagsForFacebook(deduped.hashtags, {
        tokenStats,
        descriptorKeywordKeys,
        strongKeywordKeys,
        locationKeys: locationKeywordSet,
        brandedKey: brandedHashtagKey,
        priorityKeys: priorityKeySet,
        keywordCandidateKeys,
        toneCardHashtags,
        flavorModifierKeys,
        aiCandidateKeys,
      })
      deduped.hashtags.splice(0, deduped.hashtags.length, ...ranked)
    }

    if (deduped.hashtags.length > max && max > 0) {
      deduped.hashtags.splice(max)
    }

    return deduped.hashtags
  }

  if (min > 0) {
    ensureCounts('shared')
  }
  const dedupedShared = dedupeHashtagsByIntent(sharedBucket)

  addKeywordPhraseHashtags(dedupedShared, 2, { forbidWeak: hasFacebook })

  if (hasFacebook && dedupedShared.hashtags.length > 1) {
    const ranked = rankHashtagsForFacebook(dedupedShared.hashtags, {
      tokenStats,
      descriptorKeywordKeys,
      strongKeywordKeys,
      locationKeys: locationKeywordSet,
      brandedKey: brandedHashtagKey,
      priorityKeys: priorityKeySet,
      keywordCandidateKeys,
      toneCardHashtags,
      flavorModifierKeys,
      aiCandidateKeys,
    })
    dedupedShared.hashtags.splice(0, dedupedShared.hashtags.length, ...ranked)
  }

  if (dedupedShared.hashtags.length < min) {
    const sources: Iterable<string>[] = []
    if (normalizedFromAI.length > 0) sources.push(normalizedFromAI)
    if (profileFallbackTags.length > 0) sources.push(profileFallbackTags)

    if (sources.length > 0) {
      tryFillHashtagsToMin(dedupedShared, min, sources, { isAllowedTag: isTagAllowed })
    }
  }

  if (dedupedShared.hashtags.length > max) {
    dedupedShared.hashtags.splice(max)
  }

  if (dedupedShared.hashtags.length < min) {
    console.warn('Unable to reach minimum Facebook hashtag count', {
      current: dedupedShared.hashtags.length,
      min
    })
  }

  return dedupedShared.hashtags
}
