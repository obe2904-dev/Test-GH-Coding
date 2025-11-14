import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePostCreationStore, PhotoAdjustments, MediaItem } from '../../stores/postCreationStore'
import { ProgressStepper } from '../ui/ProgressStepper'

interface CreateStepProps {
  onNext: () => void
  onBack: () => void
  onStepClick?: (step: number) => void
}

// Icon Components
const Camera = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
)

const Eye = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
)

const ChevronRight = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
)

const ChevronLeft = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
)

const Upload = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
)

const Edit = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)

const Sparkles = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/>
    <path d="M19 3l.5 1.5L21 5l-1.5.5L19 7l-.5-1.5L17 5l1.5-.5L19 3z"/>
  </svg>
)

const Crop = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M6 2v14a2 2 0 0 0 2 2h14"/>
    <path d="M18 22V8a2 2 0 0 0-2-2H2"/>
  </svg>
)

const Eraser = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M20 20H9.5L2 12.5 9.5 5 21 16.5V20z"/>
    <path d="M8.5 8.5L15.5 15.5"/>
  </svg>
)

const Palette = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 2-.5 2-2 0-.5-.2-1-.4-1.4-.2-.4-.4-.8-.4-1.4 0-1.1.9-2 2-2h2.3c3 0 5.5-2.5 5.5-5.5C22 6.5 17.5 2 12 2z"/>
    <circle cx="7" cy="12" r="1.5"/>
    <circle cx="12" cy="8" r="1.5"/>
    <circle cx="17" cy="12" r="1.5"/>
  </svg>
)

const X = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

const Check = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

const RefreshCw = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <polyline points="23 4 23 10 17 10"/>
    <polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
)

const Loader = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/>
  </svg>
)

const ChevronDown = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
)

const Zap = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
)

