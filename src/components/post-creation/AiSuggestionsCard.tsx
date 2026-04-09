// AiSuggestionsCard.tsx
// Shows 3 AI-generated post suggestions on the dashboard (#WriteContentCard alternative)
// Free tier: "post today" suggestions (weather now + top 5 menu items)
// Paid tier: links to full weekly plan

import { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { useTierStore } from '../../stores/tierStore'
import { ContentTypeIcon } from './ContentTypeIcon'

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
  title: string
  rationale: string
  whyExplanation?: string
  photoIdea?: string
  mediaSuggestion?: MediaSuggestion | null
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
}

const CONTENT_TYPE_ICONS: Record<string, string> = {
  menu_item: '📸',
  atmosphere: '📸',
  behind_scenes: '🎬',
}

const CONTENT_TYPE_KEYS: Record<string, string> = {
  menu_item: 'dashboard.contentType.menu_item',
  atmosphere: 'dashboard.contentType.atmosphere',
  behind_scenes: 'dashboard.contentType.behind_scenes',
}

const TIME_REASON_KEYS: Record<string, string> = {
  '08:00': 'dashboard.timeReason.08:00',
  '09:00': 'dashboard.timeReason.09:00',
  '10:00': 'dashboard.timeReason.10:00',
  '11:00': 'dashboard.timeReason.11:00',
  '12:00': 'dashboard.timeReason.12:00',
  '13:00': 'dashboard.timeReason.13:00',
  '14:00': 'dashboard.timeReason.14:00',
  '16:00': 'dashboard.timeReason.16:00',
  '17:00': 'dashboard.timeReason.17:00',
  '18:00': 'dashboard.timeReason.18:00',
  '20:00': 'dashboard.timeReason.20:00',
}

// Returns true if a HH:MM slot has already passed today
function isTimePast(timeStr: string): boolean {
  const [h, m] = timeStr.split(':').map(Number)
  const now = new Date()
  const slot = new Date()
  slot.setHours(h, m, 0, 0)
  return slot <= now
}

// Module-level cache: survives component remounts within the same browser session.
// Keyed by businessId so multi-account setups stay isolated.
interface SuggestionsSnapshot {
  suggestions: PostSuggestion[]
  weatherForecast: { city: string; until: string; temperature: string; conditions: string } | null
  fetchedAt: number // ms timestamp — used to decide whether to silently refresh
}
const _suggestionsCache = new Map<string, SuggestionsSnapshot>()
// Invalidate after 10 minutes so a long-idle session re-fetches
const CACHE_TTL_MS = 10 * 60 * 1000
// In-flight guard: prevents concurrent fetches for the same businessId
// (e.g. React Strict Mode double-effect, or rapid re-mounts)
const _inFlight = new Set<string>()

