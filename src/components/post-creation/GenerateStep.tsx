import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { usePostCreationStore } from '../../stores/postCreationStore'
import { useConnectionsStore } from '../../stores/connectionsStore'
import { useTierStore } from '../../stores/tierStore'
import { ProgressStepper } from '../ui/ProgressStepper'
import { ManualMode, AIIdeasMode } from './modes'
import { useBusinessData } from '../../hooks/useBusinessData'
import { useTextHelpers } from '../../hooks/useTextHelpers'
import { usePostCreationAI } from '../../hooks/usePostCreationAI'
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
import { usePostCreationMode } from './hooks/usePostCreationMode'
import { useGenerateState } from './hooks/useGenerateState'
import { useClarificationFlow } from './hooks/useClarificationFlow'
import { usePostCreationFooter } from './hooks/usePostCreationFooter'
import { ModeTabs } from './ModeTabs'
import { EditorPane } from './EditorPane'
import { SummaryPane } from './SummaryPane'
import { ValidationBanner } from './ValidationBanner'

interface GenerateStepProps {
  onNext: () => void
  onStepClick?: (step: number) => void
  markAsChanged?: () => void
  markAsSaved?: () => void
  hasUnsavedChanges?: boolean
}

export function GenerateStep({ onNext, onStepClick, markAsChanged, markAsSaved, hasUnsavedChanges }: GenerateStepProps) {
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
    photoContent
  } = usePostCreationStore()

  const { isEnabled, loadPlatformsFromDatabase } = useConnectionsStore()
  const {
    currentTier,
    getTierLimits,
    canUseAiIdeas,
    canUseCaptionGeneration,
    incrementAiIdeas,
    incrementCaptionGeneration,
    quotaUsage
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

  const [isHeadlineEditorVisible, setIsHeadlineEditorVisible] = useState(false)
  const [hasHeadlineFromAI, setHasHeadlineFromAI] = useState(
    Boolean(postContent?.headline && postContent.headline.trim().length > 0)
  )

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

  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const [showBusinessSetup, setShowBusinessSetup] = useState(false)
  const [showBusinessInfoPrompt, setShowBusinessInfoPrompt] = useState(false)

  const hasBusinessProfile = Boolean(businessData.profile || businessData.business)

  useEffect(() => {
    if (!postContent) {
      return
    }

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

    setIsEdited(false)
    setIsSpellingChecked(false)
  }, [postContent])

  const {
    isGenerating,
    isAIEnhancing,
    isSpellingChecking,
    isSpellingChecked,
    clarificationQuestion,
    clarificationInput,
    errorMessage,
    generateAiIdeas,
    handleAIUpdate,
    handleSpellingCheck,
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
      baseUpdateCurrentText(field, value)
      setIsSpellingChecked(false)
    },
    [baseUpdateCurrentText, setIsSpellingChecked]
  )

  const handleClearContent = useCallback(() => {
    baseHandleClearContent()
    setIsSpellingChecked(false)
  }, [baseHandleClearContent, setIsSpellingChecked])

  const { toggleHashtagSelection, handleAddCustomHashtag } = useHashtagInteractions({
    hashtags,
    setHashtags,
    setSelectedHashtags,
    setIsEdited,
    setIsSpellingChecked,
    markAsChanged,
    t
  })

  // base implementations now encapsulated by useGenerateState

  const handleSelectPlatforms = useCallback(
    (platforms: string[]) => {
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
        setActivePlatform(platforms[0])
      }
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
    await handleAIUpdate()
    setHasHeadlineFromAI(true)
  }, [handleAIUpdate, setHasHeadlineFromAI])

  const handleToggleHeadlineEditor = useCallback(() => {
    setIsHeadlineEditorVisible((prev) => !prev)
  }, [])

  const handleManualModeEnter = useCallback(() => {
    handleClearContent()
    setIncludeHashtags(true)
    setIncludeEmojis(false)
  }, [handleClearContent, setIncludeHashtags, setIncludeEmojis])

  const handleAIModeEnter = useCallback(() => {
    handleClearContent()
    setIncludeEmojis(true)
    setIncludeHashtags(true)
  }, [handleClearContent, setIncludeEmojis, setIncludeHashtags])

  const {
    activeTab,
    shouldShowEditor,
    handleManualTabSelect,
    handleAITabSelect
  } = usePostCreationMode({
    selectedIdea,
    onManualModeEnter: handleManualModeEnter,
    onAIModeEnter: handleAIModeEnter
  })

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

  const { selectIdea, handleNext: proceedToDesign } = useIdeaWorkflow({
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
    activeTab,
    t,
    onNext
  })

  const { validationIssues, showValidation, validateBeforeNext } = useGenerateValidation({
    selectedPlatforms,
    customizePerPlatform,
    platformTexts,
    text,
    photoContent,
    t
  })

  const handleValidatedNext = useCallback(() => {
    if (!validateBeforeNext()) {
      return
    }
    proceedToDesign()
  }, [validateBeforeNext, proceedToDesign])

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

  const limits = getTierLimits(currentTier)
  const aiIdeasQuota = `${quotaUsage.aiIdeasToday}/${
    Number.isFinite(limits.aiIdeasPerDay) ? limits.aiIdeasPerDay : '∞'
  }`
  const manualTabLabel = t('generate.manualMode', 'Write yourself and get AI help')
  const aiTabLabel = t('generate.aiIdeas', 'AI Ideas for Posts')
  const timeEstimateLabel = t('generate.timeEstimate', 'Estimated time')
  const minutesLabel = t('generate.minutes', 'min')
  const continueLabel = t('generate.continue', 'Continue to Create')
  const timeEstimateMinutes = 3

  const hashtagInsight = useHashtagInsight({
    includeHashtags,
    hashtags,
    selectedPlatforms: supportedSelectedPlatforms
  })

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
    platformHashtagViews
  }

  const footerProps = usePostCreationFooter({
    hasUnsavedChanges: hasUnsavedChanges ?? false,
    isEdited,
    hasPersistedDraft,
    onSaveDraft: handleSaveDraft,
    onNext: handleValidatedNext
  })

  const validationBanner = (
    <ValidationBanner visible={showValidation} issues={validationIssues} />
  )

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <ProgressStepper currentStep={1} totalSteps={3} onStepClick={onStepClick} />
      </div>

      <div className="space-y-4">
        <ModeTabs
          activeTab={activeTab}
          onManualSelect={handleManualTabSelect}
          onAISelect={handleAITabSelect}
          manualLabel={manualTabLabel}
          aiLabel={aiTabLabel}
          aiQuotaLabel={aiIdeasQuota}
        />

        {activeTab === 'manual' && <ManualMode />}

        {activeTab === 'ai' && (
          <AIIdeasMode
            aiIdeas={aiIdeas}
            isGenerating={isGenerating}
            selectedIdea={selectedIdea}
            onGenerateIdeas={generateAiIdeas}
            onSelectIdea={selectIdea}
          />
        )}
      </div>

      {shouldShowEditor && (
        <EditorPane
          writeContentProps={writeContentProps}
          validationBanner={validationBanner}
          footerProps={footerProps}
        />
      )}

      {!shouldShowEditor && (
        <SummaryPane
          validationBanner={validationBanner}
          timeEstimateLabel={timeEstimateLabel}
          timeEstimateMinutes={timeEstimateMinutes}
          minutesLabel={minutesLabel}
          continueLabel={continueLabel}
          onNext={handleValidatedNext}
        />
      )}

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
