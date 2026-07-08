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
    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
      <h3 className="text-sm font-bold text-purple-900 mb-3">Planlæg dit opslag</h3>

      <div className="grid grid-cols-2 gap-3">
        {/* Date Picker */}
        <div>
          <label className="block text-xs font-semibold text-purple-800 mb-1.5">
            {dateLabel}
          </label>
          <input
            type="date"
            value={selectedDate ? selectedDate.toISOString().split('T')[0] : ''}
            onChange={(e) => {
              const newDate = new Date(e.target.value)
              if (!isNaN(newDate.getTime())) {
                onSelectDate(newDate)
              }
            }}
            className="w-full px-3 py-2 border border-purple-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        {/* Time Pickers */}
        <div>
          <label className="block text-xs font-semibold text-purple-800 mb-1.5">
            {timeLabel}
          </label>
          <div className="flex gap-2">
            <select
              value={selectedHour}
              onChange={(e) => onSelectHour(e.target.value)}
              className="flex-1 px-2 py-2 border border-purple-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              {hours.map((hour) => (
                <option key={hour} value={hour}>
                  {hour}
                </option>
              ))}
            </select>
            <span className="self-center text-purple-800 font-semibold">:</span>
            <select
              value={selectedMinute}
              onChange={(e) => onSelectMinute(e.target.value)}
              className="flex-1 px-2 py-2 border border-purple-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              {minutes.map((minute) => (
                <option key={minute} value={minute}>
                  {minute}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Selected Date/Time Display */}
      <div className="mt-3 flex items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5 text-purple-700">
          <Calendar className="w-3.5 h-3.5" />
          <span className="font-medium">{formattedDate}</span>
        </div>
        <div className="flex items-center gap-1.5 text-purple-700">
          <Clock className="w-3.5 h-3.5" />
          <span className="font-medium">{formattedTime}</span>
        </div>
      </div>

      {/* Time Note (for "Skriv Selv" mode) */}
      {showTimeNote && timeNote && (
        <div className="mt-2 px-2 py-1 bg-purple-100 border border-purple-300 rounded text-xs text-purple-800">
          ℹ️ {timeNote}
        </div>
      )}
    </div>
  )
}
