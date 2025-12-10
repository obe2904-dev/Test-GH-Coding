// ===========================================
// File: src/hooks/usePostComposer.ts
// Why: React hook for integrating AI Post Composer in CreateStep
// ===========================================
import { useState, useCallback, useEffect } from 'react'
import { useTierStore } from '../stores/tierStore'
import { composePost, type PostComposerContext, type PostComposition } from '../features/PostComposerAI'
import { analyzeBusinessProfile } from '../features/BusinessProfilerAI'

export interface UsePostComposerOptions {
  topic: string
  platforms: string[]
  userText?: string
  includeEmojis: boolean
  includeHashtags: boolean
  includeCTA: boolean
  tone?: 'friendly' | 'professional' | 'playful' | 'bold' | 'informative' | 'empathetic'
  language?: string
  businessProfileUrl?: string
}

export interface UsePostComposerResult {
  composition: PostComposition | null
  isGenerating: boolean
  error: string | null
  
  // Actions
  generateComposition: () => Promise<void>
  applyEmoji: (emoji: string) => void
  removeEmoji: (emoji: string) => void
  applyHashtag: (hashtag: string) => void
  removeHashtag: (hashtag: string) => void
  applyCTA: (cta: string) => void
  removeCTA: () => void
  updateText: (text: string) => void
  
  // State helpers
  canUseAI: boolean
  quotaRemaining: number
}

export function usePostComposer(options: UsePostComposerOptions): UsePostComposerResult {
  const [composition, setComposition] = useState<PostComposition | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const { currentTier, canUseCaptionGeneration, incrementCaptionGeneration } = useTierStore()
  
  const generateComposition = useCallback(async () => {
    if (!canUseCaptionGeneration()) {
      setError('AI generation quota exceeded. Please upgrade or try tomorrow.')
      return
    }
    
    setIsGenerating(true)
    setError(null)
    
    try {
      // Build context
      const context: PostComposerContext = {
        topic: options.topic,
        userText: options.userText,
        platforms: options.platforms.map(p => p as any), // Type assertion for simplicity
        primaryPlatform: (options.platforms[0] as any) || 'generic',
        tone: options.tone || 'professional',
        language: options.language || 'da',
        tier: currentTier as any,
        includeEmojis: options.includeEmojis,
        includeHashtags: options.includeHashtags,
        includeCTA: options.includeCTA,
        constraints: getTierConstraints(currentTier)
      }
      
      // Add business profile if available
      if (options.businessProfileUrl && currentTier !== 'free') {
        try {
          context.businessProfile = await analyzeBusinessProfile({
            url: options.businessProfileUrl
          })
        } catch (err) {
          console.warn('Could not analyze business profile:', err)
        }
      }
      
      // Add performance data for paid tiers
      if (currentTier !== 'free') {
        // TODO: Implement performance data integration
        // const profileData = getBusinessProfileData()
        // if (profileData?.historicalPosts) {
        //   context.performanceData = {
        //     topPerformingPosts: profileData.historicalPosts.map((p: any) => ({
        //       text: p.content,
        //       engagement: p.likes + p.comments + p.shares
        //     })),
        //     bestHashtags: profileData.topHashtags || [],
        //     bestPostingTimes: profileData.bestTimes || [],
        //     topEmojis: profileData.topEmojis || []
        //   }
        // }
      }
      
      const result = await composePost(context)
      setComposition(result)
      incrementCaptionGeneration()
      
    } catch (err) {
      console.error('Post composition failed:', err)
      setError(err instanceof Error ? err.message : 'AI generation failed')
    } finally {
      setIsGenerating(false)
    }
  }, [
    options.topic,
    options.userText,
    options.platforms,
    options.includeEmojis,
    options.includeHashtags,
    options.includeCTA,
    options.tone,
    options.language,
    options.businessProfileUrl,
    currentTier,
    canUseCaptionGeneration,
    incrementCaptionGeneration
    // getBusinessProfileData // TODO: Add when implemented
  ])
  
  // Text manipulation actions
  const updateText = useCallback((newText: string) => {
    if (!composition) return
    
    setComposition(prev => prev ? {
      ...prev,
      text: newText
    } : null)
  }, [composition])
  
  const applyEmoji = useCallback((emoji: string) => {
    if (!composition) return
    
    setComposition(prev => {
      if (!prev) return null
      
      const newAppliedEmojis = [...prev.appliedEmojis, emoji]
      const newText = insertEmoji(prev.text, emoji)
      
      return {
        ...prev,
        text: newText,
        appliedEmojis: newAppliedEmojis
      }
    })
  }, [composition])
  
  const removeEmoji = useCallback((emoji: string) => {
    if (!composition) return
    
    setComposition(prev => {
      if (!prev) return null
      
      const newAppliedEmojis = prev.appliedEmojis.filter(e => e !== emoji)
      const newText = removeEmojiFromText(prev.text, emoji)
      
      return {
        ...prev,
        text: newText,
        appliedEmojis: newAppliedEmojis
      }
    })
  }, [composition])
  
  const applyHashtag = useCallback((hashtag: string) => {
    if (!composition) return
    
    setComposition(prev => {
      if (!prev) return null
      
      const newAppliedHashtags = [...prev.appliedHashtags, hashtag]
      
      return {
        ...prev,
        appliedHashtags: newAppliedHashtags
      }
    })
  }, [composition])
  
  const removeHashtag = useCallback((hashtag: string) => {
    if (!composition) return
    
    setComposition(prev => {
      if (!prev) return null
      
      const newAppliedHashtags = prev.appliedHashtags.filter(h => h !== hashtag)
      
      return {
        ...prev,
        appliedHashtags: newAppliedHashtags
      }
    })
  }, [composition])
  
  const applyCTA = useCallback((cta: string) => {
    if (!composition) return
    
    setComposition(prev => {
      if (!prev) return null
      
      let newText = prev.text
      
      // Remove existing CTA if present
      if (prev.appliedCTA) {
        newText = newText.replace(prev.appliedCTA, '').trim()
      }
      
      // Add new CTA
      newText += `\n\n${cta}`
      
      return {
        ...prev,
        text: newText,
        appliedCTA: cta
      }
    })
  }, [composition])
  
  const removeCTA = useCallback(() => {
    if (!composition || !composition.appliedCTA) return
    
    setComposition(prev => {
      if (!prev || !prev.appliedCTA) return prev
      
      const newText = prev.text.replace(prev.appliedCTA, '').trim()
      
      return {
        ...prev,
        text: newText,
        appliedCTA: undefined
      }
    })
  }, [composition])
  
  // Auto-generate when topic changes (debounced)
  useEffect(() => {
    if (options.topic.length > 3) {
      const timeoutId = setTimeout(() => {
        generateComposition()
      }, 1000)
      
      return () => clearTimeout(timeoutId)
    }
  }, [options.topic]) // Only depend on topic for auto-generation
  
  const tierConstraints = getTierConstraints(currentTier)
  
  return {
    composition,
    isGenerating,
    error,
    generateComposition,
    applyEmoji,
    removeEmoji,
    applyHashtag,
    removeHashtag,
    applyCTA,
    removeCTA,
    updateText,
    canUseAI: canUseCaptionGeneration(),
    quotaRemaining: tierConstraints.maxGenerationsPerDay - (/* quota usage */ 0)
  }
}

