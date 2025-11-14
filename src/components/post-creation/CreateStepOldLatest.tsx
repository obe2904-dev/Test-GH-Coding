import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePostCreationStore, PhotoAdjustments } from '../../stores/postCreationStore'
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

const Plus = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)

export function CreateStep({ onNext, onBack, onStepClick }: CreateStepProps) {
  const { t } = useTranslation(undefined, { keyPrefix: 'createPost' })
  const { postContent, selectedPlatforms, photoContent, setPhotoContent } = usePostCreationStore()

  // State management
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0)
  const [viewMode, setViewMode] = useState<'original' | 'adjusted'>('adjusted')
  const [previewPhotoIndex, setPreviewPhotoIndex] = useState(0)
  
  // User plan - TODO: Get from auth context or tier store
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
      alert(t('create.maxPhotosReached', 'Maximum photos reached for your plan'))
      return
    }

    const newPhotos: any[] = []
    const filesToProcess = Array.from(files).slice(0, availableSlots)

    filesToProcess.forEach(file => {
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file)
        newPhotos.push({
          id: Math.random().toString(36).substr(2, 9),
          file,
          url,
          originalUrl: url,
          type: 'image'
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
      setPreviewPhotoIndex(currentPhotoCount)
    }
  }

  const handleRemovePhoto = (index: number) => {
    const updatedMedia = photoContent?.uploadedMedia.filter((_, i) => i !== index) || []
    
    // Revoke URL to free memory
    const photoToRemove = photoContent?.uploadedMedia[index]
    if (photoToRemove) {
      URL.revokeObjectURL(photoToRemove.url)
      if (photoToRemove.adjustedUrl) {
        URL.revokeObjectURL(photoToRemove.adjustedUrl)
      }
    }
    
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
    if (previewPhotoIndex >= updatedMedia.length) {
      setPreviewPhotoIndex(Math.max(0, updatedMedia.length - 1))
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
        uploadedMedia: updatedMedia,
        selectedMedia: photoContent?.selectedMedia || null,
        isOriginal: photoContent?.isOriginal || true,
        photoAdjustments: photoContent?.photoAdjustments || null
      })

      // Switch to adjusted view
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
      if (currentMedia?.adjustedUrl) {
        const updatedMedia = [...(photoContent?.uploadedMedia || [])]
        updatedMedia[selectedMediaIndex] = {
          ...currentMedia,
          adjustedUrl: undefined,
          adjustments: undefined
        }
        setPhotoContent({
          uploadedMedia: updatedMedia,
          selectedMedia: photoContent?.selectedMedia || null,
          isOriginal: photoContent?.isOriginal || true,
          photoAdjustments: photoContent?.photoAdjustments || null
        })
      }
      
      setViewMode('original')
    }
  }

  const hasPhoto = photoContent?.uploadedMedia && photoContent.uploadedMedia.length > 0
  const currentPhoto = photoContent?.uploadedMedia?.[selectedMediaIndex]
  const previewPhoto = photoContent?.uploadedMedia?.[previewPhotoIndex]
  const activePreviewPlatform = selectedPlatforms[0] || 'facebook'
  const hasAdjustedVersion = currentPhoto?.adjustedUrl !== undefined

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

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        
        {/* LEFT: Photo Upload & AI Adjustments - 3 columns */}
        <div className="lg:col-span-3 space-y-3">
          
          {/* Multi-Photo Gallery (for paid plans) */}
          {hasPhoto && photoContent.uploadedMedia.length > 1 && (
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-slate-700">
                  {t('create.photos', 'Photos')} ({photoContent.uploadedMedia.length}/{maxPhotos})
                </span>
                {photoContent.uploadedMedia.length < maxPhotos && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2 py-1 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-all flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    {t('create.addMore', 'Add More')}
                  </button>
                )}
              </div>
              
              <div className="flex gap-2 overflow-x-auto pb-2">
                {photoContent.uploadedMedia.map((media, index) => (
                  <div
                    key={media.id}
                    className="relative flex-shrink-0"
                  >
                    <div
                      onClick={() => setSelectedMediaIndex(index)}
                      className={'w-20 h-20 rounded-lg overflow-hidden cursor-pointer border-2 transition-all ' + (
                        selectedMediaIndex === index
                          ? 'border-indigo-600 ring-2 ring-indigo-200'
                          : 'border-slate-200 hover:border-indigo-400'
                      )}
                    >
                      <img
                        src={media.adjustedUrl || media.url}
                        alt={'Photo ' + (index + 1)}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    
                    {/* AI Enhancement Badge */}
                    {media.adjustedUrl && (
                      <div className="absolute -top-1 -right-1 bg-purple-600 rounded-full p-1">
                        <Sparkles className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                    
                    {/* Remove Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemovePhoto(index)
                      }}
                      className="absolute -top-1 -left-1 bg-red-600 rounded-full p-0.5 hover:bg-red-700 transition-all"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Photo Upload Area */}
          <div className="bg-white rounded-lg shadow-md border border-slate-200 p-3">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-2">
              <Camera className="w-4 h-4 text-indigo-600" />
              {t('create.uploadPhoto', hasPhoto ? 'Current Photo' : 'Upload Photo')}
            </h3>

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
                <div className="relative rounded-lg overflow-hidden">
                  {currentPhoto?.isProcessing && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                      <div className="text-center">
                        <Loader className="w-8 h-8 text-white animate-spin mx-auto mb-2" />
                        <p className="text-xs text-white font-medium">
                          {t('create.processingAI', 'Processing with AI...')}
                        </p>
                      </div>
                    </div>
                  )}
                  <img
                    src={viewMode === 'adjusted' && currentPhoto?.adjustedUrl 
                      ? currentPhoto.adjustedUrl 
                      : currentPhoto?.url}
                    alt="Upload"
                    className="w-full h-48 object-cover"
                  />
                </div>
                
                {/* Before/After Toggle */}
                {hasAdjustedVersion && (
                  <div className="flex items-center justify-center gap-2 p-2 bg-slate-50 rounded-lg">
                    <button
                      onClick={() => setViewMode('original')}
                      className={'flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ' + (
                        viewMode === 'original'
                          ? 'bg-white text-slate-800 shadow-sm'
                          : 'text-slate-600 hover:bg-slate-100'
                      )}
                    >
                      {t('create.original', 'Original')}
                    </button>
                    <button
                      onClick={() => setViewMode('adjusted')}
                      className={'flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 ' + (
                        viewMode === 'adjusted'
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-100'
                      )}
                    >
                      <Sparkles className="w-3 h-3" />
                      {t('create.aiAdjusted', 'AI Enhanced')}
                    </button>
                  </div>
                )}
                
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full px-3 py-1.5 border border-dashed border-slate-300 rounded-lg text-xs text-slate-600 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                >
                  {t('create.changePhoto', 'Change Photo')}
                </button>
                
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

          {/* AI Adjustments Panel - Only show if photo uploaded */}
          {hasPhoto && currentPhoto && (
            <div className="bg-white rounded-lg shadow-md border border-slate-200 p-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  {t('create.aiAdjustments', 'AI Photo Adjustments')}
                </h3>
                {hasAdjustedVersion && (
                  <button
                    onClick={() => handleResetAdjustments()}
                    className="px-2 py-1 text-xs text-slate-600 hover:text-red-600 font-medium flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    {t('create.resetAll', 'Reset All')}
                  </button>
                )}
              </div>
              
              <div className="space-y-3">
                
                {/* Crop & Size */}
                <details className="border border-slate-200 rounded-lg">
                  <summary className="p-3 cursor-pointer hover:bg-slate-50 flex items-center gap-2 text-sm font-bold">
                    <Crop className="w-4 h-4 text-indigo-600" />
                    {t('create.cropAndSize', 'Crop & Size')}
                  </summary>
                  
                  <div className="p-3 pt-0 space-y-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        {t('create.optimizeFor', 'Optimize for')}
                      </label>
                      <select
                        value={adjustments.cropAndSize.platform}
                        onChange={(e) => setAdjustments(prev => ({
                          ...prev,
                          cropAndSize: {
                            ...prev.cropAndSize,
                            platform: e.target.value as 'facebook' | 'instagram' | 'both'
                          }
                        }))}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="facebook">Facebook (1200×630)</option>
                        <option value="instagram">Instagram (1080×1080)</option>
                        <option value="both">Both Platforms</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        {t('create.focusOn', 'Focus on')}
                      </label>
                      <select
                        value={adjustments.cropAndSize.focusMode}
                        onChange={(e) => setAdjustments(prev => ({
                          ...prev,
                          cropAndSize: {
                            ...prev.cropAndSize,
                            focusMode: e.target.value as 'auto' | 'center' | 'face' | 'product'
                          }
                        }))}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="auto">Auto Detect</option>
                        <option value="center">Center</option>
                        <option value="face">Face</option>
                        <option value="product">Product</option>
                      </select>
                    </div>
                    
                    <button
                      onClick={() => handleApplyAIAdjustments('cropAndSize')}
                      disabled={currentPhoto?.isProcessing}
                      className="w-full px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all font-medium text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Crop className="w-3.5 h-3.5" />
                      {t('create.applyCrop', 'Apply Smart Crop')}
                    </button>
                  </div>
                </details>

                {/* Photo Cleaning - RECOMMENDED */}
                <details className="border-2 border-indigo-200 rounded-lg bg-indigo-50/30" open>
                  <summary className="p-3 cursor-pointer hover:bg-indigo-50 flex items-center justify-between text-sm font-bold">
                    <div className="flex items-center gap-2">
                      <Eraser className="w-4 h-4 text-indigo-600" />
                      {t('create.cleaning', 'Photo Cleaning')}
                    </div>
                    <span className="px-2 py-0.5 bg-indigo-600 text-white text-xs font-bold rounded">
                      {t('create.recommended', 'RECOMMENDED')}
                    </span>
                  </summary>
                  
                  <div className="p-3 pt-0 space-y-2">
                    <div className="mb-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-xs text-blue-800">
                        💡 {t('create.cleaningTip', 'Subtle removal only - keeps natural look')}
                      </p>
                    </div>
                    
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={adjustments.cleaning.removeBackground}
                        onChange={(e) => setAdjustments(prev => ({
                          ...prev,
                          cleaning: {
                            ...prev.cleaning,
                            removeBackground: e.target.checked
                          }
                        }))}
                        className="w-3 h-3 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                      <span className="text-xs text-slate-700">
                        {t('create.removeBackground', 'Remove background distractions')}
                      </span>
                    </label>
                    
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={adjustments.cleaning.removeObjects}
                        onChange={(e) => setAdjustments(prev => ({
                          ...prev,
                          cleaning: {
                            ...prev.cleaning,
                            removeObjects: e.target.checked
                          }
                        }))}
                        className="w-3 h-3 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                      <span className="text-xs text-slate-700">
                        {t('create.removeObjects', 'Remove unwanted objects')}
                      </span>
                    </label>
                    
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={adjustments.cleaning.reduceBlemishes}
                        onChange={(e) => setAdjustments(prev => ({
                          ...prev,
                          cleaning: {
                            ...prev.cleaning,
                            reduceBlemishes: e.target.checked
                          }
                        }))}
                        className="w-3 h-3 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                      <span className="text-xs text-slate-700">
                        {t('create.reduceBlemishes', 'Minor blemish reduction')}
                      </span>
                    </label>
                    
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-medium text-slate-700">
                          {t('create.intensity', 'Cleaning Intensity')}
                        </label>
                        <span className="text-xs text-indigo-600 font-bold">
                          {adjustments.cleaning.intensity}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={adjustments.cleaning.intensity}
                        onChange={(e) => setAdjustments(prev => ({
                          ...prev,
                          cleaning: {
                            ...prev.cleaning,
                            intensity: parseInt(e.target.value)
                          }
                        }))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-xs text-slate-500 mt-1">
                        <span>{t('create.natural', 'Natural')}</span>
                        <span>{t('create.moderate', 'Moderate')}</span>
                        <span>{t('create.strong', 'Strong')}</span>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleApplyAIAdjustments('cleaning')}
                      disabled={currentPhoto?.isProcessing}
                      className="w-full px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all font-medium text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {t('create.applyCleaning', 'Apply Smart Cleaning')}
                    </button>
                  </div>
                </details>

                {/* Color & Grading */}
                <details className="border border-slate-200 rounded-lg">
                  <summary className="p-3 cursor-pointer hover:bg-slate-50 flex items-center gap-2 text-sm font-bold">
                    <Palette className="w-4 h-4 text-indigo-600" />
                    {t('create.colorGrading', 'Color & Grading')}
                  </summary>
                  
                  <div className="p-3 pt-0 space-y-2">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-medium text-slate-700">
                          {t('create.temperature', 'Temperature')}
                        </label>
                        <span className="text-xs text-indigo-600 font-bold">
                          {adjustments.colorGrading.temperature > 0 ? '+' : ''}
                          {adjustments.colorGrading.temperature}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="-50"
                        max="50"
                        value={adjustments.colorGrading.temperature}
                        onChange={(e) => setAdjustments(prev => ({
                          ...prev,
                          colorGrading: {
                            ...prev.colorGrading,
                            temperature: parseInt(e.target.value)
                          }
                        }))}
                        className="w-full h-2 bg-gradient-to-r from-blue-400 via-slate-200 to-orange-400 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-xs text-slate-500 mt-1">
                        <span>❄️ {t('create.cooler', 'Cooler')}</span>
                        <span>🔥 {t('create.warmer', 'Warmer')}</span>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        {t('create.presets', 'Quick Presets')}
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {['natural', 'vibrant', 'muted'].map((preset) => (
                          <button
                            key={preset}
                            onClick={() => setAdjustments(prev => ({
                              ...prev,
                              colorGrading: {
                                ...prev.colorGrading,
                                preset: preset as 'natural' | 'vibrant' | 'muted' | 'custom'
                              }
                            }))}
                            className={'px-2 py-1.5 rounded-lg text-xs font-medium transition-all ' + (
                              adjustments.colorGrading.preset === preset
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            )}
                          >
                            {t('create.' + preset, preset.charAt(0).toUpperCase() + preset.slice(1))}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleApplyAIAdjustments('colorGrading')}
                      disabled={currentPhoto?.isProcessing}
                      className="w-full px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all font-medium text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Palette className="w-3.5 h-3.5" />
                      {t('create.applyColor', 'Apply Color Grading')}
                    </button>
                  </div>
                </details>

              </div>
            </div>
          )}

          {/* Upgrade Prompt for Free Users */}
          {userPlan === 'free' && hasPhoto && (
            <div className="mt-2 p-3 bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-lg">
              <p className="text-sm font-bold text-purple-900 mb-1">
                ⭐ {t('create.upgradeForMore', 'Want to add more photos & unlock advanced AI?')}
              </p>
              <p className="text-xs text-purple-700 mb-2">
                {t('create.upgradeDescription', 'StandardPlus: 5 photos • Premium: 10 photos + priority processing')}
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
                  className="text-indigo-600 font-medium hover:underline"
                >
                  {t('create.skipPhoto', 'skip photo and continue')}
                </button>
              </p>
            </div>
          )}
        </div>

        {/* RIGHT: Live Preview - 2 columns, sticky */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md border border-slate-200 p-3 lg:sticky lg:top-6">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-2">
              <Eye className="w-4 h-4 text-indigo-600" />
              {t('create.preview', 'Preview')}
            </h3>

            {/* Platform Preview */}
            <div className={'border rounded-lg overflow-hidden ' + (
              activePreviewPlatform === 'facebook' ? 'border-blue-200' :
              activePreviewPlatform === 'instagram' ? 'border-pink-200' :
              'border-slate-200'
            )}>
              {/* Platform Header */}
              <div className={'p-2 border-b ' + (
                activePreviewPlatform === 'facebook' ? 'bg-blue-50 border-blue-200' :
                activePreviewPlatform === 'instagram' ? 'bg-gradient-to-r from-purple-50 to-pink-50 border-pink-200' :
                'bg-slate-50 border-slate-200'
              )}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    YB
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800">
                      {t('create.yourBusiness', 'Your Business')}
                    </div>
                    <div className="text-xs text-slate-500">
                      {t('create.justNow', 'Just now')}
                    </div>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-3">
                {/* Headline */}
                {content.headline && (
                  <h4 className="text-base font-bold text-slate-800 mb-1">
                    {content.headline}
                  </h4>
                )}
                
                {/* Text */}
                {content.text && (
                  <p className="text-sm text-slate-700 mb-2 whitespace-pre-wrap">
                    {content.text}
                  </p>
                )}
                
                {/* Photo Preview */}
                {hasPhoto && previewPhoto && (
                  <div className="relative">
                    <img
                      src={previewPhoto.adjustedUrl || previewPhoto.url}
                      alt="Preview"
                      className={
                        activePreviewPlatform === 'instagram' 
                          ? 'w-full aspect-square object-cover rounded-lg'
                          : 'w-full rounded-lg max-h-48 object-cover'
                      }
                    />
                    
                    {/* AI Enhancement Badge */}
                    {previewPhoto.adjustedUrl && (
                      <div className="absolute top-2 right-2 bg-purple-600 text-white px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        AI
                      </div>
                    )}
                    
                    {/* Photo Navigation for Multiple Photos */}
                    {photoContent.uploadedMedia.length > 1 && (
                      <>
                        {previewPhotoIndex > 0 && (
                          <button
                            onClick={() => setPreviewPhotoIndex(prev => prev - 1)}
                            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-1.5 rounded-full transition-all"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                        )}
                        
                        {previewPhotoIndex < photoContent.uploadedMedia.length - 1 && (
                          <button
                            onClick={() => setPreviewPhotoIndex(prev => prev + 1)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-1.5 rounded-full transition-all"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        )}
                        
                        {/* Dot Indicators */}
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                          {photoContent.uploadedMedia.map((_, index) => (
                            <div
                              key={index}
                              className={'w-1.5 h-1.5 rounded-full transition-all ' + (
                                index === previewPhotoIndex
                                  ? 'bg-white w-4'
                                  : 'bg-white/50'
                              )}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
                
                {/* Mock Engagement */}
                <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-200 text-xs text-slate-500">
                  <span>👍 Like</span>
                  <span>💬 Comment</span>
                  <span>🔄 Share</span>
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
