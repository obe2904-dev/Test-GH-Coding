// AiSuggestionsCard.tsx
// Shows 3 AI-generated post suggestions on the dashboard (#WriteContentCard alternative)
// Free tier: "post today" suggestions (weather now + top 5 menu items)
// Paid tier: links to full weekly plan

import { useState, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Trans, useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { useBusinessData } from '../../hooks/useBusinessData'
import { useTierStore } from '../../stores/tierStore'
import { usePostCreationStore } from '../../stores/postCreationStore'
import { ContentTypeIcon } from './ContentTypeIcon'
import { buildZeroRowAuditMessage, getAffectedRowCount } from '../../lib/dailySuggestionIntegrity'

// Icon component
const LightBulbIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
)

const TimingIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
    <rect x="3.5" y="4.5" width="17" height="16" rx="2" />
    <line x1="8" y1="2.5" x2="8" y2="6" />
    <line x1="16" y1="2.5" x2="16" y2="6" />
    <line x1="3.5" y1="9" x2="20.5" y2="9" />
    <circle cx="15.5" cy="14.5" r="2.5" />
    <path d="M15.5 13.4v1.4l.9.6" />
  </svg>
)

interface MediaAlternative {
  type: 'photo' | 'carousel' | 'reel'
  instruction: string
}

interface MediaSuggestion {
  primary: { type: 'photo'; instruction: string }
  alternatives: MediaAlternative[]
}

interface PostSuggestion {
  id: number
  // Phase 3: title/rationale/captionBase removed from quick suggestions, kept for weekly plan compatibility
  title?: string
  rationale?: string
  whyExplanation: string  // Phase 3: Now the primary explanation field
  occasionContext?: string
  photoIdea?: string
  mediaSuggestion?: MediaSuggestion | null
  menuItemId?: string           // UUID for menu_items_normalized lookup
  menuItemName?: string
  menuItemDescription?: string
  captionBase?: string
  ctaIntent?: string
  contentType: 'menu_item' | 'atmosphere' | 'behind_scenes'
  suggestedTime: string
  suggestedDate?: string  // ISO date (YYYY-MM-DD) the suggestion was generated for
  icon: string
}

interface AiSuggestionsCardProps {
  onSelectSuggestion: (suggestion: PostSuggestion) => void
  onGenerate?: () => void
  businessId: string | null
  selectedIdea?: string | null
  /** suggestion_ids that are already committed (published/scheduled) today */
  committedSuggestionIds?: Set<number>
}

const CONTENT_TYPE_ICONS: Record<string, string> = {
  menu_item: '📸',
  atmosphere: '📸',
  behind_scenes: '🎬',
}

// Module-level cache: survives component remounts within the same browser session.
// Keyed by businessId so multi-account setups stay isolated.
interface SuggestionsSnapshot {
  suggestions: PostSuggestion[]
  weatherForecast: { city: string; until: string; temperature: string; conditions: string } | null
  fetchedAt: number // ms timestamp — used to decide whether to silently refresh
  fetchedDate: string // ISO date (YYYY-MM-DD) — used to invalidate cache at midnight
}

function normalizeQuickSuggestionWeatherForecast(
  forecast: { city: string; until: string; temperature: string; conditions: string } | null,
): { city: string; until: string; temperature: string; conditions: string } | null {
  if (!forecast) return null
  return {
    ...forecast,
    until: 'Gælder i dag',
  }
}
const _suggestionsCache = new Map<string, SuggestionsSnapshot>()
// Invalidate after 10 minutes so a long-idle session re-fetches
const CACHE_TTL_MS = 10 * 60 * 1000
// In-flight guard: prevents concurrent fetches for the same businessId
// (e.g. React Strict Mode double-effect, or rapid re-mounts)
const _inFlight = new Set<string>()

