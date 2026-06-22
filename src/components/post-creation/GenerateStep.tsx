import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { usePostCreationStore } from '../../stores/postCreationStore'
import type { PostContent } from '../../stores/postCreationStore'
import { useConnectionsStore } from '../../stores/connectionsStore'
import { useTierStore } from '../../stores/tierStore'
import { useBusinessData } from '../../hooks/useBusinessData'
import { useTextHelpers } from '../../hooks/useTextHelpers'
import { usePostCreationAI } from '../../hooks/usePostCreationAI'
import { useWriteDraft } from '../../hooks/useWriteDraft'
import { BusinessSetupModal } from './BusinessSetupModal'
import { BusinessInfoPromptModal } from './BusinessInfoPromptModal'
import { canonicalizePlatformList, normalizeHashtagKey, sanitizeTagValue, type CanonicalPlatform } from '../../lib/hashtags'
import { useHashtagManager } from './hooks/useHashtagManager'
import { useHashtagInteractions } from './hooks/useHashtagInteractions'
import { useDraftPersistence } from './hooks/useDraftPersistence'
import { usePlatformManager } from './hooks/usePlatformManager'
import { useIdeaWorkflow } from './hooks/useIdeaWorkflow'
import { useGenerateValidation } from './hooks/useGenerateValidation'
import { useHashtagInsight } from './hooks/useHashtagInsight'
import { useGenerateState } from './hooks/useGenerateState'
import { useClarificationFlow } from './hooks/useClarificationFlow'
import { usePostCreationFooter } from './hooks/usePostCreationFooter'
import { EditorPane } from './EditorPane'
import { ValidationBanner } from './ValidationBanner'
import { StrategyGeneratedDisplay } from '../StrategyGeneratedDisplay'
import { AiSuggestionsCard } from './AiSuggestionsCard'

interface GeneratedPost {
  ideaId: number
  text: string // Default/shared (Instagram for backward compatibility)
  hashtags: string[] // All hashtags
  emojis: string[]
  platforms: string[]
  ctaIntent: string
  // Platform-specific content (Option A: Dual Generation)
  platformText?: {
    facebook?: string
    instagram?: string
  }
  platformHashtags?: {
    facebook?: string[]
    instagram?: string[]
  }
  suggestedMedia?: {
    type: string
    direction?: string
    why?: string
    photo_count?: number
  }
  suggestedDay?: string
  suggestedTime?: string
  fromTemplate?: boolean
}

interface GenerateStepProps {
  onNext: () => void
  onDirectTransfer?: () => void
  markAsChanged?: () => void
  markAsSaved?: () => void
  hasUnsavedChanges?: boolean
  generatedPost?: GeneratedPost
  isStrategyMode?: boolean
  isGenerating?: boolean
  /** suggestion_ids committed (published/scheduled) today — used to lock cards */
  committedSuggestionIds?: Set<number>
}

