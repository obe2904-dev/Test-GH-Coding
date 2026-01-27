import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { usePostCreationStore, PhotoAdjustments, MediaItem, type PlatformContent } from '../../stores/postCreationStore'
import { useConnectionsStore } from '../../stores/connectionsStore'
import { useAuthStore } from '../../stores/authStore'
import { useTierStore } from '../../stores/tierStore'
import { uploadImageToStorage } from '../../api/image-processing'
import { ProgressStepper } from '../ui/ProgressStepper'
import { UpgradeModal } from '../ui/UpgradeModal'
import { AIAdjustmentControls, PlatformPreview } from './design'
import { buildPlatformPreviewContent } from './publish/utils'
import { PostCreationFooter } from './shared/PostCreationFooter'
import { usePhotoAnalysis } from '../../hooks/usePhotoAnalysis'
import { useBusinessData } from '../../hooks/useBusinessData'

interface CreateStepProps {
  onNext: () => void
  onBack: () => void
  onStepClick?: (step: number) => void
  markAsChanged?: () => void
  markAsSaved?: () => void
  hasUnsavedChanges?: boolean
}

// Icon Components
const ChevronLeft = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
)

const Sparkles = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M12 2l1.09 3.26L16 6.35l-2.91 1.09L12 11l-1.09-3.26L8 6.35l2.91-1.09z"/>
    <path d="M19 9l.69 2.07L22 11.76l-2.31.69L19 15l-.69-2.07L16 11.76l2.31-.69z"/>
    <path d="M5 18l.69 2.07L8 20.76l-2.31.69L5 24l-.69-2.07L2 20.76l2.31-.69z"/>
  </svg>
)

