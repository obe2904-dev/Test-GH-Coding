import { useState, useEffect, useLayoutEffect, lazy, Suspense, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useConnectionsStore } from '../../stores/connectionsStore'
import { PlanContextStrip } from '../../components/post-creation/PlanContextStrip'
import { usePostCreationStore } from '../../stores/postCreationStore'
import type { WeeklyPlanSuggestion, PostContent } from '../../stores/postCreationStore'
import { useContextDraft } from '../../hooks/useContextDraft'
import { usePosts } from '../../hooks/usePosts'
import type { PostKey as DbPostKey } from '../../hooks/usePosts'
import { useCommittedSuggestions } from '../../hooks/useCommittedSuggestions'
import type { SuccessInfo as PublishSuccessInfo } from '../../components/post-creation/PublishStep'
import { useBusinessData } from '../../hooks/useBusinessData'
import { useTierStore } from '../../stores/tierStore'
import { useWriteDraft } from '../../hooks/useWriteDraft'
import { supabase } from '../../lib/supabase'
import { buildPlatformPreviewContent } from '../../components/post-creation/publish/utils'

// Bump this when prompt logic or grounding payload changes significantly.
// Any cached row with a lower version is treated as stale and regenerated.
// v2: initial versioning (task 7)
// v3: anledningRule KRAV #5 + LEJLIGHED for menu posts (task 8) + goalDirectiveLine + goalMode in brand block (task 9)
// v4: location-decoration ban (KRAV 10) + intransitive-verb sentence ban (KRAV 11) in generated text
// v5: 'ved åen' named explicitly in faktaforbud + 'svip' banned + snacks filtered from Slot A
// v6: full category structure in menu block; dish_text_brief curated by Gemini; curated brief skips DB re-fetch; hasQualifiedDescription threshold raised to 30
const CURRENT_TEXT_VERSION = 8

// Lazy load post creation steps for better performance
const GenerateStep = lazy(() => import('../../components/post-creation/GenerateStep').then(m => ({ default: m.GenerateStep })))
const CreateStep = lazy(() => import('../../components/post-creation/CreateStep').then(m => ({ default: m.CreateStep })))
const PublishStep = lazy(() => import('../../components/post-creation/PublishStep').then(m => ({ default: m.PublishStep })))

// Loading component
const StepLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-4 motion-reduce:animate-none"></div>
      <p className="text-sm text-muted">Loading...</p>
    </div>
  </div>
)