export function AiSuggestionsCard({ onSelectSuggestion, onGenerate, businessId, selectedIdea }: AiSuggestionsCardProps) {
  const { t } = useTranslation()
  const currentTier = useTierStore((s) => s.currentTier)
  const canUseAiIdeas = useTierStore((s) => s.canUseAiIdeas)
  const incrementAiIdeas = useTierStore((s) => s.incrementAiIdeas)

  // Pre-populate from module cache so remounts (navigating back) show data instantly
  const memCache = businessId ? _suggestionsCache.get(businessId) : null
  const isCacheValid = !!memCache && (Date.now() - memCache.fetchedAt) < CACHE_TTL_MS

  const [suggestions, setSuggestions] = useState<PostSuggestion[]>(isCacheValid ? memCache!.suggestions : [])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isInitialLoad, setIsInitialLoad] = useState(!isCacheValid)
  const [weatherForecast, setWeatherForecast] = useState<{ city: string; until: string; temperature: string; conditions: string } | null>(isCacheValid ? memCache!.weatherForecast : null)
  const [openPhotoIdeas, setOpenPhotoIdeas] = useState<Set<number>>(new Set())
  const togglePhotoIdea = (id: number) => setOpenPhotoIdeas(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  
  console.log('[AiSuggestionsCard] Render:', { businessId, isInitialLoad, isLoading, hasSuggestions: suggestions.length > 0 })

  const fetchSuggestions = useCallback(async (regenerate = false) => {
    console.log('[AiSuggestionsCard] fetchSuggestions called:', { regenerate, businessId })
    if (!businessId) return
    
    // Return early if a fetch is already in progress for this businessId (prevents
    // React Strict Mode double-effect from making two concurrent API calls).
    if (!regenerate && _inFlight.has(businessId)) {
      console.log('[AiSuggestionsCard] Skipping duplicate fetch — already in flight')
      return
    }
    
    // Check quota only when generating new suggestions
    if (regenerate) {
      const canGenerate = canUseAiIdeas()
      if (!canGenerate) {
        setError(t('dashboard.quotaExceeded'))
        return
      }
      // Invalidate module cache so fresh results replace the old ones
      _suggestionsCache.delete(businessId)
    }
    
    _inFlight.add(businessId)
    setIsLoading(true)
    setError(null)
    
    try {
      // Call edge function for quick suggestions
      const { data, error: fnError } = await supabase.functions.invoke('get-quick-suggestions', {
        body: {
          businessId,
          count: 3,
          tier: currentTier,
          regenerate  // Pass regenerate flag
        }
      })
      
      if (fnError) throw fnError
      
      console.log('[AiSuggestionsCard] Response data:', { 
        hasSuggestions: !!data?.suggestions, 
        cached: data?.cached,
        weatherForecast: data?.weatherForecast 
      })
      
      if (data?.suggestions && Array.isArray(data.suggestions)) {
        const mappedSuggestions = data.suggestions.map((s: any, i: number) => ({
          id: s.id || i + 1,
          title: s.title,
          rationale: s.rationale || s.why_explanation || '',
          whyExplanation: s.why_explanation || s.rationale || '',
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
        setSuggestions(mappedSuggestions)
        
        // Set weather forecast if available
        let parsedForecast: { city: string; until: string; temperature: string; conditions: string } | null = null
        if (data.weatherForecast) {
          console.log('[AiSuggestionsCard] Setting weather forecast:', data.weatherForecast)
          try {
            parsedForecast = typeof data.weatherForecast === 'string' 
              ? JSON.parse(data.weatherForecast) 
              : data.weatherForecast
            setWeatherForecast(parsedForecast)
          } catch (e) {
            console.error('Failed to parse weather forecast:', e)
          }
        }

        // Save to module-level cache so navigating back is instant
        if (businessId) {
          _suggestionsCache.set(businessId, {
            suggestions: mappedSuggestions,
            weatherForecast: parsedForecast,
            fetchedAt: Date.now(),
          })
        }
        
        // Increment quota only when actually generating (not loading cached)
        if (regenerate || !data.cached) {
          incrementAiIdeas()
        }
      }
    } catch (err) {
      console.error('Failed to fetch suggestions:', err)
      setError(t('dashboard.suggestionsError'))
    } finally {
      if (businessId) _inFlight.delete(businessId)
      setIsLoading(false)
      setIsInitialLoad(false)
    }
  }, [businessId, currentTier, t, canUseAiIdeas, incrementAiIdeas])

  // Load suggestions on mount
  useEffect(() => {
    console.log('[AiSuggestionsCard] useEffect running:', { businessId, isInitialLoad })
    if (businessId && isInitialLoad) {
      console.log('[AiSuggestionsCard] Triggering initial fetch...')
      fetchSuggestions(false) // false = don't regenerate, load existing
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, isInitialLoad])

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
    return (
      <div className="space-y-4">
        <p className="text-base font-semibold text-[#0F172A]">
          {t('dashboard.headlinePromptFallback')}
        </p>
        <p className="text-sm text-red-600">{error}</p>
        {!error.includes(t('dashboard.quotaExceeded')) && (
          <button
            onClick={() => fetchSuggestions(true)}
            className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand/90 transition-colors text-sm font-medium"
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
          className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand/90 transition-colors text-sm font-medium flex items-center gap-2"
        >
          <span>✨</span>
          <span>{t('dashboard.generateIdeas')}</span>
        </button>
      </div>
    )
  }

  // ── Suggestions list ──
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
              {t('dashboard.weatherValidUntil')} {weatherForecast.until}
            </p>
            <p className="text-sm font-medium text-gray-700">
              {weatherForecast.temperature}, {weatherForecast.conditions}
            </p>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {suggestions.map((suggestion) => {
          const isSelected = selectedIdea === suggestion.id.toString()
          return (
          <div
            key={suggestion.id}
            className={`relative p-4 border-2 rounded-lg transition-all ${
              isSelected 
                ? 'border-mint bg-mint/10 shadow-lg' 
                : 'border-gray-200 hover:border-mint hover:bg-mint/5 cursor-pointer'
            }`}
            onClick={() => !isSelected && onSelectSuggestion(suggestion)}
          >
            <div className="flex items-start gap-3">
              <ContentTypeIcon contentType={suggestion.contentType} className="w-5 h-5 mt-0.5 text-text" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 mb-2">
                  {suggestion.title.replace(/\.$/, '')}
                </p>
                
                {suggestion.whyExplanation && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-brand mb-1">
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

                {suggestion.suggestedTime && (() => {
                  const timeHHMM = suggestion.suggestedTime!.slice(0, 5)
                  const todayISO = new Date().toISOString().split('T')[0]
                  const tomorrowISO = new Date(Date.now() + 86400000).toISOString().split('T')[0]
                  const suggDate = suggestion.suggestedDate || todayISO
                  const timeLabel = suggDate === tomorrowISO
                    ? `${t('dashboard.suggestedTimeTomorrow')} ${timeHHMM}`
                    : suggDate === todayISO
                    ? `${t('dashboard.suggestedTimeToday')} ${timeHHMM}`
                    : `${timeHHMM}`
                  const timeReasons = t('dashboard.timeReason', { returnObjects: true }) as Record<string, string>
                  const reason = timeReasons[timeHHMM] || undefined
                  return (
                    <span className="text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded">
                      🕐 {timeLabel}
                      {reason && (
                        <span className="text-amber-500 font-normal"> · {reason}</span>
                      )}
                    </span>
                  )
                })()}
              </div>
            </div>
            
            {/* Top right corner: Checkmark + Arrow when selected */}
            {isSelected && (
              <div className="absolute top-3 right-3 flex items-center gap-2">
                <span className="text-mint text-lg">✓</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onGenerate?.()
                  }}
                  className="w-8 h-8 rounded-full bg-mint hover:bg-[#6FE0C2] text-white flex items-center justify-center transition-colors shadow-md hover:shadow-lg"
                  title={t('dashboard.generatePostWithAI')}
                >
                  <span className="text-lg">→</span>
                </button>
              </div>
            )}
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
        onClick={() => fetchSuggestions(true)}
        className="w-full text-center text-sm text-gray-500 hover:text-gray-700 py-2 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
      >
        {t('dashboard.regenerateIdeas')}
      </button>

    </div>
  )
}
