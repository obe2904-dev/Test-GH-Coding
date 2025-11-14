import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { usePostCreationStore } from '../../stores/postCreationStore'
// @ts-ignore - Old deprecated file
import facebookLogo from '../../assets/facebook-logo.png'
// @ts-ignore - Old deprecated file
import instagramLogo from '../../assets/instagram-logo.png'

interface DraftStepProps {
  onNext: () => void
  onBack: () => void
}

interface PlatformPreview {
  platform: string
  headline: string
  text: string
  adjustments: {
    includeHashtags: boolean
    includeEmojis: boolean
    includeBookingLink: boolean
  }
}

export const DraftStep: React.FC<DraftStepProps> = ({ onNext, onBack }) => {
  const { t } = useTranslation()
  const { selectedPlatforms, postContent, photoContent, ideas, aiIdeas, selectedIdea } = usePostCreationStore()
  
  const [platformPreviews, setPlatformPreviews] = useState<PlatformPreview[]>([])
  const [editingPlatform, setEditingPlatform] = useState<string | null>(null)

  // Get the selected idea for context
  const allIdeas = [...ideas, ...aiIdeas]
  const currentIdea = allIdeas.find(idea => idea.id === selectedIdea)

  useEffect(() => {
    // Initialize platform previews with the current post content
    const previews = selectedPlatforms.map(platform => ({
      platform,
      headline: postContent?.headline || currentIdea?.headline || '',
      text: postContent?.text || currentIdea?.text || '',
      adjustments: postContent?.adjustments || {
        includeHashtags: true,
        includeEmojis: true,
        includeBookingLink: false
      }
    }))
    setPlatformPreviews(previews)
    
    // Debug: Log photoContent to see what's available
    console.log('DraftStep photoContent:', photoContent)
  }, [selectedPlatforms, postContent, currentIdea, photoContent])

  const updatePlatformPreview = (platform: string, field: string, value: any) => {
    setPlatformPreviews(prev => 
      prev.map(preview => 
        preview.platform === platform 
          ? { ...preview, [field]: value }
          : preview
      )
    )
  }

  const toggleAdjustment = (platform: string, adjustment: string) => {
    setPlatformPreviews(prev => 
      prev.map(preview => 
        preview.platform === platform 
          ? { 
              ...preview, 
              adjustments: { 
                ...preview.adjustments, 
                [adjustment]: !preview.adjustments[adjustment as keyof typeof preview.adjustments] 
              }
            }
          : preview
      )
    )
  }

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'facebook': return <img src={facebookLogo} alt="Facebook" className="w-6 h-6" />
      case 'instagram': return <img src={instagramLogo} alt="Instagram" className="w-6 h-6" />
      case 'linkedin': return '💼'
      default: return '📱'
    }
  }

  const getPlatformName = (platform: string) => {
    return platform.charAt(0).toUpperCase() + platform.slice(1)
  }

  const formatPreviewText = (preview: PlatformPreview) => {
    let text = preview.text

    // Add hashtags if enabled
    if (preview.adjustments.includeHashtags && !text.includes('#')) {
      text += '\n\n#lokalbageri #friskbagte #kvalitet'
    }

    // Add emojis if enabled and not already present
    if (preview.adjustments.includeEmojis && !text.includes('🍞') && !text.includes('🥖')) {
      text = text.replace(/brød/gi, 'brød 🍞').replace(/bageri/gi, 'bageri 🥖')
    }

    // Add booking link if enabled
    if (preview.adjustments.includeBookingLink && !text.includes('Book bord')) {
      text += '\n\n📞 Book bord: www.restaurant.dk/booking'
    }

    return text
  }

  return (
    <div className="space-y-6">
      {/* Platform Previews Grid */}
      <div className={`grid gap-6 ${selectedPlatforms.length === 1 ? 'grid-cols-1' : selectedPlatforms.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {platformPreviews.map((preview) => (
          <div key={preview.platform} className="bg-white rounded-lg border border-gray-200 p-6">
            {/* Platform Header */}
            <div className="flex items-center justify-between mb-4 px-2">
              <h3 className="text-base font-medium text-gray-900 flex items-center space-x-2">
                {getPlatformIcon(preview.platform)}
                <span>{getPlatformName(preview.platform)} Preview</span>
              </h3>
              <button
                onClick={() => setEditingPlatform(editingPlatform === preview.platform ? null : preview.platform)}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {editingPlatform === preview.platform ? 'Færdig' : 'Rediger'}
              </button>
            </div>

            {/* Platform Preview */}
            <div className={`border border-gray-200 rounded-lg overflow-hidden mb-4 ${
              preview.platform === 'facebook' ? 'bg-white' : 
              preview.platform === 'instagram' ? 'bg-white' : 'bg-gray-50'
            }`}>
              {/* Mock Platform Header */}
              <div className={`p-3 border-b border-gray-200 ${
                preview.platform === 'facebook' ? 'bg-blue-50' : 
                preview.platform === 'instagram' ? 'bg-gradient-to-r from-purple-50 to-pink-50' : 'bg-gray-50'
              }`}>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                    {getPlatformIcon(preview.platform)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Dit Firma</p>
                    <p className="text-xs text-gray-500">2 min</p>
                  </div>
                </div>
              </div>

              {/* Post Content */}
              <div className="p-4">
                {preview.platform === 'instagram' ? (
                  /* Instagram Layout: Photo first, then text below */
                  <>
                    {/* Photo if available */}
                    {photoContent?.uploadedMedia && photoContent.uploadedMedia.length > 0 && (
                      <div className="mb-3">
                        <img
                          src={photoContent.uploadedMedia[0].url}
                          alt="Post media"
                          className="w-full rounded-lg object-cover aspect-square"
                        />
                      </div>
                    )}

                    {/* Text Content */}
                    {editingPlatform === preview.platform ? (
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={preview.headline}
                          onChange={(e) => updatePlatformPreview(preview.platform, 'headline', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-semibold"
                          placeholder="Overskrift..."
                        />
                        <textarea
                          value={preview.text}
                          onChange={(e) => updatePlatformPreview(preview.platform, 'text', e.target.value)}
                          rows={4}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Skriv dit opslag her..."
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {preview.headline && (
                          <h4 className="font-semibold text-gray-900">{preview.headline}</h4>
                        )}
                        <p className="text-gray-700 whitespace-pre-line text-sm leading-relaxed">
                          {formatPreviewText(preview)}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  /* Facebook/LinkedIn Layout: Text first, then photo below */
                  <>
                    {/* Text Content */}
                    {editingPlatform === preview.platform ? (
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={preview.headline}
                          onChange={(e) => updatePlatformPreview(preview.platform, 'headline', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-semibold"
                          placeholder="Overskrift..."
                        />
                        <textarea
                          value={preview.text}
                          onChange={(e) => updatePlatformPreview(preview.platform, 'text', e.target.value)}
                          rows={4}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Skriv dit opslag her..."
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {preview.headline && (
                          <h4 className="font-semibold text-gray-900">{preview.headline}</h4>
                        )}
                        <p className="text-gray-700 whitespace-pre-line text-sm leading-relaxed">
                          {formatPreviewText(preview)}
                        </p>
                      </div>
                    )}

                    {/* Photo if available */}
                    {photoContent?.uploadedMedia && photoContent.uploadedMedia.length > 0 && (
                      <div className="mt-3">
                        <img
                          src={photoContent.uploadedMedia[0].url}
                          alt="Post media"
                          className="w-full rounded-lg object-cover max-h-64"
                        />
                      </div>
                    )}
                  </>
                )}

                {/* Platform-specific interactions */}
                <div className={`mt-3 pt-3 border-t border-gray-100 flex items-center space-x-4 text-xs text-gray-500 ${
                  preview.platform === 'facebook' ? '' : preview.platform === 'instagram' ? '' : ''
                }`}>
                  {preview.platform === 'facebook' && (
                    <>
                      <span>👍 42</span>
                      <span>💬 8 kommentarer</span>
                      <span>↗️ 3 delinger</span>
                    </>
                  )}
                  {preview.platform === 'instagram' && (
                    <>
                      <span>❤️ 127</span>
                      <span>💬 15</span>
                      <span>📤</span>
                    </>
                  )}
                  {preview.platform === 'linkedin' && (
                    <>
                      <span>👍 18</span>
                      <span>💬 5 kommentarer</span>
                      <span>↗️ 2 delinger</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Editing Controls */}
            {editingPlatform === preview.platform && (
              <div className="space-y-3">
                <h5 className="text-base font-medium text-gray-700">Indstillinger:</h5>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={preview.adjustments.includeHashtags}
                      onChange={() => toggleAdjustment(preview.platform, 'includeHashtags')}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Hashtags</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={preview.adjustments.includeEmojis}
                      onChange={() => toggleAdjustment(preview.platform, 'includeEmojis')}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Emojis</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={preview.adjustments.includeBookingLink}
                      onChange={() => toggleAdjustment(preview.platform, 'includeBookingLink')}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Booking link</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Navigation */}
      <div className="py-6">
        <div className="flex justify-between items-center">
          <button
            onClick={onBack}
            className="px-8 py-3 text-base font-medium text-slate-600 hover:text-slate-800 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>{t('createPost.text.back')}</span>
          </button>
          
          <button
            onClick={onNext}
            className="px-8 py-3 text-base font-medium text-indigo-600 hover:text-indigo-700 transition-colors flex items-center gap-2"
          >
            <span>{t('createPost.text.next')}</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}