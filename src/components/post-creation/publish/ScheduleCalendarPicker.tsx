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
  dayPosts?: Array<{
    date: Date
    title: string
    platform: string
    time: string
  }>
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

const dateKey = (date: Date) => {
  const normalized = normalizeDate(date)
  const year = normalized.getFullYear()
  const month = String(normalized.getMonth() + 1).padStart(2, '0')
  const day = String(normalized.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const platformDot = (platform: string) => {
  const normalized = platform.toLowerCase()
  if (normalized === 'facebook') return 'bg-blue-500'
  if (normalized === 'instagram') return 'bg-pink-500'
  return 'bg-slate-400'
}

function PastDayTooltip({ posts }: { posts: Array<{ title: string; platform: string; time: string }> }) {
  if (posts.length === 0) return null

  return (
    <div className="pointer-events-none absolute left-1/2 top-full z-40 mt-2 w-56 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-2.5 text-left shadow-xl">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        Opslag denne dag
      </div>
      <div className="space-y-1">
        {posts.slice(0, 5).map((post, index) => (
          <div key={`${post.title}-${post.time}-${index}`} className="flex items-start gap-1.5">
            <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${platformDot(post.platform)}`} />
            <div className="min-w-0">
              <div className="text-[10px] font-semibold text-slate-700 line-clamp-1">{post.title}</div>
              <div className="text-[9px] text-slate-400">{post.time}</div>
            </div>
          </div>
        ))}
        {posts.length > 5 && (
          <div className="text-[9px] font-medium text-slate-400">+ {posts.length - 5} mere</div>
        )}
      </div>
    </div>
  )
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
  dayPosts,
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

  const postsByDay = useMemo(() => {
    const map = new Map<string, Array<{ title: string; platform: string; time: string }>>()

    for (const post of dayPosts ?? []) {
      const key = dateKey(post.date)
      const list = map.get(key) ?? []
      list.push({ title: post.title, platform: post.platform, time: post.time })
      map.set(key, list)
    }

    return map
  }, [dayPosts])

  const [hoveredPastDayKey, setHoveredPastDayKey] = useState<string | null>(null)

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
    <div className="space-y-2">
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
          const key = dateKey(dayObj.date)
          const postsForDay = postsByDay.get(key) ?? []
          const showTooltip = pastDate && hoveredPastDayKey === key && postsForDay.length > 0

          return (
            <button
              key={`${dayObj.date.toISOString()}-${index}`}
              onClick={() => handleDayClick(dayObj.date)}
              onMouseEnter={() => setHoveredPastDayKey(pastDate ? key : null)}
              onMouseLeave={() => setHoveredPastDayKey((current) => (current === key ? null : current))}
              aria-disabled={pastDate}
              className={`relative aspect-square flex flex-col items-center justify-center text-xs font-medium rounded transition-all overflow-visible ${
                pastDate
                  ? 'bg-transparent text-slate-300 cursor-default'
                  : selected
                  ? timeInPast
                    ? 'bg-amber-500 text-white shadow-md'
                    : 'bg-purple-600 text-white shadow-md'
                  : todayDate
                  ? 'bg-cta-surface text-cta-text font-bold'
                  : dayObj.isCurrentMonth
                  ? 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  : 'bg-transparent text-slate-400 hover:bg-slate-50 hover:text-slate-500'
              }`}
            >
              <span>{dayObj.day}</span>
              {postsForDay.length > 0 && (
                <div className="flex max-w-full flex-wrap justify-center gap-0.5 px-1 mt-0.5">
                  {postsForDay.map((post, postIndex) => {
                    const dotColor = selected 
                      ? 'bg-white/80' 
                      : post.platform.toLowerCase() === 'facebook' 
                      ? 'bg-blue-500' 
                        : post.platform.toLowerCase() === 'instagram' 
                        ? 'bg-pink-500' 
                        : 'bg-slate-400'
                    return (
                      <span key={`${key}-post-${postIndex}`} className={`h-1 w-1 rounded-full ${dotColor}`} />
                    )
                  })}
                </div>
              )}
              {showTooltip && <PastDayTooltip posts={postsForDay} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
