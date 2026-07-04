import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useBusinessData } from '../../hooks/useBusinessData'
import { useAllPublishedPosts, useManualPostingCount, type PublishedPost } from '../../hooks/usePublishedPosts'
import { useConnectionsStore } from '../../stores/connectionsStore'
import { ScheduledPostModal } from '../../components/post-creation/ScheduledPostModal'
import { SocialPreviewModal } from '../../components/calendar/SocialPreviewModal'
import { TimelinePostCard } from '../../components/post-creation/publish/TimelinePostCard'

// ─── icons ───────────────────────────────────────────────────────────────────
const ChevronLeft = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
)
const ChevronRight = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
)
const ScheduledPostsIcon = () => (
  <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
    <rect x="3.5" y="4" width="17" height="16" rx="2" />
    <line x1="8" y1="2.5" x2="8" y2="6" />
    <line x1="16" y1="2.5" x2="16" y2="6" />
    <line x1="3.5" y1="9" x2="20.5" y2="9" />
    <circle cx="15.5" cy="14.5" r="3" />
    <path d="M15.5 13.2v1.6l1.1.7" />
  </svg>
)
const PostedIcon = () => (
  <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8.8 12.2l2.1 2.1 4.6-4.6" />
    <path d="M9 7.5h6m-6 9h6" />
  </svg>
)

// ─── helpers ─────────────────────────────────────────────────────────────────
const DAY_NAMES_DA = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']

function toDateKey(d: Date) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function platformColor(platform: string) {
  const p = platform.toLowerCase()
  if (p === 'facebook') return 'bg-blue-500'
  if (p === 'instagram') return 'bg-pink-500'
  return 'bg-slate-400'
}

function platformDot(platform: string, isScheduled?: boolean, needsManual?: boolean) {
  const p = platform.toLowerCase()
  if (p === 'facebook') return 'bg-blue-500'
  if (p === 'instagram') return 'bg-pink-500'
  return 'bg-slate-400'
}

function effectivePostDate(post: PublishedPost) {
  return post.scheduledFor ?? post.postedAt
}

function isPastDate(date: Date, todayStart: Date) {
  return date.getTime() < todayStart.getTime()
}

function formatDateTime(d: Date) {
  return d.toLocaleDateString('da-DK', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short',
      timeZone: 'Europe/Copenhagen'
    })
    + ' · ' + d.toLocaleTimeString('da-DK', { 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: 'Europe/Copenhagen'
    })
}

function titleFromPost(p: PublishedPost) {
  if (p.menuItemName) return p.menuItemName
  if (p.contentType) return p.contentType.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())
  return p.platform
}

function statusMeta(post: PublishedPost, isManual: boolean, t: (key: string) => string) {
  if (isManual) {
    return {
      label: 'manual',
      className: 'bg-amber-100 text-amber-700',
    }
  }

  if (post.status === 'draft') {
    return {
      label: t('posts.status.draft'),
      className: 'bg-yellow-100 text-yellow-800',
    }
  }

  if (post.status === 'scheduled') {
    return {
      label: t('posts.status.scheduled'),
      className: 'bg-white text-green-700 border border-green-300',
    }
  }

  return {
    label: t('posts.status.published'),
    className: 'bg-green-100 text-green-700',
  }
}

// ─── holidays ────────────────────────────────────────────────────────────────
interface SpecialDay { name: string; short: string; type: 'public' | 'special' }

function _easter(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  return new Date(year, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1)
}
function _addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function _nthWeekday(year: number, month: number, dow: number, n: number): Date {
  const first = new Date(year, month, 1).getDay()
  return new Date(year, month, 1 + (dow - first + 7) % 7 + (n - 1) * 7)
}

