/**
 * useBrandProfile Hook
 * 
 * Manages brand profile state, loading, saving, and generation.
 * Consolidates 20+ useState calls into a single state object with actions.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  BrandProfileForm,
  getBusinessIdForUser,
  fetchBrandProfile,
  saveBrandProfile,
  generateAndSaveBrandProfile,
  GenerationOptions
} from '../services/brandProfileService'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface BrandProfileState {
  // Form data
  form: BrandProfileForm
  
  // IDs
  businessId: string | null
  
  // Loading states
  isLoading: boolean
  isGenerating: boolean
  isSaving: boolean
  
  // Error states
  error: string | null
  
  // Generation metadata
  lowConfidenceHint: string | null
  generationSkipped: boolean
  
  // UI states
  hasUnsavedChanges: boolean
  justSaved: boolean
  
  // Edit mode tracking
  currentlyEditingField: keyof BrandProfileForm | null
}

interface UseBrandProfileReturn extends BrandProfileState {
  // Actions
  updateField: (field: keyof BrandProfileForm, value: string) => void
  save: () => Promise<void>
  generate: (options?: GenerationOptions) => Promise<void>
  reset: () => void
  setEditingField: (field: keyof BrandProfileForm | null) => void
  
  // Computed properties
  canSave: boolean
  canGenerate: boolean
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const INITIAL_FORM: BrandProfileForm = {
  brand_essence: '',
  tone_of_voice: '',
  target_audience: '',
  core_offerings: '',
  content_focus: '',
  image_preferences: '',
  things_to_avoid: '',
  // cta_style: '', // field removed from BrandProfileForm type
  communication_goal: '',
  recognizable_interior_identity: '',
  visual_character: '',
  venue_scene: ''
}

const INITIAL_STATE: BrandProfileState = {
  form: INITIAL_FORM,
  businessId: null,
  isLoading: true,
  isGenerating: false,
  isSaving: false,
  error: null,
  lowConfidenceHint: null,
  generationSkipped: false,
  hasUnsavedChanges: false,
  justSaved: false,
  currentlyEditingField: null
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useBrandProfile(): UseBrandProfileReturn {
  const [state, setState] = useState<BrandProfileState>(INITIAL_STATE)

  // ========================================================================
  // LOAD DATA ON MOUNT
  // ========================================================================

  useEffect(() => {
    let isActive = true

    const loadProfile = async () => {
      try {
        setState(prev => ({ ...prev, isLoading: true, error: null }))

        // Get business ID
        const businessId = await getBusinessIdForUser()
        if (!businessId) {
          if (isActive) {
            setState(prev => ({
              ...prev,
              isLoading: false,
              error: 'Kunne ikke finde din forretning'
            }))
          }
          return
        }

        // Fetch profile
        const profile = await fetchBrandProfile(businessId)
        
        if (!isActive) return

        setState(prev => ({
          ...prev,
          businessId,
          form: profile || INITIAL_FORM,
          isLoading: false,
          hasUnsavedChanges: false
        }))
      } catch (error) {
        console.error('Error loading profile:', error)
        if (isActive) {
          setState(prev => ({
            ...prev,
            isLoading: false,
            error: 'Kunne ikke indlæse brand profil'
          }))
        }
      }
    }

    loadProfile()

    return () => {
      isActive = false
    }
  }, [])

  // ========================================================================
  // ACTION: UPDATE FIELD
  // ========================================================================

  const updateField = useCallback((field: keyof BrandProfileForm, value: string) => {
    setState(prev => ({
      ...prev,
      form: {
        ...prev.form,
        [field]: value
      },
      hasUnsavedChanges: true,
      justSaved: false
    }))
  }, [])

  // ========================================================================
  // ACTION: SAVE
  // ========================================================================

  const save = useCallback(async () => {
    // Guard: prevent concurrent operations
    if (state.isGenerating) {
      console.warn('Cannot save while generating')
      return
    }
    if (state.isSaving) {
      console.warn('Save already in progress')
      return
    }
    if (!state.businessId) {
      console.error('No business ID available')
      setState(prev => ({ ...prev, error: 'Ingen forretning fundet' }))
      return
    }

    setState(prev => ({ ...prev, isSaving: true, error: null }))

    try {
      const result = await saveBrandProfile(state.businessId, state.form, 'user')

      if (!result.success) {
        setState(prev => ({
          ...prev,
          isSaving: false,
          error: result.error || 'Kunne ikke gemme brand profil'
        }))
        return
      }

      setState(prev => ({
        ...prev,
        isSaving: false,
        hasUnsavedChanges: false,
        justSaved: true,
        error: null
      }))

      // Clear "just saved" indicator after 3 seconds
      setTimeout(() => {
        setState(prev => ({ ...prev, justSaved: false }))
      }, 3000)
    } catch (error) {
      console.error('Save error:', error)
      setState(prev => ({
        ...prev,
        isSaving: false,
        error: 'Uventet fejl ved gemning'
      }))
    }
  }, [state.businessId, state.form, state.isGenerating, state.isSaving])

  // ========================================================================
  // ACTION: GENERATE
  // ========================================================================

  const generate = useCallback(async (options: GenerationOptions = {}) => {
    // Guard: prevent concurrent operations
    if (state.isGenerating) {
      console.warn('Generation already in progress')
      return
    }
    if (state.isSaving) {
      console.warn('Cannot generate while saving')
      return
    }
    if (!state.businessId) {
      console.error('No business ID available')
      setState(prev => ({ ...prev, error: 'Ingen forretning fundet' }))
      return
    }

    setState(prev => ({
      ...prev,
      isGenerating: true,
      error: null,
      lowConfidenceHint: null,
      generationSkipped: false
    }))

    try {
      const result = await generateAndSaveBrandProfile(state.businessId, options)

      if (result.error) {
        setState(prev => ({
          ...prev,
          isGenerating: false,
          error: result.error || 'Kunne ikke generere brand profil'
        }))
        return
      }

      // CRITICAL: Fetch from database to get properly formatted data
      // AI returns objects (JSONB), but UI needs strings (mapper handles conversion)
      const formattedProfile = await fetchBrandProfile(state.businessId)

      // Check for low confidence warning
      const evidence = result.analysisEvidence
      let lowConfidenceHint: string | null = null
      
      if (
        evidence?.distinctive_hooks_missing ||
        (typeof evidence?.differentiation_confidence_score === 'number' &&
          evidence.differentiation_confidence_score < 0.5)
      ) {
        lowConfidenceHint =
          evidence?.ui_prompt_da ||
          'Tilføj 1–2 ting der gør jer unikke (fx kunst på væggen, ikon ved indgangen, udsigt, bar/cocktails, events). Så bliver jeres Brand Profil markant mere præcis.'
      }

      setState(prev => ({
        ...prev,
        form: formattedProfile || prev.form,
        isGenerating: false,
        hasUnsavedChanges: false,
        justSaved: true,
        generationSkipped: result.skippedGeneration || false,
        lowConfidenceHint,
        error: null
      }))

      // Clear "just saved" indicator after 3 seconds
      setTimeout(() => {
        setState(prev => ({ ...prev, justSaved: false }))
      }, 3000)

      console.log('✅ Brand profile generated successfully')
    } catch (error) {
      console.error('Generation error:', error)
      setState(prev => ({
        ...prev,
        isGenerating: false,
        error: 'Uventet fejl ved generering'
      }))
    }
  }, [state.businessId, state.isGenerating, state.isSaving])

  // ========================================================================
  // ACTION: RESET
  // ========================================================================

  const reset = useCallback(() => {
    setState(prev => ({
      ...prev,
      form: INITIAL_FORM,
      hasUnsavedChanges: true,
      justSaved: false
    }))
  }, [])

  // ========================================================================
  // ACTION: SET EDITING FIELD
  // ========================================================================

  const setEditingField = useCallback((field: keyof BrandProfileForm | null) => {
    setState(prev => ({ ...prev, currentlyEditingField: field }))
  }, [])

  // ========================================================================
  // COMPUTED PROPERTIES
  // ========================================================================

  const canSave = !state.isGenerating && !state.isSaving && state.hasUnsavedChanges
  const canGenerate = !state.isGenerating && !state.isSaving

  // ========================================================================
  // RETURN API
  // ========================================================================

  return {
    // State
    ...state,
    
    // Actions
    updateField,
    save,
    generate,
    reset,
    setEditingField,
    
    // Computed
    canSave,
    canGenerate
  }
}
