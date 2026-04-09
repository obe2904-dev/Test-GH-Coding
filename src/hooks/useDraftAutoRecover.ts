import { useEffect, useState } from 'react'
import { usePostCreationStore, type MediaItem } from '../stores/postCreationStore'
import { useTierStore } from '../stores/tierStore'

const DRAFT_KEY = 'post2grow_draft_recovery'
const AUTO_RECOVER_INTERVAL = 10000 // 10 seconds

interface DraftRecovery {
  timestamp: number
  selectedPlatforms: string[]
  postContent: any
  photoContent: any
  photoIdea: string
  // Extended fields (added for idea context + wizard step recovery)
  strategicIdea?: any   // matches postCreationStore.strategicIdea shape
  weeklyPlanPost?: any  // full PostSpecification (for direct transfer button)
  ideaSource?: string   // 'user' | 'quick_suggestions' | 'weekly_plan'
  currentStep?: string  // 'generate' | 'create' | 'publish'
}

export function useDraftAutoRecover() {
  const [hasRecoverableDraft, setHasRecoverableDraft] = useState(false)
  const [showRecoveryPrompt, setShowRecoveryPrompt] = useState(false)
  const store = usePostCreationStore()
  const { currentTier } = useTierStore()

  // Check for recoverable draft on mount
  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY)
    if (saved) {
      try {
        const draft: DraftRecovery = JSON.parse(saved)
        // Only show if draft is less than 24 hours old
        const age = Date.now() - draft.timestamp
        if (age < 24 * 60 * 60 * 1000) {
          setHasRecoverableDraft(true)
          setShowRecoveryPrompt(true)
        } else {
          // Clear old draft
          localStorage.removeItem(DRAFT_KEY)
        }
      } catch (e) {
        console.error('Failed to parse draft recovery:', e)
        localStorage.removeItem(DRAFT_KEY)
      }
    }
  }, [])

  // Auto-recover save to localStorage every 10 seconds (ONLY for paid tiers)
  useEffect(() => {
    // Skip auto-save for free tier - only manual save allowed
    if (currentTier === 'free') {
      return
    }

    const interval = setInterval(() => {
      const { selectedPlatforms, postContent, photoContent, photoIdea } = store
      
      // Only save if there's actual content
      if (postContent || photoContent || selectedPlatforms.length > 0) {
        // Create a serializable version of photoContent (blob URLs and File objects can't be serialized)
        let serializablePhotoContent = null
        if (photoContent && photoContent.uploadedMedia.length > 0) {
          serializablePhotoContent = {
            ...photoContent,
            uploadedMedia: photoContent.uploadedMedia.map(media => ({
              id: media.id,
              url: media.originalUrl || media.url, // Prefer Supabase Storage URL over blob URL
              originalUrl: media.originalUrl,
              type: media.type,
              adjustedUrl: media.adjustedUrl,
              adjustments: media.adjustments,
              selectedVersionForPost: media.selectedVersionForPost,
              platformVariants: media.platformVariants,
              // Skip 'file' property - can't be serialized
            }))
          }
        }

        const draft: DraftRecovery = {
          timestamp: Date.now(),
          selectedPlatforms,
          postContent,
          photoContent: serializablePhotoContent || photoContent,
          photoIdea,
          strategicIdea: store.strategicIdea ?? undefined,
          weeklyPlanPost: store.weeklyPlanPost ?? undefined,
          ideaSource: store.strategicIdea ? 'weekly_plan' : 'user',
        }
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
      }
    }, AUTO_RECOVER_INTERVAL)

    return () => clearInterval(interval)
  }, [store, currentTier])

  const recoverDraft = () => {
    const saved = localStorage.getItem(DRAFT_KEY)
    if (saved) {
      try {
        const draft: DraftRecovery = JSON.parse(saved)
        
        // Restore to store
        if (draft.selectedPlatforms.length > 0) {
          store.setSelectedPlatforms(draft.selectedPlatforms)
        }
        if (draft.postContent) {
          store.setPostContent(draft.postContent)
        }
        if (draft.photoContent) {
          // Reconstruct photoContent with proper MediaItem objects
          // Note: File objects can't be recovered, but we have the Supabase Storage URL
          const reconstructedPhotoContent = {
            ...draft.photoContent,
            uploadedMedia: draft.photoContent.uploadedMedia.map((media: Partial<MediaItem>) => ({
              ...media,
              // Create a dummy File object (won't be used since photo is already uploaded)
              file: new File([], media.id || 'unknown', { type: `${media.type || 'image'}/jpeg` }),
              // Use originalUrl as the url since blob URLs are invalid after refresh
              url: media.originalUrl || media.url || '',
            }))
          }
          store.setPhotoContent(reconstructedPhotoContent)
        }
        if (draft.photoIdea) {
          store.setPhotoIdea(draft.photoIdea)
        }
        // Restore strategic idea context from Weekly Plan
        if (draft.strategicIdea) {
          store.setStrategicIdea(draft.strategicIdea)
        }
        // Restore full Weekly Plan post spec (for direct transfer button)
        if (draft.weeklyPlanPost) {
          store.setWeeklyPlanPost(draft.weeklyPlanPost)
        }
        
        setShowRecoveryPrompt(false)
        setHasRecoverableDraft(false)
      } catch (e) {
        console.error('Failed to recover draft:', e)
      }
    }
  }

  const discardDraft = () => {
    localStorage.removeItem(DRAFT_KEY)
    setShowRecoveryPrompt(false)
    setHasRecoverableDraft(false)
  }

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY)
    setHasRecoverableDraft(false)
  }

  return {
    hasRecoverableDraft,
    showRecoveryPrompt,
    recoverDraft,
    discardDraft,
    clearDraft
  }
}
