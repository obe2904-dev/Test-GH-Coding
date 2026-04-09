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

export function PostCreationFooter({ hasPersistedDraft, onNext, nextLabel, renderNextButton }: Omit<PostCreationFooterProps, 'hasUnsavedChanges'> & { hasUnsavedChanges?: boolean }) {
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
          className="px-6 py-2 bg-brand text-mint rounded-lg hover:bg-[#12393D] transition-all font-semibold text-xs shadow-md flex items-center gap-2"
        >
          <span>{nextLabel ?? 'Fortsæt til Design'}</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </>
  )
}
