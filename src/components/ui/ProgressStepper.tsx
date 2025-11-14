import { useTranslation } from 'react-i18next'

interface ProgressStepperProps {
  currentStep: number
  totalSteps?: number
  stepLabels?: string[]
  onStepClick?: (step: number) => void
}

// Step Icons
const Sparkles = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M12 3v18m0-18l-3 3m3-3l3 3m-3 15l-3-3m3 3l3-3m6-9H3m18 0l-3-3m3 3l-3 3M3 12l3-3m-3 3l3 3"/>
  </svg>
)

const Camera = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
)

const Calendar = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)

const Check = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

export function ProgressStepper({ currentStep, totalSteps = 3, stepLabels, onStepClick }: ProgressStepperProps) {
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
  
  // Step icons
  const stepIcons = [Sparkles, Camera, Calendar]

  return (
    <div className="py-6">
      <div className="relative flex items-center justify-between">
        {/* Background line */}
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 -translate-y-1/2" style={{ zIndex: 0 }} />
        
        {/* Progress line */}
        <div 
          className="absolute top-1/2 left-0 h-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 -translate-y-1/2 transition-all duration-500"
          style={{ 
            width: currentStep === 1 ? '0%' : currentStep === 2 ? '50%' : '100%',
            zIndex: 0
          }}
        />

        {/* Steps */}
        {Array.from({ length: totalSteps }).map((_, index) => {
          const stepNumber = index + 1
          const isActive = stepNumber === currentStep
          const isCompleted = stepNumber < currentStep
          const isFuture = stepNumber > currentStep
          const StepIcon = stepIcons[index]

          return (
            <button
              key={stepNumber}
              onClick={() => onStepClick?.(stepNumber)}
              className="relative flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity"
              style={{ zIndex: 1 }}
              type="button"
            >
              {/* Circle on the line */}
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center transition-all border-2
                  ${isActive 
                    ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white border-indigo-600 shadow-lg ring-4 ring-indigo-100' 
                    : ''
                  }
                  ${isCompleted 
                    ? 'bg-indigo-600 text-white border-indigo-600' 
                    : ''
                  }
                  ${isFuture 
                    ? 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400' 
                    : ''
                  }
                `}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <StepIcon className="w-5 h-5" />
                )}
              </div>
              
              {/* Label and subtitle below */}
              <div className="mt-2 text-center">
                <div
                  className={`
                    text-sm font-bold
                    ${isActive ? 'text-indigo-600' : ''}
                    ${isCompleted ? 'text-indigo-600' : ''}
                    ${isFuture ? 'text-slate-700' : ''}
                  `}
                >
                  {labels[index]}
                </div>
                <div
                  className={`
                    text-xs mt-0.5 font-medium
                    ${isActive ? 'text-slate-600' : ''}
                    ${isCompleted ? 'text-slate-500' : ''}
                    ${isFuture ? 'text-slate-500' : ''}
                  `}
                >
                  {defaultSubtitles[index]}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
