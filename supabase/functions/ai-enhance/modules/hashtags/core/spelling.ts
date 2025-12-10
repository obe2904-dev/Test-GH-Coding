import { sanitizeForHashtagValue } from '../../../tone-cards.ts'
import {
  createHashtagVariant,
  levenshteinDistance,
  normalizeHashtag,
} from '../utils.ts'

type SpellingSourceContent = {
  text: string
  headline?: string | null
}

export interface SpellingContext {
  keywordDisplayMap: Map<string, string>
  correctHashtagSpelling: (tag: string) => string
  applySpellingCorrections: (tags: string[]) => string[]
}

export interface CreateSpellingContextOptions {
  canonicalDisplayLookup: Map<string, string>
  originalText?: string
  enhancedContent: SpellingSourceContent
}

export function createSpellingContext(options: CreateSpellingContextOptions): SpellingContext {
  const { canonicalDisplayLookup, originalText, enhancedContent } = options

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

  const registerCanonicalDisplay = (key: string, display: string) => {
    if (!key) return
    if (!canonicalDisplayLookup.has(key)) {
      canonicalDisplayLookup.set(key, display)
    }
  }

  if (originalText) {
    const originalTokens = originalText.match(/\p{L}[\p{L}\p{N}]*/gu) || []
    originalTokens.forEach((token: string) => {
      const key = sanitizeForHashtagValue(token)
      if (!key) return

      if (!keywordDisplayMap.has(key)) {
        keywordDisplayMap.set(key, token)
      }

      registerCanonicalDisplay(key, token)
    })
  }

  collectKeywordDisplays(enhancedContent.text)
  collectKeywordDisplays(enhancedContent.headline)

  const correctHashtagSpelling = (tag: string): string => {
    const normalized = normalizeHashtag(tag)
    if (!normalized) {
      return tag
    }

    const sanitized = sanitizeForHashtagValue(normalized)
    if (!sanitized) {
      return normalized
    }

    const canonicalDisplay = canonicalDisplayLookup.get(sanitized)
    if (canonicalDisplay) {
      const variant = createHashtagVariant(canonicalDisplay)
      if (variant) {
        return variant.hashtag
      }
    }

    let bestKey: string | null = null
    let bestDistance = Number.POSITIVE_INFINITY

    canonicalDisplayLookup.forEach((_, candidateKey) => {
      const distance = levenshteinDistance(sanitized, candidateKey)
      if (distance < bestDistance) {
        bestDistance = distance
        bestKey = candidateKey
        if (distance === 0) {
          return
        }
      }
    })

    if (bestKey !== null) {
      const allowedDistance = sanitized.length <= 6 ? 1 : 1
      if (bestDistance <= allowedDistance) {
        const display = canonicalDisplayLookup.get(bestKey)
        if (display) {
          const variant = createHashtagVariant(display)
          if (variant) {
            return variant.hashtag
          }
        }
      }
    }

    return normalized
  }

  const applySpellingCorrections = (tags: string[]): string[] => {
    const result: string[] = []
    const seen = new Set<string>()

    tags.forEach((tag) => {
      const corrected = correctHashtagSpelling(tag)
      const normalized = normalizeHashtag(corrected)
      if (!normalized) {
        return
      }
      const lower = normalized.toLowerCase()
      if (seen.has(lower)) {
        return
      }
      seen.add(lower)
      result.push(normalized)
    })

    return result
  }

  return {
    keywordDisplayMap,
    correctHashtagSpelling,
    applySpellingCorrections,
  }
}
