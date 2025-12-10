import { useEffect, useMemo, useState, useCallback } from 'react'
import { Clock, ChevronLeft, ChevronRight } from './icons'

interface ScheduleCalendarPickerProps {
  selectedDate: Date | null
  selectedHour: string
  selectedMinute: string
  selectedTime: string
  timeInterval: number
  monthNames: string[]
  dayNames: string[]
  locale: string
  selectTimeLabel: string
  hourLabel: string
  minuteLabel: string
  timeInPastLabel: string
  onSelectDate: (date: Date) => void
  onSelectHour: (hour: string) => void
  onSelectMinute: (minute: string) => void
  onManualDateSelection?: () => void
}

const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()

const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay()

const normalizeDate = (date: Date) => {
  const normalized = new Date(date)
  normalized.setHours(0, 0, 0, 0)
  return normalized
}

export function ScheduleCalendarPicker({
  selectedDate,
  selectedHour,
  selectedMinute,
  selectedTime,
  timeInterval,
  monthNames,
  dayNames,
  locale,
  selectTimeLabel,
  hourLabel,
  minuteLabel,
  timeInPastLabel,
  onSelectDate,
  onSelectHour,
  onSelectMinute,
  onManualDateSelection
}: ScheduleCalendarPickerProps) {
  const initialMonth = useMemo(() => {
    if (!selectedDate) {
      const today = new Date()
      return new Date(today.getFullYear(), today.getMonth(), 1)
    }

    return new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  }, [selectedDate])

  const [currentMonth, setCurrentMonth] = useState(initialMonth)

  useEffect(() => {
    setCurrentMonth(initialMonth)
  }, [initialMonth])

  const isToday = useCallback((date: Date) => {
    const today = normalizeDate(new Date())
    const target = normalizeDate(date)
    return today.getTime() === target.getTime()
  }, [])

  const isPastDate = useCallback((date: Date) => {
    const today = normalizeDate(new Date())
    const target = normalizeDate(date)
    return target.getTime() < today.getTime()
  }, [])

  const isPastDateTime = useCallback(
    (date: Date, hour: string, minute: string) => {
      const dateTime = new Date(date)
      dateTime.setHours(parseInt(hour, 10), parseInt(minute, 10), 0, 0)
      return dateTime.getTime() < Date.now()
    },
    []
  )

  const isDateTimeInPast = useMemo(() => {
    if (!selectedDate) {
      return false
    }

    if (!isToday(selectedDate)) {
      return isPastDate(selectedDate)
    }

    return isPastDateTime(selectedDate, selectedHour, selectedMinute)
  }, [selectedDate, selectedHour, selectedMinute, isPastDate, isPastDateTime, isToday])

  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(currentMonth)
    const firstDay = getFirstDayOfMonth(currentMonth)
    const days: Array<{ day: number; isCurrentMonth: boolean; date: Date }> = []

    const prevMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    const daysInPrevMonth = getDaysInMonth(prevMonth)

    for (let i = firstDay - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i
      days.push({
        day,
        isCurrentMonth: false,
        date: new Date(prevMonth.getFullYear(), prevMonth.getMonth(), day)
      })
    }

    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        day: i,
        isCurrentMonth: true,
        date: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i)
      })
    }

    const totalCells = 42
    const remainingCells = totalCells - days.length
    const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)

    for (let i = 1; i <= remainingCells; i++) {
      days.push({
        day: i,
        isCurrentMonth: false,
        date: new Date(nextMonth.getFullYear(), nextMonth.getMonth(), i)
      })
    }

    return days
  }, [currentMonth])

  const isSelectedDay = useCallback(
    (date: Date) => {
      if (!selectedDate) {
        return false
      }

      return (
        selectedDate.getDate() === date.getDate() &&
        selectedDate.getMonth() === date.getMonth() &&
        selectedDate.getFullYear() === date.getFullYear()
      )
    },
    [selectedDate]
  )

  const handleDayClick = useCallback(
    (date: Date) => {
      if (isPastDate(date)) {
        return
      }

      if (
        date.getMonth() !== currentMonth.getMonth() ||
        date.getFullYear() !== currentMonth.getFullYear()
      ) {
        setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1))
      }

      if (isToday(date)) {
        const now = new Date()
        const selectedDateTime = new Date(date)
        selectedDateTime.setHours(
          parseInt(selectedHour, 10),
          parseInt(selectedMinute, 10),
          0,
          0
        )

        if (selectedDateTime.getTime() < now.getTime()) {
          const nextInterval = Math.ceil(now.getMinutes() / timeInterval) * timeInterval

          if (nextInterval >= 60) {
            const nextHour = (now.getHours() + 1).toString().padStart(2, '0')
            onSelectHour(nextHour)
            onSelectMinute('00')
          } else {
            onSelectHour(now.getHours().toString().padStart(2, '0'))
            onSelectMinute(nextInterval.toString().padStart(2, '0'))
          }
        }
      }

      onSelectDate(new Date(date))

      if (onManualDateSelection) {
        onManualDateSelection()
      }
    },
    [
      currentMonth,
      isPastDate,
      isToday,
      onManualDateSelection,
      onSelectDate,
      onSelectHour,
      onSelectMinute,
      selectedHour,
      selectedMinute,
      timeInterval
    ]
  )

  const handlePreviousMonth = useCallback(() => {
    setCurrentMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
    )
  }, [])

  const handleNextMonth = useCallback(() => {
    setCurrentMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
    )
  }, [])

  const hours = useMemo(
    () => Array.from({ length: 24 }, (_, index) => index.toString().padStart(2, '0')),
    []
  )

  const minutes = useMemo(
    () =>
      Array.from(
        { length: 60 / timeInterval },
        (_, index) => (index * timeInterval).toString().padStart(2, '0')
      ),
    [timeInterval]
  )

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="col-span-2 space-y-2">
        <div className="flex items-center justify-between">
          <button
            onClick={handlePreviousMonth}
            className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </button>
          <h4 className="text-sm font-bold text-slate-800">
            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </h4>
          <button
            onClick={handleNextMonth}
            className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {dayNames.map((day) => (
            <div
              key={day}
              className="text-center text-xs font-semibold text-slate-600"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {calendarDays.map((dayObj, index) => {
            const pastDate = isPastDate(dayObj.date)
            const todayDate = isToday(dayObj.date)
            const selected = isSelectedDay(dayObj.date)
            const timeInPast = todayDate &&
              isPastDateTime(dayObj.date, selectedHour, selectedMinute)

            return (
              <button
                key={`${dayObj.date.toISOString()}-${index}`}
                onClick={() => handleDayClick(dayObj.date)}
                disabled={pastDate}
                className={`aspect-square flex items-center justify-center text-xs font-medium rounded transition-all ${
                  pastDate
                    ? 'bg-transparent text-slate-300 cursor-not-allowed'
                    : selected
                    ? timeInPast
                      ? 'bg-amber-500 text-white shadow-md'
                      : 'bg-purple-600 text-white shadow-md'
                    : todayDate
                    ? 'bg-indigo-100 text-indigo-700 font-bold'
                    : dayObj.isCurrentMonth
                    ? 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                    : 'bg-transparent text-slate-400 hover:bg-slate-50 hover:text-slate-500'
                }`}
              >
                {dayObj.day}
              </button>
            )
          })}
        </div>
      </div>

      <div className="col-span-1 space-y-2">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-indigo-600" />
          <p className="text-xs font-semibold text-slate-700">
            {selectTimeLabel}
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            {hourLabel}
          </label>
          <select
            value={selectedHour}
            onChange={(event) => onSelectHour(event.target.value)}
            className="w-full px-2 py-1 border border-slate-300 rounded focus:ring-1 focus:ring-purple-500 focus:border-transparent text-xs bg-white"
          >
            {hours.map((hour) => (
              <option key={hour} value={hour}>
                {hour}:00
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            {minuteLabel}
          </label>
          <select
            value={selectedMinute}
            onChange={(event) => onSelectMinute(event.target.value)}
            className="w-full px-2 py-1 border border-slate-300 rounded focus:ring-1 focus:ring-purple-500 focus:border-transparent text-xs bg-white"
          >
            {minutes.map((minute) => (
              <option key={minute} value={minute}>
                :{minute}
              </option>
            ))}
          </select>
        </div>

        {selectedDate && (
          <>
            <div
              className={`p-1.5 rounded border ${
                isDateTimeInPast
                  ? 'bg-amber-50 border-amber-300'
                  : 'bg-purple-50 border-purple-200'
              }`}
            >
              <p
                className={`text-xs font-bold leading-tight ${
                  isDateTimeInPast ? 'text-amber-900' : 'text-purple-900'
                }`}
              >
                📅{' '}
                {selectedDate.toLocaleDateString(locale, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric'
                })}
              </p>
              <p
                className={`text-xs ${
                  isDateTimeInPast ? 'text-amber-800' : 'text-purple-800'
                }`}
              >
                🕐 {selectedTime}
              </p>
            </div>
            {isDateTimeInPast && (
              <div className="p-1.5 bg-red-50 border border-red-200 rounded">
                <p className="text-xs text-red-700 font-semibold">
                  ⚠️ {timeInPastLabel}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
