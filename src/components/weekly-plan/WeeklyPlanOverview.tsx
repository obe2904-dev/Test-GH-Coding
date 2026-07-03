import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import type { TFunction } from 'i18next'
import type { WeeklyContentPlan, PostSpecification } from '../../types/weekly-plan'
import type { WeeklyPlanPostInfo } from '../../hooks/useCommittedSuggestions'
import { WeatherIcon } from './WeatherIcon'
import { ContentTypeIcon } from '../post-creation/ContentTypeIcon'
import { formatNudgeTargetDay } from '../../utils/formatNudgeTargetDay'

interface WeeklyPlanOverviewProps {
  plan: WeeklyContentPlan
  onPostClick: (post: PostSpecification) => void
  onGenerateNew: () => void
  onCreatePost?: (post: PostSpecification) => void
  // Indices (in plan.posts raw array) marked done in this session
  sessionDoneIndices?: number[]
  // Weekly-plan idea ids that are already committed and therefore locked
  lockedIdeaIds?: Set<number>
  // Map of weekly_plan_idea_id -> post details for created posts
  weeklyPlanPostMap?: Map<number, WeeklyPlanPostInfo>
  // Hide 'Generer ny plan' button (e.g. when viewing current in-progress week)
  showGenerateButton?: boolean
  // Weather refresh callback + loading state
  onRefreshWeather?: () => void
  refreshingWeather?: boolean
  // Stale alert message from parent (shown inside the weather block)
  weatherStaleAlert?: string | null
  // Result of weather refresh assessment from parent
  weatherAssessment?: { changed: boolean; impactedPosts: string[] } | null
  onDismissWeatherAssessment?: () => void
  onGenerateNewPlan?: () => void
}

// Helper to format date range (locale-aware via t)
function formatWeekRange(start: string, end: string, t: TFunction): string {
  const [startYear, startMonth, startDay] = start.split('-').map(Number)
  const [endYear, endMonth, endDay] = end.split('-').map(Number)
  
  const startDate = new Date(startYear, startMonth - 1, startDay)
  const endDate = new Date(endYear, endMonth - 1, endDay)
  
  const monthKeys = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
  ]
  
  const startDayNum = startDate.getDate()
  const endDayNum = endDate.getDate()
  const month = t(`weeklyPlan.overview.months.${monthKeys[endDate.getMonth()]}`)
  const year = endDate.getFullYear()
  
  return `${startDayNum}. - ${endDayNum}. ${month} ${year}`
}

// Compute display week range: show Monday–Sunday (weekStart is Monday)
function getDisplayWeekRange(weekStart: string): { start: string; end: string } {
  const [y, m, d] = weekStart.split('-').map(Number)
  const mon = new Date(y, m - 1, d)      // Monday (weekStart itself)
  const sun = new Date(y, m - 1, d + 6)  // Sunday (weekStart + 6)
  const toISO = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
  return { start: toISO(mon), end: toISO(sun) }
}

// Compute contextual label for the weather block header
function weatherHeaderLabel(weekStart: string, weekNumber: number, t: TFunction): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  // Monday of the current ISO week
  const currentMonday = new Date(today)
  currentMonday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  const nextMonday = new Date(currentMonday)
  nextMonday.setDate(currentMonday.getDate() + 7)
  const [y, m, d] = weekStart.split('-').map(Number)
  const planMonday = new Date(y, m - 1, d)
  if (planMonday.getTime() === currentMonday.getTime()) return t('weeklyPlan.weather.headerCurrent')
  if (planMonday.getTime() === nextMonday.getTime()) return t('weeklyPlan.weather.headerNext')
  return t('weeklyPlan.weather.headerWeek', { n: weekNumber })
}

// Strip any leading "Uge X:" or "Uge X -" prefix from AI-generated headline
function stripWeekPrefix(headline: string): string {
  return headline.replace(/^Uge\s+\d+\s*[:\-–]\s*/i, '').trim()
}

