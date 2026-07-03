import { useState, useCallback, useMemo } from 'react'

type ModeTab = 'manual' | 'ai'

interface UsePostCreationModeOptions {
  selectedIdea: string | null
  onManualModeEnter: () => void
  onAIModeEnter: () => void
}

export function usePostCreationMode({
  selectedIdea,
  onManualModeEnter,
  onAIModeEnter
}: UsePostCreationModeOptions) {
  const [activeTab, setActiveTab] = useState<ModeTab>(() =>
    selectedIdea && selectedIdea.startsWith('ai-') ? 'ai' : 'manual'
  )

  const handleManualTabSelect = useCallback(() => {
    if (activeTab === 'manual') {
      return
    }
    onManualModeEnter()
    setActiveTab('manual')
  }, [activeTab, onManualModeEnter])

  const handleAITabSelect = useCallback(() => {
    if (activeTab === 'ai') {
      return
    }
    onAIModeEnter()
    setActiveTab('ai')
  }, [activeTab, onAIModeEnter])

  const shouldShowEditor = useMemo(() => {
    const hasSelectedAiIdea = Boolean(selectedIdea && selectedIdea.startsWith('ai-'))
    return activeTab === 'manual' || (activeTab === 'ai' && hasSelectedAiIdea)
  }, [activeTab, selectedIdea])

  return {
    activeTab,
    shouldShowEditor,
    handleManualTabSelect,
    handleAITabSelect
  }
}
