import { useState, useEffect, type ReactNode } from 'react'
import { ChevronRight } from '../../icons/PostCreationIcons'

interface PostCreationFooterProps {
  hasUnsavedChanges: boolean
  hasPersistedDraft: boolean
  onSaveDraft: () => boolean
  onNext: () => void
  nextLabel?: string
  renderNextButton?: (options: { onNext: () => void }) => ReactNode
}

export function PostCreationFooter({ hasUnsavedChanges, hasPersistedDraft, onSaveDraft, onNext, nextLabel, renderNextButton }: PostCreationFooterProps) {
  const [hasSavedOnce, setHasSavedOnce] = useState(hasPersistedDraft)

  useEffect(() => {
    if (hasPersistedDraft && !hasSavedOnce) {
      setHasSavedOnce(true)
    }
  }, [hasPersistedDraft, hasSavedOnce])

  const isDisabled = !hasUnsavedChanges
  const label = hasUnsavedChanges ? 'Gem kladde' : hasSavedOnce ? 'Gemt' : 'Gem kladde'
  const buttonClasses = isDisabled
    ? 'px-3 py-1.5 bg-slate-100 border border-slate-200 text-slate-400 rounded-lg text-xs font-medium cursor-not-allowed'
    : 'px-3 py-1.5 bg-white border border-slate-300 text-[#1F2937] rounded-lg text-xs font-medium hover:bg-slate-50 transition-all'

  return (
    <div className="flex items-center justify-end pt-2 pb-4">
      <div className="sticky bottom-0 bg-slate-50 border border-slate-200 py-3 px-6 rounded-lg flex items-center gap-6">
        <button
          onClick={() => {
            if (isDisabled) return

            const saved = onSaveDraft()
            if (saved) {
              setHasSavedOnce(true)
            }
          }}
          className={buttonClasses}
          disabled={isDisabled}
        >
          {label}
        </button>
        {renderNextButton ? (
          renderNextButton({ onNext })
        ) : (
          <button
            onClick={onNext}
            className="px-6 py-2 bg-[#0F2E32] text-[#88F2D7] rounded-lg hover:bg-[#12393D] transition-all font-semibold text-xs shadow-md flex items-center gap-2"
          >
            <span>{nextLabel ?? 'Fortsæt til Vis'}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
