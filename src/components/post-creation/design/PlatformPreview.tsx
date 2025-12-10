import { useTranslation } from 'react-i18next'
import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { MediaItem } from '../../../stores/postCreationStore'
import type { Database } from '../../../types/database'

// Icon Components
const ChevronLeft = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <polyline points="15,18 9,12 15,6"/>
  </svg>
)

const ChevronRight = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <polyline points="9,18 15,12 9,6"/>
  </svg>
)

const Sparkles = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M12 2l1.09 3.26L16 6.35l-2.91 1.09L12 11l-1.09-3.26L8 6.35l2.91-1.09z"/>
    <path d="M19 9l.69 2.07L22 11.76l-2.31.69L19 15l-.69-2.07L16 11.76l2.31-.69z"/>
    <path d="M5 18l.69 2.07L8 20.76l-2.31.69L5 24l-.69-2.07L2 20.76l2.31-.69z"/>
  </svg>
)

const Camera = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
)


interface PostContent {
  headline: string
  text: string
  hashtags: Array<{ tag: string; enabled: boolean }>
  adjustments: {
    includeHashtags: boolean
    includeEmojis: boolean
    includeBookingLink: boolean
    tone: string
    length: string
  }
}

interface PlatformPreviewProps {
  selectedPlatforms: string[]
  previewPlatform: 'facebook' | 'instagram'
  onPreviewPlatformChange: (platform: 'facebook' | 'instagram') => void
  content: PostContent
  uploadedMedia: MediaItem[]
  selectedMediaIndex: number
  onMediaIndexChange: (index: number) => void
  onPhotoUpload?: (event: React.ChangeEvent<HTMLInputElement>) => void
  onRemovePhoto?: (index: number) => void
  currentTier: string
  businessName?: string
}

function getPreviewUrl(media: MediaItem): string {
  if (media.selectedVersionForPost === 'adjusted' && media.adjustedUrl) {
    return media.adjustedUrl
  }
  return media.url
}

