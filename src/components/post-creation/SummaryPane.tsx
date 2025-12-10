import { ReactNode } from 'react'
import { ChevronRight } from '../icons/PostCreationIcons'

interface SummaryPaneProps {
  validationBanner: ReactNode
  timeEstimateLabel: string
  timeEstimateMinutes: number
  minutesLabel: string
  continueLabel: string
  onNext: () => void
}

export function SummaryPane({
  validationBanner,
  timeEstimateLabel,
  timeEstimateMinutes,
  minutesLabel,
  continueLabel,
  onNext
}: SummaryPaneProps) {
  return (
    <>
      {validationBanner}

      <div className="flex justify-between items-center pt-2 pb-4">
        <div className="text-xs text-[#6B7280]">
          ⏱️ {timeEstimateLabel}:{' '}
          <span className="font-semibold text-[#0F2E32]">{timeEstimateMinutes} {minutesLabel}</span>
        </div>

        <button
          onClick={onNext}
          className="px-6 py-2 bg-[#0F2E32] text-[#88F2D7] rounded-lg hover:bg-[#12393D] transition-all font-bold text-xs shadow-md flex items-center gap-1.5"
        >
          <span>{continueLabel}</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </>
  )
}
