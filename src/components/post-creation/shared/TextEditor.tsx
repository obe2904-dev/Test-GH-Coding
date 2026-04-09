import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

// Icon Components
const Type = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M4 7V4h16v3M9 20h6M12 4v16"/>
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

const Lightbulb = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M9 18h6M10 22h4M15 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/>
    <path d="M8.5 14C7 13 6 11.5 6 10a6 6 0 1 1 12 0c0 1.5-1 3-2.5 4"/>
  </svg>
)

interface Platform {
  id: string
  name: string
  icon: any
}

interface TextEditorProps {
  // Content state
  headline: string
  text: string
  hashtags: string[]
  selectedHashtags: Set<string>
  
  // Current mode/platform state
  activePlatform: string
  selectedPlatforms: string[]
  availablePlatforms: Platform[]
  customizePerPlatform: boolean
  
  // Platform-specific content
  platformTexts: Record<string, { headline: string; text: string }>
  
  // Enhancement states
  includeHashtags: boolean
  includeCTA: boolean
  isEdited: boolean
  isSpellingChecked: boolean
  isGenerating: boolean
  
  // Tier state
  currentTier: string
  
  // Handlers
  onUpdateText: (field: 'headline' | 'text', value: string) => void
  onToggleHashtag: (hashtag: string) => void
  onToggleHashtagsEnabled: (enabled: boolean) => void
  onToggleCTA: (enabled: boolean) => void
  onCustomizeToggle: (enabled: boolean) => void
  onPlatformSwitch: (platform: string) => void
  onSpellingCheck: () => void
  onDeleteContent: () => void
}