function getContentIconType(post: PostSpecification): string {
  const explicitType = (post.postType.type || '').toLowerCase()
  const strategicCategory = (post.strategicContext?.content_category || '').toLowerCase()
  const fallbackCategory = (post.postType.category || '').toLowerCase()
  const title = `${post.contentSubject.dish || ''} ${post.caption.firstLine || ''} ${post.title || ''}`.toLowerCase()

  const menuLike = ['menu_item', 'menu_highlight', 'product_menu', 'craving_visual']
  if (/terrasse|udend|udeserv|udeplads|outdoor|ude|plads/.test(title)) {
    return 'outdoor_seating'
  }

  if (/indend|indoor|inside|interior|innes|indeserv/.test(title)) {
    return 'indoor_focus'
  }

  if (/havne|åen|ved åen|udsigt|location/.test(title)) {
    return 'location_story'
  }

  if (/køkken|bag kulissen|behind|åbner|åbent køkken|prep|forbered/.test(title)) {
    return 'behind_scenes'
  }

  if (/stemning|hygge|atmosf|vibe/.test(title)) {
    return 'atmosphere'
  }

  if (/event|fredag|happy hour|launch|åbning|special|fejr|fest/.test(title)) {
    return 'event_promotion'
  }

  if (/drik|drink|vin|cocktail|øl|beverage/.test(title)) {
    return 'drinks'
  }

  if (menuLike.includes(explicitType) || menuLike.includes(strategicCategory) || menuLike.includes(fallbackCategory)) {
    return 'menu_item'
  }

  if (/menu|brunch|frokost|middag|scramble|æg|ret|salat|burger|suppe|dessert/.test(title)) {
    return 'menu_item'
  }

  if (strategicCategory) {
    return strategicCategory
  }

  return fallbackCategory || explicitType || 'menu_item'
}

function getContentIconClass(contentType: string): string {
  if (contentType === 'outdoor_seating') {
    return 'w-7 h-7 text-text flex-shrink-0 -ml-0.5'
  }
  return 'w-6 h-6 text-text flex-shrink-0'
}

// Convert wind speed (m/s) to descriptive Danish wind term based on Beaufort scale
function getWindDescription(windSpeed: number, t: TFunction): string {
  if (windSpeed < 2) return t('weeklyPlan.weather.windCalm', { defaultValue: 'stille' })
  if (windSpeed < 4) return t('weeklyPlan.weather.windLight', { defaultValue: 'let vind' })
  if (windSpeed < 6) return t('weeklyPlan.weather.windGentle', { defaultValue: 'svag vind' })
  if (windSpeed < 8) return t('weeklyPlan.weather.windModerate', { defaultValue: 'jævn vind' })
  if (windSpeed < 11) return t('weeklyPlan.weather.windFresh', { defaultValue: 'frisk vind' })
  if (windSpeed < 14) return t('weeklyPlan.weather.windStrong', { defaultValue: 'hård vind' })
  return t('weeklyPlan.weather.windGale', { defaultValue: 'stiv kuling' })
}

