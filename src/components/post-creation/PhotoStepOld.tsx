import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { usePostCreationStore } from '../../stores/postCreationStore'

interface AnalysisSuggestion {
  id: number
  category: string
  title: string
  description: string
  selected: boolean
  type?: 'combined' | 'radio'
  options?: Array<{
    id: string
    label: string
    description: string
    selected: boolean
  }>
  icon?: React.ComponentType<{ className?: string }>
}

interface PhotoStepProps {
  onNext: () => void
  onBack: () => void
}

interface UploadedMedia {
  id: string
  file: File
  url: string
  type: 'image' | 'video'
  platforms: string[]
  hasAiVersion: boolean
}

// Icon Components
const Sparkles = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M12 3v18m0-18l-3 3m3-3l3 3m-3 15l-3-3m3 3l3-3m6-9H3m18 0l-3-3m3 3l-3 3M3 12l3-3m-3 3l3 3"/>
  </svg>
)

const Upload = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
)

const Check = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

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

const Camera = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
)

const Lightbulb = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M9 18h6M10 22h4M15 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/>
    <path d="M8.5 14C7 13 6 11.5 6 10a6 6 0 1 1 12 0c0 1.5-1 3-2.5 4"/>
  </svg>
)

const X = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

const Plus = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)

const Wand = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5"/>
  </svg>
)

const Zap = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
)

const ChevronDown = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
)

const ChevronUp = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <polyline points="18 15 12 9 6 15"/>
  </svg>
)

const Target = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <circle cx="12" cy="12" r="6"/>
    <circle cx="12" cy="12" r="2"/>
  </svg>
)

const AlertTriangle = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)

const Crop = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M6.13 1L6 16a2 2 0 0 0 2 2h15"/>
    <path d="M1 6.13L16 6a2 2 0 0 1 2 2v15"/>
  </svg>
)

const Eraser = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/>
    <path d="M22 21H7"/>
    <path d="m5 11 9 9"/>
  </svg>
)

const Palette = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/>
    <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
    <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>
    <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
  </svg>
)

