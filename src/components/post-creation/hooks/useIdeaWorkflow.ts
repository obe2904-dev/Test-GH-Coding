import { useCallback } from 'react'
import type { TFunction } from 'i18next'
import { normalizePlatformId } from '../../../lib/hashtags'
import type {
  GeneratedIdea,
  PlatformContent,
  PlatformHashtag,
  PostContent
} from '../../../stores/postCreationStore'

interface PlatformTexts {
  [platform: string]: { headline: string; text: string }
}

interface UseIdeaWorkflowOptions {
  aiIdeas: GeneratedIdea[]
  selectedIdea: string | null
  setSelectedIdea: (id: string | null) => void
  selectedPlatforms: string[]
  canonicalSelectedPlatforms: string[]
  platformTexts: PlatformTexts
  setPlatformTexts: (updater: (prev: PlatformTexts) => PlatformTexts) => void
  includeHashtags: boolean
  includeEmojis: boolean
  appendSelectedHashtags: (baseText: string, tagSet?: Set<string>, include?: boolean, platform?: string) => string
  buildPlatformHashtags: () => PlatformHashtag[]
  buildPlatformHashtagViews: () => Record<string, PlatformHashtag[]>
  setPostContent: (content: PostContent) => void
  aiGeneratedHashtags: Set<string>
  extractHashtags: (text: string) => string[]
  removeHashtags: (text: string) => string
  setHeadline: (value: string) => void
  setText: (value: string) => void
  setHashtags: (tags: string[]) => void
  setSelectedHashtags: (tags: Set<string>) => void
  setAiGeneratedHashtags: (tags: Set<string>) => void
  setHashtagPlatforms: (platformMap: Record<string, string[]>) => void
  setIncludeHashtags: (value: boolean) => void
  setIncludeEmojis: (value: boolean) => void
  setIsEdited: (value: boolean) => void
  setIsSpellingChecked: (value: boolean) => void
  setHasHeadlineFromAI: (value: boolean) => void
  getCurrentText: () => { headline: string; text: string }
  customizePerPlatform: boolean
  markAsChanged?: () => void
  clearClarificationPrompt: () => void
  activeTab: 'manual' | 'ai'
  t: TFunction
  onNext: () => void
  generateHashtagsOnly?: (text: string, headline?: string) => Promise<void>
}

