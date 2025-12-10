import { Type, Sparkles } from '../icons/PostCreationIcons'

type ModeTab = 'manual' | 'ai'

interface ModeTabsProps {
  activeTab: ModeTab
  onManualSelect: () => void
  onAISelect: () => void
  manualLabel: string
  aiLabel: string
  aiQuotaLabel: string
}

export function ModeTabs({
  activeTab,
  onManualSelect,
  onAISelect,
  manualLabel,
  aiLabel,
  aiQuotaLabel
}: ModeTabsProps) {
  return (
    <div className="flex gap-2 mt-2 mb-1">
      <button
        onClick={onManualSelect}
        className={`flex-1 px-3 py-2 transition-all text-sm font-medium flex items-center justify-center gap-1.5 border-b-[3px]
          ${activeTab === 'manual'
            ? 'text-[#0F2E32] border-[#88F2D7]'
            : 'text-[#6B7280] border-transparent hover:text-[#1F2937]'
          }`}
      >
        <Type className="w-3.5 h-3.5" />
        <span>{manualLabel}</span>
      </button>

      <button
        onClick={onAISelect}
        className={`flex-1 px-3 py-2 transition-all text-sm font-medium flex items-center justify-center gap-1.5 border-b-[3px] cursor-pointer
          ${activeTab === 'ai'
            ? 'text-[#0F2E32] border-[#88F2D7]'
            : 'text-[#6B7280] border-transparent hover:text-[#1F2937]'
          }`}
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span>{aiLabel}</span>
        <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/20">
          {aiQuotaLabel}
        </span>
      </button>
    </div>
  )
}
