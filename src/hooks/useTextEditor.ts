/**
 * useTextEditor Hook
 * 
 * Manages text editor state and operations for post creation.
 * Handles headline, body text, hashtags, CTA, and content tracking.
 */

import { useState, useCallback } from 'react'
import { extractHashtags, extractCTA, removeCTA } from '../utils/textUtils'

export interface TextContent {
  headline: string
  text: string
}

export interface UseTextEditorOptions {
  initialHeadline?: string
  initialText?: string
  initialHashtags?: string[]
  initialSelectedHashtags?: Set<string>
}

export interface UseTextEditorReturn {
  // State
  headline: string
  text: string
  hashtags: string[]
  selectedHashtags: Set<string>
  isEdited: boolean
  isSpellingChecked: boolean
  includeEmojis: boolean
  includeHashtags: boolean
  includeCTA: boolean
  originalTextWithCTA: string
  originalTextWithoutCTA: string
  
  // Setters
  setHeadline: (value: string) => void
  setText: (value: string) => void
  setHashtags: (tags: string[]) => void
  setSelectedHashtags: (tags: Set<string>) => void
  setIsEdited: (edited: boolean) => void
  setIsSpellingChecked: (checked: boolean) => void
  setIncludeEmojis: (include: boolean) => void
  setIncludeHashtags: (include: boolean) => void
  setIncludeCTA: (include: boolean) => void
  
  // Actions
  updateText: (field: 'headline' | 'text', value: string) => void
  toggleHashtag: (tag: string) => void
  extractAndSetHashtags: (text: string) => void
  handleCTAToggle: (enabled: boolean) => void
  clearContent: () => void
  restoreContent: (content: TextContent & { hashtags?: string[], selectedHashtags?: Set<string> }) => void
  getCurrentContent: () => TextContent
}

export function useTextEditor(options: UseTextEditorOptions = {}): UseTextEditorReturn {
  const [headline, setHeadline] = useState(options.initialHeadline || '')
  const [text, setText] = useState(options.initialText || '')
  const [hashtags, setHashtags] = useState<string[]>(options.initialHashtags || [])
  const [selectedHashtags, setSelectedHashtags] = useState<Set<string>>(
    options.initialSelectedHashtags || new Set()
  )
  const [isEdited, setIsEdited] = useState(false)
  const [isSpellingChecked, setIsSpellingChecked] = useState(false)
  const [includeEmojis, setIncludeEmojis] = useState(true)
  const [includeHashtags, setIncludeHashtags] = useState(true)
  const [includeCTA, setIncludeCTA] = useState(true)
  const [originalTextWithCTA, setOriginalTextWithCTA] = useState<string>('')
  const [originalTextWithoutCTA, setOriginalTextWithoutCTA] = useState<string>('')

  /**
   * Update text field and mark as edited
   */
  const updateText = useCallback((field: 'headline' | 'text', value: string) => {
    setIsEdited(true)
    setIsSpellingChecked(false) // Remove spelling check checkmark when text is edited
    
    if (field === 'headline') {
      setHeadline(value)
    } else {
      setText(value)
    }
  }, [])

  /**
   * Toggle hashtag selection
   */
  const toggleHashtag = useCallback((tag: string) => {
    setSelectedHashtags(prev => {
      const newSet = new Set(prev)
      if (newSet.has(tag)) {
        newSet.delete(tag)
      } else {
        newSet.add(tag)
      }
      return newSet
    })
  }, [])

  /**
   * Extract hashtags from text and update state
   */
  const extractAndSetHashtags = useCallback((text: string) => {
    const extractedTags = extractHashtags(text)
    if (extractedTags.length > 0) {
      setHashtags(extractedTags)
      setSelectedHashtags(new Set(extractedTags)) // All extracted hashtags are selected by default
    }
  }, [])

  /**
   * Handle CTA toggle
   * When disabled, removes CTA from text
   * When enabled, restores CTA if available
   */
  const handleCTAToggle = useCallback((enabled: boolean) => {
    setIncludeCTA(enabled)
    
    if (!enabled) {
      // Remove CTA from text
      const currentCTA = extractCTA(text)
      if (currentCTA) {
        // Store original text with CTA if not already stored
        if (!originalTextWithCTA) {
          setOriginalTextWithCTA(text)
        }
        const textWithoutCTA = removeCTA(text)
        setOriginalTextWithoutCTA(textWithoutCTA)
        setText(textWithoutCTA)
      }
    } else {
      // Restore CTA if we have the original
      if (originalTextWithCTA) {
        setText(originalTextWithCTA)
      } else if (originalTextWithoutCTA) {
        // Can't restore CTA if we don't have the original
        // Just keep current text
      }
    }
  }, [text, originalTextWithCTA, originalTextWithoutCTA])

  /**
   * Clear all content
   */
  const clearContent = useCallback(() => {
    setHeadline('')
    setText('')
    setHashtags([])
    setSelectedHashtags(new Set())
    setIsEdited(false)
    setIsSpellingChecked(false)
    setOriginalTextWithCTA('')
    setOriginalTextWithoutCTA('')
  }, [])

  /**
   * Restore content from saved state
   */
  const restoreContent = useCallback((content: TextContent & { 
    hashtags?: string[]
    selectedHashtags?: Set<string>
  }) => {
    setHeadline(content.headline || '')
    setText(content.text || '')
    
    if (content.hashtags) {
      setHashtags(content.hashtags)
    }
    
    if (content.selectedHashtags) {
      setSelectedHashtags(content.selectedHashtags)
    }
    
    setIsEdited(true)
    setIsSpellingChecked(false) // User should re-check spelling for restored content
  }, [])

  /**
   * Get current content
   */
  const getCurrentContent = useCallback((): TextContent => {
    return { headline, text }
  }, [headline, text])

  return {
    // State
    headline,
    text,
    hashtags,
    selectedHashtags,
    isEdited,
    isSpellingChecked,
    includeEmojis,
    includeHashtags,
    includeCTA,
    originalTextWithCTA,
    originalTextWithoutCTA,
    
    // Setters
    setHeadline,
    setText,
    setHashtags,
    setSelectedHashtags,
    setIsEdited,
    setIsSpellingChecked,
    setIncludeEmojis,
    setIncludeHashtags,
    setIncludeCTA,
    
    // Actions
    updateText,
    toggleHashtag,
    extractAndSetHashtags,
    handleCTAToggle,
    clearContent,
    restoreContent,
    getCurrentContent
  }
}