function buildDanishHolidays(year: number): Record<string, SpecialDay> {
  const m: Record<string, SpecialDay> = {}
  const p = (d: Date, s: SpecialDay) => { m[toDateKey(d)] = s }
  const e = _easter(year)
  // Helligdage (public red days)
  p(new Date(year, 0, 1),   { name: 'Nytårsdag',         short: 'Nytår',     type: 'public' })
  p(_addDays(e, -3),        { name: 'Skærtorsdag',        short: 'Skærtor.',  type: 'public' })
  p(_addDays(e, -2),        { name: 'Langfredag',         short: 'Langfr.',   type: 'public' })
  p(e,                      { name: '1. Påskedag',        short: '1.Påske',   type: 'public' })
  p(_addDays(e, 1),         { name: '2. Påskedag',        short: '2.Påske',   type: 'public' })
  p(_addDays(e, 39),        { name: 'Kr. Himmelfartsdag', short: 'Himmelf.',  type: 'public' })
  p(_addDays(e, 49),        { name: '1. Pinsedag',        short: '1.Pinse',   type: 'public' })
  p(_addDays(e, 50),        { name: '2. Pinsedag',        short: '2.Pinse',   type: 'public' })
  p(new Date(year, 5, 5),   { name: 'Grundlovsdag',       short: 'Grundlov',  type: 'public' })
  p(new Date(year, 11, 24), { name: 'Juleaften',          short: 'Juleafte', type: 'public' })
  p(new Date(year, 11, 25), { name: '1. Juledag',         short: '1.Jul',     type: 'public' })
  p(new Date(year, 11, 26), { name: '2. Juledag',         short: '2.Jul',     type: 'public' })
  // Mærkedage (special commercial/cultural days)
  p(new Date(year, 1, 14),             { name: 'Valentinsdag', short: 'Valentine', type: 'special' })
  p(_nthWeekday(year, 4, 0, 2),        { name: 'Morsdag',      short: 'Morsdag',   type: 'special' }) // 2nd Sun May
  p(new Date(year, 9, 31),             { name: 'Halloween',    short: 'Halloween', type: 'special' })
  p(new Date(year, 11, 31),            { name: 'Nytårsaften',  short: 'Nytårsa.',  type: 'special' })
  return m
}

function getHolidays(year: number, countryCode: string): Record<string, SpecialDay> {
  if (countryCode === 'da' || countryCode === 'dk') return buildDanishHolidays(year)
  return {}
}

