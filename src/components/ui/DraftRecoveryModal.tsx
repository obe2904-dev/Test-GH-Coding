interface DraftRecoveryModalProps {
  isOpen: boolean
  onRecover: () => void
  onDiscard: () => void
}

export function DraftRecoveryModal({ isOpen, onRecover, onDiscard }: DraftRecoveryModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg border border-[#E5E7EB] max-w-md w-full mx-4 p-6" style={{ boxShadow: 'rgba(0, 0, 0, 0.04) 0px 4px 12px' }}>
        <div className="mb-4">
          <h3 className="text-lg font-bold text-[#1F2937] mb-2">
            Kladde fundet
          </h3>
          <p className="text-sm text-[#6B7280]">
            Jeg fandt en tidligere kladde — vil du fortsætte med den?
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onDiscard}
            className="flex-1 px-4 py-2 bg-white border border-[#D1D5DB] rounded-lg text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors"
          >
            Nej, start forfra
          </button>
          <button
            onClick={onRecover}
            className="flex-1 px-4 py-2 bg-cta text-text-inverse rounded-lg text-sm font-medium hover:bg-cta-hover focus:ring-2 focus:ring-cta transition-colors"
          >
            Ja, gendan kladde
          </button>
        </div>
      </div>
    </div>
  )
}