// Helper functions
function getTierConstraints(tier: string) {
  switch (tier) {
    case 'free':
      return {
        maxHashtags: 3,
        maxEmojis: 3,
        maxCtas: 2,
        maxGenerationsPerDay: 3,
        canCustomizeTone: false,
        canAccessTrends: false,
        canUseBusinessProfile: false
      }
    case 'standardplus':
      return {
        maxHashtags: 10,
        maxEmojis: 6,
        maxCtas: 5,
        maxGenerationsPerDay: 50,
        canCustomizeTone: true,
        canAccessTrends: true,
        canUseBusinessProfile: true
      }
    case 'premium':
      return {
        maxHashtags: 20,
        maxEmojis: 10,
        maxCtas: 8,
        maxGenerationsPerDay: -1, // Unlimited
        canCustomizeTone: true,
        canAccessTrends: true,
        canUseBusinessProfile: true
      }
    default:
      return getTierConstraints('free')
  }
}

function insertEmoji(text: string, emoji: string): string {
  // Smart emoji insertion - add to the first sentence
  const sentences = text.split('. ')
  if (sentences.length > 0) {
    sentences[0] = `${emoji} ${sentences[0]}`
  }
  return sentences.join('. ')
}

function removeEmojiFromText(text: string, emoji: string): string {
  return text.replace(new RegExp(emoji, 'g'), '').replace(/\s+/g, ' ').trim()
}