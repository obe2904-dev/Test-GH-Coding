import type { PlatformHashtag } from '../stores/postCreationStore'

export type CanonicalPlatform = 'facebook' | 'instagram'

export const FACEBOOK_HASHTAG_LIMIT = 3

export const normalizeHashtagKey = (tag: string): string => tag.replace(/^#+/, '').replace(/\s+/g, '').toLowerCase()

export const sanitizeTagValue = (tag: string): string => tag.replace(/^#+/, '').trim()

export const normalizePlatformId = (platform: string): CanonicalPlatform | null => {
  const value = (platform || '').toLowerCase()
  if (value.startsWith('facebook')) {
    return 'facebook'
  }
  if (value.startsWith('instagram')) {
    return 'instagram'
  }
  return null
}

export const canonicalizePlatformList = (platforms?: string[] | null): CanonicalPlatform[] => {
  if (!platforms || platforms.length === 0) {
    return []
  }

  const normalized: CanonicalPlatform[] = []
  platforms.forEach((platform) => {
    const canonical = normalizePlatformId(platform)
    if (canonical && !normalized.includes(canonical)) {
      normalized.push(canonical)
    }
  })

  return normalized
}

interface PlatformHashtagViewsParams {
  hashtagsInOrder: string[]
  canonicalSelectedPlatforms: CanonicalPlatform[]
  allHashtags: PlatformHashtag[]
}

export const computePlatformHashtagViews = ({
  hashtagsInOrder,
  canonicalSelectedPlatforms,
  allHashtags
}: PlatformHashtagViewsParams): Record<string, PlatformHashtag[]> => {
  const map: Record<string, PlatformHashtag[]> = {}

  if (allHashtags.length === 0) {
    return map
  }

  const hashtagByKey = new Map<string, PlatformHashtag>()
  allHashtags.forEach((item) => {
    const key = normalizeHashtagKey(item.tag)
    if (key && !hashtagByKey.has(key)) {
      hashtagByKey.set(key, item)
    }
  })

  const uniqueOrder: string[] = []
  const seenKeys = new Set<string>()
  hashtagsInOrder.forEach((rawTag) => {
    const clean = sanitizeTagValue(rawTag)
    const key = normalizeHashtagKey(clean)
    if (!key || seenKeys.has(key)) {
      return
    }
    const hashtagEntry = hashtagByKey.get(key)
    if (!hashtagEntry || !hashtagEntry.enabled) {
      return
    }
    seenKeys.add(key)
    uniqueOrder.push(key)
  })

  if (uniqueOrder.length === 0) {
    return map
  }

  const pushToPlatform = (platform: CanonicalPlatform, key: string) => {
    const item = hashtagByKey.get(key)
    if (!item) {
      return
    }
    if (!map[platform]) {
      map[platform] = []
    }
    map[platform].push(item)
  }

  const hasFacebook = canonicalSelectedPlatforms.includes('facebook')
  const hasInstagram = canonicalSelectedPlatforms.includes('instagram')
  const facebookLimit = Math.min(FACEBOOK_HASHTAG_LIMIT, uniqueOrder.length)

  if (hasFacebook) {
    uniqueOrder.forEach((key, index) => {
      if (index < facebookLimit) {
        pushToPlatform('facebook', key)
      }
    })
  }

  if (hasInstagram) {
    uniqueOrder.forEach((key) => pushToPlatform('instagram', key))
  }

  canonicalSelectedPlatforms
    .filter((platform) => platform !== 'facebook' && platform !== 'instagram')
    .forEach((platform) => {
      uniqueOrder.forEach((key) => pushToPlatform(platform, key))
    })

  return map
}
