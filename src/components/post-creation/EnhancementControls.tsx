import { useTranslation } from 'react-i18next'
import { Hash, Lightbulb } from '../icons/PostCreationIcons'

interface EnhancementControlsProps {
  // Hashtags
  hashtags: string[]
  selectedHashtags: Set<string>
  aiGeneratedHashtags: Set<string>
  includeHashtags: boolean
  onToggleHashtag: (tag: string) => void
  onDeleteHashtag: (tag: string) => void
  
  // Toggles
  includeEmojis: boolean
  includeCTA: boolean
  onToggleEmojis: (checked: boolean) => void
  onToggleHashtags: (checked: boolean) => void
  onToggleCTA: (checked: boolean) => void
  
  // Tone & Length
  currentTier: string
  showToneLength: boolean
  
  // Platform tips
  showPlatformTip: boolean
  activePlatform?: string
  
  // Mode
  activeTab: 'ai' | 'manual'
}

export function EnhancementControls({
  hashtags,
  selectedHashtags,
  aiGeneratedHashtags,
  includeHashtags,
  onToggleHashtag,
  onDeleteHashtag,
  includeEmojis,
  includeCTA,
  onToggleEmojis,
  onToggleHashtags,
  onToggleCTA,
  currentTier,
  showToneLength,
  showPlatformTip,
  activePlatform,
  activeTab
}: EnhancementControlsProps) {
  const { t } = useTranslation(undefined, { keyPrefix: 'createPost.generate' })

  return (
    <div className="space-y-3">
      {/* Hashtag Chips */}
      {hashtags.length > 0 && (
        <>
          <div className="bg-slate-50 rounded-lg p-2 border border-slate-200">
            <div className="flex items-center gap-1 mb-1.5">
              <Hash className="w-3 h-3 text-cta" />
              <span className="text-xs font-semibold text-slate-700">{t('hashtags', 'Hashtags')}</span>
              <span className="text-xs text-slate-500">
                ({hashtags.length})
              </span>
              {!includeHashtags && hashtags.length > 0 && (
                <span className="text-xs text-amber-600 font-medium ml-2">
                  ⚠️ Enable hashtags below to select
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {hashtags.map((tag, idx) => {
                const isSelected = includeHashtags && selectedHashtags.has(tag)
                const isAiGenerated = aiGeneratedHashtags.has(tag)
                
                return (
                  <div key={idx} className="inline-flex items-center gap-0.5">
                    <button
                      onClick={() => onToggleHashtag(tag)}
                      disabled={!includeHashtags}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 border-l border-t border-b rounded-l text-xs transition-colors ${
                        isSelected
                          ? 'bg-green-50 border-green-300 text-green-700'
                          : 'bg-red-50 border-red-300 text-red-700'
                      } ${
                        !includeHashtags
                          ? 'opacity-50 cursor-not-allowed' 
                          : 'cursor-pointer hover:opacity-90'
                      }`}
                    >
                      {isSelected ? '✓' : '×'}
                      <span>{tag}</span>
                    </button>
                    {/* Only show delete button for user-added hashtags */}
                    {!isAiGenerated && (
                      <button
                        onClick={() => onDeleteHashtag(tag)}
                        className={`px-1.5 py-0.5 border-r border-t border-b rounded-r text-xs transition-colors ${
                          isSelected
                            ? 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100'
                            : 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100'
                        }`}
                        title="Slet hashtag"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          {/* Hashtag toggle outside and below the frame */}
          <div className="mt-1">
            <button
              onClick={() => onToggleHashtags(!includeHashtags)}
              className="flex items-center gap-1 text-xs text-slate-700 transition-colors hover:text-cta cursor-pointer"
            >
              {includeHashtags ? '✅' : '⬜'} {t('hashtagsIncluded', 'Hashtags included')}
            </button>
          </div>
        </>
      )}

      {/* Toggles - Only for paid tiers */}
      {currentTier !== 'free' && (
            <div className="flex flex-col gap-2 text-xs text-slate-700">
              <button
                onClick={() => onToggleEmojis(!includeEmojis)}
                className="flex items-center gap-1 transition-colors hover:text-cta cursor-pointer"
              >
                {includeEmojis ? '✅' : '⬜'} {t('emojisIncluded', 'Emojis included')}
              </button>
              <button
                onClick={() => onToggleHashtags(!includeHashtags)}
                className="flex items-center gap-1 transition-colors hover:text-cta cursor-pointer"
              >
                {includeHashtags ? '✅' : '⬜'} {t('hashtagsIncluded', 'Hashtags included')}
              </button>
              <button
                onClick={() => onToggleCTA(!includeCTA)}
                className="flex items-center gap-1 transition-colors hover:text-cta cursor-pointer"
              >
                {includeCTA ? '✅' : '⬜'} {t('ctaIncluded', 'CTA: Call to action')}
              </button>
            </div>
          )}

      {/* Bottom Row: Tone & Length */}
      {showToneLength && activeTab !== 'manual' && (
        <div className="flex items-center gap-3">
          {/* Tone Dropdown */}
          <div className="relative flex-1">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('tone', 'Tone')}
            </label>
            <div className="relative">
              <select
                disabled={currentTier === 'free'}
                defaultValue="objective"
                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed appearance-none pr-8"
              >
                <option value="objective">{t('toneObjective', 'Objective & Neutral')}</option>
                <option value="warm">{t('toneWarm', 'Warm & Welcoming')}</option>
                <option value="passionate">{t('tonePassionate', 'Passionate & Enthusiastic')}</option>
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
              {t('length', 'Length')}
            </label>
            <div className="relative">
              <select
                disabled={currentTier === 'free'}
                defaultValue="medium"
                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed appearance-none pr-8"
              >
                <option value="short">{t('lengthShort', 'Short')}</option>
                <option value="medium">{t('lengthMedium', 'Medium')}</option>
                <option value="long">{t('lengthLong', 'Long')}</option>
              </select>
              {currentTier === 'free' && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-amber-500">
                  🔒
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Platform-specific tips */}
      {showPlatformTip && (
        <div className="p-2 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-xs text-blue-800 flex items-start gap-1.5">
            <Lightbulb className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>
              {activePlatform === 'facebook' 
                ? t('facebookTip', 'Facebook tip: Longer posts with links work well. Use 2-3 hashtags.')
                : t('instagramTip', 'Instagram tip: Shorter captions with 10-15 hashtags. Focus on visual storytelling.')
              }
            </span>
          </p>
        </div>
      )}

      {/* Upgrade Message for Free Users */}
      {currentTier === 'free' && activeTab !== 'manual' && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-2">
          <p className="text-xs text-amber-800 flex items-center gap-1.5">
            ⭐ <span className="font-semibold">{t('upgradeToStandardPlus', 'Upgrade to Smart')}</span> {t('upgradeMessage', 'to choose tone and length for your posts')}
          </p>
        </div>
      )}
    </div>
  )
}
