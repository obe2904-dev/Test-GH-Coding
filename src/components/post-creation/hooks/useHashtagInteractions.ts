import { useCallback, type Dispatch, type SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import type { CanonicalPlatform } from '../../../lib/hashtags'

interface UseHashtagInteractionsOptions {
  hashtags: string[]
  setHashtags: Dispatch<SetStateAction<string[]>>
  setSelectedHashtags: Dispatch<SetStateAction<Set<string>>>
  setHashtagPlatforms: Dispatch<SetStateAction<Record<string, string[]>>>
  selectedPlatforms: CanonicalPlatform[]
  setIsEdited: (edited: boolean) => void
  setIsSpellingChecked: (checked: boolean) => void
  markAsChanged?: () => void
  t: TFunction
}

export function useHashtagInteractions({
  hashtags,
  setHashtags,
  setSelectedHashtags,
  setHashtagPlatforms,
  selectedPlatforms,
  setIsEdited,
  setIsSpellingChecked,
  markAsChanged,
  t
}: UseHashtagInteractionsOptions) {
  const toggleHashtagSelection = useCallback(
    (tag: string) => {
      setSelectedHashtags((prev) => {
        const next = new Set(prev)
        if (next.has(tag)) {
          next.delete(tag)
        } else {
          next.add(tag)
        }
        return next
      })
      markAsChanged?.()
      setIsEdited(true)
      setIsSpellingChecked(false)
    },
    [markAsChanged, setIsEdited, setIsSpellingChecked, setSelectedHashtags]
  )

  const handleAddCustomHashtag = useCallback(
    (rawValue: string): string | null => {
      const trimmed = rawValue.trim()
      if (!trimmed) {
        return t('generate.customHashtagErrorEmpty', 'Write a hashtag before adding it')
      }

      const withoutHash = trimmed.replace(/^#+/, '')
      let normalized = withoutHash.replace(/\s+/g, '')
      normalized = normalized.replace(/[^\p{L}\p{N}]+/gu, '')

      if (normalized.length < 2) {
        return t('generate.customHashtagErrorFormat', 'Hashtag must contain at least two letters or numbers')
      }

      if (normalized.length > 30) {
        normalized = normalized.slice(0, 30)
      }

      const lower = normalized.toLowerCase()
      const hasDuplicate = hashtags.some((tag) => tag.toLowerCase() === lower)

      if (hasDuplicate) {
        return t('generate.customHashtagErrorDuplicate', 'That hashtag is already in the list')
      }

      setHashtags((prev) => [...prev, normalized])
      setSelectedHashtags((prev) => {
        const next = new Set(prev)
        next.add(normalized)
        return next
      })

      // Assign custom hashtag to all currently selected platforms
      setHashtagPlatforms((prev) => ({
        ...prev,
        [normalized.toLowerCase()]: [...selectedPlatforms]
      }))

      setIsEdited(true)
      setIsSpellingChecked(false)
      markAsChanged?.()

      return null
    },
    [hashtags, markAsChanged, selectedPlatforms, setHashtagPlatforms, setHashtags, setIsEdited, setIsSpellingChecked, setSelectedHashtags, t]
  )

  return {
    toggleHashtagSelection,
    handleAddCustomHashtag
  }
}
