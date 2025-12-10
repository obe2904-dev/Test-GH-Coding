import { useMemo } from 'react'

interface UsePostCreationFooterOptions {
  hasUnsavedChanges: boolean
  isEdited: boolean
  hasPersistedDraft: boolean
  onSaveDraft: () => boolean
  onNext: () => void
}

export function usePostCreationFooter({
  hasUnsavedChanges,
  isEdited,
  hasPersistedDraft,
  onSaveDraft,
  onNext
}: UsePostCreationFooterOptions) {
  return useMemo(() => ({
    hasUnsavedChanges: hasUnsavedChanges || isEdited,
    hasPersistedDraft,
    onSaveDraft,
    onNext
  }), [hasPersistedDraft, hasUnsavedChanges, isEdited, onNext, onSaveDraft])
}
