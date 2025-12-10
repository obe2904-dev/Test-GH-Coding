import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  normalizePlatformId,
  type CanonicalPlatform
} from '../../../lib/hashtags'
import type {
  PhotoContent,
  PlatformContent,
  PlatformHashtag,
  PostContent
} from '../../../stores/postCreationStore'

interface DraftPersistenceOptions {
  getCurrentText: () => { headline: string; text: string }
  hashtags: string[]
  buildPlatformHashtags: () => PlatformHashtag[]
  buildPlatformHashtagViews: () => Record<string, PlatformHashtag[]>
  customizePerPlatform: boolean
  canonicalSelectedPlatforms: CanonicalPlatform[]
  selectedPlatforms: string[]
  platformTexts: Record<string, { headline: string; text: string }>
  appendSelectedHashtags: (baseText: string, tagSet?: Set<string>, include?: boolean, platform?: string) => string
  includeHashtags: boolean
  includeEmojis: boolean
  aiGeneratedHashtags: Set<string>
  photoContent: PhotoContent | null
  photoIdea: string
  postContent: PostContent | null
  setPostContent: (content: PostContent) => void
  headline: string
  text: string
  activePlatform: string
  onResetEditedState?: () => void
  markAsSaved?: () => void
}

export function useDraftPersistence({
  getCurrentText,
  hashtags,
  buildPlatformHashtags,
  buildPlatformHashtagViews,
  customizePerPlatform,
  canonicalSelectedPlatforms,
  selectedPlatforms,
  platformTexts,
  appendSelectedHashtags,
  includeHashtags,
  includeEmojis,
  aiGeneratedHashtags,
  photoContent,
  photoIdea,
  postContent,
  setPostContent,
  headline,
  text,
  activePlatform,
  onResetEditedState,
  markAsSaved
}: DraftPersistenceOptions) {
  const latestDraftRef = useRef<PostContent | null>(postContent ?? null)
  const lastSyncedContentRef = useRef<string | null>(postContent ? JSON.stringify(postContent) : null)

  const buildPersistedContent = useCallback(
    (forcePlatformSpecific = false): PostContent | null => {
      const current = getCurrentText()
      const hasMediaAttachments = Boolean(photoContent?.uploadedMedia && photoContent.uploadedMedia.length > 0)
      const hasPhotoIdea = Boolean(photoIdea && photoIdea.trim().length > 0)

      if (!current.headline && !current.text && hashtags.length === 0 && !hasMediaAttachments && !hasPhotoIdea) {
        return null
      }

      const platformHashtags = buildPlatformHashtags()
      const platformHashtagViews = buildPlatformHashtagViews()
      const primaryPlatform = canonicalSelectedPlatforms[0] ?? 'facebook'

      if ((customizePerPlatform && selectedPlatforms.length > 1) || forcePlatformSpecific) {
        const platformContent: Record<string, PlatformContent> = {}

        selectedPlatforms.forEach((platform) => {
          const canonicalPlatform = normalizePlatformId(platform)
          if (!canonicalPlatform) {
            return
          }
          const content = platformTexts[platform] || { headline: '', text: '' }
          const baseText = content.text || current.text
          const platformSpecificHashtags = platformHashtags.filter((item) => {
            if (!item.platforms || item.platforms.length === 0) {
              return true
            }
            return item.platforms.includes(canonicalPlatform)
          })
          platformContent[platform] = {
            headline: content.headline,
            text: baseText,
            textWithHashtags: appendSelectedHashtags(baseText, undefined, includeHashtags, canonicalPlatform),
            adjustments: {
              length: 'current',
              tone: 'professional',
              includeHashtags,
              includeEmojis,
              includeBookingLink: false
            },
            hashtags: platformSpecificHashtags
          }
        })

        return {
          headline: current.headline,
          text: current.text,
          textWithHashtags: appendSelectedHashtags(current.text, undefined, includeHashtags, primaryPlatform),
          adjustments: {
            length: 'current',
            tone: 'professional',
            includeHashtags,
            includeEmojis,
            includeBookingLink: false
          },
          platformSpecific: true,
          platformContent,
          hashtags: platformHashtags,
          platformHashtagViews,
          aiGeneratedHashtags: Array.from(aiGeneratedHashtags)
        }
      }

      return {
        headline: current.headline,
        text: current.text,
        textWithHashtags: appendSelectedHashtags(current.text, undefined, includeHashtags, primaryPlatform),
        adjustments: {
          length: 'current',
          tone: 'professional',
          includeHashtags,
          includeEmojis,
          includeBookingLink: false
        },
        platformSpecific: false,
        hashtags: platformHashtags,
        platformHashtagViews,
        aiGeneratedHashtags: Array.from(aiGeneratedHashtags)
      }
    },
    [
      getCurrentText,
      hashtags,
      buildPlatformHashtags,
      buildPlatformHashtagViews,
      customizePerPlatform,
      canonicalSelectedPlatforms,
      selectedPlatforms,
      platformTexts,
      appendSelectedHashtags,
      includeHashtags,
      includeEmojis,
      aiGeneratedHashtags,
      photoContent,
      photoIdea
    ]
  )

  const handleSaveDraft = useCallback(() => {
    const snapshot = buildPersistedContent() || latestDraftRef.current || postContent

    if (!snapshot) {
      return false
    }

    const draft = {
      timestamp: Date.now(),
      selectedPlatforms,
      postContent: snapshot,
      photoContent,
      photoIdea
    }

    latestDraftRef.current = snapshot

    try {
      localStorage.setItem('post2grow_draft_recovery', JSON.stringify(draft))
      onResetEditedState?.()
      markAsSaved?.()
      return true
    } catch (error) {
      console.error('Failed to persist draft:', error)
      return false
    }
  }, [
    buildPersistedContent,
    postContent,
    selectedPlatforms,
    photoContent,
    photoIdea,
    onResetEditedState,
    markAsSaved
  ])

  useEffect(() => {
    const snapshot = buildPersistedContent()

    const platformHashtags = buildPlatformHashtags()
    const platformHashtagViews = buildPlatformHashtagViews()
    const primaryPlatform = canonicalSelectedPlatforms[0] ?? 'facebook'

    const baseHeadline = customizePerPlatform
      ? platformTexts[activePlatform]?.headline ?? headline
      : headline
    const baseText = customizePerPlatform
      ? platformTexts[activePlatform]?.text ?? text
      : text

    const fallbackContent: PostContent = {
      headline: baseHeadline,
      text: baseText,
      textWithHashtags: appendSelectedHashtags(baseText, undefined, includeHashtags, primaryPlatform),
      adjustments: {
        length: 'current',
        tone: 'professional',
        includeHashtags,
        includeEmojis,
        includeBookingLink: false
      },
      platformSpecific: customizePerPlatform,
      platformContent: customizePerPlatform
        ? selectedPlatforms.reduce<Record<string, PlatformContent>>((acc, platform) => {
            const canonicalPlatform = normalizePlatformId(platform)
            if (!canonicalPlatform) {
              return acc
            }
            const platformText = platformTexts[platform] || { headline, text }
            const platformSpecificHashtags = platformHashtags.filter((item) => {
              if (!item.platforms || item.platforms.length === 0) {
                return true
              }
              return item.platforms.includes(canonicalPlatform)
            })
            acc[platform] = {
              headline: platformText.headline,
              text: platformText.text,
              textWithHashtags: appendSelectedHashtags(platformText.text, undefined, includeHashtags, canonicalPlatform),
              adjustments: {
                length: 'current',
                tone: 'professional',
                includeHashtags,
                includeEmojis,
                includeBookingLink: false
              },
              hashtags: platformSpecificHashtags
            }
            return acc
          }, {})
        : undefined,
      hashtags: platformHashtags,
      platformHashtagViews,
      aiGeneratedHashtags: Array.from(aiGeneratedHashtags)
    }

    const normalizedContent = snapshot ?? fallbackContent

    const serialized = JSON.stringify(normalizedContent)
    if (lastSyncedContentRef.current !== serialized) {
      setPostContent(normalizedContent)
      latestDraftRef.current = normalizedContent
      lastSyncedContentRef.current = serialized
    }
  }, [
    buildPersistedContent,
    appendSelectedHashtags,
    setPostContent,
    hashtags,
    includeHashtags,
    includeEmojis,
    customizePerPlatform,
    selectedPlatforms,
    canonicalSelectedPlatforms,
    platformTexts,
    buildPlatformHashtags,
    buildPlatformHashtagViews,
    aiGeneratedHashtags,
    headline,
    text,
    activePlatform
  ])

  const hasPersistedDraft = useMemo(() => {
    if (postContent) {
      const trimmedHeadline = (postContent.headline ?? '').trim()
      const trimmedText = (postContent.text ?? '').trim()

      if (trimmedHeadline.length > 0 || trimmedText.length > 0) {
        return true
      }

      if (postContent.platformSpecific && postContent.platformContent) {
        const hasPlatformContent = Object.values(postContent.platformContent).some((content) => {
          const platformHeadline = (content.headline ?? '').trim()
          const platformText = (content.text ?? '').trim()
          return platformHeadline.length > 0 || platformText.length > 0
        })

        if (hasPlatformContent) {
          return true
        }
      }

      if (postContent.hashtags && postContent.hashtags.length > 0) {
        return true
      }
    }

    if (photoContent?.uploadedMedia && photoContent.uploadedMedia.length > 0) {
      return true
    }

    if (photoIdea && photoIdea.trim().length > 0) {
      return true
    }

    return false
  }, [postContent, photoContent, photoIdea])

  return {
    handleSaveDraft,
    hasPersistedDraft
  }
}
