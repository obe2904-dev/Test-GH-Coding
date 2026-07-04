interface AIFeaturePanelProps {
  includeHashtags: boolean
  onToggleHashtags: (enabled: boolean) => void
  onUpgrade: () => void
}

export function AIFeaturePanel({ includeHashtags, onToggleHashtags, onUpgrade }: AIFeaturePanelProps) {
  return (
    <div className="-mt-1">
      <h3 className="text-xs font-medium text-slate-500 mb-1">
        Gør dit opslag endnu bedre — vælg dine AI-værktøjer.
      </h3>

      <div className="border border-[#E5E7EB] rounded-xl p-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <button
              onClick={() => onToggleHashtags(!includeHashtags)}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <div
                className={`w-4 h-4 rounded flex items-center justify-center ${
                  includeHashtags ? 'bg-mint' : 'bg-white border border-[#D1D5DB]'
                }`}
              >
                {includeHashtags && (
                  <svg
                    className="w-3 h-3 text-brand"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="3"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <span className="text-sm font-medium text-[#1F2937]">Hashtags</span>
            </button>

            <div className="flex items-center gap-2 opacity-50 cursor-not-allowed">
              <div className="w-4 h-4 rounded border border-[#E5E7EB] bg-white" />
              <span className="text-sm font-medium text-[#9CA3AF]">Emoji</span>
            </div>

            <div className="flex items-center gap-2 opacity-50 cursor-not-allowed">
              <div className="w-4 h-4 rounded border border-[#E5E7EB] bg-white" />
              <span className="text-sm font-medium text-[#9CA3AF]">Handlingstekst</span>
            </div>

            <div className="flex items-center gap-2 opacity-50 cursor-not-allowed">
              <span className="text-sm font-medium text-[#9CA3AF]">Skrivestil</span>
              <span className="text-xs text-[#9CA3AF]">▼</span>
            </div>

            <div className="flex items-center gap-2 opacity-50 cursor-not-allowed">
              <span className="text-sm font-medium text-[#9CA3AF]">Tekstlængde</span>
              <span className="text-xs text-[#9CA3AF]">▼</span>
            </div>
          </div>

          <p className="text-sm font-medium text-[#6B7280]">
            Lås flere AI-værktøjer op med{' '}
            <button
              onClick={onUpgrade}
              className="text-[#6B7280] hover:text-[#1F2937] hover:underline font-semibold transition-colors"
            >
              Smart
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