export function PlatformPreview({
  selectedPlatforms,
  previewPlatform,
  onPreviewPlatformChange,
  content,
  uploadedMedia,
  selectedMediaIndex,
  onMediaIndexChange,
  onPhotoUpload,
  onRemovePhoto,
  currentTier,
  businessName: businessNameProp
}: PlatformPreviewProps) {
  const { t } = useTranslation(undefined, { keyPrefix: 'createPost' })
  const [businessName, setBusinessName] = useState<string>(businessNameProp || '')
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const hasPhoto = uploadedMedia && uploadedMedia.length > 0
  const displayText = useMemo(() => {
    const baseText = content.text || ''

    if (previewPlatform !== 'instagram' || baseText.trim().length === 0) {
      return baseText
    }

    if (!businessName || businessName.trim().length === 0) {
      return baseText
    }

    const placeholderPattern = /\bdin[\s\u00A0]+virksomhed\b/gi
    let adjusted = baseText.replace(placeholderPattern, businessName)

    if (!adjusted.toLowerCase().startsWith(businessName.toLowerCase())) {
      adjusted = `${businessName} ${adjusted}`
    }

    return adjusted
  }, [businessName, content.text, previewPlatform])

  const normalizedBusinessName = (businessName || '').trim()
  const displayTextStartsWithBusinessName =
    normalizedBusinessName.length > 0 &&
    typeof displayText === 'string' &&
    displayText.trimStart().toLowerCase().startsWith(normalizedBusinessName.toLowerCase())

  const showBusinessLabel = normalizedBusinessName.length > 0 && !displayTextStartsWithBusinessName
  const showFallbackLabel = normalizedBusinessName.length === 0
  
  // Fetch business name from profile
  useEffect(() => {
    if (businessNameProp) {
      setBusinessName(businessNameProp)
      return
    }

    let isActive = true

    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !isActive) {
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('business_name')
        .eq('id', user.id)
        .maybeSingle<Pick<Database['public']['Tables']['profiles']['Row'], 'business_name'>>()

      if (profile?.business_name && isActive) {
        setBusinessName(profile.business_name)
      }
    })()

    return () => {
      isActive = false
    }
  }, [businessNameProp])

  return (
    <div className="bg-white rounded-xl shadow-md border border-slate-200 p-3">
      <h3 className="text-sm font-bold text-slate-800 mb-3">
        Sådan ser dit opslag ud
      </h3>

      {/* No Platforms Selected - Show prompt */}
      {selectedPlatforms.length === 0 ? (
        <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-200">
          <h4 className="text-sm font-semibold text-indigo-900 mb-2">
            Vælg dine sociale medier for at se den rigtige forhåndsvisning
          </h4>
          <p className="text-xs text-indigo-700 mb-4 leading-relaxed">
            Når jeg ved, hvor du poster, kan jeg vise dig en forhåndsvisning, der passer til hver platform — og automatisk tilpasse størrelsen.
          </p>
          <button
            onClick={() => {
              window.location.href = '/dashboard/profile#social-media'
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors"
          >
            Vælg sociale medier
          </button>
        </div>
      ) : (
        <>
          {/* Platform Toggle - Only show for paid tiers with multiple platforms */}
          {selectedPlatforms.length > 1 && currentTier !== 'free' && (
        <div className="flex gap-2 mb-3">
          {selectedPlatforms.includes('facebook') && (
            <button
              onClick={() => onPreviewPlatformChange('facebook')}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                previewPlatform === 'facebook'
                  ? 'bg-[#F4F1FE] text-[#0F2E32] border border-[#C7BAF7] shadow-sm'
                  : 'bg-white text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F9FAFB]'
              }`}
            >
              Facebook
            </button>
          )}
          {selectedPlatforms.includes('instagram') && (
            <button
              onClick={() => onPreviewPlatformChange('instagram')}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                previewPlatform === 'instagram'
                  ? 'bg-[#F4F1FE] text-[#0F2E32] border border-[#C7BAF7] shadow-sm'
                  : 'bg-white text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F9FAFB]'
              }`}
            >
              Instagram
            </button>
          )}
        </div>
      )}
      
      {/* Single platform label for Free tier */}
      {currentTier === 'free' && selectedPlatforms.length === 1 && (
        <div className="mb-3 px-3 py-2 bg-[#F4F1FE] border border-[#C7BAF7] rounded-lg text-center">
          <span className="text-xs font-medium text-[#0F2E32]">
            {selectedPlatforms[0] === 'facebook' ? 'Facebook' : 'Instagram'}
          </span>
        </div>
      )}

      {/* FACEBOOK PREVIEW */}
      {previewPlatform === 'facebook' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          {/* Facebook Header */}
          <div className="p-3 bg-white">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-white border-2 border-slate-800 rounded-full flex items-center justify-center">
              </div>
              <div className="flex-1">
                {businessName && <p className="text-sm font-semibold text-gray-900">{businessName}</p>}
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <span>{t('create.justNow', 'Just now')}</span>
                  <span>·</span>
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M8 0C3.6 0 0 3.6 0 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm0 14c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z"/>
                    <circle cx="8" cy="8" r="2"/>
                  </svg>
                </div>
              </div>
              <button className="text-gray-500 hover:bg-gray-100 p-1 rounded">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/>
                </svg>
              </button>
            </div>
            
            {/* Facebook Post Text */}
            <div className="mt-3">
              {content.headline && (
                <h4 className="font-semibold text-sm text-gray-900 mb-1">{content.headline}</h4>
              )}
              {content.text && (
                <p className="text-sm text-gray-900 whitespace-pre-line leading-5">
                  {content.text}
                </p>
              )}
              {content.adjustments.includeHashtags && content.hashtags && content.hashtags.length > 0 && (
                <p className="text-sm text-blue-600 mt-1">
                  {content.hashtags.filter((h: any) => h.enabled).map((h: any) => h.tag).join(' ')}
                </p>
              )}
            </div>
          </div>

          {/* Facebook Photo */}
          {hasPhoto && uploadedMedia.length > 0 ? (
            <div className="relative w-full overflow-hidden rounded-xl">
              <img
                src={getPreviewUrl(uploadedMedia[selectedMediaIndex])}
                alt="Post preview"
                className="w-full h-auto object-cover"
              />

              {/* Remove Photo Button */}
              {onRemovePhoto && (
                <button
                  onClick={() => onRemovePhoto(selectedMediaIndex)}
                  className="absolute top-3 right-3 z-20 px-2 py-0.5 bg-white/95 text-red-600 rounded-full shadow-md text-xs font-semibold hover:bg-white transition-colors border border-white/70"
                  title="Fjern"
                >
                  Fjern
                </button>
              )}

              {/* Multiple Photos Navigation */}
              {uploadedMedia.length > 1 && (
                <>
                  <button
                    onClick={() => onMediaIndexChange(
                      selectedMediaIndex > 0 ? selectedMediaIndex - 1 : uploadedMedia.length - 1
                    )}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-700" />
                  </button>
                  <button
                    onClick={() => onMediaIndexChange(
                      selectedMediaIndex < uploadedMedia.length - 1 ? selectedMediaIndex + 1 : 0
                    )}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-700" />
                  </button>
                  <div className="absolute top-3 left-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                    {selectedMediaIndex + 1} / {uploadedMedia.length}
                  </div>
                </>
              )}

              {/* AI Badge */}
              {uploadedMedia[selectedMediaIndex].selectedVersionForPost === 'adjusted' && 
               uploadedMedia[selectedMediaIndex].adjustedUrl && (
                <div className="absolute bottom-3 left-3 px-2 py-1 bg-indigo-600 text-white rounded text-xs font-bold flex items-center gap-1 shadow-lg">
                  <Sparkles className="w-3 h-3" />
                  AI Enhanced
                </div>
              )}
            </div>
          ) : (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="relative bg-slate-50 aspect-[1.91/1] overflow-hidden flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors"
            >
              <div className="bg-white border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center gap-2 hover:border-indigo-400 hover:bg-indigo-50 transition-colors">
                <Camera className="w-8 h-8 text-slate-400" />
                <p className="text-slate-700 text-sm font-medium">Klik for at uploade</p>
                <p className="text-slate-500 text-xs">JPG, PNG eller GIF</p>
              </div>
            </div>
          )}

          {/* Facebook Engagement Section */}
          <div className="px-3 py-2 bg-white border-t border-gray-200">
            <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
              <div className="flex items-center gap-1">
                <div className="flex -space-x-1">
                  <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs">👍</div>
                  <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center text-white text-xs">❤️</div>
                </div>
                <span>42</span>
              </div>
              <div className="flex gap-3">
                <span>8 comments</span>
                <span>3 shares</span>
              </div>
            </div>
            <div className="flex items-center justify-around border-t border-gray-200 pt-2">
              <button className="flex-1 flex items-center justify-center gap-2 py-1 hover:bg-gray-50 rounded text-gray-600 text-sm font-medium">
                <span>👍</span>
                <span>Like</span>
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 py-1 hover:bg-gray-50 rounded text-gray-600 text-sm font-medium">
                <span>💬</span>
                <span>Comment</span>
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 py-1 hover:bg-gray-50 rounded text-gray-600 text-sm font-medium">
                <span>↗️</span>
                <span>Share</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INSTAGRAM PREVIEW */}
      {previewPlatform === 'instagram' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          {/* Instagram Header */}
          <div className="p-3 bg-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 p-0.5">
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                  <div className="w-6 h-6 bg-white border-2 border-slate-800 rounded-full flex items-center justify-center">
                  </div>
                </div>
              </div>
              <div>
                {businessName && <p className="text-sm font-semibold text-gray-900">{businessName}</p>}
              </div>
            </div>
            <button className="text-gray-900">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="5" r="1.5"/>
                <circle cx="12" cy="12" r="1.5"/>
                <circle cx="12" cy="19" r="1.5"/>
              </svg>
            </button>
          </div>

          {/* Instagram Photo */}
          {hasPhoto && uploadedMedia.length > 0 ? (
            <div className="relative bg-gray-100 aspect-square">
              <img
                src={getPreviewUrl(uploadedMedia[selectedMediaIndex])}
                alt="Post preview"
                className="w-full h-full object-cover"
              />
              
              {/* Remove Photo Button */}
              {onRemovePhoto && (
                <button
                  onClick={() => onRemovePhoto(selectedMediaIndex)}
                  className="absolute top-3 right-3 z-20 px-2 py-0.5 bg-white/95 text-red-600 rounded-full shadow-md text-xs font-semibold hover:bg-white transition-colors border border-white/70"
                  title="Fjern"
                >
                  Fjern
                </button>
              )}

              {/* Multiple Photos Indicator */}
              {uploadedMedia.length > 1 && (
                <>
                  <button
                    onClick={() => onMediaIndexChange(
                      selectedMediaIndex > 0 ? selectedMediaIndex - 1 : uploadedMedia.length - 1
                    )}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4 text-white" />
                  </button>
                  <button
                    onClick={() => onMediaIndexChange(
                      selectedMediaIndex < uploadedMedia.length - 1 ? selectedMediaIndex + 1 : 0
                    )}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors"
                  >
                    <ChevronRight className="w-4 h-4 text-white" />
                  </button>
                  <div className="absolute top-3 left-3 flex gap-1">
                    {uploadedMedia.map((_, index) => (
                      <div
                        key={index}
                        className={`w-1.5 h-1.5 rounded-full ${
                          index === selectedMediaIndex ? 'bg-white' : 'bg-white/50'
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
              
              {/* AI Badge */}
              {uploadedMedia[selectedMediaIndex].selectedVersionForPost === 'adjusted' && 
               uploadedMedia[selectedMediaIndex].adjustedUrl && (
                <div className="absolute bottom-3 left-3 px-2 py-1 bg-indigo-600 text-white rounded text-xs font-bold flex items-center gap-1 shadow-lg">
                  <Sparkles className="w-3 h-3" />
                  AI
                </div>
              )}
            </div>
          ) : (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="relative bg-slate-50 aspect-square overflow-hidden flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors"
            >
              <div className="bg-white border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center gap-2 hover:border-indigo-400 hover:bg-indigo-50 transition-colors">
                <Camera className="w-8 h-8 text-slate-400" />
                <p className="text-slate-700 text-sm font-medium">Klik for at uploade</p>
                <p className="text-slate-500 text-xs">JPG, PNG eller GIF</p>
              </div>
            </div>
          )}

          {/* Instagram Engagement */}
          <div className="p-3 bg-white">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-4">
                <button className="hover:opacity-50 transition-opacity">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                </button>
                <button className="hover:opacity-50 transition-opacity">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </button>
                <button className="hover:opacity-50 transition-opacity">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </button>
              </div>
              <button className="hover:opacity-50 transition-opacity">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                </svg>
              </button>
            </div>
            
            <p className="text-sm font-semibold text-gray-900 mb-1">127 likes</p>
            
            {/* Instagram Caption */}
            <div className="text-sm">
              {showBusinessLabel && (
                <span className="font-semibold text-gray-900">{normalizedBusinessName}</span>
              )}
              {showFallbackLabel && (
                <span className="font-semibold text-gray-900">
                  {t('create.yourBusiness', 'yourbusiness')}
                </span>
              )}
              {displayText && (
                <span className="text-gray-900 whitespace-pre-line">
                  {(showBusinessLabel || showFallbackLabel) ? ' ' : ''}
                  {displayText}
                </span>
              )}
              {content.adjustments.includeHashtags && content.hashtags && content.hashtags.length > 0 && (
                <span className="text-blue-900">
                  {' '}{content.hashtags.filter((h: any) => h.enabled).map((h: any) => h.tag).join(' ')}
                </span>
              )}
            </div>
            
            <p className="text-xs text-gray-500 mt-1">{t('create.justNow', 'Just now')}</p>
          </div>
        </div>
      )}
        </>
      )}

      {/* Hidden File Input */}
      {onPhotoUpload && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={onPhotoUpload}
          className="hidden"
        />
      )}
    </div>
  )
}