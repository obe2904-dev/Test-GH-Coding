import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { usePostCreationStore, MediaItem, type PlatformContent, type PlatformHashtag, type PhotoContent } from '../../stores/postCreationStore'
import { useConnectionsStore } from '../../stores/connectionsStore'
import { useAuthStore } from '../../stores/authStore'
import { useTierStore } from '../../stores/tierStore'
import { TIER_QUOTAS } from '../../config/quotas'
import { uploadImageToStorage, uploadAdjustedImageToStorage } from '../../api/image-processing'
import { useVideoCover } from '../../hooks/useVideoCover'
import { VideoCoverSelector } from '../media/VideoCoverSelector'
import { UpgradeModal } from '../ui/UpgradeModal'
import { PlatformSelector } from './shared/PlatformSelector'
import { PlatformPreview, CaptionEditModal, HashtagEditModal, PhotoUploadManager, CarouselActivationBanner, CarouselSetup } from './design'
import { useCarouselOrganise } from '../../hooks/useCarouselOrganise'
import { buildPlatformPreviewContent } from './publish/utils'
import { usePhotoAnalysis } from '../../hooks/usePhotoAnalysis'
import { usePhotoEdit } from '../../hooks/usePhotoEdit'
import { useBusinessData } from '../../hooks/useBusinessData'
import { MediaAnalysisPanel } from '../media/MediaAnalysisPanel'
import { CropOverlay } from '../media/CropOverlay'
import { MediaGalleryModal } from '../media/media-gallery'
import { recordMediaUsage, getStorageQuota, type StorageQuota } from '../../api/mediaLibrary'
import type { MediaItem as GalleryMediaItem } from '../../api/mediaLibrary'
import type { Suggestion } from '../media/types'
import { supabase } from '../../lib/supabase'
import { buildZeroRowAuditMessage, getAffectedRowCount } from '../../lib/dailySuggestionIntegrity'
import { usePosts } from '../../hooks/usePosts'

interface CreateStepProps {
  onNext: () => void
  onBack: () => void
  onStepClick?: (step: number) => void
  markAsChanged?: () => void
  markAsSaved?: () => void
  hasUnsavedChanges?: boolean
  suggestionId?: string // ID of the daily_suggestion being edited
  onSwitchIdea?: (index: number) => void // Switch to a different Weekly Plan idea from the tab strip
}

// Icon Components
const ChevronLeft = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
)

const ChevronRight = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
)

const Sparkles = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M12 2l1.09 3.26L16 6.35l-2.91 1.09L12 11l-1.09-3.26L8 6.35l2.91-1.09z"/>
    <path d="M19 9l.69 2.07L22 11.76l-2.31.69L19 15l-.69-2.07L16 11.76l2.31-.69z"/>
    <path d="M5 18l.69 2.07L8 20.76l-2.31.69L5 24l-.69-2.07L2 20.76l2.31-.69z"/>
  </svg>
)

