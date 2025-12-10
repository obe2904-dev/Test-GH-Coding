/**
 * useSpellingCheck Hook
 * 
 * Handles spelling check operations with tier-aware model selection.
 * Supports both text and headline spell checking with proper quota management.
 */

import { useState, useCallback } from 'react'
import { useTierStore } from '../stores/tierStore'
import { useTranslation } from 'react-i18next'

export interface SpellingCheckOptions {
  text: string
  headline?: string
  language: string
  onSuccess?: (correctedText: string, correctedHeadline?: string) => void
  onError?: (error: Error) => void
}

export interface UseSpellingCheckReturn {
  isChecking: boolean
  checkSpelling: (options: SpellingCheckOptions) => Promise<{ text?: string; headline?: string } | null>
}

export function useSpellingCheck(): UseSpellingCheckReturn {
  const [isChecking, setIsChecking] = useState(false)
  const { t } = useTranslation()
  
  const {
    currentTier,
    getTierLimits,
    canUseCaptionGeneration,
    incrementCaptionGeneration
  } = useTierStore()

  /**
   * Check spelling for text (and optionally headline)
   * Uses tier-specific spelling check model (gpt-4o-mini for free, o1-mini for paid)
   */
  const checkSpelling = useCallback(async (options: SpellingCheckOptions) => {
    const { text, headline, language, onSuccess, onError } = options

    // Check quota
    if (!canUseCaptionGeneration()) {
      const limits = getTierLimits(currentTier)
      const errorMsg = t('generate.quotaExceeded', `You've reached your daily limit of ${limits.captionGenerationsPerDay} caption improvements.`)
      alert(errorMsg)
      return null
    }

    setIsChecking(true)
    
    try {
      const results: { text?: string; headline?: string } = {}

      // Check text spelling
      const textResponse = await fetch(import.meta.env.VITE_SUPABASE_FUNCTION_SPELLING, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          text,
          language,
          userTier: currentTier // Pass tier for model selection
        })
      })

      if (!textResponse.ok) {
        throw new Error('Failed to check text spelling')
      }

      const textData = await textResponse.json()
      
      if (textData?.corrected && typeof textData.corrected === 'string') {
        results.text = textData.corrected
      }

      // Check headline spelling if provided
      if (headline && headline.trim()) {
        try {
          const headlineResponse = await fetch(import.meta.env.VITE_SUPABASE_FUNCTION_SPELLING, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({
              text: headline,
              language,
              userTier: currentTier // Pass tier for model selection
            })
          })
          
          if (headlineResponse.ok) {
            const headlineData = await headlineResponse.json()
            if (headlineData?.corrected && typeof headlineData.corrected === 'string') {
              results.headline = headlineData.corrected
            }
          }
        } catch (headlineError) {
          console.warn('Headline spelling check failed:', headlineError)
          // Continue anyway, text spelling worked
        }
      }

      // Increment usage quota
      incrementCaptionGeneration()

      // Call success callback if provided
      if (onSuccess && results.text) {
        onSuccess(results.text, results.headline)
      }

      return results

    } catch (error) {
      console.error('Error checking spelling:', error)
      const errorObj = error instanceof Error ? error : new Error('Failed to check spelling')
      
      if (onError) {
        onError(errorObj)
      } else {
        alert(t('generate.aiError', 'Failed to check spelling.'))
      }
      
      return null
    } finally {
      setIsChecking(false)
    }
  }, [currentTier, canUseCaptionGeneration, getTierLimits, incrementCaptionGeneration, t])

  return {
    isChecking,
    checkSpelling
  }
}
