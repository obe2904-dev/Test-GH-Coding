import { useState } from 'react'
import { supabase } from '../lib/supabase'

// Free tier - simplified response
export interface PhotoAnalysisResultFree {
  overallFeedback: string
  quickTips: string[]
  improvementCategories?: ('lighting' | 'composition' | 'background' | 'contrast')[]
}

// Smart/Pro tier - detailed response
export interface PhotoAnalysisResultPaid {
  contentMatch: {
    score: number
    rating: 'excellent' | 'good' | 'fair' | 'poor'
    feedback: string
  }
  suggestions: {
    composition: string[]
    lighting: string[]
    styling: string[]
    subject: string[]
  }
  improvements: {
    category: 'crop' | 'lighting' | 'color' | 'cleanup'
    title: string
    description: string
    impact: 'high' | 'medium' | 'low'
  }[]
  overallScore: number
}

export type PhotoAnalysisResult = PhotoAnalysisResultFree | PhotoAnalysisResultPaid

interface UsePhotoAnalysisReturn {
  analyzePhoto: (
    imageUrl: string,
    postText?: string,
    businessType?: string,
    language?: string,
    tier?: 'free' | 'standardplus' | 'premium',
    mediaType?: 'image' | 'video',
    duration?: number,
    imageWidth?: number,
    imageHeight?: number,
    businessId?: string
  ) => Promise<PhotoAnalysisResult | null>
  isAnalyzing: boolean
  error: string | null
}

export function usePhotoAnalysis(): UsePhotoAnalysisReturn {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const analyzePhoto = async (
    imageUrl: string,
    postText?: string,
    businessType?: string,
    language: string = 'da',
    tier: 'free' | 'standardplus' | 'premium' = 'free',
    mediaType: 'image' | 'video' = 'image',
    duration?: number,
    imageWidth?: number,
    imageHeight?: number,
    businessId?: string
  ): Promise<PhotoAnalysisResult | null> => {
    setIsAnalyzing(true)
    setError(null)

    try {
      const { data, error: functionError } = await supabase.functions.invoke('analyze-photo', {
        body: {
          imageUrl,
          postText,
          businessType,
          language,
          tier,
          mediaType,
          duration,
          imageWidth,
          imageHeight,
          businessId,
        }
      })

      if (functionError) {
        console.error('Error calling analyze-photo function:', functionError)
        setError(functionError.message || 'Failed to analyze photo')
        return null
      }

      if (!data) {
        setError('No data returned from analysis')
        return null
      }

      return data as PhotoAnalysisResult
    } catch (err) {
      console.error('Error analyzing photo:', err)
      setError(err instanceof Error ? err.message : 'Failed to analyze photo')
      return null
    } finally {
      setIsAnalyzing(false)
    }
  }

  return {
    analyzePhoto,
    isAnalyzing,
    error
  }
}