export function CreateStep({ onNext, onBack, onStepClick }: CreateStepProps) {
  const { t } = useTranslation(undefined, { keyPrefix: 'createPost' })
  const { postContent, selectedPlatforms, photoContent, setPhotoContent } = usePostCreationStore()

  // State management
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0)
  const [viewMode, setViewMode] = useState<'original' | 'adjusted'>('original')
  const [previewPlatform, setPreviewPlatform] = useState<'facebook' | 'instagram'>(
    selectedPlatforms[0] === 'instagram' ? 'instagram' : 'facebook'
  )
  
  // Manual controls state
  const [showManualControls, setShowManualControls] = useState(false)
  
  // User plan - TODO: Get from auth context
  const userPlan: 'free' | 'standardPlus' | 'premium' = 'free'
  const planLimits = { free: 1, standardPlus: 5, premium: 10 }
  const maxPhotos = planLimits[userPlan]

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

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    const currentPhotoCount = photoContent?.uploadedMedia?.length || 0
    const availableSlots = maxPhotos - currentPhotoCount
    
    if (availableSlots <= 0) {
      // Show upgrade modal or message
      return
    }

    const newPhotos: MediaItem[] = []
    const filesToProcess = Array.from(files).slice(0, availableSlots)

    filesToProcess.forEach(file => {
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file)
        newPhotos.push({
          id: Math.random().toString(36).substr(2, 9),
          file,
          url,
          originalUrl: url,
          type: 'image',
          selectedVersionForPost: 'original' // Default to original
        })
      }
    })

    setPhotoContent({
      uploadedMedia: [...(photoContent?.uploadedMedia || []), ...newPhotos],
      selectedMedia: null,
      isOriginal: true,
      photoAdjustments: null
    })

    // Select the first newly uploaded photo
    if (newPhotos.length > 0) {
      setSelectedMediaIndex(currentPhotoCount)
    }
  }

  const handleRemovePhoto = (index: number) => {
    const updatedMedia = photoContent?.uploadedMedia.filter((_, i) => i !== index) || []
    setPhotoContent({
      uploadedMedia: updatedMedia,
      selectedMedia: null,
      isOriginal: true,
      photoAdjustments: null
    })
    
    // Adjust selected index if necessary
    if (selectedMediaIndex >= updatedMedia.length) {
      setSelectedMediaIndex(Math.max(0, updatedMedia.length - 1))
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
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Mock adjusted URL (in reality, this would come from AI API)
      const adjustedUrl = currentMedia.url // Replace with actual adjusted image URL
      
      updatedMedia[selectedMediaIndex] = {
        ...currentMedia,
        adjustedUrl,
        isProcessing: false,
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

  const handleResetAdjustments = (category?: 'cropAndSize' | 'cleaning' | 'colorGrading') => {
    if (category) {
      // Reset specific category
      setAdjustments(prev => ({
        ...prev,
        [category]: {
          ...prev[category],
          enabled: false
        }
      }))
    } else {
      // Reset all
      setAdjustments({
        cropAndSize: { platform: 'both', focusMode: 'auto', enabled: false },
        cleaning: { removeBackground: false, removeObjects: false, reduceBlemishes: false, intensity: 30, enabled: false },
        colorGrading: { temperature: 0, preset: 'natural', enabled: false }
      })
      
      // Remove adjusted versions
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
      }
      
      setViewMode('original')
    }
  }

  // NEW: Select which version to use for the post
  const handleSelectVersionForPost = (version: 'original' | 'adjusted') => {
    const currentMedia = photoContent?.uploadedMedia[selectedMediaIndex]
    if (!currentMedia) return

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

  const hasPhoto = photoContent?.uploadedMedia && photoContent.uploadedMedia.length > 0
  const currentPhoto = photoContent?.uploadedMedia?.[selectedMediaIndex]
  const hasAdjustedVersion = currentPhoto?.adjustedUrl !== undefined

  // Get the URL to display based on current view mode
  const displayUrl = viewMode === 'adjusted' && currentPhoto?.adjustedUrl 
    ? currentPhoto.adjustedUrl 
    : currentPhoto?.url

  // Get the URL to use in preview (based on selected version for post)
  const getPreviewUrl = (photo: MediaItem) => {
    if (photo.selectedVersionForPost === 'adjusted' && photo.adjustedUrl) {
      return photo.adjustedUrl
    }
    return photo.url
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center mb-3">
        <h1 className="text-2xl font-bold text-slate-800 mb-1">
          {t('create.title', 'Add Photo & Preview')}
        </h1>
        <p className="text-base text-slate-600">
          {t('create.subtitle', 'Upload photos and enhance them with AI')}
        </p>
      </div>

      {/* Progress Stepper */}
      <ProgressStepper currentStep={2} totalSteps={3} onStepClick={onStepClick} />

      {/* Edit Text Button */}
      <div className="flex justify-end">
        <button
          onClick={onBack}
          className="px-3 py-1.5 border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 transition-all font-medium text-xs flex items-center gap-1.5"
        >
          <Edit className="w-3 h-3" />
          <span>{t('create.editText', 'Edit Text')}</span>
        </button>
      </div>

      {/* Two Column Layout - NOW EQUAL WIDTH (1:1) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* LEFT: Photo Upload & AI Adjustments */}
        <div className="space-y-3">
          
          {/* Photo Upload Area with Thumbnail Gallery */}
          <div className="bg-white rounded-lg shadow-md border border-slate-200 p-3">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-2">
              <Camera className="w-4 h-4 text-indigo-600" />
              {t('create.uploadPhoto', hasPhoto ? 'Your Photos' : 'Upload Photo')}
            </h3>

            {/* Thumbnail Gallery - Shows ABOVE main photo for multiple photos */}
            {hasPhoto && photoContent.uploadedMedia.length > 1 && (
              <div className="mb-3 p-2 bg-slate-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-700">
                    {photoContent.uploadedMedia.length} {t('create.photos', 'photos')} ({selectedMediaIndex + 1} {t('create.selected', 'selected')})
                  </span>
                  {photoContent.uploadedMedia.length < maxPhotos && (
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-indigo-600 font-medium hover:underline flex items-center gap-1"
                    >
                      <Upload className="w-3 h-3" />
                      {t('create.addMore', 'Add')}
                    </button>
                  )}
                </div>
                
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {photoContent.uploadedMedia.map((media, index) => (
                    <div 
                      key={media.id}
                      className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                        index === selectedMediaIndex 
                          ? 'border-indigo-600 shadow-lg ring-2 ring-indigo-200' 
                          : 'border-slate-200 hover:border-slate-400'
                      }`}
                      onClick={() => {
                        setSelectedMediaIndex(index)
                        setViewMode(media.selectedVersionForPost || 'original')
                      }}
                    >
                      <img 
                        src={getPreviewUrl(media)}
                        alt={`Photo ${index + 1}`} 
                        className="w-full h-full object-cover" 
                      />
                      {index === selectedMediaIndex && (
                        <div className="absolute inset-0 bg-indigo-600 bg-opacity-20 flex items-center justify-center">
                          <Check className="w-5 h-5 text-white drop-shadow-lg" />
                        </div>
                      )}
                      {media.adjustedUrl && (
                        <div className="absolute top-1 right-1">
                          <Sparkles className="w-3 h-3 text-yellow-400 drop-shadow" />
                        </div>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemovePhoto(index)
                        }}
                        className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-600 rounded-full flex items-center justify-center hover:bg-red-700 transition-colors shadow-md"
                      >
                        <X className="w-2.5 h-2.5 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!hasPhoto ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-all"
              >
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-medium text-slate-700 mb-1">
                  {t('create.clickToUpload', 'Click to upload photo')}
                </p>
                <p className="text-xs text-slate-500">
                  {t('create.supportedFormats', 'JPG, PNG or GIF')}
                </p>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple={userPlan !== 'free'}
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="space-y-2">
                {/* Main Photo Display with View Toggle */}
                <div className="relative rounded-lg overflow-hidden">
                  {currentPhoto?.isProcessing && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
                      <div className="text-center">
                        <Loader className="w-8 h-8 text-white animate-spin mx-auto mb-2" />
                        <p className="text-xs font-medium text-white">
                          {t('create.processingAI', 'Enhancing with AI...')}
                        </p>
                      </div>
                    </div>
                  )}
                  <img
                    src={displayUrl}
                    alt="Upload"
                    className="w-full h-64 object-cover"
                  />
                  
                  {/* View Mode Toggle - Overlaid on image */}
                  {hasAdjustedVersion && (
                    <div className="absolute top-2 left-2 flex gap-1 bg-black/50 rounded-lg p-1">
                      <button
                        onClick={() => setViewMode('original')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                          viewMode === 'original'
                            ? 'bg-white text-slate-900 shadow-md'
                            : 'text-white hover:bg-white/20'
                        }`}
                      >
                        {t('create.original', 'Original')}
                      </button>
                      <button
                        onClick={() => setViewMode('adjusted')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
                          viewMode === 'adjusted'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'text-white hover:bg-white/20'
                        }`}
                      >
                        <Sparkles className="w-3 h-3" />
                        {t('create.aiEnhanced', 'AI Enhanced')}
                      </button>
                    </div>
                  )}

                  {/* Remove button */}
                  <button
                    onClick={() => handleRemovePhoto(selectedMediaIndex)}
                    className="absolute top-2 right-2 px-2 py-1 bg-red-600 text-white rounded-lg shadow-lg text-xs font-semibold hover:bg-red-700 transition-all"
                  >
                    {t('create.remove', 'Remove')}
                  </button>
                </div>
                
                {/* Select Version for Post - NEW */}
                {hasAdjustedVersion && (
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-xs font-medium text-slate-700 mb-2">
                      {t('create.selectVersionForPost', 'Which version to use in your post?')}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          handleSelectVersionForPost('original')
                          setViewMode('original')
                        }}
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                          currentPhoto.selectedVersionForPost === 'original'
                            ? 'bg-slate-700 text-white border-2 border-slate-800'
                            : 'bg-white text-slate-700 border border-slate-300 hover:border-slate-400'
                        }`}
                      >
                        {currentPhoto.selectedVersionForPost === 'original' && (
                          <Check className="w-3 h-3 inline mr-1" />
                        )}
                        {t('create.useOriginal', 'Use Original')}
                      </button>
                      <button
                        onClick={() => {
                          handleSelectVersionForPost('adjusted')
                          setViewMode('adjusted')
                        }}
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                          currentPhoto.selectedVersionForPost === 'adjusted'
                            ? 'bg-indigo-600 text-white border-2 border-indigo-700'
                            : 'bg-white text-slate-700 border border-slate-300 hover:border-slate-400'
                        }`}
                      >
                        {currentPhoto.selectedVersionForPost === 'adjusted' && (
                          <Check className="w-3 h-3" />
                        )}
                        <Sparkles className="w-3 h-3" />
                        {t('create.useAI', 'Use AI Enhanced')}
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Upload more button (for paid plans) */}
                {userPlan !== 'free' && photoContent.uploadedMedia.length < maxPhotos && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full px-3 py-1.5 border border-dashed border-slate-300 rounded-lg text-xs text-slate-600 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center gap-1"
                  >
                    <Upload className="w-3 h-3" />
                    {t('create.addMorePhotos', 'Add More Photos')} ({photoContent.uploadedMedia.length}/{maxPhotos})
                  </button>
                )}
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple={userPlan !== 'free'}
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </div>
            )}

            <div className="mt-2 p-2 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-600">
                💡 {t('create.photoTip', 'Tip: High-quality images get more engagement. Recommended size: 1200x628px')}
              </p>
            </div>
          </div>

          {/* AI Adjustments Panel - Auto + Manual Options */}
          {hasPhoto && currentPhoto && (
            <div className="bg-white rounded-lg shadow-md border border-slate-200 p-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  {t('create.aiAdjustments', 'AI Photo Enhancement')}
                </h3>
                {hasAdjustedVersion && (
                  <button
                    onClick={() => handleResetAdjustments()}
                    className="text-xs text-slate-600 hover:text-red-600 font-medium flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    {t('create.reset', 'Reset')}
                  </button>
                )}
              </div>

              {/* AUTO MODE - Just Do It Button */}
              <button
                onClick={handleAutoEnhance}
                disabled={currentPhoto?.isProcessing}
                className="w-full px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-bold text-sm flex items-center justify-center gap-2 mb-3 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              >
                <Zap className="w-4 h-4" />
                {t('create.autoEnhance', 'Auto Enhance Photo')}
              </button>

              {/* Expandable Manual Controls */}
              <button
                onClick={() => setShowManualControls(!showManualControls)}
                className="w-full px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-all font-medium text-xs flex items-center justify-between"
              >
                <span>{t('create.manualControls', 'Manual Controls (Advanced)')}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showManualControls ? 'rotate-180' : ''}`} />
              </button>

              {/* Manual Controls - Collapsible */}
              {showManualControls && (
                <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
                  
                  {/* Category 1: Crop & Size */}
                  <div className="border border-slate-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                        <Crop className="w-4 h-4 text-indigo-600" />
                        {t('create.cropAndSize', 'Crop & Size')}
                      </h4>
                    </div>
                    
                    <p className="text-xs text-slate-600 mb-2">
                      {t('create.cropDescription', 'Optimize for social media platforms')}
                    </p>
                    
                    {/* Platform Selection */}
                    <div className="mb-2">
                      <label className="text-xs font-medium text-slate-700 mb-1 block">
                        {t('create.optimizeFor', 'Optimize for')}
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setAdjustments(prev => ({
                            ...prev,
                            cropAndSize: { ...prev.cropAndSize, platform: 'facebook' }
                          }))}
                          className={`px-2 py-1.5 text-xs font-medium rounded-md transition-all ${
                            adjustments.cropAndSize.platform === 'facebook'
                              ? 'bg-blue-100 text-blue-700 border border-blue-300'
                              : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          Facebook
                        </button>
                        <button
                          onClick={() => setAdjustments(prev => ({
                            ...prev,
                            cropAndSize: { ...prev.cropAndSize, platform: 'instagram' }
                          }))}
                          className={`px-2 py-1.5 text-xs font-medium rounded-md transition-all ${
                            adjustments.cropAndSize.platform === 'instagram'
                              ? 'bg-pink-100 text-pink-700 border border-pink-300'
                              : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          Instagram
                        </button>
                        <button
                          onClick={() => setAdjustments(prev => ({
                            ...prev,
                            cropAndSize: { ...prev.cropAndSize, platform: 'both' }
                          }))}
                          className={`px-2 py-1.5 text-xs font-medium rounded-md transition-all ${
                            adjustments.cropAndSize.platform === 'both'
                              ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                              : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          Both
                        </button>
                      </div>
                    </div>
                    
                    {/* Focus Mode */}
                    <div className="mb-3">
                      <label className="text-xs font-medium text-slate-700 mb-1 block">
                        {t('create.focusOn', 'Focus on')}
                      </label>
                      <select 
                        value={adjustments.cropAndSize.focusMode}
                        onChange={(e) => setAdjustments(prev => ({
                          ...prev,
                          cropAndSize: { ...prev.cropAndSize, focusMode: e.target.value as any }
                        }))}
                        className="w-full text-sm border border-slate-300 rounded-md px-2 py-1.5"
                      >
                        <option value="auto">{t('create.autoDetect', 'Auto-detect main subject')}</option>
                        <option value="center">{t('create.center', 'Center')}</option>
                        <option value="face">{t('create.faceDetection', 'Face detection')}</option>
                        <option value="product">{t('create.productFocus', 'Product focus')}</option>
                      </select>
                    </div>
                    
                    <button
                      onClick={() => handleApplyAIAdjustments('cropAndSize')}
                      disabled={currentPhoto?.isProcessing}
                      className="w-full px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all font-medium text-xs flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {t('create.applyCrop', 'Apply Smart Crop')}
                    </button>
                  </div>

                  {/* Category 2: Cleaning (Most Important) */}
                  <div className="border-2 border-indigo-200 rounded-lg p-3 bg-indigo-50/30">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                        <Eraser className="w-4 h-4 text-indigo-600" />
                        {t('create.cleaning', 'Photo Cleaning')}
                      </h4>
                      <span className="px-2 py-0.5 bg-indigo-600 text-white text-xs font-bold rounded-full">
                        {t('create.recommended', 'TOP')}
                      </span>
                    </div>
                    
                    <p className="text-xs text-slate-600 mb-3">
                      💡 {t('create.cleaningTip', 'Subtle removal only - keeps natural look')}
                    </p>
                    
                    {/* Cleaning Options */}
                    <div className="space-y-2 mb-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={adjustments.cleaning.removeBackground}
                          onChange={(e) => setAdjustments(prev => ({
                            ...prev,
                            cleaning: { ...prev.cleaning, removeBackground: e.target.checked }
                          }))}
                          className="rounded w-4 h-4"
                        />
                        <span className="text-sm text-slate-700">
                          {t('create.removeBackground', 'Remove background distractions')}
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={adjustments.cleaning.removeObjects}
                          onChange={(e) => setAdjustments(prev => ({
                            ...prev,
                            cleaning: { ...prev.cleaning, removeObjects: e.target.checked }
                          }))}
                          className="rounded w-4 h-4"
                        />
                        <span className="text-sm text-slate-700">
                          {t('create.removeObjects', 'Remove unwanted objects')}
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={adjustments.cleaning.reduceBlemishes}
                          onChange={(e) => setAdjustments(prev => ({
                            ...prev,
                            cleaning: { ...prev.cleaning, reduceBlemishes: e.target.checked }
                          }))}
                          className="rounded w-4 h-4"
                        />
                        <span className="text-sm text-slate-700">
                          {t('create.reduceBlemishes', 'Minor blemish reduction')}
                        </span>
                      </label>
                    </div>
                    
                    {/* Intensity Slider */}
                    <div className="mb-3">
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-medium text-slate-700">
                          {t('create.intensity', 'Cleaning Intensity')}
                        </label>
                        <span className="text-xs text-slate-600">
                          {adjustments.cleaning.intensity < 40 ? 'Subtle' : 
                           adjustments.cleaning.intensity < 70 ? 'Moderate' : 'Strong'}
                        </span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={adjustments.cleaning.intensity}
                        onChange={(e) => setAdjustments(prev => ({
                          ...prev,
                          cleaning: { ...prev.cleaning, intensity: parseInt(e.target.value) }
                        }))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-xs text-slate-500 mt-1">
                        <span>Natural</span>
                        <span>Moderate</span>
                        <span>Strong</span>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleApplyAIAdjustments('cleaning')}
                      disabled={currentPhoto?.isProcessing}
                      className="w-full px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all font-medium text-xs flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {t('create.applyCleaning', 'Apply Smart Cleaning')}
                    </button>
                  </div>

                  {/* Category 3: Color & Grading */}
                  <div className="border border-slate-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                        <Palette className="w-4 h-4 text-indigo-600" />
                        {t('create.colorGrading', 'Color & Grading')}
                      </h4>
                    </div>
                    
                    {/* Temperature Slider */}
                    <div className="mb-3">
                      <label className="text-xs font-medium text-slate-700 mb-1 block">
                        {t('create.temperature', 'Temperature')}
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-blue-600 whitespace-nowrap">❄️ Cool</span>
                        <input 
                          type="range" 
                          min="-50" 
                          max="50" 
                          value={adjustments.colorGrading.temperature}
                          onChange={(e) => setAdjustments(prev => ({
                            ...prev,
                            colorGrading: { ...prev.colorGrading, temperature: parseInt(e.target.value), preset: 'custom' }
                          }))}
                          className="flex-1 h-2 bg-gradient-to-r from-blue-200 via-slate-200 to-orange-200 rounded-lg appearance-none cursor-pointer"
                        />
                        <span className="text-xs text-orange-600 whitespace-nowrap">🔥 Warm</span>
                      </div>
                    </div>
                    
                    {/* Quick Presets */}
                    <div className="mb-3">
                      <label className="text-xs font-medium text-slate-700 mb-1 block">
                        {t('create.presets', 'Quick Presets')}
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => setAdjustments(prev => ({
                            ...prev,
                            colorGrading: { ...prev.colorGrading, preset: 'natural', temperature: 0 }
                          }))}
                          className={`px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                            adjustments.colorGrading.preset === 'natural'
                              ? 'bg-green-100 text-green-700 border border-green-300'
                              : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          Natural
                        </button>
                        <button
                          onClick={() => setAdjustments(prev => ({
                            ...prev,
                            colorGrading: { ...prev.colorGrading, preset: 'vibrant', temperature: 10 }
                          }))}
                          className={`px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                            adjustments.colorGrading.preset === 'vibrant'
                              ? 'bg-purple-100 text-purple-700 border border-purple-300'
                              : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          Vibrant
                        </button>
                        <button
                          onClick={() => setAdjustments(prev => ({
                            ...prev,
                            colorGrading: { ...prev.colorGrading, preset: 'muted', temperature: -5 }
                          }))}
                          className={`px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                            adjustments.colorGrading.preset === 'muted'
                              ? 'bg-slate-200 text-slate-700 border border-slate-400'
                              : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          Muted
                        </button>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleApplyAIAdjustments('colorGrading')}
                      disabled={currentPhoto?.isProcessing}
                      className="w-full px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all font-medium text-xs flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {t('create.applyColor', 'Apply Color Grading')}
                    </button>
                  </div>

                </div>
              )}
            </div>
          )}

          {/* Upgrade Prompt for Free Users */}
          {userPlan === 'free' && hasPhoto && (
            <div className="p-3 bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-lg">
              <p className="text-sm font-bold text-purple-900 mb-1">
                ⭐ {t('create.upgradeForMore', 'Want to add more photos?')}
              </p>
              <p className="text-xs text-purple-700 mb-2">
                {t('create.upgradeDescription', 'StandardPlus: 5 photos | Premium: 10 photos + priority AI')}
              </p>
              <button className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all">
                {t('create.upgradePlan', 'Upgrade Plan →')}
              </button>
            </div>
          )}

          {/* Skip Photo Option */}
          {!hasPhoto && (
            <div className="text-center">
              <p className="text-xs text-slate-600">
                {t('create.orSkip', 'or')}{' '}
                <button
                  onClick={onNext}
                  className="text-indigo-600 font-semibold hover:underline"
                >
                  {t('create.skipPhoto', 'skip photo and continue')}
                </button>
              </p>
            </div>
          )}
        </div>

        {/* RIGHT: Live Preview */}
        <div>
          <div className="bg-white rounded-lg shadow-md border border-slate-200 p-3 lg:sticky lg:top-6">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3">
              <Eye className="w-4 h-4 text-indigo-600" />
              {t('create.preview', 'Preview')}
            </h3>

            {/* Platform Toggle - NOT side by side, but togglable */}
            {selectedPlatforms.length > 0 && (
              <div className="flex gap-2 mb-3">
                {selectedPlatforms.includes('facebook') && (
                  <button
                    onClick={() => setPreviewPlatform('facebook')}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                      previewPlatform === 'facebook'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                    }`}
                  >
                    Facebook
                  </button>
                )}
                {selectedPlatforms.includes('instagram') && (
                  <button
                    onClick={() => setPreviewPlatform('instagram')}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                      previewPlatform === 'instagram'
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                        : 'bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700 border border-pink-200 hover:from-purple-100 hover:to-pink-100'
                    }`}
                  >
                    Instagram
                  </button>
                )}
              </div>
            )}

            {/* Platform Preview */}
            <div className={`border rounded-lg overflow-hidden ${
              previewPlatform === 'facebook' ? 'border-blue-200' :
              previewPlatform === 'instagram' ? 'border-pink-200' :
              'border-slate-200'
            }`}>
              {/* Platform Header */}
              <div className={`p-2 border-b ${
                previewPlatform === 'facebook' ? 'bg-blue-50 border-blue-200' :
                previewPlatform === 'instagram' ? 'bg-gradient-to-r from-purple-50 to-pink-50 border-pink-200' :
                'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center gap-1.5">
                  <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                    D
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900">{t('create.yourBusiness', 'Your Business')}</p>
                    <p className="text-xs text-slate-500">{t('create.justNow', 'Just now')}</p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-3">
                {content.headline && (
                  <h4 className="font-bold text-xs text-slate-900 mb-1.5">{content.headline}</h4>
                )}
                {content.text && (
                  <p className="text-xs text-slate-700 whitespace-pre-line mb-2">{content.text}</p>
                )}
                {content.adjustments.includeHashtags && content.hashtags && content.hashtags.length > 0 && (
                  <p className="text-xs text-indigo-600 mb-2">
                    {content.hashtags.filter((h: any) => h.enabled).map((h: any) => h.tag).join(' ')}
                  </p>
                )}
                
                {/* Photo Display - Shows selected version for post */}
                {hasPhoto && photoContent.uploadedMedia.length > 0 && (
                  <div className="relative">
                    <img
                      src={getPreviewUrl(photoContent.uploadedMedia[selectedMediaIndex])}
                      alt="Post preview"
                      className={previewPlatform === 'instagram' 
                        ? 'w-full aspect-square object-cover rounded-lg' 
                        : 'w-full rounded-lg max-h-64 object-cover'
                      }
                    />
                    
                    {/* Multiple Photos Navigation */}
                    {photoContent.uploadedMedia.length > 1 && (
                      <>
                        <button
                          onClick={() => setSelectedMediaIndex(prev => 
                            prev > 0 ? prev - 1 : photoContent.uploadedMedia.length - 1
                          )}
                          className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors"
                        >
                          <ChevronLeft className="w-4 h-4 text-white" />
                        </button>
                        <button
                          onClick={() => setSelectedMediaIndex(prev => 
                            prev < photoContent.uploadedMedia.length - 1 ? prev + 1 : 0
                          )}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors"
                        >
                          <ChevronRight className="w-4 h-4 text-white" />
                        </button>
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                          {photoContent.uploadedMedia.map((_, index) => (
                            <div
                              key={index}
                              className={`w-1.5 h-1.5 rounded-full transition-all ${
                                index === selectedMediaIndex ? 'bg-white w-4' : 'bg-white/60'
                              }`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                    
                    {/* AI Badge if using AI version */}
                    {photoContent.uploadedMedia[selectedMediaIndex].selectedVersionForPost === 'adjusted' && 
                     photoContent.uploadedMedia[selectedMediaIndex].adjustedUrl && (
                      <div className="absolute top-2 left-2 px-2 py-1 bg-indigo-600 text-white rounded-md text-xs font-bold flex items-center gap-1 shadow-lg">
                        <Sparkles className="w-3 h-3" />
                        AI
                      </div>
                    )}
                  </div>
                )}

                {/* Mock Engagement */}
                <div className="mt-2 pt-2 border-t border-slate-200 flex items-center gap-3 text-xs text-slate-500">
                  {previewPlatform === 'facebook' && (
                    <>
                      <span>👍 42</span>
                      <span>💬 8</span>
                      <span>↗️ 3</span>
                    </>
                  )}
                  {previewPlatform === 'instagram' && (
                    <>
                      <span>❤️ 127</span>
                      <span>💬 15</span>
                      <span>📤</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center pt-2 pb-4">
        <button
          onClick={onBack}
          className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 transition-colors flex items-center gap-1.5"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>{t('create.back', 'Back')}</span>
        </button>
        
        <button
          onClick={onNext}
          className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-bold text-xs shadow-md flex items-center gap-1.5"
        >
          <span>{t('create.continue', 'Continue to Schedule')}</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

    </div>
  )
}
