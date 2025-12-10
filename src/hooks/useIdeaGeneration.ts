/**
 * useIdeaGeneration Hook
 * 
 * Handles AI idea generation and custom topic processing.
 * Manages idea state, generation logic, and API interactions.
 */

import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useTierStore } from '../stores/tierStore'
import { buildPostIdeaPrompt, AITier } from '../features/aiPromptBuilder'
import { generateIdea as localGenerateIdea } from '../features/idea'
import { extractHashtags, removeHashtags } from '../utils/textUtils'

export interface GeneratedIdea {
  id: string
  title: string
  description: string
  headline: string
  text: string
  type?: 'ai' | 'custom'
  allVariations?: any[]
  originalContent?: any
}

export interface BusinessContext {
  business: any
  profile: any
  location: any
  websiteAnalysis?: any
  latestAnalysis?: any
}

export interface IdeaGenerationOptions {
  topic: string
  selectedPlatforms: string[]
  includeEmojis: boolean
  includeHashtags: boolean
  includeCTA: boolean
  businessContext?: BusinessContext
}

export interface UseIdeaGenerationReturn {
  // State
  isGenerating: boolean
  aiIdeas: GeneratedIdea[]
  customIdea: GeneratedIdea | null
  selectedIdea: string | null
  
  // Setters
  setAiIdeas: (ideas: GeneratedIdea[]) => void
  setCustomIdea: (idea: GeneratedIdea | null) => void
  setSelectedIdea: (id: string | null) => void
  
  // Actions
  generateAIIdeas: (businessContext: BusinessContext) => Promise<void>
  generateCustomIdea: (options: IdeaGenerationOptions) => Promise<void>
  selectIdea: (ideaId: string) => GeneratedIdea | null
  clearIdeas: () => void
}

