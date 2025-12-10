/**
 * usePlatformCustomization Hook
 * 
 * Manages platform-specific content editing for multi-platform posts.
 * Handles toggling between unified and platform-specific content modes.
 */

import { useState, useCallback, useEffect, type Dispatch, type SetStateAction } from 'react'

export interface PlatformContent {
  headline: string
  text: string
}

export interface UsePlatformCustomizationOptions {
  selectedPlatforms: string[]
  initialContent?: PlatformContent
}

export interface UsePlatformCustomizationReturn {
  // State
  customizePerPlatform: boolean
  activePlatform: string
  platformTexts: Record<string, PlatformContent>
  
  // Setters
  setCustomizePerPlatform: (customize: boolean) => void
  setActivePlatform: (platform: string) => void
  setPlatformTexts: Dispatch<SetStateAction<Record<string, PlatformContent>>>
  
  // Actions
  toggleCustomization: (enabled: boolean, unifiedContent: PlatformContent) => void
  updatePlatformContent: (platform: string, field: 'headline' | 'text', value: string) => void
  getPlatformContent: (platform: string) => PlatformContent
  syncUnifiedToPlatforms: (unifiedContent: PlatformContent) => void
  getCurrentPlatformContent: () => PlatformContent
}

export function usePlatformCustomization(
  options: UsePlatformCustomizationOptions
): UsePlatformCustomizationReturn {
  const { selectedPlatforms, initialContent } = options

  const [customizePerPlatform, setCustomizePerPlatform] = useState(false)
  const [activePlatform, setActivePlatform] = useState<string>('facebook')
  
  // Initialize platform texts with empty content for all platforms
  const [platformTexts, setPlatformTexts] = useState<Record<string, PlatformContent>>(() => {
    const seedPlatforms = new Set<string>(['facebook', 'instagram', ...selectedPlatforms])
    const initial: Record<string, PlatformContent> = {}

    seedPlatforms.forEach((platform) => {
      initial[platform] = initialContent || { headline: '', text: '' }
    })

    return initial
  })

  useEffect(() => {
    setPlatformTexts((prev) => {
      const updated = { ...prev }
      selectedPlatforms.forEach((platform) => {
        if (!updated[platform]) {
          updated[platform] = initialContent || { headline: '', text: '' }
        }
      })
      return updated
    })
  }, [selectedPlatforms, initialContent])

  useEffect(() => {
    if (selectedPlatforms.length === 0) {
      return
    }

    if (!selectedPlatforms.includes(activePlatform)) {
      setActivePlatform(selectedPlatforms[0])
    }
  }, [selectedPlatforms, activePlatform])

  /**
   * Toggle between unified and platform-specific customization
   * When enabling, copies unified content to all selected platforms
   */
  const toggleCustomization = useCallback((enabled: boolean, unifiedContent: PlatformContent) => {
    if (enabled) {
      // Copy current unified text to all selected platforms
      const updatedPlatforms = { ...platformTexts }
      selectedPlatforms.forEach(platform => {
        updatedPlatforms[platform] = { 
          headline: unifiedContent.headline, 
          text: unifiedContent.text 
        }
      })
      setPlatformTexts(updatedPlatforms)
    }
    setCustomizePerPlatform(enabled)
  }, [platformTexts, selectedPlatforms])

  /**
   * Update content for a specific platform
   */
  const updatePlatformContent = useCallback((
    platform: string, 
    field: 'headline' | 'text', 
    value: string
  ) => {
    setPlatformTexts(prev => ({
      ...prev,
      [platform]: {
        ...prev[platform],
        [field]: value
      }
    }))
  }, [])

  /**
   * Get content for a specific platform
   */
  const getPlatformContent = useCallback((platform: string): PlatformContent => {
    return platformTexts[platform] || { headline: '', text: '' }
  }, [platformTexts])

  /**
   * Sync unified content to all selected platforms
   */
  const syncUnifiedToPlatforms = useCallback((unifiedContent: PlatformContent) => {
    const updatedPlatforms = { ...platformTexts }
    selectedPlatforms.forEach(platform => {
      updatedPlatforms[platform] = { 
        headline: unifiedContent.headline, 
        text: unifiedContent.text 
      }
    })
    setPlatformTexts(updatedPlatforms)
  }, [platformTexts, selectedPlatforms])

  /**
   * Get content for the currently active platform
   */
  const getCurrentPlatformContent = useCallback((): PlatformContent => {
    return platformTexts[activePlatform] || { headline: '', text: '' }
  }, [platformTexts, activePlatform])

  return {
    // State
    customizePerPlatform,
    activePlatform,
    platformTexts,
    
    // Setters
    setCustomizePerPlatform,
    setActivePlatform,
    setPlatformTexts,
    
    // Actions
    toggleCustomization,
    updatePlatformContent,
    getPlatformContent,
    syncUnifiedToPlatforms,
    getCurrentPlatformContent
  }
}
