import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { usePostCreationStore, type PlatformContent } from '../../stores/postCreationStore'
import { useConnectionsStore } from '../../stores/connectionsStore'
import { useTierStore } from '../../stores/tierStore'
import { TIER_QUOTAS } from '../../config/quotas'
import { ManualPostModal } from './publish/ManualPostModal'
import { ScheduledPostModal } from './ScheduledPostModal'
import { savePublishedPost, updatePublishedPost, deletePublishedPost } from '../../hooks/usePosts'
import { useBusinessData } from '../../hooks/useBusinessData'
import { uploadToMediaLibrary, type PostType } from '../../api/mediaLibrary'
import { usePosts } from '../../hooks/usePosts'
import type { LoadedPost } from '../../hooks/usePosts'

import { ScheduleCalendarPicker } from './publish/ScheduleCalendarPicker'
import { ScheduleTimeline } from './publish/ScheduleTimeline'
import { usePublishTimeline } from './publish/usePublishTimeline'
import { useScheduleData } from './publish/useScheduleData'
import { Calendar, Send, TrendingUp, ChevronLeft, ChevronRight, Sun, Users, Link2, Sparkles } from './publish/icons'
import {
  formatPlatformList,
  getPlatformLabel,
  buildPlatformPreviewContent
} from './publish/utils'
import { PostCreationFooter } from './shared/PostCreationFooter'
import { PostFrame } from './PostFrame'
import { PostModal } from './PostModal'
import type { PostStatus, Platform } from './PostFrame'

const DEFAULT_MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]

const DEFAULT_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface PublishStepProps {
  onNext: () => void
  onBack: () => void
  onStepClick?: (step: number) => void
  markAsSaved?: () => void
  hasUnsavedChanges?: boolean
  onViewCalendar?: () => void
  /** Navigate back to the weekly plan page after publish (weekly-plan path only) */
  onBackToPlan?: () => void
  /** Called after a successful publish — lifts success state to parent without clearing store */
  onPublishSuccess?: (info: SuccessInfo) => void
  /** Pre-existing success info — restores the success screen when navigating back to Udgiv */
  publishedInfo?: SuccessInfo | null
  /** Called after the user cancels/deletes the scheduled post — parent should clear publishedInfo + refresh badges */
  onPublishDeleted?: () => void
  /** Draft metadata restored from posts table for the current publish flow */
  restoredDbDraft?: { suggestedPostDatetime: string | null } | null
}

export interface SuccessInfo {
  mode: 'now' | 'schedule'
  scheduledAt: Date | null
  platforms: string[]
  /** DB row IDs of the saved published_posts rows — used to delete/cancel the post */
  publishedPostIds: string[]
}

