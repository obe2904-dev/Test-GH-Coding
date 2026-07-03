import { useState, useCallback, type Dispatch, type SetStateAction } from 'react'

type PlatformTextMap = Record<string, { headline: string; text: string }>

interface UseGenerateStateOptions {
  initialHeadline: string
  initialText: string
  initialIncludeEmojis: boolean
  initialIncludeHashtags: boolean
  canonicalSelectedPlatforms: string[]
  customizePerPlatform: boolean
  activePlatform: string
  platformTexts: PlatformTextMap
  setPlatformTexts: Dispatch<SetStateAction<PlatformTextMap>>
  setHashtags: Dispatch<SetStateAction<string[]>>
  setSelectedHashtags: Dispatch<SetStateAction<Set<string>>>
  setAiGeneratedHashtags: Dispatch<SetStateAction<Set<string>>>
  setHashtagPlatforms: Dispatch<SetStateAction<Record<string, string[]>>>
  setSelectedIdea: (idea: string | null) => void
  resetClarificationState: () => void
  setPhotoIdea: (value: string) => void
  setHasHeadlineFromAI: (value: boolean) => void
  setIsHeadlineEditorVisible: (value: boolean) => void
  markAsChanged?: () => void
}

export function useGenerateState({
  initialHeadline,
  initialText,
  initialIncludeEmojis,
  initialIncludeHashtags,
  canonicalSelectedPlatforms,
  customizePerPlatform,
  activePlatform,
  platformTexts,
  setPlatformTexts,
  setHashtags,
  setSelectedHashtags,
  setAiGeneratedHashtags,
  setHashtagPlatforms,
  setSelectedIdea,
  resetClarificationState,
  setPhotoIdea,
  setHasHeadlineFromAI,
  setIsHeadlineEditorVisible,
  markAsChanged
}: UseGenerateStateOptions) {
  const [headline, setHeadline] = useState(initialHeadline)
  const [text, setText] = useState(initialText)
  const [includeEmojis, setIncludeEmojis] = useState(initialIncludeEmojis)
  const [includeHashtags, setIncludeHashtags] = useState(initialIncludeHashtags)
  const [isEdited, setIsEdited] = useState(false)

  const getCurrentText = useCallback(() => {
    if (customizePerPlatform) {
      return platformTexts[activePlatform] || { headline, text }
    }
    return { headline, text }
  }, [activePlatform, customizePerPlatform, headline, platformTexts, text])

  const updateCurrentText = useCallback((field: 'headline' | 'text', value: string) => {
    console.log('[useGenerateState] updateCurrentText called:', { field, valueLength: value.length })
    markAsChanged?.()
    setIsEdited(true)
    console.log('[useGenerateState] setIsEdited(true) called')
    const newHeadline = field === 'headline' ? value : headline
    const newText = field === 'text' ? value : text

    setHeadline(newHeadline)
    setText(newText)

    setPlatformTexts((prev) => {
      // When the user manually edits, cascade to ALL platforms regardless of
      // customizePerPlatform — AI-generated per-platform variation (e.g. a booking link
      // appended only on Facebook) was structural, but a deliberate user edit should
      // always win everywhere.
      const next: PlatformTextMap = {}
      Object.keys(prev).forEach((platform) => {
        next[platform] = {
          headline: newHeadline,
          text: newText
        }
      })
      return next
    })
  }, [headline, markAsChanged, setPlatformTexts, text])

  const handleClearContent = useCallback(() => {
    setHeadline('')
    setText('')
    setPlatformTexts(() => {
      const platformsToReset = canonicalSelectedPlatforms.length > 0
        ? canonicalSelectedPlatforms
        : ['facebook', 'instagram']

      return platformsToReset.reduce<PlatformTextMap>((acc, platform) => {
        acc[platform] = { headline: '', text: '' }
        return acc
      }, {})
    })
    setHashtags([])
    setSelectedHashtags(new Set())
    setAiGeneratedHashtags(new Set())
    setHashtagPlatforms({})
    setSelectedIdea(null)
    setIsEdited(false)
    resetClarificationState()
    setPhotoIdea('')
    setHasHeadlineFromAI(false)
    setIsHeadlineEditorVisible(false)
    markAsChanged?.()
  }, [
    canonicalSelectedPlatforms,
    markAsChanged,
    resetClarificationState,
    setAiGeneratedHashtags,
    setHasHeadlineFromAI,
    setHashtagPlatforms,
    setHashtags,
    setIsHeadlineEditorVisible,
    setPhotoIdea,
    setPlatformTexts,
    setSelectedHashtags,
    setSelectedIdea
  ])

  return {
    headline,
    setHeadline,
    text,
    setText,
    includeEmojis,
    setIncludeEmojis,
    includeHashtags,
    setIncludeHashtags,
    isEdited,
    setIsEdited,
    getCurrentText,
    updateCurrentText,
    handleClearContent
  }
}