// Generate a short sentence summarising the full week's weather
function weekWeatherSummary(
  days: { date: string; temp_max: number; temp_min?: number; condition: string; precipitation_chance: number; wind_speed?: number }[],
  t: TFunction
): string {
  if (!days.length) return ''

  const allMax = days.map(d => d.temp_max)
  const weekMin = Math.min(...days.map(d => d.temp_min ?? d.temp_max - 5))
  const weekMax = Math.max(...allMax)
  const avgMax = Math.round(allMax.reduce((s, v) => s + v, 0) / allMax.length)

  const rainDays = days.filter(d => d.condition === 'rain')
  const snowDays = days.filter(d => d.condition === 'snow')
  const sunnyDays = days.filter(d => d.condition === 'sunny' || d.condition === 'partly_cloudy')

  // Wind analysis (wind_speed in m/s)
  const daysWithWind = days.filter(d => d.wind_speed !== undefined)
  const avgWind = daysWithWind.length > 0
    ? Math.round(daysWithWind.reduce((s, d) => s + (d.wind_speed || 0), 0) / daysWithWind.length)
    : 0
  const maxWind = daysWithWind.length > 0 
    ? Math.max(...daysWithWind.map(d => d.wind_speed || 0))
    : 0
  const windyDays = days.filter(d => (d.wind_speed || 0) > 7) // >7 m/s = ~25 km/h, affects outdoor seating
  const windiestDay = daysWithWind.length > 0
    ? daysWithWind.reduce((max, d) => (d.wind_speed || 0) > (max.wind_speed || 0) ? d : max, daysWithWind[0])
    : null

  // Dominant condition
  const condCount: Record<string, number> = {}
  for (const d of days) condCount[d.condition] = (condCount[d.condition] || 0) + 1
  const dominant = Object.entries(condCount).sort((a, b) => b[1] - a[1])[0][0]

  const condKey: Record<string, string> = {
    sunny: 'condSunny', partly_cloudy: 'condPartlyCloudy', cloudy: 'condCloudy',
    rain: 'condRain', snow: 'condSnow', fog: 'condFog',
  }
  const condEmoji: Record<string, string> = {
    sunny: '☀️', partly_cloudy: '⛅', cloudy: '☁️', rain: '🌧️', snow: '❄️', fog: '🌫️',
  }

  const longDayNames = t('weeklyPlan.overview.days.longFromIndex', { returnObjects: true }) as string[]
  const longDayName = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number)
    return longDayNames[new Date(y, m - 1, d).getDay()] ?? dateStr
  }
  const isWeekend = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number)
    const day = new Date(y, m - 1, d).getDay()
    return day === 0 || day === 6
  }

  const parts: string[] = []

  // Sentence 1 — overall pattern + temperature range
  let pattern = ''
  if (rainDays.length >= 4) {
    pattern = t('weeklyPlan.weather.heavyRainWeek', { rainDays: rainDays.length, totalDays: days.length })
  } else if (snowDays.length >= 3) {
    pattern = t('weeklyPlan.weather.winterWeek', { snowDays: snowDays.length })
  } else if (rainDays.length >= 2 && sunnyDays.length >= 2) {
    pattern = t('weeklyPlan.weather.mixedWeek', { sunnyDays: sunnyDays.length, rainDays: rainDays.length })
  } else {
    pattern = t('weeklyPlan.weather.overallWeek', { emoji: condEmoji[dominant] || '', condition: t(`weeklyPlan.weather.${condKey[dominant] ?? 'condCloudy'}`) })
  }
  pattern += t('weeklyPlan.weather.tempRange', { min: Math.round(weekMin), max: Math.round(weekMax), avg: avgMax })
  parts.push(pattern)

  // Sentence 2 — highlight the best and worst day if they differ meaningfully
  const warmest = days.reduce((best, d) => d.temp_max > best.temp_max ? d : best, days[0])
  const coldest = days.reduce((cold, d) => d.temp_max < cold.temp_max ? d : cold, days[0])
  const rainiestDay = days.filter(d => d.condition === 'rain').sort((a, b) => b.precipitation_chance - a.precipitation_chance)[0]

  const highlights: string[] = []
  if (warmest.temp_max - coldest.temp_max >= 5) {
    highlights.push(t('weeklyPlan.weather.warmest', { day: longDayName(warmest.date), temp: Math.round(warmest.temp_max) }))
    highlights.push(t('weeklyPlan.weather.coldest', { day: longDayName(coldest.date), temp: Math.round(coldest.temp_max) }))
  }
  // Only call out the rainiest day when the percentage is actually meaningful (≥40%),
  // to avoid misleading "most rain Saturday (24% chance)" on borderline WMO-coded days.
  if (rainiestDay && rainiestDay.precipitation_chance >= 40) {
    highlights.push(t('weeklyPlan.weather.mostRain', { day: longDayName(rainiestDay.date), pct: rainiestDay.precipitation_chance }))
  }
  
  // Wind highlights (important for outdoor seating)
  // Show ALL days with wind information, bundling consecutive days with same conditions
  const allDaysWithWindDetails = daysWithWind.map(d => ({
    date: d.date,
    day: longDayName(d.date),
    windDesc: getWindDescription(d.wind_speed || 0, t),
    windSpeed: d.wind_speed || 0
  }))
  
  if (allDaysWithWindDetails.length > 0) {
    // Group consecutive days with the same wind description
    const groupedWindDays: string[] = []
    let i = 0
    
    while (i < allDaysWithWindDetails.length) {
      const current = allDaysWithWindDetails[i]
      let j = i + 1
      
      // Find consecutive days with same wind description
      while (j < allDaysWithWindDetails.length && 
             allDaysWithWindDetails[j].windDesc === current.windDesc) {
        // Check if dates are consecutive (1 day apart)
        const currentDate = new Date(allDaysWithWindDetails[j - 1].date)
        const nextDate = new Date(allDaysWithWindDetails[j].date)
        const daysDiff = (nextDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
        
        if (daysDiff <= 1.5) { // Allow for small time differences
          j++
        } else {
          break
        }
      }
      
      // Format the group
      if (j - i > 1) {
        // Multiple consecutive days with same wind - show as range
        groupedWindDays.push(`${current.day}-${allDaysWithWindDetails[j - 1].day} (${current.windDesc})`)
      } else {
        // Single day
        groupedWindDays.push(`${current.day} (${current.windDesc})`)
      }
      
      i = j
    }
    
    const daysList = groupedWindDays.join(', ')
    highlights.push(t('weeklyPlan.weather.windDays', { 
      days: daysList,
      defaultValue: `vind: ${daysList}`
    }))
  }
  
  if (highlights.length) {
    parts.push(highlights.join(', ') + '.')
  }

  // Sentence 3 — weekend outlook (relevant for restaurants)
  const weekendDays = days.filter(d => isWeekend(d.date))
  if (weekendDays.length) {
    const condKeys = weekendDays.map(d => t(`weeklyPlan.weather.${condKey[d.condition] ?? 'condCloudy'}`))
    const wAvg = Math.round(weekendDays.reduce((s, d) => s + d.temp_max, 0) / weekendDays.length)
    const wRain = weekendDays.filter(d => d.condition === 'rain').length
    const wWindy = weekendDays.filter(d => (d.wind_speed || 0) > 7).length // Windy weekend days
    const wAvgWind = weekendDays.filter(d => d.wind_speed !== undefined).length > 0
      ? weekendDays.reduce((s, d) => s + (d.wind_speed || 0), 0) / weekendDays.length
      : 0
    const wWindDesc = getWindDescription(wAvgWind, t)
    const conditions = wRain === weekendDays.length ? t('weeklyPlan.weather.weekendAllRain') : condKeys.join(' / ')
    let weekendLine = t('weeklyPlan.weather.weekendSummary', { conditions, avg: wAvg })
    // Removed hardcoded "Good for outdoor" assessment - weather interpretation should be data-driven, not hardcoded
    // Previous code unconditionally added assessment even during rainy weeks if weekend had no rain
    if (wRain === 0 && wAvg >= 10 && wWindy >= 1) {
      // Warm but windy
      weekendLine += t('weeklyPlan.weather.weekendWindy', { 
        wind: wWindDesc,
        defaultValue: ` — ${wWindDesc} påvirker udendørsservering`
      })
    } else if (wRain >= 1) {
      weekendLine += t('weeklyPlan.weather.weekendRain')
    }
    parts.push(weekendLine)
  }

  return parts.join(' ')
}

