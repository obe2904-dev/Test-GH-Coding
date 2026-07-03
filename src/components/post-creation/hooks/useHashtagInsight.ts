import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { CanonicalPlatform } from '../../../lib/hashtags'

interface UseHashtagInsightOptions {
  includeHashtags: boolean
  hashtags: string[]
  selectedPlatforms: CanonicalPlatform[]
}

export function useHashtagInsight({ includeHashtags, hashtags, selectedPlatforms }: UseHashtagInsightOptions) {
  const { t } = useTranslation(undefined, { keyPrefix: 'createPost' })

  return useMemo(() => {
    if (!includeHashtags || hashtags.length === 0) {
      return null
    }

    const hasFacebook = selectedPlatforms.includes('facebook')
    const hasInstagram = selectedPlatforms.includes('instagram')

    if (!hasFacebook && !hasInstagram) {
      return null
    }

    if (hasFacebook && hasInstagram) {
      const sharedCount = Math.min(3, hashtags.length)
      const instagramExtras = Math.max(0, hashtags.length - sharedCount)

      if (instagramExtras > 0) {
        return t(
          'generate.hashtagInsightSharedExtras',
          'Hashtags are split into {{sharedCount}} shared tags and {{instagramExtras}} extra for Instagram so you reach both platforms.',
          { sharedCount, instagramExtras }
        )
      }

      return t(
        'generate.hashtagInsightSharedOnly',
        'Hashtags work on both Facebook and Instagram without extra platform-specific tags.'
      )
    }

    if (hasInstagram) {
      return t(
        'generate.hashtagInsightInstagramOnly',
        'AI suggested {{count}} Instagram hashtags using your main keywords.',
        { count: hashtags.length }
      )
    }

    return t(
      'generate.hashtagInsightFacebookOnly',
      'Hashtags focus on your key Facebook keywords.'
    )
  }, [includeHashtags, hashtags, selectedPlatforms, t])
}
