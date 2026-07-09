/**
 * DateTimePicker - Separate date and time selection for post scheduling
 * 
 * This component is decoupled from the calendar grid and represents
 * the scheduled time for the current post being edited.
 */

import { Calendar, Clock } from 'lucide-react'

interface DateTimePickerProps {
  selectedDate: Date | null
  selectedHour: string
  selectedMinute: string
  timeInterval: number
  locale: string
  dateLabel: string
  timeLabel: string
  hourLabel: string
  minuteLabel: string
  onSelectDate: (date: Date) => void
  onSelectHour: (hour: string) => void
  onSelectMinute: (minute: string) => void
  showTimeNote?: boolean
  timeNote?: string
}

export function DateTimePicker({
  selectedDate,
  selectedHour,
  selectedMinute,
  timeInterval,
  locale,
  dateLabel,
  timeLabel,
  hourLabel,
  minuteLabel,
  onSelectDate,
  onSelectHour,
  onSelectMinute,
  showTimeNote,
  timeNote,
}: DateTimePickerProps) {
  const hours = Array.from({ length: 24 }, (_, index) => index.toString().padStart(2, '0'))
  const minutes = Array.from(
    { length: 60 / timeInterval },
    (_, index) => (index * timeInterval).toString().padStart(2, '0')
  )

  const formattedDate = selectedDate
    ? selectedDate.toLocaleDateString(locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : ''

  const formattedTime = `${selectedHour}:${selectedMinute}`

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-slate-700">
          <Calendar className="w-4 h-4" />
          <span className="text-sm font-semibold">{formattedDate}</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-700">
          <Clock className="w-4 h-4" />
          <span className="text-sm font-semibold">{formattedTime}</span>
        </div>
      </div>
    </div>
  )
}
