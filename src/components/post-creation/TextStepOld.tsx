import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { usePostCreationStore } from '../../stores/postCreationStore'

interface TextStepProps {
  onNext: () => void
  onBack: () => void
}

interface TextAdjustments {
  length: 'shorter' | 'current' | 'longer'
  tone: 'professional' | 'casual' | 'friendly' | 'excited'
  includeHashtags: boolean
  includeEmojis: boolean
  includeBookingLink: boolean
}

interface PlatformHashtag {
  tag: string
  enabled: boolean
  platforms?: string[] // Optional for shared hashtags to show which platforms they apply to
}

interface PlatformContent {
  headline: string
  text: string
  adjustments: TextAdjustments
  hashtags: PlatformHashtag[]
}

// Icon Components
const Wand = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5"/>
  </svg>
)

const Type = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <polyline points="4 7 4 4 20 4 20 7"/>
    <line x1="9" y1="20" x2="15" y2="20"/>
    <line x1="12" y1="4" x2="12" y2="20"/>
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

const Hash = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <line x1="4" y1="9" x2="20" y2="9"/>
    <line x1="4" y1="15" x2="20" y2="15"/>
    <line x1="10" y1="3" x2="8" y2="21"/>
    <line x1="16" y1="3" x2="14" y2="21"/>
  </svg>
)

const Settings = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <circle cx="12" cy="12" r="3"/>
    <path d="M12 1v6m0 6v6m5.196-13.804l-4.242 4.242m0 6.364l4.242 4.242M1 12h6m6 0h6M4.222 4.222l4.242 4.242m6.364 0l4.242-4.242M4.222 19.778l4.242-4.242m6.364 0l4.242 4.242"/>
  </svg>
)

const Copy = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
)

const Facebook = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
  </svg>
)

const Instagram = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
  </svg>
)

