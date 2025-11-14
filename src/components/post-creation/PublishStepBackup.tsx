import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePostCreationStore } from '../../stores/postCreationStore'
import { useTierStore } from '../../stores/tierStore'
import { ProgressStepper } from '../ui/ProgressStepper'

interface PublishStepProps {
  onNext: () => void
  onBack: () => void
  onStepClick?: (step: number) => void
}

// Icon Components
const Clock = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
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

const Send = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
)

const Sparkles = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M12 3v18m0-18l-3 3m3-3l3 3m-3 15l-3-3m3 3l3-3m6-9H3m18 0l-3-3m3 3l-3 3M3 12l3-3m-3 3l3 3"/>
  </svg>
)

const TrendingUp = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
    <polyline points="17 6 23 6 23 12"/>
  </svg>
)

const Check = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

const ChevronLeft = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
)

const Sun = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
)

const Users = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)

export function PublishStep({ onNext, onBack, onStepClick }: PublishStepProps) {
  const { t } = useTranslation(undefined, { keyPrefix: 'createPost' })
  const { selectedPlatforms } = usePostCreationStore()
  const { 
    currentTier, 
    getTierLimits, 
    canSchedulePost, 
    incrementScheduledPost, 
    quotaUsage 
  } = useTierStore()

  const [publishMode, setPublishMode] = useState<'now' | 'schedule'>('now')
  const [selectedSuggestion, setSelectedSuggestion] = useState<number | null>(null)
  const [customDate, setCustomDate] = useState('')
  const [customTime, setCustomTime] = useState('14:00')
  const [isPublishing, setIsPublishing] = useState(false)

  // AI-suggested times
  const aiSuggestions = [
    {
      id: 1,
      time: 'Today, 18:00',
      reason: t('publish.suggestion1', 'Peak evening engagement'),
      expectedReach: 'High',
      icon: Sun
    },
    {
      id: 2,
      time: 'Tomorrow, 10:00',
      reason: t('publish.suggestion2', 'Morning coffee scroll time'),
      expectedReach: 'Medium',
      icon: Users
    },
    {
      id: 3,
      time: 'Friday, 12:00',
      reason: t('publish.suggestion3', 'Lunch break browsing'),
      expectedReach: 'High',
      icon: TrendingUp
    }
  ]

  const handlePublish = async () => {
    if (publishMode === 'schedule') {
      if (!canSchedulePost()) {
        alert(t('publish.scheduleQuotaExceeded', `You've reached your monthly limit. ${currentTier === 'free' ? 'Upgrade to StandardPlus for unlimited scheduling!' : 'Try publishing now instead.'}`))
        return
      }
    }
    
    setIsPublishing(true)
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    console.log('Publishing to:', selectedPlatforms)
    console.log('Mode:', publishMode)
    if (publishMode === 'schedule') {
      console.log('Scheduled for:', selectedSuggestion ? aiSuggestions[selectedSuggestion - 1].time : `${customDate} ${customTime}`)
      incrementScheduledPost()
    }
    
    setIsPublishing(false)
    onNext()
  }

  const canPublish = publishMode === 'now' || (publishMode === 'schedule' && (selectedSuggestion !== null || (customDate && customTime)))

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center mb-3">
        <h1 className="text-2xl font-bold text-slate-800 mb-1">
          {t('publish.title', 'Schedule & Publish')}
        </h1>
        <p className="text-base text-slate-600">
          {t('publish.subtitle', 'Choose when to publish your post')}
        </p>
      </div>

      {/* Progress Stepper */}
      <ProgressStepper currentStep={3} totalSteps={3} onStepClick={onStepClick} />

      {/* Quick Action Buttons - COMPACT */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setPublishMode('now')}
          className={`relative p-3 rounded-lg border transition-all ${
            publishMode === 'now'
              ? 'border-indigo-500 bg-indigo-50 shadow-md'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex flex-col items-center gap-2">
            <div className={`p-2 rounded-full ${publishMode === 'now' ? 'bg-indigo-100' : 'bg-slate-100'}`}>
              <Send className={`w-5 h-5 ${publishMode === 'now' ? 'text-indigo-600' : 'text-slate-600'}`} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-800 mb-0.5">
                {t('publish.publishNow', 'Publish Now')}
              </h3>
              <p className="text-xs text-slate-600">
                {t('publish.publishNowDesc', 'Post immediately to all platforms')}
              </p>
            </div>
            {publishMode === 'now' && (
              <div className="absolute top-2 right-2 w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
        </button>

        <button
          onClick={() => setPublishMode('schedule')}
          className={`relative p-3 rounded-lg border transition-all ${
            publishMode === 'schedule'
              ? 'border-purple-500 bg-purple-50 shadow-md'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex flex-col items-center gap-2">
            <div className={`p-2 rounded-full ${publishMode === 'schedule' ? 'bg-purple-100' : 'bg-slate-100'}`}>
              <Calendar className={`w-5 h-5 ${publishMode === 'schedule' ? 'text-purple-600' : 'text-slate-600'}`} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-800 mb-0.5">
                {t('publish.schedule', 'Schedule')}
              </h3>
              <p className="text-xs text-slate-600">
                {t('publish.scheduleDesc', 'Post at the best time for engagement')}
              </p>
              {currentTier === 'free' && (
                <p className="text-xs text-purple-600 mt-0.5 font-semibold">
                  {quotaUsage.scheduledPostsThisMonth}/{getTierLimits(currentTier).scheduledPostsPerMonth} {t('publish.usedThisMonth', 'used this month')}
                </p>
              )}
            </div>
            {publishMode === 'schedule' && (
              <div className="absolute top-2 right-2 w-5 h-5 bg-purple-600 rounded-full flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
        </button>
      </div>

      {/* Schedule Options - COMPACT */}
      {publishMode === 'schedule' && (
        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-3">
          
          {/* AI Suggestions - COMPACT */}
          <div className="mb-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <h3 className="text-sm font-bold text-slate-800">
                {t('publish.aiSuggestions', 'AI-Suggested Times')}
              </h3>
            </div>

            <div className="space-y-2">
              {aiSuggestions.map((suggestion) => {
                const Icon = suggestion.icon
                return (
                  <button
                    key={suggestion.id}
                    onClick={() => setSelectedSuggestion(suggestion.id)}
                    className={`w-full p-2 rounded-lg border transition-all text-left ${
                      selectedSuggestion === suggestion.id
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${selectedSuggestion === suggestion.id ? 'text-purple-600' : 'text-slate-600'}`} />
                        <div>
                          <p className="text-xs font-bold text-slate-800">{suggestion.time}</p>
                          <p className="text-xs text-slate-600">{suggestion.reason}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                          suggestion.expectedReach === 'High' 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {suggestion.expectedReach} {t('publish.reach', 'reach')}
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Custom Date/Time - COMPACT */}
          <div className="pt-3 border-t border-slate-200">
            <div className="flex items-center gap-1.5 mb-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-800">
                {t('publish.customTime', 'Or Choose Custom Time')}
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('publish.date', 'Date')}
                </label>
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => {
                    setCustomDate(e.target.value)
                    setSelectedSuggestion(null)
                  }}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('publish.time', 'Time')}
                </label>
                <input
                  type="time"
                  value={customTime}
                  onChange={(e) => {
                    setCustomTime(e.target.value)
                    setSelectedSuggestion(null)
                  }}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-xs"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Platform Summary - COMPACT */}
      <div className="bg-indigo-50 rounded-lg p-2 border border-indigo-200">
        <p className="text-xs text-indigo-800">
          📤 {t('publish.postingTo', 'Posting to')}:{' '}
          <span className="font-semibold">
            {selectedPlatforms.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}
          </span>
        </p>
      </div>

      {/* Navigation - COMPACT */}
      <div className="flex justify-between items-center pt-2 pb-4">
        <button
          onClick={onBack}
          className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 transition-colors flex items-center gap-1.5"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>{t('publish.back', 'Back')}</span>
        </button>
        
        <button
          onClick={handlePublish}
          disabled={!canPublish || isPublishing}
          className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold text-xs shadow-md flex items-center gap-1.5"
        >
          {isPublishing ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>{publishMode === 'now' ? t('publish.publishing', 'Publishing...') : t('publish.scheduling', 'Scheduling...')}</span>
            </>
          ) : (
            <>
              <span>{publishMode === 'now' ? t('publish.publishButton', 'Publish Now') : t('publish.scheduleButton', 'Schedule Post')}</span>
              <Send className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}