export function CreateStep({ onNext, onBack, onStepClick: _onStepClick, markAsChanged, markAsSaved, hasUnsavedChanges, suggestionId, onSwitchIdea }: CreateStepProps) {
  const { t, i18n } = useTranslation(undefined, { keyPrefix: 'createPost' })
  const {
    postContent, selectedPlatforms, photoContent, photoIdea, strategicIdea,
    setPhotoContent, setSelectedPlatforms, setPostContent,
    weeklyContentPlan, weeklyPlanPostIndex, draftMap, weeklyPlanSessionDone,
    weeklyPlanSuggestion, activePath, selectedIdea,
  } = usePostCreationStore()
  const { enabledPlatforms } = useConnectionsStore()
  const { user } = useAuthStore()
  const { currentTier } = useTierStore()
  const businessData = useBusinessData()
  const currentBusinessId = businessData.business?.id
  const posts = usePosts()

  const [previewPlatform, setPreviewPlatform] = useState<'facebook' | 'instagram'>(
    selectedPlatforms[0] === 'instagram' ? 'instagram' : 'facebook'
  )

  // Sync selected platforms with enabled platforms after loading
  useEffect(() => {
    // Use enabledPlatforms from store hook (reactively updates when database load completes)
    if (enabledPlatforms.length > 0 && selectedPlatforms.length === 0) {
      // Both FREE and PAID tiers: Show all enabled platforms for preview
      console.log('✅ CreateStep: Setting platforms to:', enabledPlatforms)
      setSelectedPlatforms(enabledPlatforms)
    }
  }, [enabledPlatforms, selectedPlatforms.length, setSelectedPlatforms])
  
  // Sync preview platform with selected platform (for Free tier)
  useEffect(() => {
    if (currentTier === 'free' && selectedPlatforms.length === 1) {
      const platform = selectedPlatforms[0] as 'facebook' | 'instagram'
      setPreviewPlatform(platform)
    }
  }, [selectedPlatforms, currentTier])

  useEffect(() => {
    if (selectedPlatforms.length > 0 && !selectedPlatforms.includes(previewPlatform)) {
      setPreviewPlatform(selectedPlatforms[0] as 'facebook' | 'instagram')
    }
  }, [previewPlatform, selectedPlatforms])

  // Note: FREE tier users can now preview both platforms if they have both enabled
  // The publishing step will handle tier-based restrictions

  // State management
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0)
  const [, setViewMode] = useState<'original' | 'adjusted'>('original')
  const [_processingImage, setProcessingImage] = useState(false)
  
  // Upgrade modal state
  const [showUpgradeModal, setShowUpgradeModal] = useState<'variations' | 'photo-picker' | 'scheduling' | 'tone-length' | null>(null)
  
  // Media Gallery modal state
  const [mediaGalleryOpen, setMediaGalleryOpen] = useState(false)
  
  // Storage quota state
  const [storageQuota, setStorageQuota] = useState<StorageQuota | null>(null)
  
  // Photo analysis state
  const { analyzePhoto, isAnalyzing, error: analysisError } = usePhotoAnalysis()
  const { editPhoto, isEditing } = usePhotoEdit()
  const { extractCoverCandidates, isExtracting: isExtractingCover } = useVideoCover()

  const [showCropOverlay, setShowCropOverlay] = useState(false)

  // Photo suggestion collapsed state
  const [photoIdeaOpen, setPhotoIdeaOpen] = useState(false)

  // Carousel state
  const [carouselBannerDismissed, setCarouselBannerDismissed] = useState(false)

  // Hidden file input for "Skift foto" from the analysis panel
  const changePhotoInputRef = useRef<HTMLInputElement>(null)
  const { organise, isOrganising, result: organiseResult, clearResult: clearOrganiseResult } = useCarouselOrganise()

  // Caption edit modal state
  const [captionEditOpen, setCaptionEditOpen] = useState(false)
  
  // Hashtag edit modal state
  const [hashtagEditOpen, setHashtagEditOpen] = useState(false)

  // Load storage quota on mount
  useEffect(() => {
    if (currentBusinessId) {
      getStorageQuota(currentBusinessId)
        .then(setStorageQuota)
        .catch(err => console.warn('Failed to load storage quota:', err))
    }
  }, [currentBusinessId])

  // Helper to reload quota after uploads/deletions
  const reloadQuota = useCallback(async () => {
    if (currentBusinessId) {
      try {
        const quota = await getStorageQuota(currentBusinessId)
        setStorageQuota(quota)
      } catch (err) {
        console.warn('Failed to reload quota:', err)
      }
    }
  }, [currentBusinessId])

  const handleCaptionSave = useCallback(async (newText: string, saveAsExample?: boolean) => {
    if (!postContent) return
    // When the user has per-platform text, update only the active platform's text
    if (postContent.platformSpecific && postContent.platformContent?.[previewPlatform]) {
      setPostContent({
        ...postContent,
        platformContent: {
          ...postContent.platformContent,
          [previewPlatform]: {
            ...postContent.platformContent[previewPlatform],
            text: newText,
          },
        },
      })
    } else {
      setPostContent({ ...postContent, text: newText })
    }
    markAsChanged?.()

    // Optionally save as a voice example in the brand profile
    if (saveAsExample && businessData.business?.id) {
      try {
        const { data: profileRow } = await supabase
          .from('business_brand_profile')
          .select('voice_examples')
          .eq('business_id', businessData.business.id)
          .single()
        const existing = (profileRow?.voice_examples as Record<string, unknown>) ?? {}
        const doSay: string[] = Array.isArray(existing.do_say) ? (existing.do_say as string[]) : []
        // Cap at 10 examples to avoid unbounded growth; newest last, deduplicated
        const deduplicated = [...new Set([...doSay, newText])].slice(-10)
        await supabase
          .from('business_brand_profile')
          .update({ voice_examples: { ...existing, do_say: deduplicated } })
          .eq('business_id', businessData.business.id)
        console.log('[CreateStep] Saved edited caption as voice example')
      } catch (err) {
        console.warn('[CreateStep] Failed to save voice example:', err)
      }
    }
  }, [postContent, setPostContent, markAsChanged, previewPlatform, businessData.business?.id])
  
  const handleHashtagSave = useCallback((sharedHashtags: PlatformHashtag[], platformHashtags: Record<string, PlatformHashtag[]>) => {
    if (!postContent) return
    
    // Update hashtags based on platform-specific mode
    if (postContent.platformSpecific && postContent.platformContent) {
      // Update platform-specific hashtags
      const updatedPlatformContent: Record<string, PlatformContent> = {}
      for (const platform of Object.keys(postContent.platformContent)) {
        updatedPlatformContent[platform] = {
          ...postContent.platformContent[platform],
          hashtags: platformHashtags[platform] || []
        }
      }
      setPostContent({
        ...postContent,
        platformContent: updatedPlatformContent
      })
    } else {
      // Update shared hashtags
      setPostContent({
        ...postContent,
        hashtags: sharedHashtags
      })
    }
    markAsChanged?.()
  }, [postContent, setPostContent, markAsChanged])
  
  // Load saved photo analysis and media when editing an existing suggestion
  useEffect(() => {
    if (suggestionId && currentBusinessId) {
      console.log('🔍 Loading saved data for suggestion:', suggestionId)
      ;(supabase as any)
        .from('daily_suggestions')
        .select('uploaded_photo_url, photo_analysis, media_items')
        .eq('id', suggestionId)
        .eq('business_id', currentBusinessId)
        .single()
        .then(({ data, error }: { data: any; error: any }) => {
          if (error) {
            console.error('❌ Failed to load saved data:', error)
            return
          }

          // Load photo analysis + media items together so analysis sits on the right MediaItem
          if (data?.media_items && Array.isArray(data.media_items)) {
            // Read current store state inside the async callback — avoids stale closure
            // values for activePath/selectedIdea/weeklyPlanPostIndex which are NOT in the
            // effect's dependency array.
            const {
              activePath: currentPath,
              selectedIdea: currentIdea,
              weeklyPlanPostIndex: currentPlanIndex,
              photoContent: currentPhotoContent,
            } = usePostCreationStore.getState()

            const contextKey = currentPath === 'ai-ideas'
              ? `ai-ideas:${currentIdea ?? 'none'}`
              : currentPath === 'weekly-plan'
              ? `weekly-plan:${currentPlanIndex}`
              : 'write'

            const restoredMedia: MediaItem[] = data.media_items.map((item: any, idx: number) => {
              // Preserve in-memory analysis when DB doesn't have it yet (e.g. DB save failed
              // or user navigated away before the save completed).
              const existingCache = idx === 0
                ? currentPhotoContent?.uploadedMedia?.find(m => m.id === item.id)?.analysisCache
                : undefined

              return {
                id: item.id,
                file: null as any, // No File object when restoring from DB - will use URL instead
                url: item.originalUrl || item.url, // Use storage URL as display URL
                originalUrl: item.originalUrl,
                adjustedUrl: item.adjustedUrl,
                type: item.type || 'image',
                adjustments: item.adjustments,
                selectedVersionForPost: item.selectedVersionForPost || 'original',
                // Prefer DB analysis; fall back to existing in-memory cache so we never
                // accidentally wipe a valid analysis result.
                analysisCache: idx === 0
                  ? (data?.photo_analysis
                      ? { [contextKey]: data.photo_analysis }
                      : existingCache)
                  : undefined,
                coverCandidates: item.coverCandidates,
                selectedCoverUrl: item.selectedCoverUrl,
              }
            })

            setPhotoContent({
              uploadedMedia: restoredMedia,
              selectedMedia: null,
              isOriginal: true,
              photoAdjustments: null,
              carouselMode: false,
            })
            console.log('✅ Restored', restoredMedia.length, 'media items')
          } else if (data?.photo_analysis) {
            // Fallback: no media_items but analysis exists — kept for DB back-compat
            console.log('📥 Loaded saved analysis (no media items):', data.photo_analysis)
          }
        })
      return
    }

    // No warning needed: currentBusinessId loads asynchronously, effect will re-run when ready
  }, [suggestionId, currentBusinessId, setPhotoContent])
  
  const maxPhotos = TIER_QUOTAS[currentTier].photoUploadsPerPost

  const content = postContent || {
    headline: '',
    text: '',
    adjustments: {
      length: 'current' as const,
      tone: 'professional' as const,
      includeHashtags: true,
      includeEmojis: true,
      includeBookingLink: false
    },
    hashtags: []
  }

  const platformPreviewContent = useMemo(() => {
    if (!postContent) {
      return content
    }

    const preview = buildPlatformPreviewContent(postContent, previewPlatform, selectedPlatforms)

    return {
      ...content,
      headline: preview.headline,
      text: preview.text,
      hashtags: preview.hashtags,
      adjustments: {
        ...content.adjustments,
        includeHashtags: preview.includeHashtags
      }
    }
  }, [content, postContent, previewPlatform, selectedPlatforms])

  const hasPersistedDraft = useMemo(() => {
    if (postContent) {
      const trimmedHeadline = (postContent.headline ?? '').trim()
      const trimmedText = (postContent.text ?? '').trim()

      if (trimmedHeadline.length > 0 || trimmedText.length > 0) {
        return true
      }

      if (postContent.platformSpecific && postContent.platformContent) {
        const hasPlatformContent = Object.values(postContent.platformContent as Record<string, PlatformContent>).some((platformContent) => {
          const platformHeadline = (platformContent.headline ?? '').trim()
          const platformText = (platformContent.text ?? '').trim()
          return platformHeadline.length > 0 || platformText.length > 0
        })

        if (hasPlatformContent) {
          return true
        }
      }

      if (postContent.hashtags && postContent.hashtags.length > 0) {
        return true
      }
    }

    if (photoContent?.uploadedMedia && photoContent.uploadedMedia.length > 0) {
      return true
    }

    if (photoIdea && photoIdea.trim().length > 0) {
      return true
    }

    return false
  }, [postContent, photoContent, photoIdea])

  const handleSaveDraft = useCallback(() => {
    const snapshot = postContent

    if (!snapshot && (!photoContent || photoContent.uploadedMedia.length === 0) && (!photoIdea || photoIdea.trim().length === 0)) {
      return false
    }

    let serializablePhotoContent = null
    if (photoContent && photoContent.uploadedMedia.length > 0) {
      serializablePhotoContent = {
        ...photoContent,
        uploadedMedia: photoContent.uploadedMedia.map((media) => ({
          id: media.id,
          url: media.originalUrl || media.url,
          originalUrl: media.originalUrl,
          type: media.type,
          adjustedUrl: media.adjustedUrl,
          adjustments: media.adjustments,
          selectedVersionForPost: media.selectedVersionForPost,
          platformVariants: media.platformVariants
        }))
      }
    }

    const draft = {
      timestamp: Date.now(),
      selectedPlatforms,
      postContent: snapshot,
      photoContent: serializablePhotoContent || photoContent,
      photoIdea
    }

    try {
      localStorage.setItem('post2grow_draft_recovery', JSON.stringify(draft))
      markAsSaved?.()
      return true
    } catch (error) {
      console.error('Failed to persist draft:', error)
      return false
    }
  }, [postContent, photoContent, photoIdea, selectedPlatforms, markAsSaved])

  // Helper function to save media items to database
  const saveMediaToDatabase = useCallback(async (mediaItems: MediaItem[]) => {
    if (!suggestionId || !currentBusinessId) {
      console.log('ℹ️ Missing suggestion/business id - skipping media save')
      return
    }

    // Convert MediaItem[] to serializable format (exclude File object)
    const serializableMedia = mediaItems.map(item => ({
      id: item.id,
      url: item.originalUrl || item.url,
      originalUrl: item.originalUrl,
      adjustedUrl: item.adjustedUrl,
      type: item.type,
      adjustments: item.adjustments,
      selectedVersionForPost: item.selectedVersionForPost,
      slideCaption: item.slideCaption,
      aiSkipSuggested: item.aiSkipSuggested,
      coverCandidates: item.coverCandidates,
      selectedCoverUrl: item.selectedCoverUrl,
    }))

    console.log('💾 Saving media items to suggestion:', suggestionId)
    console.log('📸 Media count:', serializableMedia.length)

    try {
      const { data, error } = await (supabase as any)
        .from('daily_suggestions')
        .update({ media_items: serializableMedia })
        .eq('id', suggestionId)
        .eq('business_id', currentBusinessId)
        .select('id')

      if (error) {
        console.error('❌ Failed to save media items:', error)
      } else if (getAffectedRowCount(data) === 0) {
        console.warn(buildZeroRowAuditMessage('media_items', currentBusinessId, Number(suggestionId)))
      } else {
        console.log('✅ Media items saved to suggestion:', suggestionId)
      }
    } catch (err) {
      console.error('❌ Exception while saving media items:', err)
    }
  }, [suggestionId, currentBusinessId])

  // Helper function to save weekly-plan photo to posts table
  const saveWeeklyPlanPhoto = useCallback(async (photoUrl: string) => {
    const { weeklyPlanPost, weeklyContentPlan } = usePostCreationStore.getState()
    
    if (!currentBusinessId || !weeklyPlanPost?.timing?.date) {
      console.log('ℹ️ Missing weekly plan context - skipping photo save')
      return
    }

    console.log('💾 Saving weekly-plan photo to posts:', photoUrl)
    console.log('📅 Slot date:', weeklyPlanPost.timing.date)

    try {
      const dbKey = {
        businessId: currentBusinessId,
        ideaSource: 'weekly_plan' as const,
        weeklyPlanSlotDate: weeklyPlanPost.timing.date,
        weeklyPlanId: weeklyContentPlan?.id ?? null,
        weeklyPlanSlotIndex: weeklyPlanPostIndex ?? null,
      }

      await posts.saveDraft(dbKey, {
        photoUrl,
        platforms: selectedPlatforms.length > 0 ? selectedPlatforms : ['instagram', 'facebook'],
      })

      console.log('✅ Weekly-plan photo saved to posts table')
    } catch (err) {
      console.error('❌ Failed to save weekly-plan photo:', err)
    }
  }, [currentBusinessId, weeklyPlanPostIndex, selectedPlatforms, posts])

  // Helper to get video duration
  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video')
      video.preload = 'metadata'
      
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src)
        resolve(video.duration)
      }
      
      video.onerror = () => {
        reject(new Error('Failed to load video metadata'))
      }
      
      video.src = URL.createObjectURL(file)
    })
  }

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    // Check storage quota before upload
    if (storageQuota?.isOverLimit) {
      alert(
        currentTier === 'free'
          ? 'Storage full! You\'ve used all 100MB. Upgrade to Standard Plus for 1GB storage.'
          : 'Storage full! Delete old media or contact support to increase your quota.'
      )
      return
    }

    if (storageQuota?.isNearLimit) {
      const proceed = confirm(
        `Warning: You're using ${storageQuota.percentUsed.toFixed(0)}% of your storage (${storageQuota.usedMB}MB / ${storageQuota.limitMB}MB). Continue uploading?`
      )
      if (!proceed) return
    }

    const currentPhotoCount = photoContent?.uploadedMedia?.length || 0
    const availableSlots = maxPhotos - currentPhotoCount
    
    if (availableSlots <= 0) {
      // Show upgrade modal or message
      return
    }

    if (!user) {
      console.error('User not authenticated')
      return
    }

    setProcessingImage(true)

    try {
      const newPhotos: MediaItem[] = []
      const filesToProcess = Array.from(files).slice(0, availableSlots)

      for (const file of filesToProcess) {
        const isImage = file.type.startsWith('image/')
        const isVideo = file.type.startsWith('video/')
        
        if (isImage || isVideo) {
          // Create preview URL for display
          const previewUrl = URL.createObjectURL(file)
          
          // For videos, check duration
          let duration: number | undefined
          let canAnalyze = true
          
          if (isVideo) {
            try {
              duration = await getVideoDuration(file)
              canAnalyze = duration <= 30 // Only analyze videos ≤30 seconds
              
              if (duration > 90) {
                console.warn(`Video too long: ${duration}s. Skipping.`)
                continue // Skip videos longer than 90 seconds
              }
            } catch (error) {
              console.warn('Could not read video duration:', error)
              canAnalyze = false
            }
          }
          
          try {
            // Upload to Supabase Storage (works for both images and videos)
            const originalUrl = await uploadImageToStorage(file, user.id)
            
            newPhotos.push({
              id: Math.random().toString(36).substr(2, 9),
              file,
              url: previewUrl, // Local preview
              originalUrl: originalUrl, // Storage URL
              type: isVideo ? 'video' : 'image',
              selectedVersionForPost: 'original',
              duration,
              canAnalyze
            })
          } catch (uploadError) {
            // Fallback to local blob if upload fails
            newPhotos.push({
              id: Math.random().toString(36).substr(2, 9),
              file,
              url: previewUrl,
              originalUrl: previewUrl,
              type: isVideo ? 'video' : 'image',
              selectedVersionForPost: 'original',
              duration,
              canAnalyze
            })
          }
        }
      }

      const updatedMedia = [...(photoContent?.uploadedMedia || []), ...newPhotos]
      
      setPhotoContent({
        uploadedMedia: updatedMedia,
        selectedMedia: null,
        isOriginal: true,
        photoAdjustments: null,
        // Preserve existing carousel state when adding more photos
        carouselMode: photoContent?.carouselMode ?? false,
        carouselTheme: photoContent?.carouselTheme,
        carouselCoverIndex: photoContent?.carouselCoverIndex,
        carouselGoal: photoContent?.carouselGoal,
      })
      
      markAsChanged?.() // Mark draft as changed when photo is uploaded

      // Save media to database based on context
      if (activePath === 'weekly-plan' && newPhotos.length > 0 && newPhotos[0].originalUrl) {
        // For weekly-plan: save first photo URL to posts table immediately
        await saveWeeklyPlanPhoto(newPhotos[0].originalUrl)
      } else if (suggestionId) {
        // For AI ideas: save to daily_suggestions
        await saveMediaToDatabase(updatedMedia)
      }

      // NOTE: Media is NOT saved to media_library here - it will be saved
      // in PublishStep when the post is actually published/scheduled.
      // This prevents wasting storage quota on test uploads and abandoned posts.

      // Select the first newly uploaded photo
      if (newPhotos.length > 0) {
        setSelectedMediaIndex(currentPhotoCount)
      }

      // For video uploads (Smart / Pro): extract cover candidates in the background.
      // We update the specific MediaItem in the store once candidates are ready.
      if (currentTier !== 'free' && user) {
        for (const photo of newPhotos) {
          if (photo.type === 'video') {
            extractCoverCandidates(photo.file, user.id).then((candidates) => {
              if (candidates.length === 0) return
              const { photoContent: current } = usePostCreationStore.getState()
              if (!current) return
              const updated = current.uploadedMedia.map((m) =>
                m.id === photo.id ? { ...m, coverCandidates: candidates } : m
              )
              usePostCreationStore.getState().setPhotoContent({
                ...current,
                uploadedMedia: updated,
              })
            })
          }
        }
      }

    } catch (error) {
      console.error('Error processing image:', error)
      alert(t('create.uploadFailed'))
    } finally {
      setProcessingImage(false)
    }
  }

  // Handler for selecting media from gallery
  const handleSelectFromGallery = async (galleryMedia: GalleryMediaItem) => {
    try {
      console.log('📷 Selected media from gallery:', galleryMedia)
      
      // Check photo limit
      const currentPhotoCount = photoContent?.uploadedMedia?.length || 0
      if (currentPhotoCount >= maxPhotos) {
        alert(t('create.photoLimitReached', { max: maxPhotos }) || `Maximum ${maxPhotos} photos reached`)
        return
      }

      // Convert gallery media to MediaItem format
      const newMediaItem: MediaItem = {
        id: galleryMedia.id,
        file: null as any, // No File object when selecting from gallery
        url: galleryMedia.storage_path,
        originalUrl: galleryMedia.storage_path,
        adjustedUrl: null as any,
        type: galleryMedia.media_type as 'image' | 'video',
        adjustments: null as any,
        selectedVersionForPost: 'original',
        analysisCache: undefined,
        coverCandidates: galleryMedia.media_type === 'video' && galleryMedia.video_thumbnail_path 
          ? [galleryMedia.video_thumbnail_path] 
          : undefined,
        selectedCoverUrl: galleryMedia.media_type === 'video' ? (galleryMedia.video_thumbnail_path ?? undefined) : undefined,
        duration: galleryMedia.duration || undefined,
      }

      // Add to uploaded media
      const updatedMedia = [...(photoContent?.uploadedMedia || []), newMediaItem]
      
      setPhotoContent({
        uploadedMedia: updatedMedia,
        selectedMedia: photoContent?.selectedMedia || null,
        isOriginal: true,
        photoAdjustments: photoContent?.photoAdjustments || null,
        carouselMode: photoContent?.carouselMode ?? false,
        carouselTheme: photoContent?.carouselTheme,
        carouselCoverIndex: photoContent?.carouselCoverIndex,
        carouselGoal: photoContent?.carouselGoal,
      })
      
      markAsChanged?.() // Mark draft as changed

      // Track media reuse
      await recordMediaUsage(galleryMedia.id)
      
      // Save to database if editing a suggestion
      await saveMediaToDatabase(updatedMedia)

      // Select the newly added media
      setSelectedMediaIndex(currentPhotoCount)
      
      // Close modal
      setMediaGalleryOpen(false)
      
      console.log('✅ Media added from gallery successfully')
    } catch (error) {
      console.error('Error adding media from gallery:', error)
      alert('Failed to add media from gallery. Please try again.')
    }
  }

  const _handleReplacePhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    if (!file.type.startsWith('image/')) return

    if (!user) {
      console.error('User not authenticated')
      return
    }

    setProcessingImage(true)

    try {
      const previewUrl = URL.createObjectURL(file)
      let originalUrl = previewUrl
      try {
        originalUrl = await uploadImageToStorage(file, user.id)
      } catch (uploadError) {
        console.warn('Upload failed, using local preview', uploadError)
      }

      const updatedMedia = [...(photoContent?.uploadedMedia || [])]
      const existing = updatedMedia[selectedMediaIndex]
      const id = existing?.id || Math.random().toString(36).substr(2, 9)

      updatedMedia[selectedMediaIndex] = {
        id,
        file,
        url: previewUrl,
        originalUrl: originalUrl,
        type: 'image',
        selectedVersionForPost: 'original'
      }

      setPhotoContent({
        uploadedMedia: updatedMedia,
        selectedMedia: null,
        isOriginal: true,
        photoAdjustments: null,
        carouselMode: false,
      })

      markAsChanged?.()
      setViewMode('original')
    } catch (error) {
      console.error('Error replacing image:', error)
      alert('Failed to replace image. Please try again.')
    } finally {
      setProcessingImage(false)
      // clear the input so same file can be selected again if needed
      if (event.target) event.target.value = ''
    }
  }

  const handleRemovePhoto = async (index: number) => {
    const currentMedia = photoContent?.uploadedMedia[index]

    // If this photo has an AI-enhanced version, only remove the AI edit — keep the original
    if (currentMedia?.adjustedUrl) {
      const updatedMedia = [...(photoContent?.uploadedMedia || [])]
      updatedMedia[index] = {
        ...currentMedia,
        adjustedUrl: undefined,
        selectedVersionForPost: 'original' as const,
      }
      setViewMode('original')
      setPhotoContent({
        ...(photoContent as PhotoContent),
        uploadedMedia: updatedMedia,
      })
      markAsChanged?.()
      await saveMediaToDatabase(updatedMedia)
      return
    }

    // No AI enhancement — remove the entire photo
    const updatedMedia = photoContent?.uploadedMedia.filter((_: MediaItem, i: number) => i !== index) || []
    
    setPhotoContent({
      uploadedMedia: updatedMedia,
      selectedMedia: null,
      isOriginal: true,
      photoAdjustments: null,
      // Keep carousel state; cover index may shift — clamp it
      carouselMode: updatedMedia.length >= 2 ? (photoContent?.carouselMode ?? false) : false,
      carouselTheme: photoContent?.carouselTheme,
      carouselGoal: photoContent?.carouselGoal,
      carouselCoverIndex: photoContent?.carouselCoverIndex !== undefined
        ? Math.min(photoContent.carouselCoverIndex, Math.max(0, updatedMedia.length - 1))
        : undefined,
    })

    markAsChanged?.()
    
    // Save updated media list to database
    await saveMediaToDatabase(updatedMedia)
    
    // Adjust selected index if necessary
    if (selectedMediaIndex >= updatedMedia.length) {
      setSelectedMediaIndex(Math.max(0, updatedMedia.length - 1))
    }
  }

  // ── Carousel handlers ───────────────────────────────────────────────────────

  const handleActivateCarousel = () => {
    setPhotoContent({ ...(photoContent as PhotoContent), carouselMode: true, carouselCoverIndex: 0 })
    setCarouselBannerDismissed(false)
  }

  const handleReorderMedia = (newOrder: MediaItem[]) => {
    setPhotoContent({
      ...(photoContent as PhotoContent),
      uploadedMedia: newOrder,
      carouselCoverIndex: 0,
    })
    markAsChanged?.()
  }

  const handleSetCover = (index: number) => {
    setPhotoContent({ ...(photoContent as PhotoContent), carouselCoverIndex: index })
    markAsChanged?.()
  }

  const handleCoverSelect = useCallback((coverUrl: string) => {
    const updatedMedia = (photoContent?.uploadedMedia || []).map((m, i) =>
      i === selectedMediaIndex ? { ...m, selectedCoverUrl: coverUrl } : m
    )
    setPhotoContent({ ...(photoContent as PhotoContent), uploadedMedia: updatedMedia })
    markAsChanged?.()
    saveMediaToDatabase(updatedMedia)
    // Persist to dedicated column for easy reading by the Graph API publishing Edge Function
    if (suggestionId && currentBusinessId) {
      void (async () => {
        const { data, error } = await (supabase as any)
          .from('daily_suggestions')
          .update({ cover_url: coverUrl })
          .eq('id', suggestionId)
          .eq('business_id', currentBusinessId)
          .select('id')

        if (error) {
          console.error('❌ Failed to save cover_url:', error)
          return
        }

        if (getAffectedRowCount(data) === 0) {
          console.warn(buildZeroRowAuditMessage('cover_url', currentBusinessId, Number(suggestionId)))
        }
      })()
    }
    // No warning needed: currentBusinessId loads asynchronously, save will happen when ready
  }, [photoContent, selectedMediaIndex, setPhotoContent, markAsChanged, saveMediaToDatabase, suggestionId, currentBusinessId])

  const handleClearAiSkip = (index: number) => {
    const updatedMedia = [...(photoContent?.uploadedMedia || [])]
    updatedMedia[index] = { ...updatedMedia[index], aiSkipSuggested: false }
    setPhotoContent({ ...(photoContent as PhotoContent), uploadedMedia: updatedMedia })
  }

  const handleSlideCaptionChange = (index: number, caption: string) => {
    const updatedMedia = [...(photoContent?.uploadedMedia || [])]
    updatedMedia[index] = { ...updatedMedia[index], slideCaption: caption }
    setPhotoContent({ ...(photoContent as PhotoContent), uploadedMedia: updatedMedia })
    markAsChanged?.()
  }

  const handleApplyOrganise = () => {
    if (!organiseResult || !photoContent) return
    const original = photoContent.uploadedMedia
    const reordered = organiseResult.suggestedOrder.map(i => original[i])
    const withFlags = reordered.map((m, i) => ({
      ...m,
      aiSkipSuggested: organiseResult.flaggedSkipIndices.includes(organiseResult.suggestedOrder[i]),
    }))
    setPhotoContent({
      ...(photoContent as PhotoContent),
      uploadedMedia: withFlags,
      carouselCoverIndex: organiseResult.coverIndex,
    })
    clearOrganiseResult()
    markAsChanged?.()
  }

  // Helper function to generate contextual upgrade text based on analysis
  const getUpgradePromptText = (): string => {
    const analysisResult = currentAnalysisResult
    // Check if we have analysis results with improvement categories
    if (
      analysisResult && 
      typeof analysisResult === 'object' &&
      'improvementCategories' in (analysisResult as object) && 
      (analysisResult as any).improvementCategories && 
      (analysisResult as any).improvementCategories.length > 0
    ) {
      // Map categories to localized improvement terms
      const improvements = (analysisResult as any).improvementCategories
        .slice(0, 2)
        .map((category: string) => t(`photoAnalysis.upgradePrompt.categories.${category}`))
        .filter(Boolean)
      
      if (improvements.length > 0) {
        const improvementText = improvements.join(', ')
        return t('photoAnalysis.upgradePrompt.withCategories', { improvements: improvementText })
      }
    }
    
    // Default text when no specific categories or no tips
    return t('photoAnalysis.upgradePrompt.default')
  }

  // Handle photo analysis with Gemini
  const handleAnalyzePhoto = async () => {
    const currentMedia = photoContent?.uploadedMedia[selectedMediaIndex]
    if (!currentMedia || !currentMedia.originalUrl) {
      console.error('No media or originalUrl available')
      return
    }

    console.log('Starting photo analysis for:', currentMedia.originalUrl)

    // Check if video can be analyzed (only ≤30 seconds)
    if (currentMedia.type === 'video' && currentMedia.canAnalyze === false) {
      const errorMsg = t('create.videoTooLong', { duration: Math.round(currentMedia.duration || 0) })
      console.warn(errorMsg)
      alert(errorMsg)
      return
    }

    // For FREE tier video analysis, check weekly quota (2 analyses per week)
    if (currentMedia.type === 'video' && currentTier === 'free') {
      try {
        const { data, error } = await supabase.functions.invoke('check-video-quota', {
          body: { userId: user?.id }
        })
        
        if (error || !data?.allowed) {
          alert(t('create.videoQuotaExceeded', { current: data?.current || 2, limit: data?.limit || 2 }))
          return
        }
      } catch (error) {
        console.error('Failed to check video quota:', error)
        // Allow analysis if quota check fails (graceful degradation)
      }
    }

    // Detect pixel dimensions client-side
    let imageWidth: number | undefined;
    let imageHeight: number | undefined;
    try {
      const blob = await fetch(currentMedia.originalUrl).then(r => r.blob())
      const blobUrl = URL.createObjectURL(blob)
      const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
        const img = new Image()
        img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(blobUrl) }
        img.onerror = () => { URL.revokeObjectURL(blobUrl); reject() }
        img.src = blobUrl
      })
      console.log('📐 Client-side image dimensions:', dims.w, '×', dims.h)
      imageWidth = dims.w;
      imageHeight = dims.h;
    } catch {
      // ignore
    }

    console.log('[CreateStep] Analyzing photo with language:', i18n.language)
    
    const result = await analyzePhoto(
      currentMedia.originalUrl,
      postContent?.text || '',
      undefined, // businessType - could be fetched from profile
      i18n.language, // language - dynamic based on user preference
      currentTier, // tier
      currentMedia.type, // mediaType - 'image' or 'video'
      currentMedia.duration, // duration in seconds (for videos)
      imageWidth,
      imageHeight,
      businessData.business?.id, // enables silent atmosphere extraction
    )

    if (result) {
      console.log('Analysis successful:', result)

      // Persist result on the MediaItem under the current context key
      const updatedMediaWithResult = [...(photoContent?.uploadedMedia || [])]
      updatedMediaWithResult[selectedMediaIndex] = {
        ...currentMedia,
        analysisCache: { ...(currentMedia.analysisCache || {}), [analysisContextKey]: result },
      }
      setPhotoContent({
        ...photoContent,
        uploadedMedia: updatedMediaWithResult,
      })
      
      // Increment video analysis quota for FREE tier after successful analysis
      if (currentMedia.type === 'video' && currentTier === 'free') {
        try {
          await supabase.functions.invoke('increment-video-quota', {
            body: { userId: user?.id }
          })
        } catch (quotaError) {
          console.warn('Failed to increment video quota:', quotaError)
          // Don't block the UI if quota increment fails
        }
      }
      
      // Save photo and analysis to daily_suggestions if we have a suggestion ID
      if (suggestionId && currentBusinessId) {
        console.log('💾 Attempting to save photo analysis for suggestion:', suggestionId)
        console.log('📸 Photo URL:', currentMedia.originalUrl)
        console.log('📊 Analysis data:', JSON.stringify(result, null, 2))
        
        try {
          const { data, error } = await (supabase as any)
            .from('daily_suggestions')
            .update({
              uploaded_photo_url: currentMedia.originalUrl,
              photo_analysis: result
            })
            .eq('id', suggestionId)
            .eq('business_id', currentBusinessId)
            .select()
          
          if (error) {
            console.error('❌ Failed to save photo analysis:', error)
            console.error('Error details:', JSON.stringify(error, null, 2))
          } else if (getAffectedRowCount(data) === 0) {
            console.warn(buildZeroRowAuditMessage('photo_analysis', currentBusinessId, Number(suggestionId)))
          } else {
            console.log('✅ Photo analysis saved to suggestion:', suggestionId)
            console.log('✅ Updated data:', data)
          }
        } catch (err) {
          console.error('❌ Exception while saving photo analysis:', err)
        }
      } else {
        console.warn('⚠️ No suggestionId provided - photo analysis not saved')
      }
    } else {
      console.error('Analysis failed - no result returned')
      alert(t('photoAnalysis.analysisError'))
    }
  }

  // Handler for applying multiple AI suggestions from photo analysis
  const handleApplySuggestion = async (suggestionId: string) => {
    await handleApplySelectedSuggestions([suggestionId])
  }

  const handleApplySelectedSuggestions = async (selectedIds: string[]) => {
    const currentMedia = photoContent?.uploadedMedia[selectedMediaIndex]
    if (!currentMedia || currentMedia.isProcessing || !currentMedia.originalUrl) {
      console.error('Cannot apply edits: invalid media state')
      return
    }

    // Get selected suggestions from analysis result
    const allSuggestions = (currentPhoto?.analysisCache?.[analysisContextKey] as any)?.suggestions as Suggestion[] | undefined
    if (!allSuggestions || selectedIds.length === 0) {
      console.error('No suggestions found or none selected')
      return
    }

    const selectedSuggestions = allSuggestions.filter(s => selectedIds.includes(s.id))
    console.log(`📸 Applying ${selectedSuggestions.length} AI edits to photo`, {
      suggestionIds: selectedIds,
      suggestions: selectedSuggestions
    })

    // Set processing state
    const updatedMedia = [...(photoContent?.uploadedMedia || [])]
    updatedMedia[selectedMediaIndex] = {
      ...currentMedia,
      isProcessing: true
    }
    setPhotoContent({
      ...photoContent,
      uploadedMedia: updatedMedia
    })

    try {
      // Capture the state before this enhancement for undo
      const urlBeforeEnhancement: string | null = currentMedia.adjustedUrl ?? null

      let workingUrl = currentMedia.adjustedUrl || currentMedia.originalUrl

      const result = await editPhoto(workingUrl, selectedSuggestions, i18n.language)
      if (result?.editedImage) workingUrl = result.editedImage

      // Upload the final image to Supabase Storage so it persists beyond this session
      // and is stored as a proper CDN URL rather than a raw base64 data URL in the DB.
      let persistedUrl = workingUrl
      if (workingUrl.startsWith('data:') || workingUrl.startsWith('blob:')) {
        try {
          persistedUrl = await uploadAdjustedImageToStorage(workingUrl, user!.id)
          console.log('✅ Adjusted image uploaded to Storage:', persistedUrl)
        } catch (uploadErr) {
          console.warn('⚠️ Could not upload adjusted image to Storage, falling back to data URL:', uploadErr)
          persistedUrl = workingUrl // fallback — still works, just not persisted
        }
      }

      // Update media with the final image (canvas-cropped and/or AI-edited)
      updatedMedia[selectedMediaIndex] = {
        ...currentMedia,
        adjustedUrl: persistedUrl,
        adjustedUrlHistory: [...(currentMedia.adjustedUrlHistory || []), urlBeforeEnhancement],
        isProcessing: false,
        selectedVersionForPost: 'adjusted'
      }

      setPhotoContent({
        ...photoContent,
        uploadedMedia: updatedMedia
      })

      // Switch to adjusted view
      setViewMode('adjusted')

      // Mark as changed
      markAsChanged?.()

    } catch (error: any) {
      console.error('❌ AI photo editing failed:', error)
      
      // Reset processing state
      updatedMedia[selectedMediaIndex] = {
        ...currentMedia,
        isProcessing: false
      }
      setPhotoContent({
        ...photoContent,
        uploadedMedia: updatedMedia
      })

      // Check if error is tier restriction
      const errorMsg = error.message || String(error)
      if (errorMsg.includes('Smart') || errorMsg.includes('Pro') || errorMsg.includes('abonnement')) {
        // Show upgrade modal for tier restriction
        setShowUpgradeModal('photo-picker')
      } else {
        // Show generic error for other failures
        alert(errorMsg || t('create.photoEditFailed'))
      }
    }
  }

  const handleUndoEdit = () => {
    const currentMedia = photoContent?.uploadedMedia[selectedMediaIndex]
    // Guard: nothing to undo if there's neither an adjusted URL nor any history
    if (!currentMedia || (!currentMedia.adjustedUrlHistory?.length && !currentMedia.adjustedUrl)) return
    const history = [...(currentMedia.adjustedUrlHistory || [])]
    // If history exists, pop the previous state; otherwise we're undoing from
    // an enhanced state that has no history (e.g. re-entered Design after applying)
    // — fall back to clearing the adjustment entirely.
    const previousState = history.length > 0 ? (history.pop() ?? null) : null
    const updatedMedia = [...(photoContent?.uploadedMedia || [])]
    updatedMedia[selectedMediaIndex] = {
      ...currentMedia,
      adjustedUrl: previousState ?? undefined,
      adjustedUrlHistory: history,
      selectedVersionForPost: previousState ? 'adjusted' : 'original',
    }
    setPhotoContent({ ...photoContent!, uploadedMedia: updatedMedia })
    if (!previousState) setViewMode('original')
  }

  const handleCropConfirm = async (dataUrl: string) => {
    setShowCropOverlay(false)
    const currentMedia = photoContent?.uploadedMedia[selectedMediaIndex]
    if (!currentMedia) return
    let persistedUrl: string = dataUrl
    try {
      persistedUrl = await uploadAdjustedImageToStorage(dataUrl, user!.id)
    } catch {
      // fallback to data URL
    }
    const updatedMedia = [...(photoContent?.uploadedMedia || [])]
    updatedMedia[selectedMediaIndex] = {
      ...currentMedia,
      adjustedUrl: persistedUrl,
      adjustedUrlHistory: [...(currentMedia.adjustedUrlHistory || []), currentMedia.adjustedUrl ?? null],
      selectedVersionForPost: 'adjusted',
    }
    setPhotoContent({ ...photoContent, uploadedMedia: updatedMedia })
    setViewMode('adjusted')
    markAsChanged?.()
  }

  const handleSelectVersionForPost = (version: 'original' | 'adjusted') => {
    const currentMedia = photoContent?.uploadedMedia[selectedMediaIndex]
    if (currentMedia) {
      const updatedMedia = [...(photoContent?.uploadedMedia || [])]
      updatedMedia[selectedMediaIndex] = {
        ...currentMedia,
        selectedVersionForPost: version
      }
      setPhotoContent({
        ...photoContent,
        uploadedMedia: updatedMedia
      })
    }
  }

  // Computed values
  const hasPhoto = photoContent?.uploadedMedia && photoContent.uploadedMedia.length > 0
  const currentPhoto = photoContent?.uploadedMedia?.[selectedMediaIndex]

  // Stable key for the current text-idea context — analysis is cached per-key on MediaItem
  const analysisContextKey = activePath === 'ai-ideas'
    ? `ai-ideas:${selectedIdea ?? 'none'}`
    : activePath === 'weekly-plan'
    ? `weekly-plan:${weeklyPlanPostIndex}`
    : 'write'

  // The analysis that belongs to the current context (undefined if context changed since last analysis)
  const currentAnalysisResult = currentPhoto?.analysisCache?.[analysisContextKey] as any

  // Media suggestion: best available source per active path
  const mediaFormat = strategicIdea?.platformFormat || weeklyPlanSuggestion?.platformFormat
  const isReelFormat = ['reel', 'video', 'story', 'short_video'].includes((mediaFormat ?? '').toLowerCase())
  const mediaEmoji = isReelFormat ? '🎬' : '📷'
  const mediaSuggestionStructured = activePath === 'weekly-plan' && (
    weeklyPlanSuggestion?.visualSubject || weeklyPlanSuggestion?.visualAngle || weeklyPlanSuggestion?.visualSetting
  ) ? {
    subject: weeklyPlanSuggestion?.visualSubject,
    angle: weeklyPlanSuggestion?.visualAngle,
    setting: weeklyPlanSuggestion?.visualSetting,
  } : null

  return (
    <div className="space-y-4">

      {/* ── Weekly Plan idea tab strip ── */}
      {weeklyContentPlan && onSwitchIdea && weeklyContentPlan.posts.length > 1 && (
        <div className="bg-white rounded-lg border border-gray-200 px-3 py-2 shadow-sm overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max">
            <span className="text-xs text-gray-400 font-medium shrink-0 mr-1">{t('create.ideasInPlan')}</span>
            {weeklyContentPlan.posts.map((post, idx) => {
              const isCurrent = idx === weeklyPlanPostIndex
              const hasDraft = !isCurrent && draftMap[idx] != null
              const isDone = weeklyPlanSessionDone.includes(idx)
              const day = post.timing.day.slice(0, 3)
              const dish = post.contentSubject.dish
              const label = `${day} · ${dish.length > 20 ? dish.slice(0, 20) + '…' : dish}`
              return (
                <button
                  key={idx}
                  onClick={() => !isCurrent && onSwitchIdea(idx)}
                  title={dish}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all whitespace-nowrap ${
                    isCurrent
                      ? 'bg-cta-surface border-cta text-cta-text cursor-default shadow-sm'
                      : hasDraft
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100 cursor-pointer'
                        : isDone
                          ? 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100 cursor-pointer'
                          : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100 hover:border-gray-300 cursor-pointer'
                  }`}
                >
                  {isCurrent && (
                    <span className="w-1.5 h-1.5 rounded-full bg-cta shrink-0" />
                  )}
                  {!isCurrent && isDone && (
                    <span className="text-green-600 leading-none">✓</span>
                  )}
                  {!isCurrent && hasDraft && !isDone && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  )}
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Two Column Layout - tighter spacing, columns aligned to top */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-y-4 gap-x-4 items-start">
        
        {/* LEFT: AI Analysis & Enhancement */}
        <div className="space-y-3">
          
          {/* Media suggestion - always show when there's a specific suggestion; generic tip only before upload */}
          {(mediaSuggestionStructured || (photoIdea && photoIdea.trim().length > 0) || (!hasPhoto && activePath === 'write')) && (
            mediaSuggestionStructured ? (
              <div className="border border-[#D1D5DB] rounded-xl bg-white shadow-sm overflow-hidden">
                <button
                  onClick={() => setPhotoIdeaOpen(o => !o)}
                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 transition-colors"
                >
                  <h4 className="text-xs font-semibold text-brand uppercase tracking-wide">
                    {mediaEmoji} {t('create.mediaIdeaFromPlan')}
                  </h4>
                  <span className="text-slate-400 text-xs">{photoIdeaOpen ? '▲' : '▼'}</span>
                </button>
                {photoIdeaOpen && (
                  <div className="bg-gray-50 px-3 pb-2.5 space-y-1.5">
                    {(mediaSuggestionStructured.subject || '').split(/\s*\|\s*|\s+(?=[A-ZÆØÅ])(?<=[.!?]\s)/)
                      .flatMap((s: string) => s.split(/(?<=[.!?])\s+(?=[A-ZÆØÅ])/))
                      .map((s: string) => s.trim())
                      .filter((s: string) => s.length > 0)
                      .map((step: string, i: number) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-xs font-semibold text-brand shrink-0 mt-0.5 w-4">{i + 1}.</span>
                          <p className="text-sm text-[#374151] leading-snug">{step}</p>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            ) : photoIdea && photoIdea.trim().length > 0 ? (
              <div className="border border-[#D1D5DB] rounded-xl bg-white shadow-sm overflow-hidden">
                <button
                  onClick={() => setPhotoIdeaOpen(o => !o)}
                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 transition-colors"
                >
                  <h4 className="text-xs font-semibold text-brand uppercase tracking-wide">
                    {mediaEmoji} {t('create.mediaIdea')}
                  </h4>
                  <span className="text-slate-400 text-xs">{photoIdeaOpen ? '▲' : '▼'}</span>
                </button>
                {photoIdeaOpen && (
                  <div className="bg-gray-50 px-3 pb-2.5 space-y-1.5">
                    {photoIdea
                      .split(/(?<=[.!?])\s+(?=[A-ZÆØÅ])/)
                      .filter((s: string) => s.trim().length > 0)
                      .map((step: string, i: number) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-xs font-semibold text-brand shrink-0 mt-0.5 w-4">{i + 1}.</span>
                          <p className="text-sm text-[#374151] leading-snug">{step.trim()}</p>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            ) : !hasPhoto && activePath === 'write' ? (
              <div className="p-3 border border-[#D1D5DB] rounded-xl bg-white shadow-sm">
                <p className="text-xs text-[#6B7280]">
                  💡 {t('create.photoTip', 'Tip: Billeder og videoer af høj kvalitet får mere engagement.')}
                </p>
              </div>
            ) : null
          )}

          {/* Photo Analysis Button - Available for all tiers */}
          {hasPhoto && currentPhoto && (
            <div className="p-3 bg-white border border-slate-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-800">{t('photoAnalysis.title')}</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAnalyzePhoto}
                    disabled={isAnalyzing}
                  className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-cta text-white rounded-lg text-xs font-medium hover:from-purple-700 hover:to-cta-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
                >
                  {isAnalyzing ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{t('photoAnalysis.analyzing')}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3" />
                      <span>{currentAnalysisResult ? t('photoAnalysis.reanalyzeButton') : t('photoAnalysis.analyzeButton')}</span>
                    </>
                  )}
                </button>
                </div>
              </div>
              {analysisError && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-xs text-red-700">{t('create.errorPrefix', { error: analysisError })}</p>
                </div>
              )}
              {currentAnalysisResult && (
                <div className="mt-3 space-y-3">
                  <MediaAnalysisPanel
                    analysis={{
                      contentMatch: (currentAnalysisResult as any).contentMatch,
                      emojiMatch: (currentAnalysisResult as any).emojiMatch ?? null,
                      whatWorks: (currentAnalysisResult as any).whatWorks,
                      generalFeedback: (currentAnalysisResult as any).generalFeedback || (currentAnalysisResult as any).overallFeedback || '',
                      suggestions: (currentAnalysisResult as any).suggestions || [],
                      humanSuggestions: (currentAnalysisResult as any).humanSuggestions || [],
                      recommendation: (currentAnalysisResult as any).recommendation,
                      recommendationText: (currentAnalysisResult as any).recommendationText,
                    }}
                    tier={currentTier}
                    onApply={handleApplySuggestion}
                    onApplyBatch={handleApplySelectedSuggestions}
                    isProcessing={currentPhoto?.isProcessing || isEditing}
                    hasAdjustedVersion={!!(currentPhoto?.adjustedUrl)}
                    mediaType={currentPhoto?.type}
                    onUndo={handleUndoEdit}
                    canUndo={!!(currentPhoto?.adjustedUrlHistory?.length) || !!(currentPhoto?.adjustedUrl)}
                    onEditText={() => setCaptionEditOpen(true)}
                    onChangePhoto={() => changePhotoInputRef.current?.click()}
                  />
                  <input
                    ref={changePhotoInputRef}
                    type="file"
                    accept="image/*,video/mp4,video/quicktime,video/x-m4v"
                    className="hidden"
                    onChange={_handleReplacePhoto}
                  />
                </div>
              )}
            </div>
          )}

          {/* Upgrade Prompt - show for Free users ONLY when photo exists */}
          {hasPhoto && currentTier === 'free' && (
            <div className="p-2 bg-white border border-slate-200 rounded-lg">
                <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-slate-700 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-slate-700 leading-tight mb-1">
                    {getUpgradePromptText()}
                    <br />{t('photoAnalysis.upgradePrompt.ctaText')}
                  </p>
                  <button
                    onClick={() => setShowUpgradeModal('photo-picker')}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900 underline transition-colors"
                  >
                    {t('photoAnalysis.upgradePrompt.upgradeButton')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Video Cover Selector — Smart / Pro only, video only */}
          {hasPhoto && currentPhoto?.type === 'video' && currentTier !== 'free' && (
            <VideoCoverSelector
              candidates={currentPhoto.coverCandidates || []}
              selectedUrl={currentPhoto.selectedCoverUrl}
              isExtracting={isExtractingCover}
              onSelect={handleCoverSelect}
            />
          )}

          {/* Photo Upload Manager */}
          <PhotoUploadManager
            uploadedMedia={photoContent?.uploadedMedia || []}
            selectedMediaIndex={selectedMediaIndex}
            onPhotoUpload={handlePhotoUpload}
            onReplacePhoto={_handleReplacePhoto}
            onRemovePhoto={handleRemovePhoto}
            onSelectMedia={setSelectedMediaIndex}
            processingImage={_processingImage}
            carouselMode={photoContent?.carouselMode ?? false}
            carouselCoverIndex={photoContent?.carouselCoverIndex ?? 0}
            onReorderMedia={handleReorderMedia}
            onSetCover={handleSetCover}
            onClearAiSkip={handleClearAiSkip}
            onSlideCaptionChange={handleSlideCaptionChange}
          />

          {/* Select from Media Gallery Button */}
          {currentBusinessId && (photoContent?.uploadedMedia?.length || 0) < maxPhotos && (
            <div className="mt-3">
              <button
                onClick={() => setMediaGalleryOpen(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors text-sm font-medium text-gray-700 hover:text-blue-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>Select from Media Gallery</span>
              </button>
            </div>
          )}

          {/* Carousel Activation Banner */}
          {TIER_QUOTAS[currentTier].carousel.enabled &&
            !photoContent?.carouselMode &&
            !carouselBannerDismissed &&
            (photoContent?.uploadedMedia?.length ?? 0) >= 2 && (
            <CarouselActivationBanner
              onActivate={handleActivateCarousel}
              onDismiss={() => setCarouselBannerDismissed(true)}
            />
          )}

          {/* Carousel Setup (theme, goal, AI organise) */}
          {TIER_QUOTAS[currentTier].carousel.enabled && photoContent?.carouselMode && photoContent && (
            <CarouselSetup
              photoContent={photoContent}
              onThemeSelect={(theme) => setPhotoContent({ ...(photoContent as PhotoContent), carouselTheme: theme })}
              onGoalSelect={(goal) => setPhotoContent({ ...(photoContent as PhotoContent), carouselGoal: goal })}
              onOrganise={() => organise({
                mediaItems: photoContent.uploadedMedia,
                theme: photoContent.carouselTheme,
                goal: photoContent.carouselGoal,
                language: i18n.language,
              })}
              isOrganising={isOrganising}
              organiseResult={organiseResult}
              onApplyOrganise={handleApplyOrganise}
              onDismissOrganise={clearOrganiseResult}
              dragAndDropEnabled={TIER_QUOTAS[currentTier].carousel.dragAndDrop}
              goalEnabled={TIER_QUOTAS[currentTier].carousel.goalBased}
            />
          )}

        </div>

        {/* RIGHT: Platform Preview */}
        <div className="space-y-3 sticky top-4 self-start">
          {/* Continue to Udgiv Button */}
          <button
            onClick={onNext}
            className="w-full px-6 py-3 bg-cta text-text-inverse rounded-lg hover:bg-cta-hover transition-all font-semibold text-sm shadow-md flex items-center justify-center gap-2"
          >
            <span>{t('create.continue', 'Fortsæt til Udgiv')}</span>
            <ChevronRight className="w-5 h-5" />
          </button>

          <PlatformSelector
            currentTier={currentTier}
            selectedPlatforms={selectedPlatforms}
            onSelectPlatforms={(platforms: string[]) => setSelectedPlatforms(platforms as ('facebook' | 'instagram')[])}
            activePlatform={previewPlatform}
            onActivePlatformChange={(platform: string) => setPreviewPlatform(platform as 'facebook' | 'instagram')}
            availablePlatforms={enabledPlatforms as ('facebook' | 'instagram')[]}
          />

            <div className="relative">
              {hasPhoto && currentPhoto && currentPhoto.type !== 'video' && (
                <button
                  onClick={() => setShowCropOverlay(true)}
                  className="absolute top-2 right-2 z-10 px-2.5 py-1.5 bg-white/90 backdrop-blur-sm border border-slate-300 text-slate-700 rounded-lg text-xs font-medium hover:bg-white transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path d="M6 2v14a2 2 0 002 2h14"/><path d="M18 22V8a2 2 0 00-2-2H2"/>
                  </svg>
                  <span>{t('create.crop')}</span>
                </button>
              )}

              <PlatformPreview
                selectedPlatforms={selectedPlatforms}
                previewPlatform={previewPlatform}
                onPreviewPlatformChange={setPreviewPlatform}
                content={{
                  ...platformPreviewContent,
                  hashtags: platformPreviewContent.hashtags || [],
                  adjustments: {
                    ...content.adjustments,
                    includeHashtags: platformPreviewContent.adjustments?.includeHashtags ?? true
                  }
                }}
                uploadedMedia={photoContent?.uploadedMedia || []}
                selectedMediaIndex={selectedMediaIndex}
                onMediaIndexChange={setSelectedMediaIndex}
                onSelectVersionForPost={handleSelectVersionForPost}
                currentTier={currentTier}
                businessName={businessData.business?.name || undefined}
                onEditCaption={() => setCaptionEditOpen(true)}
                onEditHashtags={() => setHashtagEditOpen(true)}
                platformFormat={strategicIdea?.platformFormat}
                carouselMode={photoContent?.carouselMode ?? false}
              />
            </div>
        </div>
      </div>

      {/* Separator line */}
      <div className="border-t border-[#D1D5DB] mt-4"></div>

      {/* Sticky Bottom Bar */}
      <div className="flex items-center justify-start pt-2 pb-4">
        <button
          onClick={onBack}
          className="px-4 py-2 text-xs font-medium text-[#374151] bg-white border border-[#D1D5DB] rounded-lg hover:bg-[#F9FAFB] transition-colors flex items-center gap-1.5"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>{t('create.back', 'Tilbage')}</span>
        </button>
      </div>

      {showCropOverlay && currentPhoto && (currentPhoto.adjustedUrl || currentPhoto.originalUrl) && (
        <CropOverlay
          imageUrl={currentPhoto.adjustedUrl || currentPhoto.originalUrl!}
          onConfirm={handleCropConfirm}
          onCancel={() => setShowCropOverlay(false)}
        />
      )}

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal !== null}
        onClose={() => setShowUpgradeModal(null)}
        feature={showUpgradeModal || 'photo-picker'}
      />

      {/* Caption Edit Modal */}
      <CaptionEditModal
        isOpen={captionEditOpen}
        onClose={() => setCaptionEditOpen(false)}
        onSave={handleCaptionSave}
        initialText={platformPreviewContent.text || ''}
        currentTier={currentTier}
        language={i18n.language}
        businessId={businessData.business?.id || undefined}
      />

      {/* Hashtag Edit Modal */}
      <HashtagEditModal
        isOpen={hashtagEditOpen}
        onClose={() => setHashtagEditOpen(false)}
        onSave={handleHashtagSave}
        sharedHashtags={postContent?.hashtags || []}
        platformHashtags={postContent?.platformContent ? {
          facebook: postContent.platformContent['facebook']?.hashtags || [],
          instagram: postContent.platformContent['instagram']?.hashtags || []
        } : {}}
        selectedPlatforms={selectedPlatforms}
        isPlatformSpecific={postContent?.platformSpecific || false}
      />

      {/* Media Gallery Modal */}
      {currentBusinessId && (
        <MediaGalleryModal
          businessId={currentBusinessId}
          isOpen={mediaGalleryOpen}
          onClose={() => setMediaGalleryOpen(false)}
          onSelectMedia={handleSelectFromGallery}
          selectionMode={true}
        />
      )}

    </div>
  )
}
