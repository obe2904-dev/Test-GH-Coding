import { useTranslation } from 'react-i18next'
import { useState, useEffect, useRef, useMemo } from 'react'
import IconButton from '../../ui/IconButton'
import { supabase } from '../../../lib/supabase'
import { MediaItem } from '../../../stores/postCreationStore'
import type { Database } from '../../../types/supabase'

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



interface PostContent {
  headline: string
  text: string
  hashtags: Array<{ tag: string; enabled: boolean }>
  includeHashtags?: boolean
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
  onSelectVersionForPost?: (version: 'original' | 'adjusted') => void
  currentTier: string
  businessName?: string
  /** Called when the user clicks the "Rediger tekst" button. */
  onEditCaption?: () => void
  platformFormat?: string
  /** Whether carousel mode is active for Instagram dot indicator rendering */
  carouselMode?: boolean
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
  onSelectVersionForPost,
  currentTier,
  businessName: businessNameProp,
  onEditCaption,
  platformFormat: _platformFormat,
  carouselMode = false,
}: PlatformPreviewProps) {
  const { t } = useTranslation(undefined, { keyPrefix: 'createPost' })
  const [businessName, setBusinessName] = useState<string>(businessNameProp || '')
  const autoDefaultedMediaIdsRef = useRef<Set<string>>(new Set())
  
  const hasPhoto = uploadedMedia && uploadedMedia.length > 0
  const currentMedia = hasPhoto ? uploadedMedia[selectedMediaIndex] : undefined
  const hasAdjustedVersion = Boolean(currentMedia?.adjustedUrl)

  useEffect(() => {
    if (!currentMedia || !currentMedia.id) return
    if (!hasAdjustedVersion) return
    if (!onSelectVersionForPost) return
    if (autoDefaultedMediaIdsRef.current.has(currentMedia.id)) return

    autoDefaultedMediaIdsRef.current.add(currentMedia.id)

    if (currentMedia.selectedVersionForPost !== 'adjusted') {
      onSelectVersionForPost('adjusted')
    }
  }, [currentMedia, hasAdjustedVersion, onSelectVersionForPost])

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
  const includeHashtags = content.includeHashtags ?? content.adjustments?.includeHashtags ?? true
  
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
        {t('preview.heading')}
      </h3>

      {/* No Platforms Selected - Show prompt */}
      {selectedPlatforms.length === 0 ? (
        <div className="bg-cta-surface rounded-xl p-4 border border-cta-surface">
          <h4 className="text-sm font-semibold text-brand mb-2">
            {t('preview.noPlatformsTitle')}
          </h4>
          <p className="text-xs text-cta-text mb-4 leading-relaxed">
            {t('preview.noPlatformsDesc')}
          </p>
          <button
            onClick={() => {
              window.location.href = '/dashboard/profile#social-media'
            }}
            className="px-4 py-2 bg-cta text-white rounded-lg text-xs font-semibold hover:bg-cta-hover transition-colors"
          >
            {t('preview.selectSocialMedia')}
          </button>
        </div>
      ) : (
        <>
          {/* Platform Toggle - Show when multiple platforms are selected */}
          {selectedPlatforms.length > 1 && (
            <div className="flex gap-2 mb-3">
          {selectedPlatforms.includes('facebook') && (
            <button
              onClick={() => onPreviewPlatformChange('facebook')}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                previewPlatform === 'facebook'
                  ? 'bg-[#F4F1FE] text-brand border border-accent shadow-sm'
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
                  ? 'bg-[#F4F1FE] text-brand border border-accent shadow-sm'
                  : 'bg-white text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F9FAFB]'
              }`}
            >
              Instagram
            </button>
          )}
        </div>
      )}
      
      {/* Single platform label when only one platform is selected */}
      {selectedPlatforms.length === 1 && (
        <div className="mb-3 px-3 py-2 bg-[#F4F1FE] border border-accent rounded-lg text-center">
          <span className="text-xs font-medium text-brand">
            {selectedPlatforms[0] === 'facebook' ? 'Facebook' : 'Instagram'}
          </span>
        </div>
      )}

      {/* Version Toggle - right side preview */}
      {hasPhoto && hasAdjustedVersion && onSelectVersionForPost && currentMedia && (
        <div className="mb-3 p-1 bg-slate-100 rounded-lg border border-slate-200 flex gap-1">
          <button
            onClick={() => onSelectVersionForPost('original')}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              currentMedia.selectedVersionForPost === 'original'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:bg-white/70'
            }`}
          >
            {t('create.original', 'Original')}
          </button>
          <button
            onClick={() => onSelectVersionForPost('adjusted')}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1 ${
              currentMedia.selectedVersionForPost === 'adjusted'
                ? 'bg-cta text-white shadow-sm'
                : 'text-slate-600 hover:bg-white/70'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            {t('create.aiEnhanced', 'AI Enhanced')}
          </button>
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
              <IconButton ariaLabel="Open post menu" className="text-gray-500 hover:bg-gray-100" iconClassName="w-5 h-5">
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/>
                </svg>
              </IconButton>
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
              {onEditCaption && (
                <button
                  onClick={onEditCaption}
                  className="mt-2 flex items-center gap-1 text-xs font-medium text-cta hover:text-cta-text transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  {t('editCaption', 'Rediger tekst')}
                </button>
              )}
              {includeHashtags && content.hashtags && content.hashtags.length > 0 && (
                <p className="text-sm text-blue-600 mt-1">
                  {content.hashtags.filter((h: any) => h.enabled).map((h: any) => h.tag).join(' ')}
                </p>
              )}
            </div>
          </div>

          {/* Facebook Photo */}
          {hasPhoto && uploadedMedia.length > 0 ? (
            <div className="relative w-full overflow-hidden rounded-xl bg-black" style={{ maxHeight: '420px' }}>
              {uploadedMedia[selectedMediaIndex].type === 'video' ? (
                <video
                  src={getPreviewUrl(uploadedMedia[selectedMediaIndex])}
                  controls
                  className="relative z-10 w-full h-auto block bg-black"
                  style={{ maxHeight: '420px', objectFit: 'contain' }}
                />
              ) : (
                <>
                  {/* Blurred background fill */}
                  <img
                    src={getPreviewUrl(uploadedMedia[selectedMediaIndex])}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full object-cover object-center blur-xl scale-110 opacity-60"
                  />
                  {/* Main image - full photo visible */}
                  <img
                    src={getPreviewUrl(uploadedMedia[selectedMediaIndex])}
                    alt="Post preview"
                    className="relative z-10 w-full h-auto block mx-auto"
                    style={{ maxHeight: '420px', objectFit: 'contain' }}
                  />
                </>
              )}

              {/* Multiple Photos Navigation */}
              {uploadedMedia.length > 1 && (
                <>
                  <IconButton
                    ariaLabel="Previous photo"
                    onClick={() => onMediaIndexChange(
                      selectedMediaIndex > 0 ? selectedMediaIndex - 1 : uploadedMedia.length - 1
                    )}
                    className="absolute left-3 top-1/2 -translate-y-1/2 min-w-10 min-h-10 w-8 h-8 bg-white/90 hover:bg-white rounded-full shadow-lg transition-colors"
                    iconClassName="w-5 h-5 text-gray-700"
                  >
                    <ChevronLeft />
                  </IconButton>
                  <IconButton
                    ariaLabel="Next photo"
                    onClick={() => onMediaIndexChange(
                      selectedMediaIndex < uploadedMedia.length - 1 ? selectedMediaIndex + 1 : 0
                    )}
                    className="absolute right-3 top-1/2 -translate-y-1/2 min-w-10 min-h-10 w-8 h-8 bg-white/90 hover:bg-white rounded-full shadow-lg transition-colors"
                    iconClassName="w-5 h-5 text-gray-700"
                  >
                    <ChevronRight />
                  </IconButton>

                </>
              )}

              {/* AI Badge */}
              {uploadedMedia[selectedMediaIndex].selectedVersionForPost === 'adjusted' && 
               uploadedMedia[selectedMediaIndex].adjustedUrl && (
                <div className="absolute bottom-3 left-3 px-2 py-1 bg-cta text-white rounded text-xs font-bold flex items-center gap-1 shadow-lg">
                  <Sparkles className="w-3 h-3" />
                  AI Enhanced
                </div>
              )}
            </div>
          ) : (
            <div className="relative bg-slate-50 aspect-[1.91/1] overflow-hidden flex items-center justify-center">
              <p className="text-xs text-slate-400">{t('preview.noPhotoYet', 'Upload et billede i venstre kolonne')}</p>
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
            <IconButton ariaLabel="Open post menu" className="text-gray-900" iconClassName="w-6 h-6">
              <svg fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="5" r="1.5"/>
                <circle cx="12" cy="12" r="1.5"/>
                <circle cx="12" cy="19" r="1.5"/>
              </svg>
            </IconButton>
          </div>

          {/* Instagram Photo */}
          {hasPhoto && uploadedMedia.length > 0 ? (
            <div className="relative w-full overflow-hidden bg-black" style={{ maxHeight: '480px' }}>
              {uploadedMedia[selectedMediaIndex].type === 'video' ? (
                <video
                  src={getPreviewUrl(uploadedMedia[selectedMediaIndex])}
                  controls
                  className="relative z-10 w-full h-auto block bg-black"
                  style={{ maxHeight: '480px', objectFit: 'contain' }}
                />
              ) : (
                <>
                  {/* Blurred background fill */}
                  <img
                    src={getPreviewUrl(uploadedMedia[selectedMediaIndex])}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full object-cover object-center blur-xl scale-110 opacity-60"
                  />
                  {/* Main image - full photo visible */}
                  <img
                    src={getPreviewUrl(uploadedMedia[selectedMediaIndex])}
                    alt="Post preview"
                    className="relative z-10 w-full h-auto block mx-auto"
                    style={{ maxHeight: '480px', objectFit: 'contain' }}
                  />
                </>
              )}
              
              {/* Multiple Photos Indicator */}
              {uploadedMedia.length > 1 && (
                <>
                  <IconButton
                    ariaLabel="Previous photo"
                    onClick={() => onMediaIndexChange(
                      selectedMediaIndex > 0 ? selectedMediaIndex - 1 : uploadedMedia.length - 1
                    )}
                    className="absolute left-2 top-1/2 -translate-y-1/2 min-w-10 min-h-10 w-7 h-7 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
                    iconClassName="w-4 h-4 text-white"
                  >
                    <ChevronLeft />
                  </IconButton>
                  <IconButton
                    ariaLabel="Next photo"
                    onClick={() => onMediaIndexChange(
                      selectedMediaIndex < uploadedMedia.length - 1 ? selectedMediaIndex + 1 : 0
                    )}
                    className="absolute right-2 top-1/2 -translate-y-1/2 min-w-10 min-h-10 w-7 h-7 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
                    iconClassName="w-4 h-4 text-white"
                  >
                    <ChevronRight />
                  </IconButton>

                  {/* Carousel icon (stacked squares) — Instagram carousel indicator */}
                  {carouselMode && (
                    <div className="absolute top-2 right-2 z-20 pointer-events-none">
                      <svg className="w-5 h-5 text-white drop-shadow" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <rect x="7" y="3" width="14" height="14" rx="2"/>
                        <path d="M3 7v11a2 2 0 002 2h11"/>
                      </svg>
                    </div>
                  )}

                  {/* Slide counter badge when not in carousel mode, just a count */}
                  {!carouselMode && (
                    <div className="absolute top-2 right-2 z-20 px-1.5 py-0.5 bg-black/60 text-white text-[10px] font-semibold rounded pointer-events-none">
                      {selectedMediaIndex + 1}/{uploadedMedia.length}
                    </div>
                  )}

                  {/* Dot indicators — bottom center (carousel style) */}
                  <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1 z-20 pointer-events-none">
                    {uploadedMedia.map((_, index) => (
                      <div
                        key={index}
                        className={`rounded-full transition-all ${
                          index === selectedMediaIndex
                            ? 'w-2 h-2 bg-white'
                            : 'w-1.5 h-1.5 bg-white/50'
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
              
              {/* AI Badge */}
              {uploadedMedia[selectedMediaIndex].selectedVersionForPost === 'adjusted' && 
               uploadedMedia[selectedMediaIndex].adjustedUrl && (
                <div className="absolute bottom-3 left-3 px-2 py-1 bg-cta text-white rounded text-xs font-bold flex items-center gap-1 shadow-lg">
                  <Sparkles className="w-3 h-3" />
                  AI
                </div>
              )}
            </div>
          ) : (
            <div className="relative bg-slate-50 aspect-square overflow-hidden flex items-center justify-center">
              <p className="text-xs text-slate-400">{t('preview.noPhotoYet', 'Upload et billede i venstre kolonne')}</p>
            </div>
          )}

          {/* Instagram Engagement */}
          <div className="p-3 bg-white">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-4">
                <IconButton ariaLabel="Like" className="hover:opacity-50 transition-opacity" iconClassName="w-6 h-6">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                </IconButton>
                <IconButton ariaLabel="Comment" className="hover:opacity-50 transition-opacity" iconClassName="w-6 h-6">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </IconButton>
                <IconButton ariaLabel="Share" className="hover:opacity-50 transition-opacity" iconClassName="w-6 h-6">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </IconButton>
              </div>
              <IconButton ariaLabel="Bookmark" className="hover:opacity-50 transition-opacity" iconClassName="w-6 h-6">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                </svg>
              </IconButton>
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
              {includeHashtags && content.hashtags && content.hashtags.length > 0 && (
                <span className="text-blue-900">
                  {' '}{content.hashtags.filter((h: any) => h.enabled).map((h: any) => h.tag).join(' ')}
                </span>
              )}
            </div>
            {onEditCaption && (
              <button
                onClick={onEditCaption}
                className="mt-2 flex items-center gap-1 text-xs font-medium text-cta hover:text-cta-text transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                {t('editCaption', 'Rediger tekst')}
              </button>
            )}
            
            <p className="text-xs text-gray-500 mt-1">{t('create.justNow', 'Just now')}</p>
          </div>
        </div>
      )}
      </>
      )}

    </div>
  )
}