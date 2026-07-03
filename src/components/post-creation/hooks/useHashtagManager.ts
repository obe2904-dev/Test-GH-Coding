import { useCallback, useMemo, useState } from 'react'
import {
  type CanonicalPlatform,
  canonicalizePlatformList,
  computePlatformHashtagViews,
  normalizeHashtagKey,
  normalizePlatformId,
  sanitizeTagValue,
  FACEBOOK_HASHTAG_LIMIT
} from '../../../lib/hashtags'
import type { PlatformHashtag } from '../../../stores/postCreationStore'

interface UseHashtagManagerOptions {
  initialHashtags: string[]
  initialSelectedHashtags: string[]
  initialAiGeneratedHashtags: string[]
  initialHashtagPlatforms: Record<string, string[]>
  canonicalSelectedPlatforms: CanonicalPlatform[]
}

export function useHashtagManager({
  initialHashtags,
  initialSelectedHashtags,
  initialAiGeneratedHashtags,
  initialHashtagPlatforms,
  canonicalSelectedPlatforms
}: UseHashtagManagerOptions) {
  const [hashtags, setHashtags] = useState<string[]>(() => initialHashtags)
  const [selectedHashtags, setSelectedHashtags] = useState<Set<string>>(
    () => new Set(initialSelectedHashtags)
  )
  const [aiGeneratedHashtags, setAiGeneratedHashtags] = useState<Set<string>>(
    () => new Set(initialAiGeneratedHashtags)
  )
  const [hashtagPlatforms, setHashtagPlatforms] = useState<Record<string, string[]>>(
    () => initialHashtagPlatforms
  )

  const selectedPlatformSet = useMemo(() => new Set(canonicalSelectedPlatforms), [canonicalSelectedPlatforms])
  const hashtagsCount = hashtags.length

  const hashtagIndexMap = useMemo(() => {
    const map = new Map<string, number>()
    hashtags.forEach((tag, index) => {
      const key = normalizeHashtagKey(tag)
      if (key) {
        map.set(key, index)
      }
    })
    return map
  }, [hashtags])

  const sharedHashtagThreshold = useMemo(() => {
    const hasFacebook = canonicalSelectedPlatforms.includes('facebook')
    const hasInstagram = canonicalSelectedPlatforms.includes('instagram')
    if (hasFacebook && hasInstagram) {
      return Math.min(FACEBOOK_HASHTAG_LIMIT, hashtagsCount)
    }
    return hashtagsCount
  }, [canonicalSelectedPlatforms, hashtagsCount])

  const resolvePlatformsForTag = useCallback(
    (tag: string): CanonicalPlatform[] => {
      const key = normalizeHashtagKey(tag)
      if (!key) {
        return canonicalSelectedPlatforms
      }

      const assigned = hashtagPlatforms[key]
      if (assigned && assigned.length > 0) {
        const normalizedAssigned = canonicalizePlatformList(assigned).filter((platform) =>
          selectedPlatformSet.has(platform)
        )
        if (normalizedAssigned.length > 0) {
          return normalizedAssigned
        }
      }

      if (selectedPlatformSet.has('facebook') && selectedPlatformSet.has('instagram')) {
        const index = hashtagIndexMap.get(key)
        if (typeof index === 'number') {
          return index < sharedHashtagThreshold ? ['facebook', 'instagram'] : ['instagram']
        }
      }

      return canonicalSelectedPlatforms
    },
    [
      hashtagPlatforms,
      selectedPlatformSet,
      hashtagIndexMap,
      sharedHashtagThreshold,
      canonicalSelectedPlatforms
    ]
  )

  const appendSelectedHashtags = useCallback(
    (
      baseText: string,
      tagSet: Set<string> = selectedHashtags,
      include = true,
      platform?: string
    ) => {
      if (!include || tagSet.size === 0) {
        return baseText
      }

      const normalizedPlatform = platform ? normalizePlatformId(platform) : undefined

      const normalized = Array.from(tagSet)
        .map((tag) => sanitizeTagValue(tag))
        .filter((tag) => {
          if (!tag) {
            return false
          }
          if (!normalizedPlatform) {
            return true
          }
          const platforms = resolvePlatformsForTag(tag)
          return platforms.includes(normalizedPlatform)
        })
        .map((tag) => `#${tag}`)

      const normalizedForPlatform = normalizedPlatform === 'facebook'
        ? normalized.slice(0, Math.min(FACEBOOK_HASHTAG_LIMIT, normalized.length))
        : normalized

      if (normalizedForPlatform.length === 0) {
        return baseText.trim()
      }

      const trimmed = baseText.trim()
      const hashtagsLine = normalizedForPlatform.join(' ')
      return trimmed.length > 0 ? `${trimmed}\n\n${hashtagsLine}` : hashtagsLine
    },
    [resolvePlatformsForTag, selectedHashtags]
  )

  const buildPlatformHashtags = useCallback((): PlatformHashtag[] => {
    const result: PlatformHashtag[] = []
    const seen = new Set<string>()

    hashtags.forEach((rawTag) => {
      const clean = sanitizeTagValue(rawTag)
      if (!clean) {
        return
      }

      const key = normalizeHashtagKey(clean)
      if (seen.has(key)) {
        return
      }
      seen.add(key)

      const platforms = resolvePlatformsForTag(clean)
      result.push({
        tag: `#${clean}`,
        enabled: selectedHashtags.has(clean),
        platforms
      })
    })

    return result
  }, [hashtags, resolvePlatformsForTag, selectedHashtags])

  const buildPlatformHashtagViews = useCallback((): Record<string, PlatformHashtag[]> => {
    const allHashtags = buildPlatformHashtags()
    return computePlatformHashtagViews({
      hashtagsInOrder: hashtags,
      canonicalSelectedPlatforms,
      allHashtags
    })
  }, [buildPlatformHashtags, canonicalSelectedPlatforms, hashtags])

  return {
    hashtags,
    setHashtags,
    selectedHashtags,
    setSelectedHashtags,
    aiGeneratedHashtags,
    setAiGeneratedHashtags,
    hashtagPlatforms,
    setHashtagPlatforms,
    appendSelectedHashtags,
    buildPlatformHashtags,
    buildPlatformHashtagViews
  }
}