export const PhotoStep: React.FC<PhotoStepProps> = ({ onNext, onBack }) => {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadedMedia, setUploadedMedia] = useState<UploadedMedia[]>([])
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null)
  const [isOriginal, setIsOriginal] = useState(true)
  const [analysisUsed, setAnalysisUsed] = useState(0)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisSuggestion[] | null>(null)
  const [isApplyingChanges, setIsApplyingChanges] = useState(false)
  const [contentMatchExpanded, setContentMatchExpanded] = useState(false)

  // Get selected idea from store
  const { ideas, aiIdeas, selectedIdea, setPhotoContent, photoContent, selectedPlatforms } = usePostCreationStore()
  
  // Find the selected idea
  const allIdeas = [...ideas, ...aiIdeas]
  const currentIdea = allIdeas.find(idea => idea.id === selectedIdea)

  // Mock subscription limits - adjust based on user subscription
  const userSubscription = 'StandardPlus' as 'Premium' | 'StandardPlus' | 'Gratis'
  
  const getMaxPhotos = () => {
    switch(userSubscription) {
      case 'Premium': return 15
      case 'StandardPlus': return 5
      case 'Gratis':
      default: return 1
    }
  }
  
  const maxPhotos = getMaxPhotos()
  const maxAnalysis = userSubscription === 'Gratis' ? 3 : 20

  // Get active photo
  const activePhoto = uploadedMedia.find(p => p.id === activePhotoId)

  // Load existing photo content when component mounts
  useEffect(() => {
    if (photoContent && photoContent.uploadedMedia) {
      // Convert old format to new format with platforms and hasAiVersion
      const convertedMedia: UploadedMedia[] = photoContent.uploadedMedia.map(media => ({
        ...media,
        platforms: selectedPlatforms.slice(0, 2), // Default to first 2 platforms (FB, IG)
        hasAiVersion: false
      }))
      setUploadedMedia(convertedMedia)
      
      if (photoContent.selectedMedia) {
        setActivePhotoId(photoContent.selectedMedia)
      }
      setIsOriginal(photoContent.isOriginal)
    }
  }, [photoContent, selectedPlatforms])

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    // Check if adding these files would exceed limit
    if (uploadedMedia.length + files.length > maxPhotos) {
      alert(`${t('photo.maxPhotosError', `Maksimum ${maxPhotos} fotos tilladt for ${userSubscription}`)}. ${t('photo.currentCount', `Du har allerede ${uploadedMedia.length} foto(s)`)}.`)
      return
    }

    const newPhotos: UploadedMedia[] = Array.from(files).map(file => {
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        const url = URL.createObjectURL(file)
        return {
          id: Math.random().toString(36).substr(2, 9),
          file,
          url,
          type: file.type.startsWith('image/') ? 'image' : 'video',
          platforms: uploadedMedia.length === 0 ? selectedPlatforms.filter(p => p === 'facebook' || p === 'instagram') : [],
          hasAiVersion: false
        }
      }
      return null
    }).filter(Boolean) as UploadedMedia[]

    setUploadedMedia(prev => {
      const updated = [...prev, ...newPhotos]
      if (!activePhotoId && updated.length > 0) {
        setActivePhotoId(updated[0].id)
      }
      return updated
    })
  }

  const handleDeletePhoto = (photoId: string) => {
    setUploadedMedia(prev => {
      const filtered = prev.filter(p => p.id !== photoId)
      if (photoId === activePhotoId && filtered.length > 0) {
        setActivePhotoId(filtered[0].id)
      } else if (filtered.length === 0) {
        setActivePhotoId(null)
      }
      return filtered
    })
  }

  const togglePlatform = (photoId: string, platform: string) => {
    setUploadedMedia(prev =>
      prev.map(photo =>
        photo.id === photoId
          ? {
              ...photo,
              platforms: photo.platforms.includes(platform)
                ? photo.platforms.filter(p => p !== platform)
                : [...photo.platforms, platform]
            }
          : photo
      )
    )
  }

  const getPlatformWarnings = () => {
    const supportedPlatforms = ['facebook', 'instagram'] // Only FB and IG
    const assignedPlatforms = new Set<string>()
    
    uploadedMedia.forEach(photo => {
      photo.platforms.forEach(p => assignedPlatforms.add(p))
    })
    
    return supportedPlatforms.filter(p => !assignedPlatforms.has(p))
  }

  const handleVersionChange = (newIsOriginal: boolean) => {
    setIsOriginal(newIsOriginal)
  }

  const handleAnalyze = () => {
    if (!activePhoto || analysisUsed >= maxAnalysis) {
      alert(`${t('photo.maxAnalysisError', `Maksimum ${maxAnalysis} analyser tilladt for ${userSubscription}`)}`)
      return
    }

    setIsAnalyzing(true)
    setAnalysisUsed(prev => prev + 1)

    setTimeout(() => {
      const suggestions: AnalysisSuggestion[] = [
        {
          id: 1,
          category: "Crop & Size",
          title: "Platform Optimization",
          description: "",
          selected: false,
          type: "combined",
          options: [
            { id: 'instagram', label: "Instagram (1:1)", description: "Square format", selected: false },
            { id: 'facebook', label: "Facebook (1.91:1)", description: "Landscape format", selected: false }
          ],
          icon: Crop
        },
        {
          id: 2,
          category: "Cleaning",
          title: "Remove phone in background",
          description: "Phone in top left corner distracts from main subject",
          selected: true
        },
        {
          id: 3,
          category: "Cleaning",
          title: "Remove stain on table",
          description: "Small stain visible on wooden surface",
          selected: false
        },
        {
          id: 4,
          category: "Cleaning",
          title: "Remove water carafe",
          description: "Makes dessert and wine the main focus",
          selected: false
        },
        {
          id: 5,
          category: "Color & Grading",
          title: "Color Temperature",
          description: "",
          selected: false,
          type: "radio",
          options: [
            { id: 'warmer', label: "Warmer tone", description: "Cozy, inviting warmth", selected: false },
            { id: 'colder', label: "Colder tone", description: "Cool Nordic look", selected: false }
          ],
          icon: Palette
        }
      ]
      setAnalysisResult(suggestions)
      setIsAnalyzing(false)
    }, 2000)
  }

  const handleApplyChanges = () => {
    if (!analysisResult || !activePhoto) return
    
    const selectedSuggestions = analysisResult.filter(s => s.selected)
    if (selectedSuggestions.length === 0) return

    setIsApplyingChanges(true)
    
    // Simulate AI processing the selected changes
    setTimeout(() => {
      // Update the media with AI version
      setUploadedMedia(prev => 
        prev.map(media => 
          media.id === activePhoto.id 
            ? { ...media, hasAiVersion: true }
            : media
        )
      )
      setIsApplyingChanges(false)
      // Automatically switch to AI version when done
      setIsOriginal(false)
    }, 3000)
  }

  const handleNext = () => {
    // Save photo content to store before proceeding
    setPhotoContent({
      uploadedMedia: uploadedMedia,
      selectedMedia: activePhotoId,
      isOriginal: isOriginal,
      photoAdjustments: analysisResult || null
    })
    onNext()
  }

  return (
    <div className="space-y-4">
      {/* Photo Idea Banner */}
        {currentIdea && (
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg p-4 mb-4 text-white shadow-lg">
            <div className="flex items-start gap-3">
              <div className="bg-white/20 backdrop-blur p-2 rounded-lg flex-shrink-0">
                <Lightbulb className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-base mb-1">
                  {t('photo.ideaFrom', 'Foto-idé fra')} "{currentIdea.title}"
                </h4>
                <p className="text-sm text-purple-100 leading-relaxed">{currentIdea.description}</p>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          
          {/* Left Column - Photo Upload/Display */}
          <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="bg-indigo-100 p-2 rounded-lg">
                  <Camera className="w-5 h-5 text-indigo-600" />
                </div>
                <h3 className="text-base font-bold text-slate-800">
                  {t('photo.managePhotos', 'Foto & Video')}
                </h3>
              </div>
              <span className="text-xs text-slate-600 font-medium">
                {uploadedMedia.length}/{maxPhotos} {userSubscription}
              </span>
            </div>

              {/* Photo Carousel (Above main photo) */}
              {uploadedMedia.length > 0 && (
                <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-2 overflow-x-auto pb-2">
                    {uploadedMedia.map((photo) => (
                      <div
                        key={photo.id}
                        onClick={() => {
                          setActivePhotoId(photo.id)
                          setAnalysisResult(null) // Clear analysis when switching photos
                          setIsOriginal(true)
                        }}
                        className={`relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden cursor-pointer transition-all ${
                          activePhotoId === photo.id
                            ? 'ring-4 ring-indigo-500 ring-offset-2'
                            : 'ring-2 ring-slate-300 hover:ring-indigo-300'
                        }`}
                      >
                        <img
                          src={photo.url}
                          alt={`Photo ${photo.id}`}
                          className="w-full h-full object-cover"
                        />
                        {/* Platform badges */}
                        {photo.platforms.length > 0 && (
                          <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1 py-0.5 flex gap-0.5 justify-center">
                            {photo.platforms.includes('facebook') && (
                              <span className="text-[8px] text-white font-bold">FB</span>
                            )}
                            {photo.platforms.includes('instagram') && (
                              <span className="text-[8px] text-white font-bold ml-0.5">IG</span>
                            )}
                          </div>
                        )}
                        {/* AI badge */}
                        {photo.hasAiVersion && (
                          <div className="absolute top-1 right-1 bg-purple-600 rounded-full p-0.5">
                            <Sparkles className="w-2.5 h-2.5 text-white" />
                          </div>
                        )}
                        {/* Delete button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeletePhoto(photo.id)
                          }}
                          className="absolute top-1 left-1 bg-red-600 hover:bg-red-700 rounded-full p-0.5 opacity-0 hover:opacity-100 transition-opacity"
                        >
                          <X className="w-2.5 h-2.5 text-white" />
                        </button>
                      </div>
                    ))}
                    
                    {/* Add Photo Button */}
                    {uploadedMedia.length < maxPhotos && (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-shrink-0 w-20 h-20 rounded-lg border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50 transition-all flex flex-col items-center justify-center text-slate-500 hover:text-indigo-600"
                      >
                        <Plus className="w-6 h-6" />
                        <span className="text-xs font-medium mt-0.5">Upload</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Platform Warnings */}
              {uploadedMedia.length > 0 && getPlatformWarnings().length > 0 && (
                <div className="mb-4 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-800">
                    ⚠️ {t('photo.platformWarning', 'Mangler foto til')}: {getPlatformWarnings().map(p => p === 'facebook' ? 'Facebook' : 'Instagram').join(', ')}
                  </p>
                </div>
              )}

              {/* Main Content */}
              {uploadedMedia.length === 0 ? (
                /* Upload Area */
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 rounded-lg p-12 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-all min-h-[400px] flex flex-col justify-center"
                >
                  <div className="bg-indigo-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                    <Upload className="w-8 h-8 text-indigo-600" />
                  </div>
                  <p className="text-base font-semibold text-slate-800 mb-2">
                    {t('photo.uploadText', 'Klik for at uploade')}
                  </p>
                  <p className="text-sm text-slate-600">
                    {t('photo.maxFiles', `Fotos eller videoer • Max ${maxPhotos}`)}
                  </p>
                </div>
              ) : activePhoto ? (
                <div className="space-y-4">
                  {/* Image Preview */}
                  <div className="relative w-full h-96 bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg overflow-hidden border-2 border-slate-200">
                    {activePhoto.type === 'image' ? (
                      <img
                        src={activePhoto.url}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <video
                        src={activePhoto.url}
                        className="w-full h-full object-cover"
                        controls
                      />
                    )}
                    {!isOriginal && activePhoto.hasAiVersion && (
                      <div className="absolute top-2 right-2 bg-purple-600 text-white px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        AI Enhanced
                      </div>
                    )}
                  </div>

                  {/* Platform Assignment */}
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-xs font-semibold text-slate-700 mb-2">
                      {t('photo.assignPlatforms', 'Dette foto bruges på')}:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <label className="flex items-center cursor-pointer px-3 py-1.5 bg-white border border-slate-300 rounded-lg hover:border-indigo-400 transition-colors">
                        <input
                          type="checkbox"
                          checked={activePhoto.platforms.includes('facebook')}
                          onChange={() => togglePlatform(activePhoto.id, 'facebook')}
                          className="w-3.5 h-3.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                        />
                        <span className="ml-2 text-xs font-medium text-slate-800">Facebook</span>
                      </label>
                      <label className="flex items-center cursor-pointer px-3 py-1.5 bg-white border border-slate-300 rounded-lg hover:border-indigo-400 transition-colors">
                        <input
                          type="checkbox"
                          checked={activePhoto.platforms.includes('instagram')}
                          onChange={() => togglePlatform(activePhoto.id, 'instagram')}
                          className="w-3.5 h-3.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                        />
                        <span className="ml-2 text-xs font-medium text-slate-800">Instagram</span>
                      </label>
                    </div>
                  </div>

                  {/* Version Toggle */}
                  <div className="flex gap-4 p-3 bg-slate-50 rounded-lg">
                    <label className="flex items-center cursor-pointer flex-1">
                      <input
                        type="radio"
                        checked={isOriginal}
                        onChange={() => handleVersionChange(true)}
                        className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-sm font-medium text-slate-800">
                        Original
                      </span>
                    </label>
                    
                    <label className="flex items-center cursor-pointer flex-1">
                      <input
                        type="radio"
                        checked={!isOriginal}
                        onChange={() => handleVersionChange(false)}
                        disabled={!activePhoto.hasAiVersion}
                        className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500 disabled:opacity-50"
                      />
                      <span className={`ml-2 text-sm font-medium ${activePhoto.hasAiVersion ? 'text-slate-800' : 'text-slate-400'}`}>
                        AI redigeret {activePhoto.hasAiVersion ? '✓' : ''}
                      </span>
                    </label>
                  </div>

                  {/* AI Improvements Summary - Only shown when AI version is active */}
                  {!isOriginal && activePhoto.hasAiVersion && (
                    <div className="p-3 bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-purple-900 mb-1">AI Forbedringer anvendt</p>
                          <p className="text-xs text-purple-700">
                            Dit foto er blevet optimeret med AI. Skift til "Original" for at se før-versionen.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleDeletePhoto(activePhoto.id)}
                      className="px-4 py-2.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-all text-sm font-semibold"
                    >
                      Slet
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-all text-sm font-semibold"
                    >
                      Tilføj mere
                    </button>
                    <button className="px-6 py-2.5 rounded-lg transition-all text-sm font-bold shadow-md bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700">
                      Brug
                    </button>
                  </div>
                </div>
              ) : null}          {/* Platform Warnings */}
          {getPlatformWarnings().length > 0 && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center">
                <AlertTriangle className="w-4 h-4 text-yellow-600 mr-2" />
                <span className="text-sm text-yellow-800">
                  {t('photo.platformWarning', 'Ingen fotos tildelt til')}: {' '}
                  {getPlatformWarnings().map(p => p === 'facebook' ? 'Facebook' : 'Instagram').join(', ')}
                </span>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleFileUpload}
            className="hidden"
            multiple={maxPhotos > 1}
          />
        </div>

        {/* Right Column - AI Analysis */}
        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="bg-purple-100 p-2 rounded-lg">
                <Wand className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                {t('photo.aiAnalysis', 'AI Analyse & Forslag')}
              </h3>
            </div>
            <button
              onClick={handleAnalyze}
              disabled={!activePhoto || isAnalyzing || analysisUsed >= maxAnalysis}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-medium flex items-center gap-2 shadow-md"
            >
              {isAnalyzing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>{t('photo.analyzing', 'Analyserer...')}</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  <span>{t('photo.analyze', 'Analyser')}</span>
                </>
              )}
            </button>
          </div>

          {/* Analysis Limit Info */}
          <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
            <p className="text-xs text-slate-600">
              {t('photo.analysisUsed', 'Analyser brugt')}: <span className="font-semibold">{analysisUsed}/{maxAnalysis}</span>
            </p>
            {userSubscription === 'Gratis' && (
              <button className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs hover:bg-amber-200 transition-colors font-medium">
                {t('photo.upgrade', 'Opgrader')}
              </button>
            )}
          </div>

          {/* Analysis Results */}
          {analysisResult ? (
            <div className="space-y-4">
              {/* Content Match Analysis - Expandable */}
              <div className="border-2 border-indigo-200 rounded-lg overflow-hidden bg-gradient-to-br from-indigo-50 to-purple-50">
                {/* Header - Always Visible */}
                <button
                  onClick={() => setContentMatchExpanded(!contentMatchExpanded)}
                  className="w-full p-3 flex items-center justify-between hover:bg-indigo-100/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className="bg-indigo-600 p-1.5 rounded-lg">
                      <Target className="w-4 h-4 text-white" />
                    </div>
                    <div className="text-left">
                      <h4 className="text-base font-bold text-indigo-900">
                        {t('photo.contentMatch', 'Foto-Tekst Match')}
                      </h4>
                      <p className="text-xs text-indigo-700">Score: 88%</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">
                      Excellent
                    </span>
                    {contentMatchExpanded ? (
                      <ChevronUp className="w-4 h-4 text-indigo-600" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-indigo-600" />
                    )}
                  </div>
                </button>

                {/* Expanded Content */}
                {contentMatchExpanded && (
                  <div className="p-4 pt-2 border-t border-indigo-200 bg-white">
                    {/* Score Bar */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-slate-600">Match kvalitet</span>
                        <span className="text-xs font-bold text-emerald-700">88%</span>
                      </div>
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full" style={{width: '88%'}}></div>
                      </div>
                    </div>

                    {/* Text Context */}
                    {currentIdea && (
                      <div className="mb-3 p-2 bg-slate-50 rounded-lg">
                        <p className="text-xs font-semibold text-slate-700 mb-1">Din tekst handler om:</p>
                        <ul className="text-xs text-slate-600 space-y-0.5 ml-3">
                          <li>• {currentIdea.title}</li>
                          <li>• {currentIdea.description}</li>
                        </ul>
                      </div>
                    )}

                    {/* What Matches */}
                    <div className="space-y-2 mb-3">
                      <p className="text-xs font-semibold text-slate-700">Dit foto viser:</p>
                      <div className="space-y-1.5">
                        <div className="flex items-start gap-2 p-2 bg-emerald-50 rounded-lg">
                          <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-emerald-800">
                            <span className="font-semibold">God komposition</span> - Perfekt match med din idé
                          </p>
                        </div>
                        <div className="flex items-start gap-2 p-2 bg-emerald-50 rounded-lg">
                          <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-emerald-800">
                            <span className="font-semibold">Professionel præsentation</span> - Viser kvalitet
                          </p>
                        </div>
                        <div className="flex items-start gap-2 p-2 bg-amber-50 rounded-lg">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-800">
                            <span className="font-semibold">Forbedringspotentiale:</span> Se forslag nedenfor
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Recommendations */}
                    <div className="p-2 bg-indigo-50 rounded-lg border border-indigo-200">
                      <p className="text-xs font-semibold text-indigo-900 mb-1 flex items-center gap-1">
                        <Lightbulb className="w-3.5 h-3.5" />
                        Forbedringsforslag:
                      </p>
                      <ul className="text-xs text-indigo-700 space-y-0.5 ml-4">
                        <li>• Optimer farver og kontrast</li>
                        <li>• Juster komposition for bedre fokus</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* Grouped Suggestions */}
              <div className="grid grid-cols-2 gap-3">
                {/* Crop & Size */}
                {analysisResult
                  .filter(s => s.category === 'Crop & Size' && s.type === 'combined')
                  .map(suggestion => (
                    <div key={suggestion.id}>
                      <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                        <Crop className="w-4 h-4" />
                        Crop & Size
                      </h4>
                      <div className="p-3 rounded-lg border-2 border-slate-200 bg-white">
                        <h5 className="text-base font-bold text-slate-800 mb-3">{suggestion.title}</h5>
                        <div className="space-y-2">
                          {suggestion.options?.map(option => (
                            <label key={option.id} className="flex items-start gap-3 cursor-pointer hover:bg-slate-50 p-2 rounded transition">
                              <input
                                type="checkbox"
                                checked={option.selected}
                                onChange={() => {
                                  setAnalysisResult(prev =>
                                    prev?.map(s =>
                                      s.id === suggestion.id
                                        ? {
                                            ...s,
                                            options: s.options?.map(opt =>
                                              opt.id === option.id ? { ...opt, selected: !opt.selected } : opt
                                            )
                                          }
                                        : s
                                    ) || null
                                  )
                                }}
                                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 mt-0.5"
                              />
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-slate-800">{option.label}</p>
                                <p className="text-xs text-slate-600">{option.description}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                
                {/* Color & Grading */}
                {analysisResult
                  .filter(s => s.category === 'Color & Grading' && s.type === 'radio')
                  .map(suggestion => (
                    <div key={suggestion.id}>
                      <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                        <Palette className="w-4 h-4" />
                        Color & Grading
                      </h4>
                      <div className="p-3 rounded-lg border-2 border-slate-200 bg-white">
                        <h5 className="text-base font-bold text-slate-800 mb-3">{suggestion.title}</h5>
                        <div className="space-y-2">
                          {suggestion.options?.map(option => (
                            <label key={option.id} className="flex items-start gap-3 cursor-pointer hover:bg-slate-50 p-2 rounded transition">
                              <input
                                type="radio"
                                name={`radio-${suggestion.id}`}
                                checked={option.selected}
                                onChange={() => {
                                  setAnalysisResult(prev =>
                                    prev?.map(s =>
                                      s.id === suggestion.id
                                        ? {
                                            ...s,
                                            options: s.options?.map(opt =>
                                              opt.id === option.id ? { ...opt, selected: true } : { ...opt, selected: false }
                                            )
                                          }
                                        : s
                                    ) || null
                                  )
                                }}
                                className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500 mt-0.5"
                              />
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-slate-800">{option.label}</p>
                                <p className="text-xs text-slate-600">{option.description}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>

              {/* Cleaning section */}
              {analysisResult.filter(s => s.category === 'Cleaning').length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                    <Eraser className="w-4 h-4" />
                    Cleaning
                  </h4>
                  <div className="space-y-2">
                    {analysisResult
                      .filter(s => s.category === 'Cleaning')
                      .map((suggestion) => (
                        <div
                          key={suggestion.id}
                          onClick={() => {
                            setAnalysisResult(prev => 
                              prev?.map(s => 
                                s.id === suggestion.id ? { ...s, selected: !s.selected } : s
                              ) || null
                            )
                          }}
                          className={`p-3 rounded-lg border-2 cursor-pointer transition-all hover:shadow-sm ${
                            suggestion.selected
                              ? 'border-indigo-500 bg-indigo-50'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                              suggestion.selected
                                ? 'border-indigo-600 bg-indigo-600'
                                : 'border-slate-300 bg-white'
                            }`}>
                              {suggestion.selected && (
                                <Check className="w-3 h-3 text-white" />
                              )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <h5 className="text-base font-bold text-slate-800 mb-0.5">
                                {suggestion.title}
                              </h5>
                              <p className="text-xs text-slate-600 leading-relaxed">
                                {suggestion.description}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Apply Button */}
              <div className="pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-slate-600">
                    {t('photo.selectedChanges', 'Valgte')}: <span className="font-semibold">{
                      analysisResult.reduce((count, s) => {
                        if (s.type === 'combined' || s.type === 'radio') {
                          return count + (s.options?.filter(o => o.selected).length || 0)
                        }
                        return count + (s.selected ? 1 : 0)
                      }, 0)
                    } / {
                      analysisResult.reduce((count, s) => {
                        if (s.type === 'combined' || s.type === 'radio') {
                          return count + (s.options?.length || 0)
                        }
                        return count + 1
                      }, 0)
                    }</span>
                  </p>
                </div>
                <button
                  onClick={handleApplyChanges}
                  disabled={!analysisResult?.some(s => {
                    if (s.type === 'combined' || s.type === 'radio') {
                      return s.options?.some(o => o.selected)
                    }
                    return s.selected
                  }) || isApplyingChanges}
                  className="w-full px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold shadow-lg flex items-center justify-center gap-2"
                >
                  {isApplyingChanges ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>{t('photo.applyingChanges', 'Anvender ændringer...')}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>{t('photo.applyChanges', 'Anvend valgte ændringer')}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="bg-purple-50 rounded-full p-4 w-16 h-16 mb-4 flex items-center justify-center">
                <Wand className="w-8 h-8 text-purple-600" />
              </div>
              <p className="text-sm text-slate-600 mb-2 font-medium">
                {activePhoto ? t('photo.clickAnalyze', 'Upload et billede og klik på "Analyser"') : t('photo.selectPhotoForAnalysis', 'Vælg et foto at analysere')}
              </p>
              <p className="text-xs text-slate-500">AI vil foreslå forbedringer til dit foto</p>
            </div>
          )}

          {/* Analysis Limit Warning */}
          {analysisUsed >= maxAnalysis && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-800">
                {t('photo.analysisLimitReached', 'Du har brugt alle dine analyser. Opgrader for at få flere.')}
              </p>
            </div>
          )}
        </div>
      </div>
      
      {/* Navigation */}
      <div className="py-6 mb-4">
        <div className="flex justify-between items-center">
          <button
            onClick={onBack}
            className="px-8 py-3 text-base font-medium text-slate-600 hover:text-slate-800 transition-colors flex items-center gap-2"
          >
            <ChevronLeft className="w-5 h-5" />
            <span>{t('createPost.text.back')}</span>
          </button>
          
          <button
            onClick={handleNext}
            className="px-8 py-3 text-base font-medium text-indigo-600 hover:text-indigo-700 transition-colors flex items-center gap-2"
          >
            <span>{t('createPost.text.next')}</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Platform Info */}
      <div className="bg-slate-50 rounded-lg border border-slate-200 p-3">
        <p className="text-xs text-slate-600 text-center">
          {uploadedMedia.length > 0 ? (
            <>
              {t('photo.photosAssignedTo', 'Fotos tildelt til')}: <span className="font-semibold">
                {Array.from(new Set(uploadedMedia.flatMap(p => p.platforms)))
                  .map(p => p === 'facebook' ? 'Facebook' : 'Instagram')
                  .join(', ') || t('photo.noPlatforms', 'Ingen platforme')}
              </span>
            </>
          ) : (
            t('photo.uploadPhotosToAssign', 'Upload fotos for at tildele platforme')
          )}
        </p>
      </div>

    </div>
  )
}