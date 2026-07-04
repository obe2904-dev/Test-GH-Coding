import { useState, type FormEvent, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import type { PlatformHashtag } from '../../../stores/postCreationStore'
import type { Tier } from '../../../stores/tierStore'
import { HashtagDisplay } from './HashtagDisplay'
import { ClarificationPrompt } from './ClarificationPrompt'
import { ActionButtons } from './ActionButtons'

type SupportedPlatform = 'facebook' | 'instagram'

interface WriteContentCardProps {
  headline: string
  text: string
  headlinePlaceholder: string
  textPlaceholder: string
  onHeadlineChange: (value: string) => void
  onTextChange: (value: string) => void
  textAreaRef: RefObject<HTMLTextAreaElement>
  errorMessage?: string
  onClear: () => void
  includeHashtags: boolean
  hashtags: string[]
  selectedHashtags: Set<string>
  onToggleHashtag: (tag: string) => void
  selectedPlatforms: string[]
  supportedSelectedPlatforms: SupportedPlatform[]
  currentTier: Tier
  availablePlatforms: SupportedPlatform[]
  activePlatform: string
  onSelectPlatforms: (platforms: string[]) => void
  onActivePlatformChange: (platform: string) => void
  clarificationQuestion: string | null
  clarificationInput: string
  onClarificationChange: (value: string) => void
  onClarificationSubmit: () => void
  onClarificationDismiss: () => void
  hasBusinessProfile: boolean
  onToggleHashtags: (enabled: boolean) => void
  onAddHashtag: (tag: string) => string | null
  onUpgrade: () => void
  onEnhance: () => void
  onSpellingCheck: () => void
  isEnhancing: boolean
  isSpellChecking: boolean
  isSpellingChecked: boolean
  isEdited: boolean
  canEditHeadline: boolean
  isHeadlineEditorVisible: boolean
  onToggleHeadlineEditor: () => void
  showHeadlinePrompt: boolean
  hasHashtags: boolean
  insight?: string | null
  hasAISuggestion: boolean
  platformHashtagViews?: Record<string, PlatformHashtag[]>
  showClearAll?: boolean
}

export function WriteContentCard({
  headline,
  text,
  headlinePlaceholder,
  textPlaceholder,
  onHeadlineChange,
  onTextChange,
  textAreaRef,
  errorMessage,
  onClear,
  includeHashtags,
  hashtags,
  selectedHashtags,
  onToggleHashtag,
  selectedPlatforms: _selectedPlatforms,
  supportedSelectedPlatforms,
  currentTier: _currentTier,
  availablePlatforms: _availablePlatforms,
  activePlatform: _activePlatform,
  onSelectPlatforms: _onSelectPlatforms,
  onActivePlatformChange: _onActivePlatformChange,
  clarificationQuestion,
  clarificationInput,
  onClarificationChange,
  onClarificationSubmit,
  onClarificationDismiss,
  hasBusinessProfile: _hasBusinessProfile,
  onToggleHashtags: _onToggleHashtags,
  onAddHashtag,
  onUpgrade: _onUpgrade,
  onEnhance,
  onSpellingCheck,
  isEnhancing,
  isSpellChecking,
  isSpellingChecked,
  isEdited,
  canEditHeadline,
  isHeadlineEditorVisible,
  onToggleHeadlineEditor,
  showHeadlinePrompt,
  hasHashtags,
  insight,
  hasAISuggestion,
  platformHashtagViews,
  showClearAll = false
}: WriteContentCardProps) {
  const { t } = useTranslation(undefined, { keyPrefix: 'createPost' })
  const [customHashtag, setCustomHashtag] = useState('')
  const [customHashtagError, setCustomHashtagError] = useState<string | null>(null)

  const headlineInputId = 'facebook-headline-input'
  const textSubtitle = showHeadlinePrompt
    ? t(
        'generate.aISuggestionSubtitle',
        'Hvis du vil ændre noget, så ret i teksten – jeg hjælper dig videre.'
      )
    : t(
        'generate.textSubtitle',
        "It doesn't have to be perfect. Share your idea - and I'll finish the post for you."
      )

  const handleAddCustomHashtag = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const error = onAddHashtag(customHashtag)
    if (error) {
      setCustomHashtagError(error)
      return
    }

    setCustomHashtag('')
    setCustomHashtagError(null)
  }

  return (
    <div className="bg-white rounded-xl shadow-md border border-[#D1D5DB] p-5">
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-base font-semibold text-[#0F172A]">
            {showHeadlinePrompt
              ? t('generate.aISuggestionHeadline', 'Sådan! Jeg har lavet et forslag til dig 🙌')
              : t('generate.headlinePrompt', 'What would you like to post today? 😊')}
          </p>
          {showClearAll && (
            <button
              onClick={onClear}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-red-500 bg-red-50 border border-red-200 hover:bg-red-100 hover:text-red-700 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
              Slet alt
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-[#4B5563]">
            {textSubtitle}
          </p>

          <div className="flex items-center gap-2">
            {showHeadlinePrompt && canEditHeadline && !isHeadlineEditorVisible && (
              <button
                type="button"
                onClick={onToggleHeadlineEditor}
                className="text-[11px] font-semibold text-[#4338CA] hover:text-[#312E81] underline transition-colors"
              >
                {t('generate.viewHeadline', 'View headline')}
              </button>
            )}
          </div>
        </div>

        {showHeadlinePrompt && canEditHeadline && isHeadlineEditorVisible && (
          <div className="space-y-2">
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={onToggleHeadlineEditor}
                className="text-xs font-medium text-[#6B7280] hover:text-[#1F2937] underline transition-colors"
              >
                {t('generate.hideHeadline', 'Hide headline')}
              </button>
            </div>

            <label className="text-sm font-semibold text-[#1F2937]" htmlFor={headlineInputId}>
              {t('generate.facebookHeadlineLabel', 'Headline for Facebook')}
            </label>

            <input
              id={headlineInputId}
              type="text"
              value={headline}
              onChange={(event) => onHeadlineChange(event.target.value)}
              placeholder={headlinePlaceholder}
              className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg focus:border-[#D1D5DB] focus:outline-none text-sm placeholder:text-gray-400"
            />
          </div>
        )}
      </div>

      <div className="mb-4">
        {errorMessage && (
          <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
            <span className="text-base">⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}
        <div>
          <textarea
            ref={textAreaRef}
            value={text}
            onChange={(event) => onTextChange(event.target.value)}
            placeholder={textPlaceholder}
            rows={5}
            className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg focus:border-[#D1D5DB] focus:outline-none text-sm resize-none min-h-[120px] placeholder:text-gray-400"
          />
        </div>

        {hasHashtags && includeHashtags && hashtags.length > 0 && (
          <div className="mt-3 rounded-xl border border-[#C7D2FE] bg-[#EEF2FF]/70 px-3 py-3 shadow-sm">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1 text-[11px] text-[#312E81]">
                <span className="font-semibold uppercase tracking-wide">
                  {t('generate.hashtagSuggestions', 'Hashtag suggestions')}
                </span>
                {insight && (
                  <>
                    <span className="font-semibold uppercase tracking-wide">-</span>
                    <span className="text-[#1F2937] normal-case font-normal tracking-normal">
                      {insight}
                    </span>
                  </>
                )}
              </div>
              <span className="text-[10px] text-[#4C1D95]">
                {t('generate.hashtagNote', 'Tap to enable or remove hashtags before publishing')}
              </span>
            </div>
            <HashtagDisplay
              includeHashtags={includeHashtags}
              hashtags={hashtags}
              selectedHashtags={selectedHashtags}
              onToggleHashtag={onToggleHashtag}
              selectedPlatforms={supportedSelectedPlatforms}
              platformHashtagViews={platformHashtagViews}
            />

            <form className="mt-3 space-y-2" onSubmit={handleAddCustomHashtag}>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-[#312E81]" htmlFor="custom-hashtag-input">
                {t('generate.customHashtagLabel', 'Need another hashtag? Add your own')}
              </label>
              <div className="flex flex-wrap gap-2">
                <input
                  id="custom-hashtag-input"
                  value={customHashtag}
                  onChange={(event) => {
                    setCustomHashtag(event.target.value)
                    if (customHashtagError) {
                      setCustomHashtagError(null)
                    }
                  }}
                  placeholder={t('generate.customHashtagPlaceholder', 'Type a hashtag, e.g. burgerlove')}
                  className="flex-1 min-w-[180px] rounded-md border border-[#D1D5DB] bg-white px-3 py-1.5 text-xs text-[#1F2937] placeholder:text-[#9CA3AF] focus:border-[#6366F1] focus:outline-none"
                  maxLength={40}
                />
                <button
                  type="submit"
                  disabled={customHashtag.trim().length === 0}
                  className="px-3 py-1.5 text-xs font-semibold rounded-md bg-[#312E81] text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#1E1B4B] transition-colors"
                >
                  {t('generate.customHashtagButton', 'Add hashtag')}
                </button>
              </div>
              {customHashtagError && (
                <p className="text-[10px] text-red-600">
                  {customHashtagError}
                </p>
              )}
            </form>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
          <ActionButtons
            onEnhance={onEnhance}
            onSpellingCheck={onSpellingCheck}
            isEnhancing={isEnhancing}
            isSpellChecking={isSpellChecking}
            isSpellingChecked={isSpellingChecked}
            isEdited={isEdited}
            hasAISuggestion={hasAISuggestion}
            showEnhance={true}
            showSpellingCheck={true}
          />
        </div>

        {clarificationQuestion && (
          <ClarificationPrompt
            question={clarificationQuestion}
            inputValue={clarificationInput}
            onInputChange={onClarificationChange}
            onSubmit={onClarificationSubmit}
            onDismiss={onClarificationDismiss}
          />
        )}
      </div>
    </div>
  )
}
