'use client'

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../../stores/authStore'
import { supabase } from '../../../lib/supabase'
import { WeeklyPlanOverview } from '../../../components/weekly-plan/WeeklyPlanOverview'
import { PostDetailModal } from '../../../components/weekly-plan/PostDetailModal'
import { usePostCreationStore } from '../../../stores/postCreationStore'
import type { WeeklyContentPlan, PostSpecification } from '../../../types/weekly-plan'

export default function AIWeeklyPlanPage() {
  const { t } = useTranslation(undefined, { keyPrefix: 'weeklyPlan' })
  const user = useAuthStore((state) => state.user)
  const navigate = useNavigate()
  const { setActivePath, setStrategicIdea, setWeeklyPlanPost, setWeeklyContentPlan, setWeeklyPlanPostIndex, setWeeklyPlanStep, weeklyPlanSessionDone, weeklyPlanStep, weeklyPlanPost } = usePostCreationStore()
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyContentPlan | null>(null)
  const [selectedPost, setSelectedPost] = useState<PostSpecification | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [existingPlanFound, setExistingPlanFound] = useState(false)
  const [showRegenerateWarning, setShowRegenerateWarning] = useState(false)
  const [ownerNote, setOwnerNote] = useState('')

  // Format a Date as local YYYY-MM-DD (avoids UTC shift for CET users)
  const toLocalISO = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  // Get week start: NEXT Monday (always plan one week ahead, matching WeeklyStrategyPage)
  const getCurrentWeekStart = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    // Roll forward to next Monday: +((1 + 7 - getDay()) % 7 || 7)
    // This never returns today, even if today is Monday.
    today.setDate(today.getDate() + ((1 + 7 - today.getDay()) % 7 || 7))
    return today
  }

  // Get this ISO week's Monday (roll back to most recent Monday)
  const getThisWeekMonday = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const daysToMonday = (today.getDay() + 6) % 7 // 0 on Mon, 6 on Sun
    today.setDate(today.getDate() - daysToMonday)
    return today
  }

  const [currentWeekStart] = useState(getCurrentWeekStart) // next Monday
  const [thisWeekStart] = useState(getThisWeekMonday)      // this Monday
  const [viewingWeek, setViewingWeek] = useState<'current' | 'next'>('next')
  const [weatherStaleAlert, setWeatherStaleAlert] = useState<string | null>(null)
  const [refreshingWeather, setRefreshingWeather] = useState(false)
  // Tracks plan IDs where auto-weather-refresh has been triggered this session
  // (prevents double-triggering if the effect fires more than once before the async refresh completes)
  const autoRefreshedPlansRef = useRef(new Set<string>())
  const [weatherAssessment, setWeatherAssessment] = useState<{
    changed: boolean
    impactedPosts: string[]
  } | null>(null)

  // Load existing plan or generate new
  useEffect(() => {
    if (user) {
      loadOrGeneratePlan()
    }
  }, [user])

  // Auto-refresh weather when viewing next week on Thu/Fri/Sat/Sun and a plan is loaded.
  // Falls back to showing the manual-refresh alert only if auto-trigger is already in-flight.
  useEffect(() => {
    if (!weeklyPlan || viewingWeek !== 'next') { setWeatherStaleAlert(null); setWeatherAssessment(null); return }
    // If the user already refreshed weather for this plan in this session, skip entirely.
    const alreadyRefreshed = sessionStorage.getItem(`weather_refreshed_${weeklyPlan.id}`) !== null
    if (alreadyRefreshed) return
    const day = new Date().getDay()
    if (day === 4 || day === 5 || day === 6 || day === 0) {
      // Guard against double-triggering when the effect fires more than once
      if (autoRefreshedPlansRef.current.has(String(weeklyPlan.id))) return
      autoRefreshedPlansRef.current.add(String(weeklyPlan.id))
      // Auto-refresh silently — setTimeout 0 ensures handleRefreshWeather is in scope
      setTimeout(() => handleRefreshWeather(), 0)
    } else {
      setWeatherStaleAlert(null)
      setWeatherAssessment(null)
    }
  }, [weeklyPlan?.id, viewingWeek])

  // Look up strategy + weather + context summary by business + week
  const fetchStrategyData = async (businessId: string, weekStart: string): Promise<{
    narrative?: { headline: string; overview: string; strategy_reasoning?: { primary_angle: string } }
    weatherDays?: { date: string; temp_min: number; temp_max: number; condition: 'sunny' | 'partly_cloudy' | 'cloudy' | 'rain' | 'snow' | 'fog'; precipitation_chance: number; wind_speed: number }[]
    weekSummary?: { archetype?: string; primaryOccasion?: string; weatherOpportunity?: string; economicSignal?: string; topPriority?: string }
    calendarEvents?: { name: string; date: string; date_end: string | null; type: string; commercial_weight: number | null }[]
  }> => {
    const { data: strat } = await supabase
      .from('weekly_strategies')
      .select('narrative, week_context_snapshot')
      .eq('business_id', businessId)
      .eq('week_start', weekStart)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const narrative = strat?.narrative as { headline: string; overview: string; strategy_reasoning?: { primary_angle: string } } | undefined
    const ctx = strat?.week_context_snapshot as any
    const weatherDays = ctx?.weather?.days as { date: string; temp_min: number; temp_max: number; condition: 'sunny' | 'partly_cloudy' | 'cloudy' | 'rain' | 'snow' | 'fog'; precipitation_chance: number; wind_speed: number }[] | undefined
    const weekSummary = ctx ? {
      archetype: ctx.business_archetype as string | undefined,
      primaryOccasion: (ctx.core_guest_occasions as any[] | undefined)?.find((o: any) => o.primary)?.occasion as string | undefined,
      weatherOpportunity: ctx.week_modifiers?.weather_opportunity as string | undefined,
      economicSignal: ctx.week_modifiers?.economic_signal as string | undefined,
      topPriority: (ctx.strategic_priority_candidates as string[] | undefined)?.[0],
    } : undefined
    // Compute the last day of the 7-day week
    const [wy, wm, wd] = weekStart.split('-').map(Number)
    const wEndDate = new Date(wy, wm - 1, wd + 6)
    const weekEnd = `${wEndDate.getFullYear()}-${String(wEndDate.getMonth() + 1).padStart(2, '0')}-${String(wEndDate.getDate()).padStart(2, '0')}`
    // Live query — always reflects current calendar, never stale from snapshot
    const { data: calData } = await (supabase as any)
      .from('contextual_calendar')
      .select('event_name, event_type, date_start, date_end, commercial_weight')
      .eq('country', 'DK')
      .lte('date_start', weekEnd)
      .or(`date_end.is.null,date_end.gte.${weekStart}`)
      .not('event_type', 'in', '(season_change,business_rhythm)')
    const calendarEvents = (calData as any[] | null)?.map((e: any) => ({
      name: e.event_name as string,
      date: e.date_start as string,
      date_end: (e.date_end as string | null) ?? null,
      type: e.event_type as string,
      commercial_weight: (e.commercial_weight as number | null) ?? null,
    })) ?? undefined
    return { narrative, weatherDays, weekSummary, calendarEvents }
  }

  // Fetch saved plan row for a given week (or null if none)
  const fetchExistingPlan = async (weekStr?: string): Promise<any | null> => {
    const weekStartISO = weekStr ?? toLocalISO(currentWeekStart)
    const { data, error } = await supabase
      .from('weekly_content_plans')
      .select('*')
      .eq('user_id', user!.id)
      .eq('week_start', weekStartISO)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) console.error('fetchExistingPlan error:', error)
    return data && !error ? data : null
  }

  // Hydrate state from a DB plan row — fetches strategy data then calls setWeeklyPlan
  const hydrateWeeklyPlan = async (row: any): Promise<void> => {
    const strategyData = await fetchStrategyData(row.business_id, row.week_start)
    setWeeklyPlan({
      id: row.id,
      userId: row.user_id,
      businessId: row.business_id,
      weekNumber: row.week_number,
      weekStart: row.week_start,
      weekEnd: row.week_end,
      generatedAt: row.generated_at,
      posts: row.posts,
      summary: row.summary,
      learningData: row.learning_data,
      strategyId: row.strategy_id,
      strategyNarrative: strategyData.narrative,
      weatherDays: strategyData.weatherDays,
      weekSummary: strategyData.weekSummary,
      calendarEvents: strategyData.calendarEvents,
    })
  }

  const loadOrGeneratePlan = async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const row = await fetchExistingPlan()
      if (row) {
        setExistingPlanFound(true)
        await hydrateWeeklyPlan(row)
      } else {
        setExistingPlanFound(false)
      }
    } catch (err) {
      console.error('Error checking for existing plan:', err)
      setExistingPlanFound(false)
    } finally {
      setLoading(false)
    }
  }

  const loadExistingPlan = async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    const weekStr = viewingWeek === 'next' ? toLocalISO(currentWeekStart) : toLocalISO(thisWeekStart)
    try {
      const row = await fetchExistingPlan(weekStr)
      if (row) {
        await hydrateWeeklyPlan(row)
      } else {
        setError(t('errors.noExistingPlan'))
      }
    } catch (err) {
      console.error('Error loading existing plan:', err)
      setError(t('errors.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  // Switch between viewing this week or next week — loads the plan for the target week
  const handleViewingWeekChange = async (week: 'current' | 'next') => {
    if (week === viewingWeek) return
    setViewingWeek(week)
    setWeeklyPlan(null)
    setError(null)
    setWeatherStaleAlert(null)
    setWeatherAssessment(null)
    setLoading(true)
    const weekStr = week === 'next' ? toLocalISO(currentWeekStart) : toLocalISO(thisWeekStart)
    try {
      const row = await fetchExistingPlan(weekStr)
      if (row) {
        setExistingPlanFound(true)
        await hydrateWeeklyPlan(row)
      } else {
        setExistingPlanFound(false)
      }
    } catch (err) {
      console.error('Error loading plan for week:', err)
      setExistingPlanFound(false)
    } finally {
      setLoading(false)
    }
  }

  // Refresh weather for the currently displayed plan week directly from Open-Meteo
  const handleRefreshWeather = async () => {
    if (!weeklyPlan || refreshingWeather) return
    setRefreshingWeather(true)
    try {
      const { data: locData } = await (supabase as any)
        .from('business_location_intelligence')
        .select('latitude, longitude')
        .eq('business_id', weeklyPlan.businessId)
        .maybeSingle()
      if (!locData?.latitude || !locData?.longitude) return
      const lat = Number(locData.latitude)
      const lon = Number(locData.longitude)
      const activeStartStr = viewingWeek === 'next' ? toLocalISO(currentWeekStart) : toLocalISO(thisWeekStart)
      const [wy, wm, wd] = activeStartStr.split('-').map(Number)
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&daily=weathercode,temperature_2m_max,temperature_2m_min,apparent_temperature_mean,precipitation_probability_max,windspeed_10m_max` +
        `&timezone=Europe%2FCopenhagen&forecast_days=16&wind_speed_unit=ms`
      const resp = await fetch(url)
      if (!resp.ok) throw new Error(`Open-Meteo: ${resp.status}`)
      const json = await resp.json()
      const daily = json.daily ?? {}
      const times: string[] = daily.time ?? []
      const dateMap = new Map<string, { wmo: number; maxT: number; minT: number; feelsLike: number; precipProb: number; wind: number }>()
      times.forEach((date: string, i: number) => {
        dateMap.set(date, {
          wmo: (daily.weathercode?.[i] ?? 3) as number,
          maxT: Math.round((daily.temperature_2m_max?.[i] ?? 10) as number),
          minT: Math.round((daily.temperature_2m_min?.[i] ?? 5) as number),
          feelsLike: Math.round((daily.apparent_temperature_mean?.[i] ?? 8) as number),
          precipProb: Math.round((daily.precipitation_probability_max?.[i] ?? 25) as number),
          wind: Math.round((daily.windspeed_10m_max?.[i] ?? 4) as number),
        })
      })
      const mapWMO = (wmo: number): string => {
        if (wmo === 0) return 'sunny'
        if (wmo <= 2) return 'partly_cloudy'
        if (wmo === 3) return 'cloudy'
        if (wmo === 45 || wmo === 48) return 'fog'
        if (wmo >= 51 && wmo <= 67) return 'rain'
        if (wmo >= 71 && wmo <= 77) return 'snow'
        if (wmo >= 80 && wmo <= 82) return 'rain'
        if (wmo >= 85 && wmo <= 86) return 'snow'
        if (wmo >= 95) return 'rain'
        return 'cloudy'
      }
      // Build week date list (use all 7 days regardless of open/closed)
      const weekDates: string[] = []
      for (let i = 0; i < 7; i++) {
        const dt = new Date(wy, wm - 1, wd + i)
        weekDates.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`)
      }
      const oldDays = weeklyPlan.weatherDays ?? []
      const updatedDays = oldDays.map((day) => {
        const d = dateMap.get(day.date)
        if (!d) return day
        return { ...day, temp_min: d.minT, temp_max: d.maxT, condition: mapWMO(d.wmo) as any, precipitation_chance: d.precipProb, wind_speed: d.wind }
      })

      // ── Weather change assessment ────────────────────────────────────────
      // Classify conditions into good/bad buckets for meaningful comparison.
      const isGood = (c: string) => c === 'sunny' || c === 'partly_cloudy'
      const isBad  = (c: string) => c === 'rain' || c === 'snow' || c === 'fog'

      // Find days where the quality bucket flipped (good↔bad), ignoring cloudy↔cloudy noise.
      const flippedDates = new Set<string>()
      updatedDays.forEach((newDay) => {
        const old = oldDays.find(o => o.date === newDay.date)
        if (!old) return
        const wasGood = isGood(old.condition), wasB = isBad(old.condition)
        const nowGood = isGood(newDay.condition), nowB = isBad(newDay.condition)
        if ((wasGood && nowB) || (wasB && nowGood)) flippedDates.add(newDay.date)
      })

      // Check if any posts fall on a flipped date AND are weather-sensitive.
      const OUTDOOR_KW = ['udend', 'terrasse', 'udeserv', 'solskin', 'soldag', 'cejtlig', 'udeplace', 'outdoor']
      const impactedPosts: string[] = []
      if (flippedDates.size > 0) {
        ;(weeklyPlan.posts as any[]).forEach((post: any) => {
          const postDate: string = post.timing?.date ?? ''
          if (!postDate || !flippedDates.has(postDate)) return
          const isWeatherDep = post.strategicContext?.weather_dependent === true
          const title: string = (post.contentSubject?.dish ?? post.caption?.text ?? '').toLowerCase()
          const hook: string  = (post.caption?.firstLine ?? '').toLowerCase()
          const hasOutdoorKw  = OUTDOOR_KW.some(kw => title.includes(kw) || hook.includes(kw))
          if (isWeatherDep || hasOutdoorKw) {
            const label = post.contentSubject?.dish || post.timing?.day || postDate
            impactedPosts.push(label)
          }
        })
      }

      const changed = flippedDates.size > 0
      setWeatherAssessment({ changed, impactedPosts })
      setWeeklyPlan({ ...weeklyPlan, weatherDays: updatedDays })
      setWeatherStaleAlert(null)
      // Remember that weather was refreshed for this plan so the stale alert
      // doesn't reappear if the user navigates away and comes back.
      sessionStorage.setItem(`weather_refreshed_${weeklyPlan.id}`, Date.now().toString())
    } catch (err) {
      console.error('Weather refresh failed:', err)
    } finally {
      setRefreshingWeather(false)
    }
  }

  const generateNewPlan = async (forceRegenerate = false) => {
    if (!user) return

    // If existing plan found and not forcing, show warning
    if (existingPlanFound && !forceRegenerate) {
      setShowRegenerateWarning(true)
      return
    }

    setGenerating(true)
    setError(null)
    setShowRegenerateWarning(false)

    try {
      // Get current session to ensure we have a valid token
      const { data: { session } } = await supabase.auth.getSession()
      console.log('Session check:', session ? 'Valid session' : 'No session')
      
      if (!session) {
        throw new Error('No active session. Please log in again.')
      }

      const weekStartLocal = viewingWeek === 'next' ? toLocalISO(currentWeekStart) : toLocalISO(thisWeekStart)

      // Step 1: Fetch business_id for this user
      const { data: bizData } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_id', user.id)
        .limit(1)
        .single()
      
      // Step 2: Generate (or fetch cached) weekly strategy first — this produces strategic context
      //         for the plan. Returns 202 + status:'pending' while generation runs in background.
      //         We poll weekly_strategies until status='generated' before proceeding.
      let strategyId: string | undefined
      if (bizData?.id) {
        console.log('Calling get-weekly-strategy...')
        try {
          const strategyResponse = await fetch(`${(supabase as any).supabaseUrl}/functions/v1/get-weekly-strategy`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              business_id: bizData.id,
              week_start: weekStartLocal,
              regenerate: forceRegenerate,
              owner_note: ownerNote.trim() || undefined,
            }),
          })

          if (strategyResponse.ok) {
            const strategyData = await strategyResponse.json()
            strategyId = strategyData.strategy_id

            if (strategyData.status === 'pending' && strategyId) {
              // Generation is running in background — poll weekly_strategies row for completion
              console.log('Strategy generation pending, polling for completion...', strategyId)
              // 8-minute ceiling: strategy gen = Phase 0→1→2a→2b→2c (sequential AI calls, ~4–7 min)
              const MAX_WAIT_MS = 8 * 60 * 1000
              // Adaptive backoff: start at 3 s, grow +2 s each pending poll, cap at 12 s.
              // 90-second generation → ~12 polls instead of 30 at flat 3 s.
              const POLL_INITIAL_MS = 3_000
              const POLL_MAX_MS    = 12_000
              const POLL_STEP_MS   = 2_000
              let pollInterval = POLL_INITIAL_MS
              const started = Date.now()

              await new Promise<void>((resolve) => {
                let retriedOnError = false
                const checkStatus = async () => {
                  if (Date.now() - started > MAX_WAIT_MS) {
                    // 8 minutes elapsed with no completion — background task likely timed out.
                    // Trigger a forced regenerate so the stale-pending detection resets it
                    // and a fresh generation starts. Then poll once more for up to 5 min.
                    console.warn('Strategy polling timeout after 8 min — triggering forced regenerate')
                    try {
                      const { data: { session: freshSession } } = await supabase.auth.getSession()
                      const retryResp = await fetch(`${(supabase as any).supabaseUrl}/functions/v1/get-weekly-strategy`, {
                        method: 'POST',
                        headers: {
                          'Authorization': `Bearer ${freshSession?.access_token}`,
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          business_id: bizData!.id,
                          week_start: weekStartLocal,
                          regenerate: true,
                          owner_note: ownerNote.trim() || undefined,
                        }),
                      })
                      if (retryResp.ok) {
                        const retryData = await retryResp.json()
                        if (retryData.strategy_id) {
                          strategyId = retryData.strategy_id
                          console.log('Retry started fresh strategy:', strategyId)
                          // Give the fresh generation up to 5 more minutes
                          const retryStart = Date.now()
                          const retryMax = 5 * 60 * 1000
                          const checkRetry = async () => {
                            if (Date.now() - retryStart > retryMax) {
                              console.warn('Retry strategy poll also timed out')
                              strategyId = undefined
                              resolve()
                              return
                            }
                            const { data: sr } = await supabase
                              .from('weekly_strategies')
                              .select('id, status')
                              .eq('id', strategyId!)
                              .single()
                            if (sr?.status === 'generated') { console.log('Strategy ready (retry):', strategyId); resolve() }
                            else if (sr?.status === 'error') { strategyId = undefined; resolve() }
                            else { setTimeout(checkRetry, POLL_INITIAL_MS) }
                          }
                          checkRetry()
                          return
                        }
                      }
                    } catch (retryErr) {
                      console.warn('Forced-regenerate retry failed:', retryErr)
                    }
                    strategyId = undefined
                    resolve()
                    return
                  }
                  const { data: stratRow } = await supabase
                    .from('weekly_strategies')
                    .select('id, status')   // strategy_rationale only fetched on error
                    .eq('id', strategyId!)
                    .single()

                  if (stratRow?.status === 'generated') {
                    console.log('Strategy ready:', strategyId)
                    resolve()
                  } else if (stratRow?.status === 'error') {
                    const { data: errRow } = await supabase
                      .from('weekly_strategies')
                      .select('strategy_rationale')
                      .eq('id', strategyId!)
                      .single()
                    const errDetail = errRow?.strategy_rationale || 'unknown'
                    console.warn('Strategy generation error — details:', errDetail)
                    if (!retriedOnError) {
                      retriedOnError = true
                      console.warn('Retrying strategy generation with regenerate:true...')
                      try {
                        const { data: { session: freshSession } } = await supabase.auth.getSession()
                        const retryResp = await fetch(`${(supabase as any).supabaseUrl}/functions/v1/get-weekly-strategy`, {
                          method: 'POST',
                          headers: {
                            'Authorization': `Bearer ${freshSession?.access_token}`,
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            business_id: bizData!.id,
                            week_start: weekStartLocal,
                            regenerate: true,
                            owner_note: ownerNote.trim() || undefined,
                          }),
                        })
                        if (retryResp.ok) {
                          const retryData = await retryResp.json()
                          if (retryData.strategy_id) {
                            strategyId = retryData.strategy_id
                            console.log('Error-triggered retry started fresh strategy:', strategyId)
                            pollInterval = POLL_INITIAL_MS  // reset backoff for the fresh strategy
                            setTimeout(checkStatus, pollInterval)
                            return
                          }
                        }
                      } catch (retryErr) {
                        console.warn('Error-triggered retry failed:', retryErr)
                      }
                    }
                    console.warn('Strategy generation failed — continuing without strategy_id')
                    strategyId = undefined
                    resolve()
                  } else {
                    // Grow interval each pending poll (3 s → 5 → 7 → 9 → 11 → 12, 12, 12…)
                    pollInterval = Math.min(pollInterval + POLL_STEP_MS, POLL_MAX_MS)
                    setTimeout(checkStatus, pollInterval)
                  }
                }
                checkStatus()
              })
            } else if (strategyData.from_cache) {
              console.log('Strategy ready (cached):', strategyId)
            } else {
              console.log('Strategy ready:', strategyId)
            }
          } else {
            console.warn('Strategy generation skipped (non-fatal):', await strategyResponse.text())
          }
        } catch (stratErr) {
          console.warn('Strategy generation error (non-fatal):', stratErr)
        }
      }
      
      // Step 3: Guard — require a valid strategy_id before calling generate-weekly-plan.
      // Without strategic context we get raw menu-item content with no brand voice.
      // If strategy generation failed or timed out, send the user to WeeklyStrategyPage
      // where they can trigger a fresh strategy and select ideas.
      if (!strategyId) {
        console.warn('Strategy generation failed or timed out — redirecting to WeeklyStrategyPage')
        setError(t('errors.strategyFailed'))
        setGenerating(false)
        return
      }

      // Step 4: Generate the weekly plan, passing strategy_id so captions get strategic context
      console.log('Calling generate-weekly-plan with strategy_id:', strategyId)
      const functionUrl = `${(supabase as any).supabaseUrl}/functions/v1/generate-weekly-plan`
      const planBody = JSON.stringify({
        weekStart: weekStartLocal,
        regenerate: forceRegenerate,
        strategy_id: strategyId,
      })

      let directResponse = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: planBody,
      })

      // On 401, refresh the session and retry once (handles edge-function cold-start auth blip)
      if (directResponse.status === 401) {
        console.warn('generate-weekly-plan: 401 on first attempt — refreshing session and retrying')
        const { data: refreshData } = await supabase.auth.refreshSession()
        const freshToken = refreshData.session?.access_token
        if (freshToken) {
          directResponse = await fetch(functionUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${freshToken}`,
              'Content-Type': 'application/json',
            },
            body: planBody,
          })
        }
      }
      
      console.log('Direct fetch status:', directResponse.status)
      console.log('Direct fetch statusText:', directResponse.statusText)

      // Handle 401 errors (not caught by the earlier retry guard)
      if (!directResponse.ok && directResponse.status !== 202) {
        const errorText = await directResponse.text()
        console.error('Direct fetch error body:', errorText)
        throw new Error(`Function returned ${directResponse.status}: ${errorText}`)
      }

      const data = await directResponse.json()
      console.log('Direct fetch response:', data)

      // ── Async path: function returned 202 — poll until plan is ready ──────────
      if (directResponse.status === 202) {
        const pollStrategyId: string | undefined = data.strategy_id
        const generationStart = new Date().toISOString()
        const MAX_WAIT_MS = 5 * 60 * 1000
        const POLL_INTERVAL_MS = 3000
        const pollStart = Date.now()
        let planRow: any = null

        while (Date.now() - pollStart < MAX_WAIT_MS) {
          await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))

          if (pollStrategyId) {
            // Primary path: poll weekly_strategies status
            const { data: stratRow } = await supabase
              .from('weekly_strategies')
              .select('status')
              .eq('id', pollStrategyId)
              .single()

            if (stratRow?.status === 'error') {
              throw new Error('Plan generation failed — strategy marked as error')
            }
            if (stratRow?.status === 'posts_created') {
              const { data: loadedPlan, error: planErr } = await supabase
                .from('weekly_content_plans')
                .select('*')
                .eq('strategy_id', pollStrategyId)
                .order('generated_at', { ascending: false })
                .limit(1)
                .single()
              if (!planErr && loadedPlan) {
                planRow = loadedPlan
                break
              }
            }

            // Fallback: also check weekly_content_plans directly in case the
            // weekly_strategies status update was delayed or missed.
            if (!planRow) {
              const { data: directPlan } = await supabase
                .from('weekly_content_plans')
                .select('*')
                .eq('strategy_id', pollStrategyId)
                .gte('generated_at', generationStart)
                .order('generated_at', { ascending: false })
                .limit(1)
                .maybeSingle()
              if (directPlan) {
                console.log('Plan found via direct weekly_content_plans poll (status update may have been delayed)')
                planRow = directPlan
                break
              }
            }
          } else if (bizData?.id) {
            // Fallback: no strategy_id — poll weekly_content_plans directly
            const weekStartISO = viewingWeek === 'next' ? toLocalISO(currentWeekStart) : toLocalISO(thisWeekStart)
            const { data: loadedPlan } = await supabase
              .from('weekly_content_plans')
              .select('*')
              .eq('business_id', bizData.id)
              .eq('week_start', weekStartISO)
              .gte('generated_at', generationStart)
              .order('generated_at', { ascending: false })
              .limit(1)
              .maybeSingle()
            if (loadedPlan) {
              planRow = loadedPlan
              break
            }
          }
        }

        if (!planRow) {
          throw new Error('Plan generation timed out after 5 minutes')
        }

        console.log('Plan loaded from DB after async generation:', planRow.id)
        setExistingPlanFound(true)
        await hydrateWeeklyPlan(planRow)
        // Weather was fetched fresh during regeneration — suppress the stale-weather
        // banner that would otherwise fire immediately because the new plan ID
        // has no sessionStorage entry yet.
        if (forceRegenerate) {
          sessionStorage.setItem(`weather_refreshed_${planRow.id}`, Date.now().toString())
        }
      } else if (data?.success && data?.plan) {
        // ── Legacy sync path (200 response — kept for safety) ──────────────────
        console.log('Setting weekly plan (sync) with', data.plan.posts?.length || 0, 'posts')
        const strategyData = await fetchStrategyData(data.plan.businessId, data.plan.weekStart)
        setWeeklyPlan({
          ...data.plan,
          strategyNarrative: data.plan.strategyNarrative || strategyData.narrative,
          weatherDays: strategyData.weatherDays,
          weekSummary: strategyData.weekSummary,
          calendarEvents: strategyData.calendarEvents,
        })
        if (forceRegenerate && data.plan.id) {
          sessionStorage.setItem(`weather_refreshed_${data.plan.id}`, Date.now().toString())
        }
      } else {
        throw new Error('Plan generation failed — unexpected response format')
      }
    } catch (err) {
      console.error('Error generating plan:', err)
      setError(err instanceof Error ? err.message : t('errors.loadFailed'))
    } finally {
      setGenerating(false)
    }
  }

  const handlePostClick = (post: PostSpecification) => {
    setSelectedPost(post)
  }

  const handleCreatePost = (post: PostSpecification) => {
    setWeeklyPlanStep('generate')
    setActivePath('weekly-plan')
    setWeeklyPlanPost(post)
    setStrategicIdea({
      title: post.contentSubject.dish,
      rationale: post.selectionRationale || post.postType.category,
      contentType: post.postType.type,
      suggestedDay: post.timing.day,
      ctaIntent: post.caption.ctaType,
      platformFormat: post.platformFormat?.format,
      suggestedMedia: post.visualDirection ? {
        type: post.platformFormat?.format || 'photo',
        direction: post.visualDirection.subject,
        why: post.visualDirection.angle,
      } : undefined,
    })
    setWeeklyContentPlan(weeklyPlan!)
    const idx = weeklyPlan!.posts.findIndex(
      (p) => p.timing.date === post.timing.date && p.timing.time === post.timing.time
    )
    setWeeklyPlanPostIndex(idx >= 0 ? idx : 0)
    navigate('/dashboard/create')
  }

  const handlePostUpdate = async (updatedPost: PostSpecification) => {
    if (!weeklyPlan) return

    // Update post in plan
    const updatedPosts = weeklyPlan.posts.map((post) => {
      const matches = post.id && updatedPost.id
        ? post.id === updatedPost.id
        : post.timing.date === updatedPost.timing.date && post.timing.time === updatedPost.timing.time
      return matches ? updatedPost : post
    })

    const updatedPlan = {
      ...weeklyPlan,
      posts: updatedPosts,
    }

    setWeeklyPlan(updatedPlan)

    // Save to database
    try {
      const { error } = await supabase
        .from('weekly_content_plans')
        .update({
          posts: updatedPosts as unknown as import('@/types/database').Json,
          updated_at: new Date().toISOString(),
        })
        .eq('id', weeklyPlan.id)

      if (error) throw error
    } catch (err) {
      console.error('Error updating plan:', err)
      setError(t('errors.saveFailed'))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cta mx-auto"></div>
          <p className="mt-4 text-slate-600">{t('loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 3-Stage Progress Bar */}
        <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm mb-6">
          <div className="flex items-center justify-between gap-2">
            {/* Stage 1: AI Ugentlig Plan — always current */}
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-lg flex-1 border-2 bg-cta-surface border-cta"
            >
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs bg-cta">
                1
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-semibold text-brand">{t('progress.stage1Title')}</div>
                <div className="text-xs text-cta-text">{t('progress.stage1Sub')}</div>
              </div>
            </div>

            <div className="text-gray-300">→</div>

            {/* Stage 2: Design */}
            <button
              onClick={() => {
                if (weeklyPlanPost) {
                  setActivePath('weekly-plan')
                  navigate('/dashboard/create')
                }
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg flex-1 border-2 transition-all ${
                weeklyPlanStep === 'publish'
                  ? 'bg-green-50 border-green-500 cursor-pointer hover:border-green-600'
                  : weeklyPlanPost
                    ? 'bg-gray-50 border-gray-200 cursor-pointer hover:border-gray-300'
                    : 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-50'
              }`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs ${
                weeklyPlanStep === 'publish' ? 'bg-green-500' : 'bg-gray-300'
              }`}>
                {weeklyPlanStep === 'publish' ? '✓' : '2'}
              </div>
              <div className="flex-1 text-left">
                <div className={`text-sm font-semibold ${
                  weeklyPlanStep === 'publish' ? 'text-green-900' : 'text-gray-500'
                }`}>{t('progress.stage2Title')}</div>
                <div className={`text-xs ${
                  weeklyPlanStep === 'publish' ? 'text-green-700' : 'text-gray-400'
                }`}>
                  {weeklyPlanStep === 'publish' ? t('progress.imageReady') : t('progress.pending')}
                </div>
              </div>
            </button>

            <div className="text-gray-300">→</div>

            {/* Stage 3: Schedule */}
            <button
              onClick={() => {
                if (weeklyPlanPost) {
                  setActivePath('weekly-plan')
                  navigate('/dashboard/create')
                }
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg flex-1 border-2 transition-all ${
                weeklyPlanPost ? 'bg-gray-50 border-gray-200 cursor-pointer hover:border-gray-300' : 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-50'
              }`}
            >
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs bg-gray-300">
                3
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-semibold text-gray-500">{t('progress.stage3Title')}</div>
                <div className="text-xs text-gray-400">{t('progress.pending')}</div>
              </div>
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* No Plan State */}
        {!weeklyPlan && !generating && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="text-6xl mb-4">🤖✨</div>
              <h2 className="text-2xl font-bold text-slate-900 mb-3">
                {existingPlanFound ? t('empty.welcomeBack') : viewingWeek === 'current' ? t('empty.noPlanCurrent') : t('empty.noPlanYet')}
              </h2>
              <p className="text-slate-600 mb-6">
                {existingPlanFound
                  ? t('empty.descExisting')
                  : viewingWeek === 'current'
                    ? t('empty.descCurrentWeek')
                    : t('empty.descNextWeek')
                }
              </p>

              <div className="mb-5 text-left">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('ownerNote.label')}
                </label>
                <textarea
                  value={ownerNote}
                  onChange={e => setOwnerNote(e.target.value)}
                  placeholder={t('ownerNote.placeholder')}
                  maxLength={400}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-cta focus:border-transparent placeholder:text-slate-400"
                />
              </div>
              
              {existingPlanFound ? (
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={loadExistingPlan}
                    className="inline-flex items-center px-6 py-3 border border-slate-300 text-base font-medium rounded-lg shadow-sm text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cta transition-colors"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {t('empty.loadExisting')}
                  </button>
                  <button
                    onClick={() => generateNewPlan(false)}
                    className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-cta hover:bg-cta-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cta transition-colors"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    {t('empty.generateNew')}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => generateNewPlan(false)}
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-cta hover:bg-cta-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cta transition-colors"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {t('empty.generateWeekly')}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Generating State */}
        {generating && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12">
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center justify-center mb-6">
                <div className="relative">
                  <div className="animate-spin rounded-full h-20 w-20 border-b-4 border-cta"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg className="w-10 h-10 text-cta" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                    </svg>
                  </div>
                </div>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-3 text-center">{t('generating.title')}</h2>
              <p className="text-slate-600 text-center mb-8">
                {t('generating.subtitle')}
              </p>
              
              {/* Progress Steps */}
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mr-3">
                    <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{t('generating.step1Title')}</p>
                    <p className="text-xs text-slate-500 mt-1">{t('generating.step1Desc')}</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mr-3">
                    <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{t('generating.step2Title')}</p>
                    <p className="text-xs text-slate-500 mt-1">{t('generating.step2Desc')}</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cta-surface flex items-center justify-center mr-3 animate-pulse">
                    <div className="w-2 h-2 bg-cta rounded-full"></div>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{t('generating.step3Title')}</p>
                    <p className="text-xs text-slate-500 mt-1">{t('generating.step3Desc')}</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center mr-3">
                    <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-500">{t('generating.step4Title')}</p>
                    <p className="text-xs text-slate-400 mt-1">{t('generating.step4Desc')}</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 bg-cta-surface border border-cta-surface rounded-lg p-4">
                <p className="text-sm text-cta-text flex items-center">
                  <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <span>{t('generating.footer')}</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Weekly Strategy Context Strip */}
        {weeklyPlan && !generating && (
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
            {weeklyPlan.weekSummary && <span className="text-slate-400 text-xs font-medium uppercase tracking-wide mr-1">{t('context.label')}</span>}
            {weeklyPlan.weekSummary && weeklyPlan.weekSummary.archetype && t(`archetype.${weeklyPlan.weekSummary.archetype}`, '') && (
              <span className="bg-surface-alt text-text-muted border border-border rounded-full px-3 py-1 text-xs font-medium">
                {t(`archetype.${weeklyPlan.weekSummary.archetype}`)}
              </span>
            )}
            {weeklyPlan.weekSummary?.primaryOccasion && (
              <span className="bg-surface-alt text-text-muted border border-border rounded-full px-3 py-1 text-xs font-medium">
                👥 {weeklyPlan.weekSummary.primaryOccasion}
              </span>
            )}
            {weeklyPlan.weekSummary?.weatherOpportunity === 'strong' && (
              <span className="bg-sky-50 text-sky-700 border border-sky-200 rounded-full px-3 py-1 text-xs font-medium">{t('context.outdoorOpportunity')}</span>
            )}
            {weeklyPlan.weekSummary?.weatherOpportunity === 'constrained' && (
              <span className="bg-sky-50 text-sky-700 border border-sky-200 rounded-full px-3 py-1 text-xs font-medium">{t('context.indoorFocus')}</span>
            )}
            {weeklyPlan.weekSummary?.economicSignal === 'push' && (
              <span className="bg-green-50 text-green-700 border border-green-200 rounded-full px-3 py-1 text-xs font-medium">{t('context.payPeriod')}</span>
            )}
{/* Only show topPriority chip when it doesn't contain banned/abstract phrases from the Phase 0 raw snapshot */}
            {weeklyPlan.weekSummary?.topPriority && !/(hygge|fristed|oase|stemning|atmosf.re|refugium|ro og|forkælelse)/i.test(weeklyPlan.weekSummary.topPriority) && (
              <span className="bg-warning-surface text-warning-text border border-warning rounded-full px-3 py-1 text-xs font-medium">
                🎯 {weeklyPlan.weekSummary.topPriority}
              </span>
            )}
            <div className="ml-auto flex bg-slate-100 rounded-md p-0.5">
              <button
                onClick={() => handleViewingWeekChange('current')}
                className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                  viewingWeek === 'current'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t('weekToggle.current')}
              </button>
              <button
                onClick={() => handleViewingWeekChange('next')}
                className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                  viewingWeek === 'next'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t('weekToggle.next')}
              </button>
            </div>
          </div>
        )}

        {/* Weekly Plan Display */}
        {weeklyPlan && !generating && (
          <WeeklyPlanOverview
            plan={weeklyPlan}
            onPostClick={handlePostClick}
            onGenerateNew={generateNewPlan}
            sessionDoneIndices={weeklyPlanSessionDone}
            onCreatePost={handleCreatePost}
            showGenerateButton={viewingWeek === 'next' || !existingPlanFound}
            onRefreshWeather={handleRefreshWeather}
            refreshingWeather={refreshingWeather}
            weatherStaleAlert={weatherStaleAlert}
            weatherAssessment={weatherAssessment}
            onDismissWeatherAssessment={() => setWeatherAssessment(null)}
            onGenerateNewPlan={() => generateNewPlan(true)}
          />
        )}

        {/* Post Detail Modal */}
        {selectedPost && (
          <PostDetailModal
            post={selectedPost}
            onClose={() => setSelectedPost(null)}
            onUpdate={handlePostUpdate}
            planId={weeklyPlan?.id}
          />
        )}

        {/* Regenerate Warning Modal */}
        {showRegenerateWarning && (
          <div className="fixed inset-0 bg-slate-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-start mb-4">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-lg font-medium text-slate-900">{t('regenModal.title')}</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    {t('regenModal.desc')}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('ownerNote.label')}
                </label>
                <textarea
                  value={ownerNote}
                  onChange={e => setOwnerNote(e.target.value)}
                  placeholder={t('ownerNote.placeholder')}
                  maxLength={400}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-cta focus:border-transparent placeholder:text-slate-400"
                />
              </div>
              <div className="flex flex-col-reverse sm:flex-row gap-3 mt-6">
                <button
                  onClick={() => setShowRegenerateWarning(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-base font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cta transition-colors"
                >
                  {t('regenModal.cancel')}
                </button>
                <button
                  onClick={() => generateNewPlan(true)}
                  className="flex-1 px-4 py-2 border border-transparent text-base font-medium rounded-lg text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition-colors"
                >
                  {t('regenModal.confirm')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