export function PublishStep({ onNext, onBack, markAsSaved, hasUnsavedChanges, onViewCalendar, onBackToPlan, onPublishSuccess, publishedInfo, onPublishDeleted, restoredDbDraft }: PublishStepProps) {
  const { t: tPublish, i18n } = useTranslation(undefined, { keyPrefix: 'createPost.publish' })
  const { postContent, selectedPlatforms, photoContent, photoIdea, selectedIdea, aiIdeas, weeklyPlanPost, postCta, activePath, weeklyPlanPostIndex, addWeeklyPlanSessionDone, selectedSuggestionData } = usePostCreationStore()
  const { isConnected } = useConnectionsStore()
  const { business } = useBusinessData()
  const { 
    canSchedulePost, 
    incrementScheduledPost,
    currentTier,
    quotaUsage
  } = useTierStore()

  // TODO: Replace placeholder schedule data hook once backend timeline API is wired up.
  const { recentPosts, futurePosts, refresh: refreshTimeline } = useScheduleData()
  const calendarDayPosts = useMemo(() => [...recentPosts, ...futurePosts], [recentPosts, futurePosts])

  const [selectedDate, setSelectedDate] = useState<Date | null>(() => {
    const now = new Date()
    return now
  })
  const [selectedHour, setSelectedHour] = useState<string>(() =>
    String(new Date().getHours()).padStart(2, '0')
  )
  const [selectedMinute, setSelectedMinute] = useState<string>(() => {
    const mins = new Date().getMinutes()
    // Round up to next 15-min boundary for a clean default
    const rounded = Math.ceil(mins / 15) * 15
    return String(rounded >= 60 ? 0 : rounded).padStart(2, '0')
  })
  const [scheduleFromPlan, setScheduleFromPlan] = useState(false)
  const [successInfo, setSuccessInfo] = useState<SuccessInfo | null>(publishedInfo ?? null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isDeletingPost, setIsDeletingPost] = useState(false)

  // Pre-populate schedule from Weekly Plan timing (runs once on mount)
  useEffect(() => {
    if (!weeklyPlanPost?.timing?.date) return
    try {
      const [y, m, d] = weeklyPlanPost.timing.date.split('-').map(Number)
      // Parse time: handle "18:00", "18:00-21:00", "6 PM" formats
      let hour = 12
      let minute = 0
      const rawTime = weeklyPlanPost.timing.time || ''
      const timeMatch = rawTime.match(/(\d{1,2}):(\d{2})/)
      if (timeMatch) {
        hour = parseInt(timeMatch[1], 10)
        minute = parseInt(timeMatch[2], 10)
      } else {
        const hourOnlyMatch = rawTime.match(/(\d{1,2})\s*(am|pm)?/i)
        if (hourOnlyMatch) {
          hour = parseInt(hourOnlyMatch[1], 10)
          if (hourOnlyMatch[2]?.toLowerCase() === 'pm' && hour < 12) hour += 12
        }
      }
      const date = new Date(y, m - 1, d, hour, minute)
      if (!isNaN(date.getTime())) {
        setSelectedDate(date)
        setSelectedHour(String(hour).padStart(2, '0'))
        setSelectedMinute(String(minute).padStart(2, '0'))
        setScheduleFromPlan(true)
      }
    } catch {
      // Silently ignore parse errors — user can pick manually
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-populate time from Quick Suggestions suggestedTime (runs once on mount)
  useEffect(() => {
    if (!selectedSuggestionData?.suggestedTime || scheduleFromPlan) return
    try {
      const timeMatch = selectedSuggestionData.suggestedTime.match(/(\d{1,2}):(\d{2})/)
      if (timeMatch) {
        const hour = parseInt(timeMatch[1], 10)
        const minute = parseInt(timeMatch[2], 10)
        setSelectedHour(String(hour).padStart(2, '0'))
        setSelectedMinute(String(minute).padStart(2, '0'))
        console.log('[PublishStep] Pre-filled time from Quick Suggestion:', selectedSuggestionData.suggestedTime)
      }
    } catch {
      // Silently ignore parse errors
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [isPublishing, setIsPublishing] = useState(false)
  const isSavingRef = useRef(false) // ref-based guard — prevents double-save from rapid/double clicks
  // platform -> saved row id, so re-saves UPDATE instead of INSERT
  const savedPostIds = useRef<Record<string, string>>({})

  // Per-platform publish toggles — user can deselect a platform before committing
  // Initialised from selectedPlatforms; resets whenever the outer selection changes
  const [publishPlatforms, setPublishPlatforms] = useState<string[]>(selectedPlatforms)
  useEffect(() => { setPublishPlatforms(selectedPlatforms) }, [selectedPlatforms])
  // const [schedulingConflicts, setSchedulingConflicts] = useState<string[]>([])
  const [showManualPostModal, setShowManualPostModal] = useState(false)
  const [copiedPlatform, setCopiedPlatform] = useState<string | null>(null)
  
  // Scheduled post modal state
  const [showScheduledPostModal, setShowScheduledPostModal] = useState(false)
  const [selectedScheduledPostId, setSelectedScheduledPostId] = useState<string | null>(null)

  // Find the selected AI idea to access CTA data
  const selectedAiIdea = useMemo(() => {
    if (selectedIdea && aiIdeas && aiIdeas.length > 0) {
      return aiIdeas.find(idea => idea.id === selectedIdea)
    }
    return null
  }, [selectedIdea, aiIdeas])

  const unconnectedPlatforms = useMemo(
    () => publishPlatforms.filter((platform) => !isConnected(platform)),
    [selectedPlatforms, isConnected]
  )

  const isPlatformConnected = useCallback((platform: string) => isConnected(platform), [isConnected])

  const selectedDateTime = useMemo(() => {
    if (!selectedDate) return null
    const date = new Date(selectedDate)
    date.setHours(Number(selectedHour), Number(selectedMinute), 0, 0)
    return date
  }, [selectedDate, selectedHour, selectedMinute])

  const selectedTimeIsTooOldForSchedule = useMemo(() => {
    if (!selectedDateTime) return true
    return (selectedDateTime.getTime() - Date.now()) <= 2 * 60 * 1000
  }, [selectedDateTime])

  // ── New Timeline State: Unified view of all posts ──
  const posts = usePosts()
  const [allPosts, setAllPosts] = useState<LoadedPost[]>([])
  const [selectedPost, setSelectedPost] = useState<any | null>(null)
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(true)

  // Load all posts for the timeline (drafts + scheduled + published)
  const loadTimelineData = useCallback(async () => {
    if (!business?.id) return
    setIsLoadingTimeline(true)
    try {
      // Load all posts in one query
      const allPostsData = await posts.loadAllPosts(business.id, ['draft', 'scheduled', 'published'])
      setAllPosts(allPostsData)
    } catch (error) {
      console.error('[PublishStep] Error loading posts:', error)
    } finally {
      setIsLoadingTimeline(false)
    }
  }, [business?.id]) // Removed 'posts' from deps - it's a stable hook reference

  // Load timeline on mount
  useEffect(() => {
    loadTimelineData()
  }, [loadTimelineData])

  // Determine sibling post (other platform) for "Apply to both" checkbox
  const getSiblingPost = useCallback((post: any) => {
    if (!post) return null
    const otherPlatform = post.platform === 'facebook' ? 'instagram' : 'facebook'
    
    // Find sibling post in unified allPosts array
    const sibling = allPosts.find(
      p => p.platform === otherPlatform && 
           p.ideaSource === post.ideaSource &&
           p.suggestionId === post.suggestionId &&
           p.weeklyPlanSlotDate === post.weeklyPlanSlotDate
    )
    
    return sibling ? { id: sibling.id, platform: otherPlatform } : null
  }, [allPosts])

  // Modal action handlers
  const handleTimelinePostNow = useCallback(async (postId: string, applyToBoth: boolean) => {
    // TODO: Implement post now logic
    console.log('[PublishStep] Post now:', postId, 'applyToBoth:', applyToBoth)
    await loadTimelineData()
  }, [loadTimelineData])

  const handleReschedule = useCallback(async (postId: string, newTime: string, applyToBoth: boolean) => {
    // TODO: Implement reschedule logic
    console.log('[PublishStep] Reschedule:', postId, 'newTime:', newTime, 'applyToBoth:', applyToBoth)
    await loadTimelineData()
  }, [loadTimelineData])

  const handleDeletePost = useCallback(async (postId: string, applyToBoth: boolean) => {
    // TODO: Implement delete logic
    console.log('[PublishStep] Delete:', postId, 'applyToBoth:', applyToBoth)
    await loadTimelineData()
  }, [loadTimelineData])

  const handleUpdateText = useCallback(async (postId: string, newText: string, applyToBoth: boolean) => {
    // TODO: Implement update text logic
    console.log('[PublishStep] Update text:', postId, 'newText:', newText, 'applyToBoth:', applyToBoth)
    await loadTimelineData()
  }, [loadTimelineData])

  const selectedPublishMode: 'now' | 'schedule' = selectedTimeIsTooOldForSchedule ? 'now' : 'schedule'
  const scheduleDisabledReason = selectedTimeIsTooOldForSchedule
    ? 'Vælg en ny tid før du kan planlægge'
    : undefined

  const hasPersistedDraft = useMemo(() => {
    if (postContent) {
      const trimmedHeadline = (postContent.headline ?? '').trim()
      const trimmedText = (postContent.text ?? '').trim()

      if (trimmedHeadline.length > 0 || trimmedText.length > 0) {
        return true
      }

      if (postContent.platformSpecific && postContent.platformContent) {
        const hasPlatformContent = Object.values(postContent.platformContent as Record<string, PlatformContent>).some((content) => {
          const platformHeadline = (content.headline ?? '').trim()
          const platformText = (content.text ?? '').trim()
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

  const monthNames = useMemo(() => {
    const resource = i18n.getResource(i18n.language, 'translation', 'publish.monthNames') as unknown

    if (Array.isArray(resource)) {
      const normalized = resource.filter((name): name is string => typeof name === 'string' && name.trim().length > 0)
      if (normalized.length === 12) {
        return normalized
      }
    }

    if (typeof resource === 'string') {
      const parts = resource.split(',').map((part) => part.trim()).filter(Boolean)
      if (parts.length === 12) {
        return parts
      }
    }

    return DEFAULT_MONTH_NAMES
  }, [i18n, i18n.language])

  const dayNames = useMemo(() => {
    const resource = i18n.getResource(i18n.language, 'translation', 'publish.dayNames') as unknown

    if (Array.isArray(resource)) {
      const normalized = resource.filter((name): name is string => typeof name === 'string' && name.trim().length > 0)
      if (normalized.length === 7) {
        return normalized
      }
    }

    if (typeof resource === 'string') {
      const parts = resource.split(',').map((part) => part.trim()).filter(Boolean)
      if (parts.length === 7) {
        return parts
      }
    }

    return DEFAULT_DAY_NAMES
  }, [i18n, i18n.language])

  const timeInterval = useMemo(() => {
    const resource = i18n.getResource(i18n.language, 'translation', 'publish.timeIntervalMinutes')
    const parsed = Number(resource)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 30
  }, [i18n, i18n.language])

  const updateSelectedSuggestionStatus = useCallback(async (status: 'selected' | 'consumed' | 'published') => {
    if (!selectedSuggestionData?.id || !business?.id) return

    const nowIso = new Date().toISOString()
    const updates: Record<string, unknown> = {
      status,
    }

    if (status === 'selected') updates.selected_at = nowIso
    if (status === 'consumed') updates.consumed_at = nowIso
    if (status === 'published') updates.published_at = nowIso

    const { error } = await (supabase as any)
      .from('daily_suggestions')
      .update(updates)
      .eq('id', selectedSuggestionData.id)
      .eq('business_id', business.id)

    if (error) {
      console.warn('[PublishStep] Failed to update suggestion status:', error)
    }
  }, [business?.id, selectedSuggestionData?.id])

  // Helper function to format relative date/time
  const formatRelativeDateTime = useCallback((date: Date): string => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const targetDate = new Date(date)
    targetDate.setHours(0, 0, 0, 0)
    
    const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    
    if (targetDate.getTime() === today.getTime()) {
      return `${tPublish('today', 'Today')}, ${timeStr}`
    }

    if (targetDate.getTime() === tomorrow.getTime()) {
      return `${tPublish('tomorrow', 'Tomorrow')}, ${timeStr}`
    }

    const dayName = dayNames[date.getDay()]
    return `${dayName}, ${timeStr}`
  }, [dayNames, tPublish])

  // Get formatted content for platform
  const getFormattedContent = useCallback(
    (platform: string) => {
      const preview = buildPlatformPreviewContent(postContent, platform, selectedPlatforms)

      if (!preview) {
        return ''
      }

      const { headline, textWithHashtags } = preview
      
      // Build the base content
      let content = ''
      if (headline && textWithHashtags) {
        content = `${headline}\n\n${textWithHashtags}`
      } else if (headline) {
        content = headline
      } else {
        content = textWithHashtags
      }

      // For Facebook: Add CTA and booking URL from V2 API if available
      if (platform.toLowerCase() === 'facebook' && selectedAiIdea?._cta) {
        const cta = selectedAiIdea._cta
        
        // Add CTA text
        if (cta.text) {
          content += `\n\n${cta.text}`
        }
        
        // Add booking URL for Facebook (from V2 API response)
        if (cta.url) {
          content += `\n${cta.url}`
        }
      } else if (platform.toLowerCase() === 'facebook' && postCta?.url) {
        // Weekly-plan / generate-text-from-idea path: CTA text is already baked into the GPT
        // output, so only append the booking URL on a new line.
        content += `\n${postCta.url}`
      }

      return content
    },
    [postContent, selectedPlatforms, selectedAiIdea, postCta]
  )

  // Copy to clipboard
  const copyToClipboard = useCallback(async (platform: string) => {
    const content = getFormattedContent(platform)
    try {
      await navigator.clipboard.writeText(content)
      setCopiedPlatform(platform)
      setTimeout(() => setCopiedPlatform(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [getFormattedContent])

  const handleSaveDraft = useCallback(async () => {
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
          platformVariants: media.platformVariants,
          slideCaption: media.slideCaption,
          aiSkipSuggested: media.aiSkipSuggested,
        })),
      }
    }

    const draftLocal = {
      timestamp: Date.now(),
      selectedPlatforms,
      postContent: snapshot,
      photoContent: serializablePhotoContent || photoContent,
      photoIdea,
    }

    try {
      localStorage.setItem('post2grow_draft_recovery', JSON.stringify(draftLocal))
      markAsSaved?.()
    } catch (error) {
      console.error('Failed to persist draft to localStorage:', error)
      return false
    }

    return true
  }, [postContent, photoContent, photoIdea, selectedPlatforms, markAsSaved])

  // Download photo
  const downloadPhoto = async () => {
    if (!photoContent?.uploadedMedia?.[0]?.url) return
    
    try {
      const imageUrl = photoContent.uploadedMedia[0].url
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `post-photo-${Date.now()}.jpg`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to download photo:', err)
    }
  }

  // Open platform
  const openPlatform = (platform: string) => {
    const urls = {
      Facebook: 'https://www.facebook.com',
      Instagram: 'https://www.instagram.com'
    }
    window.open(urls[platform as keyof typeof urls], '_blank')
  }

  // Handle connect platform
  const handleConnectPlatform = (platform: string) => {
    // In real app, this would trigger OAuth flow
    console.log('Connect platform:', platform)
    // Show the manual post modal which includes connection options
    setShowManualPostModal(true)
  }

  // Called when the user confirms they have posted on a platform manually
  const handleConfirmPosted = useCallback(async (platform: string, postedAt: Date) => {
    if (!business?.id) {
      console.warn('[handleConfirmPosted] business.id not available — post not saved')
      return
    }

    const postText = getFormattedContent(platform)
    const media = photoContent?.uploadedMedia?.[0]
    const photoFile = media?.file ?? null
    const photoUrl = media?.adjustedUrl ?? media?.url ?? null

    const { photoUploadFailed } = await savePublishedPost({
      businessId: business.id,
      platform: platform.toLowerCase(),
      postText,
      ideaSource: publishIdeaSource,
      suggestionId: selectedSuggestionData?.id ?? null,
      photoFile,
      photoUrl,
      contentType: (weeklyPlanPost?.postType?.category ?? selectedSuggestionData?.contentType)?.toLowerCase() ?? null,
      menuItemId: weeklyPlanPost?.contentSubject?.menuItemId ?? selectedSuggestionData?.menuItemId ?? null,
      menuItemName: weeklyPlanPost?.contentSubject?.menuItemName ?? selectedSuggestionData?.menuItemName ?? null,
      weeklyPlanId: weeklyPlanPost?.id ?? null,
      weeklyPlanIdeaId: weeklyPlanPost?.idea_id ?? null,
      weeklyPlanSlotDate: weeklyPlanPost?.timing?.date ?? null,
      postedAt,
      captionData: buildCaptionData(platform, postText, postedAt),
      mediaMetadata: media ? {
        thumbnail_url: photoUrl ?? null,
        original_url: media.originalUrl ?? null,
        adjusted_url: media.adjustedUrl ?? null,
        selected_version_for_post: media.selectedVersionForPost ?? null,
        media_type: media.type,
      } : null,
    })

    if (photoUploadFailed) {
      console.error(
        '[handleConfirmPosted] Photo upload failed — post saved without photo. ' +
        'Make sure the "post-media" Supabase Storage bucket exists and is public.',
      )
      alert(
        'Opslaget blev gemt, men billedet kunne ikke uploades og gemmes ikke i oversigten.\n\n' +
        'Opret venligst "post-media" bucket i Supabase Storage (offentlig) og kør migreringen.',
      )
    }

    // Refresh the timeline so the new post appears immediately
    refreshTimeline()

    // Mark the current weekly plan slot as done so the context strip updates
    if (activePath === 'weekly-plan') {
      addWeeklyPlanSessionDone(weeklyPlanPostIndex)
    }
  }, [business?.id, getFormattedContent, photoContent, weeklyPlanPost, selectedSuggestionData, activePath, weeklyPlanPostIndex, addWeeklyPlanSessionDone, refreshTimeline])

  const selectedTime = useMemo(() => `${selectedHour}:${selectedMinute}`, [selectedHour, selectedMinute])

  // Suggested time after the grace window means the user must pick a new time.
  const publishMode = selectedPublishMode

  const canPublish = !!selectedDate && publishPlatforms.length > 0

  const handleScheduledPostClick = useCallback((postId: string | number) => {
    setSelectedScheduledPostId(String(postId))
    setShowScheduledPostModal(true)
  }, [])

  const handleScheduledPostDeleted = useCallback(() => {
    console.log('[PublishStep] handleScheduledPostDeleted called, refreshing timeline...')
    refreshTimeline()
    setShowScheduledPostModal(false)
    console.log('[PublishStep] Timeline refresh triggered, modal closing')
  }, [refreshTimeline])

  const handleScheduledPostUpdated = useCallback(() => {
    refreshTimeline()
  }, [refreshTimeline])

  /**
   * Save published media to the media gallery for reuse.
   * Runs in background after successful publish/schedule - non-blocking.
   * Only saves media with actual files (not URLs from gallery reuse).
   */
  const saveMediaToGallery = useCallback(async () => {
    if (!photoContent?.uploadedMedia || photoContent.uploadedMedia.length === 0) {
      return
    }

    if (!business?.id) {
      console.warn('[saveMediaToGallery] No business ID available')
      return
    }

    // Determine content type from weekly plan or suggestion
    const contentType = weeklyPlanPost?.postType?.category ?? selectedSuggestionData?.contentType ?? null
    
    // Map content_type to PostType for media library
    const postTypeMap: Record<string, PostType> = {
      'menu_item': 'menu_item',
      'atmosphere': 'atmosphere',
      'behind_the_scenes': 'behind_the_scenes',
      'event': 'event',
      'announcement': 'announcement',
      'customer_moment': 'customer_moment',
      'team': 'team',
      'seasonal': 'seasonal',
      'branding': 'branding'
    }
    
    const postType: PostType | undefined = contentType && contentType in postTypeMap 
      ? postTypeMap[contentType as keyof typeof postTypeMap] 
      : undefined

    // Get dish name if this is a menu item post
    const dishName = weeklyPlanPost?.contentSubject?.menuItemName 
      ?? selectedSuggestionData?.menuItemName 
      ?? null

    // Get menu item ID for linking to normalized menu data
    const menuItemId = weeklyPlanPost?.contentSubject?.menuItemId 
      ?? selectedSuggestionData?.menuItemId 
      ?? null

    // Save each media item to the gallery (non-blocking)
    for (const media of photoContent.uploadedMedia) {
      // Only save if this is an actual file upload (not a gallery reuse)
      // Gallery items don't have .file property
      if (!media.file || media.file.size === 0) {
        continue
      }

      try {
        await uploadToMediaLibrary({
          file: media.file,
          businessId: business.id,
          postType: postType,
          dishName: dishName ?? undefined,
          menuItemId: menuItemId ?? undefined,
          tags: contentType ? [contentType] : [],
          altText: dishName ?? undefined,
        })
        
        console.log('[saveMediaToGallery] Saved media to gallery:', media.file.name)
      } catch (error) {
        // Log error but don't block publish flow
        console.warn('[saveMediaToGallery] Failed to save media to gallery:', error)
      }
    }
  }, [photoContent, business?.id, weeklyPlanPost, selectedSuggestionData])

  const handlePublish = useCallback(async (modeOverride?: 'now' | 'schedule') => {
    // Prevent double-save from rapid clicks (ref is synchronous, unlike setState)
    if (isSavingRef.current) return
    isSavingRef.current = true

    const publishMode = modeOverride ?? selectedPublishMode

    // Manual post modal only applies to "post now" — scheduled posts skip it
    if (unconnectedPlatforms.length > 0 && publishMode === 'now') {
      void updateSelectedSuggestionStatus('consumed')
      setShowManualPostModal(true)
      isSavingRef.current = false
      return
    }

    if (publishMode === 'schedule' && selectedTimeIsTooOldForSchedule) {
      alert(scheduleDisabledReason)
      isSavingRef.current = false
      return
    }

    if (publishMode === 'schedule' && !canSchedulePost()) {
      alert(tPublish('scheduleQuotaExceeded', 'Reached monthly limit'))
      isSavingRef.current = false
      return
    }

    if (!business?.id) {
      console.warn('[handlePublish] business.id not available')
      isSavingRef.current = false
      return
    }

    setIsPublishing(true)

    // Build the scheduled datetime from the selected date + hour + minute.
    // For "now", use the current moment so the draft can be posted immediately.
    const scheduledAt = publishMode === 'now'
      ? new Date()
      : (selectedDateTime ? new Date(selectedDateTime) : new Date())

    console.log('[handlePublish] mode:', publishMode, 'scheduledAt:', scheduledAt.toISOString(), 'platforms:', selectedPlatforms, 'businessId:', business.id, 'postContent:', postContent, 'photoContent:', photoContent)

    await updateSelectedSuggestionStatus('consumed')

    // Save to DB for every platform the user has kept enabled
    for (const platform of publishPlatforms) {
      const platformKey = platform.toLowerCase()
      const existingId = savedPostIds.current[platformKey]

      if (existingId) {
        // Already saved — just update the time/status
        const { error: updateError } = await updatePublishedPost(existingId, {
          postedAt: scheduledAt,
          status: publishMode === 'schedule' ? 'scheduled' : 'published',
          scheduledFor: publishMode === 'schedule' ? scheduledAt : null,
        })
        if (updateError) {
          alert(`Fejl ved opdatering: ${updateError}`)
          setIsPublishing(false)
          isSavingRef.current = false
          return
        }
      } else {
        // First save — INSERT
        const postText = getFormattedContent(platform)
        const media = photoContent?.uploadedMedia?.[0]
        // Only use the file if it's a valid File object with actual data (not a dummy/null)
        const photoFile = (media?.file && media.file.size > 0) ? media.file : null
        const photoUrl = media?.adjustedUrl ?? media?.url ?? null

        console.log('[handlePublish] Photo debug:', {
          hasPhotoContent: !!photoContent,
          hasUploadedMedia: !!photoContent?.uploadedMedia,
          mediaCount: photoContent?.uploadedMedia?.length ?? 0,
          hasMedia: !!media,
          hasFile: !!photoFile,
          hasUrl: !!photoUrl,
          url: photoUrl,
          fileType: photoFile?.type,
          fileName: photoFile?.name,
          fileSize: photoFile?.size,
        })

        const { id: newId, photoUploadFailed, error: saveError } = await savePublishedPost({
          businessId: business.id,
          platform: platformKey,
          postText,
          ideaSource: publishIdeaSource,
          suggestionId: selectedSuggestionData?.id ?? null,
          photoFile,
          photoUrl,
          contentType: (weeklyPlanPost?.postType?.category ?? selectedSuggestionData?.contentType)?.toLowerCase() ?? null,
          menuItemId: weeklyPlanPost?.contentSubject?.menuItemId ?? selectedSuggestionData?.menuItemId ?? null,
          menuItemName: weeklyPlanPost?.contentSubject?.menuItemName ?? selectedSuggestionData?.menuItemName ?? null,
          weeklyPlanId: weeklyPlanPost?.id ?? null,
          weeklyPlanIdeaId: weeklyPlanPost?.idea_id ?? null,
          weeklyPlanSlotDate: weeklyPlanPost?.timing?.date ?? null,
          postedAt: scheduledAt,
          status: publishMode === 'schedule' ? 'scheduled' : 'published',
          scheduledFor: publishMode === 'schedule' ? scheduledAt : null,
          suggestedPostTime: selectedSuggestionData?.suggestedTime ?? null,
          captionData: buildCaptionData(platform, postText, scheduledAt),
          mediaMetadata: media ? {
            thumbnail_url: photoUrl ?? null,
            original_url: media.originalUrl ?? null,
            adjusted_url: media.adjustedUrl ?? null,
            selected_version_for_post: media.selectedVersionForPost ?? null,
            media_type: media.type,
          } : null,
        })

        if (saveError) {
          alert(`Fejl ved gem: ${saveError}`)
          setIsPublishing(false)
          isSavingRef.current = false
          return
        }
        if (newId) savedPostIds.current[platformKey] = newId
        if (photoUploadFailed) console.error('[handlePublish] Photo upload failed for platform:', platform)
      }
    }

    // Save media to gallery for reuse (only on successful publish/schedule)
    await saveMediaToGallery()

    refreshTimeline()

    if (publishMode === 'schedule') {
      incrementScheduledPost()
    }

    if (activePath === 'weekly-plan') {
      addWeeklyPlanSessionDone(weeklyPlanPostIndex)
    }

    await updateSelectedSuggestionStatus('published')

    setIsPublishing(false)
    isSavingRef.current = false
    // Build result — notify parent (deletes DB draft, refreshes badges) without clearing store
    const publishedResult: SuccessInfo = {
      mode: publishMode,
      scheduledAt: publishMode === 'schedule' ? scheduledAt : null,
      platforms: [...publishPlatforms],
      publishedPostIds: Object.values(savedPostIds.current),
    }
    onPublishSuccess?.(publishedResult)
    setSuccessInfo(publishedResult)
  }, [
    unconnectedPlatforms,
    selectedPublishMode,
    canSchedulePost,
    tPublish,
    business?.id,
    selectedDateTime,
    publishPlatforms,
    getFormattedContent,
    postContent,
    photoContent,
    weeklyPlanPost,
    selectedSuggestionData,
    refreshTimeline,
    incrementScheduledPost,
    activePath,
    weeklyPlanPostIndex,
    addWeeklyPlanSessionDone,
    onNext,
    onPublishSuccess,
    selectedTimeIsTooOldForSchedule,
    scheduleDisabledReason,
  ])

  const handlePublishNow = useCallback(() => {
    void handlePublish('now')
  }, [handlePublish])

  // "Post nu" shortcut — reset date/time to right now
  const handlePostNow = useCallback(() => {
    const now = new Date()
    setSelectedDate(now)
    setSelectedHour(String(now.getHours()).padStart(2, '0'))
    setSelectedMinute(String(now.getMinutes()).padStart(2, '0'))
    setSelectedSuggestion(null)
  }, [])

  // Get locale for displaying dates - use current language (da-DK or en-GB) combined with date format preference
  const locale = useMemo(() => {
    const currentLang = i18n.language

    try {
      const prefs = localStorage.getItem('userPreferences')
      if (prefs) {
        const parsed = JSON.parse(prefs)
        const dateFormat = parsed?.dateFormat
        if (dateFormat === 'en-US') {
          return 'en-US'
        }
      }
    } catch (error) {
      console.error('Error reading date format preference:', error)
    }

    return currentLang === 'da' ? 'da-DK' : 'en-GB'
  }, [i18n.language])

  const restoredDraftTimeLabel = useMemo(() => {
    if (!restoredDbDraft) {
      return null
    }

    if (!restoredDbDraft.suggestedPostDatetime) {
      return 'Intet tidspunkt valgt'
    }

    const parsedDate = new Date(restoredDbDraft.suggestedPostDatetime)
    if (Number.isNaN(parsedDate.getTime())) {
      return 'Intet tidspunkt valgt'
    }

    return parsedDate.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [locale, restoredDbDraft])

  const { timelineItems, postPreview, selectedPlatformPreviews } = usePublishTimeline({
    recentPosts,
    futurePosts,
    selectedDate,
    selectedHour,
    selectedMinute,
    selectedDraftTitle: weeklyPlanPost?.contentSubject?.menuItemName ?? selectedSuggestionData?.menuItemName ?? postContent?.headline ?? null,
    postContent,
    selectedPlatforms
  })

  const selectedMediaUrl = useMemo(() => {
    const media = photoContent?.uploadedMedia?.[0]
    if (!media) return null
    return media.adjustedUrl || media.url || media.originalUrl || null
  }, [photoContent])

  const unconnectedPlatformLabels = useMemo<string[]>(
    () => unconnectedPlatforms.map((platform) => getPlatformLabel(platform)),
    [unconnectedPlatforms]
  )

  const manualPostingRequiredLabel = useMemo(
    () => tPublish('manualPostingRequired', 'Manual post required'),
    [tPublish]
  )

  // ── Success state helpers (rendered inline in the ternary below) ─────────────
  const successIsSchedule = successInfo?.mode === 'schedule'
  const successDateLabel = successInfo?.scheduledAt
    ? successInfo.scheduledAt.toLocaleString(locale, {
        weekday: 'long', day: 'numeric', month: 'long',
        hour: '2-digit', minute: '2-digit',
      })
    : null
  const successPlatformEmojis = successInfo?.platforms.map(p =>
    p === 'facebook' ? '🔵 Facebook' : p === 'instagram' ? '🟣 Instagram' : p
  ).join(' & ') ?? ''

  const publishIdeaSource: 'manual' | 'quick_suggestions' | 'weekly_plan' =
    activePath === 'weekly-plan' ? 'weekly_plan'
    : activePath === 'ai-ideas' ? 'quick_suggestions'
    : 'manual'

  const buildCaptionData = useCallback((platform: string, postText: string, scheduledAt: Date) => ({
    activePath,
    ideaSource: publishIdeaSource,
    suggestionId: selectedSuggestionData?.id ?? null,
    weeklyPlanId: weeklyPlanPost?.id ?? null,
    weeklyPlanIdeaId: weeklyPlanPost?.idea_id ?? null,
    weeklyPlanSlotDate: weeklyPlanPost?.timing?.date ?? null,
    selectedPlatforms,
    platform,
    postText,
    scheduledAt: scheduledAt.toISOString(),
    postContent: postContent ? { ...postContent } : null,
    postCta,
    selectedSuggestionData: selectedSuggestionData ? {
      id: selectedSuggestionData.id ?? null,
      title: selectedSuggestionData.title ?? null,
      contentType: selectedSuggestionData.contentType ?? null,
      menuItemId: selectedSuggestionData.menuItemId ?? null,
      menuItemName: selectedSuggestionData.menuItemName ?? null,
      suggestedTime: selectedSuggestionData.suggestedTime ?? null,
      ctaIntent: selectedSuggestionData.ctaIntent ?? null,
      occasionContext: selectedSuggestionData.occasionContext ?? null,
      photoIdea: selectedSuggestionData.photoIdea ?? null,
      whyExplanation: selectedSuggestionData.whyExplanation ?? null,
    } : null,
    weeklyPlanPost: weeklyPlanPost ? {
      id: weeklyPlanPost.id ?? null,
      timing: weeklyPlanPost.timing,
      contentSubject: weeklyPlanPost.contentSubject,
      postType: weeklyPlanPost.postType,
      selectionRationale: weeklyPlanPost.selectionRationale ?? null,
      caption: weeklyPlanPost.caption,
      strategicContext: weeklyPlanPost.strategicContext ?? null,
    } : null,
  }), [activePath, postCta, postContent, publishIdeaSource, selectedPlatforms, selectedSuggestionData, weeklyPlanPost])

  return (
    <div className="space-y-4">
      {/* No Platforms Selected - Show gentle prompt */}
      {selectedPlatforms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-6">
          <div className="max-w-md text-center">
            <div className="mb-4 text-6xl">📱</div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">
              Vælg dine sociale medier
            </h3>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Vælg dine sociale medier, så jeg kan vise den rigtige forhåndsvisning af dit opslag.
            </p>
            <button
              onClick={() => {
                // Navigate to business profile social media section
                window.location.href = '/dashboard/profile#social-media'
              }}
              className="px-6 py-3 bg-cta text-white rounded-lg text-sm font-semibold hover:bg-cta-hover transition-colors flex items-center gap-2 mx-auto"
            >
              <span>Vælg sociale medier</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Connection Notice (Compact) */}
          {unconnectedPlatforms.length > 0 && (
        <div className="px-3 py-2 bg-[#FEFCE8] rounded-lg border border-[#F6EBA5] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Link2 className="w-4 h-4 text-[#8C6D1F] flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#8C6D1F]">
                Kopiér manuelt til {formatPlatformList(unconnectedPlatforms)}
              </p>
              <p className="text-xs text-[#8C6D1F]">
                Vi forbereder dit indhold. Klik 'Udgiv' for at få tekst.
              </p>
            </div>
          </div>
          <button 
            onClick={() => handleConnectPlatform(unconnectedPlatforms[0])}
            className="flex-shrink-0 px-3 py-1.5 bg-white border border-[#E5BF4A] text-[#8C6D1F] rounded-md text-xs font-semibold hover:bg-[#8C6D1F] hover:text-white transition-colors whitespace-nowrap"
          >
            Kopiér Indhold →
          </button>
        </div>
      )}

      {/* Calendar — always visible */}
      <div className="space-y-3">

        {/* Calendar with Timeline */}
        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-3">
          <div className="flex items-center gap-1.5 mb-3">
            <Calendar className="w-4 h-4 text-cta" />
            <h3 className="text-sm font-bold text-slate-800">
              {tPublish('calendar', 'Kalender & Tidslinje')}
            </h3>
            {scheduleFromPlan && !successInfo && (
              <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold bg-cta-surface text-cta-text px-2 py-0.5 rounded-full">
                📅 Fra ugeplanen
              </span>
            )}
            {/* Green success badge — shown after publish in place of the plan badge */}
            {successInfo && (
              <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                ✓ {successIsSchedule ? 'Planlagt' : 'Udgivet'}{successDateLabel ? ` · ${successDateLabel}` : ''}
              </span>
            )}
            {/* "Post nu" shortcut — only shown when a future time is selected and not yet published */}
            {selectedPublishMode === 'schedule' && !successInfo && (
              <button
                onClick={handlePostNow}
                className="ml-auto text-[10px] font-semibold text-cta hover:underline"
              >
                ↩ Post nu
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* LEFT: Calendar & Time Selection */}
            <div>
              {/* AI-Recommended Time Indicator */}
              {selectedSuggestionData?.suggestedTime && (
                <div className="mb-3 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-600 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-purple-900">
                        AI anbefaler kl. {selectedSuggestionData.suggestedTime}
                      </p>
                      <p className="text-xs text-purple-700">
                        Optimalt tidspunkt for engagement
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick-select AI Time Chip */}
              {selectedSuggestionData?.suggestedTime && (() => {
                const [aiHours, aiMinutes] = selectedSuggestionData.suggestedTime.split(':')
                const isUsingAiTime = selectedHour === aiHours && selectedMinute === aiMinutes
                
                if (isUsingAiTime) {
                  return (
                    <div className="mb-3 flex items-center gap-1.5 text-xs text-purple-600">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span className="font-medium">Bruger AI anbefaling</span>
                    </div>
                  )
                }
                
                return (
                  <button
                    onClick={() => {
                      setSelectedHour(aiHours)
                      setSelectedMinute(aiMinutes)
                    }}
                    className="mb-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 border border-purple-300 rounded-lg text-xs font-semibold text-purple-700 hover:bg-purple-100 active:bg-purple-200 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Brug AI anbefaling: kl. {selectedSuggestionData.suggestedTime}</span>
                  </button>
                )
              })()}

              {restoredDbDraft && (
                <div className="mb-3 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-600 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-slate-900">
                        {restoredDraftTimeLabel}
                      </p>
                      <p className="text-xs text-slate-700">
                        Kladde tidspunkt
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <ScheduleCalendarPicker
                selectedDate={selectedDate}
                selectedHour={selectedHour}
                selectedMinute={selectedMinute}
                selectedTime={selectedTime}
                timeInterval={timeInterval}
                monthNames={monthNames}
                dayNames={dayNames}
                locale={locale}
                selectTimeLabel={tPublish('selectTime', 'Time')}
                hourLabel={tPublish('hour', 'Hour')}
                minuteLabel={tPublish('minute', 'Min')}
                timeInPastLabel={tPublish('timeInPast', 'Time is in the past')}
                dayPosts={calendarDayPosts}
                onSelectDate={(date) => setSelectedDate(date)}
                onSelectHour={(hour) => setSelectedHour(hour)}
                onSelectMinute={(minute) => setSelectedMinute(minute)}
              />
            </div>

            {/* RIGHT: Posts Timeline */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-700">
                  {tPublish('postsTimeline', 'Opslags Tidslinje')}
                </p>
                <p className="text-xs text-slate-500">
                  ⏰ {tPublish('chronological', 'Kronologisk')}
                </p>
              </div>

              <ScheduleTimeline
                items={successInfo ? timelineItems.filter(i => i.type !== 'selected') : timelineItems}
                selectedPlatforms={selectedPlatforms}
                postPreview={successInfo ? null : postPreview}
                selectedPlatformPreviews={successInfo ? undefined : selectedPlatformPreviews}
                locale={locale}
                isPlatformConnected={isPlatformConnected}
                unconnectedPlatforms={unconnectedPlatformLabels}
                manualPostingRequiredLabel={manualPostingRequiredLabel}
                selectedMediaUrl={selectedMediaUrl ?? undefined}
                onPublishNow={successInfo ? undefined : handlePublishNow}
                onSave={successInfo ? undefined : handlePublish}
                isPublishing={isPublishing}
                canSave={selectedPublishMode === 'schedule' ? canPublish && !selectedTimeIsTooOldForSchedule : canPublish}
                saveDisabledReason={scheduleDisabledReason}
                saveLabel={tPublish('scheduleCta', 'Planlæg')}
                publishNowLabel={tPublish('publishNowCta', 'Udgiv nu')}
                onScheduledPostClick={handleScheduledPostClick}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Separator line */}
      <div className="border-t border-[#D1D5DB] mt-4"></div>

      {/* Navigation — swaps to CTA pair after successful publish */}
      {successInfo ? (
        <div className="flex flex-col gap-2 pb-4 pt-2">
          <button
            onClick={() => onBackToPlan ? onBackToPlan() : onViewCalendar?.()}
            className="w-full px-5 py-2.5 bg-cta text-white rounded-lg text-sm font-semibold hover:bg-cta-hover transition-colors"
          >
            {onBackToPlan ? '📋 Tilbage til ugeplanen' : '📅 Se i kalender'}
          </button>
          <button
            onClick={() => onNext()}
            className="w-full px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            ✏️ Opret nyt opslag
          </button>

          {/* Cancel scheduled post — only shown for scheduled (future) posts */}
          {successInfo.mode === 'schedule' && successInfo.publishedPostIds.length > 0 && (
            <div className="pt-1">
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="w-full text-xs text-slate-400 hover:text-red-500 transition-colors py-1"
                >
                  🗑 Fortryd planlagt opslag
                </button>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xs text-slate-500">Er du sikker?</span>
                  <button
                    disabled={isDeletingPost}
                    onClick={async () => {
                      setIsDeletingPost(true)
                      await Promise.all(successInfo.publishedPostIds.map(id => deletePublishedPost(id)))
                      setIsDeletingPost(false)
                      setConfirmDelete(false)
                      setSuccessInfo(null)
                      savedPostIds.current = {}
                      onPublishDeleted?.()
                    }}
                    className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
                  >
                    {isDeletingPost ? 'Sletter...' : 'Ja, slet'}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="text-xs text-slate-500 hover:text-slate-700"
                  >
                    Annuller
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between pt-2 pb-4 gap-3">
          <button
            onClick={onBack}
            className="px-4 py-2 text-xs font-medium text-[#374151] bg-white border border-[#D1D5DB] rounded-lg hover:bg-[#F9FAFB] transition-colors flex items-center gap-1.5"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{tPublish('back', 'Tilbage')}</span>
          </button>

          <PostCreationFooter
            hasUnsavedChanges={Boolean(hasUnsavedChanges)}
            hasPersistedDraft={hasPersistedDraft}
            onSaveDraft={handleSaveDraft}
            onNext={handlePublish}
            renderNextButton={({ onNext }) => (
              <button
                onClick={onNext}
                disabled={!canPublish || isPublishing}
                className="px-6 py-2 bg-cta text-text-inverse rounded-lg hover:bg-cta-hover transition-all font-medium text-xs shadow-md flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isPublishing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{unconnectedPlatforms.length > 0 ? tPublish('preparing', 'Forbereder...') : selectedPublishMode === 'now' ? tPublish('publishing', 'Udgiver...') : tPublish('scheduling', 'Planlægger...')}</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>
                      {unconnectedPlatforms.length > 0
                        ? tPublish('prepareManualPost', 'Forbered manual post')
                          : selectedPublishMode === 'now'
                          ? tPublish('publishNowCta', 'Udgiv opslag nu')
                          : tPublish('schedulePost', 'Planlæg opslag')}
                    </span>
                  </>
                )}
              </button>
            )}
          />
        </div>
      )}

      <ManualPostModal
        isOpen={showManualPostModal && unconnectedPlatforms.length > 0}
        platforms={unconnectedPlatforms}
        photoContent={photoContent}
        copiedPlatform={copiedPlatform}
        t={tPublish}
        onClose={() => setShowManualPostModal(false)}
        onComplete={async () => {
          setShowManualPostModal(false)
          
          // Save media to gallery for manual posts too
          await saveMediaToGallery()
          await updateSelectedSuggestionStatus('published')
          
          const publishedResult: SuccessInfo = {
            mode: 'now',
            scheduledAt: null,
            platforms: [...publishPlatforms],
            publishedPostIds: [],  // manual posts: IDs not surfaced; delete not offered for 'now' mode
          }
          onPublishSuccess?.(publishedResult)
          setSuccessInfo(publishedResult)
        }}
        onConnectPlatform={handleConnectPlatform}
        downloadPhoto={downloadPhoto}
        copyToClipboard={copyToClipboard}
        openPlatform={openPlatform}
        getFormattedContent={getFormattedContent}
        onConfirmPosted={handleConfirmPosted}
      />

      {selectedScheduledPostId && (
        <ScheduledPostModal
          postId={selectedScheduledPostId}
          isOpen={showScheduledPostModal}
          onClose={() => setShowScheduledPostModal(false)}
          onDeleted={handleScheduledPostDeleted}
          onUpdated={handleScheduledPostUpdated}
        />
      )}

      {/* NEW: Post Edit/Preview Modal */}
      {selectedPost && (
        <PostModal
          isOpen={!!selectedPost}
          onClose={() => setSelectedPost(null)}
          post={selectedPost}
          siblingPost={getSiblingPost(selectedPost)}
          onPostNow={handleTimelinePostNow}
          onReschedule={handleReschedule}
          onDelete={handleDeletePost}
          onUpdateText={handleUpdateText}
        />
      )}
        </>
      )}
    </div>
  )
}
