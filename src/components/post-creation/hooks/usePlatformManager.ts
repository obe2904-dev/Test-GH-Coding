import { useState, useMemo, useEffect, useCallback, type Dispatch, type SetStateAction } from 'react'
import { canonicalizePlatformList, type CanonicalPlatform } from '../../../lib/hashtags'
import type { PlatformContent, PostContent } from '../../../stores/postCreationStore'

interface PlatformTexts {
  [platform: string]: { headline: string; text: string }
}

interface UsePlatformManagerResult {
  canonicalSelectedPlatforms: CanonicalPlatform[]
  activePlatform: string
  setActivePlatform: (platform: string) => void
  customizePerPlatform: boolean
  setCustomizePerPlatform: (value: boolean) => void
  platformTexts: PlatformTexts
  setPlatformTexts: Dispatch<SetStateAction<PlatformTexts>>
  availablePlatforms: CanonicalPlatform[]
  getOnboardingPlatforms: () => string[]
}

interface UsePlatformManagerOptions {
  selectedPlatforms: string[]
  setSelectedPlatforms: (platforms: string[]) => void
  postContent: PostContent | null
  currentTier: string
  isEnabled: (platform: string) => boolean
  loadPlatformsFromDatabase: () => void
}

const INITIAL_PLATFORMS: ReadonlyArray<CanonicalPlatform> = ['facebook', 'instagram']

function buildInitialPlatformTexts(postContent: PostContent | null): PlatformTexts {
  const fallbackHeadline = postContent?.headline ?? ''
  const fallbackText = postContent?.text ?? ''
  const defaultContent = {
    headline: fallbackHeadline,
    text: fallbackText
  }

  if (postContent?.platformSpecific && postContent.platformContent) {
    const cloned: PlatformTexts = {}
    Object.entries(postContent.platformContent as Record<string, PlatformContent>).forEach(([platform, content]) => {
      cloned[platform] = {
        headline: content.headline ?? '',
        text: content.text ?? ''
      }
    })

    return {
      facebook: cloned.facebook ?? { ...defaultContent },
      instagram: cloned.instagram ?? { ...defaultContent },
      ...cloned
    }
  }

  return {
    facebook: { ...defaultContent },
    instagram: { ...defaultContent }
  }
}

export function usePlatformManager({
  selectedPlatforms,
  setSelectedPlatforms,
  postContent,
  currentTier,
  isEnabled,
  loadPlatformsFromDatabase
}: UsePlatformManagerOptions): UsePlatformManagerResult {
  const canonicalSelectedPlatforms = useMemo<CanonicalPlatform[]>(() => {
    const normalized = canonicalizePlatformList(selectedPlatforms)
    if (normalized.length === 0) {
      return ['facebook']
    }
    return normalized
  }, [selectedPlatforms])

  const [activePlatform, setActivePlatform] = useState<string>(selectedPlatforms[0] ?? 'facebook')
  const [customizePerPlatform, setCustomizePerPlatform] = useState<boolean>(Boolean(postContent?.platformSpecific))
  const [platformTexts, setPlatformTexts] = useState<PlatformTexts>(() => buildInitialPlatformTexts(postContent))

  const getOnboardingPlatforms = useCallback((): string[] => {
    try {
      const stored = localStorage.getItem('onboarding:selectedPlatforms')
      if (!stored) return []

      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) {
        return parsed.filter((value): value is string => typeof value === 'string')
      }
      return []
    } catch {
      return []
    }
  }, [])

  useEffect(() => {
    loadPlatformsFromDatabase()
  }, [loadPlatformsFromDatabase])

  useEffect(() => {
    const timer = setTimeout(() => {
      const available = INITIAL_PLATFORMS.filter((platform) => isEnabled(platform))

      if (available.length > 0 && selectedPlatforms.length === 0) {
        const onboarding = getOnboardingPlatforms()
        if (onboarding.length > 0) {
          if (currentTier === 'free') {
            const storedActive = localStorage.getItem('onboarding:activePlatform') || onboarding[0]
            const fallbackPlatform = storedActive && available.includes(storedActive)
              ? storedActive
              : available[0]
            const preferredPlatform = available.includes('facebook')
              ? 'facebook'
              : fallbackPlatform
            setSelectedPlatforms([preferredPlatform])
            setActivePlatform(preferredPlatform)
          } else {
            const filtered = onboarding.filter((platform) => available.includes(platform))
            setSelectedPlatforms(filtered.length > 0 ? filtered : available)
          }
        } else {
          if (currentTier === 'free') {
            setSelectedPlatforms(['facebook'])
            setActivePlatform('facebook')
          } else {
            setSelectedPlatforms(available)
          }
        }
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [currentTier, getOnboardingPlatforms, isEnabled, selectedPlatforms.length, setSelectedPlatforms])

  useEffect(() => {
    if (selectedPlatforms.length > 0 && !selectedPlatforms.includes(activePlatform)) {
      setActivePlatform(selectedPlatforms[0])
    }
  }, [selectedPlatforms, activePlatform])

  useEffect(() => {
    if (selectedPlatforms.length <= 1 && customizePerPlatform) {
      setCustomizePerPlatform(false)
    }
  }, [selectedPlatforms, customizePerPlatform])

  useEffect(() => {
    if (currentTier === 'free' && selectedPlatforms.length > 1) {
      const preferred = selectedPlatforms.includes('facebook') ? 'facebook' : selectedPlatforms[0]
      setSelectedPlatforms([preferred])
      setActivePlatform(preferred)
    }
  }, [currentTier, selectedPlatforms, setSelectedPlatforms])

  useEffect(() => {
    if (!postContent) {
      return
    }

    const recoveredHeadline = postContent.headline ?? ''
    const recoveredText = postContent.text ?? ''

    if (postContent.platformSpecific && postContent.platformContent) {
      setCustomizePerPlatform(true)
      setPlatformTexts(() => {
        const next: PlatformTexts = {}
        Object.entries(postContent.platformContent as Record<string, PlatformContent>).forEach(([platform, content]) => {
          next[platform] = {
            headline: content.headline ?? '',
            text: content.text ?? ''
          }
        })
        return next
      })
      setActivePlatform((current) => {
        const platforms = Object.keys(postContent.platformContent ?? {})
        if (platforms.length === 0) {
          return current
        }
        if (platforms.includes(current)) {
          return current
        }
        return platforms[0]
      })
    } else {
      setCustomizePerPlatform(false)
      setPlatformTexts((prev) => {
        const keys = Object.keys(prev)
        if (keys.length === 0) {
          return {
            facebook: { headline: recoveredHeadline, text: recoveredText },
            instagram: { headline: recoveredHeadline, text: recoveredText }
          }
        }

        const next: PlatformTexts = {}
        keys.forEach((key) => {
          next[key] = {
            headline: recoveredHeadline,
            text: recoveredText
          }
        })
        return next
      })
    }
  }, [postContent])

  const availablePlatforms = INITIAL_PLATFORMS.filter((platform) => isEnabled(platform))

  return {
    canonicalSelectedPlatforms,
    activePlatform,
    setActivePlatform,
    customizePerPlatform,
    setCustomizePerPlatform,
    platformTexts,
    setPlatformTexts,
    availablePlatforms,
    getOnboardingPlatforms
  }
}
