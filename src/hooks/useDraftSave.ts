import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export const UNSAVED_CHANGES_MESSAGE =
  'Du har ændringer, der ikke er gemt. Er du sikker på, du vil forlade siden?'

const DRAFT_TABLE = 'post_drafts'

interface SaveDraftOptions {
  selectedPlatforms: string[]
  postContent: any
  photoContent: any
  photoIdea: string
}

export function useDraftSave() {
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [draftId, setDraftId] = useState<string | null>(null)

  // Track unsaved changes
  const markAsChanged = () => {
    setHasUnsavedChanges(true)
  }

  const markAsSaved = () => {
    setHasUnsavedChanges(false)
  }

  // Save draft to database
  const saveDraft = async (options: SaveDraftOptions) => {
    setIsSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('User not authenticated')
      }

      const draftData = {
        user_id: user.id,
        selected_platforms: options.selectedPlatforms,
        post_content: options.postContent,
        photo_content: options.photoContent,
        photo_idea: options.photoIdea,
        updated_at: new Date().toISOString()
      }

      let result: any
      if (draftId) {
        // Update existing draft
        result = await (supabase as any)
          .from(DRAFT_TABLE)
          .update(draftData)
          .eq('id', draftId)
          .select()
          .single()
      } else {
        // Create new draft
        result = await (supabase as any)
          .from(DRAFT_TABLE)
          .insert(draftData)
          .select()
          .single()
        
        if (result.data) {
          setDraftId(result.data.id)
        }
      }

      if (result.error) {
        throw result.error
      }

      setLastSaved(new Date())
      setHasUnsavedChanges(false)
      return true
    } catch (error) {
      console.error('Error saving draft:', error)
      return false
    } finally {
      setIsSaving(false)
    }
  }

  // Load latest draft
  const loadDraft = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data, error }: any = await (supabase as any)
        .from(DRAFT_TABLE)
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()

      if (error) throw error

      if (data) {
        setDraftId(data.id)
        setLastSaved(new Date(data.updated_at))
        return {
          selectedPlatforms: data.selected_platforms || [],
          postContent: data.post_content,
          photoContent: data.photo_content,
          photoIdea: data.photo_idea || ''
        }
      }

      return null
    } catch (error) {
      console.error('Error loading draft:', error)
      return null
    }
  }

  // Clear draft
  const clearDraft = () => {
    setDraftId(null)
    setLastSaved(null)
    setHasUnsavedChanges(false)
  }

  // Warn on page exit if unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = UNSAVED_CHANGES_MESSAGE
        return e.returnValue
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  return {
    isSaving,
    lastSaved,
    hasUnsavedChanges,
    saveDraft,
    loadDraft,
    clearDraft,
    markAsChanged,
    markAsSaved
  }
}