export function CreateStep({ onNext, onBack, onStepClick, markAsChanged, markAsSaved, hasUnsavedChanges }: CreateStepProps) {
  const { t, i18n } = useTranslation(undefined, { keyPrefix: 'createPost' })
  const { postContent, selectedPlatforms, photoContent, photoIdea, setPhotoContent, setSelectedPlatforms } = usePostCreationStore()
  const { loadPlatformsFromDatabase, isEnabled } = useConnectionsStore()
  const { user } = useAuthStore()
  const { currentTier } = useTierStore()
  const businessData = useBusinessData()

  const [previewPlatform, setPreviewPlatform] = useState<'facebook' | 'instagram'>(
    selectedPlatforms[0] === 'instagram' ? 'instagram' : 'facebook'
  )

  // Load platforms when component mounts
  useEffect(() => {
    loadPlatformsFromDatabase()
  }, [loadPlatformsFromDatabase])

  // Sync selected platforms with enabled platforms after loading
  useEffect(() => {
    const availablePlatforms = ['facebook', 'instagram'].filter(platform =>
      isEnabled(platform)
    )
    // Update selected platforms based on tier
    if (availablePlatforms.length > 0 && selectedPlatforms.length === 0) {
      if (currentTier === 'free') {
        // Free tier: default to Facebook only
        setSelectedPlatforms(['facebook'])
      } else {
        // Paid tiers: select all available platforms
        setSelectedPlatforms(availablePlatforms)
      }
    }
  }, [isEnabled, selectedPlatforms.length, setSelectedPlatforms, currentTier])
  
  // Sync preview platform with selected platform (for Free tier)
  useEffect(() => {
    if (currentTier === 'free' && selectedPlatforms.length === 1) {
      const platform = selectedPlatforms[0] as 'facebook' | 'instagram'
      setPreviewPlatform(platform)
    }
  }, [selectedPlatforms, currentTier])

  useEffect(() => {
    if (currentTier === 'free' && selectedPlatforms.length > 1) {
      const preferred = selectedPlatforms.includes('facebook')
        ? 'facebook'
        : selectedPlatforms[0]
      setSelectedPlatforms([preferred])
      setPreviewPlatform(preferred as 'facebook' | 'instagram')
    }
  }, [currentTier, selectedPlatforms, setSelectedPlatforms, setPreviewPlatform])

  // State management
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0)
  const [_processingImage, setProcessingImage] = useState(false) // Currently unused, for future loading states
  const [_viewMode, setViewMode] = useState<'original' | 'adjusted'>('original') // Currently unused, for future view toggle
  
  // Upgrade modal state
  const [showUpgradeModal, setShowUpgradeModal] = useState<'variations' | 'photo-picker' | 'scheduling' | 'tone-length' | null>(null)
  
  // Photo analysis state
  const { analyzePhoto, isAnalyzing, error: analysisError } = usePhotoAnalysis()
  const [analysisResult, setAnalysisResult] = useState<any>(null)
  const [showAnalysis, setShowAnalysis] = useState(false)
  
  // User plan from tier store
  const planLimits = { free: 1, standardplus: 5, premium: 10 }
  const maxPhotos = planLimits[currentTier]

  // AI Adjustment state for current photo
  const [adjustments, setAdjustments] = useState<PhotoAdjustments>({
    cropAndSize: {
      platform: 'both',
      focusMode: 'auto',
      enabled: false
    },
    cleaning: {
      removeBackground: false,
      removeObjects: false,
      reduceBlemishes: false,
      intensity: 30,
      enabled: false
    },
    colorGrading: {
      temperature: 0,
      preset: 'natural',
      enabled: false
    }
  })

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

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

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
        if (file.type.startsWith('image/')) {
          // Create preview URL for display
          const previewUrl = URL.createObjectURL(file)
          
          try {
            // Upload to Supabase Storage
            const originalUrl = await uploadImageToStorage(file, user.id)
            
            newPhotos.push({
              id: Math.random().toString(36).substr(2, 9),
              file,
              url: previewUrl, // Local preview
              originalUrl: originalUrl, // Storage URL
              type: 'image',
              selectedVersionForPost: 'original'
            })
          } catch (uploadError) {
            // Fallback to local blob if upload fails
            newPhotos.push({
              id: Math.random().toString(36).substr(2, 9),
              file,
              url: previewUrl,
              originalUrl: previewUrl,
              type: 'image',
              selectedVersionForPost: 'original'
            })
          }
        }
      }

      setPhotoContent({
        uploadedMedia: [...(photoContent?.uploadedMedia || []), ...newPhotos],
        selectedMedia: null,
        isOriginal: true,
        photoAdjustments: null
      })
      
      markAsChanged?.() // Mark draft as changed when photo is uploaded

      // Select the first newly uploaded photo
      if (newPhotos.length > 0) {
        setSelectedMediaIndex(currentPhotoCount)
      }

    } catch (error) {
      console.error('Error processing image:', error)
      alert('Failed to load image. Please try again.')
    } finally {
      setProcessingImage(false)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // @ts-ignore - Kept for future use
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
        photoAdjustments: null
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

  const handleRemovePhoto = (index: number) => {
    const updatedMedia = photoContent?.uploadedMedia.filter((_: MediaItem, i: number) => i !== index) || []
    setPhotoContent({
      uploadedMedia: updatedMedia,
      selectedMedia: null,
      isOriginal: true,
      photoAdjustments: null
    })

    markAsChanged?.()
    
    // Adjust selected index if necessary
    if (selectedMediaIndex >= updatedMedia.length) {
      setSelectedMediaIndex(Math.max(0, updatedMedia.length - 1))
    }
  }

  // Helper function to generate contextual upgrade text based on analysis
  const getUpgradePromptText = (): string => {
    // Check if we have analysis results with improvement categories
    if (
      analysisResult && 
      'improvementCategories' in analysisResult && 
      analysisResult.improvementCategories && 
      analysisResult.improvementCategories.length > 0
    ) {
      // Map categories to localized improvement terms
      const improvements = analysisResult.improvementCategories
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

    const result = await analyzePhoto(
      currentMedia.originalUrl,
      postContent?.text || '',
      undefined, // businessType - could be fetched from profile
      i18n.language, // language - dynamic based on user preference
      currentTier // tier
    )

    if (result) {
      console.log('Analysis successful:', result)
      setAnalysisResult(result)
      setShowAnalysis(true)
    } else {
      console.error('Analysis failed - no result returned')
      alert(t('photoAnalysis.analysisError'))
    }
  }

  // NEW: Auto enhance - applies all AI adjustments at once
  const handleAutoEnhance = async () => {
    const currentMedia = photoContent?.uploadedMedia[selectedMediaIndex]
    if (!currentMedia) return

    // Set processing state
    const updatedMedia = [...(photoContent?.uploadedMedia || [])]
    updatedMedia[selectedMediaIndex] = {
      ...currentMedia,
      isProcessing: true,
      adjustments: {
        cropAndSize: { platform: 'both', focusMode: 'auto', enabled: true },
        cleaning: { removeBackground: true, removeObjects: true, reduceBlemishes: true, intensity: 30, enabled: true },
        colorGrading: { temperature: 0, preset: 'natural', enabled: true }
      }
    }
    setPhotoContent({
      ...photoContent,
      uploadedMedia: updatedMedia
    })

    try {
      // TODO: Replace with actual AI API call
      // const response = await applyAutoEnhancement(currentMedia.file)
      
      // Simulate AI processing
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Mock adjusted URL (in reality, this would come from AI API)
      const adjustedUrl = currentMedia.url // Replace with actual adjusted image URL
      
      updatedMedia[selectedMediaIndex] = {
        ...currentMedia,
        adjustedUrl,
        isProcessing: false,
        selectedVersionForPost: 'adjusted', // Auto-select AI version
        adjustments: updatedMedia[selectedMediaIndex].adjustments
      }
      
      setPhotoContent({
        ...photoContent,
        uploadedMedia: updatedMedia
      })

      // Switch to AI view
      setViewMode('adjusted')

    } catch (error) {
      console.error('AI auto-enhancement failed:', error)
      updatedMedia[selectedMediaIndex] = {
        ...currentMedia,
        isProcessing: false
      }
      setPhotoContent({
        ...photoContent,
        uploadedMedia: updatedMedia
      })
    }
  }

  const handleApplyAIAdjustments = async (_category: 'cropAndSize' | 'cleaning' | 'colorGrading') => {
    const currentMedia = photoContent?.uploadedMedia[selectedMediaIndex]
    if (!currentMedia) return

    // Set processing state
    const updatedMedia = [...(photoContent?.uploadedMedia || [])]
    updatedMedia[selectedMediaIndex] = {
      ...currentMedia,
      isProcessing: true,
      adjustments: adjustments
    }
    setPhotoContent({
      ...photoContent,
      uploadedMedia: updatedMedia
    })

    try {
      // TODO: Replace with actual AI API call
      // const response = await applyAIAdjustments(currentMedia.file, adjustments[category])
      
      // Simulate AI processing
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // Mock adjusted URL (in reality, this would come from AI API)
      const adjustedUrl = currentMedia.adjustedUrl || currentMedia.url // Replace with actual adjusted image URL
      
      updatedMedia[selectedMediaIndex] = {
        ...currentMedia,
        adjustedUrl,
        isProcessing: false,
        selectedVersionForPost: 'adjusted', // Auto-select AI version
        adjustments: adjustments
      }
      
      setPhotoContent({
        ...photoContent,
        uploadedMedia: updatedMedia
      })

      // Switch to AI view
      setViewMode('adjusted')

    } catch (error) {
      console.error('AI adjustment failed:', error)
      updatedMedia[selectedMediaIndex] = {
        ...currentMedia,
        isProcessing: false
      }
      setPhotoContent({
        ...photoContent,
        uploadedMedia: updatedMedia
      })
    }
  }

  const handleResetAdjustments = () => {
    const currentMedia = photoContent?.uploadedMedia[selectedMediaIndex]
    if (currentMedia) {
      const updatedMedia = [...(photoContent?.uploadedMedia || [])]
      updatedMedia[selectedMediaIndex] = {
        ...currentMedia,
        adjustedUrl: undefined,
        adjustments: undefined,
        selectedVersionForPost: 'original'
      }
      setPhotoContent({
        ...photoContent,
        uploadedMedia: updatedMedia
      })
      
      setViewMode('original')
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // @ts-ignore - Kept for future use
  const _handleSelectVersionForPost = (version: 'original' | 'adjusted') => {
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
  const hasAdjustedVersion = currentPhoto?.adjustedUrl !== undefined

  return (
    <div className="space-y-4">
      {/* Progress Indicator */}
      <ProgressStepper currentStep={2} totalSteps={3} onStepClick={onStepClick} />

      {/* Two Column Layout - tighter spacing, columns aligned to top */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-y-4 gap-x-4 items-start">
        
        {/* LEFT: AI Adjustments & Photo Display */}
        <div className="space-y-3">
          
          {/* Photo tip or AI photo suggestion - only show when no photo uploaded */}
          {!hasPhoto && (
            <div className="p-3 border border-[#D1D5DB] rounded-xl bg-white shadow-sm">
              {photoIdea && photoIdea.trim().length > 0 ? (
                <>
                  <h4 className="text-xs font-semibold text-[#0F2E32] uppercase tracking-wide">
                    💡 Foto-idé
                  </h4>
                  <p className="mt-1 text-sm text-[#374151] leading-snug">{photoIdea}</p>
                </>
              ) : (
                <p className="text-xs text-[#6B7280]">
                  💡 {t('create.photoTip', 'Tip: High-quality images get more engagement. Recommended size: 1200x628px')}
                </p>
              )}
            </div>
          )}

          {/* Photo Analysis Button - Available for all tiers */}
          {hasPhoto && currentPhoto && (
            <div className="p-3 bg-white border border-slate-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-800">{t('photoAnalysis.title')}</h3>
                <button
                  onClick={handleAnalyzePhoto}
                  disabled={isAnalyzing}
                  className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg text-xs font-medium hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
                >
                  {isAnalyzing ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{t('photoAnalysis.analyzing')}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3" />
                      <span>{t('photoAnalysis.analyzeButton')}</span>
                    </>
                  )}
                </button>
              </div>
              {analysisError && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-xs text-red-700">Fejl: {analysisError}</p>
                </div>
              )}
              {analysisResult && showAnalysis && (
                <div className="mt-3 space-y-3">
                  {/* Free Tier - Simplified Display */}
                  {currentTier === 'free' && 'overallFeedback' in analysisResult && (
                    <>
                      {/* Overall Feedback */}
                      <div className="p-3 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg border border-purple-200">
                        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{analysisResult.overallFeedback}</p>
                      </div>

                      {/* Quick Tips */}
                      {analysisResult.quickTips && analysisResult.quickTips.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold text-slate-700">{t('photoAnalysis.quickTips')}</h4>
                          {analysisResult.quickTips.map((tip: string, idx: number) => (
                            <div key={idx} className="p-2 bg-white border border-slate-200 rounded-lg">
                              <p className="text-xs text-slate-700">{tip}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {/* Paid Tier - Detailed Display */}
                  {currentTier !== 'free' && 'overallScore' in analysisResult && (
                    <>
                      {/* Overall Score */}
                      <div className="p-2 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg border border-purple-200">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-700">{t('photoAnalysis.overallScore')}</span>
                          <span className="text-lg font-bold text-purple-600">{analysisResult.overallScore}/100</span>
                        </div>
                      </div>

                      {/* Content Match */}
                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-slate-700">{t('photoAnalysis.contentMatch')}</span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            analysisResult.contentMatch.rating === 'excellent' ? 'bg-green-100 text-green-700' :
                            analysisResult.contentMatch.rating === 'good' ? 'bg-blue-100 text-blue-700' :
                            analysisResult.contentMatch.rating === 'fair' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {t(`photoAnalysis.ratings.${analysisResult.contentMatch.rating}`)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">{analysisResult.contentMatch.feedback}</p>
                      </div>

                      {/* Improvements */}
                      {analysisResult.improvements.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold text-slate-700">{t('photoAnalysis.improvements')}</h4>
                          {analysisResult.improvements.map((improvement: any, idx: number) => (
                            <div key={idx} className="p-2 bg-white border border-slate-200 rounded">
                              <div className="flex items-start justify-between mb-1">
                                <span className="text-xs font-medium text-slate-800">{improvement.title}</span>
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                  improvement.impact === 'high' ? 'bg-red-100 text-red-600' :
                                  improvement.impact === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                                  'bg-blue-100 text-blue-600'
                                }`}>
                                  {t(`photoAnalysis.impact.${improvement.impact}`)}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600">{improvement.description}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  <button
                    onClick={() => setShowAnalysis(false)}
                    className="w-full text-xs text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    {t('photoAnalysis.hideAnalysis')}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Upgrade Prompt - show for Free users ONLY when photo exists */}
          {hasPhoto && currentTier === 'free' && (
            <div className="p-2 bg-[#FEFCE8] border border-[#F6EBA5] rounded-lg">
                <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-[#8C6D1F] flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-[#8C6D1F] leading-tight mb-1">
                    {getUpgradePromptText()}
                    <br />{t('photoAnalysis.upgradePrompt.ctaText')}
                  </p>
                  <button
                    onClick={() => setShowUpgradeModal('photo-picker')}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#8C6D1F] hover:text-[#78350F] underline transition-colors"
                  >
                    {t('photoAnalysis.upgradePrompt.upgradeButton')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* AI Photo Enhancement - Only show for paid users when photo exists */}
          {hasPhoto && currentPhoto && currentTier !== 'free' && (
            <AIAdjustmentControls
              hasAdjustedVersion={hasAdjustedVersion}
              isProcessing={currentPhoto?.isProcessing || false}
              adjustments={adjustments}
              onAutoEnhance={handleAutoEnhance}
              onResetAdjustments={handleResetAdjustments}
              onApplyAdjustment={handleApplyAIAdjustments}
              onUpdateAdjustments={setAdjustments}
            />
          )}
        </div>

        {/* RIGHT: Platform Preview */}
        <div className="space-y-3">
          
          <PlatformPreview
            selectedPlatforms={selectedPlatforms}
            previewPlatform={previewPlatform}
            onPreviewPlatformChange={setPreviewPlatform}
            content={{
              ...platformPreviewContent,
              hashtags: platformPreviewContent.hashtags || []
            }}
            uploadedMedia={photoContent?.uploadedMedia || []}
            selectedMediaIndex={selectedMediaIndex}
            onMediaIndexChange={setSelectedMediaIndex}
            onPhotoUpload={handlePhotoUpload}
            onRemovePhoto={handleRemovePhoto}
            currentTier={currentTier}
            businessName={businessData.business?.name || undefined}
          />
        </div>
      </div>

      {/* Separator line */}
      <div className="border-t border-[#D1D5DB] mt-4"></div>

      {/* Sticky Bottom Bar - Aligned with Write stage */}
      <div className="flex items-start justify-between pt-2 pb-2 gap-3">
        <button
          onClick={onBack}
          className="px-4 py-2 text-xs font-medium text-[#374151] bg-white border border-[#D1D5DB] rounded-lg hover:bg-[#F9FAFB] transition-colors flex items-center gap-1.5"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>{t('create.back', 'Tilbage')}</span>
        </button>

        <PostCreationFooter
          hasUnsavedChanges={Boolean(hasUnsavedChanges)}
          hasPersistedDraft={hasPersistedDraft}
          onSaveDraft={handleSaveDraft}
          onNext={onNext}
          nextLabel={t('create.continue', 'Fortsæt til Planlægning')}
        />
      </div>

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal !== null}
        onClose={() => setShowUpgradeModal(null)}
        feature={showUpgradeModal || 'photo-picker'}
      />

    </div>
  )
}
