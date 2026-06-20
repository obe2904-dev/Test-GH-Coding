import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { MediaItem, PhotoContent } from '../stores/postCreationStore'

export interface CarouselOrganiseResult {
  /** Suggested ordering as indices into the original uploadedMedia array */
  suggestedOrder: number[]
  /** Index (in suggestedOrder) that should be the cover slide */
  coverIndex: number
  /** Indices (in original array) that the AI suggests skipping */
  flaggedSkipIndices: number[]
  /** Human-readable reason for each flagged item (parallel to flaggedSkipIndices) */
  flaggedReasons: string[]
  /** Overall AI rationale for the suggested order */
  rationale: string
}

interface OrganiseParams {
  mediaItems: MediaItem[]
  theme: PhotoContent['carouselTheme']
  goal: PhotoContent['carouselGoal']
  language?: string
}

interface UseCarouselOrganiseReturn {
  organise: (params: OrganiseParams) => Promise<CarouselOrganiseResult | null>
  isOrganising: boolean
  result: CarouselOrganiseResult | null
  error: string | null
  clearResult: () => void
}

export function useCarouselOrganise(): UseCarouselOrganiseReturn {
  const [isOrganising, setIsOrganising] = useState(false)
  const [result, setResult] = useState<CarouselOrganiseResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const organise = async ({
    mediaItems,
    theme,
    goal,
    language = 'da',
  }: OrganiseParams): Promise<CarouselOrganiseResult | null> => {
    setIsOrganising(true)
    setError(null)

    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-carousel-organise', {
        body: { mediaItems, theme, goal, language },
      })

      if (fnError) {
        const msg = fnError.message || 'Kunne ikke organisere karrusel'
        setError(msg)
        return null
      }

      const organiseResult = data as CarouselOrganiseResult
      setResult(organiseResult)
      return organiseResult
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ukendt fejl'
      setError(msg)
      return null
    } finally {
      setIsOrganising(false)
    }
  }

  const clearResult = () => {
    setResult(null)
    setError(null)
  }

  return { organise, isOrganising, result, error, clearResult }
}