// Visual chip for CTA intent shown on card
function getCTAChip(ctaType: string, t: TFunction): { label: string; classes: string } {
  const cta = (ctaType || '').toLowerCase()
  if (cta.startsWith('booking')) return { label: t('weeklyPlan.overview.cta.booking'), classes: 'bg-amber-100 text-amber-800' }
  if (cta.startsWith('event')) return { label: t('weeklyPlan.overview.cta.event'), classes: 'bg-cta-surface text-cta-text' }
  if (cta.startsWith('engagement')) return { label: t('weeklyPlan.overview.cta.engagement'), classes: 'bg-surface-alt text-text-muted border border-border' }
  if (cta.startsWith('awareness')) return { label: t('weeklyPlan.overview.cta.awareness'), classes: 'bg-purple-100 text-purple-800' }
  if (cta.startsWith('traffic')) return { label: t('weeklyPlan.overview.cta.traffic'), classes: 'bg-cta-surface text-cta-text' }
  return { label: t('weeklyPlan.overview.cta.default'), classes: 'bg-slate-100 text-slate-700' }
}

// Helper to get status badge
function getStatusBadge(status: string, t: TFunction): { text: string; color: string } {
  const badges: Record<string, { text: string; color: string }> = {
    draft: { text: t('weeklyPlan.overview.status.draft'), color: 'bg-slate-100 text-slate-700' },
    approved: { text: t('weeklyPlan.overview.status.approved'), color: 'bg-green-100 text-green-700' },
    scheduled: { text: t('weeklyPlan.overview.status.scheduled'), color: 'bg-blue-100 text-blue-700' },
    posted: { text: t('weeklyPlan.overview.status.posted'), color: 'bg-purple-100 text-purple-700' },
  }
  return badges[status] || badges.draft
}

