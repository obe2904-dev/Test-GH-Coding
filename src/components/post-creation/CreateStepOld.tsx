import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { usePostCreationStore } from '../../stores/postCreationStore'
import { ProgressStepper } from '../ui/ProgressStepper'

interface CreateStepProps {
  onNext: () => void
  onBack: () => void
}

// Icon Components (reusing from other components)
const Type = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <polyline points="4 7 4 4 20 4 20 7"/>
    <line x1="9" y1="20" x2="15" y2="20"/>
    <line x1="12" y1="4" x2="12" y2="20"/>
  </svg>
)

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

const Wand = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5"/>
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

const Hash = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <line x1="4" y1="9" x2="20" y2="9"/>
    <line x1="4" y1="15" x2="20" y2="15"/>
    <line x1="10" y1="3" x2="8" y2="21"/>
    <line x1="16" y1="3" x2="14" y2="21"/>
  </svg>
)

export function CreateStep({ onNext, onBack }: CreateStepProps) {
  const { t } = useTranslation()
  const {
    selectedPlatforms,
    postContent,
    setPostContent,
    photoContent,
    setPhotoContent
  } = usePostCreationStore()

  const [activePreviewPlatform, setActivePreviewPlatform] = useState(selectedPlatforms[0] || 'facebook')
  const [isGenerating, setIsGenerating] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Initialize postContent if null
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

    const file = files[0]
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file)
      setPhotoContent({
        uploadedMedia: [{
          id: Math.random().toString(36).substr(2, 9),
          file,
          url,
          type: 'image'
        }],
        selectedMedia: null,
        isOriginal: true,
        photoAdjustments: null
      })
    }
  }

  const handleAiMagic = async () => {
    if (!postContent) return
    
    setIsGenerating(true)
    
    // Simulate AI improvement
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Add some improvements
    const improvedText = postContent.text + '\n\n' + t('create.aiAddition', 'Want to learn more? Contact us today!')
    setPostContent({
      headline: postContent.headline,
      text: improvedText,
      adjustments: postContent.adjustments,
      platformSpecific: postContent.platformSpecific,
      platformContent: postContent.platformContent,
      hashtags: [
        ...(postContent.hashtags || []),
        { tag: '#quality', enabled: true },
        { tag: '#local', enabled: true }
      ]
    })
    
    setIsGenerating(false)
  }

  const toggleHashtag = (index: number) => {
    if (!postContent) return
    
    const newHashtags = [...(postContent.hashtags || [])]
    newHashtags[index] = { ...newHashtags[index], enabled: !newHashtags[index].enabled }
    setPostContent({
      headline: postContent.headline,
      text: postContent.text,
      adjustments: postContent.adjustments,
      platformSpecific: postContent.platformSpecific,
      platformContent: postContent.platformContent,
      hashtags: newHashtags
    })
  }

  const handleRemovePhoto = () => {
    setPhotoContent({
      uploadedMedia: [],
      selectedMedia: null,
      isOriginal: true,
      photoAdjustments: null
    })
  }

  return (
    <div className="max-w-7xl mx-auto px-3">
      
      {/* Progress Indicator */}
      <ProgressStepper currentStep={2} totalSteps={3} />

      {/* Platform Pills */}
      <div className="flex justify-center gap-2 mb-6">
        {selectedPlatforms.map(platform => (
          <button
            key={platform}
            onClick={() => setActivePreviewPlatform(platform)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
              activePreviewPlatform === platform
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {platform.charAt(0).toUpperCase() + platform.slice(1)}
          </button>
        ))}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* LEFT: Editor (40%) */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Content Editor */}
          <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Type className="w-5 h-5 text-indigo-600" />
                {t('create.content', 'Content')}
              </h3>
              
              <button
                onClick={handleAiMagic}
                disabled={isGenerating}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 transition-all font-semibold text-sm shadow-md flex items-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{t('create.improving', 'Improving...')}</span>
                  </>
                ) : (
                  <>
                    <Wand className="w-4 h-4" />
                    <span>{t('create.aiMagic', '✨ AI Magic')}</span>
                  </>
                )}
              </button>
            </div>

            <div className="space-y-4">
              {/* Headline */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  {t('create.headline', 'Headline')}
                </label>
                <input
                  type="text"
                  value={content.headline}
                  onChange={(e) => setPostContent({
                    headline: e.target.value,
                    text: content.text,
                    adjustments: content.adjustments,
                    platformSpecific: content.platformSpecific,
                    platformContent: content.platformContent,
                    hashtags: content.hashtags
                  })}
                  placeholder={t('create.headlinePlaceholder', 'e.g., "Weekend Special 🔥"')}
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base font-semibold"
                />
              </div>

              {/* Text */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    {t('create.text', 'Text')}
                  </label>
                  <span className="text-xs text-slate-500">
                    {content.text.length} {t('create.characters', 'characters')}
                  </span>
                </div>
                <textarea
                  value={content.text}
                  onChange={(e) => setPostContent({
                    headline: content.headline,
                    text: e.target.value,
                    adjustments: content.adjustments,
                    platformSpecific: content.platformSpecific,
                    platformContent: content.platformContent,
                    hashtags: content.hashtags
                  })}
                  placeholder={t('create.textPlaceholder', 'Write your post here...')}
                  rows={8}
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base resize-none"
                />
              </div>

              {/* Quick Toggles */}
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={content.adjustments.includeEmojis}
                    onChange={(e) => setPostContent({
                      headline: content.headline,
                      text: content.text,
                      adjustments: { ...content.adjustments, includeEmojis: e.target.checked },
                      platformSpecific: content.platformSpecific,
                      platformContent: content.platformContent,
                      hashtags: content.hashtags
                    })}
                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-slate-700">{t('create.includeEmojis', 'Include emojis')}</span>
                </label>
                
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={content.adjustments.includeHashtags}
                    onChange={(e) => setPostContent({
                      headline: content.headline,
                      text: content.text,
                      adjustments: { ...content.adjustments, includeHashtags: e.target.checked },
                      platformSpecific: content.platformSpecific,
                      platformContent: content.platformContent,
                      hashtags: content.hashtags
                    })}
                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-slate-700">{t('create.includeHashtags', 'Include hashtags')}</span>
                </label>
              </div>
            </div>
          </div>

          {/* Photo Upload */}
          <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-4">
              <Camera className="w-5 h-5 text-indigo-600" />
              {t('create.photo', 'Photo')}
            </h3>

            {!photoContent?.uploadedMedia || photoContent.uploadedMedia.length === 0 ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-all"
              >
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-700 mb-1">
                  {t('create.uploadPhoto', 'Click to upload photo')}
                </p>
                <p className="text-xs text-slate-500">
                  {t('create.or', 'or')} <span className="text-indigo-600 font-medium">{t('create.skip', 'skip this step')}</span>
                </p>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative rounded-lg overflow-hidden">
                  <img
                    src={photoContent.uploadedMedia[0].url}
                    alt="Upload"
                    className="w-full h-48 object-cover"
                  />
                  <button
                    onClick={handleRemovePhoto}
                    className="absolute top-2 right-2 px-3 py-1.5 bg-red-600 text-white rounded-lg shadow-lg text-xs font-semibold hover:bg-red-700 transition-all"
                  >
                    {t('create.remove', 'Remove')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Hashtags */}
          {content.adjustments.includeHashtags && content.hashtags && content.hashtags.length > 0 && (
            <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6">
              <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Hash className="w-4 h-4 text-indigo-600" />
                {t('create.hashtags', 'Hashtags')}
              </h3>
              
              <div className="flex flex-wrap gap-2">
                {content.hashtags.map((hashtag, index) => (
                  <button
                    key={index}
                    onClick={() => toggleHashtag(index)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      hashtag.enabled
                        ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-400'
                        : 'bg-slate-100 text-slate-500 border-2 border-slate-300'
                    }`}
                  >
                    {hashtag.tag}
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* RIGHT: Live Preview (60%) */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6 sticky top-6">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-4">
              <Eye className="w-5 h-5 text-indigo-600" />
              {t('create.livePreview', 'Live Preview')}
            </h3>

            {/* Platform Preview */}
            <div className={`border-2 rounded-lg overflow-hidden ${
              activePreviewPlatform === 'facebook' ? 'border-blue-200' :
              activePreviewPlatform === 'instagram' ? 'border-pink-200' :
              'border-slate-200'
            }`}>
              {/* Platform Header */}
              <div className={`p-3 border-b ${
                activePreviewPlatform === 'facebook' ? 'bg-blue-50 border-blue-200' :
                activePreviewPlatform === 'instagram' ? 'bg-gradient-to-r from-purple-50 to-pink-50 border-pink-200' :
                'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                    Y
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{t('create.yourBusiness', 'Your Business')}</p>
                    <p className="text-xs text-slate-500">{t('create.justNow', 'Just now')}</p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                {content.headline && (
                  <h4 className="font-bold text-slate-900 mb-2">{content.headline}</h4>
                )}
                {content.text && (
                  <p className="text-sm text-slate-700 whitespace-pre-line mb-3">{content.text}</p>
                )}
                {content.adjustments.includeHashtags && content.hashtags && content.hashtags.filter(h => h.enabled).length > 0 && (
                  <p className="text-sm text-indigo-600 mb-3">
                    {content.hashtags.filter(h => h.enabled).map(h => h.tag).join(' ')}
                  </p>
                )}
                {photoContent?.uploadedMedia?.[0] && (
                  <img
                    src={photoContent.uploadedMedia[0].url}
                    alt="Post"
                    className={activePreviewPlatform === 'instagram' ? 'w-full aspect-square object-cover rounded-lg' : 'w-full rounded-lg max-h-64 object-cover'}
                  />
                )}

                {/* Mock Engagement */}
                <div className="mt-3 pt-3 border-t border-slate-200 flex items-center gap-4 text-xs text-slate-500">
                  {activePreviewPlatform === 'facebook' && (
                    <>
                      <span>👍 42</span>
                      <span>💬 8</span>
                      <span>↗️ 3</span>
                    </>
                  )}
                  {activePreviewPlatform === 'instagram' && (
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
      <div className="flex justify-between items-center mt-8 pt-6 pb-8">
        <button
          onClick={onBack}
          className="px-8 py-3 text-base font-medium text-slate-600 hover:text-slate-800 transition-colors flex items-center gap-2"
        >
          <ChevronLeft className="w-5 h-5" />
          <span>{t('create.back', 'Back')}</span>
        </button>
        
        <button
          onClick={onNext}
          disabled={!content.headline || !content.text}
          className="px-8 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold text-base shadow-lg flex items-center gap-2"
        >
          <span>{t('create.continue', 'Continue to Publish')}</span>
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

    </div>
  )
}