export function useIdeaGeneration(): UseIdeaGenerationReturn {
  const { i18n } = useTranslation()
  const { t } = useTranslation(undefined, { keyPrefix: 'createPost' })
  
  const {
    currentTier,
    canUseAiIdeas,
    incrementAiIdeas
  } = useTierStore()

  const [isGenerating, setIsGenerating] = useState(false)
  const [aiIdeas, setAiIdeas] = useState<GeneratedIdea[]>([])
  const [customIdea, setCustomIdea] = useState<GeneratedIdea | null>(null)
  const [selectedIdea, setSelectedIdea] = useState<string | null>(null)

  /**
   * Generate AI ideas based on business context
   * Requires Smart or Pro tier
   */
  const generateAIIdeas = useCallback(async (businessContext: BusinessContext) => {
    if (!canUseAiIdeas()) {
      alert(t('generate.upgradeRequired', 'Upgrade to Smart or Pro to use AI Ideas'))
      return
    }

    setIsGenerating(true)

    try {
      const apiUrl = import.meta.env.VITE_SUPABASE_FUNCTION_AI_GENERATE

      const promptContext = {
        business: businessContext.business,
        profile: businessContext.profile,
        location: businessContext.location,
        websiteAnalysis: businessContext.websiteAnalysis || businessContext.latestAnalysis
      }

      const aiPrompt = buildPostIdeaPrompt(promptContext, {
        mode: 'ai',
        userTier: currentTier as AITier,
        language: i18n.language
      })

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          prompt: aiPrompt,
          platforms: ['facebook', 'instagram'],
          tone: 'objective',
          length: 'medium',
          userTier: currentTier
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to generate AI ideas')
      }

      const data = await response.json()

      if (!data || !data.variations || data.variations.length === 0) {
        throw new Error('No ideas returned')
      }

      // Convert variations to ideas
      const ideas: GeneratedIdea[] = data.variations.map((variation: any, index: number) => ({
        id: `ai-${Date.now()}-${index}`,
        title: variation.headline || `Idea ${index + 1}`,
        description: variation.text?.substring(0, 100) + '...' || '',
        headline: variation.headline || '',
        text: variation.text || '',
        type: 'ai' as const,
        allVariations: [variation],
        originalContent: variation
      }))

      setAiIdeas(ideas)
      incrementAiIdeas()

    } catch (error) {
      console.error('Error generating AI ideas:', error)
      alert(t('generate.aiError', 'Failed to generate AI ideas. Please try again.'))
    } finally {
      setIsGenerating(false)
    }
  }, [canUseAiIdeas, currentTier, incrementAiIdeas, i18n.language, t])

  /**
   * Generate custom idea from user topic
   * Available for all tiers
   */
  const generateCustomIdea = useCallback(async (options: IdeaGenerationOptions) => {
    const { 
      topic, 
      selectedPlatforms, 
      includeEmojis, 
      includeHashtags, 
      includeCTA,
      businessContext
    } = options

    if (!topic.trim()) {
      alert(t('generate.enterTopic', 'Please enter a topic'))
      return
    }

    setIsGenerating(true)

    try {
      const apiUrl = import.meta.env.VITE_SUPABASE_FUNCTION_AI_GENERATE
      let data: any

      // Try Supabase function first, fall back to local if it fails
      if (apiUrl && businessContext) {
        try {
          const promptContext = {
            business: businessContext.business,
            profile: businessContext.profile,
            location: businessContext.location,
            websiteAnalysis: businessContext.latestAnalysis
          }

          const aiPrompt = buildPostIdeaPrompt(promptContext, {
            mode: 'custom',
            userTopic: topic,
            userTier: currentTier as AITier,
            language: i18n.language
          })

          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({
              prompt: aiPrompt,
              platforms: selectedPlatforms,
              includeEmojis,
              includeHashtags,
              includeCTA,
              tone: 'objective',
              length: 'medium',
              userTier: currentTier
            })
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.error || 'Failed to generate AI content')
          }

          data = await response.json()
        } catch (err) {
          console.error('Supabase function failed, falling back to local generator', err)
          const stub = await localGenerateIdea({
            topic,
            businessType: 'general',
            location: '',
            platforms: selectedPlatforms
          } as any)
          data = {
            variations: [
              {
                headline: stub.headline,
                text: stub.text,
                hashtags: Array.isArray(stub.hashtags) ? stub.hashtags.join(' ') : (stub.hashtags || ''),
                platform: 'generic'
              }
            ]
          }
        }
      } else {
        // No API URL or business context, use local generator
        const stub = await localGenerateIdea({
          topic,
          businessType: 'general',
          location: '',
          platforms: selectedPlatforms
        } as any)
        data = {
          variations: [
            {
              headline: stub.headline,
              text: stub.text,
              hashtags: Array.isArray(stub.hashtags) ? stub.hashtags.join(' ') : (stub.hashtags || ''),
              platform: 'generic'
            }
          ]
        }
      }

      if (!data || !data.variations || data.variations.length === 0) {
        throw new Error('No variations returned')
      }

      const firstVariation = data.variations[0]

      // Extract hashtags and clean text
      const allText = `${firstVariation.text}\n\n${firstVariation.hashtags || ''}`
      extractHashtags(allText) // Extract for side effects

      let cleanText = removeHashtags(allText)
      cleanText = cleanText.replace(/\s+[^\s.!?]+\s*$/, '').trim()

      const newIdea: GeneratedIdea = {
        id: `custom-${Date.now()}`,
        title: topic,
        headline: firstVariation.headline,
        text: cleanText,
        description: `AI-generated post for ${firstVariation.platform || 'social media'}`,
        type: 'custom',
        allVariations: data.variations,
        originalContent: firstVariation
      }

      setCustomIdea(newIdea)
      setSelectedIdea(newIdea.id)

    } catch (error) {
      console.error('Error generating custom idea:', error)
      alert(t('generate.aiError', 'Failed to generate content. Please try again.'))
    } finally {
      setIsGenerating(false)
    }
  }, [currentTier, i18n.language, t])

  /**
   * Select an idea by ID
   */
  const selectIdea = useCallback((ideaId: string): GeneratedIdea | null => {
    const idea = aiIdeas.find(i => i.id === ideaId) || (customIdea?.id === ideaId ? customIdea : null)
    if (idea) {
      setSelectedIdea(ideaId)
      return idea
    }
    return null
  }, [aiIdeas, customIdea])

  /**
   * Clear all ideas
   */
  const clearIdeas = useCallback(() => {
    setAiIdeas([])
    setCustomIdea(null)
    setSelectedIdea(null)
  }, [])

  return {
    // State
    isGenerating,
    aiIdeas,
    customIdea,
    selectedIdea,
    
    // Setters
    setAiIdeas,
    setCustomIdea,
    setSelectedIdea,
    
    // Actions
    generateAIIdeas,
    generateCustomIdea,
    selectIdea,
    clearIdeas
  }
}
