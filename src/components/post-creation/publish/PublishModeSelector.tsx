import type { Dispatch, SetStateAction } from 'react'
import { Calendar, Check, Send } from './icons'

export type PublishMode = 'now' | 'schedule'

interface PublishModeSelectorProps {
  mode: PublishMode
  onChange: Dispatch<SetStateAction<PublishMode>>
  nowTitle: string
  nowSubtitle: string
  scheduleTitle: string
  scheduleSubtitle: string
  showQuotaInfo?: boolean
  quotaUsed?: number
  quotaLimit?: number
  quotaLabel?: string
}

const activeClasses = 'border-accent bg-[#F4F1FE] shadow-sm'
const inactiveClasses = 'border-[#E5E7EB] bg-white hover:bg-[#F9FAFB]'

export function PublishModeSelector({
  mode,
  onChange,
  nowTitle,
  nowSubtitle,
  scheduleTitle,
  scheduleSubtitle,
  showQuotaInfo = false,
  quotaUsed = 0,
  quotaLimit = 0,
  quotaLabel = ''
}: PublishModeSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        onClick={() => onChange('now')}
        className={`relative p-3 rounded-lg border transition-all ${
          mode === 'now' ? activeClasses : inactiveClasses
        }`}
      >
        <div className="flex flex-col items-center gap-2">
          <div className={`p-2 rounded-full ${mode === 'now' ? 'bg-[#F4F1FE]' : 'bg-[#F9FAFB]'}`}>
            <Send className={`w-5 h-5 ${mode === 'now' ? 'text-brand' : 'text-[#9CA3AF]'}`} />
          </div>
          <div>
            <h3 className={`text-xs font-bold mb-0.5 ${mode === 'now' ? 'text-brand' : 'text-[#374151]'}`}>
              {nowTitle}
            </h3>
            <p className="text-xs text-[#6B7280]">{nowSubtitle}</p>
          </div>
          {mode === 'now' && (
            <div className="absolute top-2 right-2 w-5 h-5 bg-[#E3E8F8] border border-accent rounded-full flex items-center justify-center">
              <Check className="w-3 h-3 text-[#7DECCE] stroke-[2.5]" />
            </div>
          )}
        </div>
      </button>

      <button
        onClick={() => onChange('schedule')}
        className={`relative p-3 rounded-lg border transition-all ${
          mode === 'schedule' ? activeClasses : inactiveClasses
        }`}
      >
        <div className="flex flex-col items-center gap-2">
          <div className={`p-2 rounded-full ${mode === 'schedule' ? 'bg-[#F4F1FE]' : 'bg-[#F9FAFB]'}`}>
            <Calendar className={`w-5 h-5 ${mode === 'schedule' ? 'text-brand' : 'text-[#9CA3AF]'}`} />
          </div>
          <div>
            <h3 className={`text-xs font-bold mb-0.5 ${mode === 'schedule' ? 'text-brand' : 'text-[#374151]'}`}>
              {scheduleTitle}
            </h3>
            <p className="text-xs text-[#6B7280]">{scheduleSubtitle}</p>
            {showQuotaInfo && (
              <p className="text-xs text-[#7C3AED] mt-0.5 font-semibold">
                {quotaUsed}/{quotaLimit} {quotaLabel}
              </p>
            )}
          </div>
          {mode === 'schedule' && (
            <div className="absolute top-2 right-2 w-5 h-5 bg-[#E3E8F8] border border-accent rounded-full flex items-center justify-center">
              <Check className="w-3 h-3 text-[#7DECCE] stroke-[2.5]" />
            </div>
          )}
        </div>
      </button>
    </div>
  )
}
