import { useTranslation } from 'react-i18next'

interface ProgressStepperProps {
  currentStep: number
  totalSteps?: number
  stepLabels?: string[]
  onStepClick?: (step: number) => void
  compact?: boolean
}

const Check = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

export function ProgressStepper({ currentStep, totalSteps = 3, stepLabels, onStepClick, compact = false }: ProgressStepperProps) {
  const { t } = useTranslation()

  const defaultLabels = [
    t('createPost.steps.generate', 'Write'),
    t('createPost.steps.create', 'Design'),
    t('createPost.steps.publish', 'Publish')
  ]

  const defaultSubtitles = [
    t('createPost.steps.generateSubtitle', "What's your message?"),
    t('createPost.steps.createSubtitle', 'How should it look?'),
    t('createPost.steps.publishSubtitle', 'When to share?')
  ]

  const labels = stepLabels || defaultLabels

  if (compact) {
    const idx = Math.max(0, Math.min(totalSteps - 1, currentStep - 1))

    return (
      <div className="py-2">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center border-2 font-bold text-sm bg-white text-slate-700">
            {currentStep}
          </div>
          <div className="-translate-y-1 transform">
            <div className="text-sm font-bold text-slate-800">{labels[idx]}</div>
            <div className="text-xs text-slate-500 mt-2">{defaultSubtitles[idx]}</div>
          </div>
        </div>
      </div>
    )
  }

  const denominator = Math.max(1, totalSteps - 1)
  const progressPercent = totalSteps <= 1 ? 0 : ((currentStep - 1) / denominator) * 100

  return (
    <div className="py-6">
      <div className="relative h-28">
        {/* Background line */}
        <div className="absolute top-1/2 left-6 right-0 h-0.5 -translate-y-1/2 bg-slate-200" style={{ zIndex: 1 }} />

        {/* Progress line */}
        <div
          className="absolute top-1/2 left-6 h-0.5 -translate-y-1/2 bg-[#0F2E32] transition-all duration-500"
          style={{ width: `${progressPercent}%`, zIndex: 1 }}
        />

        {/* Steps */}
        {Array.from({ length: totalSteps }).map((_, index) => {
          const stepNumber = index + 1
          const isActive = stepNumber === currentStep
          const isCompleted = stepNumber < currentStep
          const isFuture = stepNumber > currentStep

          const baseLeftPercent = totalSteps <= 1 ? 50 : (index / denominator) * 100
          const rightSafePercent = 92
          const leftPercent = totalSteps > 1 && index === totalSteps - 1
            ? Math.min(baseLeftPercent, rightSafePercent)
            : baseLeftPercent
          const isFirst = index === 0
          const isLast = index === totalSteps - 1
          const translateX = isFirst ? 'translateX(-4px)' : 'translateX(-20px)'

          const circleAlignClass = 'justify-center'

          const labelColor = isActive || isCompleted ? 'text-[#1F2937]' : 'text-[#4B5563]'
          const subtitleColor = isActive || isCompleted ? 'text-[#6B7280]' : 'text-[#9CA3AF]'

          return (
            <button
              key={stepNumber}
              onClick={() => onStepClick?.(stepNumber)}
              className={`absolute top-0 grid h-full min-w-[9rem] max-w-[16rem] grid-cols-[2.5rem_auto] grid-rows-2 gap-x-3 px-2 text-left ${isLast ? 'pr-4' : ''}`}
              style={isLast ? { right: 0, left: 'auto', transform: 'none', zIndex: 2 } : { left: `${leftPercent}%`, transform: translateX, zIndex: 2 }}
              type="button"
            >
              <div className={`row-span-2 flex items-center ${circleAlignClass}`}>
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center border-2 font-bold text-lg transition-all
                    ${isActive ? 'bg-[#F4F1FE] text-[#C7BAF7] border-[#C7BAF7] shadow-lg ring-4 ring-purple-50' : ''}
                    ${isCompleted ? 'bg-[#FAFAFA] text-[#C7BAF7] border-[#C7BAF7] shadow-md' : ''}
                    ${isFuture ? 'bg-white text-[#C7BAF7] border-[#D1D5DB] hover:border-[#C7BAF7]' : ''}
                  `}
                >
                  {isCompleted ? <Check className="w-5 h-5" /> : stepNumber}
                </div>
              </div>

              <div className={`col-start-2 row-start-1 self-end mb-2 text-base font-bold ${labelColor}`}>
                {labels[index]}
              </div>

              <div className={`col-start-2 row-start-2 self-start mt-2 text-sm font-medium leading-tight ${subtitleColor}`}>
                {defaultSubtitles[index]}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