export function GenerateStep({ 
  onNext,
  onDirectTransfer,
  markAsChanged, 
  markAsSaved, 
  hasUnsavedChanges,
  generatedPost,
  isStrategyMode = false,
  isGenerating = false,
  committedSuggestionIds,
}: GenerateStepProps) {
  const { t, i18n } = useTranslation(undefined, { keyPrefix: 'createPost' })
  const navigate = useNavigate()

  const {
    selectedPlatforms,
    setSelectedPlatforms,
    aiIdeas,
    setAiIdeas,
    selectedIdea,
    setSelectedIdea,
    postContent,
    setPostContent,
    photoIdea,
    setPhotoIdea,
    photoContent,
    setPhotoContent,
    selectedSuggestionData,
    setSelectedSuggestionData,
    activePath,
    setActivePath
  } = usePostCreationStore()

  const { isEnabled, loadPlatformsFromDatabase } = useConnectionsStore()
  const {
    currentTier,
    getTierLimits,
    canUseAiIdeas,
    canUseCaptionGeneration,
    incrementAiIdeas,
    incrementCaptionGeneration
  } = useTierStore()

  const businessData = useBusinessData()
  const { extractHashtags, removeHashtags } = useTextHelpers()

  const initialHashtags = postContent?.hashtags
    ? postContent.hashtags
        .map((item) => sanitizeTagValue(item.tag))
        .filter((tag) => tag.length > 0)
    : []

  const initialSelectedHashtags = postContent?.hashtags
    ? postContent.hashtags
        .filter((item) => item.enabled)
        .map((item) => sanitizeTagValue(item.tag))
        .filter((tag) => tag.length > 0)
    : []

  const {
    canonicalSelectedPlatforms,
    activePlatform,
    setActivePlatform,
    customizePerPlatform,
    platformTexts,
    setPlatformTexts,
    availablePlatforms,
    getOnboardingPlatforms
  } = usePlatformManager({
    selectedPlatforms,
    setSelectedPlatforms,
    postContent,
    currentTier,
    isEnabled,
    loadPlatformsFromDatabase
  })

  const initialAiGeneratedHashtags = useMemo(
    () =>
      (postContent?.aiGeneratedHashtags ?? [])
        .map((tag) => sanitizeTagValue(tag))
        .filter((tag) => tag.length > 0),
    [postContent?.aiGeneratedHashtags]
  )

  const initialHashtagPlatforms = useMemo(() => {
    if (!postContent?.hashtags) {
      return {}
    }

    const assignments: Record<string, string[]> = {}
    postContent.hashtags.forEach((item) => {
      const clean = sanitizeTagValue(item.tag)
      const key = normalizeHashtagKey(clean)
      if (!key) {
        return
      }

      const platforms = Array.isArray(item.platforms) && item.platforms.length > 0
        ? Array.from(new Set(item.platforms))
        : []

      if (platforms.length > 0) {
        assignments[key] = platforms
      }
    })

    return assignments
  }, [postContent?.hashtags])

  const {
    hashtags,
    setHashtags,
    selectedHashtags,
    setSelectedHashtags,
    aiGeneratedHashtags,
    setAiGeneratedHashtags,
    hashtagPlatforms,
    setHashtagPlatforms,
    appendSelectedHashtags,
    buildPlatformHashtags,
    buildPlatformHashtagViews
  } = useHashtagManager({
    initialHashtags,
    initialSelectedHashtags,
    initialAiGeneratedHashtags,
    initialHashtagPlatforms,
    canonicalSelectedPlatforms
  })

  const resetClarificationStateRef = useRef<() => void>(() => {})
  const resetClarificationStateProxy = useCallback(() => {
    resetClarificationStateRef.current?.()
  }, [])

  // Track loaded content to avoid resetting isEdited on every postContent reference change
  const loadedPostContentRef = useRef<typeof postContent>(null)

  const [isHeadlineEditorVisible, setIsHeadlineEditorVisible] = useState(false)
  const [hasHeadlineFromAI, setHasHeadlineFromAI] = useState(
    Boolean(postContent?.headline && postContent.headline.trim().length > 0)
  )

  // Strategy mode state
  const [isEditingGenerated, setIsEditingGenerated] = useState(false)
  const { strategicIdea, setStrategicIdea, weeklyPlanPost, setWeeklyPlanPost } = usePostCreationStore()

  const {
    headline,
    setHeadline,
    text,
    setText,
    includeEmojis,
    setIncludeEmojis,
    includeHashtags,
    setIncludeHashtags,
    isEdited,
    setIsEdited,
    getCurrentText,
    updateCurrentText: baseUpdateCurrentText,
    handleClearContent: baseHandleClearContent
  } = useGenerateState({
    initialHeadline: postContent?.headline ?? '',
    initialText: postContent?.text ?? '',
    initialIncludeEmojis: postContent?.adjustments?.includeEmojis ?? true,
    initialIncludeHashtags: postContent?.adjustments?.includeHashtags ?? true,
    canonicalSelectedPlatforms,
    customizePerPlatform,
    activePlatform,
    platformTexts,
    setPlatformTexts,
    setHashtags,
    setSelectedHashtags,
    setAiGeneratedHashtags,
    setHashtagPlatforms,
    setSelectedIdea,
    resetClarificationState: resetClarificationStateProxy,
    setPhotoIdea,
    setHasHeadlineFromAI,
    setIsHeadlineEditorVisible,
    markAsChanged
  })

  useEffect(() => {
    setPlatformTexts((prev) => {
      const template = getCurrentText()
      let changed = false
      const next = { ...prev }

      selectedPlatforms.forEach((platform) => {
        if (!next[platform]) {
          next[platform] = {
            headline: template.headline,
            text: template.text
          }
          changed = true
        }
      })

      return changed ? next : prev
    })
  }, [selectedPlatforms, getCurrentText, setPlatformTexts])

  // Strategy mode handlers (moved after useGenerateState to access setText)
  const handleEditGenerated = useCallback(() => {
    if (generatedPost) {
      // Load generated content into editor
      setText(generatedPost.text)
      setHashtags(generatedPost.hashtags)
      setSelectedHashtags(new Set(generatedPost.hashtags))
      setIsEditingGenerated(true)
      setIsEdited(false)
    }
  }, [generatedPost, setText, setHashtags, setSelectedHashtags, setIsEditingGenerated, setIsEdited])

  const handleRegenerateGenerated = useCallback((instructions?: string) => {
    // This will be called from the RegenerateWithInstructionsModal
    // The regeneration logic is handled by StrategicPostCreationPage
    console.log('[GenerateStep] Regenerate requested with instructions:', instructions)
    // TODO: Implement regeneration trigger to parent
  }, [])

  const handleGoToDesignFromGenerated = useCallback(() => {
    if (generatedPost) {
      // Save the generated content to postCreationStore before proceeding
      setPostContent({
        headline: '',
        text: generatedPost.text,
        hashtags: generatedPost.hashtags.map(tag => ({
          tag,
          enabled: true,
          platforms: generatedPost.platforms,
        })),
        aiGeneratedHashtags: generatedPost.hashtags,
        adjustments: {
          length: 'current',
          tone: 'brand',
          includeEmojis: true,
          includeHashtags: true,
          includeBookingLink: false,
        },
      })
    }
    onNext()
  }, [generatedPost, setPostContent, onNext])

  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const [showBusinessSetup, setShowBusinessSetup] = useState(false)
  const [showBusinessInfoPrompt, setShowBusinessInfoPrompt] = useState(false)

  // Track the authenticated business only. Do not trust stale onboarding state.
  const [businessId, setBusinessId] = useState<string | null>(null)

  // DB-only draft persistence for write mode (single source of truth)
  const isWriteMode = activePath === 'write'
  const writeDraft = useWriteDraft({ 
    businessId: businessData?.business?.id || null,
    enabled: isWriteMode 
  })

  // Update businessId when businessData loads
  useEffect(() => {
    const resolvedBusinessId = businessData?.business?.id || null

    if (resolvedBusinessId) {
      setBusinessId(prevBusinessId => {
        if (prevBusinessId === resolvedBusinessId) {
          return prevBusinessId
        }

        console.log('[GenerateStep] Setting businessId from authenticated businessData:', resolvedBusinessId)
        return resolvedBusinessId
      })

      if (typeof window !== 'undefined') {
        const storedBusinessId = localStorage.getItem('onboarding:businessId')
        if (storedBusinessId !== resolvedBusinessId) {
          localStorage.setItem('onboarding:businessId', resolvedBusinessId)
        }
      }
    }
  }, [businessData?.business?.id, businessId])

  // Load draft on mount (write mode only)
  useEffect(() => {
    if (!isWriteMode || !businessData?.business?.id) return

    const loadWriteDraft = async () => {
      const draft = await writeDraft.loadDraft()
      if (draft?.content) {
        console.log('[GenerateStep] Loaded write draft from DB')
        setPostContent(draft.content)
        
        if (draft.photo_content) {
          setPhotoContent(draft.photo_content)
        }
        
        if (draft.selected_platforms && draft.selected_platforms.length > 0) {
          setSelectedPlatforms(draft.selected_platforms)
        }
      }
    }

    loadWriteDraft()
  }, [isWriteMode, businessData?.business?.id]) // Only run on mount when business loads

  // Auto-save draft on content change (write mode only)
  // This provides crash recovery - user can close browser and return to their work.
  useEffect(() => {
    if (!isWriteMode || !businessData?.business?.id) return
    if (!postContent) return

    // Only save if there's actual content (don't save empty drafts)
    const hasContent = postContent.text?.trim() || postContent.headline?.trim()
    if (!hasContent) return

    writeDraft.saveDraft({
      content: postContent,
      photo_content: photoContent,
      selected_platforms: selectedPlatforms
    })
  }, [isWriteMode, businessData?.business?.id, postContent, photoContent, selectedPlatforms, writeDraft])
  
  // Show tabs if: user has a business and not in strategy mode
  // Tabs should always be visible (not dependent on dismissal)
  // Hide when a full Weekly Plan post is loaded (direct transfer available)
  const showAiSuggestions = Boolean(
    businessId && 
    !isStrategyMode &&
    !weeklyPlanPost
  )

  // Debug logging
  console.log('[GenerateStep] AI Suggestions Debug:', {
    businessId,
    businessFromData: businessData?.business?.id,
    isStrategyMode,
    showAiSuggestions,
    activePath
  })

  const hasBusinessProfile = Boolean(businessData.profile || businessData.business)

  // Handler for when user selects an AI suggestion
  const handleSelectSuggestion = useCallback((suggestion: any) => {
    console.log('[GenerateStep] handleSelectSuggestion called with:', suggestion)
    
    if (suggestion.id === 0) {
      setSelectedSuggestionData(null)
      return
    }

    // Store the full suggestion for text generation when user clicks "Next"
    setSelectedIdea(suggestion.id.toString())
    setSelectedSuggestionData(suggestion)
    setActivePath('ai-ideas')
    
    // Photos will be saved/restored automatically by CreatePostPage's draft system
    // No need to manually clear - each suggestion's draft includes its photos

    // Write selection signal to DB for future bias learning (1D)
    if (suggestion.id && businessData.business?.id) {
      void (async () => {
        try {
          const { error } = await (supabase as any)
            .from('daily_suggestions')
            .update({
              status: 'selected',
              selected: true,
              is_active: false,
              selected_at: new Date().toISOString(),
            })
            .eq('id', suggestion.id)
            .eq('business_id', businessData.business!.id)

          if (error) {
            throw error
          }

          console.log(`📊 Suggestion ${suggestion.id} marked as selected`)
        } catch (e: unknown) {
          console.warn('⚠️ Could not mark suggestion as selected:', e)
        }
      })()
    } else if (suggestion.id) {
      console.warn('⚠️ Could not mark suggestion as selected: missing business id context')
    }

    // Clear any previously generated text so the editor never shows stale content
    // from a different idea (e.g. switching from idea 2 to idea 3).
    setPostContent(null)

    // Clear photo state so a photo uploaded for idea A never bleeds into idea B.
    // The draft restore in CreatePostPage will re-populate photos if idea B had
    // its own uploaded photos saved to its draft.
    setPhotoContent({
      uploadedMedia: [],
      selectedMedia: null,
      isOriginal: true,
      photoAdjustments: null,
      carouselMode: false,
    })
    
    console.log('[GenerateStep] Stored suggestion in selectedSuggestionData')
    
    // Store headline but DON'T switch tabs - let user click Next to generate
    setHeadline(suggestion.title)
    
    // Mark as changed
    markAsChanged?.()
  }, [setHeadline, setSelectedIdea, setSelectedSuggestionData, setActivePath, setPostContent, markAsChanged, businessData.business?.id])

  useEffect(() => {
    if (!postContent) {
      return
    }

    // Only load content once on mount or when content significantly changes
    // Don't reset state on every postContent reference change (e.g., auto-save updates)
    const isInitialLoad = loadedPostContentRef.current === null
    const hasContentChanged = 
      loadedPostContentRef.current?.headline !== postContent.headline ||
      loadedPostContentRef.current?.text !== postContent.text
    
    // Skip if this is just a reference change with same content
    if (!isInitialLoad && !hasContentChanged) {
      return
    }

    // Only reset isEdited on INITIAL load, not on subsequent content changes
    // (subsequent changes might be user edits being synced back)
    const shouldResetEditState = isInitialLoad

    loadedPostContentRef.current = postContent

    const recoveredHeadline = postContent.headline ?? ''
    const recoveredText = postContent.text ?? ''

    setHeadline(recoveredHeadline)
    setText(recoveredText)

    const recoveredHashtags = postContent.hashtags ?? []
    const platformAssignments: Record<string, string[]> = {}
    const normalizedTags = recoveredHashtags.map((item) => {
      const clean = sanitizeTagValue(item.tag)
      const key = normalizeHashtagKey(clean)
      const platforms = canonicalizePlatformList(item.platforms)
      if (key && platforms.length > 0) {
        platformAssignments[key] = platforms
      }
      return clean
    })
    const enabledTags = recoveredHashtags
      .filter((item) => item.enabled)
      .map((item) => sanitizeTagValue(item.tag))

    setHashtags(normalizedTags)
    setSelectedHashtags(new Set(enabledTags))
    setAiGeneratedHashtags(new Set((postContent.aiGeneratedHashtags ?? []).map((tag) => sanitizeTagValue(tag))))
    setHashtagPlatforms(platformAssignments)

    const adjustments = postContent.adjustments
    setIncludeHashtags(adjustments?.includeHashtags ?? true)
    setIncludeEmojis(adjustments?.includeEmojis ?? true)

    if (shouldResetEditState) {
      setIsEdited(false)
      setIsSpellingChecked(false)
    }
  }, [postContent])

  const {
    isAIEnhancing,
    isSpellingChecking,
    isSpellingChecked,
    clarificationQuestion,
    clarificationInput,
    errorMessage,
    handleAIUpdate,
    handleSpellingCheck,
    generateHashtagsOnly,
    handleClarificationDismiss,
    handleClarificationSubmit,
    resetClarificationState,
    clearClarificationPrompt,
    setClarificationInput,
    setIsSpellingChecked
  } = usePostCreationAI({
    t,
    language: i18n.language,
    currentTier,
    getTierLimits,
    canUseAiIdeas,
    canUseCaptionGeneration,
    incrementAiIdeas,
    incrementCaptionGeneration,
    businessData,
    getOnboardingPlatforms,
    selectedPlatforms,
    setAiIdeas,
    setShowBusinessInfoPrompt,
    isEnabled,
    photoContent,
    setPhotoIdea,
    includeEmojis,
    includeHashtags,
    setIncludeHashtags,
    customizePerPlatform,
    activePlatform,
    setPlatformTexts,
    setHeadline,
    setText,
    setHashtags,
    setSelectedHashtags,
    setAiGeneratedHashtags,
    hashtagPlatforms,
    setHashtagPlatforms,
    setIsEdited,
    appendSelectedHashtags,
    setPostContent,
    headline,
    hashtags,
    selectedHashtags,
    aiGeneratedHashtags,
    getCurrentText,
    isEdited,
    markAsChanged
  })

  useEffect(() => {
    resetClarificationStateRef.current = resetClarificationState
  }, [resetClarificationState])

  const updateCurrentText = useCallback(
    (field: 'headline' | 'text', value: string) => {
      console.log('[GenerateStep] updateCurrentText wrapper called:', { field, valueLength: value.length })
      baseUpdateCurrentText(field, value)
      setIsSpellingChecked(false)
    },
    [baseUpdateCurrentText, setIsSpellingChecked]
  )

  const createClearedContent = useCallback((): PostContent => {
    const platformContent = customizePerPlatform && selectedPlatforms.length > 1
      ? selectedPlatforms.reduce<Record<string, any>>((acc, platform) => {
          acc[platform] = {
            headline: '',
            text: '',
            adjustments: {
              length: 'current',
              tone: 'professional',
              includeHashtags,
              includeEmojis,
              includeBookingLink: false,
            },
            hashtags: [],
          }
          return acc
        }, {})
      : undefined

    return {
      headline: '',
      text: '',
      textWithHashtags: '',
      adjustments: {
        length: 'current',
        tone: 'professional',
        includeHashtags,
        includeEmojis,
        includeBookingLink: false,
      },
      platformSpecific: Boolean(platformContent),
      platformContent,
      hashtags: [],
      platformHashtagViews: {},
      aiGeneratedHashtags: [],
    }
  }, [customizePerPlatform, selectedPlatforms, includeHashtags, includeEmojis])

  const handleClearContent = useCallback(async () => {
    baseHandleClearContent()
    setPostContent(createClearedContent())
    setIsSpellingChecked(false)
    
    // Delete DB draft for write mode
    if (isWriteMode) {
      await writeDraft.deleteDraft()
    }
  }, [baseHandleClearContent, createClearedContent, setIsSpellingChecked, setPostContent, isWriteMode, writeDraft])

  const { toggleHashtagSelection, handleAddCustomHashtag } = useHashtagInteractions({
    hashtags,
    setHashtags,
    setSelectedHashtags,
    setHashtagPlatforms,
    selectedPlatforms: canonicalSelectedPlatforms,
    setIsEdited,
    setIsSpellingChecked,
    markAsChanged,
    t
  })

  // base implementations now encapsulated by useGenerateState

  const handleSelectPlatforms = useCallback(
    (platforms: string[]) => {
      console.log('[GenerateStep] 📱 handleSelectPlatforms called:', {
        newPlatforms: platforms,
        currentPlatforms: selectedPlatforms,
        customizePerPlatform,
        activePlatform
      });

      setSelectedPlatforms(platforms)

      if (customizePerPlatform) {
        setPlatformTexts((prev) => {
          const template = getCurrentText()
          const next = { ...prev }
          platforms.forEach((platform) => {
            if (!next[platform]) {
              next[platform] = { ...template }
            }
          })
          return next
        })
      }

      if (platforms.length > 0 && !platforms.includes(activePlatform)) {
        console.log('[GenerateStep] 🔄 Switching active platform from', activePlatform, 'to', platforms[0]);
        setActivePlatform(platforms[0])
      }

      console.log('[GenerateStep] ✅ Platform selection complete:', platforms);
      markAsChanged?.()
    },
    [
      setSelectedPlatforms,
      customizePerPlatform,
      setPlatformTexts,
      getCurrentText,
      activePlatform,
      markAsChanged
    ]
  )

  const handleActivePlatformChange = useCallback((platform: string) => {
    setActivePlatform(platform)
  }, [])

  const handleUpgradeNavigate = useCallback(() => {
    navigate('/dashboard/plans')
  }, [navigate])

  const handleEnhanceClick = useCallback(async () => {
    console.log('[GenerateStep] handleEnhanceClick called')
    await handleAIUpdate()
    console.log('[GenerateStep] Setting hasHeadlineFromAI to true')
    setHasHeadlineFromAI(true)
  }, [handleAIUpdate, setHasHeadlineFromAI])

  const handleToggleHeadlineEditor = useCallback(() => {
    setIsHeadlineEditorVisible((prev) => !prev)
  }, [])

  const clarificationProps = useClarificationFlow({
    clarificationQuestion,
    clarificationInput,
    handleClarificationSubmit,
    handleClarificationDismiss,
    setClarificationInput
  })

  const { handleSaveDraft, hasPersistedDraft } = useDraftPersistence({
    getCurrentText,
    hashtags,
    buildPlatformHashtags,
    buildPlatformHashtagViews,
    customizePerPlatform,
    canonicalSelectedPlatforms,
    selectedPlatforms,
    platformTexts,
    appendSelectedHashtags,
    includeHashtags,
    includeEmojis,
    aiGeneratedHashtags,
    photoContent,
    photoIdea,
    postContent,
    setPostContent,
    headline,
    text,
    activePlatform,
    onResetEditedState: () => setIsEdited(false),
    markAsSaved
  })

  const { handleNext: proceedToDesign } = useIdeaWorkflow({
    aiIdeas,
    selectedIdea,
    setSelectedIdea,
    selectedPlatforms,
    canonicalSelectedPlatforms,
    platformTexts,
    setPlatformTexts,
    includeHashtags,
    includeEmojis,
    appendSelectedHashtags,
    buildPlatformHashtags,
    buildPlatformHashtagViews,
    setPostContent,
    aiGeneratedHashtags,
    extractHashtags,
    removeHashtags,
    setHeadline,
    setText,
    setHashtags,
    setSelectedHashtags,
    setAiGeneratedHashtags,
    setHashtagPlatforms,
    setIncludeHashtags,
    setIncludeEmojis,
    setIsEdited,
    setIsSpellingChecked,
    setHasHeadlineFromAI,
    getCurrentText,
    customizePerPlatform,
    markAsChanged,
    clearClarificationPrompt,
    activeTab: 'manual' as const,
    t,
    onNext,
    generateHashtagsOnly
  })

  const { validationIssues, showValidation, validateBeforeNext } = useGenerateValidation({
    selectedPlatforms,
    customizePerPlatform,
    platformTexts,
    text,
    photoContent,
    t,
    activePath,
    selectedSuggestionData
  })

  const selectedSuggestionIsCommitted = Boolean(
    selectedSuggestionData?.id != null &&
    committedSuggestionIds?.has(selectedSuggestionData.id)
  )

  useEffect(() => {
    if (!selectedSuggestionIsCommitted) return

    // A committed AI idea must not re-enter the Create/Design step from the AI flow.
    // Clear the stale selection so the user has to choose a fresh idea.
    setSelectedIdea(null)
    setSelectedSuggestionData(null)
    setPostContent(null)
    setPhotoContent({
      uploadedMedia: [],
      selectedMedia: null,
      isOriginal: true,
      photoAdjustments: null,
      carouselMode: false,
    })
  }, [
    selectedSuggestionIsCommitted,
    setSelectedIdea,
    setSelectedSuggestionData,
    setPostContent,
    setPhotoContent,
  ])

  const handleValidatedNext = useCallback(() => {
    if (!validateBeforeNext()) {
      return
    }
    
    // If an AI suggestion is selected, skip the normal flow and let CreatePostPage handle generation
    if (selectedSuggestionData && selectedSuggestionData.id !== 0) {
      if (selectedSuggestionIsCommitted) {
        console.warn('[GenerateStep] Blocked navigation for committed AI suggestion:', selectedSuggestionData.id)
        return
      }
      console.log('[GenerateStep] AI suggestion selected, calling onNext directly for generation')
      onNext()  // Call CreatePostPage's handleGenerateNext which will do the AI generation
      return
    }
    
    // Normal flow: save current editor content and proceed to Design
    // Note: We keep the DB draft so content carries forward to Design stage
    // Draft is only deleted when user clicks "Slet alt" or publishes
    proceedToDesign()
  }, [validateBeforeNext, proceedToDesign, selectedSuggestionData, selectedSuggestionIsCommitted, onNext])

  const supportedSelectedPlatforms: CanonicalPlatform[] = canonicalSelectedPlatforms

  const platformHashtagViews = useMemo(() => buildPlatformHashtagViews(), [buildPlatformHashtagViews])

  const currentContent = getCurrentText()

  const headlinePlaceholder = t(
    'generate.headlinePlaceholder',
    "You don't need to write a headline – I'll suggest one based on your text."
  )

  const textPlaceholder = t(
    'generate.textPlaceholder',
    'Write your idea or draft here...'
  )

  const canEditHeadline = customizePerPlatform ? activePlatform === 'facebook' : selectedPlatforms.includes('facebook')

  useEffect(() => {
    if (postContent?.headline && postContent.headline.trim().length > 0) {
      setHasHeadlineFromAI(true)
    }
  }, [postContent?.headline])

  useEffect(() => {
    if (!canEditHeadline && isHeadlineEditorVisible) {
      setIsHeadlineEditorVisible(false)
    }
  }, [canEditHeadline, isHeadlineEditorVisible])

  const hashtagInsight = useHashtagInsight({
    includeHashtags,
    hashtags,
    selectedPlatforms: supportedSelectedPlatforms
  })

  console.log('[GenerateStep] State for ActionButtons:', { isEdited, hasHeadlineFromAI })

  const writeContentProps = {
    headline: currentContent.headline,
    text: currentContent.text,
    headlinePlaceholder,
    textPlaceholder,
    onHeadlineChange: (value: string) => updateCurrentText('headline', value),
    onTextChange: (value: string) => updateCurrentText('text', value),
    textAreaRef,
    errorMessage,
    onClear: handleClearContent,
    includeHashtags,
    hashtags,
    selectedHashtags,
    onToggleHashtag: toggleHashtagSelection,
    onAddHashtag: handleAddCustomHashtag,
    selectedPlatforms,
    supportedSelectedPlatforms,
    currentTier,
    availablePlatforms,
    activePlatform,
    onSelectPlatforms: handleSelectPlatforms,
    onActivePlatformChange: handleActivePlatformChange,
    ...clarificationProps,
    hasBusinessProfile,
    onToggleHashtags: (enabled: boolean) => {
      setIncludeHashtags(enabled)
      setIsEdited(true)
      setIsSpellingChecked(false)
      markAsChanged?.()
    },
    onUpgrade: handleUpgradeNavigate,
    onEnhance: handleEnhanceClick,
    onSpellingCheck: handleSpellingCheck,
    isEnhancing: isAIEnhancing,
    isSpellChecking: isSpellingChecking,
    isSpellingChecked,
    isEdited,
    hasAISuggestion: hasHeadlineFromAI,
    canEditHeadline,
    isHeadlineEditorVisible,
    onToggleHeadlineEditor: handleToggleHeadlineEditor,
    showHeadlinePrompt: hasHeadlineFromAI,
    hasHashtags: hashtags.length > 0,
    insight: hashtagInsight,
    platformHashtagViews,
    showClearAll: activePath === 'write'
  }

  const footerProps = usePostCreationFooter({
    hasUnsavedChanges: hasUnsavedChanges ?? false,
    isEdited,
    hasPersistedDraft,
    onSaveDraft: handleSaveDraft,
    onNext: handleValidatedNext,
    disabled: validationIssues.length > 0
  })

  const validationBanner = (
    <ValidationBanner visible={showValidation} issues={validationIssues} />
  )

  return (
    <div className="space-y-4">
      {/* Weekly Plan — Action Card (when a full plan post is loaded) */}
      {activePath === 'weekly-plan' && strategicIdea && weeklyPlanPost && !isStrategyMode && (
        <div className="bg-cta-surface border border-cta-surface rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="text-2xl flex-shrink-0">📅</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-cta uppercase tracking-wide mb-0.5">Fra ugeplanen</div>
              <div className="text-sm font-bold text-slate-900 mb-1 leading-snug">{strategicIdea.title}</div>
              {/* Rationale hidden - shown in popup instead */}
              {/* {strategicIdea.rationale && (
                <div className="text-xs text-cta-text leading-relaxed mb-2">💡 {strategicIdea.rationale}</div>
              )} */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {strategicIdea.contentType && (
                  <span className="inline-flex text-[10px] font-medium bg-cta-surface text-cta-text px-2 py-0.5 rounded-full capitalize">
                    {strategicIdea.contentType.replace(/_/g, ' ')}
                  </span>
                )}
                {strategicIdea.suggestedDay && (
                  <span className="inline-flex text-[10px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                    📆 {strategicIdea.suggestedDay}
                  </span>
                )}
                {strategicIdea.suggestedMedia?.type && (
                  <span className="inline-flex text-[10px] font-medium bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                    📷 {strategicIdea.suggestedMedia.type}
                  </span>
                )}
              </div>
              {/* Visual direction hidden - shown in popup instead */}
              {/* {strategicIdea.suggestedMedia?.direction && (
                <div className="mb-3 text-[11px] text-slate-500 italic">
                  Visuel retning: {strategicIdea.suggestedMedia.direction}
                </div>
              )} */}
              <div className="flex gap-2">
                <button
                  onClick={onDirectTransfer}
                  className="flex-1 sm:flex-none px-4 py-2 bg-cta hover:bg-cta-hover text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  Brug dette opslag →
                </button>
                <button
                  onClick={() => {
                    setStrategicIdea(null)
                    setWeeklyPlanPost(null)
                  }}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 bg-white border border-slate-200 hover:border-slate-300 rounded-lg transition-colors"
                >
                  Skriv selv
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Strategy Mode: Show generated post display if not editing */}
      {isStrategyMode && generatedPost && !isEditingGenerated ? (
        <StrategyGeneratedDisplay
          generatedPost={generatedPost}
          strategicIdea={strategicIdea ? {
            title: strategicIdea.title,
            rationale: strategicIdea.rationale,
            contentType: strategicIdea.contentType ?? '',
            ctaIntent: strategicIdea.ctaIntent,
          } : undefined}
          onEdit={handleEditGenerated}
          onRegenerate={handleRegenerateGenerated}
          onGoToDesign={handleGoToDesignFromGenerated}
          selectedPlatforms={selectedPlatforms}
          onSelectPlatforms={handleSelectPlatforms}
          activePlatform={activePlatform as 'facebook' | 'instagram'}
          onActivePlatformChange={(platform: 'facebook' | 'instagram') => {
            // console.log('[GenerateStep] Platform toggle clicked:', platform);
            setActivePlatform(platform);
          }}
          isGenerating={isGenerating}
        />
      ) : showAiSuggestions ? (
        /* Show content locked to the active path — no tab switching */
        <div className="space-y-4">
          {/* AI Forslag path */}
          <div className={activePath === 'ai-ideas' ? 'block' : 'hidden'}>
            {businessId ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <AiSuggestionsCard
                  onSelectSuggestion={handleSelectSuggestion}
                  onGenerate={handleValidatedNext}
                  businessId={businessId}
                  selectedIdea={selectedIdea}
                  committedSuggestionIds={committedSuggestionIds}
                />
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center text-gray-500">
                Loading...
              </div>
            )}
          </div>

          {/* Skriv Selv path */}
          <div className={activePath !== 'ai-ideas' ? 'block' : 'hidden'}>
            <EditorPane
              writeContentProps={writeContentProps}
              validationBanner={validationBanner}
              footerProps={footerProps}
            />
          </div>
        </div>
      ) : activePath !== 'weekly-plan' || !weeklyPlanPost ? (
        /* Normal Mode or Editing Mode: Show EditorPane */
        <EditorPane
          writeContentProps={writeContentProps}
          validationBanner={validationBanner}
          footerProps={footerProps}
        />
      ) : null}

      <BusinessSetupModal
        isOpen={showBusinessSetup}
        onClose={() => setShowBusinessSetup(false)}
      />

      <BusinessInfoPromptModal
        isOpen={showBusinessInfoPrompt}
        onClose={() => setShowBusinessInfoPrompt(false)}
        onManualInput={() => {
          setShowBusinessInfoPrompt(false)
          window.location.href = '/dashboard/profile?mode=manual'
        }}
        onWebsiteLink={() => {
          setShowBusinessInfoPrompt(false)
          window.location.href = '/dashboard/profile?highlight=website'
        }}
      />
    </div>
  )
}