export const TextStep: React.FC<TextStepProps> = ({ onNext, onBack }) => {
  const { t } = useTranslation()
  const { selectedIdea, ideas, aiIdeas, setPostContent, selectedPlatforms, postContent } = usePostCreationStore()
  
  const platforms = [
    { id: 'facebook', name: 'Facebook', icon: Facebook, color: 'bg-blue-500' },
    { id: 'instagram', name: 'Instagram', icon: Instagram, color: 'bg-pink-500' }
  ]

  const [customizePerPlatform, setCustomizePerPlatform] = useState(false)
  const [activePlatform, setActivePlatform] = useState('facebook')
  const [isGenerating, setIsGenerating] = useState(false)

  // Shared content (when customizePerPlatform is false)
  const [sharedContent, setSharedContent] = useState<PlatformContent>({
    headline: '',
    text: '',
    adjustments: {
      length: 'current',
      tone: 'friendly',
      includeHashtags: true,
      includeEmojis: true,
      includeBookingLink: false
    },
    hashtags: [] // Start with no hashtags - they appear after AI update
  })

  // Platform-specific content (when customizePerPlatform is true)
  const [platformContent, setPlatformContent] = useState<Record<string, PlatformContent>>({
    facebook: {
      headline: '',
      text: '',
      adjustments: {
        length: 'current',
        tone: 'friendly',
        includeHashtags: true,
        includeEmojis: true,
        includeBookingLink: true
      },
      hashtags: [] // Start with no hashtags - they appear after AI update
    },
    instagram: {
      headline: '',
      text: '',
      adjustments: {
        length: 'current',
        tone: 'excited',
        includeHashtags: true,
        includeEmojis: true,
        includeBookingLink: false
      },
      hashtags: [] // Start with no hashtags - they appear after AI update
    }
  })

  // Generate platform-specific hashtags based on the content
  const generateHashtags = (platform?: string) => {
    const baseHashtags = ['#lokalbageri', '#friskbagte', '#kvalitet', '#hjemmebagt']
    
    if (platform === 'facebook') {
      return [
        ...baseHashtags.map(tag => ({ tag, enabled: true })),
        { tag: '#bageri', enabled: true },
        { tag: '#lokalt', enabled: true }
      ]
    } else if (platform === 'instagram') {
      return [
        ...baseHashtags.map(tag => ({ tag, enabled: true })),
        { tag: '#fresh', enabled: true },
        { tag: '#homemade', enabled: true },
        { tag: '#delicious', enabled: true },
        { tag: '#foodie', enabled: true }
      ]
    }
    
    // For shared content, include platform indicators
    return [
      { tag: '#lokalbageri', enabled: true, platforms: ['facebook', 'instagram'] },
      { tag: '#friskbagte', enabled: true, platforms: ['facebook', 'instagram'] },
      { tag: '#kvalitet', enabled: true, platforms: ['facebook', 'instagram'] },
      { tag: '#hjemmebagt', enabled: true, platforms: ['facebook', 'instagram'] },
      { tag: '#fresh', enabled: false, platforms: ['instagram'] },
      { tag: '#homemade', enabled: false, platforms: ['instagram'] }
    ]
  }

  // Get current content based on mode
  const getCurrentContent = () => {
    if (customizePerPlatform) {
      return platformContent[activePlatform]
    }
    return sharedContent
  }

  const updateCurrentContent = (field: keyof PlatformContent, value: any) => {
    if (customizePerPlatform) {
      setPlatformContent(prev => ({
        ...prev,
        [activePlatform]: {
          ...prev[activePlatform],
          [field]: value
        }
      }))
    } else {
      setSharedContent(prev => ({
        ...prev,
        [field]: value
      }))
    }
  }

  const currentContent = getCurrentContent()

  // Load selected idea content when component mounts
  useEffect(() => {
    // First, try to load from saved postContent (when user goes back)
    if (postContent) {
      if (postContent.platformSpecific) {
        setCustomizePerPlatform(true)
        setPlatformContent(postContent.platformContent || platformContent)
      } else {
        setSharedContent({
          headline: postContent.headline || '',
          text: postContent.text || '',
          adjustments: postContent.adjustments || sharedContent.adjustments,
          hashtags: postContent.hashtags || []
        })
      }
      return
    }

    // Otherwise, load from selected idea (fresh start)
    if (selectedIdea) {
      // Find the selected idea from either user ideas or AI ideas
      const userIdea = ideas.find(idea => idea.id === selectedIdea)
      const aiIdea = aiIdeas.find(idea => idea.id === selectedIdea)
      const selectedIdeaData = userIdea || aiIdea

      if (selectedIdeaData) {
        const initialHeadline = selectedIdeaData.headline || selectedIdeaData.title || ''
        const initialText = selectedIdeaData.text || ''

        setSharedContent({
          headline: initialHeadline,
          text: initialText,
          adjustments: sharedContent.adjustments,
          hashtags: [] // Start with no hashtags - they appear after AI update
        })

        // Also initialize platform content with same data
        setPlatformContent({
          facebook: {
            headline: initialHeadline,
            text: initialText,
            adjustments: {
              length: 'current',
              tone: 'friendly',
              includeHashtags: true,
              includeEmojis: true,
              includeBookingLink: true
            },
            hashtags: [] // Start with no hashtags - they appear after AI update
          },
          instagram: {
            headline: initialHeadline,
            text: initialText,
            adjustments: {
              length: 'current',
              tone: 'excited',
              includeHashtags: true,
              includeEmojis: true,
              includeBookingLink: false
            },
            hashtags: [] // Start with no hashtags - they appear after AI update
          }
        })
      }
    }
  }, [selectedIdea, ideas, aiIdeas, postContent])

  const handleAdjustment = (type: keyof TextAdjustments, value: any) => {
    const newAdjustments = { ...currentContent.adjustments, [type]: value }
    updateCurrentContent('adjustments', newAdjustments)
  }

  const generateAdjustedContent = async () => {
    const headline = currentContent.headline
    const text = currentContent.text
    const adjustments = currentContent.adjustments
    
    if (!headline.trim() || !text.trim()) return
    
    setIsGenerating(true)

    // Simulate AI content generation
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    let adjustedText = text
    let adjustedHeadline = headline

    // Apply length adjustments
    if (adjustments.length === 'shorter') {
      adjustedText = text.split('\n')[0] // Take first paragraph only
      adjustedHeadline = headline.replace(/🍽️|🎯|✨/g, '').trim() // Remove emojis for shorter version
    } else if (adjustments.length === 'longer') {
      adjustedText = text + '\n\nKom forbi og oplev forskellen selv! Vi glæder os til at se dig.'
    }

    // Apply tone adjustments
    if (adjustments.tone === 'professional') {
      adjustedText = adjustedText.replace(/!/g, '.').replace(/😊|🤤|😋/g, '')
      adjustedHeadline = adjustedHeadline.replace(/!/g, '').replace(/🍽️|🎯|✨/g, '')
    } else if (adjustments.tone === 'excited') {
      adjustedText = adjustedText.replace(/\./g, '!')
      if (!adjustedHeadline.includes('🎉')) {
        adjustedHeadline = adjustedHeadline + ' 🎉'
      }
    } else if (adjustments.tone === 'casual') {
      adjustedText = adjustedText.replace(/Vi glæder os/g, 'Vi ser frem til')
    }

    // Apply emojis
    if (!adjustments.includeEmojis) {
      adjustedText = adjustedText.replace(/[🍽️🎯✨😊🤤😋🎉]/g, '')
      adjustedHeadline = adjustedHeadline.replace(/[🍽️🎯✨😊🤤😋🎉]/g, '')
    }

    // Apply booking link
    if (adjustments.includeBookingLink) {
      if (!adjustedText.includes('Book')) {
        adjustedText += '\n\n📞 Book tid: www.bageri.dk/booking'
      }
    } else {
      adjustedText = adjustedText.replace(/\n\n📞 Book tid:.*$/g, '')
    }

    // Generate hashtags if includeHashtags is enabled
    if (adjustments.includeHashtags) {
      const newHashtags = customizePerPlatform ? generateHashtags(activePlatform) : generateHashtags()
      updateCurrentContent('hashtags', newHashtags)
    } else {
      updateCurrentContent('hashtags', [])
    }

    updateCurrentContent('text', adjustedText)
    updateCurrentContent('headline', adjustedHeadline)
    setIsGenerating(false)
  }

  const toggleHashtag = (index: number) => {
    const newHashtags = [...currentContent.hashtags]
    newHashtags[index] = { ...newHashtags[index], enabled: !newHashtags[index].enabled }
    updateCurrentContent('hashtags', newHashtags)
  }

  const toggleCustomization = () => {
    if (!customizePerPlatform) {
      // Switching to per-platform: copy shared content to all platforms
      const newPlatformContent: Record<string, PlatformContent> = {}
      platforms.forEach(platform => {
        newPlatformContent[platform.id] = { 
          ...sharedContent,
          hashtags: generateHashtags(platform.id)
        }
      })
      setPlatformContent(newPlatformContent)
    }
    setCustomizePerPlatform(!customizePerPlatform)
  }

  const copyToAllPlatforms = () => {
    const currentData = platformContent[activePlatform]
    const newPlatformContent: Record<string, PlatformContent> = {}
    platforms.forEach(platform => {
      newPlatformContent[platform.id] = { 
        headline: currentData.headline,
        text: currentData.text,
        adjustments: { ...currentData.adjustments },
        hashtags: currentData.hashtags.map(h => ({ ...h })) // Deep clone hashtags
      }
    })
    setPlatformContent(newPlatformContent)
  }

  const handleNext = () => {
    // Save the edited content to the store
    if (customizePerPlatform) {
      setPostContent({
        headline: '', // Not used in platform-specific mode
        text: '', // Not used in platform-specific mode
        adjustments: currentContent.adjustments, // Use current platform's adjustments
        platformSpecific: true,
        platformContent: platformContent,
        hashtags: []
      })
    } else {
      setPostContent({
        headline: currentContent.headline,
        text: currentContent.text,
        adjustments: currentContent.adjustments,
        platformSpecific: false,
        hashtags: currentContent.hashtags
      })
    }
    onNext()
  }

  return (
    <div className="space-y-4">
      {/* Platform Customization Toggle */}
      <div className="bg-white rounded-lg shadow-md border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-100 p-2 rounded-lg">
              <Copy className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">{t('createPost.text.platformSpecific', 'Platform-Specific Content')}</h3>
              <p className="text-xs text-slate-600">
                {customizePerPlatform 
                  ? t('createPost.text.customizeEach', 'Customize text for each platform separately')
                  : t('createPost.text.sameForAll', 'Using same text for all platforms')}
              </p>
            </div>
          </div>
          <button
            onClick={toggleCustomization}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              customizePerPlatform ? 'bg-indigo-600' : 'bg-slate-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                customizePerPlatform ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Platform Tabs (only show when customizePerPlatform is true) */}
      {customizePerPlatform && (
        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-2">
              {platforms.map(platform => {
                const Icon = platform.icon
                const isActive = activePlatform === platform.id
                return (
                  <button
                    key={platform.id}
                    onClick={() => setActivePlatform(platform.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                      isActive
                        ? `${platform.color} text-white shadow-md`
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{platform.name}</span>
                  </button>
                )
              })}
            </div>
            <button
              onClick={copyToAllPlatforms}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-all text-xs font-medium"
            >
              <Copy className="w-3 h-3" />
              <span>{t('createPost.text.copyToAll', 'Copy to all')}</span>
            </button>
          </div>
          <p className="text-xs text-slate-500">
            {t('createPost.text.editingFor', 'Editing content for')} <span className="font-semibold">{platforms.find(p => p.id === activePlatform)?.name}</span>
          </p>
        </div>
      )}

      {/* Content Editor */}
      <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="bg-indigo-100 p-2 rounded-lg">
            <Type className="w-5 h-5 text-indigo-600" />
          </div>
          <h3 className="text-base font-bold text-slate-800">{t('createPost.text.postContent', 'Post Content')}</h3>
        </div>

        <div className="space-y-4">
          {/* Headline */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              {t('createPost.text.headline')}
            </label>
            <input
              type="text"
              value={currentContent.headline}
              onChange={(e) => updateCurrentContent('headline', e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm font-semibold"
              placeholder={t('createPost.text.headlinePlaceholder')}
            />
          </div>

          {/* Main Text */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              {t('createPost.text.content')}
            </label>
            <textarea
              value={currentContent.text}
              onChange={(e) => updateCurrentContent('text', e.target.value)}
              rows={6}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm leading-relaxed"
              placeholder={t('createPost.text.contentPlaceholder')}
            />
            <div className="flex justify-between items-center mt-1">
              <p className="text-xs text-slate-500">{currentContent.text.length} {t('createPost.text.characters', 'characters')}</p>
              <p className="text-xs text-slate-500">{t('createPost.text.recommended', 'Recommended: 100-300 characters')}</p>
            </div>
          </div>

          {/* Platform-Specific Hashtags */}
          {currentContent.adjustments.includeHashtags && currentContent.hashtags.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Hash className="w-4 h-4 text-indigo-600" />
                <label className="block text-xs font-semibold text-slate-700">
                  {t('createPost.text.hashtags')}
                  {customizePerPlatform && (
                    <span className="ml-2 text-slate-500 font-normal">
                      for {platforms.find(p => p.id === activePlatform)?.name}
                    </span>
                  )}
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                {currentContent.hashtags.map((hashtag, index) => {
                  // Check if hashtag exists on other platforms when in platform-specific mode
                  const getHashtagPlatforms = (): string[] => {
                    if (!customizePerPlatform) {
                      return hashtag.platforms || []
                    }
                    
                    // In platform-specific mode, check all platforms for this hashtag
                    const usedOnPlatforms: string[] = []
                    Object.keys(platformContent).forEach(platformId => {
                      const platformHashtags = platformContent[platformId].hashtags
                      const existsOnPlatform = platformHashtags.some(h => h.tag === hashtag.tag && h.enabled)
                      if (existsOnPlatform) {
                        usedOnPlatforms.push(platformId)
                      }
                    })
                    return usedOnPlatforms
                  }

                  const hashtagPlatforms = getHashtagPlatforms()

                  return (
                    <div
                      key={`${hashtag.tag}-${index}`}
                      onClick={() => toggleHashtag(index)}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs cursor-pointer border-2 transition-all transform hover:scale-105 ${
                        hashtag.enabled
                          ? 'bg-indigo-100 border-indigo-400 text-indigo-800'
                          : 'bg-slate-100 border-slate-300 text-slate-500'
                      }`}
                    >
                      <span className="font-semibold">{hashtag.tag}</span>
                      
                      {/* Platform indicators - show in both shared and platform-specific modes */}
                      <div className="flex items-center gap-0.5 ml-1">
                        {hashtagPlatforms.includes('facebook') && (
                          <div className="bg-blue-500 text-white rounded-full p-0.5">
                            <Facebook className="w-2.5 h-2.5" />
                          </div>
                        )}
                        {hashtagPlatforms.includes('instagram') && (
                          <div className="bg-pink-500 text-white rounded-full p-0.5">
                            <Instagram className="w-2.5 h-2.5" />
                          </div>
                        )}
                      </div>
                      
                      <span>{hashtag.enabled ? '✅' : '❌'}</span>
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {customizePerPlatform 
                  ? t('createPost.text.hashtagHelperPlatform', 'Platform icons show where each hashtag is used. Click to enable/disable for this platform.')
                  : t('createPost.text.hashtagHelper', 'Click on hashtags to enable/disable them')
                }
              </p>
            </div>
          )}
        </div>
      </div>

      {/* AI Adjustments */}
      <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="bg-purple-100 p-2 rounded-lg">
              <Settings className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="text-base font-bold text-slate-800">{t('createPost.text.aiAdjustments')}</h3>
          </div>
          <button
            onClick={generateAdjustedContent}
            disabled={isGenerating || !currentContent.headline.trim() || !currentContent.text.trim()}
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm font-medium flex items-center gap-2 shadow-md"
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>{t('createPost.text.generating')}</span>
              </>
            ) : (
              <>
                <Wand className="w-4 h-4" />
                <span>{t('createPost.text.updateWithAI')}</span>
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Length Adjustment */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              {t('createPost.text.length')}
            </label>
            <select
              value={currentContent.adjustments.length}
              onChange={(e) => handleAdjustment('length', e.target.value)}
              disabled={isGenerating}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm disabled:opacity-50"
            >
              <option value="shorter">{t('createPost.text.lengthOptions.shorter')}</option>
              <option value="current">{t('createPost.text.lengthOptions.current')}</option>
              <option value="longer">{t('createPost.text.lengthOptions.longer')}</option>
            </select>
          </div>

          {/* Tone Adjustment */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              {t('createPost.text.tone')}
            </label>
            <select
              value={currentContent.adjustments.tone}
              onChange={(e) => handleAdjustment('tone', e.target.value)}
              disabled={isGenerating}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm disabled:opacity-50"
            >
              <option value="professional">{t('createPost.text.toneOptions.professional')}</option>
              <option value="casual">{t('createPost.text.toneOptions.casual')}</option>
              <option value="friendly">{t('createPost.text.toneOptions.friendly')}</option>
              <option value="excited">{t('createPost.text.toneOptions.excited')}</option>
            </select>
          </div>

          {/* Content Options */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              {t('createPost.text.includeOptions')}
            </label>
            <div className="space-y-2">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentContent.adjustments.includeHashtags}
                  onChange={(e) => handleAdjustment('includeHashtags', e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-slate-700">{t('createPost.text.hashtags')}</span>
              </label>
              
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentContent.adjustments.includeEmojis}
                  onChange={(e) => handleAdjustment('includeEmojis', e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-slate-700">{t('createPost.text.emojis')}</span>
              </label>
              
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentContent.adjustments.includeBookingLink}
                  onChange={(e) => handleAdjustment('includeBookingLink', e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-slate-700">{t('createPost.text.bookingLink')}</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="py-6">
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

      {/* Selected Platforms Info */}
      <div className="bg-slate-50 rounded-lg border border-slate-200 p-3">
        <p className="text-xs text-slate-600 text-center">
          {t('createPost.text.selectedPlatforms')}: <span className="font-semibold">{selectedPlatforms.join(', ')}</span>
        </p>
      </div>
    </div>
  )
}