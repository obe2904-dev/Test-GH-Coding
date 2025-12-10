import { useMemo } from 'react'

interface UseClarificationFlowOptions {
  clarificationQuestion: string | null
  clarificationInput: string
  handleClarificationSubmit: () => void
  handleClarificationDismiss: () => void
  setClarificationInput: (value: string) => void
}

export function useClarificationFlow({
  clarificationQuestion,
  clarificationInput,
  handleClarificationSubmit,
  handleClarificationDismiss,
  setClarificationInput
}: UseClarificationFlowOptions) {
  return useMemo(() => ({
    clarificationQuestion,
    clarificationInput,
    onClarificationChange: (value: string) => setClarificationInput(value),
    onClarificationSubmit: handleClarificationSubmit,
    onClarificationDismiss: handleClarificationDismiss
  }), [
    clarificationInput,
    clarificationQuestion,
    handleClarificationDismiss,
    handleClarificationSubmit,
    setClarificationInput
  ])
}