// ─── Calendar panel (left) ────────────────────────────────────────────────────
function CalendarPanel({
  posts,
  selectedKey,
  onSelectDay,
  countryCode = 'da',
  isConnected,
}: {
  posts: PublishedPost[]
  selectedKey: string | null
  onSelectDay: (key: string | null) => void
  countryCode?: string
  isConnected: (platform: string) => boolean
}) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const rawStart = new Date(year, month, 1).getDay()
  const startOffset = (rawStart + 6) % 7
  const prevMonthDays = new Date(year, month, 0).getDate()
  const totalCells = 42 // always 6 rows for consistent height
  const trailingDays = totalCells - startOffset - daysInMonth
  const monthName = currentMonth.toLocaleDateString('da-DK', { month: 'long', year: 'numeric' })
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayKey = toDateKey(today)

  const byDay = useMemo(() => {
    const map: Record<string, PublishedPost[]> = {}
    posts.forEach(p => {
      const k = toDateKey(effectivePostDate(p))
      if (!map[k]) map[k] = []
      map[k].push(p)
    })
    return map
  }, [posts])

  const holidays = useMemo(() => ({
    ...getHolidays(year, countryCode),
    ...(month === 11 ? getHolidays(year + 1, countryCode) : {}),
    ...(month === 0  ? getHolidays(year - 1, countryCode) : {}),
  }), [year, month, countryCode])

  const monthPosts = useMemo(() => posts.filter(p => {
    const date = effectivePostDate(p)
    return date.getFullYear() === year && date.getMonth() === month
  }
  ), [posts, year, month])
  const fbCount = monthPosts.filter(p => p.platform.toLowerCase() === 'facebook').length
  const igCount = monthPosts.filter(p => p.platform.toLowerCase() === 'instagram').length
  const photoCount = monthPosts.filter(p => !!p.photoUrl).length

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} className="p-1.5 hover:bg-slate-100 rounded-lg transition"><ChevronLeft /></button>
        <span className="text-sm font-bold text-slate-800 capitalize">{monthName}</span>
        <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} className="p-1.5 hover:bg-slate-100 rounded-lg transition"><ChevronRight /></button>
      </div>

      {/* Day-name header row */}
      <div className="grid grid-cols-7 gap-1">
        {DAY_NAMES_DA.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-slate-400 pb-0.5">{d}</div>
        ))}
      </div>

      {/* Date cells — flex-1 so they fill remaining height; equal rows via gridAutoRows */}
      <div
        className="flex-1 grid grid-cols-7 gap-1 min-h-0"
        style={{ gridAutoRows: 'minmax(0, 1fr)' }}
      >
        {/* Previous month overflow */}
        {Array.from({ length: startOffset }, (_, i) => {
          const day = prevMonthDays - startOffset + 1 + i
          const overflowMonth = month === 0 ? 11 : month - 1
          const overflowYear = month === 0 ? year - 1 : year
          const cellDate = new Date(overflowYear, overflowMonth, day)
          cellDate.setHours(0, 0, 0, 0)
          const key = toDateKey(cellDate)
          const dayPosts = byDay[key] ?? []
          const isPast = isPastDate(cellDate, today)
          const holiday = holidays[key]
          return (
            <button
              key={`prev-${i}`}
              onClick={() => {
                setCurrentMonth(new Date(overflowYear, overflowMonth, 1))
                onSelectDay(key)
              }}
              title={holiday?.name}
              className={`relative rounded-lg border text-xs font-medium flex flex-col items-center justify-center gap-0.5 transition-all ${
                holiday?.type === 'public' ? 'border-amber-100 bg-amber-50/50 text-slate-300'
                : holiday?.type === 'special' ? 'border-violet-100 bg-violet-50/40 text-slate-300'
                : 'border-slate-100 bg-slate-50/60 text-slate-300'
              } ${isPast ? 'cursor-default' : 'hover:bg-slate-100 cursor-pointer'}`}
            >
              <span>{day}</span>
              {holiday && (
                <span className={`text-[7px] leading-none px-0.5 truncate max-w-full text-center ${
                  holiday.type === 'public' ? 'text-amber-300' : 'text-violet-300'
                }`}>{holiday.short}</span>
              )}
            </button>
          )
        })}

        {/* Current month days */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const cellDate = new Date(year, month, day)
          cellDate.setHours(0, 0, 0, 0)
          const key = toDateKey(cellDate)
          const dayPosts = byDay[key] ?? []
          const isToday = key === todayKey
          const isSelected = key === selectedKey
          const isPast = isPastDate(cellDate, today)
          const holiday = holidays[key]
          return (
            <button
              key={key}
              onClick={() => {
                onSelectDay(isSelected ? null : key)
              }}
              title={holiday?.name}
              className={`relative rounded-lg border text-xs font-medium flex flex-col items-center justify-center gap-0.5 transition-all ${
                isSelected
                  ? 'bg-[#0A7D5F] text-white border-[#0A7D5F] shadow-md'
                : isToday
                  ? 'bg-white border-slate-100 text-slate-800 shadow-sm'
                : holiday?.type === 'public'
                  ? 'bg-amber-50 border-amber-200 text-slate-800 hover:border-amber-300'
                : holiday?.type === 'special'
                  ? 'bg-violet-50 border-violet-100 text-slate-700 hover:border-violet-200'
                : dayPosts.length > 0
                  ? 'bg-white border-slate-300 text-slate-800 hover:border-slate-400'
                : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
              } hover:scale-[1.04] cursor-pointer`}
            >
              <span className={isToday ? 'flex h-7 w-7 items-center justify-center rounded-full bg-[#0A7D5F] text-white text-[14px] font-medium' : ''}>
                {day}
              </span>
              {holiday && (
                <span className={`text-[7px] leading-none px-0.5 truncate max-w-full text-center ${
                  isSelected ? 'text-white/80'
                  : isToday ? 'text-[#0A7D5F]'
                  : holiday.type === 'public' ? 'text-amber-600'
                  : 'text-violet-500'
                }`}>{holiday.short}</span>
              )}
              {dayPosts.length > 0 && (
                <div className="flex max-w-full flex-wrap justify-center gap-0.5 px-1">
                  {dayPosts.map((p) => {
                    return (
                      <span key={p.id} className={`h-1.5 w-1.5 rounded-full ${
                        isSelected ? 'bg-white/80' : platformDot(p.platform)
                      }`} />
                    )
                  })}
                </div>
              )}
            </button>
          )
        })}

        {/* Next month overflow */}
        {Array.from({ length: trailingDays }, (_, i) => {
          const day = i + 1
          const overflowMonth = month === 11 ? 0 : month + 1
          const overflowYear = month === 11 ? year + 1 : year
          const cellDate = new Date(overflowYear, overflowMonth, day)
          cellDate.setHours(0, 0, 0, 0)
          const key = toDateKey(cellDate)
          const dayPosts = byDay[key] ?? []
          const isPast = isPastDate(cellDate, today)
          const holiday = holidays[key]
          return (
            <button
              key={`next-${i}`}
              onClick={() => {
                setCurrentMonth(new Date(overflowYear, overflowMonth, 1))
                onSelectDay(key)
              }}
              title={holiday?.name}
              className={`relative rounded-lg border text-xs font-medium flex flex-col items-center justify-center gap-0.5 transition-all ${
                holiday?.type === 'public' ? 'border-amber-100 bg-amber-50/50 text-slate-300'
                : holiday?.type === 'special' ? 'border-violet-100 bg-violet-50/40 text-slate-300'
                : 'border-slate-100 bg-slate-50/60 text-slate-300'
              } ${isPast ? 'cursor-default' : 'hover:bg-slate-100 cursor-pointer'}`}
            >
              <span>{day}</span>
              {holiday && (
                <span className={`text-[7px] leading-none px-0.5 truncate max-w-full text-center ${
                  holiday.type === 'public' ? 'text-amber-300' : 'text-violet-300'
                }`}>{holiday.short}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Monthly summary strip */}
      <div className="border-t border-slate-100 pt-3">
        {monthPosts.length === 0 ? (
          <p className="text-[10px] text-slate-400 text-center">Ingen opslag i {monthName}</p>
        ) : (
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-[10px] text-slate-500">
              <span className="font-bold text-blue-500">{fbCount}</span> Facebook
            </span>
            <span className="text-[10px] text-slate-500">
              <span className="font-bold text-pink-500">{igCount}</span> Instagram
            </span>
            {photoCount > 0 && (
              <span className="text-[10px] text-slate-500">
                <span className="font-bold text-slate-700">{photoCount}</span> billeder
              </span>
            )}
            <span className="ml-auto text-[10px] text-slate-400">{monthPosts.length} opslag i alt</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Scheduled upcoming panel (right top) ─────────────────────────────────────
function ScheduledPanel({
  posts,
  isConnected,
  onPreview,
  onPostClick,
  t,
}: {
  posts: PublishedPost[]
  isConnected: (platform: string) => boolean
  onPreview: (post: PublishedPost) => void
  onPostClick: (post: PublishedPost) => void
  t: (key: string) => string
}) {
  const scheduledPosts = useMemo(() =>
    posts
      .filter(p => p.status === 'scheduled')
      .sort((a, b) => {
        const da = (a.scheduledFor ?? a.postedAt).getTime()
        const db = (b.scheduledFor ?? b.postedAt).getTime()
        return da - db
      })
  , [posts])

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <p className="text-xs font-bold text-slate-700">Planlagte opslag</p>
        {scheduledPosts.length > 0 && (
          <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-semibold">{scheduledPosts.length}</span>
        )}
      </div>

      {scheduledPosts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
          <div className="mb-1"><ScheduledPostsIcon /></div>
          <p className="text-[10px] text-slate-400">Ingen planlagte opslag endnu.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
          {scheduledPosts.map(p => {
            const date = p.scheduledFor ?? p.postedAt
            const needsManual = !isConnected(p.platform.toLowerCase())
            const status = statusMeta(p, needsManual, t)
            return (
              <TimelinePostCard
                key={p.id}
                platform={p.platform}
                isConnected={isConnected(p.platform.toLowerCase())}
                statusLabel={status.label}
                statusClassName={status.className}
                title={titleFromPost(p)}
                time={date.toLocaleDateString('da-DK', {
                  weekday: 'long',
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  timeZone: 'Europe/Copenhagen'
                }) + ' kl. ' + date.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Copenhagen' })}
                thumbnail={p.photoUrl ?? undefined}
                onClick={() => onPostClick(p)}
              >
                {p.postText && (
                  <p className="text-xs text-slate-700 line-clamp-2 mt-1">{p.postText}</p>
                )}
                <div className="mt-2 flex items-center gap-1.5 justify-end">
                  <button
                    onClick={(event) => {
                      event.stopPropagation()
                      onPreview(p)
                    }}
                    className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                    title="Forhåndsvis"
                  >
                    👁 Se
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation()
                      onPostClick(p)
                    }}
                    className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors"
                    title="Rediger"
                  >
                    ✏️
                  </button>
                </div>
              </TimelinePostCard>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Selected day panel (right bottom) ────────────────────────────────────────
function SelectedDayPanel({
  posts,
  selectedKey,
  isConnected,
  onPreview,
  onPostClick,
  t,
}: {
  posts: PublishedPost[]
  selectedKey: string | null
  isConnected: (platform: string) => boolean
  onPreview: (post: PublishedPost) => void
  onPostClick: (post: PublishedPost) => void
  t: (key: string) => string
}) {
  const displayPosts = useMemo(() => {
    if (!selectedKey) return []
    return posts
      .filter(p => {
        const dateToCheck = p.scheduledFor ?? p.postedAt
        return toDateKey(dateToCheck) === selectedKey
      })
      .sort((a, b) => {
        const da = (a.scheduledFor ?? a.postedAt).getTime()
        const db = (b.scheduledFor ?? b.postedAt).getTime()
        return da - db
      })
  }, [posts, selectedKey])

  const selectedDate = selectedKey ? new Date(selectedKey + 'T12:00:00') : null
  const title = selectedDate
    ? selectedDate.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' })
    : null

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <p className="text-xs font-bold text-slate-700 capitalize">
          {title ?? 'Valgt dag'}
        </p>
        {displayPosts.length > 0 && (
          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-semibold">{displayPosts.length}</span>
        )}
      </div>

      {!selectedKey ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
          <div className="text-2xl mb-1">📅</div>
          <p className="text-[10px] text-slate-400">Vælg en dato i kalenderen.</p>
        </div>
      ) : displayPosts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
          <div className="mb-1"><PostedIcon /></div>
          <p className="text-[10px] text-slate-400">Ingen opslag denne dag.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
          {displayPosts.map(p => {
            const isScheduled = p.status === 'scheduled'
            const needsManual = isScheduled && !isConnected(p.platform.toLowerCase())
            const postDate = p.scheduledFor ?? p.postedAt
            const status = statusMeta(p, needsManual, t)
            return (
              <TimelinePostCard
                key={p.id}
                platform={p.platform}
                isConnected={isConnected(p.platform.toLowerCase())}
                statusLabel={status.label}
                statusClassName={status.className}
                title={titleFromPost(p)}
                time={postDate.toLocaleDateString('da-DK', {
                  weekday: 'long',
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  timeZone: 'Europe/Copenhagen'
                }) + ' kl. ' + postDate.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Copenhagen' })}
                thumbnail={p.photoUrl ?? undefined}
                onClick={isScheduled ? () => onPostClick(p) : undefined}
              >
                {p.postText && (
                  <p className="text-xs text-slate-700 line-clamp-2 mt-1">{p.postText}</p>
                )}
                <div className="mt-2 flex items-center gap-1.5 justify-end">
                  <button
                    onClick={(event) => {
                      event.stopPropagation()
                      onPreview(p)
                    }}
                    className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                    title="Forhåndsvis"
                  >
                    👁 Se
                  </button>
                  {isScheduled && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation()
                        onPostClick(p)
                      }}
                      className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors"
                      title="Rediger"
                    >
                      ✏️
                    </button>
                  )}
                </div>
              </TimelinePostCard>
            )
          })}
        </div>
      )}
    </div>
  )
}

// AllPostsPanel removed — replaced by ScheduledPanel and SelectedDayPanel

// ─── Main page ────────────────────────────────────────────────────────────────
export function CalendarPage() {
  const { t, i18n } = useTranslation()
  const { business } = useBusinessData()
  const { posts, isLoading, refresh } = useAllPublishedPosts(business?.id ?? null)
  const { isConnected } = useConnectionsStore()
  const [selectedKey, setSelectedKey] = useState<string | null>(() => {
    // Default to today
    return toDateKey(new Date())
  })
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null)
  const [previewPost, setPreviewPost] = useState<PublishedPost | null>(null)
  const countryCode = i18n.language.startsWith('da') ? 'da' : i18n.language.slice(0, 2)

  const manualPostCount = useManualPostingCount(posts, isConnected)
  const scheduledCount = posts.filter(p => p.status === 'scheduled').length

  const handlePostClick = (post: PublishedPost) => {
    if (post.status === 'scheduled') {
      setSelectedPostId(post.id)
    }
  }

  const handleCloseModal = () => {
    setSelectedPostId(null)
    refresh()
  }

  return (
    <div className="h-full flex flex-col p-4 sm:p-5 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-900">{t('navigation.calendar')}</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isLoading
              ? 'Henter opslag…'
              : `${posts.length} opslag · ${scheduledCount} planlagt${manualPostCount > 0 ? ` · ${manualPostCount} behøver manuel posting` : ''}`}
          </p>
        </div>
        <button onClick={refresh} className="text-xs text-indigo-600 hover:text-indigo-700 hover:underline">Opdater</button>
      </div>

      {/* Manual posting banner */}
      {manualPostCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
          <span className="text-amber-600 text-lg flex-shrink-0">⚠️</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">
              {manualPostCount} planlagt opslag behøver manuel posting
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Platforme er ikke tilsluttet. Vælg et opslag nedenfor for at kopiere og poste manuelt.
            </p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-[1fr_1.1fr] gap-4 min-h-0">

          {/* LEFT — Calendar */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col">
            <CalendarPanel
              posts={posts}
              selectedKey={selectedKey}
              onSelectDay={setSelectedKey}
              countryCode={countryCode}
              isConnected={isConnected}
            />
          </div>

          {/* RIGHT — two stacked panels */}
          <div className="flex flex-col gap-4 min-h-0">

            {/* TOP — scheduled upcoming posts */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col min-h-0 flex-1">
              <ScheduledPanel
                posts={posts}
                isConnected={isConnected}
                onPreview={setPreviewPost}
                onPostClick={handlePostClick}
                t={t}
              />
            </div>

            {/* BOTTOM — selected day posts */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col min-h-0 flex-1">
              <SelectedDayPanel
                posts={posts}
                selectedKey={selectedKey}
                isConnected={isConnected}
                onPreview={setPreviewPost}
                onPostClick={handlePostClick}
                t={t}
              />
            </div>

          </div>
        </div>
      )}

      {/* Scheduled Post edit/delete modal */}
      {selectedPostId && (
        <ScheduledPostModal
          postId={selectedPostId}
          isOpen={true}
          onClose={handleCloseModal}
          onDeleted={handleCloseModal}
          onUpdated={refresh}
        />
      )}

      {/* Social preview modal */}
      <SocialPreviewModal
        post={previewPost}
        businessName={business?.name ?? 'Din forretning'}
        onClose={() => setPreviewPost(null)}
      />
    </div>
  )
}

