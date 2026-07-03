import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { PostContent, PhotoContent } from '../stores/postCreationStore'

interface WriteDraft {
  content: PostContent | null
  photo_content: PhotoContent | null
  selected_platforms: string[]
}

interface UseWriteDraftOptions {
  businessId: string | null
  enabled?: boolean
}

/**
 * Single live draft for "Skriv Selv" mode - replaces multi-source localStorage caching
 * 
 * Lifecycle:
 * - Load: On mount, fetch the single draft row for this user+business
 * - Save: Debounced upsert on every edit
 * - Delete: When user clicks "Slet alt" or moves to Udgiv stage
 * 
 * This is the single source of truth for write mode drafts.
 */
export function useWriteDraft({ businessId, enabled = true }: UseWriteDraftOptions) {
  const saveTimeoutRef = useRef<NodeJS.Timeout>()
  const lastSavedRef = useRef<string>('')

  /**
   * Load the current draft from database
   */
  const loadDraft = useCallback(async (): Promise<WriteDraft | null> => {
    if (!businessId || !enabled) return null

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data, error } = await supabase
        .from('write_drafts')
        .select('content, photo_content, selected_platforms')
        .eq('user_id', user.id)
        .eq('business_id', businessId)
        .maybeSingle()

      if (error) {
        console.error('[useWriteDraft] Load error:', error)
        return null
      }

      if (!data) {
        console.log('[useWriteDraft] No existing draft found')
        return null
      }

      console.log('[useWriteDraft] Draft loaded')
      return {
        content: data.content as PostContent | null,
        photo_content: data.photo_content as PhotoContent | null,
        selected_platforms: data.selected_platforms || []
      }
    } catch (err) {
      console.error('[useWriteDraft] Load exception:', err)
      return null
    }
  }, [businessId, enabled])

  /**
   * Save draft to database (debounced)
   */
  const saveDraft = useCallback((draft: WriteDraft) => {
    if (!businessId || !enabled) return

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Check if content actually changed (avoid unnecessary writes)
    const serialized = JSON.stringify(draft)
    if (serialized === lastSavedRef.current) {
      return
    }

    // Debounce save by 1 second
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { error } = await supabase
          .from('write_drafts')
          .upsert({
            user_id: user.id,
            business_id: businessId,
            content: draft.content,
            photo_content: draft.photo_content as any,
            selected_platforms: draft.selected_platforms,
            updated_at: new Date().toISOString()
          } as any, {
            onConflict: 'user_id,business_id'
          })

        if (error) {
          console.error('[useWriteDraft] Save error:', error)
        } else {
          lastSavedRef.current = serialized
          console.log('[useWriteDraft] Draft saved')
        }
      } catch (err) {
        console.error('[useWriteDraft] Save exception:', err)
      }
    }, 1000)
  }, [businessId, enabled])

  /**
   * Delete draft from database and clear localStorage
   */
  const deleteDraft = useCallback(async () => {
    if (!businessId || !enabled) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Clear pending save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      const { error } = await supabase
        .from('write_drafts')
        .delete()
        .eq('user_id', user.id)
        .eq('business_id', businessId)

      if (error) {
        console.error('[useWriteDraft] Delete error:', error)
      } else {
        lastSavedRef.current = ''
        
        // Also clear localStorage to prevent stale draft restoration
        try {
          localStorage.removeItem('post2grow_draft_recovery')
        } catch (e) {
          console.warn('[useWriteDraft] Failed to clear localStorage:', e)
        }
        
        console.log('[useWriteDraft] Draft deleted (DB + localStorage)')
      }
    } catch (err) {
      console.error('[useWriteDraft] Delete exception:', err)
    }
  }, [businessId, enabled])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  return {
    loadDraft,
    saveDraft,
    deleteDraft
  }
}