export const TextEditor: React.FC<TextEditorProps> = ({
  headline,
  text,
  hashtags,
  selectedHashtags,
  activePlatform,
  selectedPlatforms,
  availablePlatforms,
  customizePerPlatform,
  platformTexts,
  includeHashtags,
  includeCTA,
  isEdited,
  isSpellingChecked,
  isGenerating,
  currentTier,
  onUpdateText,
  onToggleHashtag,
  onToggleHashtagsEnabled,
  onToggleCTA,
  onCustomizeToggle,
  onPlatformSwitch,
  onSpellingCheck,
  onDeleteContent
}) => {
  const { t } = useTranslation()
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null)

  // Get current text based on platform customization
  const getCurrentText = () => {
    if (customizePerPlatform && platformTexts[activePlatform]) {
      return platformTexts[activePlatform]
    }
    return { headline, text }
  }

  return (
    <div className="bg-white rounded-lg shadow-md border border-slate-200 p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="bg-cta-surface p-1.5 rounded-lg">
          <Type className="w-4 h-4 text-cta" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-800">
            {t('generate.writeYourPost', 'Write Your Post')}
          </h3>
          <p className="text-xs text-slate-600">
            {t('generate.editAndImprove', 'Edit the generated text or write your own')}
          </p>
        </div>
        {/* Platform Customization Toggle and Delete Button */}
        <div className="ml-auto flex items-center gap-2">
          {/* Delete current content button */}
          <button
            onClick={onDeleteContent}
            className="px-2 py-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded border border-red-200 hover:border-red-300 transition-colors"
            title="Delete current content"
          >
            {t('generate.deleteThis', 'Delete this')}
          </button>
          
          {/* Platform Customization Toggle */}
          {selectedPlatforms.length > 1 && (
            <div className="flex items-center gap-1.5 bg-gradient-to-r from-cta-surface to-purple-50 px-3 py-1.5 rounded-lg border border-cta-surface">
              <input
                type="checkbox"
                id="customizePerPlatform"
                checked={customizePerPlatform}
                onChange={(e) => onCustomizeToggle(e.target.checked)}
                className="w-3 h-3 text-cta rounded focus:ring-cta"
              />
              <label htmlFor="customizePerPlatform" className="text-xs font-bold text-cta-text cursor-pointer">
                {t('generate.customizePerPlatform', 'Customize per platform')}
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Platform Tabs - Only show if multiple platforms selected */}
      {selectedPlatforms.length > 1 && (
        <div className="flex items-center gap-2 mb-3 border-b border-slate-200 pb-2">
          {availablePlatforms
            .filter(p => selectedPlatforms.includes(p.id))
            .map(platformInfo => {
            const platform = platformInfo.id
            const Icon = platformInfo.icon

            return (
              <button
                key={platform}
                onClick={() => onPlatformSwitch(platform)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                  activePlatform === platform
                    ? 'bg-cta-surface text-cta-text'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{platformInfo.name}</span>
              </button>
            )
          })}
        </div>
      )}

      <div className="space-y-4">
        {/* Headline Input - COMPACT */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            {t('generate.headline', 'Headline')}
          </label>
          <input
            type="text"
            value={getCurrentText().headline}
            onChange={(e) => onUpdateText('headline', e.target.value)}
            placeholder={t('generate.headlinePlaceholder', 'e.g., "Weekend Special 🔥"')}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cta focus:border-transparent text-sm font-semibold"
          />
        </div>

        {/* Text Textarea - COMPACT */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-xs font-semibold text-slate-700">
              {t('generate.postText', 'Post Text')}
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">
                {getCurrentText().text.length} {t('generate.characters', 'characters')}
              </span>
              {customizePerPlatform && (
                <>
                  {activePlatform === 'instagram' && getCurrentText().text.length > 125 && (
                    <span className="text-xs text-amber-600 flex items-center gap-1">
                      ⚠️ {t('generate.longForInstagram', 'Long for Instagram')}
                    </span>
                  )}
                  {activePlatform === 'facebook' && getCurrentText().text.length > 300 && (
                    <span className="text-xs text-amber-600 flex items-center gap-1">
                      ⚠️ {t('generate.veryLong', 'Very long')}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
          <textarea
            ref={textAreaRef}
            value={getCurrentText().text}
            onChange={(e) => onUpdateText('text', e.target.value)}
            placeholder={t('generate.textPlaceholder', 'Write your post here...')}
            rows={4}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cta focus:border-transparent text-sm resize-none"
          />
        </div>

        {/* Edit Controls Section */}
        <div className="space-y-3">
          {/* Hashtag Chips - Moved to top */}
          {hashtags.length > 0 && (
          <div className="bg-slate-50 rounded-lg p-2 border border-slate-200">
            <div className="flex items-center gap-1 mb-1.5">
              <Hash className="w-3 h-3 text-cta" />
              <span className="text-xs font-semibold text-slate-700">{t('generate.hashtags', 'Hashtags')}</span>
              <span className="text-xs text-slate-500">
                ({includeHashtags ? Array.from(selectedHashtags).length : 0}/{hashtags.length} selected)
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {hashtags.map((tag) => {
                // If includeHashtags is false, show all as deselected
                const isSelected = includeHashtags && selectedHashtags.has(tag)
                
                return (
                  <button
                    key={tag}
                    onClick={() => {
                      // Only allow individual toggling if includeHashtags is true
                      if (includeHashtags) {
                        onToggleHashtag(tag)
                      }
                    }}
                    className={`px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
                      isSelected
                        ? 'bg-cta-surface border-cta text-cta-text'
                        : 'bg-white border-slate-300 text-slate-600 hover:border-slate-400'
                    } ${!includeHashtags ? 'opacity-75' : 'cursor-pointer'}`}
                  >
                    #{tag}
                  </button>
                )
              })}
            </div>
          </div>
          )}

          {/* Control Row: Left side toggles, right side action buttons */}
          <div className="flex items-center justify-between">
            {/* Left: Toggle Options */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => onToggleHashtagsEnabled(!includeHashtags)}
                className="flex items-center gap-1 hover:text-cta transition-colors cursor-pointer"
              >
                {includeHashtags ? '✅' : '⬜'} {t('generate.hashtagsIncluded', 'Hashtags included')}
              </button>
              <button
                onClick={() => onToggleCTA(!includeCTA)}
                className="flex items-center gap-1 hover:text-cta transition-colors cursor-pointer"
              >
                {includeCTA ? '✅' : '⬜'} {t('generate.ctaIncluded', 'CTA: Call to action')}
              </button>
            </div>

            {/* Right: Update with AI and Spelling Check buttons */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => {/* TODO: Implement AI update functionality */}}
                  disabled={isGenerating || currentTier === 'free'}
                  className={`px-3 py-1.5 bg-gradient-to-r from-cta to-purple-600 text-white rounded-lg hover:from-cta-hover hover:to-purple-700 transition-all font-bold text-xs shadow-md flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed relative ${
                    currentTier === 'free' ? 'from-slate-400 to-slate-500 hover:from-slate-400 hover:to-slate-500' : ''
                  }`}
                >
                  <span className="text-base">✨</span>
                  <span>{t('generate.updateWithAI', 'Update with AI')}</span>
                </button>
                {currentTier === 'free' && (
                  <span className="absolute -top-1 -right-1 text-amber-500 text-sm">
                    🔒
                  </span>
                )}
              </div>

              <button
                onClick={onSpellingCheck}
                disabled={isGenerating || !isEdited}
                className={`px-3 py-1.5 rounded-lg border-2 font-semibold text-xs flex items-center gap-1.5 transition-all ${
                  isSpellingChecked
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700 cursor-default'
                    : isGenerating
                      ? 'bg-cta-surface border-cta text-cta cursor-wait'
                      : 'bg-white border-cta text-cta hover:bg-cta-surface cursor-pointer'
                }`}
              >
                {isGenerating ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-cta border-t-transparent rounded-full animate-spin" />
                    <span>{t('generate.checking', 'Checking...')}</span>
                  </>
                ) : isSpellingChecked ? (
                  <>
                    <span className="text-base">✓</span>
                    <span>{t('generate.spellingChecked', 'Spelling checked')}</span>
                  </>
                ) : (
                  <>
                    <span className="text-base">✓</span>
                    <span>{t('generate.checkSpelling', 'Check spelling')}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Bottom Row: Tone & Length (Locked for Free) */}
            <div className="flex items-center gap-3">
              {/* Tone Dropdown */}
              <div className="relative flex-1">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('generate.tone', 'Tone')}
                </label>
                <div className="relative">
                  <select
                    disabled={currentTier === 'free'}
                    defaultValue="objective"
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed appearance-none pr-8"
                  >
                    <option value="objective">{t('generate.toneObjective', 'Objective & Neutral')}</option>
                    <option value="warm">{t('generate.toneWarm', 'Warm & Welcoming')}</option>
                    <option value="passionate">{t('generate.tonePassionate', 'Passionate & Enthusiastic')}</option>
                  </select>
                  {currentTier === 'free' && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-amber-500">
                      🔒
                    </span>
                  )}
                </div>
              </div>

              {/* Length Dropdown */}
              <div className="relative flex-1">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('generate.length', 'Length')}
                </label>
                <div className="relative">
                  <select
                    disabled={currentTier === 'free'}
                    defaultValue="medium"
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed appearance-none pr-8"
                  >
                    <option value="short">{t('generate.lengthShort', 'Short')}</option>
                    <option value="medium">{t('generate.lengthMedium', 'Medium')}</option>
                    <option value="long">{t('generate.lengthLong', 'Long')}</option>
                  </select>
                  {currentTier === 'free' && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-amber-500">
                      🔒
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Platform-specific tips */}
            {customizePerPlatform && selectedPlatforms.length > 1 && (
              <div className="p-2 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs text-blue-800 flex items-start gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>
                    {activePlatform === 'facebook' 
                      ? t('generate.facebookTip', 'Facebook tip: Longer posts with links work well. Use 2-3 hashtags.')
                      : t('generate.instagramTip', 'Instagram tip: Shorter captions with 10-15 hashtags. Focus on visual storytelling.')
                    }
                  </span>
                </p>
              </div>
            )}

            {/* Upgrade Message for Free Users */}
            {currentTier === 'free' && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-2">
                <p className="text-xs text-amber-800 flex items-center gap-1.5">
                  ⭐ <span className="font-semibold">{t('generate.upgradeToStandardPlus', 'Upgrade to Smart')}</span> {t('generate.upgradeMessage', 'to choose tone and length for your posts')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
  )
}