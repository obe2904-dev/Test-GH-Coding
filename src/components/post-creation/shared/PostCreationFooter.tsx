import { useState, useEffect, type ReactNode } from 'react'
import { ChevronRight } from '../../icons/PostCreationIcons'

interface PostCreationFooterProps {
  hasUnsavedChanges: boolean
  hasPersistedDraft: boolean
  onSaveDraft: () => boolean | Promise<boolean>
  onNext: () => void
  nextLabel?: string
  renderNextButton?: (options: { onNext: () => void }) => ReactNode
  disabled?: boolean
}

export function PostCreationFooter({ hasPersistedDraft, onNext, nextLabel, renderNextButton, disabled }: Omit<PostCreationFooterProps, 'hasUnsavedChanges'> & { hasUnsavedChanges?: boolean }) {
  const [hasSavedOnce, setHasSavedOnce] = useState(hasPersistedDraft)

  useEffect(() => {
    if (hasPersistedDraft && !hasSavedOnce) {
      setHasSavedOnce(true)
    }
  }, [hasPersistedDraft, hasSavedOnce])

  return (
    <>
      {renderNextButton ? (
        renderNextButton({ onNext })
      ) : (
        <button
          onClick={onNext}
          disabled={disabled}
          className="px-6 py-2 bg-cta text-text-inverse rounded-lg hover:bg-cta-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium text-xs shadow-md flex items-center gap-2"
        >
          <span>{nextLabel ?? 'Fortsæt til Design'}</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </>
  )
}