export function WeeklyPlanOverview({
  plan,
  onPostClick,
  onGenerateNew,
  onCreatePost,
  sessionDoneIndices = [],
  lockedIdeaIds = new Set(),
  weeklyPlanPostMap = new Map(),
  showGenerateButton = true,
  onRefreshWeather,
  refreshingWeather = false,
  weatherStaleAlert,
  weatherAssessment,
  onDismissWeatherAssessment,
  onGenerateNewPlan,
}: WeeklyPlanOverviewProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              {(() => {
                const { start, end } = getDisplayWeekRange(plan.weekStart)
                return <>{t('weeklyPlan.overview.weekPrefix')} {plan.weekNumber}: {formatWeekRange(start, end, t)}</>
              })()}
            </h2>
          </div>
          <div className="flex gap-3">
            {showGenerateButton && (
              <button
                onClick={() => onGenerateNew()}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-cta hover:bg-cta-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cta transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {t('weeklyPlan.overview.generateNew')}
              </button>
            )}
          </div>
        </div>

        {/* Weather Forecast Block — summary text + stale alert + refresh + assessment result */}
        {plan.weatherDays && plan.weatherDays.length > 0 ? (
          <div className="mt-4 bg-accent-surface border border-accent rounded-lg p-4">
            <div className="text-xs font-semibold text-accent-text mb-2 uppercase tracking-wide">{weatherHeaderLabel(plan.weekStart, plan.weekNumber, t)}</div>

            {/* Stale alert — prompt to refresh */}
            {weatherStaleAlert && !weatherAssessment && (
              <div className="mb-3 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                <span className="text-amber-500 flex-shrink-0">⏱</span>
                <p className="text-xs text-amber-800 flex-1">{weatherStaleAlert}</p>
                {onRefreshWeather && (
                  <button
                    onClick={onRefreshWeather}
                    disabled={refreshingWeather}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 transition-colors disabled:opacity-60 flex-shrink-0"
                  >
                    {refreshingWeather ? (
                      <><span className="animate-spin inline-block">↻</span> {t('weeklyPlan.weather.updating')}</>
                    ) : (
                      <>{t('weeklyPlan.weather.updateBtn')}</>
                    )}
                  </button>
                )}
              </div>
            )}

            <div className="flex items-start gap-3">
              <p className="text-xs text-accent-text leading-relaxed flex-1">
                {weekWeatherSummary(plan.weatherDays, t)}
              </p>
              {onRefreshWeather && !weatherStaleAlert && (
                <button
                  onClick={onRefreshWeather}
                  disabled={refreshingWeather}
                  title="Opdater vejrudsigt"
                  className="flex-shrink-0 text-accent-text opacity-60 hover:opacity-100 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity mt-0.5"
                >
                  <svg className={`w-3.5 h-3.5 ${refreshingWeather ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              )}
            </div>

            {/* Weather assessment result — shown after refresh */}
            {weatherAssessment && (
              <div className={`mt-3 rounded-md px-3 py-2 border flex items-center gap-2 ${
                weatherAssessment.impactedPosts.length > 0
                  ? 'bg-orange-50 border-orange-200'
                  : weatherAssessment.changed
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-green-50 border-green-200'
              }`}>
                <span className="text-base flex-shrink-0">
                  {weatherAssessment.impactedPosts.length > 0 ? '⚠️' : weatherAssessment.changed ? '🔄' : '✅'}
                </span>
                <div className="flex-1 min-w-0 text-xs">
                  {!weatherAssessment.changed && (
                    <p className="text-green-800 font-medium">{t('weeklyPlan.weather.noChange')}</p>
                  )}
                  {weatherAssessment.changed && weatherAssessment.impactedPosts.length === 0 && (
                    <p className="text-yellow-800 font-medium">{t('weeklyPlan.weather.changedNoImpact')}</p>
                  )}
                  {weatherAssessment.impactedPosts.length > 0 && (
                    <>
                      <p className="text-orange-800 font-medium">
                        {t('weeklyPlan.weather.changedImpact', { count: weatherAssessment.impactedPosts.length, posts: weatherAssessment.impactedPosts.join(' · ') })}
                      </p>
                      <p className="text-orange-700 mt-0.5">{t('weeklyPlan.weather.considerNew')}</p>
                      {onGenerateNewPlan && (
                        <button
                          onClick={onGenerateNewPlan}
                          className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-orange-100 hover:bg-orange-200 text-orange-900 border border-orange-300 transition-colors"
                        >
                          {t('weeklyPlan.weather.generateNewBtn')}
                        </button>
                      )}
                    </>
                  )}
                </div>
                {onDismissWeatherAssessment && (
                  <button onClick={onDismissWeatherAssessment} className="text-gray-400 hover:text-gray-600 flex-shrink-0 text-base leading-none">×</button>
                )}
              </div>
            )}
          </div>
        ) : null}

        {/* Strategic Rationale — WHY this content mix */}
        {plan.strategicRationale && (
          <div className="mt-4 bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-purple-900 mb-1.5 uppercase tracking-wide">
                  {t('weeklyPlan.overview.strategicRationale.title', 'Ugens Strategi')}
                </div>
                <p className="text-sm text-purple-800 leading-relaxed">
                  {plan.strategicRationale}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Strategy Narrative */}
        {plan.strategyNarrative ? (
          <div className="mt-4 bg-cta-surface border border-cta rounded-lg p-4">
            <div className="text-sm font-semibold text-cta-text mb-1">{stripWeekPrefix(plan.strategyNarrative.headline)}</div>
            <ul className="text-sm text-cta-text leading-relaxed space-y-1">
              {(plan.strategyNarrative.overview.includes('\n')
                ? plan.strategyNarrative.overview.split('\n')
                : plan.strategyNarrative.overview.split(/(?<=[.!?])\s+(?=[A-ZÆØÅ])/)
              ).map(s => s.replace(/^•\s*/, '').trim()).filter(Boolean).map((line, i) => (
                <li key={i} className="flex gap-2"><span className="shrink-0">•</span><span>{line}</span></li>
              ))}
            </ul>
            {plan.strategyNarrative.continuation_note && (
              <div className="mt-3 flex items-start gap-2 bg-cta-surface rounded-md px-3 py-2">
                <svg className="w-3.5 h-3.5 text-cta shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
                <p className="text-xs text-cta-text font-medium leading-snug">
                  {plan.strategyNarrative.continuation_note
                    ?.replace(/forrige uge/gi, 'sidste uge')
                    .replace(/^sidste uge/i, (m) => m.charAt(0).toUpperCase() + m.slice(1))}
                </p>
              </div>
            )}
            {plan.strategyNarrative.strategy_reasoning?.primary_angle && (
              <p className="mt-2 text-xs text-cta font-medium">
                {t('weeklyPlan.overview.focusLabel')} {plan.strategyNarrative.strategy_reasoning.primary_angle}
              </p>
            )}
          </div>
        ) : null}

        {/* Hidden summary stats — kept for legacy compatibility */}
        <div className="hidden">
          <div className="bg-gradient-to-br from-cta-surface to-purple-50 rounded-lg p-4 border border-cta-surface">
            <div className="text-sm font-medium text-brand flex items-center">
              <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
              </svg>
              AI Generation
            </div>
            <div className="mt-2 space-y-1">
              {(() => {
                const aiPosts = plan.posts.filter(p => p.caption.isAIGenerated).length
                const totalPosts = plan.posts.length
                const percentage = totalPosts > 0 ? Math.round((aiPosts / totalPosts) * 100) : 0
                return (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-700">AI Captions</span>
                      <span className="font-semibold text-brand">{aiPosts}/{totalPosts}</span>
                    </div>
                    <div className="w-full bg-white rounded-full h-2 mt-1">
                      <div 
                        className="bg-gradient-to-r from-cta to-purple-500 h-2 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-cta-text font-medium mt-1">{percentage}% AI-genereret</div>
                  </>
                )
              })()}
            </div>
          </div>
        </div>
      </div>
      {/* end hidden */}

      {/* 7-day list — Mon to Sun, one row per day with weather + post (or empty placeholder) */}
      {(() => {
        // Robust date normalizer: extracts YYYY, M, D from any reasonable date string
        // and zero-pads to produce a consistent "YYYY-MM-DD" key.
        const toYMD = (s: string): string => {
          if (!s) return ''
          const m = String(s).match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
          if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
          // Fallback: try Date parsing (handles "March 23, 2026" etc.)
          const d = new Date(s)
          if (!isNaN(d.getTime())) {
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
          }
          return s.substring(0, 10)
        }

        // Build a map of date → post using normalized YYYY-MM-DD keys
        const postByDate = new Map<string, PostSpecification>()
        
        plan.posts.forEach(p => {
          const key = toYMD(p.timing.date ?? '')
          if (key) {
            postByDate.set(key, p)
          }
        })

        // Build array of the 7 dates starting from Monday of the week that contains the plan's posts.
        const allKnownDates = [
          ...plan.posts.map(p => toYMD(p.timing.date ?? '')),
          ...(plan.weatherDays ?? []).map(w => toYMD(w.date ?? '')),
        ].filter(Boolean).sort()
        const anchorStr = allKnownDates[0] ?? toYMD(plan.weekStart)
        const [ay, am, ad] = anchorStr.split('-').map(Number)
        const anchorDate = new Date(ay, am - 1, ad)
        // Rewind to Monday
        const daysToMonday = (anchorDate.getDay() + 6) % 7
        anchorDate.setDate(anchorDate.getDate() - daysToMonday)
        const days = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate() + i)
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        })

        // Build a map of date → weatherDay using the same normalizer
        const weatherByDate = new Map<string, NonNullable<typeof plan.weatherDays>[number]>()
        ;(plan.weatherDays ?? []).forEach(w => weatherByDate.set(toYMD(w.date ?? ''), w))

        // Calendar event badge helpers
        const EVENT_BADGE_COLORS: Record<string, string> = {
          holiday: 'bg-accent-surface text-accent-text',
          school_vacation: 'bg-accent-surface text-accent-text',
          cultural: 'bg-accent-surface text-accent-text',
          occasion: 'bg-accent-surface text-accent-text',
          local: 'bg-accent-surface text-accent-text',
        }
        const eventsOnDay = (dateStr: string) =>
          (plan.calendarEvents ?? [])
            .filter(e =>
              e.date_end ? e.date <= dateStr && e.date_end >= dateStr : e.date === dateStr
            )
            // Multi-day spans (e.g. Påskeferie) always appear before single-day events
            .sort((a, b) => (a.date_end ? 0 : 1) - (b.date_end ? 0 : 1))

        const DAY_LABELS = t('weeklyPlan.overview.dayLabels', { returnObjects: true }) as string[]

        return (
          <div className="flex flex-col gap-2">
            {days.map((dateStr, dayIdx) => {
              const post = postByDate.get(dateStr)
              const weather = weatherByDate.get(dateStr)
              const dayNum = parseInt(dateStr.split('-')[2], 10)
              const dayLabel = DAY_LABELS[dayIdx]

              // Weather mini-column (icon + temp, or blank)
              const weatherCol = (
                <div className="flex-shrink-0 w-12 flex flex-col items-center justify-center text-center">
                  {weather ? (
                    <>
                      <WeatherIcon condition={weather.condition} className="w-5 h-5 text-text" />
                      <span className="text-[10px] font-semibold text-slate-600 mt-0.5">{Math.round(weather.temp_max)}°</span>
                      {/* Show precipitation % only on actual rain/snow days */}
                      {(weather.condition === 'rain' || weather.condition === 'snow') && (
                        <span className="text-[9px] text-blue-400">💧{weather.precipitation_chance}%</span>
                      )}
                    </>
                  ) : null}
                </div>
              )

              if (!post) {
                // Empty day row
                return (
                  <div
                    key={dateStr}
                    className="bg-white rounded-lg border border-slate-100 px-4 py-3"
                  >
                    <div className="flex items-center gap-4">
                      {/* Day / date */}
                      <div className="flex-shrink-0 w-16 text-center">
                        <div className="text-[11px] font-semibold text-slate-400 uppercase leading-none">{dayLabel} {dayNum}</div>
                      </div>
                      {/* Vertical divider */}
                      <div className="w-px self-stretch bg-slate-100 flex-shrink-0" />
                      {/* Weather */}
                      {weatherCol}
                      {/* Placeholder */}
                      <div className="flex-1 text-xs text-slate-300 italic">{t('weeklyPlan.overview.noPostsPlanned')}</div>
                    </div>
                    {eventsOnDay(dateStr).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {eventsOnDay(dateStr).map(ev => (
                          <span
                            key={ev.name}
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-medium leading-none ${EVENT_BADGE_COLORS[ev.type] ?? 'bg-slate-100 text-slate-600'}`}
                          >
                            {t(`calendarEvent.${ev.name}`, ev.name)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              }

              // Day with a post
              const statusBadge = getStatusBadge(post.approval.status, t)
              const postDateTime = new Date(`${post.timing.date}T${post.timing.time}`)
              const isPast = postDateTime < new Date()
              const rawIndex = plan.posts.findIndex(
                p => p.timing.date === post.timing.date && p.timing.time === post.timing.time
              )
              const isSessionDone = rawIndex >= 0 && sessionDoneIndices.includes(rawIndex)
              const hasCreatedPost = post.idea_id != null && weeklyPlanPostMap.has(Number(post.idea_id))
              const createdPostInfo = hasCreatedPost ? weeklyPlanPostMap.get(Number(post.idea_id)) : undefined
              const isLocked = post.idea_id != null && lockedIdeaIds.has(Number(post.idea_id)) && !hasCreatedPost

              return (
                <div
                  key={dateStr}
                  role="button"
                  tabIndex={0}
                  onClick={() => onPostClick(post)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onPostClick(post)}
                  className={`bg-white rounded-lg border px-4 py-3 hover:shadow-sm transition-all text-left cursor-pointer ${
                    isLocked
                      ? 'border-slate-300 bg-slate-50/70'
                      : hasCreatedPost || isSessionDone
                      ? 'border-green-300 bg-green-50/30'
                      : isPast
                        ? 'border-orange-300 bg-orange-50/30'
                        : 'border-slate-200 hover:border-cta'
                  }`}
                >
                  <div className="flex items-center gap-4">
                  {/* Day / Time */}
                  <div className="flex-shrink-0 w-16 text-center">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase leading-none">{dayLabel} {dayNum}</div>
                    <div className="text-base font-bold text-slate-900 mt-0.5">{post.timing.time}</div>
                    {post.timing.rationale && (
                      <div className="text-[9px] text-purple-600 font-medium mt-1 leading-tight" title={post.timing.rationale}>
                        🧠 AI
                      </div>
                    )}
                  </div>

                  {/* Vertical divider */}
                  <div className="w-px self-stretch bg-slate-200 flex-shrink-0" />

                  {/* Weather */}
                  {weatherCol}

                  {/* Vertical divider */}
                  <div className="w-px self-stretch bg-slate-200 flex-shrink-0" />

                  {/* Content type icon */}
                  {(() => {
                    const iconType = getContentIconType(post)
                    return (
                      <ContentTypeIcon
                        contentType={iconType}
                        className={getContentIconClass(iconType)}
                      />
                    )
                  })()}

                  {/* Title + meta */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{post.contentSubject.dish?.replace(/\.+$/, '')}</div>
                  </div>

                  {/* Chips */}
                  <div className="flex-shrink-0 flex items-center gap-2">
                    {post.strategicContext?.slot_id && (
                      <span 
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white"
                        title={post.strategicContext.strategic_intent || `Strategic Slot ${post.strategicContext.slot_id}`}
                      >
                        #{post.strategicContext.slot_id}
                      </span>
                    )}
                    {hasCreatedPost && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-600 text-white">✓ {t('weeklyPlan.overview.createdBadge', { defaultValue: 'Lavet' })}</span>
                    )}
                    {isLocked && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200 text-slate-700">{t('weeklyPlan.overview.lockedBadge', { defaultValue: 'Låst' })}</span>
                    )}
                    {!isLocked && !hasCreatedPost && isSessionDone && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-600 text-white">{t('weeklyPlan.overview.doneBadge')}</span>
                    )}
                    {isPast && !isSessionDone && !isLocked && !hasCreatedPost && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-500 text-white">{t('weeklyPlan.overview.pastBadge')}</span>
                    )}
                    {post.strategicContext?.owner_note_applied && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">{t('weeklyPlan.overview.ownerNoteBadge')}</span>
                    )}
                    {post.strategicContext?.drink_pairing && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 text-purple-700">🍸 {post.strategicContext.drink_pairing}</span>
                    )}
                    {post.caption.ctaType && (() => {
                      const chip = getCTAChip(post.caption.ctaType, t)
                      return (
                        <span className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${chip.classes}`}>
                          {chip.label}
                        </span>
                      )
                    })()}
                    {post.caption.isAIGenerated && (
                      <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gradient-to-r from-cta to-purple-500 text-white">✦ AI</span>
                    )}
                  </div>

                  {/* Production time + status */}
                  <div className="flex-shrink-0 hidden md:flex flex-col items-end gap-1 w-28">
                    <div className="text-[11px] text-slate-500">⏱ {post.productionNotes.estimatedTime}</div>
                    <div className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusBadge.color}`}>{statusBadge.text}</div>
                  </div>

                  {/* Action button */}
                  {onCreatePost && (
                    <div className="flex-shrink-0">
                      <button
                        onClick={(e) => { 
                          e.stopPropagation()
                          if (hasCreatedPost) {
                            // Navigate to calendar when post has been created
                            navigate('/dashboard/calendar')
                          } else if (!isLocked) {
                            onCreatePost(post)
                          }
                        }}
                        disabled={isLocked}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                          isLocked
                            ? 'text-slate-500 bg-slate-200 cursor-not-allowed'
                            : hasCreatedPost
                            ? 'text-white bg-green-600 hover:bg-green-700'
                            : 'text-white bg-cta hover:bg-cta-hover'
                        }`}
                      >
                        {isLocked 
                          ? t('weeklyPlan.overview.lockedButton', { defaultValue: 'Låst' })
                          : hasCreatedPost
                          ? t('weeklyPlan.overview.goToPost', { defaultValue: 'Gå til opslag →' })
                          : t('weeklyPlan.overview.createPost')
                        }
                      </button>
                    </div>
                  )}
                  </div>
                  {eventsOnDay(dateStr).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {eventsOnDay(dateStr).map(ev => (
                        <span
                          key={ev.name}
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-medium leading-none ${EVENT_BADGE_COLORS[ev.type] ?? 'bg-slate-100 text-slate-600'}`}
                        >
                          {t(`calendarEvent.${ev.name}`, ev.name)}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  {/* Booking Nudge Context Block (FIX B) */}
                  {(() => {
                    const isBookingNudge = 
                      post.postType?.category === 'booking_nudge' || 
                      (post.strategicContext?.cta_intent === 'booking' && post.strategicContext?.nudge_rationale)
                    
                    if (!isBookingNudge) return null
                    
                    return (
                      <div className="mt-2 pl-3 py-2 bg-amber-50 border-l-2 border-teal-600 rounded-r-md">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-teal-700 mb-1">
                          <span>📅</span>
                          <span>
                            Booking nudge
                            {post.strategicContext?.peak_day && (
                              <> → {formatNudgeTargetDay(post.strategicContext.peak_day, post.strategicContext.lead_days_used)}</>
                            )}
                          </span>
                        </div>
                        {post.strategicContext?.nudge_rationale && (
                          <p className="text-xs text-gray-500 m-0 leading-snug">
                            {post.strategicContext.nudge_rationale}
                          </p>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* Info Footer */}
      <div className="bg-accent-surface border border-accent rounded-lg p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-accent-text" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-accent-text">
              {t('weeklyPlan.overview.tip')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
