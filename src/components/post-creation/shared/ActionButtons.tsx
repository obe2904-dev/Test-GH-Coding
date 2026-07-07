import { useTranslation } from 'react-i18next'

interface ActionButtonsProps {
  onEnhance: () => void
  onSpellingCheck: () => void
  onRevert?: () => void
  isEnhancing: boolean
  isSpellChecking: boolean
  isSpellingChecked: boolean
  isEdited: boolean
  showSpellingCheck?: boolean
  showEnhance?: boolean
  showRevert?: boolean
  hasAISuggestion: boolean
}

export function ActionButtons({
  onEnhance,
  onSpellingCheck,
  onRevert,
  isEnhancing,
  isSpellChecking,
  isSpellingChecked,
  isEdited,
  showSpellingCheck = false,
  showEnhance = true,
  showRevert = false,
  hasAISuggestion
}: ActionButtonsProps) {
  const { t } = useTranslation(undefined, { keyPrefix: 'createPost.generate' })
  const enhanceDisabled = isEnhancing || isSpellChecking || (hasAISuggestion && !isEdited)
  
  console.log('[ActionButtons] Render:', {
    hasAISuggestion,
    isEdited,
    isEnhancing,
    isSpellChecking,
    enhanceDisabled,
    buttonText: hasAISuggestion ? 'Tilpas ud fra min ændring' : 'Foreslå tekst for mig'
  })
  
  return (
    <div className="flex flex-wrap gap-2">
      {showRevert && (
        <button
          onClick={onRevert}
          disabled={isEnhancing || isSpellChecking}
          className="px-3 py-1.5 rounded-md border border-slate-300 text-xs font-medium flex items-center gap-1.5 transition-all bg-white text-slate-700 hover:bg-slate-50"
        >
          <span>↶</span>
          <span>{t('revertToOriginal', 'Fortryd AI-forslag')}</span>
        </button>
      )}
      {showEnhance && <button
        onClick={onEnhance}
        disabled={enhanceDisabled}
        className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all shadow-sm ${
          enhanceDisabled
            ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
            : 'bg-cta text-text-inverse hover:bg-cta-hover'
        }`}
      >
        {isEnhancing ? (
          <>
            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Forbedrer...</span>
          </>
        ) : (
          <>
            <span>✨</span>
            <span>
              {hasAISuggestion
                ? t('adjustWithAI', 'Tilpas ud fra min ændring')
                : t('enhanceWithAI', 'Foreslå tekst for mig')}
            </span>
          </>)
        }
      </button>}

        {showSpellingCheck && (
          <button
            onClick={onSpellingCheck}
            disabled={isSpellChecking || isEnhancing || !isEdited}
            className={`px-3 py-1.5 rounded-md border text-xs font-medium flex items-center gap-1.5 transition-all ${
              isSpellingChecked
                ? 'bg-green-50 border-[#10B981] text-[#10B981] cursor-default'
                : isSpellChecking
                  ? 'bg-slate-100 border-slate-300 text-[#6B7280] cursor-wait'
                  : !isEdited
                    ? 'bg-slate-50 border-slate-300 text-slate-400 cursor-not-allowed'
                    : 'bg-white border-slate-300 text-[#1F2937] hover:bg-slate-50 cursor-pointer'
            }`}
          >
            {isSpellChecking ? (
              <>
                <div className="w-3 h-3 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
                <span>Tjekker...</span>
              </>
            ) : isSpellingChecked ? (
              <>
                <span>✓</span>
                <span>Stavekontrol udført</span>
              </>
            ) : (
              <>
                <span>✓</span>
                <span>Tjek stavning</span>
              </>
            )}
          </button>
        )}
    </div>
  )
}
