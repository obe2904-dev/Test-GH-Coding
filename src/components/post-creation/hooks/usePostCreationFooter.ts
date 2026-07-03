import { useMemo } from 'react'

interface UsePostCreationFooterOptions {
  hasUnsavedChanges: boolean
  isEdited: boolean
  hasPersistedDraft: boolean
  onSaveDraft: () => boolean
  onNext: () => void
  disabled?: boolean
}

export function usePostCreationFooter({
  hasUnsavedChanges,
  isEdited,
  hasPersistedDraft,
  onSaveDraft,
  onNext,
  disabled
}: UsePostCreationFooterOptions) {
  return useMemo(() => ({
    hasUnsavedChanges: hasUnsavedChanges || isEdited,
    hasPersistedDraft,
    onSaveDraft,
    onNext,
    disabled
  }), [hasPersistedDraft, hasUnsavedChanges, isEdited, onNext, onSaveDraft, disabled])
}