export function useIdeaWorkflow({
  aiIdeas,
  selectedIdea,
  setSelectedIdea,
  selectedPlatforms,
  canonicalSelectedPlatforms,
  platformTexts,
  setPlatformTexts,
  includeHashtags,
  includeEmojis,
  appendSelectedHashtags,
  buildPlatformHashtags,
  buildPlatformHashtagViews,
  setPostContent,
  aiGeneratedHashtags,
  extractHashtags,
  removeHashtags,
  setHeadline,
  setText,
  setHashtags,
  setSelectedHashtags,
  setAiGeneratedHashtags,
  setHashtagPlatforms,
  setIncludeHashtags,
  setIncludeEmojis,
  setIsEdited,
  setIsSpellingChecked,
  setHasHeadlineFromAI,
  getCurrentText,
  customizePerPlatform,
  markAsChanged,
  clearClarificationPrompt,
  activeTab,
  t,
  onNext,
  generateHashtagsOnly
}: UseIdeaWorkflowOptions) {
  const processNext = useCallback(
    (currentIdea?: GeneratedIdea | null) => {
      const platformHashtags = buildPlatformHashtags()
      const platformHashtagViews = buildPlatformHashtagViews()
      const primaryPlatform = canonicalSelectedPlatforms[0] ?? 'facebook'

      if (customizePerPlatform && selectedPlatforms.length > 1) {
        const platformContent: Record<string, PlatformContent> = {}

        selectedPlatforms.forEach((platform) => {
          const canonicalPlatform = normalizePlatformId(platform)
          if (!canonicalPlatform) {
            return
          }
          const content = platformTexts[platform] || { headline: '', text: '' }
          const baseText = content.text || currentIdea?.text || ''
          const platformSpecificHashtags = platformHashtags.filter((item) => {
            if (!item.platforms || item.platforms.length === 0) {
              return true
            }
            return item.platforms.includes(canonicalPlatform)
          })
          platformContent[platform] = {
            headline: content.headline || currentIdea?.headline || '',
            text: baseText,
            textWithHashtags: appendSelectedHashtags(baseText, undefined, includeHashtags, canonicalPlatform),
            adjustments: {
              length: 'current',
              tone: 'brand',
              includeHashtags,
              includeEmojis,
              includeBookingLink: false
            },
            hashtags: platformSpecificHashtags
          }
        })

        const current = getCurrentText()
        const baseText = current.text || currentIdea?.text || ''

        setPostContent({
          headline: current.headline || currentIdea?.headline || '',
          text: baseText,
          textWithHashtags: appendSelectedHashtags(baseText, undefined, includeHashtags, primaryPlatform),
          platformSpecific: true,
          platformContent,
          platformHashtagViews,
          adjustments: {
            length: 'current',
            tone: 'brand',
            includeHashtags,
            includeEmojis,
            includeBookingLink: false
          },
          hashtags: platformHashtags,
          aiGeneratedHashtags: Array.from(aiGeneratedHashtags)
        })
        return
      }

      const current = getCurrentText()
      const baseText = current.text || currentIdea?.text || ''

      setPostContent({
        headline: current.headline || currentIdea?.headline || '',
        text: baseText,
        textWithHashtags: appendSelectedHashtags(baseText, undefined, includeHashtags, primaryPlatform),
        platformSpecific: false,
        platformHashtagViews,
        adjustments: {
          length: 'current',
          tone: 'brand',
          includeHashtags,
          includeEmojis,
          includeBookingLink: false
        },
        hashtags: platformHashtags,
        aiGeneratedHashtags: Array.from(aiGeneratedHashtags)
      })
    },
    [
      buildPlatformHashtags,
      buildPlatformHashtagViews,
      canonicalSelectedPlatforms,
      customizePerPlatform,
      selectedPlatforms,
      platformTexts,
      appendSelectedHashtags,
      includeHashtags,
      includeEmojis,
      getCurrentText,
      setPostContent,
      aiGeneratedHashtags
    ]
  )

  const selectIdea = useCallback(
    (idea: GeneratedIdea) => {
      setSelectedIdea(idea.id)

      // Handle case where text might be undefined
      const ideaText = idea.text || ''
      
      // For AI Ideas mode (no hashtags in idea): leave hashtags empty for enhance step
      // For legacy/custom mode (hashtags in text): extract them
      let uniqueHashtags: string[] = []
      let cleanText: string
      
      if (idea.hashtags && idea.hashtags.trim()) {
        // New format: hashtags are in separate field (custom ideas)
        const hashtagMatches = idea.hashtags.match(/#\w+/g) || []
        uniqueHashtags = Array.from(new Set(hashtagMatches.map(tag => tag.replace('#', ''))))
        cleanText = removeHashtags(ideaText).trim()
      } else {
        // Check if there are hashtags embedded in text (legacy format)
        const extracted = extractHashtags(ideaText)
        if (extracted.length > 0) {
          uniqueHashtags = Array.from(new Set(extracted))
        }
        // For AI Ideas mode without hashtags, uniqueHashtags stays empty
        cleanText = removeHashtags(ideaText).trim()
      }

      setHeadline(idea.headline || '')
      setText(cleanText)
      setHashtags(uniqueHashtags)
      setSelectedHashtags(new Set(uniqueHashtags))
      setAiGeneratedHashtags(new Set(uniqueHashtags))
      setHashtagPlatforms({})
      // Always enable hashtags - they'll be generated during enhance step if empty
      setIncludeHashtags(true)
      setIncludeEmojis(true)
      setIsEdited(false)
      setIsSpellingChecked(true)
      setHasHeadlineFromAI(true)

      setPlatformTexts((prev) => {
        const next: PlatformTexts = { ...prev }
        selectedPlatforms.forEach((platform) => {
          next[platform] = {
            headline: idea.headline,
            text: cleanText
          }
        })
        return next
      })

      markAsChanged?.()

      // Auto-generate hashtags if idea has no hashtags (AI Ideas mode)
      // This happens asynchronously in the background
      if (uniqueHashtags.length === 0 && cleanText && generateHashtagsOnly) {
        console.log('[selectIdea] Auto-generating hashtags for selected idea')
        // Small delay to ensure state is updated first
        setTimeout(() => {
          generateHashtagsOnly(cleanText, idea.headline || '')
        }, 100)
      }
    },
    [
      setSelectedIdea,
      extractHashtags,
      removeHashtags,
      setHeadline,
      setText,
      setHashtags,
      setSelectedHashtags,
      setAiGeneratedHashtags,
      setHashtagPlatforms,
      setIncludeHashtags,
      setIncludeEmojis,
      setIsEdited,
      setIsSpellingChecked,
      setHasHeadlineFromAI,
      setPlatformTexts,
      selectedPlatforms,
      markAsChanged,
      generateHashtagsOnly
    ]
  )

  const handleNext = useCallback(() => {
    clearClarificationPrompt()

    if (activeTab === 'manual') {
      const current = getCurrentText()
      const manualIdea = {
        id: `manual-${Date.now()}`,
        title: current.headline || t('generate.manualContent', 'Manual content'),
        headline: current.headline,
        text: current.text,
        description:
          current.headline || current.text
            ? t('generate.manuallyEditedContent', 'Manually edited content')
            : t('generate.photoOnlyPost', 'Photo-only post'),
        originalContent: current
      } as GeneratedIdea
      processNext(manualIdea)
      onNext()
      return
    }

    if (!selectedIdea) {
      const current = getCurrentText()
      const manualIdea = {
        id: 'manual-content',
        title: current.headline || t('generate.manualContent', 'Manual content'),
        headline: current.headline,
        text: current.text,
        description: t('generate.manualContent', 'Manual content')
      } as GeneratedIdea
      processNext(manualIdea)
      onNext()
      return
    }

    const currentIdea = aiIdeas.find((idea) => idea?.id === selectedIdea)
    processNext(currentIdea)
    onNext()
  }, [
    clearClarificationPrompt,
    activeTab,
    getCurrentText,
    t,
    processNext,
    onNext,
    selectedIdea,
    aiIdeas
  ])

  return {
    selectIdea,
    handleNext
  }
}