export function CreatePostPage() {
  const { isEnabled: _isEnabled, loadPlatformsFromDatabase, enabledPlatforms } = useConnectionsStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { t } = useTranslation(undefined, { keyPrefix: 'createPost' })
  
  // ── Derive activePath from URL immediately (before useEffect runs) ──
  const urlMode = searchParams.get('mode')
  const urlDerivedPath: 'write' | 'ai-ideas' | 'weekly-plan' = 
    urlMode === 'ai' ? 'ai-ideas' 
    : urlMode === 'weekly-plan' ? 'weekly-plan'
    : urlMode === 'write' ? 'write'
    : 'write' // default
  
  const { 
    activePath: storeActivePath,
    setActivePath,
    writeSelfStep, setWriteSelfStep,
    writeSelfContent, setWriteSelfContent,
    aiIdeerStep, setAiIdeerStep,
    aiIdeerContent, setAiIdeerContent,
    setWriteSelfPhotoIdea,
    setAiIdeerPhotoIdea,
    weeklyPlanStep, setWeeklyPlanStep,
    selectedPlatforms,
    setSelectedPlatforms, 
    setSelectedIdea,
    setSelectedSuggestionData,
    selectedSuggestionData,
    weeklyPlanPost,
    setWeeklyPlanPost,
    weeklyPlanSuggestion: _weeklyPlanSuggestion,
    setWeeklyPlanSuggestion,
    setPostContent,
    postContent,
    setPhotoIdea,
    setStrategicIdea,
    weeklyContentPlan,
    weeklyPlanPostIndex,
    setWeeklyPlanPostIndex,
    weeklyPlanSessionDone,
    addWeeklyPlanSessionDone,
    draftMap,
    setDraftMapEntry,
    photoDraftMap,
    setPhotoDraftMapEntry,
    clearWeeklyPlanSession,
    reset: _resetStore,
    setPostCta,
    photoContent,
    setPhotoContent,
  } = usePostCreationStore()

  // ── Use URL-derived path for rendering (prevents flash of wrong content) ──
  const activePath = urlDerivedPath

  // ── Path-aware current step (replaces local useState) ──
  // If URL path differs from store path, it's a fresh navigation - force 'generate' stage
  const isFreshNavigation = urlDerivedPath !== storeActivePath
  const currentStep: 'generate' | 'create' | 'publish' = isFreshNavigation
    ? 'generate' 
    : activePath === 'write' ? writeSelfStep
      : activePath === 'ai-ideas' ? aiIdeerStep
      : weeklyPlanStep

  // Debug logging for flash issue
  if (isFreshNavigation) {
    console.log('[CreatePostPage] Fresh navigation detected:', {
      urlDerivedPath,
      storeActivePath,
      forcingCurrentStep: 'generate'
    })
  }

  const setCurrentStep = (step: 'generate' | 'create' | 'publish') => {
    if (activePath === 'write') setWriteSelfStep(step)
    else if (activePath === 'ai-ideas') setAiIdeerStep(step)
    else setWeeklyPlanStep(step)
  }

  // ── Path-aware content (write/ai-ideas have their own slots; weekly-plan uses postContent) ──
  const activeContent = activePath === 'write' ? writeSelfContent
    : activePath === 'ai-ideas' ? aiIdeerContent
    : postContent

  const setActiveContent = (content: PostContent | null) => {
    if (activePath === 'write') setWriteSelfContent(content)
    else if (activePath === 'ai-ideas') setAiIdeerContent(content)
    else setPostContent(content)
  }

  // Route photo idea to the active path's slot so switching paths shows the correct suggestion.
  const setActivePhotoIdea = (idea: string) => {
    if (activePath === 'write') setWriteSelfPhotoIdea(idea)
    else if (activePath === 'ai-ideas') setAiIdeerPhotoIdea(idea)
    else setPhotoIdea(idea) // weekly-plan: writes directly
  }

  const [isGenerating, setIsGenerating] = useState(false)
  const [staleMenuWarning, setStaleMenuWarning] = useState<string | null>(null)
  const [restoredDbDraft, setRestoredDbDraft] = useState<{ suggestedPostDatetime: string | null } | null>(null)
  const businessData = useBusinessData()
  
  // Hook for write mode draft persistence (single live draft in DB)
  const writeDraft = useWriteDraft({ 
    businessId: businessData?.business?.id || null,
    enabled: activePath === 'write'
  })
  const { currentTier } = useTierStore()

  // Track which suggestion_ids are already committed today so the card shows badges
  // and the create phase can be locked.
  const {
    committedSuggestionIds,
    isCommittedForWrite,
    committedWeeklyPlanIdeaIds,
    committedWeeklyPlanDates,
    refresh: refreshCommitted,
  } = useCommittedSuggestions(businessData.business?.id ?? null)

  const isCommittedAiSuggestion = Boolean(
    activePath === 'ai-ideas' &&
    selectedSuggestionData?.id != null &&
    committedSuggestionIds.has(selectedSuggestionData.id)
  )

  const isCommittedWeeklyPlanIdea = Boolean(
    activePath === 'weekly-plan' &&
    weeklyPlanPost?.idea_id != null &&
    committedWeeklyPlanIdeaIds.has(Number(weeklyPlanPost.idea_id))
  )

  // Lifted success state — survives step-nav back to Udgiv without remounting PublishStep
  const [publishedInfo, setPublishedInfo] = useState<PublishSuccessInfo | null>(null)

  // ── Navigation Lock: Idea + Design become read-only after entering Udgiv ──
  const [hasEnteredUdgiv, setHasEnteredUdgiv] = useState(false)
  const [isReadOnlyMode, setIsReadOnlyMode] = useState(false)

  // ── AI Generation Success State ──
  const [showGenerationSuccess, setShowGenerationSuccess] = useState(false)

  // Initialize the active path from the query string and sync to store.
  // Note: We use urlDerivedPath for rendering to prevent flash of wrong content,
  // but still sync to store for components that read activePath from Zustand.
  useLayoutEffect(() => {
    if (urlDerivedPath !== storeActivePath) {
      setActivePath(urlDerivedPath)
    }
    
    // Reset to Generate stage when URL changes mode.
    // AI mode should always start in Forslag; generated content is restored
    // later when the user selects an idea and continues.
    if (urlDerivedPath === 'write') setWriteSelfStep('generate')
    if (urlDerivedPath === 'ai-ideas') {
      setAiIdeerStep('generate')
      setSelectedIdea(null)
      setSelectedSuggestionData(null)
      setAiIdeerContent(null)
      setAiIdeerPhotoIdea('')
      setPhotoContent(null)
      setPostCta(null)
    }
    // Note: Don't reset weeklyPlanStep here - let WeeklyPlanEffect handle it based on draft existence
    setHasEnteredUdgiv(false)
    setIsReadOnlyMode(false)
    setPublishedInfo(null)
  }, [
    urlDerivedPath,
    storeActivePath,
    setActivePath,
    setAiIdeerStep,
    setWriteSelfStep,
    setSelectedIdea,
    setSelectedSuggestionData,
    setAiIdeerContent,
    setAiIdeerPhotoIdea,
    setPhotoContent,
    setPostCta,
  ])

  // ── Auto-save: context-keyed localStorage draft (no modal, no interval) ──
  // Weekly Plan posts are persisted by the store's setDraftMapEntry; only
  // Skriv Selv and AI Ideer need a key here.
  // For AI suggestions, include normalized title to prevent stale draft restoration
  // when suggestion IDs are reused after regeneration.
  const normalizeTitleForKey = (title: string): string => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .substring(0, 30)
      .replace(/^_|_$/g, '')
  }
  
  const draftKey = activePath === 'weekly-plan' || weeklyContentPlan
    ? null
    : isCommittedAiSuggestion
      ? null
      : activePath === 'ai-ideas' && selectedSuggestionData?.id && (selectedSuggestionData?.title || selectedSuggestionData?.whyExplanation)
      ? `p2g_draft_idea_${selectedSuggestionData.id}_${normalizeTitleForKey(selectedSuggestionData.title || selectedSuggestionData.whyExplanation?.split(/[.!?]\s+/)[0] || '')}`
      : activePath === 'ai-ideas' && selectedSuggestionData?.id
        ? `p2g_draft_idea_${selectedSuggestionData.id}`  // Fallback if no title (shouldn't happen)
        : 'p2g_draft_manual'
  const { save: saveDraft, restoreNow, clear: _clearDraft } = useContextDraft(draftKey)

  // ── DB draft persistence (posts table) ──
  // Supplements localStorage: persists photo URLs across page reloads and provides
  // cross-device/cross-browser recovery. Weekly Plan uses its own draftMap mechanism.
  const posts = usePosts()
  const draftDbIdRef = useRef<string | null>(null)
  // Track blob: URLs that have already been uploaded to avoid re-uploading on re-render
  const uploadedBlobsRef = useRef<Set<string>>(new Set())
  const hasRestoredDbDraftRef = useRef(false)
  // Track previous suggestion ID to avoid clearing photos when returning to same suggestion
  const previousSuggestionIdRef = useRef<number | null>(null)
  // Loading state for weekly plan idea switching to prevent race conditions
  const [isLoadingWeeklyPlanSwitch, setIsLoadingWeeklyPlanSwitch] = useState(false)

  const buildDbDraftKey = useCallback((): DbPostKey | null => {
    const businessId = businessData.business?.id
    if (!businessId) return null
    if (activePath === 'weekly-plan' && weeklyPlanPost?.timing?.date) {
      return { 
        businessId, 
        ideaSource: 'weekly_plan', 
        weeklyPlanSlotDate: weeklyPlanPost.timing.date,
        weeklyPlanId: weeklyContentPlan?.id ?? null,
        weeklyPlanSlotIndex: weeklyPlanPostIndex ?? null
      }
    }
    if (activePath === 'ai-ideas' && selectedSuggestionData?.id != null && !isCommittedAiSuggestion) {
      return { businessId, ideaSource: 'quick_suggestions', suggestionId: selectedSuggestionData.id }
    }
    if (activePath === 'write') return { businessId, ideaSource: 'write' }
    return null
  }, [businessData.business?.id, activePath, selectedSuggestionData?.id, weeklyPlanPost?.timing?.date, weeklyContentPlan?.id, weeklyPlanPostIndex, isCommittedAiSuggestion])

  // Enable read-only mode for committed suggestions instead of clearing them
  useEffect(() => {
    if (!isCommittedAiSuggestion) {
      // Not committed - ensure read-only mode is off
      setIsReadOnlyMode(false)
      return
    }
    
    // Suggestion is committed (published/scheduled) - enable read-only viewing
    // User can see the content but cannot edit it
    console.log('[CreatePostPage] Committed suggestion detected - enabling read-only mode')
    setIsReadOnlyMode(true)
  }, [
    isCommittedAiSuggestion,
  ])

  // No-ops kept for backward compat with child component props
  const markAsChanged = () => {}
  const markAsSaved = () => {}
  const hasUnsavedChanges = false

  // Load platforms from database on mount
  useEffect(() => {
    loadPlatformsFromDatabase()
  }, [loadPlatformsFromDatabase])

  // One-time cleanup of stale drafts when business ID becomes available
  useEffect(() => {
    const businessId = businessData.business?.id
    if (!businessId) return
    posts.cleanupStaleDrafts(businessId).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessData.business?.id])

  // Auto-advance to Design when entering from Weekly Plan (skip Generate step)
  useEffect(() => {
    // Guard: only run for weekly-plan path to prevent interference with other paths
    if (activePath !== 'weekly-plan') return
    
    console.log('[WeeklyPlanEffect] fired', {
      hasWeeklyContentPlan: !!weeklyContentPlan,
      hasWeeklyPlanPost: !!weeklyPlanPost,
      currentStep,
      weeklyPlanPostIndex,
      hasDraftText: !!(draftMap[weeklyPlanPostIndex] as any)?.text,
      hasBusinessId: !!businessData.business?.id,
    })
    if (weeklyContentPlan && weeklyPlanPost && currentStep === 'generate') {
      const savedContent = draftMap[weeklyPlanPostIndex]
      const savedPhotos = photoDraftMap[weeklyPlanPostIndex]
      if (savedContent?.text) {
        // In-memory draft (same session) — restore instantly.
        // Also populate weeklyPlanSuggestion so the photo suggestion is
        // visible in the design stage (same data that handleDirectTransfer sets).
        console.log('[WeeklyPlanEffect] Restoring from in-memory cache')
        setWeeklyPlanSuggestion(buildWeeklyPlanSuggestion(weeklyPlanPost, weeklyPlanPostIndex))
        if (weeklyPlanPost.visualDirection) {
          const briefParts = [
            weeklyPlanPost.visualDirection.subject,
            weeklyPlanPost.visualDirection.angle,
            weeklyPlanPost.visualDirection.setting,
          ].filter(Boolean)
          setPhotoIdea(briefParts.join(' — '))
        }
        setPostContent(savedContent)
        // Restore saved photos, or clear any stale photo from a previous session
        if (savedPhotos) {
          setPhotoContent(savedPhotos)
        } else {
          setPhotoContent(null)
        }
        setCurrentStep('create')
      } else {
        // No in-memory draft — check DB before triggering a fresh generation.
        // This handles the "came back after a page refresh" case.
        ;(async () => {
          const businessId = businessData.business?.id
          if (!businessId) {
            console.warn('[WeeklyPlanEffect] Business ID not available yet, waiting for next render')
            return // Don't regenerate, wait for business data to load
          }

          const dbKey: DbPostKey = {
            businessId,
            ideaSource: 'weekly_plan',
            weeklyPlanSlotDate: weeklyPlanPost.timing.date,
          }
          console.log('[WeeklyPlanEffect] Checking DB for draft:', dbKey)
          const dbDraft = await posts.loadPost(dbKey).catch((err) => { console.error('[WeeklyPlanEffect] DB load error:', err); return null })
          const dbContent = dbDraft?.contentJson as PostContent | undefined

          console.log('[WeeklyPlanEffect] DB draft result:', { found: !!dbDraft, hasText: !!dbContent?.text?.trim() })

          if (dbContent?.text?.trim()) {
            // Restore from DB draft — skip re-generation
            console.log('[WeeklyPlanEffect] Restoring from DB draft, skipping generation')
            draftDbIdRef.current = dbDraft!.id
            setWeeklyPlanSuggestion(buildWeeklyPlanSuggestion(weeklyPlanPost, weeklyPlanPostIndex))
            if (weeklyPlanPost.visualDirection) {
              const briefParts = [
                weeklyPlanPost.visualDirection.subject,
                weeklyPlanPost.visualDirection.angle,
                weeklyPlanPost.visualDirection.setting,
              ].filter(Boolean)
              setPhotoIdea(briefParts.join(' — '))
            }
            setPostContent(dbContent)
            setDraftMapEntry(weeklyPlanPostIndex, dbContent)  // populate in-memory map too
            if (dbDraft!.photoUrl) {
              setPhotoContent({
                uploadedMedia: [{
                  id: 'db-draft-photo',
                  file: null as any,
                  url: dbDraft!.photoUrl,
                  originalUrl: dbDraft!.photoUrl,
                  type: 'image' as const,
                  selectedVersionForPost: 'original' as const,
                }],
                selectedMedia: null,
                isOriginal: true,
                photoAdjustments: null,
                carouselMode: false,
              })
            } else {
              setPhotoContent(null)
            }
            setCurrentStep('create')
          } else {
            // Truly fresh — generate
            console.log('[WeeklyPlanEffect] No DB draft found, generating fresh text')
            handleDirectTransfer()
          }
        })()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeklyPlanPost, businessData.business?.id, currentStep])

  // AI Ideas should not auto-restore into Design on mount.
  // The cached draft is picked up later after the user selects a suggestion
  // and runs generation again.
  useEffect(() => {
    if (activePath === 'write') return
    if (activePath === 'ai-ideas') return
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // mount-only: intentionally ignore refs

  // DB draft restore — runs once when business ID becomes available (async, after localStorage).
  // Provides real Storage photo URLs that survive page reload (localStorage only stores blob: stubs).
  // Only applies to Skriv Selv mode; AI ideas use daily_suggestions table.
  useEffect(() => {
    const businessId = businessData.business?.id
    if (!businessId || hasRestoredDbDraftRef.current || activePath === 'weekly-plan' || activePath === 'ai-ideas') return

    const dbKey = buildDbDraftKey()
    if (!dbKey) return
    hasRestoredDbDraftRef.current = true

    posts.loadPost(dbKey).then(result => {
      if (!result) return
      draftDbIdRef.current = result.id
      setRestoredDbDraft({ suggestedPostDatetime: result.suggestedPostDatetime ?? null })

      // Read current state inside async callback (avoids stale closure)
      const state = usePostCreationStore.getState()

      // Restore real photo URL if no photo is currently loaded
      if (result.photoUrl && !state.photoContent) {
        setPhotoContent({
          uploadedMedia: [{
            id: 'db-draft-photo',
            file: null as any, // No File object when restoring from DB - will use URL instead
            url: result.photoUrl,
            originalUrl: result.photoUrl,
            type: 'image' as const,
            selectedVersionForPost: 'original' as const,
          }],
          selectedMedia: null,
          isOriginal: true,
          photoAdjustments: null,
          carouselMode: false,
        })
      }

      // Restore text from DB only if localStorage didn't already restore it
      if (result.contentJson) {
        if (activePath === 'write' && !state.writeSelfContent) {
          setWriteSelfContent(result.contentJson as PostContent)
          setWriteSelfStep('create')
        }
      }
    }).catch(err => console.warn('[CreatePostPage] DB draft restore failed:', err))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessData.business?.id])

  // Helper: Compute AI-suggested posting datetime from current idea source
  const computeSuggestedPostDatetime = useCallback((): string | null => {
    if (activePath === 'ai-ideas' && selectedSuggestionData) {
      // Quick suggestions: combine date + suggested_time
      const date = selectedSuggestionData.date // e.g. "2026-06-19"
      const time = selectedSuggestionData.suggested_time // e.g. "22:00:00"
      if (date && time) {
        return `${date}T${time}+00:00` // ISO 8601 format
      }
    } else if (activePath === 'weekly-plan' && weeklyPlanPost?.timing) {
      // Weekly plan: combine timing.date + timing.time
      const date = weeklyPlanPost.timing.date // e.g. "2026-06-23"
      const time = weeklyPlanPost.timing.time // e.g. "09:00"
      if (date && time) {
        return `${date}T${time}:00+00:00` // ISO 8601 format (add seconds if missing)
      }
    }
    return null
  }, [activePath, selectedSuggestionData, weeklyPlanPost])

  // Auto-save postContent + photo URLs whenever they change (Skriv Selv, Weekly Plan).
  // AI Ideer uses daily_suggestions table exclusively until publish.
  // Skip auto-save in Udgiv step to avoid recreating combined draft after platform split.
  useEffect(() => {
    if (!activeContent || activePath === 'ai-ideas' || currentStep === 'publish') return

    // 1. Save text + blob: URL stubs to localStorage (fast, synchronous-feel)
    const photoMedia = photoContent?.uploadedMedia?.map(m => ({
      id: m.id,
      url: m.originalUrl || m.url,
      originalUrl: m.originalUrl,
      adjustedUrl: m.adjustedUrl,
      type: m.type,
      selectedVersionForPost: m.selectedVersionForPost,
      analysisCache: m.analysisCache,
    })) ?? []
    saveDraft({ content: activeContent, photoMedia })

    // 2. Also save to DB draft with a real Storage photo URL.
    //    If the photo is a blob: URL (from the file picker), upload it to Storage first
    //    so the URL persists across page reloads.
    const dbKey = buildDbDraftKey()
    if (!dbKey) return

    const firstMedia = photoContent?.uploadedMedia?.[0]
    const rawPhotoUrl = firstMedia
      ? (firstMedia.selectedVersionForPost === 'adjusted'
          ? firstMedia.adjustedUrl
          : firstMedia.originalUrl ?? firstMedia.url)
      : null

    const timer = setTimeout(async () => {
      let persistedPhotoUrl: string | null = null

      if (rawPhotoUrl && !rawPhotoUrl.startsWith('blob:')) {
        // Already a real Storage URL
        persistedPhotoUrl = rawPhotoUrl
      } else if (
        rawPhotoUrl?.startsWith('blob:') &&
        firstMedia?.file &&
        firstMedia.file.size > 0 &&
        !uploadedBlobsRef.current.has(rawPhotoUrl)
      ) {
        // Upload now and update the store so the real URL propagates everywhere
        const uploaded = await posts.uploadPhoto(dbKey.businessId, firstMedia.file)
        if (uploaded) {
          persistedPhotoUrl = uploaded
          uploadedBlobsRef.current.add(rawPhotoUrl)
          // Replace blob: URL with the real Storage URL in the store
          const state = usePostCreationStore.getState()
          if (state.photoContent) {
            setPhotoContent({
              ...state.photoContent,
              uploadedMedia: state.photoContent.uploadedMedia.map((m, i) =>
                i === 0 ? { ...m, originalUrl: uploaded, url: uploaded } : m
              ),
            })
          }
        }
      }

      const newId = await posts.saveDraft(dbKey, {
        platforms: selectedPlatforms,
        postText: activeContent.text,
        photoUrl: persistedPhotoUrl,
        contentJson: activeContent,
        suggestedPostDatetime: computeSuggestedPostDatetime(),
        // Include weekly plan IDs when saving weekly plan drafts
        ...(activePath === 'weekly-plan' && weeklyPlanPost?.idea_id != null && {
          weeklyPlanIdeaId: Number(weeklyPlanPost.idea_id)
        })
      })
      if (newId) draftDbIdRef.current = newId
    }, 1500) // debounce: save 1.5s after the last change

    return () => clearTimeout(timer)
  }, [activeContent, photoContent, activePath, currentStep, buildDbDraftKey, selectedPlatforms, posts, setPhotoContent, computeSuggestedPostDatetime, weeklyPlanPost])

  // Initialize selected platforms with enabled platforms (all platforms for both tiers)
  useEffect(() => {
    // Use enabledPlatforms from store hook (reactively updates when data loads from database)
    console.log('🔍 CreatePostPage platform init:', { 
      enabledPlatforms, 
      currentTier,
      hasData: enabledPlatforms.length > 0,
      selectedPlatformsLength: selectedPlatforms.length
    })
    // Set all enabled platforms for both FREE and PAID tiers (for preview purposes)
    if (enabledPlatforms.length > 0 && selectedPlatforms.length === 0) {
      console.log('✅ Setting platforms to:', enabledPlatforms)
      setSelectedPlatforms(enabledPlatforms)
    } else if (enabledPlatforms.length === 0) {
      console.log('⏳ Waiting for platforms to load from database...')
    }
  }, [enabledPlatforms, setSelectedPlatforms, currentTier, selectedPlatforms.length])

  // Navigation handlers for 3-step flow
  const handleGenerateNext = async () => {
    // Read from live store to capture any synchronous update from committed card click
    const selectedSuggestionData = usePostCreationStore.getState().selectedSuggestionData
    console.log('[CreatePostPage] handleGenerateNext called')
    console.log('[CreatePostPage] selectedSuggestionData:', selectedSuggestionData)
    console.log('[CreatePostPage] selectedPlatforms:', selectedPlatforms)

    // If this is a committed suggestion, load it in read-only mode instead of blocking
    const isCommitted = selectedSuggestionData?.id != null && committedSuggestionIds.has(selectedSuggestionData.id)
    if (isCommitted) {
      console.log('[CreatePostPage] Loading committed AI suggestion in read-only mode:', selectedSuggestionData.id)
      // Read-only mode is set by the useEffect above based on isCommittedAiSuggestion
      // Continue loading the content below so user can view it
    }
    
    // Check if user selected an AI suggestion
    if (selectedSuggestionData && selectedSuggestionData.id !== 0) {
      console.log('[CreatePostPage] ✨ AI suggestion detected, checking for cached content...')

      // 1️⃣ Check localStorage draft first — this contains any user edits on top of the
      //    original AI output, so it takes priority over the daily_suggestions DB cache.
      //    Drafts are automatically expired after 7 days by useContextDraft, so we don't
      //    need to worry about restoring stale drafts from previous sessions.
      const localDraft = restoreNow() as any
      // Support both old format (PostContent directly) and new format ({ content, photoMedia })
      const localDraftContent = localDraft?.content ?? localDraft
      const localDraftPhotoMedia = localDraft?.photoMedia ?? null
      if (localDraftContent && localDraftContent.text?.trim()) {
        console.log('✅ Restoring user-edited draft from localStorage for suggestion:', selectedSuggestionData.id)
        setActiveContent(localDraftContent)
        if (selectedSuggestionData.photoIdea) setActivePhotoIdea(selectedSuggestionData.photoIdea)
        // Restore photos if saved alongside the draft. The guard on
        // uploadedMedia.length was removed: switching ideas clears photos first
        // (in handleSelectSuggestion), so restoring draft photos is always safe here.
        if (localDraftPhotoMedia?.length) {
          setPhotoContent({
            uploadedMedia: localDraftPhotoMedia.map((m: any) => ({
              id: m.id,
              file: null as any, // No File object when restoring from draft - will use URL instead
              url: m.originalUrl || m.url,
              originalUrl: m.originalUrl,
              adjustedUrl: m.adjustedUrl,
              type: m.type || 'image',
              selectedVersionForPost: m.selectedVersionForPost || 'original',
              analysisCache: m.analysisCache,
            })),
            selectedMedia: null,
            isOriginal: true,
            photoAdjustments: null,
            carouselMode: false,
          })
        }
        // Restore from draft - advance immediately without success delay
        setCurrentStep('create')
        return
      }

      // 1b️⃣ Check DB draft — has the real Storage photo URL (unlike localStorage blob: stubs)
      if (selectedSuggestionData.id != null) {
        const dbKey: DbPostKey = { businessId: businessData.business?.id ?? '', ideaSource: 'quick_suggestions', suggestionId: selectedSuggestionData.id }
        if (dbKey.businessId) {
          const dbDraft = await posts.loadPost(dbKey).catch(() => null)
          const dbDraftContent = dbDraft?.contentJson as PostContent | undefined
          if (dbDraftContent?.text?.trim()) {
            console.log('✅ Restoring draft from DB for suggestion:', selectedSuggestionData.id)
            draftDbIdRef.current = dbDraft!.id
            setActiveContent(dbDraftContent)
            if (selectedSuggestionData.photoIdea) setActivePhotoIdea(selectedSuggestionData.photoIdea)
            if (dbDraft!.photoUrl) {
              setPhotoContent({
                uploadedMedia: [{
                  id: 'db-draft-photo',
                  file: null as any, // No File object when restoring from DB - will use URL instead
                  url: dbDraft!.photoUrl,
                  originalUrl: dbDraft!.photoUrl,
                  type: 'image' as const,
                  selectedVersionForPost: 'original' as const,
                }],
                selectedMedia: null,
                isOriginal: true,
                photoAdjustments: null,
                carouselMode: false,
              })
            }
            // Restore from DB draft - advance immediately without success delay
            setCurrentStep('create')
            return
          }
        }
      }
      
      try {
        const currentBusinessId = businessData.business?.id
        if (!currentBusinessId) {
          throw new Error('Missing business id context for suggestion cache lookup')
        }

        // 2️⃣ Check DB cache (original AI-generated text)
        console.log('🔍 Checking DB cache for suggestion ID:', selectedSuggestionData.id)
        const { data: cachedSuggestion, error: fetchError } = await (supabase as any)
          .from('daily_suggestions')
          .select('generated_text, generated_hashtags, generated_platform_content, generated_at, platforms_generated, text_generation_version')
          .eq('id', selectedSuggestionData.id)
          .eq('business_id', currentBusinessId)
          .single()
        
        if (fetchError) {
          console.error('❌ Error fetching cached content:', fetchError)
        }
        
        console.log('📦 Cache lookup result:', {
          suggestionId: selectedSuggestionData.id,
          hasGeneratedText: !!cachedSuggestion?.generated_text,
          hasGeneratedAt: !!cachedSuggestion?.generated_at,
          platformsInCache: cachedSuggestion?.platforms_generated,
          currentPlatforms: selectedPlatforms,
          cachedTextPreview: cachedSuggestion?.generated_text?.substring(0, 50),
        })
        
        let data
        let hashtagArray
        const platformsMatch = cachedSuggestion?.platforms_generated?.length === selectedPlatforms.length &&
          selectedPlatforms.every(p => cachedSuggestion.platforms_generated?.includes(p))
        const versionMatch = (cachedSuggestion?.text_generation_version ?? 0) >= CURRENT_TEXT_VERSION
        
        // Additional validation: Check cache integrity
        const cacheIsComplete = cachedSuggestion?.generated_text && 
          cachedSuggestion?.generated_at && 
          cachedSuggestion?.platforms_generated &&
          cachedSuggestion?.text_generation_version !== null &&
          cachedSuggestion?.text_generation_version !== undefined
        
        const cacheIsValid = cacheIsComplete && platformsMatch && versionMatch
        
        console.log('🔎 Cache decision:', {
          hasText: !!cachedSuggestion?.generated_text,
          hasTimestamp: !!cachedSuggestion?.generated_at,
          hasPlatforms: !!cachedSuggestion?.platforms_generated,
          hasVersion: cachedSuggestion?.text_generation_version !== null,
          platformsMatch,
          versionMatch,
          cacheIsComplete,
          cachedVersion: cachedSuggestion?.text_generation_version ?? 0,
          currentVersion: CURRENT_TEXT_VERSION,
          willUseCache: cacheIsValid,
          reason: !cacheIsComplete ? 'incomplete cache' : 
                  !platformsMatch ? 'platform mismatch' :
                  !versionMatch ? 'old version' : 'valid cache'
        })
        
        // Use cached content if available, platforms match, and version is current
        if (cacheIsValid) {
          console.log('✅ Loading cached content from database (generated at:', cachedSuggestion.generated_at, ')')
          // Show brief loading for visual feedback (cache loads fast but user should see something happened)
          setIsGenerating(true)
          // Small delay so the loading modal is visible
          await new Promise(resolve => setTimeout(resolve, 300))
          data = {
            sharedText: cachedSuggestion.generated_text,
            facebook: cachedSuggestion.generated_platform_content?.facebook,
            instagram: cachedSuggestion.generated_platform_content?.instagram
          }
          // Use cached hashtags with validation
          if (Array.isArray(cachedSuggestion.generated_hashtags)) {
            hashtagArray = cachedSuggestion.generated_hashtags
          } else {
            console.warn('⚠️ Invalid cached hashtags structure, using empty array')
            hashtagArray = []
          }
        } else {
          // No cache or platforms changed - show loading and generate fresh content
          setIsGenerating(true)
          // Phase 3: Log title or whyExplanation
          console.log('🚀 Generating fresh text from idea:', selectedSuggestionData.title || selectedSuggestionData.whyExplanation)
          
          const rawIdea = selectedSuggestionData._rawIdea
          const rawContentType = selectedSuggestionData.contentType || rawIdea?.idea_type || 'atmosphere'
          
          // Map DB content_type back to generate-text-from-idea expected types
          // DB stores: 'product', 'bts', 'atmosphere'
          // API expects: 'menu_item', 'product_menu', 'behind_scenes', 'atmosphere'
          const contentTypeMap: Record<string, string> = {
            'product': 'product_menu',
            'bts': 'behind_scenes',
            'atmosphere': 'atmosphere',
            'event': 'seasonal',
            'offer': 'menu_item'
          }
          const contentType = contentTypeMap[rawContentType] || rawContentType
          
          const menuItemName = selectedSuggestionData.menuItemName || rawIdea?.menu_item?.name || ''
          // Phase 3: Prefer explicit description; captionBase may not exist for quick suggestions
          const menuItemDescription = selectedSuggestionData.menuItemDescription
            || selectedSuggestionData.captionBase
            || rawIdea?.caption_base
            || ''
          const captionBase = selectedSuggestionData.captionBase || rawIdea?.caption_base || ''
          const ctaIntent = selectedSuggestionData.ctaIntent || rawIdea?.cta_intent || 'visit'
          const { data: generatedData, error } = await supabase.functions.invoke('generate-text-from-idea', {
            body: {
              businessId: businessData.business?.id,
              suggestion: {
                id: selectedSuggestionData.id,
                title: selectedSuggestionData.title,  // Phase 3: May be undefined for quick suggestions, that's OK
                source: 'ai_ideas',
                contentType,
                menuItemId: selectedSuggestionData.menuItemId || rawIdea?.menu_item_id || '',
                menuItemName,
                menuItemDescription,
                captionBase,
                ctaIntent,
                photoIdea: selectedSuggestionData.photoIdea || '',
                whyExplanation: selectedSuggestionData.whyExplanation || '',
                occasionContext: selectedSuggestionData.occasionContext || rawIdea?.occasion_context || '',
              },
              platforms: selectedPlatforms,
              tier: currentTier,
            }
          })
        
        if (error) {
          console.error('❌ Generation error:', error)
          throw error
        }
        
        data = generatedData
        console.log('✅ Generated content:', data)
        
          // Merge platform-specific hashtags into unified structure
          const allHashtags = new Map<string, { tag: string; platforms: string[] }>()
          
          if (data.facebook?.hashtags) {
            data.facebook.hashtags.forEach((tag: string) => {
              const normalized = tag.replace(/^#/, '')
              if (!allHashtags.has(normalized)) {
                allHashtags.set(normalized, { tag: normalized, platforms: [] })
              }
              allHashtags.get(normalized)!.platforms.push('facebook')
            })
          }
          
          if (data.instagram?.hashtags) {
            data.instagram.hashtags.forEach((tag: string) => {
              const normalized = tag.replace(/^#/, '')
              if (!allHashtags.has(normalized)) {
                allHashtags.set(normalized, { tag: normalized, platforms: [] })
              }
              if (!allHashtags.get(normalized)!.platforms.includes('instagram')) {
                allHashtags.get(normalized)!.platforms.push('instagram')
              }
            })
          }
          
          hashtagArray = Array.from(allHashtags.values()).map(({ tag, platforms }) => ({
            tag: `#${tag}`,
            enabled: true,
            platforms
          }))
        
          // Save generated content to database for future use
          try {
            // Validate data before caching
            const textToCache = data.sharedText || data.facebook?.text || ''
            const platformContentToCache = {
              facebook: data.facebook,
              instagram: data.instagram
            }
            
            // Ensure hashtags are valid before caching
            const validHashtags = Array.isArray(hashtagArray) ? hashtagArray.filter(h => 
              h && typeof h === 'object' && h.tag && h.platforms
            ) : []
            
            // Validate platforms array
            const validPlatforms = Array.isArray(selectedPlatforms) && selectedPlatforms.length > 0
              ? selectedPlatforms.filter(p => p === 'facebook' || p === 'instagram')
              : ['facebook'] // Default fallback
            
            if (!textToCache || textToCache.trim().length === 0) {
              console.warn('⚠️ Skipping cache save - empty text generated')
            } else if (!selectedSuggestionData.id) {
              console.warn('⚠️ Skipping cache save - missing suggestion ID')
            } else if (!currentBusinessId) {
              console.warn('⚠️ Skipping cache save - missing business ID')
            } else {
              console.log('💾 Saving generated content to database:', {
                suggestionId: selectedSuggestionData.id,
                businessId: currentBusinessId,
                textLength: textToCache.length,
                hashtagCount: validHashtags.length,
                platforms: validPlatforms,
                version: CURRENT_TEXT_VERSION,
                textPreview: textToCache.substring(0, 50) + '...',
                hasFacebookContent: !!data.facebook,
                hasInstagramContent: !!data.instagram
              })
              
              const { error: saveError } = await (supabase as any)
                .from('daily_suggestions')
                .update({
                  generated_text: textToCache,
                  generated_hashtags: validHashtags,
                  generated_platform_content: platformContentToCache,
                  generated_at: new Date().toISOString(),
                  platforms_generated: validPlatforms,
                  text_generation_version: CURRENT_TEXT_VERSION
                })
                .eq('id', selectedSuggestionData.id)
                .eq('business_id', currentBusinessId)
              
              if (saveError) {
                console.error('❌ Failed to cache generated content:', {
                  error: saveError,
                  code: saveError.code,
                  message: saveError.message,
                  details: saveError.details,
                  hint: saveError.hint
                })
              } else {
                console.log('✅ Successfully cached generated content', {
                  suggestionId: selectedSuggestionData.id,
                  textLength: textToCache.length,
                  hashtagCount: validHashtags.length,
                  platforms: validPlatforms,
                  version: CURRENT_TEXT_VERSION
                })
              }
            }
          } catch (cacheError) {
            console.error('❌ Cache save exception:', {
              error: cacheError,
              message: cacheError instanceof Error ? cacheError.message : 'Unknown error',
              stack: cacheError instanceof Error ? cacheError.stack : undefined
            })
          }
        }
        
        // Use the hashtags from either cache or fresh generation
        // (already stored in hashtagArray variable)
        
        // Phase 3: Get headline from title or whyExplanation
        const headline = selectedSuggestionData.title || selectedSuggestionData.whyExplanation?.split(/[.!?]\s+/)[0] || ''
        
        // Populate store with generated content
        setActiveContent({
          headline,
          text: data.sharedText || data.facebook?.text || '',
          hashtags: hashtagArray,
          adjustments: {
            length: 'current',
            tone: 'brand',
            includeHashtags: true,
            includeEmojis: true,
            includeBookingLink: false
          },
          platformSpecific: selectedPlatforms.length > 1,
          platformContent: {
            facebook: {
              headline,
              // Fall back to sharedText so cache hits without generated_platform_content still render
              text: data.facebook?.text || data.sharedText || '',
              hashtags: hashtagArray.filter((h: any) => h.platforms?.includes('facebook')),
              adjustments: {
                length: 'current',
                tone: 'brand',
                includeHashtags: true,
                includeEmojis: true,
                includeBookingLink: false
              }
            },
            instagram: {
              headline,
              text: data.instagram?.text || data.sharedText || '',
              hashtags: hashtagArray.filter((h: any) => h.platforms?.includes('instagram')),
              adjustments: {
                length: 'current',
                tone: 'brand',
                includeHashtags: true,
                includeEmojis: true,
                includeBookingLink: false
              }
            }
          },
          aiGeneratedHashtags: hashtagArray.map((h: any) => h.tag.replace(/^#/, ''))
        })
        
        // Set photo idea
        if (selectedSuggestionData.photoIdea) {
          setActivePhotoIdea(selectedSuggestionData.photoIdea)
        }

        // Store CTA with booking URL for PublishStep
        setPostCta(data.facebook?.cta || null)

        console.log('✅ Store populated, advancing to Design step')
        
      } catch (err) {
        console.error('❌ Text generation failed:', err)
        console.error('Error details:', err)
        // Show user-facing error — do not silently advance with empty text
        alert('Tekstgenerering fejlede. Prøv igen.')
        setIsGenerating(false)
        setShowGenerationSuccess(false)
        return
      } finally {
        console.log('[CreatePostPage] Generation complete, clearing loading state')
        setIsGenerating(false)
      }
    }
    
    // Only clear photos if switching to a different suggestion to prevent jarring reload
    // when user navigates back to Design from Publish for the same suggestion.
    // CreateStep's useEffect will reload photos from DB if needed.
    const currentSuggestionId = selectedSuggestionData?.id ?? null
    if (activePath === 'ai-ideas' && currentSuggestionId !== previousSuggestionIdRef.current) {
      console.log('[CreatePostPage] Clearing photos - switching from suggestion', previousSuggestionIdRef.current, 'to', currentSuggestionId)
      setPhotoContent(null)
      previousSuggestionIdRef.current = currentSuggestionId
    } else if (activePath === 'ai-ideas') {
      console.log('[CreatePostPage] Keeping photos - same suggestion', currentSuggestionId)
    }

    // Show success state on Generate stage before advancing
    console.log('[CreatePostPage] Showing success state before advancing to Design')
    setShowGenerationSuccess(true)
    await new Promise(resolve => setTimeout(resolve, 1500))
    setShowGenerationSuccess(false)
    
    // Advance to Design step
    console.log('[CreatePostPage] Navigating to Design step')
    setCurrentStep('create')
  }

  // ── HELPER: Update daily_suggestions status ────────────────────────────────
  const updateSuggestionStatus = async (
    suggestionId: number,
    businessId: string,
    status: 'selected' | 'consumed' | 'published'
  ) => {
    const timestampField = status === 'selected' ? 'selected_at' : 
                          status === 'consumed' ? 'consumed_at' : 'published_at'
    
    console.log(`[updateSuggestionStatus] Updating suggestion ${suggestionId} to status=${status}`)
    
    const { error } = await supabase
      .from('daily_suggestions')
      .update({ 
        status, 
        [timestampField]: new Date().toISOString() 
      })
      .eq('id', suggestionId)
      .eq('business_id', businessId)
    
    if (error) {
      console.error(`[updateSuggestionStatus] Failed to update suggestion ${suggestionId}:`, error)
      throw error
    }
    
    console.log(`✅ Suggestion ${suggestionId} status updated to ${status}`)
  }

  // ── HELPER: Build platform-specific draft content ──────────────────────────
  const buildPlatformDraftContent = (
    combinedContentJson: unknown,
    platform: string,
    selectedPlatforms: string[]
  ): { postText: string; contentJson: unknown } => {
    console.log(`[buildPlatformDraftContent] Extracting content for platform: ${platform}`)
    
    // Extract PostContent from the combined draft
    const postContent = combinedContentJson as PostContent
    
    // Use existing utility to extract platform-specific content
    const platformPreview = buildPlatformPreviewContent(
      postContent,
      platform,
      selectedPlatforms
    )
    
    // Build platform-specific content_json (filter hashtags to this platform only)
    const platformContent = postContent.platformContent?.[platform]
    
    const platformSpecificJson: PostContent = {
      headline: platformPreview.headline,
      text: platformPreview.text,
      textWithHashtags: platformPreview.textWithHashtags,
      adjustments: platformContent?.adjustments || postContent.adjustments,
      platformSpecific: true,
      hashtags: platformPreview.hashtags,
      aiGeneratedHashtags: postContent.aiGeneratedHashtags
    }
    
    // Build post_text with hashtags appended (ready for direct publish)
    const postText = platformPreview.textWithHashtags
    
    console.log(`✅ Platform ${platform} content extracted:`, {
      hashtagCount: platformPreview.hashtags.filter(h => h.enabled).length,
      textLength: postText.length,
      hasBookingLink: platformContent?.adjustments?.includeBookingLink
    })
    
    return {
      postText,
      contentJson: platformSpecificJson
    }
  }

  const handleCreateNext = async () => {
    console.log('[handleCreateNext] Advancing from Design → Udgiv')
    console.log('[handleCreateNext] activePath:', activePath)
    console.log('[handleCreateNext] selectedPlatforms:', selectedPlatforms)
    console.log('[handleCreateNext] activeContent:', activeContent)
    
    // Save current text to draftMap so it survives idea switching (weekly plan only)
    if (weeklyContentPlan && activeContent) {
      setDraftMapEntry(weeklyPlanPostIndex, activeContent)
    }

    // Compute suggested posting datetime from AI suggestion
    const suggestedPostDatetime = computeSuggestedPostDatetime()

    // Update suggestion status to 'consumed' when entering Udgiv stage
    if (selectedSuggestionData?.id && businessData?.business?.id) {
      try {
        await updateSuggestionStatus(
          selectedSuggestionData.id,
          businessData.business.id,
          'consumed'
        )
      } catch (err) {
        console.error('[handleCreateNext] Failed to update suggestion status:', err)
        // Non-blocking — continue with draft split even if status update fails
      }
    }

    // Split draft into per-platform drafts when moving to Publish with multiple platforms
    if (selectedPlatforms.length > 1) {
      const baseKey = buildDbDraftKey()
      console.log('[handleCreateNext] baseKey:', baseKey)
      if (baseKey) {
        // Load the current combined draft
        const combinedDraft = await posts.loadPost(baseKey).catch(() => null)
        console.log('[handleCreateNext] combinedDraft:', combinedDraft)
        
        if (combinedDraft && combinedDraft.contentJson) {
          console.log('[handleCreateNext] Splitting draft into platform-specific drafts:', selectedPlatforms)
          console.log('[handleCreateNext] Combined draft platforms:', combinedDraft.platforms)
          
          // Create a platform-specific draft for each selected platform
          for (const platform of selectedPlatforms) {
            console.log(`[handleCreateNext] Processing platform: ${platform}`)
            
            // Extract platform-specific content using helper
            const { postText, contentJson } = buildPlatformDraftContent(
              combinedDraft.contentJson,
              platform,
              selectedPlatforms
            )
            
            // Save platform-specific draft
            const platformKey = { ...baseKey, platform }
            const savedId = await posts.saveDraft(platformKey, {
              platforms: [platform], // Single platform for this draft
              postText,
              contentJson,
              photoUrl: combinedDraft.photoUrl,
              suggestedPostDatetime,
            })
            
            if (savedId) {
              console.log(`✅ Saved ${platform} draft with ${postText.length} chars, ID: ${savedId}`)
            } else {
              console.error(`❌ FAILED to save ${platform} draft! Check console for database errors.`)
              alert(`Failed to save ${platform} draft. Check browser console for details.`)
            }
          }
          
          // Delete the original combined draft
          await posts.deleteByKey(baseKey)
          console.log('[handleCreateNext] ✅ Platform split complete, unified draft deleted')
        } else {
          console.warn('[handleCreateNext] No combined draft or contentJson found for split')
          console.warn('[handleCreateNext] combinedDraft:', combinedDraft)
          console.warn('[handleCreateNext] Will attempt to create platform drafts from activeContent')
          
          // Fallback: create platform drafts from current activeContent
          if (activeContent) {
            for (const platform of selectedPlatforms) {
              const { postText, contentJson } = buildPlatformDraftContent(
                activeContent,
                platform,
                selectedPlatforms
              )
              
              const platformKey = { ...baseKey, platform }
              const savedId = await posts.saveDraft(platformKey, {
                platforms: [platform],
                postText,
                contentJson,
                photoUrl: photoContent?.uploadedMedia?.[0]?.url ?? null,
                suggestedPostDatetime,
              })
              
              if (savedId) {
                console.log(`✅ [Fallback] Saved ${platform} draft with ${postText.length} chars, ID: ${savedId}`)
              } else {
                console.error(`❌ [Fallback] FAILED to save ${platform} draft!`)
                alert(`Failed to save ${platform} draft. Check browser console for details.`)
              }
            }
            console.log('[handleCreateNext] ✅ Platform split complete (fallback)')
          }
        }
      }
    } else {
      // Single platform — update existing draft with suggested datetime
      const baseKey = buildDbDraftKey()
      if (baseKey) {
        const existingDraft = await posts.loadPost(baseKey).catch(() => null)
        if (existingDraft && suggestedPostDatetime) {
          await posts.saveDraft(baseKey, {
            platforms: existingDraft.platforms,
            postText: existingDraft.postText,
            photoUrl: existingDraft.photoUrl,
            contentJson: existingDraft.contentJson,
            suggestedPostDatetime,
          })
          console.log('[handleCreateNext] ✅ Single platform draft updated with suggested datetime')
        }
      }
    }
    
    // Delete write_drafts AFTER successfully persisting to posts (write mode only)
    // This ensures no data loss window - content is in posts before write_drafts is removed
    if (activePath === 'write') {
      await writeDraft.deleteDraft()
      console.log('[handleCreateNext] ✅ Write draft deleted after posts DB persistence')
    }
    
    console.log('[handleCreateNext] Advancing to Udgiv step')
    setCurrentStep('publish')
  }

  // Direct transfer from Weekly Plan: call generate-text-from-idea with strategy data.
  // This mirrors handleGenerateNext but uses PostSpecification fields instead of daily_suggestions.
  // Accepts an optional override post + index for use by handleSwitchToIdea.
  // Build a WeeklyPlanSuggestion from a PostSpecification without triggering text generation.
  // This is used both by handleDirectTransfer and by draft-restore paths so that
  // the photo suggestion (mediaSuggestionStructured) is always available in the design stage.
  const buildWeeklyPlanSuggestion = (plan: NonNullable<typeof weeklyPlanPost>, index: number): WeeklyPlanSuggestion => {
    const isMenuPostType = plan.postType.type === 'menu_item' || plan.postType.type === 'product_menu' || plan.postType.type === 'craving_visual'
    const captionBaseForIdea = isMenuPostType
      ? (plan.contentSubject.menuItemDescription || '')
      : ''
    const guestMoment = !isMenuPostType
      ? (plan.contentSubject.whyThisDish?.[0] || plan.selectionRationale || '')
      : (plan.selectionRationale || '')
    return {
      id: plan.idea_id ? String(plan.idea_id) : `weekly-${index}`,
      title: plan.contentSubject.dish,
      captionBase: captionBaseForIdea,
      source: 'weekly_plan',
      contentType: plan.postType.type,
      menuItemId: plan.contentSubject.menuItemId,
      menuItemName: plan.contentSubject.menuItemName,
      menuItemDescription: plan.contentSubject.menuItemDescription,
      rationale: plan.strategicContext?.rationale,
      goalMode: plan.postType.goal_mode,
      guestMoment: guestMoment || undefined,
      timingDay: plan.timing?.day || undefined,
      timingTime: plan.timing?.time || undefined,
      timingRationale: plan.timing?.rationale || undefined,
      visualSubject: plan.visualDirection?.subject || undefined,
      visualAngle: plan.visualDirection?.angle || undefined,
      visualSetting: plan.visualDirection?.setting || undefined,
      ctaIntent: plan.caption?.ctaType?.split('(')[0].trim() || undefined,  // Normalize: extract intent before parentheses
      platformFormat: plan.platformFormat?.format || undefined,
      selectionRationale: plan.selectionRationale || undefined,
      captionFirstLine: plan.caption?.firstLine || undefined,
      holidayContext: plan.holiday_context
        ? [plan.holiday_context.name, plan.holiday_context.strategic_angle, plan.holiday_context.marketing_hook].filter(Boolean).join(' – ')
        : undefined,
      drinkPairing: plan.strategicContext?.drink_pairing || undefined,
      strategyBrief: plan.strategicContext?.strategy_brief || undefined,
      mediaDirection: plan.strategicContext?.media_direction || undefined,
      sceneSpec: plan.strategicContext?.scene_spec || undefined,
      slotId: plan.strategicContext?.slot_id || undefined,
      strategicIntent: plan.strategicContext?.strategic_intent || undefined,
      slotReasoning: plan.strategicContext?.slot_reasoning || undefined,
    }
  }

  const handleDirectTransfer = async (overridePost?: typeof weeklyPlanPost, overrideIndex?: number) => {
    const plan = overridePost ?? weeklyPlanPost
    const index = overrideIndex ?? weeklyPlanPostIndex
    if (!plan) return

    // Clear any stale photo from a previous session before entering Design
    setPhotoContent(null)

    const suggestion = buildWeeklyPlanSuggestion(plan, index)
    setWeeklyPlanSuggestion(suggestion)

    setIsGenerating(true)
    console.log('[handleDirectTransfer] calling generate-text-from-idea', {
      businessId: weeklyContentPlan?.businessId || businessData.business?.id,
      hastitle: !!(plan.contentSubject?.dish),
      platforms: selectedPlatforms,
      tier: currentTier,
    })
    try {
      const { data, error } = await supabase.functions.invoke('generate-text-from-idea', {
        body: {
          businessId: weeklyContentPlan?.businessId || businessData.business?.id,
          suggestion,
          platforms: selectedPlatforms.length > 0 ? selectedPlatforms : ['instagram', 'facebook'],
          tier: currentTier,
        }
      })

      if (error) throw error

      // Merge platform-specific hashtags into unified PlatformHashtag structure
      const allHashtags = new Map<string, { tag: string; platforms: string[] }>()
      ;(data.facebook?.hashtags || []).forEach((tag: string) => {
        const normalized = tag.replace(/^#/, '')
        if (!allHashtags.has(normalized)) allHashtags.set(normalized, { tag: normalized, platforms: [] })
        allHashtags.get(normalized)!.platforms.push('facebook')
      })
      ;(data.instagram?.hashtags || []).forEach((tag: string) => {
        const normalized = tag.replace(/^#/, '')
        if (!allHashtags.has(normalized)) allHashtags.set(normalized, { tag: normalized, platforms: [] })
        if (!allHashtags.get(normalized)!.platforms.includes('instagram')) {
          allHashtags.get(normalized)!.platforms.push('instagram')
        }
      })
      const hashtagArray = Array.from(allHashtags.values()).map(({ tag, platforms }) => ({
        tag: `#${tag}`,
        enabled: true,
        platforms,
      }))

      const sharedText = data.sharedText || data.facebook?.text || ''

      const transferredContent = {
        headline: plan.contentSubject.dish,
        text: sharedText,
        hashtags: hashtagArray,
        adjustments: {
          length: 'current',
          tone: 'brand',
          includeHashtags: hashtagArray.length > 0,
          includeEmojis: true,
          includeBookingLink: false
        },
        platformSpecific: false,
        platformContent: {
          facebook: {
            headline: plan.contentSubject.dish,
            text: data.facebook?.text || sharedText,
            hashtags: hashtagArray.filter(h => h.platforms?.includes('facebook')),
            adjustments: { length: 'current', tone: 'brand', includeHashtags: true, includeEmojis: true, includeBookingLink: false }
          },
          instagram: {
            headline: '',
            text: data.instagram?.text || sharedText,
            hashtags: hashtagArray.filter(h => h.platforms?.includes('instagram')),
            adjustments: { length: 'current', tone: 'brand', includeHashtags: true, includeEmojis: true, includeBookingLink: false }
          }
        },
        aiGeneratedHashtags: hashtagArray.map((h: { tag: string }) => h.tag.replace(/^#/, ''))
      } as const

      // Guard: user may have switched paths while generation was in flight
      if (usePostCreationStore.getState().activePath !== 'weekly-plan') return
      setPostContent(transferredContent)
      setPostCta(data.facebook?.cta || null)
      setDraftMapEntry(index, transferredContent)

      // Persist generated text to DB so it survives page refresh
      const bizId = weeklyContentPlan?.businessId || businessData.business?.id
      if (bizId && plan.timing.date) {
        posts.saveDraft(
          { businessId: bizId, ideaSource: 'weekly_plan', weeklyPlanSlotDate: plan.timing.date },
          { platforms: selectedPlatforms.length > 0 ? selectedPlatforms : ['instagram', 'facebook'],
            postText: sharedText,
            contentJson: transferredContent },
        ).then(id => { if (id) draftDbIdRef.current = id }).catch(() => {})
      }

      // Stale menu warning — dish was not found in current menu DB
      if (data.warnings?.includes('menu_item_not_found')) {
        console.warn('[handleDirectTransfer] Menu item not found in DB — using Phase 2b description')
        setStaleMenuWarning(plan.contentSubject.dish || 'Ukendt ret')
      }
    } catch (err) {
      console.error('[handleDirectTransfer] Text generation failed:', err)
      // Guard: user may have switched paths while generation was in flight
      if (usePostCreationStore.getState().activePath !== 'weekly-plan') return
      // Stay on Generate step — user can retry via "Brug dette opslag →"
      setIsGenerating(false)
      setShowGenerationSuccess(false)
      alert('Tekstgenerering fejlede. Prøv igen.')
      return
    } finally {
      setIsGenerating(false)
    }

    // Guard: user may have switched paths while generation was in flight
    if (usePostCreationStore.getState().activePath !== 'weekly-plan') return

    // Set photo idea from visual direction
    if (plan.visualDirection) {
      const briefParts = [
        plan.visualDirection.subject,
        plan.visualDirection.angle,
        plan.visualDirection.setting
      ].filter(Boolean)
      setPhotoIdea(briefParts.join(' — '))
    }

    // Mark this plan post as done in the session
    if (weeklyContentPlan) {
      addWeeklyPlanSessionDone(index)
    }

    // Show success state on Generate stage before advancing
    console.log('[handleDirectTransfer] Showing success state before advancing to Design')
    setShowGenerationSuccess(true)
    await new Promise(resolve => setTimeout(resolve, 1500))
    setShowGenerationSuccess(false)

    setCurrentStep('create')
  }

  const handleBackToPlan = () => {
    navigate('/dashboard/ai-weekly-plan')
  }

  // Switch to a different idea from the Design-step tab strip.
  // Saves current text to draftMap, loads the new idea (from draftMap or fresh transfer).
  const handleSwitchToIdea = async (newIndex: number) => {
    if (!weeklyContentPlan || newIndex === weeklyPlanPostIndex || isLoadingWeeklyPlanSwitch) return
    const newPost = weeklyContentPlan.posts[newIndex]
    if (!newPost) return

    console.log('[handleSwitchToIdea] Switching from index', weeklyPlanPostIndex, 'to', newIndex)

    // Prevent rapid switching with loading state
    setIsLoadingWeeklyPlanSwitch(true)

    // Persist current edits before leaving
    if (postContent) {
      setDraftMapEntry(weeklyPlanPostIndex, postContent)
    }
    // Persist current photos before leaving
    if (photoContent) {
      setPhotoDraftMapEntry(weeklyPlanPostIndex, photoContent)
    }

    const newStrategicIdea = {
      title: newPost.contentSubject.dish,
      rationale: newPost.selectionRationale || newPost.postType.category,
      contentType: newPost.postType.type,
      suggestedDay: newPost.timing.day,
      ctaIntent: newPost.caption.ctaType?.split('(')[0].trim(),  // Normalize: extract intent before parentheses
      platformFormat: newPost.platformFormat?.format,
      suggestedMedia: newPost.visualDirection ? {
        type: newPost.platformFormat?.format || 'photo',
        direction: newPost.visualDirection.subject,
        why: newPost.visualDirection.angle,
      } : undefined,
    }

    setWeeklyPlanPost(newPost)
    setStrategicIdea(newStrategicIdea)
    setWeeklyPlanPostIndex(newIndex)

    const savedContent = draftMap[newIndex]
    const savedPhotos = photoDraftMap[newIndex]
    
    // Restore photos if they were saved for this post
    if (savedPhotos) {
      setPhotoContent(savedPhotos)
    } else {
      setPhotoContent(null)
    }
    if (savedContent) {
      // Restore previously saved draft — instant, no transfer needed.
      // Also populate weeklyPlanSuggestion so the photo suggestion stays
      // visible in the design stage when switching between ideas.
      setWeeklyPlanSuggestion(buildWeeklyPlanSuggestion(newPost, newIndex))
      if (newPost.visualDirection) {
        const briefParts = [
          newPost.visualDirection.subject,
          newPost.visualDirection.angle,
          newPost.visualDirection.setting,
        ].filter(Boolean)
        setPhotoIdea(briefParts.join(' — '))
      }
      setPostContent(savedContent)
      setCurrentStep('create')
    } else {
      // No draft yet — run the direct transfer inline (avoids useEffect race condition)
      await handleDirectTransfer(newPost, newIndex)
    }

    // Clear loading state after switch completes
    setIsLoadingWeeklyPlanSwitch(false)
  }

  // PlanContextStrip navigation — delegates to handleSwitchToIdea so draftMap is always respected
  const handleSwitchPlanPost = (rawIndex: number) => handleSwitchToIdea(rawIndex)

  // Exit Weekly Plan flow entirely — go to Skriv Selv with clean state
  const handleNewPost = () => {
    clearWeeklyPlanSession()
    setWeeklyPlanStep('generate')
  }

  const handleCreateBack = () => {
    // Clear the AI Ideer content slot when going back to the generate step.
    // This prevents the auto-save useEffect (which watches `saveDraft`) from
    // cross-writing the current idea's text to a different idea's localStorage key
    // when the user selects a new Dagens Forslag suggestion.
    if (activePath === 'ai-ideas') setAiIdeerContent(null)
    setCurrentStep('generate')
  }

  const handlePublishNext = useCallback(() => {
    // Reset the creation store and go back to the ideas step for a new post
    _resetStore()
    _clearDraft()
    setPublishedInfo(null)
    navigate('/dashboard/create')
  }, [_resetStore, _clearDraft, navigate])

  const handleViewCalendar = useCallback(() => {
    _resetStore()
    _clearDraft()
    setPublishedInfo(null)
    navigate('/dashboard/content/calendar')
  }, [_resetStore, _clearDraft, navigate])

  const handleBackToPlanAfterPublish = useCallback(() => {
    _resetStore()
    _clearDraft()
    setPublishedInfo(null)
    navigate('/dashboard/ai-weekly-plan')
  }, [_resetStore, _clearDraft, navigate])

  /** Called after a successful publish — deletes DB draft + refreshes badges but keeps store content */
  const handlePublishSuccess = useCallback((info: PublishSuccessInfo) => {
    const dbKey = buildDbDraftKey()
    if (dbKey) { posts.deleteByKey(dbKey).catch(() => {}) }
    draftDbIdRef.current = null
    setRestoredDbDraft(null)
    uploadedBlobsRef.current.clear()
    hasRestoredDbDraftRef.current = false
    refreshCommitted()   // re-queries DB — picks up the new weekly_plan_slot_date row
    setPublishedInfo(info)
  }, [buildDbDraftKey, posts, refreshCommitted])

  /** Called after the user cancels/deletes a scheduled post from the success view */
  const handlePublishDeleted = useCallback(() => {
    refreshCommitted()   // clears committed lock badges
    setPublishedInfo(null)
  }, [refreshCommitted])

  /** Called when user deletes draft from Publish stage to unlock editing */
  const handleDraftDeleted = useCallback(async () => {
    console.log('[CreatePostPage] Draft deleted, unlocking editing mode')
    // Delete from posts table (drafts)
    const dbKey = buildDbDraftKey()
    if (dbKey) {
      await posts.deleteByKey(dbKey).catch(() => {})
    }
    // Reset navigation locks
    setHasEnteredUdgiv(false)
    setIsReadOnlyMode(false)
    setPublishedInfo(null)
    refreshCommitted()
    // Return to Design stage for editing
    setCurrentStep('create')
  }, [buildDbDraftKey, posts, refreshCommitted])

  const handlePublishBack = () => {
    setCurrentStep('create')
  }

  const handleStepClick = (step: number) => {
    const steps = ['generate', 'create', 'publish'] as const
    const currentStepIndex = steps.indexOf(currentStep)
    const targetStepIndex = step - 1

    // Track when user first enters Udgiv (step 3)
    if (targetStepIndex === 2) {
      setHasEnteredUdgiv(true)
    }

    // Enable read-only mode when going back after entering Udgiv
    if (hasEnteredUdgiv && targetStepIndex < 2) {
      setIsReadOnlyMode(true)
    } else if (targetStepIndex === 2) {
      setIsReadOnlyMode(false)
    }

    // For weekly-plan: if clicking back to Generate from Design/Publish, navigate to weekly plan page
    if (activePath === 'weekly-plan' && targetStepIndex === 0 && currentStepIndex > 0) {
      console.log('[CreatePostPage] Weekly plan: navigating back to plan overview from stage click')
      navigate('/dashboard/ai-weekly-plan')
      return
    }

    // RULE 1: Block navigation to Publish step (2) for Skriv Selv without content
    // User can go to Design to upload photos, but cannot publish without text OR photos
    if (targetStepIndex === 2 && activePath === 'write') {
      const hasText = activeContent?.text && activeContent.text.trim().length >= 10
      const hasPhotos = photoContent?.uploadedMedia && photoContent.uploadedMedia.length > 0
      if (!hasText && !hasPhotos) {
        console.log('[CreatePostPage] Cannot go to Publish - Skriv Selv requires text or photos')
        return  // Block navigation
      }
    }

    // RULE 2: Block navigation to Publish for AI Ideas without generated content
    if (targetStepIndex === 2 && activePath === 'ai-ideas') {
      const hasText = activeContent?.text && activeContent.text.trim().length >= 10
      const hasPhotos = photoContent?.uploadedMedia && photoContent.uploadedMedia.length > 0
      if (!hasText && !hasPhotos) {
        console.log('[CreatePostPage] Cannot go to Publish - AI Ideas requires generated text or photos')
        return  // Block navigation
      }
    }

    // RULE 3: Block navigation to Publish for Weekly Plan without generated content
    if (targetStepIndex === 2 && activePath === 'weekly-plan') {
      const hasText = activeContent?.text && activeContent.text.trim().length >= 10
      const hasPhotos = photoContent?.uploadedMedia && photoContent.uploadedMedia.length > 0
      if (!hasText && !hasPhotos) {
        console.log('[CreatePostPage] Cannot go to Publish - Weekly Plan requires generated text or photos')
        return  // Block navigation
      }
    }

    // RULE 4: Block navigation from Generate for AI Ideas without selection
    if (currentStepIndex === 0 && targetStepIndex > 0 && activePath === 'ai-ideas') {
      const hasSelection = selectedSuggestionData && selectedSuggestionData.id !== 0
      if (!hasSelection && !activeContent?.text && (!photoContent?.uploadedMedia || photoContent.uploadedMedia.length === 0)) {
        console.log('[CreatePostPage] Cannot advance from Generate - no AI suggestion selected and no manual content')
        return  // Block navigation
      }
    }

    setCurrentStep(steps[targetStepIndex])
  }

  return (
    <div className="bg-gradient-to-br from-slate-50 to-slate-100 py-3 px-3 min-h-full">
      <div className="max-w-6xl mx-auto space-y-4">

        {/* Plan Context Strip — shown only on the weekly-plan path, Generate step only */}
        {activePath === 'weekly-plan' && weeklyContentPlan && currentStep === 'generate' && (
          <PlanContextStrip
            plan={weeklyContentPlan}
            currentIndex={weeklyPlanPostIndex}
            sessionDoneIndices={weeklyPlanSessionDone}
            committedPlanDates={committedWeeklyPlanDates}
            onBack={handleBackToPlan}
            onSwitchPost={handleSwitchPlanPost}
            onNewPost={handleNewPost}
          />
        )}

        {/* Read-Only Mode Banner (shown when viewing locked stages) */}
        {isReadOnlyMode && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="text-2xl">🔒</div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-amber-900 mb-1">
                  Idé og Design er låst
                </h3>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Efter at have nået Udgiv, kan idé og design ikke længere ændres. 
                  Du kan se indholdet, men kun sletning af hele idéen frigør det igen.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* 3-Stage Progress Bar */}
        <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            {/* Stage 1: Write - Clickable */}
            <button
              onClick={() => handleStepClick(1)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg flex-1 border-2 transition-all cursor-pointer ${
                currentStep === 'generate' 
                  ? 'bg-cta-surface border-cta' 
                  : 'bg-green-50 border-green-500 hover:border-green-600'
              }`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs ${
                currentStep === 'generate' 
                  ? 'bg-cta' 
                  : 'bg-green-500'
              }`}>
                {currentStep === 'generate' ? '1' : '✓'}
              </div>
              <div className="flex-1 text-left">
                <div className={`text-sm font-semibold ${
                  currentStep === 'generate' ? 'text-brand' : 'text-green-900'
                }`}>{activePath === 'weekly-plan' ? t('steps.weeklyPlan') : activePath === 'ai-ideas' ? t('steps.aiIdeas') : t('steps.writeSelf')}</div>
                <div className={`text-xs ${
                  currentStep === 'generate' ? 'text-cta-text' : 'text-green-700'
                }`}>
                  {currentStep === 'generate' ? (activePath === 'weekly-plan' ? t('steps.editText') : t('steps.writeText')) : t('steps.textReady')}
                </div>
              </div>
            </button>

            <div className="text-gray-300">→</div>

            {/* Stage 2: Design - Clickable */}
            <button
              onClick={() => handleStepClick(2)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg flex-1 border-2 transition-all cursor-pointer ${
                currentStep === 'create' 
                  ? 'bg-cta-surface border-cta' 
                  : currentStep === 'publish'
                    ? 'bg-green-50 border-green-500 hover:border-green-600'
                    : 'bg-gray-50 border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs ${
                currentStep === 'create' 
                  ? 'bg-cta' 
                  : currentStep === 'publish'
                    ? 'bg-green-500'
                    : 'bg-gray-300'
              }`}>
                {currentStep === 'publish' ? '✓' : '2'}
              </div>
              <div className="flex-1 text-left">
                <div className={`text-sm font-semibold ${
                  currentStep === 'create' ? 'text-brand' : 
                  currentStep === 'publish' ? 'text-green-900' : 
                  'text-gray-500'
                }`}>Design</div>
                <div className={`text-xs ${
                  currentStep === 'create' ? 'text-cta-text' : 
                  currentStep === 'publish' ? 'text-green-700' : 
                  'text-gray-400'
                }`}>
                  {currentStep === 'create' ? t('steps.choosePhoto') : 
                   currentStep === 'publish' ? t('steps.photoReady') : 
                   t('steps.pending')}
                </div>
              </div>
            </button>

            <div className="text-gray-300">→</div>

            {/* Stage 3: Publish - Clickable */}
            <button
              onClick={() => handleStepClick(3)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg flex-1 border-2 transition-all cursor-pointer ${
                currentStep === 'publish' 
                  ? 'bg-cta-surface border-cta' 
                  : 'bg-gray-50 border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs ${
                currentStep === 'publish' ? 'bg-cta' : 'bg-gray-300'
              }`}>
                3
              </div>
              <div className="flex-1 text-left">
                <div className={`text-sm font-semibold ${
                  currentStep === 'publish' ? 'text-brand' : 'text-gray-500'
                }`}>{t('steps.publish')}</div>
                <div className={`text-xs ${
                  currentStep === 'publish' ? 'text-cta-text' : 'text-gray-400'
                }`}>
                  {currentStep === 'publish' ? t('steps.schedule') : t('steps.pending')}
                </div>
              </div>
            </button>
          </div>
        </div>
        
        {/* Step-Specific Content */}
        <div className="transition-all duration-200 ease-in-out">
          {staleMenuWarning && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
              <span>⚠️</span>
              <span>"{staleMenuWarning}" blev ikke fundet i din nuværende menu — teksten er baseret på den originale beskrivelse.</span>
              <button onClick={() => setStaleMenuWarning(null)} className="ml-auto text-amber-600 hover:text-amber-800">✕</button>
            </div>
          )}
          <Suspense fallback={<StepLoader />}>
            {currentStep === 'generate' && activePath !== 'weekly-plan' && (() => {
              const generateLocked = isReadOnlyMode ? false : !!publishedInfo
              return (
                <div key="generate" className="relative">
                  {generateLocked && !isReadOnlyMode && (
                    <>
                      <div className="mb-3 p-3 bg-green-50 border border-green-300 rounded-lg flex items-center gap-2 text-sm text-green-800">
                        <span>✓</span>
                        <span>
                          Opslaget er planlagt — forslagene er låst. Tryk <strong>Opret nyt opslag</strong> for at starte forfra.
                        </span>
                      </div>
                      <div className="absolute inset-0 z-10 cursor-not-allowed" style={{top: '48px'}} />
                    </>
                  )}
                  {isReadOnlyMode && (
                    <div className="absolute inset-0 z-10 cursor-not-allowed bg-slate-100 bg-opacity-40" />
                  )}
                  <GenerateStep 
                    activePath={activePath}
                    onNext={handleGenerateNext}
                    onDirectTransfer={handleDirectTransfer}
                    markAsChanged={markAsChanged}
                    markAsSaved={markAsSaved}
                    hasUnsavedChanges={hasUnsavedChanges}
                    committedSuggestionIds={committedSuggestionIds}
                    isReadOnly={isReadOnlyMode}
                  />
                </div>
              )
            })()}
            
            {currentStep === 'create' && (() => {
              const createLocked = isReadOnlyMode || activePath === 'weekly-plan'
                ? isCommittedWeeklyPlanIdea || committedWeeklyPlanDates.has(weeklyPlanPost?.timing?.date ?? '')
                : !!publishedInfo
              return (
                <div key="create" className="relative">
                  {createLocked && !isReadOnlyMode ? (
                    <div className="mb-3 p-3 bg-green-50 border border-green-300 rounded-lg flex items-center gap-2 text-sm text-green-800">
                      <span>✓</span>
                      <span>
                        {activePath === 'weekly-plan'
                          ? 'Design er låst — dette opslag er allerede planlagt. Vælg et andet opslag i ugeplanen.'
                          : 'Design er låst efter publicering. Tryk Opret nyt opslag for at starte forfra.'}
                      </span>
                    </div>
                  ) : null}
                  {createLocked && <div className="absolute inset-0 z-10 cursor-not-allowed bg-slate-100 bg-opacity-40" />}
                  <CreateStep 
                    onNext={handleCreateNext}
                    onBack={handleCreateBack}
                    onStepClick={handleStepClick}
                    markAsChanged={markAsChanged}
                    markAsSaved={markAsSaved}
                    hasUnsavedChanges={hasUnsavedChanges}
                    suggestionId={selectedSuggestionData?.id}
                    onSwitchIdea={activePath === 'weekly-plan' && weeklyContentPlan ? handleSwitchToIdea : undefined}
                  />
                </div>
              )
            })()}
            
            {currentStep === 'publish' && (
              <div key="publish" className="relative">
                <PublishStep 
                  onNext={handlePublishNext}
                  onBack={handlePublishBack}
                  onStepClick={handleStepClick}
                  onViewCalendar={handleViewCalendar}
                  onBackToPlan={activePath === 'weekly-plan' ? handleBackToPlanAfterPublish : undefined}
                  onPublishSuccess={handlePublishSuccess}
                  onPublishDeleted={handlePublishDeleted}
                  onDraftDeleted={handleDraftDeleted}
                  publishedInfo={publishedInfo}
                  markAsSaved={markAsSaved}
                  hasUnsavedChanges={hasUnsavedChanges}
                  restoredDbDraft={restoredDbDraft}
                />
              </div>
            )}
          </Suspense>
        </div>
      </div>
      
      {/* Loading Modal for AI Text Generation */}
      {isGenerating && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md mx-4 text-center">
            <div className="w-16 h-16 border-4 border-cta border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Genererer tekst med AI
            </h3>
            <p className="text-sm text-gray-600">
              Jeg skriver nu et opslag baseret på din idé...
            </p>
          </div>
        </div>
      )}

      {/* Success Modal - shown briefly after generation completes */}
      {showGenerationSuccess && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md mx-4 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Tekst genereret!
            </h3>
            <p className="text-sm text-gray-600">
              Går til design-fasen...
            </p>
          </div>
        </div>
      )}
    </div>
  )
}