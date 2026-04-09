import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Suggestion } from '../components/media/types'

export interface PhotoEditResult {
  success: boolean
  editedImage: string // Base64 data URL
  appliedEdits: number
  message: string
}

interface UsePhotoEditReturn {
  editPhoto: (
    imageUrl: string,
    selectedSuggestions: Suggestion[],
    language?: string
  ) => Promise<PhotoEditResult | null>
  isEditing: boolean
  error: string | null
}

export function usePhotoEdit(): UsePhotoEditReturn {
  const [isEditing, setIsEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const editPhoto = async (
    imageUrl: string,
    selectedSuggestions: Suggestion[],
    language: string = 'da'
  ): Promise<PhotoEditResult | null> => {
    setIsEditing(true)
    setError(null)

    try {
      const { data, error: functionError } = await supabase.functions.invoke('edit-photo', {
        body: {
          imageUrl,
          selectedSuggestions,
          language
        }
      })

      if (functionError) {
        console.error('Error calling edit-photo function:', functionError)
        
        // Check if this is a tier restriction error (403)
        // Supabase includes error context in the error object
        const errorMessage = functionError.message || 'Failed to edit photo'
        if (errorMessage.includes('403') || errorMessage.includes('Smart or Pro')) {
          const tierError = language === 'da'
            ? 'AI foto-redigering kræver Smart eller Pro abonnement'
            : 'AI photo editing requires Smart or Pro plan'
          setError(tierError)
          throw new Error(tierError)
        }
        
        setError(errorMessage)
        throw new Error(errorMessage)
      }

      // Check if data contains an error field (edge function returned error JSON)
      if (data && typeof data === 'object' && 'error' in data && !data.success) {
        const errorMsg = (data as any).message || (data as any).error || 'Failed to edit photo'
        setError(errorMsg)
        throw new Error(errorMsg)
      }

      if (!data) {
        const noDataError = 'No data returned from editing'
        setError(noDataError)
        throw new Error(noDataError)
      }

      return data as PhotoEditResult
    } catch (err) {
      console.error('Error editing photo:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to edit photo'
      setError(errorMessage)
      throw err // Re-throw to allow CreateStep to handle it
    } finally {
      setIsEditing(false)
    }
  }

  return {
    editPhoto,
    isEditing,
    error
  }
}