function toLocalISODate(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDaysToLocalDate(date: Date, days: number): string {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return toLocalISODate(copy)
}

export function AiSuggestionsCard({ onSelectSuggestion, onGenerate, businessId, selectedIdea, committedSuggestionIds }: AiSuggestionsCardProps) {
  const { t } = useTranslation()
  const currentTier = useTierStore((s) => s.currentTier)
  const canUseAiIdeas = useTierStore((s) => s.canUseAiIdeas)
  const incrementAiIdeas = useTierStore((s) => s.incrementAiIdeas)
  const { business, profile, isLoading: isBusinessDataLoading } = useBusinessData()

  // Pre-populate from module cache so remounts (navigating back) show data instantly
  const memCache = businessId ? _suggestionsCache.get(businessId) : null
  const todayDate = toLocalISODate()
  const isCacheValid = !!memCache && 
    (Date.now() - memCache.fetchedAt) < CACHE_TTL_MS &&
    memCache.fetchedDate === todayDate  // Invalidate cache if date changed (midnight crossing)

  const [suggestions, setSuggestions] = useState<PostSuggestion[]>(isCacheValid ? memCache!.suggestions : [])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isInitialLoad, setIsInitialLoad] = useState(!isCacheValid)
  const [weatherForecast, setWeatherForecast] = useState<{ city: string; until: string; temperature: string; conditions: string } | null>(isCacheValid ? normalizeQuickSuggestionWeatherForecast(memCache!.weatherForecast) : null)
  const [plannerRationale, setPlannerRationale] = useState<string>('')
  const [openPhotoIdeas, setOpenPhotoIdeas] = useState<Set<number>>(new Set())
  const togglePhotoIdea = (id: number) => setOpenPhotoIdeas(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })

  const hasMinimumProfileData = Boolean(
    business?.website_url ||
    profile?.user_about_text?.trim() ||
    business?.name?.trim() ||
    (Array.isArray(profile?.keywords) && profile.keywords.length > 0)
  )
  const shouldPromptForProfileDetails = !isBusinessDataLoading && !hasMinimumProfileData
  
  // Usage tracking stats
  interface UsageStats {
    regenerations_used: number
    regenerations_limit: number
    suggestions_count: number
    suggestions_selected: number
    texts_generated: number
    tier: string
  }
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null)
  const [thumbsUp, setThumbsUp] = useState<Set<number>>(new Set())
  const [showGate, setShowGate] = useState(false)
  const [userContext, setUserContext] = useState('')
  const handleThumbsUp = async (e: React.MouseEvent, suggestionId: number) => {
    e.stopPropagation()
    if (!businessId) return
    if (thumbsUp.has(suggestionId)) return // already liked, no-op
    setThumbsUp(prev => new Set(prev).add(suggestionId))
    try {
      // thumbs_up column removed - track engagement differently
      const { data, error } = await supabase
        .from('daily_suggestions')
        .update({ consumed_at: new Date().toISOString() })
        .eq('id', suggestionId)
        .eq('business_id', businessId)
        .select('id')

      if (error) {
        throw error
      }

      if (getAffectedRowCount(data) === 0) {
        console.warn(buildZeroRowAuditMessage('thumbs_up', businessId, suggestionId))
        setThumbsUp(prev => { const next = new Set(prev); next.delete(suggestionId); return next })
      }
    } catch (err) {
      console.warn('[AiSuggestionsCard] thumbs_up write failed:', err)
      // Revert optimistic update on failure
      setThumbsUp(prev => { const next = new Set(prev); next.delete(suggestionId); return next })
    }
  }
  
  console.log('[AiSuggestionsCard] Render:', { businessId, isInitialLoad, isLoading, hasSuggestions: suggestions.length > 0 })

  // Fetch usage stats
  const fetchUsageStats = useCallback(async () => {
    if (!businessId) return
    try {
      // @ts-ignore - RPC function exists but types may not be regenerated yet
      const { data, error } = await supabase.rpc('get_daily_usage_stats', {
        p_business_id: businessId
      })
      if (error) {
        console.error('[AiSuggestionsCard] Failed to fetch usage stats:', error)
        return
      }
      if (data && Array.isArray(data) && data.length > 0) {
        setUsageStats(data[0] as unknown as UsageStats)
      }
    } catch (err) {
      console.error('[AiSuggestionsCard] Usage stats error:', err)
    }
  }, [businessId])

  const resolveFunctionErrorMessage = useCallback(async (fnError: unknown, fallbackKey = 'dashboard.suggestionsError') => {
    let errorMessage = t(fallbackKey)

    const tryApplyErrorCode = (payload: any) => {
      if (payload?.errorCode && t(`dashboard.${payload.errorCode}`) !== `dashboard.${payload.errorCode}`) {
        errorMessage = t(`dashboard.${payload.errorCode}`)
        return true
      }
      if (payload?.message) {
        errorMessage = payload.message
        return true
      }
      return false
    }

    try {
      const payload = (fnError as any)?.context?.json
        ? await (fnError as any).context.json()
        : null

      if (tryApplyErrorCode(payload)) {
        return errorMessage
      }

      const response = (fnError as any)?.context?.response ?? (fnError as any)?.context
      if (response && typeof response.text === 'function') {
        const raw = await response.text()
        if (raw) {
          try {
            const parsed = JSON.parse(raw)
            if (tryApplyErrorCode(parsed)) {
              return errorMessage
            }
          } catch {
            if (raw.trim()) {
              errorMessage = raw
            }
          }
        }
      }
    } catch (parseError) {
      console.warn('[AiSuggestionsCard] Failed to parse function error payload:', parseError)
    }

    return errorMessage
  }, [t])
  
  const fetchSuggestions = useCallback(async (regenerate = false, opts?: { localTime?: string; localDate?: string; userContext?: string }) => {
    console.log('[AiSuggestionsCard] fetchSuggestions called:', { regenerate, businessId })
    if (!businessId) return
    
    // Return early if a fetch is already in progress for this businessId (prevents
    // React Strict Mode double-effect from making two concurrent API calls).
    if (!regenerate && _inFlight.has(businessId)) {
      console.log('[AiSuggestionsCard] Skipping duplicate fetch — already in flight')
      return
    }
    
    // Check quota only when generating new suggestions
    let quotaExceeded = false
    if (regenerate) {
      // Regenerating ideas should not destroy any unfinished Udgiv draft.
      // We only clear the cached suggestion batch so the idea list refreshes cleanly.
      _suggestionsCache.delete(businessId)

      const canGenerate = canUseAiIdeas()
      if (!canGenerate) {
        quotaExceeded = true
        console.log('[AiSuggestionsCard] Quota exceeded - stale cache cleared, still requesting refresh')
      }
    }
    
    _inFlight.add(businessId)
    setIsLoading(true)
    setError(null)
    
    try {
      // Call edge function for quick suggestions
      console.log('[AiSuggestionsCard] 🚀 Calling API with regenerate:', regenerate)
      const { data, error: fnError } = await supabase.functions.invoke('get-quick-suggestions', {
        body: {
          businessId,
          count: 3,
          tier: currentTier,
          regenerate,  // Always request a refresh on explicit regenerate clicks
          localTime: opts?.localTime,
          localDate: opts?.localDate ?? toLocalISODate(),
          userContext: opts?.userContext || undefined,
        }
      })
      
      if (fnError) {
        // If quota was exceeded and we got an error, show cached suggestions message
        if (quotaExceeded) {
          setError(t('dashboard.quotaExceeded'))
          // Don't throw - let existing suggestions remain visible
          return
        }
        
        const errorMessage = await resolveFunctionErrorMessage(fnError)
        setError(errorMessage)
        return
      }
      
      console.log('[AiSuggestionsCard] 📦 API Response:', { 
        hasSuggestions: !!data?.suggestions, 
        cached: data?.cached,
        suggestionCount: data?.suggestions?.length,
        suggestionIds: data?.suggestions?.map((s: any) => s.id),
        suggestionTitles: data?.suggestions?.map((s: any) => s.title),
        weatherForecast: data?.weatherForecast 
      })
      
      if (data?.suggestions && Array.isArray(data.suggestions)) {
        const mappedSuggestions = data.suggestions
          .filter((s: any) => Number.isInteger(s?.id) && s.id > 0)
          .map((s: any) => ({
            id: s.id,
            title: s.title,
            rationale: s.rationale || s.why_explanation || '',
            whyExplanation: s.why_explanation || s.rationale || '',
            occasionContext: s.occasion_context || s.occasionContext || '',
            photoIdea: s.media_suggestion?.primary?.instruction || s.photo_idea || '',
            mediaSuggestion: s.media_suggestion || null,
            menuItemName: s.menu_item_name || '',
            menuItemDescription: s.menu_item_description || '',
            captionBase: s.caption_base || '',
            ctaIntent: s.cta_intent || 'visit',
            contentType: s.content_type || s.contentType || 'menu_item',
            suggestedTime: s.suggested_time || s.suggestedTime || '12:00',
            suggestedDate: s.suggestion_date || s.suggestedDate || '',
            icon: CONTENT_TYPE_ICONS[s.content_type || s.contentType || 'menu_item'] || '📸',
          }))

        if (mappedSuggestions.length === 0) {
          console.error('[AiSuggestionsCard] No persisted suggestion IDs returned from API')
          setError(t('dashboard.suggestionsError'))
          return
        }
        setSuggestions(mappedSuggestions)
        
        // Set weather forecast if available
        let parsedForecast: { city: string; until: string; temperature: string; conditions: string } | null = null
        if (data.weatherForecast) {
          console.log('[AiSuggestionsCard] Setting weather forecast:', data.weatherForecast)
          try {
            parsedForecast = typeof data.weatherForecast === 'string' 
              ? JSON.parse(data.weatherForecast) 
              : data.weatherForecast
            setWeatherForecast(normalizeQuickSuggestionWeatherForecast(parsedForecast))
          } catch (e) {
            console.error('Failed to parse weather forecast:', e)
          }
        }

        // Set planner rationale if available
        if (data.plannerRationale) {
          setPlannerRationale(data.plannerRationale)
        }

        // Save to module-level cache so navigating back is instant
        if (businessId) {
          _suggestionsCache.set(businessId, {
            suggestions: mappedSuggestions,
            weatherForecast: normalizeQuickSuggestionWeatherForecast(parsedForecast),
            fetchedAt: Date.now(),
            fetchedDate: toLocalISODate(),
          })
        }
        
        // Increment quota only when actually generating (not loading cached)
        if (regenerate || !data.cached) {
          incrementAiIdeas()
        }
        
        // Fetch updated usage stats after generation
        fetchUsageStats()
      }
    } catch (err) {
      console.error('Failed to fetch suggestions:', err)
      setError(t('dashboard.suggestionsError'))
    } finally {
      if (businessId) _inFlight.delete(businessId)
      setIsLoading(false)
      setIsInitialLoad(false)
    }
  }, [businessId, currentTier, t, canUseAiIdeas, incrementAiIdeas, fetchUsageStats, resolveFunctionErrorMessage])

  // Load suggestions and stats on mount.
  // Load full suggestion rows directly from DB if they exist for today —
  // this avoids calling the edge function (which regenerates every time).
  // If nothing yet, show the gate so the user can choose when to generate.
  useEffect(() => {
    console.log('[AiSuggestionsCard] useEffect running:', { businessId, isInitialLoad })
    if (!businessId || !isInitialLoad) return
    fetchUsageStats()
    const todayISO = toLocalISODate()
    
    // First try today's suggestions, then fall back to most recent unconsumed ones
    // This prevents losing suggestions at midnight if they haven't been used yet
    supabase
      .from('daily_suggestions')
      .select('*')
      .eq('business_id', businessId)
      .eq('date', todayISO)
      .in('status', ['available', 'selected'])
      .eq('source', 'quick_suggestions')
      .is('consumed_at', null)  // Only show unconsumed suggestions
      .order('position', { ascending: true })
      .limit(3)
      .then(async ({ data, error }) => {
        // If no suggestions for today, try to get the most recent unconsumed batch
        if ((!error && (!data || data.length === 0)) || error) {
          console.log('[AiSuggestionsCard] No suggestions for today, checking for recent unconsumed batch')
          const { data: recentData, error: recentError } = await supabase
            .from('daily_suggestions')
            .select('*')
            .eq('business_id', businessId)
            .in('status', ['available', 'selected'])
            .eq('source', 'quick_suggestions')
            .is('consumed_at', null)
            .order('created_at', { ascending: false })
            .limit(3)
          
          if (!recentError && recentData && recentData.length > 0) {
            data = recentData
            console.log('[AiSuggestionsCard] Loaded recent unconsumed suggestions from', recentData[0]?.date)
          }
        }
        
        if (!error && data && data.length > 0) {
          // Suggestions exist — map directly, no edge function call
          const isFromToday = data[0]?.date === todayISO
          console.log('[AiSuggestionsCard] Suggestions loaded from DB:', data.length, 
            isFromToday ? '(today)' : `(from ${data[0]?.date})`)
          const mapped: PostSuggestion[] = data.map((row: any) => ({
            id: row.id,
            title: row.title,
            rationale: row.rationale || row.why_explanation || '',
            whyExplanation: row.why_explanation || row.rationale || '',
            occasionContext: row.occasion_context || '',
            photoIdea: row.media_suggestion?.primary?.instruction || row.photo_idea || '',
            mediaSuggestion: row.media_suggestion || null,
            menuItemId: row.menu_item_id || '',
            menuItemName: row.menu_item_name || '',
            menuItemDescription: row.menu_item_description || '',
            captionBase: row.caption_base || '',
            ctaIntent: row.cta_intent || 'visit',
            contentType: row.content_type || 'menu_item',
            suggestedTime: typeof row.suggested_time === 'string'
              ? row.suggested_time.slice(0, 5)
              : '12:00',
            suggestedDate: row.suggestion_date || row.date || todayISO,
            icon: CONTENT_TYPE_ICONS[row.content_type] || '📸',
          }))
          setSuggestions(mapped)
          const wf = data[0]?.weather_forecast
          if (wf) {
            try {
              setWeatherForecast(normalizeQuickSuggestionWeatherForecast(typeof wf === 'string' ? JSON.parse(wf) : wf))
            } catch (_) { /* ignore malformed weather */ }
          }
          _suggestionsCache.set(businessId, {
            suggestions: mapped,
            weatherForecast: wf ? normalizeQuickSuggestionWeatherForecast(typeof wf === 'string' ? JSON.parse(wf) : wf) : null,
            fetchedAt: Date.now(),
            fetchedDate: todayISO,
          })
          setIsInitialLoad(false)
          setIsLoading(false)
        } else if (!error && data && data.length === 0) {
          // Nothing yet today — show the gate
          console.log('[AiSuggestionsCard] No suggestions yet today, showing gate')
          setShowGate(true)
          setIsInitialLoad(false)
        } else {
          // DB error — fall back to the edge function
          console.warn('[AiSuggestionsCard] DB check error, falling back to API:', error)
          fetchSuggestions(false)
        }
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, isInitialLoad])
  
  // Refresh stats when selectedIdea changes (user returned from create step)
  useEffect(() => {
    if (businessId && selectedIdea === null) {
      // User cleared selection (came back from create step) - refresh stats
      fetchUsageStats()
    }
  }, [businessId, selectedIdea, fetchUsageStats])

  // ── Gate state (no suggestions generated yet today) ──
  if (showGate && !isLoading) {
    const isPaidTier = currentTier === 'standardplus' || currentTier === 'premium'
    const gateButtonLabel = shouldPromptForProfileDetails
      ? t('dashboard.profileNeedsDetails', 'Udfyld virksomhedsprofilen først')
      : t('dashboard.gateButton', 'Generer forslag nu')
    const gateHelperText = shouldPromptForProfileDetails
      ? t('dashboard.profileNeedsDetailsHelper', 'Vi mangler stadig nok virksomhedsdata. Du kan udfylde dem manuelt, eller sende et link til jeres hjemmeside, så kan vi forsøge at hente det automatisk for dig.')
      : 'Tryk på knappen — AI laver 2–3 forslag til dig på under 30 sekunder'
    const handleGenerate = () => {
      setShowGate(false)
      fetchSuggestions(true, {
        localTime: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, -1),
        userContext: userContext.trim() || undefined,
      })
    }
    return (
      <div className="space-y-4">
        <div>
          <p className="text-[18px] font-medium text-[#111714]">
            {t('dashboard.gateHeadline', 'Klar til dagens opslag?')}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            {t('dashboard.gateSubtext', 'AI laver 2–3 idéer tilpasset dit menukort og tidspunkt. Tag et opslag live på få minutter.')}
          </p>
        </div>

        <button
          onClick={handleGenerate}
          className="w-full px-4 py-3 bg-cta text-white rounded-lg hover:bg-cta-hover transition-colors font-medium flex items-center justify-center gap-2"
        >
          <span>{gateButtonLabel}</span>
        </button>

        <div className="pt-4 pb-1 text-center">
          <p className="text-[14px] leading-5 text-[#A09A91]">
            {gateHelperText}
          </p>
        </div>
      </div>
    )
  }

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="space-y-4">
        <p className="text-base font-semibold text-[#0F172A]">
          {t('dashboard.preparingSuggestions')}
        </p>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 border border-gray-200 rounded-lg animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Error state ──
  if (error) {
    const sparseProfileMessage = t('dashboard.noHoursConfigured')
    const shouldRenderLinkedProfileHint = error === sparseProfileMessage

    return (
      <div className="space-y-4">
        <p className="text-base font-semibold text-[#0F172A]">
          {t('dashboard.headlinePromptFallback')}
        </p>
        <p className="text-sm text-red-600">
          {shouldRenderLinkedProfileHint ? (
            <Trans
              i18nKey="dashboard.noHoursConfigured"
              t={t}
              components={{
                profileLink: <Link to="/dashboard/profile" className="underline underline-offset-2 font-medium text-red-700 hover:text-red-800" />,
              }}
            />
          ) : (
            error
          )}
        </p>
        {!error.includes(t('dashboard.quotaExceeded')) && (
          <button
            onClick={() => fetchSuggestions(true)}
            className="px-4 py-2 bg-cta text-white rounded-lg hover:bg-cta-hover transition-colors text-sm font-medium"
          >
            {t('dashboard.retrySuggestions')}
          </button>
        )}
      </div>
    )
  }

  // ── Initial state (no suggestions generated yet) ──
  if (!isInitialLoad && suggestions.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-base font-semibold text-[#0F172A]">
          {t('dashboard.headlinePromptFallback')}
        </p>
        <p className="text-sm text-gray-600">
          {t('dashboard.aiIdeasDescription')}
        </p>
        <button
          onClick={() => fetchSuggestions(true)}
          className="px-4 py-2 bg-cta text-white rounded-lg hover:bg-cta-hover transition-colors text-sm font-medium flex items-center gap-2"
        >
          <span>✨</span>
          <span>{t('dashboard.generateIdeas')}</span>
        </button>
      </div>
    )
  }

  // ── Suggestions list ──
  const isAtRegenerationLimit = usageStats && usageStats.regenerations_used >= usageStats.regenerations_limit
  const visibleSuggestions = suggestions.filter(
    (suggestion) => !(committedSuggestionIds?.has(suggestion.id) ?? false)
  )
  const hasCommittedSuggestions = visibleSuggestions.length !== suggestions.length
  
  // Calculate total suggestions pool: 3 per batch, (regenerations_limit + 1) batches total
  const suggestionsUsed = usageStats ? (usageStats.regenerations_used + 1) * 3 : 3
  const suggestionsMax = usageStats ? (usageStats.regenerations_limit + 1) * 3 : 9
  
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-base font-semibold text-[#0F172A]">
            {t('dashboard.suggestionsReady')}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            {t('dashboard.suggestionsSubtext')}
          </p>
        </div>
        {weatherForecast && (
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">
              {t('dashboard.weatherIn')} {weatherForecast.city}
            </p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">
              {t('dashboard.weatherValidUntil')} Gælder i dag
            </p>
            <p className="text-sm font-medium text-gray-700">
              {weatherForecast.temperature}, {weatherForecast.conditions}
            </p>
          </div>
        )}
      </div>

      {plannerRationale && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-3 mb-1">
          <p className="text-sm text-purple-900 font-medium flex items-start gap-2">
            <TimingIcon className="w-4 h-4 text-purple-700 flex-shrink-0 mt-0.5" />
            <span>{plannerRationale}</span>
          </p>
        </div>
      )}

      {hasCommittedSuggestions && visibleSuggestions.length === 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {t('dashboard.allSuggestionsScheduled', 'Alle dagens forslag er allerede planlagt. Generér nye forslag for at få friske idéer.')}
        </div>
      )}

      <div className="space-y-3">
        {visibleSuggestions.map((suggestion, idx) => {
          const isSelected = selectedIdea === suggestion.id.toString()
          return (
          <div
            key={suggestion.id}
            className={`relative p-4 border-2 rounded-lg transition-all cursor-pointer ${
              isSelected 
                ? 'border-mint bg-mint/10 shadow-lg' 
                : 'border-gray-200 hover:border-mint hover:bg-mint/5'
            }`}
            onClick={() => {
              if (!isSelected) onSelectSuggestion(suggestion)
            }}
          >
            {idx > 0 && (
              <span className="absolute top-3 right-3 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                Alternativt forslag
              </span>
            )}
            <div className={`flex items-start gap-3 ${idx > 0 ? 'pr-32' : ''}`}>
              <ContentTypeIcon contentType={suggestion.contentType} className="w-5 h-5 mt-0.5 text-text" />
              <div className="flex-1 min-w-0">
                {/* Phase 3: Use whyExplanation as primary display (first sentence as title) */}
                <p className="font-semibold text-gray-900 mb-2">
                  {(suggestion.title || suggestion.whyExplanation.split(/[.!?]\s+/)[0]).replace(/\.$/, '')}
                </p>
                
                {/* Show full explanation if it has multiple sentences */}
                {suggestion.whyExplanation.split(/[.!?]\s+/).filter(s => s.trim()).length > 1 && (
                  <div className="mb-3">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-brand mb-1">
                      <LightBulbIcon className="w-3.5 h-3.5" />
                      {t('dashboard.whyThisPost')}
                    </p>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {suggestion.whyExplanation}
                    </p>
                  </div>
                )}
                
                {suggestion.photoIdea && (
                  <div className="mb-3">
                    <button
                      onClick={e => { e.stopPropagation(); togglePhotoIdea(suggestion.id) }}
                      className="flex items-center gap-1 text-xs font-medium text-brand mb-1.5 w-full text-left"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>{t('dashboard.cameraOrPhone')}</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className={`w-3.5 h-3.5 shrink-0 transition-transform ${openPhotoIdeas.has(suggestion.id) ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {openPhotoIdeas.has(suggestion.id) && (
                      <>
                        <div className="bg-gray-50 rounded-md px-3 py-2 space-y-1.5">
                          {suggestion.photoIdea
                            .split(/(?<=[.!?])\s+(?=[A-ZÆØÅ])/)
                            .filter((s: string) => s.trim().length > 0)
                            .map((step: string, i: number) => (
                              <div key={i} className="flex items-start gap-2">
                                <span className="text-xs font-semibold text-brand shrink-0 mt-0.5 w-4">{i + 1}.</span>
                                <p className="text-sm text-gray-700 leading-snug">{step.trim()}</p>
                              </div>
                            ))
                          }
                        </div>
                        {suggestion.mediaSuggestion?.alternatives && suggestion.mediaSuggestion.alternatives.length > 0 && (
                          <div className="mt-1.5 space-y-1">
                            {suggestion.mediaSuggestion.alternatives.map((alt: { type: string; instruction: string }, i: number) => (
                              <div key={i} className="flex items-start gap-1.5">
                                <span className="text-xs font-medium text-slate-500 shrink-0 mt-0.5">
                                  {alt.type === 'reel' ? '🎬' : '🖼️'} {alt.type === 'reel' ? 'Video' : 'Carousel'}:
                                </span>
                                <p className="text-xs text-slate-500 italic">{alt.instruction}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Hide timing for Free tier - keep it clean and simple */}
                {currentTier !== 'free' && suggestion.suggestedTime && (() => {
                  // Round time for clean display:
                  // Slot A (idx=0): round UP to nearest 15-min mark (00,15,30,45)
                  // Slots B/C (idx>0): round to nearest :00 or :30 — labeled as alternatives
                  const rawHHMM = suggestion.suggestedTime!.slice(0, 5)
                  const [rh, rm] = rawHHMM.split(':').map(Number)
                  const rawMins = rh * 60 + rm
                  const roundedMins = idx === 0
                    ? Math.ceil(rawMins / 15) * 15   // up to nearest 15
                    : Math.round(rawMins / 30) * 30  // to nearest 30
                  const dh = Math.floor(roundedMins / 60) % 24
                  const dm = roundedMins % 60
                  const timeHHMM = `${String(dh).padStart(2,'0')}:${String(dm).padStart(2,'0')}`
                  const now = new Date()
                  const todayISO = toLocalISODate(now)
                  const tomorrowISO = addDaysToLocalDate(now, 1)
                  const suggDate = suggestion.suggestedDate || todayISO
                  const isPast = suggDate === todayISO && (now.getHours() * 60 + now.getMinutes()) > (dh * 60 + dm)
                  const timeLabel = suggDate === tomorrowISO
                    ? `${t('dashboard.suggestedTimeTomorrow')} ${timeHHMM}`
                    : suggDate === todayISO
                    ? `${t('dashboard.suggestedTimeToday')} ${timeHHMM}`
                    : `${timeHHMM}`
                  const timeReasons = t('dashboard.timeReason', { returnObjects: true }) as Record<string, string>
                  const reason = idx === 0 ? (timeReasons[timeHHMM] || undefined) : undefined
                  return (
                    <div className="flex flex-col gap-0.5">
                      <span className={`text-xs font-medium border px-2 py-0.5 rounded ${
                        isPast
                          ? 'bg-gray-50 text-gray-400 border-gray-200 line-through decoration-gray-300'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        🕐 {timeLabel}
                        {reason && (
                          <span className="font-normal"> · {reason}</span>
                        )}
                      </span>
                      {isPast && (
                        <span className="text-xs text-amber-700/70 font-medium">
                          ↳ Tidspunktet er passeret — du vælger selv hvornår du poster
                        </span>
                      )}
                    </div>
                  )
                })()}
              </div>
            </div>
            
            {/* Bottom row: thumbs-up + select arrow */}
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
              <button
                onClick={(e) => handleThumbsUp(e, suggestion.id)}
                title={thumbsUp.has(suggestion.id) ? t('dashboard.likedTitle') : t('dashboard.likeTitle')}
                className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-colors ${
                  thumbsUp.has(suggestion.id)
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50 border border-transparent'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill={thumbsUp.has(suggestion.id) ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                </svg>
                <span>{thumbsUp.has(suggestion.id) ? t('dashboard.likedLabel') : t('dashboard.likeLabel')}</span>
              </button>
              {isSelected ? (
                <button
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    console.log('[AiSuggestionsCard] Generate button clicked, onGenerate:', !!onGenerate, 'suggestionId:', suggestion.id);
                    onGenerate?.() 
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-mint hover:bg-[#6FE0C2] text-white text-sm font-semibold rounded-lg transition-colors shadow-md hover:shadow-lg"
                  title={t('dashboard.generatePostWithAI')}
                >
                  <span>Generér tekst med AI</span>
                  <span className="text-lg">→</span>
                </button>
              ) : (
                <span className="text-xs text-gray-400">{t('dashboard.tapToSelect')}</span>
              )}
            </div>
          </div>
          )
        })}
    
      </div>

      {/* Upgrade nudge for free tier */}
      {currentTier === 'free' && (
        <div className="bg-gradient-to-r from-brand/5 to-mint/10 border border-mint/30 rounded-lg p-4">
          <p className="text-sm font-medium text-brand">
            {t('dashboard.upgradeNudge')}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            {t('dashboard.upgradeNudgeSubtext')}
          </p>
        </div>
      )}

      {/* Regenerate button */}
      <button
        onClick={() => fetchSuggestions(true, { localDate: toLocalISODate() })}
        disabled={isAtRegenerationLimit || false}
        className={`w-full text-center text-sm py-2 border rounded-lg transition-colors ${
          isAtRegenerationLimit
            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
            : 'text-gray-500 hover:text-gray-700 border-gray-200 hover:border-gray-300'
        }`}
        title={isAtRegenerationLimit ? t('dashboard.regenerateLimitTitle') : t('dashboard.regenerateButtonLabel')}
      >
        {isAtRegenerationLimit ? t('dashboard.regenerateButtonLocked') : t('dashboard.regenerateButtonActive')}
      </button>

    </div>
  )
}
