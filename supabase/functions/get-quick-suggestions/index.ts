// supabase/functions/get-quick-suggestions/index.ts
// Lightweight AI suggestion generator for post-onboarding dashboard
// Returns 3 simple suggestions based on weather + top 5 menu items
// NOT full Layer 0 - just enough for quick suggestions
// Version: 2026-06-24-refactored - Modularized architecture

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// New modular imports (June 24, 2026 refactoring)
import type { QuickSuggestionsRequest, QuickSuggestionsResponse } from './types.ts'
import { checkCache, buildCachedResponse } from './cache-manager.ts'
import { fetchAllBusinessContext } from './context-fetcher.ts'
import { buildBrandContext } from './brand-context-builder.ts'
import { persistAndAssemble, determineContentAngle } from './suggestion-persister.ts'
import { callGemini, callGeminiArray, getGeminiApiKey } from './ai-client.ts'
import { buildDagensSystemInstruction, generateDayFraming } from './prompt-builder.ts'
import { detectHybridVerticals, resolveActiveVertical } from '../_shared/business-type-helpers.ts'
import { isValidBusinessCharacter } from '../_shared/brand-profile/business-type-detection.ts'
import { extractBrandEssence, extractPositioning, extractUSP } from '../_shared/brand-profile/v5-extractors.ts'
import { countryToLangCode } from '../_shared/utils/hospitality-register.ts'
import { countryToLanguageCode } from '../_shared/helpers/country-to-language.ts'
import { matchPersonaToCurrentHour, matchActiveSegment, matchPersonaWithV5Programmes, type PersonaMatchResult, type AudienceSegment, type V5ProgrammeProfile, type BusinessOperations } from '../_shared/persona-matcher.ts'
import { assembleBusinessIntelligence } from '../_shared/post-helpers/assemble-business-intelligence.ts'
import {
  getMenuRotationQueue,
  detectServicePeriod,
  loadMinimalBrandVoice,
  type RotationQueueItem
} from '../_shared/content-planning/index.ts'
import {
  type DagensPromptContext,
  type MenuCategory,
  type SlotPlannerResult,
  buildMenuBlock,
  buildMenuBlockExcluding,
  buildSharedContext,
  buildFreeSharedContext,
  buildSharedRules,
  buildFreeSharedRules,
  buildComprehensiveNeverSayList,
  runSlotPlanner,
  buildSlotAPrompt,
  buildSlotBPrompt,
  buildSlotCPrompt,
  buildUnifiedPrompt,
  buildUnifiedPromptBC,
  normalizeDishName,
} from '../_shared/dagens-forslag-prompt-builder.ts'
import { createSecurityAuditLog, isBusinessAccessDenied, redactIdentifier } from './security-audit.ts'
import { buildOperationalTimeline, type OperationalTimeline } from './operational-timeline.ts'
import { calculateSlots, type SlotCalculationResult, type SlotTiming as NewSlotTiming } from './slot-calculator.ts'
import { validateAndRepair } from './output-validator.ts'
import { assessOutdoorComfort } from '../_shared/post-helpers/strategy/weather-comfort-tiers.ts'
import { fetchWeatherFromCoordinates, createSeasonalFallbackWeather } from '../get-weekly-strategy/weather-fetcher.ts'
import { needsSpellingCheck } from '../generate-text-from-idea/post-process.ts'
import { silentCorrect } from '../_shared/utils/silent-correct.ts'
// NEW: Dynamic suggestion count + behavioral logic (June 2026)
import { calculateDynamicSuggestions, type CalculationContext } from '../_shared/content-planning/dynamic-suggestion-calculator.ts'
import { analyzeBehavioralContext, type BehavioralAnalysisInput, type MenuItem as BehavioralMenuItem } from '../_shared/content-planning/behavioral-context-analyzer.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Safe Hospitality Fallback for FREE tier ──
// For Free tier, we use this universal safe tone that works for 90% of Danish hospitality
const SAFE_HOSPITALITY_FALLBACK = {
  formalityLevel: 'casual',      // Næsten ingen dansk hospitality bruger formel tone
  addressForm: 'du-tiltale',     // >90% af danske caféer/restauranter bruger du
  sentenceStyle: 'beskrivende',
  personalityTraits: ['venlig', 'informativ'],  // Positive uden at være for følelsesladet
  brandVoiceSummary: null,       // Opfind ikke noget
}

// ── Helper: Content-aware suggested time ──
// Returns the ideal posting hour (HH:MM) based on what is being posted.
// Uses actual program times from menu when available, falls back to keyword heuristics.
// The frontend handles rolling to tomorrow if the slot has already passed.
function getContentAwareTime(
  contentType: string, 
  title: string, 
  todayOpenTime?: string | null, 
  todayCloseTime?: string | null,
  kitchenCloseTime?: string | null,
  programs?: Array<{name: string; start: string; end: string}>,
  nowOverrideMins?: number  // Client-provided local time in minutes since midnight
): string {
  const t = title.toLowerCase()
  
  console.log(`🕐 getContentAwareTime: title="${title}", programs=${programs ? JSON.stringify(programs) : 'null'}`)
  
  const toMinutes = (hhmm: string, defaultM = 0) => {
    const [h, m = defaultM] = hhmm.split(':').map(Number)
    return h * 60 + m
  }
  const fromMinutes = (mins: number) =>
    `${Math.floor(mins / 60).toString().padStart(2, '0')}:${(mins % 60).toString().padStart(2, '0')}`

  // Timing helpers (declared in function scope for reuse)
  const nowMins = nowOverrideMins ?? (new Date().getHours() * 60 + new Date().getMinutes())
  // Midnight-safe end time helper (bars / clubs closing at 01:00, 02:00 etc.)
  const safeEnd = (hhmm: string) => { const m = toMinutes(hhmm); return m < 600 ? m + 1440 : m }

  // Try to match content to a specific program from menu.
  // Three-pass strategy so any business — regardless of how they name their programs — gets
  // program-aware timing rather than a hardcoded hour guess.
  if (programs && programs.length > 0) {
    // Remaining programs (active or not yet started)
    const remaining = programs.filter(p => safeEnd(p.end) > nowMins)

    // ── Pass 1: specific Danish service-period keywords ──────────────────────
    // Handles the majority of standard café/restaurant programs.
    for (const prog of programs) {
      const progName = prog.name.toLowerCase()

      // Brunch
      if (/brunch|morgen|breakfast/.test(progName) &&
          (/brunch|morgen|morgenmad|breakfast|æg|croissant|granola|acai|boller|pandekage|vaffel/.test(t) ||
           /brunch|morgenmad|breakfast/.test(t))) {
        const startMins = toMinutes(prog.start)
        const endMins = toMinutes(prog.end)
        const midPoint = startMins + Math.min(90, Math.floor((endMins - startMins) * 0.4))
        const suggestedMins = Math.max(startMins + 60, midPoint)
        if (suggestedMins < nowMins) { console.log(`⚠️ Skipping BRUNCH — ${fromMinutes(suggestedMins)} past`); continue }
        console.log(`✅ Pass-1 BRUNCH match "${prog.name}" → ${fromMinutes(suggestedMins)}`)
        return fromMinutes(suggestedMins)
      }

      // Lunch / frokost
      if (/frokost|lunch/.test(progName) &&
          /frokost|sandwich|smørbr|suppe|salat|wrap|baguette/.test(t)) {
        const startMins = toMinutes(prog.start)
        const endMins = toMinutes(prog.end)
        const suggestedMins = Math.max(startMins + 30, endMins - 120)
        if (suggestedMins < nowMins) { console.log(`⚠️ Skipping LUNCH — ${fromMinutes(suggestedMins)} past`); continue }
        console.log(`✅ Pass-1 LUNCH match "${prog.name}" → ${fromMinutes(suggestedMins)}`)
        return fromMinutes(suggestedMins)
      }

      // Dinner / evening
      if (/aften|dinner|evening/.test(progName) &&
          /aftensmad|middag|3-retters|tre retters|aftenmenu|bøf|vildt|pasta/.test(t)) {
        const startMins = toMinutes(prog.start)
        const preDinnerMins = startMins - 30
        const suggestedMins = preDinnerMins < nowMins ? nowMins + 15 : preDinnerMins
        console.log(`✅ Pass-1 DINNER match "${prog.name}" → ${fromMinutes(suggestedMins)}`)
        return fromMinutes(suggestedMins)
      }
    }

    // ── Pass 2: generic word-overlap ─────────────────────────────────────────
    // Handles any program with a non-standard name: "COCKTAILBAR", "MORGENCAFÉ",
    // "FROKOSTSERVERING", "TEATERMENU", etc.
    // Splits on separators AND common Danish compound-word suffixes so "COCKTAILBAR"
    // yields ["cocktail", "bar"], and "MORGENCAFÉ" yields ["morgen", "café"].
    const splitProgName = (name: string): string[] => {
      const suffixes = ['bar', 'café', 'cafe', 'kro', 'menu', 'mad', 'ret', 'kort', 'list']
      return name.toLowerCase()
        .split(/[\s\-_\/&]+/)
        .flatMap(word => {
          for (const sfx of suffixes) {
            if (word.endsWith(sfx) && word.length > sfx.length + 2) {
              return [word.slice(0, word.length - sfx.length), sfx]
            }
          }
          return [word]
        })
        .filter(w => w.length >= 4)
    }
    for (const prog of remaining) {
      const progWords = splitProgName(prog.name)
      const hasOverlap = progWords.some(w => t.includes(w))
      if (!hasOverlap) continue

      const startMins = toMinutes(prog.start)
      const endMins = safeEnd(prog.end)
      // Post 30% into the service window (captures active period)
      const suggestedMins = startMins + Math.round((endMins - startMins) * 0.3)
      const clamped = Math.max(nowMins + 15, suggestedMins)
      console.log(`✅ Pass-2 word-overlap match "${prog.name}" (${progWords.join('|')}) → ${fromMinutes(clamped)}`)
      return fromMinutes(clamped)
    }

    // ── Pass 3: active/next program window (menu_item only) ──────────────────
    // When the title has no keyword overlap with any program name, menu posts should
    // still land inside the nearest open service window — not at a hardcoded default.
    // This makes any business correct without requiring keyword tuning.
    if (contentType === 'menu_item' && remaining.length > 0) {
      // Prefer the program that is currently active (started but not ended), else the next one
      const active = remaining.find(p => toMinutes(p.start) <= nowMins) ?? remaining[0]
      const startMins = toMinutes(active.start)
      const endMins = safeEnd(active.end)
      const optimalMins = Math.max(nowMins + 15, startMins + Math.round((endMins - startMins) * 0.3))
      console.log(`✅ Pass-3 active-program fallback "${active.name}" → ${fromMinutes(optimalMins)}`)
      return fromMinutes(optimalMins)
    }
  }

  // ── No program match — keyword heuristics ────────────────────────────────
  console.log('⚠️ No program match, using keyword heuristics')
  let slotTime: string
  let matchedServicePeriod: string | null = null
  
  if (contentType === 'menu_item') {
    if (/brunch|morgen|morgenmad|breakfast|æg|croissant|granola|acai|boller|pandekage|vaffel/.test(t)) {
      slotTime = '09:00'
      matchedServicePeriod = 'brunch'
    } else if (/frokost|sandwich|smørbr|suppe|salat|wrap|baguette/.test(t)) {
      slotTime = '11:00'
      matchedServicePeriod = 'lunch'
    } else if (/aftensmad|middag|3-retters|tre retters|aftenmenu|bøf|vildt|pasta ret/.test(t)) {
      slotTime = '17:00'
      matchedServicePeriod = 'dinner'
    } else {
      slotTime = '12:00'
    }
  } else {
    if (/brunch|morgenmad|breakfast/.test(t)) {
      slotTime = '10:00'
      matchedServicePeriod = 'brunch'
    } else {
      slotTime = '14:00'
    }
  }

  // ── Guard: Check if keyword-matched service period has already ended ──
  // If we matched "brunch" by keyword but the BRUNCH program ended at 14:00,
  // and it's now 18:00, we should NOT suggest this dish at all.
  if (matchedServicePeriod && programs && programs.length > 0) {
    const matchedProgram = programs.find(p => {
      const pName = p.name.toLowerCase()
      if (matchedServicePeriod === 'brunch') return /brunch|morgen|breakfast/.test(pName)
      if (matchedServicePeriod === 'lunch') return /frokost|lunch/.test(pName)
      if (matchedServicePeriod === 'dinner') return /aften|dinner|evening/.test(pName)
      return false
    })
    
    if (matchedProgram) {
      const progEndMins = safeEnd(matchedProgram.end)
      if (progEndMins <= nowMins) {
        console.log(`⚠️ Keyword-matched service period "${matchedServicePeriod}" (${matchedProgram.name}) has ended (${matchedProgram.end}). Cannot suggest this dish.`)
        // Return a time far in the future so it gets filtered out by downstream logic
        return '23:59'
      }
      // Also check if the suggested time would be after the program ends
      const tentativeMins = toMinutes(slotTime)
      if (tentativeMins >= progEndMins - 60) {
        console.log(`⚠️ Keyword-matched time ${slotTime} is too close to ${matchedProgram.name} end (${matchedProgram.end}). Adjusting to program window.`)
        // Suggest a time within the program window instead
        const progStartMins = toMinutes(matchedProgram.start)
        slotTime = fromMinutes(Math.max(progStartMins + 30, progEndMins - 120))
      }
    }
  }

  let slotMins = toMinutes(slotTime)

  // Lower-bound clamp: never suggest posting before the business opens (+30 min buffer)
  if (todayOpenTime) {
    const openMins = toMinutes(todayOpenTime)
    if (slotMins < openMins) {
      slotMins = openMins + 30
    }
  }

  // Kitchen close time gate: never suggest food posts within 30 min of kitchen close
  // (prevents suggesting dinner posts when kitchen is already closed)
  if (kitchenCloseTime && contentType === 'menu_item') {
    const kitchenCloseMins = toMinutes(kitchenCloseTime)
    const latestAllowedForFood = kitchenCloseMins - 30
    if (slotMins >= latestAllowedForFood) {
      const openMins = todayOpenTime ? toMinutes(todayOpenTime) : 0
      // Walk back to safe zone before kitchen closes
      slotMins = latestAllowedForFood > openMins
        ? Math.round((openMins + latestAllowedForFood) / 2)
        : openMins + 30
    }
  }

  // Upper-bound clamp: never suggest posting within 60 min of close (post would go out
  // when service is ending or already over — e.g. brunch atmosphere post at 14:00 when
  // brunch ends at 14:00). Walk back to close - 60 min; if that is still before open,
  // fall back to midpoint between open and close.
  if (todayCloseTime) {
    let closeMins = toMinutes(todayCloseTime)
    const openMins = todayOpenTime ? toMinutes(todayOpenTime) : 0
    // Midnight-crossing venues (e.g. close 00:00, 01:00, 02:00) have closeMins <= openMins.
    // Treat them as next-day (add 24h) so the clamp works correctly.
    if (closeMins <= openMins) closeMins += 1440
    const latestAllowed = closeMins - 60
    if (slotMins >= latestAllowed) {
      // Use midpoint between open and (close - 60 min), or fall back to open + 30
      slotMins = latestAllowed > openMins
        ? Math.round((openMins + latestAllowed) / 2)
        : openMins + 30
    }
  }

  // Final clamp: never suggest posting in the past (now + 15 min minimum buffer)
  const nowMinsForClamp = nowOverrideMins ?? (new Date().getHours() * 60 + new Date().getMinutes())
  if (slotMins < nowMinsForClamp + 15) {
    console.log(`⏩ Clamped to now+15min: ${fromMinutes(nowMinsForClamp + 15)} (was ${fromMinutes(slotMins)})`)
    slotMins = nowMinsForClamp + 15
  }

  return fromMinutes(slotMins)
}

// ── Helper: Menu availability_days DOW check ──
// Parses the AI-extracted availability_days text (e.g. "dagligt", "mandag-fredag",
// "onsdag-lørdag", "hverdage") and returns whether todayDow (getDay()) is included.
// Returns true for null / unrecognised values (conservative — don't hide menus).
function isMenuAvailableOnDay(availabilityDays: string | null, todayDow: number): boolean {
  if (!availabilityDays) return true
  const lower = availabilityDays.trim().toLowerCase()
  if (!lower || /dagligt|daily|alle dage|every day/.test(lower)) return true
  // Weekday shortcuts
  if (/^hverdage$|^weekdays?$/.test(lower)) return todayDow >= 1 && todayDow <= 5
  if (/^(kun )?weekende?r?$|^weekends?$/.test(lower)) return todayDow === 0 || todayDow === 6
  const AVAIL_DAY: Record<string, number> = {
    søndag: 0, sunday: 0, søn: 0, sun: 0,
    mandag: 1, monday: 1, man: 1, mon: 1,
    tirsdag: 2, tuesday: 2, tir: 2, tue: 2,
    onsdag: 3, wednesday: 3, ons: 3, wed: 3,
    torsdag: 4, thursday: 4, tor: 4, thu: 4,
    fredag: 5, friday: 5, fre: 5, fri: 5,
    lørdag: 6, saturday: 6, lør: 6, sat: 6,
  }
  // Range with hyphen, en-dash, "to", or "til": "mandag-fredag", "onsdag–lørdag", "onsdag til lørdag"
  const rangeMatch = lower.match(/([a-z\u00e6\u00f8\u00e5]+)\s*(?:[-\u2013]|to|til)\s*([a-z\u00e6\u00f8\u00e5]+)/)
  if (rangeMatch) {
    const ds = AVAIL_DAY[rangeMatch[1]]
    const de = AVAIL_DAY[rangeMatch[2]]
    if (ds !== undefined && de !== undefined) {
      return de >= ds ? todayDow >= ds && todayDow <= de : todayDow >= ds || todayDow <= de
    }
  }
  // Single day name: "fredag", "lørdag"
  const single = AVAIL_DAY[lower]
  if (single !== undefined) return todayDow === single
  return true // unrecognised → assume available
}

// ── Helper: Day-of-week behavioral state ──
type DayBehavior = {
  mode: string; danishMode: string; emphasis: string
  avoidPushFootfall: boolean; offeringTone: string
  slotBDefault: string; slotCDefault: string
}
function getDayBehavior(dayIndex: number): DayBehavior {
  const behaviors: DayBehavior[] = [
    { mode: 'sunday_slow',     danishMode: 'Søndagsrolig',         emphasis: 'langsom start, brunch, afslapning',           avoidPushFootfall: false, offeringTone: 'hyggelig og uformel',     slotBDefault: 'brunch_moment',    slotCDefault: 'atmosphere'    },
    { mode: 'weekday_restart', danishMode: 'Mandags-restart',       emphasis: 'frisk start, frokostpause, ny uge',           avoidPushFootfall: false, offeringTone: 'energisk og informativ', slotBDefault: 'lunch_moment',     slotCDefault: 'behind_scenes' },
    { mode: 'midweek_quiet',   danishMode: 'Rolig hverdag',         emphasis: 'hverdagsrutine, stille øjeblikke',             avoidPushFootfall: false, offeringTone: 'rolig og informativ',   slotBDefault: 'lunch_moment',     slotCDefault: 'atmosphere'    },
    { mode: 'hump_day',        danishMode: 'Midt på ugen',          emphasis: 'lille pause i ugen, hverdag med charme',       avoidPushFootfall: false, offeringTone: 'imødekommende',         slotBDefault: 'lunch_moment',     slotCDefault: 'behind_scenes' },
    { mode: 'pre_weekend',     danishMode: 'Torsdag – pre-weekend', emphasis: 'forhype til weekend, afterwork, socialt',      avoidPushFootfall: false, offeringTone: 'let festlig',            slotBDefault: 'afterwork_moment', slotCDefault: 'atmosphere'    },
    { mode: 'friday_social',   danishMode: 'Fredagsvibes',          emphasis: 'fyraftensdrink, weekend starter, socialt samvær', avoidPushFootfall: false, offeringTone: 'festlig og indbydende', slotBDefault: 'afterwork_moment', slotCDefault: 'atmosphere'    },
    { mode: 'weekend_peak',    danishMode: 'Weekendpeak',           emphasis: 'brunch, frokost, gæster med tid',             avoidPushFootfall: false, offeringTone: 'varm og social',         slotBDefault: 'brunch_moment',    slotCDefault: 'atmosphere'    },
  ]
  return behaviors[dayIndex] ?? behaviors[1]
}

// ── Helper: Determine current active program from menu times ──
function getCurrentProgram(
  programs: Array<{name: string; start: string; end: string}>,
  currentTime: Date = new Date()
): {name: string; start: string; end: string; hoursUntilClose: number} | null {
  if (programs.length === 0) return null
  
  const currentHour = currentTime.getHours()
  const currentMinutes = currentHour * 60 + currentTime.getMinutes()
  
  // Parse time string "HH:MM" to minutes since midnight
  const parseTime = (timeStr: string): number => {
    const [h, m] = timeStr.split(':').map(Number)
    return h * 60 + (m || 0)
  }
  
  // Find program that covers current time
  for (const prog of programs) {
    const startMins = parseTime(prog.start)
    let endMins = parseTime(prog.end)
    
    // Handle midnight crossing (e.g., 16:00-23:00)
    if (endMins < startMins) endMins += 24 * 60
    
    // Check if current time falls within this program
    const isActive = currentMinutes >= startMins && currentMinutes < endMins
    
    if (isActive) {
      const hoursUntilClose = (endMins - currentMinutes) / 60
      return {
        name: prog.name,
        start: prog.start,
        end: prog.end,
        hoursUntilClose: Math.max(0, hoursUntilClose)
      }
    }
  }
  
  return null
}

// ── Helper: Derive service period from opening hours ──
function deriveServicePeriod(openTime: string | null, closeTime: string | null): 'brunch' | 'lunch' | 'dinner' | 'all_day' | null {
  if (!openTime || !closeTime) return null
  const [openH] = openTime.split(':').map(Number)
  const [closeH] = closeTime.split(':').map(Number)
  // Treat midnight/early-morning closings (00:xx–05:xx) as late-night, not afternoon.
  // Without this, a venue open 09:30–00:00 gets closeH=0, and 0 ≤ 16 falsely returns 'brunch'.
  const normalizedCloseH = closeH < 6 ? closeH + 24 : closeH
  if (openH >= 17) return 'dinner'
  if (openH <= 11 && normalizedCloseH <= 16) return 'brunch'
  if (openH <= 11 && normalizedCloseH <= 20) return 'lunch'
  return 'all_day'
}

// ── Helper: Rotate Slot B+C content types based on recent history ──
type RecentSuggestion = { title: string; content_type: string; photo_idea: string }
function getSlotBCTypes(recentSugg: RecentSuggestion[], dayBehavior: DayBehavior): { slotB: string; slotC: string } {
  const recentTypes = recentSugg.map((s) => s.content_type || '')
  const behindCount = recentTypes.filter((t) => t === 'behind_scenes').length
  const atmoCount = recentTypes.filter((t) => t === 'atmosphere').length
  // Rotate in behind_scenes if atmosphere has dominated recently
  if (atmoCount >= 3 && behindCount < 2) {
    return { slotB: dayBehavior.slotBDefault, slotC: 'behind_scenes' }
  }
  return { slotB: dayBehavior.slotBDefault, slotC: dayBehavior.slotCDefault }
}

// ── repairSuggestions ────────────────────────────────────────────────────────
// Validates and repairs Gemini output before DB save:
//   1. concrete_anchor repair — weak/mood-only anchors for non-menu slots are
//      replaced with the most relevant entry from the confirmed facts bank.
//   2. why_explanation sanitiser — imperative/promotional copy is cleared so
//      the owner-facing "💡 Hvorfor dette opslag?" section stays neutral.
function repairSuggestions(suggestions: any[], confirmedFacts: string[]): any[] {
  const moodOnlyPattern = /^(hyggelig|stemning|atmosf[æa]re|varme|ro\b|energi|f[æa]llesskab|oplevelse|vibe|sj[æa]l|charme|[åa]nd\b)/i
  suggestions = suggestions.map((s: any, idx: number) => {
    if (s.slot === 'offering' || s.content_type === 'menu_item') return s
    const anchor: string = (s.concrete_anchor || '').trim()
    const isWeak = anchor.length < 20 || moodOnlyPattern.test(anchor)
    if (!isWeak) return s
    let fallback = ''
    if (s.slot === 'guest_moment') {
      fallback = confirmedFacts.find(f => f.startsWith('Åbningstider') || f.startsWith('Åbner'))
        || confirmedFacts.find(f => f.toLowerCase().includes('udeservering'))
        || confirmedFacts[0]
        || ''
    } else {
      // brand_behind / behind_scenes
      // Prefer differentiator and character facts over interior description.
      // 'Rum/interiør' is explicitly banned for atmosphere/BTS posts
      // and must not be selected as a fallback anchor.
      fallback = confirmedFacts.find(f => f.startsWith('Hvad adskiller dem'))
        || confirmedFacts.find(f => f.startsWith('Stedet er'))
        || confirmedFacts.find(f => f.startsWith('Historien bag stedet'))
        || confirmedFacts.find(f => f.startsWith('Åbningstider') || f.startsWith('Åbner'))
        || confirmedFacts.find(f => !f.startsWith('Rum/interiør'))
        || ''
    }
    if (fallback) {
      console.log(`⚠️ Slot ${idx + 1} anchor repaired: "${anchor.slice(0, 40)}" → "${fallback}"`)
      return { ...s, concrete_anchor: fallback }
    }
    return s
  })

  const WHY_CAPTION_RE = /^(forkæl|kom ind|nyd |prøv |bestil|book |ring |spar |tilbyd|giv dig selv|få en |lad os|se vores|\✅|💡|🥗|🍽)/i
  return suggestions.map((s: any) => {
    const why = (s.why_explanation || '').trim()
    if (why && WHY_CAPTION_RE.test(why)) {
      console.warn(`⚠️ why_explanation looks like promotional copy — clearing: "${why.slice(0, 60)}..."`)
      return { ...s, why_explanation: '' }
    }
    return s
  })
}

// ── Request handler ──────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { businessId, count = 1, tier = 'free', regenerate = false, localTime, clientTime, localDate, userContext, debug = false } = await req.json()
    
    // Use client-provided local time if available — eliminates timezone inference errors.
    // The client sends new Date().toISOString() at the moment the user presses "Generate".
    // Accept both `localTime` (production field name) and `clientTime` (test/debug alias).
    const clientNow = (localTime || clientTime) ? new Date(localTime || clientTime) : new Date()
    
    console.log('🎯 get-quick-suggestions called (SINGLE SUGGESTION MODE):', { businessId, tier, regenerate, localTime: localTime ?? 'server', userContext: userContext ? '[provided]' : undefined })
    
    if (!businessId) {
      return new Response(JSON.stringify({ error: 'businessId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── fetchContext ────────────────────────────────────────────────────────
    // DB fetches: business, operations, opening_hours, location, menu, weather,
    // contextual calendar, brand profile, recent suggestions.
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const skipAuth = Deno.env.get('SKIP_AUTH') === 'true' || Deno.env.get('DENO_ENV') === 'development'

    if (skipAuth) {
      console.warn(
        '🔒',
        createSecurityAuditLog('auth_bypassed', {
          businessId: redactIdentifier(businessId),
          reason: 'skip_auth_or_development',
        }),
      )
    }

    if (!skipAuth && !supabaseAnonKey) {
      console.error(
        '🔒',
        createSecurityAuditLog('auth_config_error', {
          businessId: redactIdentifier(businessId),
          reason: 'missing_supabase_anon_key',
        }),
      )
      return new Response(JSON.stringify({ error: 'SUPABASE_ANON_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!skipAuth) {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) {
        console.warn(
          '🔒',
          createSecurityAuditLog('unauthorized_request', {
            businessId: redactIdentifier(businessId),
            reason: 'missing_authorization_header',
          }),
        )
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const authClient = createClient(supabaseUrl, supabaseAnonKey!, {
        global: { headers: { Authorization: authHeader } },
      })

      const { data: userData, error: userError } = await authClient.auth.getUser()
      if (userError || !userData?.user) {
        console.warn(
          '🔒',
          createSecurityAuditLog('unauthorized_request', {
            businessId: redactIdentifier(businessId),
            reason: 'invalid_or_expired_user',
          }),
        )
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: ownedBusiness, error: ownershipError } = await createClient(supabaseUrl, supabaseKey)
        .from('businesses')
        .select('id, owner_id')
        .eq('id', businessId)
        .single()

      if (ownershipError || !ownedBusiness) {
        console.warn(
          '🔒',
          createSecurityAuditLog('business_lookup_failed', {
            businessId: redactIdentifier(businessId),
            requester: redactIdentifier(userData.user.id),
          }),
        )
        return new Response(JSON.stringify({ error: 'Business not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (isBusinessAccessDenied(ownedBusiness.owner_id, userData.user.id)) {
        console.warn(
          '🔒',
          createSecurityAuditLog('access_denied', {
            businessId: redactIdentifier(businessId),
            requester: redactIdentifier(userData.user.id),
            owner: redactIdentifier(ownedBusiness.owner_id),
          }),
        )
        return new Response(JSON.stringify({ error: 'Access denied to this business' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // ── Get today's date for caching and quota checks ──
    const today = localDate || `${clientNow.getFullYear()}-${String(clientNow.getMonth() + 1).padStart(2, '0')}-${String(clientNow.getDate()).padStart(2, '0')}`

    // ── Tier-based logic ──
    const isPaidTier = tier === 'standardplus' || tier === 'premium'
    // Smart (standardplus): multiple menu-item suggestions only — no atmosphere, no behind-the-scenes.
    // Pro (premium): full content mix via planner (atmosphere, BTS, etc.)
    const isProTier = tier === 'premium'

    // ── Check daily quota (FREE and PAID tiers, only if regenerating = new generation) ──
    if (regenerate) {
      // Fetch business quota info
      const { data: businessQuota, error: quotaError } = await supabase
        .from('businesses')
        .select('quick_suggestions_today, plan')
        .eq('id', businessId)
        .single()

      if (quotaError) {
        console.error('❌ Could not check quota:', quotaError)
      } else if (businessQuota) {
        // Note: Counter reset is now handled by get_daily_usage_stats() function
        // This just reads the current counter value to check quota
        const currentCount = businessQuota.quick_suggestions_today || 0

        // Check tier-based limits (regenerations per day)
        // TESTING MODE - All tiers set to 100 for testing
        // Production values: free: 3, standardplus: 3, premium: 5
        const TIER_LIMITS: Record<string, number> = {
          free: 100,  // TESTING: 100 (Production: 3)
          standardplus: 100,  // TESTING: 100 (Production: 3)
          premium: 100,  // TESTING: 100 (Production: 5)
        }
        
        const dailyLimit = TIER_LIMITS[tier] || TIER_LIMITS.free
        
        if (currentCount >= dailyLimit) {
          console.log(`🚫 ${tier.toUpperCase()} tier daily limit exceeded:`, currentCount)
          
          const message = tier === 'free' 
            ? 'Du har brugt din daglige regenerering 😊\nKom tilbage i morgen — eller opgrader til Smart\nfor 3 regenereringer/dag og personlig brand voice.'
            : tier === 'standardplus'
            ? 'Du har brugt dine 3 regenereringer i dag. Kom tilbage i morgen — eller opgrader til Pro for 5/dag.'
            : 'Du har brugt dine 5 regenereringer i dag. Kom tilbage i morgen.'
          
          return new Response(JSON.stringify({ 
            error: 'DAILY_LIMIT_EXCEEDED',
            message: message,
            current: currentCount,
            limit: dailyLimit,
            tier: tier
          }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }
    }

    // ── Check for existing suggestions (unless regenerate = true) ──
    // Use cache-manager module (refactored June 24, 2026)
    const cacheResult = await checkCache({
      businessId,
      today,
      count,
      clientNow,
      regenerate,
      supabase,
      debug,
    })

    if (cacheResult.shouldUseCache && cacheResult.cachedSuggestions) {
      return buildCachedResponse(cacheResult.cachedSuggestions, {
        businessId,
        today,
        supabase,
        tier,
        regenerate,
        count,
        debug,
      })
    }

    // ── Fetch all business context in parallel ──
    // Use context-fetcher module (refactored June 24, 2026)
    const context = await fetchAllBusinessContext(supabase, businessId, clientNow, today, regenerate)
    
    const business = context.business
    const language = context.language
    const operations = context.operations.operations
    const hasOutdoorSeating = context.operations.hasOutdoorSeating
    const hasKidsMenu = context.operations.hasKidsMenu
    const hasTakeaway = context.operations.hasTakeaway
    const hasTableService = context.operations.hasTableService
    const kitchenCloseTime = context.operations.kitchenCloseTime
    const weeklyProgramme = context.operations.weeklyProgramme
    const todayOpenTime = context.hours.todayOpenTime
    const todayCloseTime = context.hours.todayCloseTime
    const isClosedToday = context.hours.isClosedToday
    const location = context.location.location
    const expectedLanguage = context.location.expectedLanguage
    const locationIntelCoords = (context.location.latitude && context.location.longitude) 
      ? { latitude: context.location.latitude, longitude: context.location.longitude }
      : null
    const currentServicePeriod = context.rotation.currentServicePeriod
    const currentServicePeriods = context.rotation.currentServicePeriods
    const rotationQueue = context.rotation.rotationQueue
    const menuDescriptionMap = context.rotation.menuDescriptionMap
    const menuCategoryMap = context.rotation.menuCategoryMap
    // Note: brandProfile and recentSuggestions are fetched later for tier-specific logic

    // Build dish name lookup map for text-based dish extraction
    const dishNameLookup = new Map<string, { id: string | null; name: string }>()
    for (const item of rotationQueue) {
      const normalizedName = item.menu_item_name.toLowerCase().trim()
      dishNameLookup.set(normalizedName, { id: item.menu_item_id, name: item.menu_item_name })
      // Also store without accents for fuzzy matching
      const withoutAccents = normalizedName.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      if (withoutAccents !== normalizedName) {
        dishNameLookup.set(withoutAccents, { id: item.menu_item_id, name: item.menu_item_name })
      }
    }

    // Get menu items (top 5 for free tier)
    const maxItems = tier === 'free' ? 5 : 100
    let signatureItems: string[] = []
    
    // ── Menu Source Priority (Tier-Specific) ────────────────────────────────
    // Free tier:  key_offerings ONLY (no menu extraction)
    // Paid tiers: rotation queue → menu_results_v2 → key_offerings → menu_signal
    
    if (tier === 'free') {
      // Free tier: Fetch key_offerings + descriptive fields for Slot B atmosphere generation
      const { data: profile } = await supabase
        .from('business_profile')
        .select('key_offerings, menu_description, user_about_text, long_description, ai_place_synopsis')
        .eq('business_id', businessId)
        .single()

      if (profile?.key_offerings) {
        // Parse newline-separated list
        const offerings = profile.key_offerings
          .split('\n')
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0)
        
        if (offerings.length > 0) {
          signatureItems = offerings.slice(0, maxItems)
          console.log(`📋 Using key_offerings (Free tier): ${signatureItems.length} items`)
        }
      }
      
      // Store descriptive fields for Free tier Slot B atmosphere generation
      // These will be added to confirmedFactsSlotB later in the flow
      if (tier === 'free') {
        // Store in module-level variable for later use
        (globalThis as any).__freeTierProfile = {
          menuDescription: profile?.menu_description?.trim() || null,
          userAboutText: profile?.user_about_text?.trim() || null,
          longDescription: profile?.long_description?.trim() || null,
          aiPlaceSynopsis: profile?.ai_place_synopsis?.trim() || null,
        }
        console.log(`📝 Free tier profile loaded: menu_description=${!!(profile?.menu_description)}, user_about_text=${!!(profile?.user_about_text)}, long_description=${!!(profile?.long_description)}, ai_place_synopsis=${!!(profile?.ai_place_synopsis)}`)
      }
    } else if (rotationQueue.length > 0) {
      // Paid tiers: Use rotation queue first (fair rotation enabled)
      // When regenerating, shuffle the rotation queue to ensure variety in Gemini's selection
      // Otherwise Gemini will consistently pick the same dishes from the same menu order
      let activeQueue = rotationQueue
      if (regenerate && rotationQueue.length > 3) {
        // Fisher-Yates shuffle of the top N dishes to give Gemini variety
        const shuffleArray = <T,>(array: T[]): T[] => {
          const shuffled = [...array]
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
          }
          return shuffled
        }
        
        // Shuffle top 20 dishes (or all if less than 20) to create variety
        const topN = Math.min(20, rotationQueue.length)
        const topDishes = rotationQueue.slice(0, topN)
        const remainingDishes = rotationQueue.slice(topN)
        activeQueue = [...shuffleArray(topDishes), ...remainingDishes]
        console.log(`🔀 Regenerate mode: shuffled top ${topN} dishes for variety`)
        console.log(`   New top 3: ${activeQueue.slice(0, 3).map(d => d.menu_item_name).join(', ')}`)
      }
      
      signatureItems = activeQueue
        .slice(0, maxItems)
        .map(item => item.menu_item_name)
      console.log(`✅ Using rotation queue: ${signatureItems.length} dishes (fair rotation enabled)`)
    }
    // ────────────────────────────────────────────────────────────────────────
    
    // Structured category list for the Gemini prompt (paid tier — built from menu_results_v2)
    const menuCategoryEntries: { catName: string; items: { name: string; description: string }[] }[] = []
    // Tier 3 facts from ai_summary: specific verifiable signals for Slot B/C idea generation
    // (named dishes/concepts in quotes, dietary options, drink programmes, kids menu)
    const menuIntelligenceFacts: string[] = []
    // Program times from menu (service periods with accurate hours: Brunch 09:00-14:00, etc)
    const programsFromMenu: Array<{name: string; start: string; end: string; confidence?: number}> = []
    // Builds menu category entries for a specific target hour — used to give Slot B/C
    // the correct menu (e.g. evening menu) rather than the current-hour menu (daytime).
    // Set inside the isPaidTier block when sortedResults is available; no-op otherwise.
    let buildCategoriesForHour: ((targetH: number) => { catName: string; items: { name: string; description: string }[] }[]) | null = null

    // TIER-BASED MENU SOURCE LOGIC:
    // Free tier: menu_signal only (quick overview from analyze-website)
    // Paid tier: menu_results_v2 (full extraction) → menu_signal (fallback)

    // ── Cuisine style (2B/2D) ──
    // Populated from menu_results_v2 for paid tier; menu_signal for free tier
    let cuisineStyle: string | null = null
    let menuLanguage = 'da' // Default; updated from menu_results_v2.language_code when paid tier menu is fetched

    // Source 1: menu_results_v2 (PAID TIER ONLY - full menu with ingredients)
    // socialLeadLabel and timeAppropriateItems are hoisted here so the menuBlock builder can reference them regardless of tier
    let socialLeadLabel: string | null = null
    let timeAppropriateItems: string[] = []
    if (isPaidTier) {
      // Check if owner has flagged a specific menu as the one to lead with socially
      let socialLeadSourceId: string | null = null
      try {
        const { data: leadRow } = await supabase
          .from('menu_sources')
          .select('id, label')
          .eq('business_id', businessId)
          .eq('is_social_lead', true)
          .maybeSingle()
        if (leadRow) {
          socialLeadSourceId = (leadRow as any).id
          socialLeadLabel = (leadRow as any).label || null
          console.log(`📢 Social lead menu: "${socialLeadLabel}" (source_id: ${socialLeadSourceId})`)
        }
      } catch (_) { /* is_social_lead column may not exist on all envs yet */ }

      // Fetch ALL menus first to check language distribution
      const { data: allMenus } = await supabase
        .from('menu_results_v2')
        .select('id, source_id, source_url, structured_data, ai_summary, service_period_name, language_code, start_time, end_time, cuisine_style, availability_days')
        .eq('business_id', businessId)
        .eq('status', 'done')
        .limit(100)

      let menuResults = allMenus
      
      // OPTIMIZED: menuDescriptionMap now populated from rotation queue
      // (already fetched with item_description field)
      // This eliminates redundant database query
      
      // Smart language filtering: only filter if multiple languages exist
      if (allMenus && allMenus.length > 0) {
        const languages = new Set(allMenus.map((m: any) => m.language_code).filter(Boolean))
        
        if (languages.size > 1) {
          // Multiple languages exist - filter to local language only
          menuResults = allMenus.filter((m: any) => m.language_code === language)
          console.log(`🌐 Multi-language business: ${languages.size} languages found → filtered to ${language} (${menuResults.length} of ${allMenus.length} menus)`)
        } else {
          // Single language - use all menus regardless of language code
          console.log(`🌐 Single-language business: ${allMenus.length} menu(s) in ${[...languages][0] || 'unknown'} (no filtering applied)`)
        }
      }

      if (menuResults && menuResults.length > 0) {
        // Layer 2: DOW pre-filter — exclude menus whose availability_days excludes today
        const availableMenuResults = (menuResults as any[]).filter((r: any) =>
          isMenuAvailableOnDay(r.availability_days ?? null, clientNow.getDay())
        )
        if (availableMenuResults.length < menuResults.length) {
          console.log(`📅 ${menuResults.length - availableMenuResults.length} menu(s) excluded by availability_days (not served today)`)
        }
        // If a social lead is set, sort so that source comes first
        const sortedResults = socialLeadSourceId
          ? [...availableMenuResults].sort((a: any, b: any) => {
              const aMatch = a.source_id === socialLeadSourceId || a.source_url === socialLeadLabel
              const bMatch = b.source_id === socialLeadSourceId || b.source_url === socialLeadLabel
              return (bMatch ? 1 : 0) - (aMatch ? 1 : 0)
            })
          : availableMenuResults
        // Use structured menu data — skip add-on / extra categories
        const addonPattern = /tilk\u00f8b|tilbeh\u00f8r|ekstra|till\u00e6g|add.?on|ekstr|side|snack/i
        // Detect marketing summary sentences — these are website copy, not ingredient lists.
        // They contain full-sentence verbs that describe the menu concept rather than the dish.
        // When passed to Gemini they produce misleading words like "tilbud" (implying a price deal)
        // or "mulighed" (implying a selection concept) in the generated text.
        const isMarketingSentence = (s: string): boolean =>
          s.length > 60 &&
          /tilbyder|giver mulighed|henvender|inkluderer|sk\u00e6reddersyet|oplevelse|foretr\u00e6kker|imødekommer|pr\u00e6ferencer|alternativer/i.test(s)

        // ── Shared helpers used by both Slot A (now) and Slot B/C (future target hours) ──
        const parseMenuHourRangeQS = (str: string): { start: number; end: number } | null => {
          if (!str) return null
          const m = str.match(/(\d{1,2})[\.:,]?\d*\s*[-\u2013]\s*(\d{1,2})/)
          if (!m) return null
          const start = parseInt(m[1], 10)
          let end = parseInt(m[2], 10)
          if (end < start) end += 24
          return { start, end }
        }
        const DAY_MAP: Record<string, number> = {
          sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
          søndag: 0, mandag: 1, tirsdag: 2, onsdag: 3, torsdag: 4, fredag: 5, lørdag: 6,
        }
        const currentHourQS = clientNow.getHours()

        // Returns a time-relevance score for a menu result at a given hour.
        // 2 = explicitly covers that hour, 1 = period heuristic match, 0 = no match.
        const timeScoreAt = (result: any, h: number): number => {
          if (result.start_time && result.end_time) {
            const startH = parseInt(result.start_time.split(':')[0], 10)
            let endH = parseInt(result.end_time.split(':')[0], 10)
            if (endH < startH) endH += 24
            const covers = endH < startH ? h >= startH || h < endH : h >= startH && h < endH
            if (covers) return 2
          }
          const avTime = result.structured_data?.availabilityTime || ''
          const range = parseMenuHourRangeQS(avTime)
          if (range) {
            const covers = range.end < range.start ? h >= range.start || h < range.end : h >= range.start && h < range.end
            if (covers) return 2
          }
          const period = (result.service_period_name || '').toLowerCase()
          if (h < 12 && /brunch|morgen|breakfast/.test(period)) return 1
          if (h >= 11 && h < 16 && /frokost|lunch/.test(period)) return 1
          if (h >= 16 && /aften|dinner|evening/.test(period)) return 1
          return 0
        }

        // Returns whether a category's timeRange string covers a given hour+day.
        const isCatTimeRangeActiveAt = (timeRange: string | null | undefined, h: number): boolean => {
          if (!timeRange) return true
          const lower = timeRange.toLowerCase()
          const currentDay = clientNow.getDay()
          const dayMatch = lower.match(/([a-zæøå]+)\s+(?:to|til)\s+([a-zæøå]+)/)
          if (dayMatch) {
            const ds = DAY_MAP[dayMatch[1]]
            const de = DAY_MAP[dayMatch[2]]
            if (ds !== undefined && de !== undefined) {
              const inDay = de >= ds ? currentDay >= ds && currentDay <= de : currentDay >= ds || currentDay <= de
              if (!inDay) return false
            }
          }
          const hourMatch = timeRange.match(/(\d{1,2})[\.:,]?\d*\s*[-\u2013]\s*(\d{1,2})/)
          if (hourMatch) {
            const hs = parseInt(hourMatch[1], 10)
            let he = parseInt(hourMatch[2], 10)
            if (he < hs) he += 24
            const inHour = he < hs ? h >= hs || h < he : h >= hs && h < he
            if (!inHour) return false
          }
          return true
        }

        // Builds menu category entries for a specific target hour.
        // Used to give Slot B/C the menu that will be active at THEIR posting time,
        // not just the menu that is active right now.
        buildCategoriesForHour = (targetH: number): { catName: string; items: { name: string; description: string }[] }[] => {
          const ranked = [...sortedResults].sort((a: any, b: any) => timeScoreAt(b, targetH) - timeScoreAt(a, targetH))
          const relevant = ranked.filter((r: any) => timeScoreAt(r, targetH) >= 1).slice(0, 3)
          const resultIds = new Set(
            (relevant.length > 0 ? relevant : ranked.slice(0, 2)).map((r: any) => r.id)
          )
          const cats: { catName: string; items: { name: string; description: string }[] }[] = []
          for (const result of sortedResults) {
            if (!resultIds.has(result.id)) continue
            for (const cat of (result.structured_data?.categories || [])) {
              if (addonPattern.test(cat.name || '')) continue
              if (!isCatTimeRangeActiveAt(cat.timeRange, targetH)) continue
              const catItems = (cat.items || [])
                .map((item: any) => {
                  let desc = menuDescriptionMap.get(item.name) || ''
                  // Add category context from rotation queue
                  const categoryLabel = menuCategoryMap.get(item.name)
                  if (categoryLabel && !desc.toLowerCase().includes(categoryLabel.toLowerCase())) {
                    desc = desc ? `[${categoryLabel}] ${desc}` : `[${categoryLabel}]`
                  }
                  return { name: item.name, description: desc }
                })
                .filter((item: any) => item.name)
              if (catItems.length > 0) cats.push({ catName: cat.name || 'Menu', items: catItems })
            }
          }
          return cats
        }

        // ── Time-relevance filter for Gemini prompt (Slot A = current hour) ──
        const timeRankedResults = [...sortedResults].sort((a: any, b: any) => timeScoreAt(b, currentHourQS) - timeScoreAt(a, currentHourQS))
        // Increased from slice(0,3) to slice(0,6) - include more time-relevant menus in prompt
        const promptResults = timeRankedResults.filter((r: any) => timeScoreAt(r, currentHourQS) >= 1).slice(0, 6)
          .concat(timeRankedResults.filter((r: any) => timeScoreAt(r, currentHourQS) < 1))
          .filter((r: any, i: number, arr: any[]) => arr.indexOf(r) === i)
        // Include at least 4 menus in prompt window (increased from 2)
        const promptResultsSet = new Set(promptResults.slice(0, Math.max(promptResults.filter((r: any) => timeScoreAt(r, currentHourQS) >= 1).length, 4)).map((r: any) => r.id))
        console.log(`⏱️ Time-relevant menus for prompt: ${[...promptResultsSet].length} of ${sortedResults.length} total`)

        // Pass 1: Build menuDescriptionMap from ALL menus (ensures DB description lookup
        // works for any item Gemini picks, even from a menu not in the prompt window).
        // ONLY add if not already in map (menu_items_normalized takes priority as source of truth)
        for (const result of sortedResults) {
          const categories = result.structured_data?.categories || []
          for (const cat of categories) {
            if (addonPattern.test(cat.name || '')) continue
            for (const item of (cat.items || [])) {
              let desc = (item.description || '').trim()
              if (isMarketingSentence(desc)) desc = ''
              // Only add if menu_items_normalized didn't already provide this description
              if (desc && !menuDescriptionMap.has(item.name)) menuDescriptionMap.set(item.name, desc)
            }
          }
        }

        // Pass 2: Build signatureItems + categoryLines from ALL menus (not just time-relevant).
        // Track time-appropriate vs. all-day items for prioritization hints.
        
        for (const result of sortedResults) {
          const inPromptWindow = promptResultsSet.has(result.id)
          const isFromSocialLead = result.source_id === socialLeadSourceId || result.source_url === socialLeadLabel
          const categories = result.structured_data?.categories || []
          for (const cat of categories) {
            if (addonPattern.test(cat.name || '')) {
              console.log(`⏭️ Skipping add-on category: "${cat.name}"`)
              continue
            }
            
            // Check if category is currently active (for prioritization, not exclusion)
            const isCategoryActive = isCatTimeRangeActiveAt(cat.timeRange, currentHourQS)
            if (!isCategoryActive) {
              console.log(`ℹ️ Category "${cat.name}" outside active timeRange (${cat.timeRange}) but including for variety`)
            }
            
            const catItems: { name: string; description: string }[] = []
            for (const item of (cat.items || [])) {
              let desc = menuDescriptionMap.get(item.name) || ''
              
              // Add category context if available from rotation queue (helps AI understand dish type)
              // E.g., "SANDWICHES: Focaccia med avocado..." instead of just "Focaccia med avocado..."
              const categoryLabel = menuCategoryMap.get(item.name)
              if (categoryLabel && !desc.toLowerCase().includes(categoryLabel.toLowerCase())) {
                desc = desc ? `[${categoryLabel}] ${desc}` : `[${categoryLabel}]`
              }
              
              if (inPromptWindow) {
                signatureItems.push(item.name)
                
                // Track time-appropriate items for prioritization
                if (isCategoryActive) {
                  timeAppropriateItems.push(item.name)
                }
                
                // Task 4.2: Social Lead Flag Integration - boost items from social lead menu by 2x
                if (isFromSocialLead && socialLeadSourceId) {
                  signatureItems.push(item.name)
                }
                catItems.push({ name: item.name, description: desc })
              }
            }
            if (inPromptWindow && catItems.length > 0) {
              menuCategoryEntries.push({ catName: cat.name || 'Menu', items: catItems })
            }
          }
        }
        
        // ── Hybrid business cocktail/drinks boost (Friday/Saturday afternoons) ──
        // For hybrid businesses with both food AND drinks menus, prioritize cocktails/drinks
        // on Friday afternoon/evening and Saturday afternoon/evening until closing.
        // TODO: Re-enable after moving hybridVerticals detection earlier in code
        /*
        const dayOfWeek = clientNow.getDay() // 0 = Sunday, 6 = Saturday
        const isFridayOrSaturday = dayOfWeek === 5 || dayOfWeek === 6
        const isAfternoonOrEvening = currentHourQS >= 16
        const drinkCategoryPattern = /\b(drink|cocktail|bar|spiritus|vin|øl|beer|wine|spirits)\b/i
        
        if (isHybridBusiness && isFridayOrSaturday && isAfternoonOrEvening) {
          let drinkItemsAdded = 0
          for (const result of sortedResults) {
            const inPromptWindow = promptResultsSet.has(result.id)
            if (!inPromptWindow) continue
            
            const categories = result.structured_data?.categories || []
            for (const cat of categories) {
              // Check if this is a drinks/cocktail category
              const isDrinkCategory = drinkCategoryPattern.test(cat.name || '')
              if (isDrinkCategory) {
                for (const item of (cat.items || [])) {
                  // Add to time-appropriate items if not already there
                  if (!timeAppropriateItems.includes(item.name)) {
                    timeAppropriateItems.push(item.name)
                    drinkItemsAdded++
                  }
                }
              }
            }
          }
          if (drinkItemsAdded > 0) {
            console.log(`🍸 Hybrid business boost: Added ${drinkItemsAdded} drink/cocktail items for ${dayOfWeek === 5 ? 'Friday' : 'Saturday'} evening (kl. ${currentHourQS})`)
          }
        }
        */
        
        const socialLeadBoostApplied = socialLeadSourceId && signatureItems.length > menuCategoryEntries.reduce((sum, cat) => sum + cat.items.length, 0)
        console.log(`📋 Using menu_results_v2 (paid tier): ${signatureItems.length} items across ${menuCategoryEntries.length} categories (from ${promptResultsSet.size} time-relevant menus; map covers ${menuDescriptionMap.size} items total)${socialLeadBoostApplied ? ' — social lead menu items boosted 2x ✨' : ''}`)
        if (isProTier) {
          console.log(`⏰ Time-appropriate items: ${timeAppropriateItems.length} of ${signatureItems.length} total items prioritized for current time`)
        } else {
          console.log(`🎯 Smart tier: Full AI freedom - no prioritization hints (${signatureItems.length} items available)`)
        }

        // ── Detect menu language (stored at upload/extraction time) ──
        // If any fetched menu result has a non-local language_code (e.g. 'en'), the entire
        // menu is in that language. Use the first non-'da' code found, or 'da' as default.
        menuLanguage = sortedResults.find((r: any) => r.language_code && r.language_code !== 'da')?.language_code || 'da'

        // ── Extract Tier 3 menu intelligence from ai_summary ──
        // ai_summary is a 5-bullet helicopter view generated at website-extraction time.
        // Tier 1 (marketing filler) → discarded via isMarketingSentence
        // Tier 2 (audience abstractions) → discarded
        // Tier 3 (specific verifiable facts) → kept as Slot B/C idea signals:
        //   quoted dish/concept names, dietary options, drink programmes, kids menus
        const quotedNamePattern = /["«»„"""]([^"«»„"""]{3,50})["«»„"""]/g
        const dietaryPattern = /vegansk|vegetarisk|glutenfri|laktosefri|halal|kosher|plantebaseret/i
        const drinkPattern = /vinmenu|Ad Libitum|cocktailmenu|øl.?menu|drinks.?menu/i
        const kidPattern = /børnemenu|børneret|barnemenuen/i

        for (const result of sortedResults) {
          if (!result.ai_summary || typeof result.ai_summary !== 'string') continue
          const periodLabel = result.service_period_name ? `[${result.service_period_name}] ` : ''
          const lines = (result.ai_summary as string)
            .split('\n')
            .map((l: string) => l.replace(/^[\s•\-–*]+/, '').trim())
            .filter((l: string) => l.length > 10 && !isMarketingSentence(l))

          for (const line of lines) {
            // Named dishes/concepts in quotes
            const quotedMatches = [...line.matchAll(quotedNamePattern)].map(m => m[1])
            if (quotedMatches.length > 0) {
              menuIntelligenceFacts.push(`${periodLabel}${quotedMatches.join(', ')}`)
              continue
            }
            // Dietary options
            if (dietaryPattern.test(line)) {
              menuIntelligenceFacts.push(`${periodLabel}${line.slice(0, 80).replace(/[,;].*$/, '')}`)
              continue
            }
            // Drink programmes
            if (drinkPattern.test(line)) {
              menuIntelligenceFacts.push(`${periodLabel}${line.slice(0, 80).replace(/[,;].*$/, '')}`)
              continue
            }
            // Kids menu
            if (kidPattern.test(line)) {
              menuIntelligenceFacts.push(`${periodLabel}Børnemenu tilgængelig`)
            }
          }
        }
        if (menuIntelligenceFacts.length > 0) {
          console.log(`💡 Menu intelligence facts: ${menuIntelligenceFacts.length}`)
        }

        // ── Extract cuisine style from menu_results_v2 (2B) ──
        // Use dedicated column first; fall back to JSONB for rows not yet backfilled
        if (!cuisineStyle && availableMenuResults) {
          for (const r of availableMenuResults) {
            const cs = (r as any).cuisine_style || r.structured_data?.cuisine_style
            if (cs && typeof cs === 'string' && cs.length > 0) {
              cuisineStyle = cs
              break
            }
          }
          if (cuisineStyle) console.log(`🍽️ Cuisine style (menu_results_v2): ${cuisineStyle}`)
        }

        // ── Extract program times from menu_results_v2 ──
        // Strategy: use service_period_name as source of truth for service type,
        // and extract timing from menuPeriods[0] (all periods in a menu share the same
        // service window, e.g. all dinner items are 17:30-21:30).
        // This handles menus where categories are type:"other" (no typed service period).
        if (availableMenuResults.length > 0) {
          console.log(`🔍 Checking ${availableMenuResults.length} menu results for programs...`)
          const seenServiceTypes = new Set<string>()
          for (const r of availableMenuResults) {
            const rawName = (r as any).service_period_name
            if (!rawName) continue
            const servicePeriodName = rawName.toLowerCase()
            // Keep only one program per service type
            if (seenServiceTypes.has(servicePeriodName)) continue

            const menuTitle = r.structured_data?.menuTitle || rawName.toUpperCase()

            // Prefer dedicated start_time/end_time columns (set by migration — reliable, queryable)
            const colStart: string | null = (r as any).start_time ?? null
            const colEnd: string | null = (r as any).end_time ?? null

            if (colStart && colEnd) {
              programsFromMenu.push({ name: menuTitle, start: colStart, end: colEnd })
              seenServiceTypes.add(servicePeriodName)
              console.log(`  ✅ Added [${servicePeriodName}]: ${menuTitle} (${colStart}-${colEnd}) [column]`)
            } else {
              // JSONB fallback: menuPeriods[0] for rows not yet backfilled
              const menuPeriods = r.structured_data?.menuPeriods
              if (Array.isArray(menuPeriods) && menuPeriods.length > 0) {
                const firstPeriod = menuPeriods[0]
                if (firstPeriod.startTime && firstPeriod.endTime) {
                  programsFromMenu.push({ name: menuTitle, start: firstPeriod.startTime, end: firstPeriod.endTime })
                  seenServiceTypes.add(servicePeriodName)
                  console.log(`  ✅ Added [${servicePeriodName}]: ${menuTitle} (${firstPeriod.startTime}-${firstPeriod.endTime}) [JSONB fallback]`)
                }
              } else {
                console.log(`  ⚠️ Skipped [${servicePeriodName}]: no time data in column or JSONB`)
              }
            }
          }
          if (programsFromMenu.length > 0) {
            console.log(`📅 Programs from menu: ${programsFromMenu.map(p => `${p.name} (${p.start}-${p.end})`).join(', ')}`)
          } else {
            console.log('⚠️ No programs extracted — will use keyword heuristics for timing')
          }
        }
      }
    }

    // ── Layer 2 guard: suppress programs when business is closed today ──
    // programsFromMenu comes from menu_results_v2 (no DOW data) so it includes programs
    // regardless of whether the business actually runs them today.
    // If opening_hours explicitly marks today as closed, clear programs to prevent wrong timing.
    if (isClosedToday && programsFromMenu.length > 0) {
      console.log(`🚫 Clearing ${programsFromMenu.length} programs — business closed today`)
      programsFromMenu.splice(0)
    }

    // ── PRE-CHECK GATE: Validate generation window ──────────────────────────
    // Quick Suggestions are tactical same-day content to drive footfall TODAY.
    // They should NOT generate when it's too late to impact today's service.
    // Rule: Valid from 00:01 until (last service period end - 1.5 hours)
    // 
    // This gate PREVENTS wasteful AI calls for invalid time windows and directs
    // users to "Write Yourself" for manual posting outside the tactical window.
    const { validateGenerationWindow } = await import('./generation-window-validator.ts')
    const windowCheck = validateGenerationWindow(
      clientNow,
      programsFromMenu,
      todayOpenTime,
      todayCloseTime,
      isClosedToday
    )
    
    if (!windowCheck.isValid) {
      console.warn(`⏰ Generation window check failed: ${windowCheck.reason}`)
      console.log(`   Current time: ${windowCheck.currentTime}`)
      if (windowCheck.lastServiceEnd) {
        console.log(`   Last service ends: ${windowCheck.lastServiceEnd}`)
        console.log(`   Cutoff time: ${windowCheck.cutoffTime}`)
      }
      
      return new Response(JSON.stringify({ 
        error: windowCheck.reason,
        errorCode: windowCheck.errorCode,  // i18n translation key
        message: windowCheck.userMessage,  // Fallback message
        meta: {
          currentTime: windowCheck.currentTime,
          lastServiceEnd: windowCheck.lastServiceEnd,
          cutoffTime: windowCheck.cutoffTime
        }
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    console.log(`✅ Generation window valid (current: ${windowCheck.currentTime})`)
    // ────────────────────────────────────────────────────────────────────────

    // Source 1.5: key_offerings (FREE TIER - user-entered simple list from profile form)
    // Priority placement: key_offerings takes precedence over menu_signal for Free tier,
    // as it's intentionally curated by the owner whereas menu_signal is auto-extracted.
    // NOTE: Free tier already fetched key_offerings above in tier-specific menu source block
    if (signatureItems.length === 0 && tier !== 'free') {
      // Paid tier fallback only (Free tier handled above)
      const { data: profile } = await supabase
        .from('business_profile')
        .select('key_offerings')
        .eq('business_id', businessId)
        .single()

      if (profile?.key_offerings) {
        // Parse newline-separated list
        const offerings = profile.key_offerings
          .split('\n')
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0)
        
        if (offerings.length > 0) {
          signatureItems = offerings.slice(0, maxItems)
          console.log(`📋 Using key_offerings (Paid tier fallback): ${signatureItems.length} items`)
        }
      }
    }

    // Source 2: menu_signal (FREE + PAID fallback - quick overview from analyze-website)
    if (signatureItems.length === 0) {
      const { data: profile } = await supabase
        .from('business_profile')
        .select('menu_signal')
        .eq('business_id', businessId)
        .single()

      const menuSignal = profile?.menu_signal
      if (menuSignal?.hasMenu && menuSignal.signatureItems) {
        const freeMenuAnchors: string[] = []
        const addAnchor = (value: unknown) => {
          if (typeof value !== 'string') return
          const anchor = value.trim()
          if (!anchor) return
          const exists = freeMenuAnchors.some(existing => existing.toLowerCase() === anchor.toLowerCase())
          if (!exists) freeMenuAnchors.push(anchor)
        }

        // Prefer section/program names first so Free sees the menu structure,
        // then top signature items if we still have room.
        if (typeof menuSignal.placeSynopsis === 'string' && menuSignal.placeSynopsis.trim()) {
          addAnchor(menuSignal.placeSynopsis)
        }
        if (Array.isArray(menuSignal.menuCategories)) {
          menuSignal.menuCategories.slice(0, maxItems).forEach(addAnchor)
        }
        if (Array.isArray(menuSignal.programmes) && freeMenuAnchors.length < maxItems) {
          menuSignal.programmes.slice(0, maxItems).forEach((programme: any) => {
            addAnchor(programme?.role)
            addAnchor(programme?.timeContext)
          })
        }
        if (Array.isArray(menuSignal.signatureItems) && freeMenuAnchors.length < maxItems) {
          menuSignal.signatureItems.slice(0, maxItems).forEach(addAnchor)
        }

        signatureItems = freeMenuAnchors.slice(0, maxItems)
        console.log(`📋 Using menu_signal (${tier} tier): ${signatureItems.length} menu anchors`)
        // ── Extract cuisine style from menu_signal (2D) ──
        if (!cuisineStyle && menuSignal.cuisineStyle) {
          cuisineStyle = menuSignal.cuisineStyle
          console.log(`🍽️ Cuisine style (menu_signal): ${cuisineStyle}`)
        }
      }
    }

    // ── Fetch weather (same-day Open-Meteo snapshot) ──
    let weatherInfo = 'Ingen vejrdata'
    let weatherForecast = ''
    let currentTemp = 0
    let windSpeedMs = 0
    let isSunny = false
    let isRaining = false
    console.log('🌤️ Attempting weather fetch for city:', location?.city || 'NO CITY')
    if (locationIntelCoords?.latitude && locationIntelCoords?.longitude) {
      try {
        const todayDate = clientNow.toISOString().split('T')[0]
        const weatherWeek = await fetchWeatherFromCoordinates(
          Number(locationIntelCoords.latitude),
          Number(locationIntelCoords.longitude),
          [todayDate],
          hasOutdoorSeating,
          undefined
        )

        const todayWeather = weatherWeek.days?.[0]
        if (todayWeather) {
          currentTemp = todayWeather.temp_max
          windSpeedMs = todayWeather.wind_speed || 0
          isSunny = todayWeather.condition === 'sunny' || todayWeather.condition === 'partly_cloudy'
          isRaining = todayWeather.condition === 'rain' || todayWeather.condition === 'snow'

          const currentAssessment = assessOutdoorComfort(todayWeather)
          weatherInfo = `${currentAssessment.emoji} ${currentAssessment.label} (${todayWeather.temp_min}°C til ${todayWeather.temp_max}°C, ${todayWeather.condition}, vind ${windSpeedMs.toFixed(1)} m/s)`
          weatherForecast = JSON.stringify({
            city: location?.city || '',
            until: 'Gælder i dag',
            temperature: `${todayWeather.temp_min}°C til ${todayWeather.temp_max}°C`,
            conditions: todayWeather.condition,
            tier: currentAssessment.tier,
            score: currentAssessment.score,
            recommendation: currentAssessment.recommendation,
          })
          console.log('✅ Open-Meteo day snapshot:', weatherInfo, { todayDate, todayWeather, currentAssessment })
        } else {
          throw new Error('No Open-Meteo day data returned')
        }
      } catch (e) {
        console.warn('Weather fetch failed:', e)
        const todayDate = clientNow.toISOString().split('T')[0]
        const fallbackWeather = createSeasonalFallbackWeather([todayDate], hasOutdoorSeating)
        const fallbackDay = fallbackWeather.days?.[0]
        if (fallbackDay) {
          currentTemp = fallbackDay.temp_max
          windSpeedMs = fallbackDay.wind_speed || 0
          isSunny = fallbackDay.condition === 'sunny' || fallbackDay.condition === 'partly_cloudy'
          isRaining = fallbackDay.condition === 'rain' || fallbackDay.condition === 'snow'
          const fallbackAssessment = assessOutdoorComfort(fallbackDay)
          weatherInfo = `${fallbackAssessment.emoji} ${fallbackAssessment.label} (${fallbackDay.temp_min}°C til ${fallbackDay.temp_max}°C, ${fallbackDay.condition}, vind ${windSpeedMs.toFixed(1)} m/s)`
          weatherForecast = JSON.stringify({
            city: location?.city || '',
            until: 'Gælder i dag',
            temperature: `${fallbackDay.temp_min}°C til ${fallbackDay.temp_max}°C`,
            conditions: fallbackDay.condition,
            tier: fallbackAssessment.tier,
            score: fallbackAssessment.score,
            recommendation: fallbackAssessment.recommendation,
          })
        } else {
          weatherInfo = 'Skønt vejr'
          weatherForecast = 'Varieret vejr'
        }
      }
    } else {
      console.warn('⚠️ No coordinates found in location intelligence - cannot fetch Open-Meteo weather')
    }

    // ── Determine season ──
    const month = clientNow.getMonth() + 1
    const season = month <= 2 || month === 12 ? 'vinter'
      : month <= 5 ? 'forår'
      : month <= 8 ? 'sommer'
      : 'efterår'

    // ── Outdoor seating conditions ──
    // Outdoor is suitable when: warm enough (15°C+), low wind (<5 m/s), and no precipitation.
    // isSunny (clear/few clouds) is NOT required — scattered/broken clouds are fine for Danish outdoor dining.
    const weatherSuitabilityTier = weatherForecast ? (() => {
      try {
        const parsed = JSON.parse(weatherForecast)
        return parsed?.tier as string | undefined
      } catch {
        return undefined
      }
    })() : undefined
    const outdoorSuitability = hasOutdoorSeating && (weatherSuitabilityTier === 'premium' || weatherSuitabilityTier === 'viable')
    const outdoorNote = hasOutdoorSeating
      ? (outdoorSuitability 
          ? `Vi har udeservering - GODT VEJR til outdoor-opslag (${weatherInfo})` 
          : `Vi har udeservering - men vejret passer IKKE til outdoor-opslag (${weatherInfo})`)
      : 'Ingen udeservering'
    // When weather is unsuitable OR business doesn't have outdoor seating, add an explicit hard prohibition
    // so Gemini doesn't suggest outdoor content inappropriately.
    const outdoorProhibitionBlock = !hasOutdoorSeating
      ? `\n🚫 FORBUDT I DAG: Forretningen HAR IKKE udeservering. Forslå ALDRIG udeservering, udendørs servering, terrasse, gårdhave eller udendørs-relaterede idéer. Fokusér kun på indendørs oplevelser.`
      : (!outdoorSuitability && hasOutdoorSeating)
        ? `\n🚫 FORBUDT I DAG: Forslå IKKE udeservering eller udendørs-ophold som indholds-ide. Vejret kvalificerer IKKE (${weatherInfo}). Gæsterne sidder ikke udenfor — udelad dette fra alle tre slots.`
        : ''

    // ── Fetch contextual calendar events (2A) ──
    // Pulls upcoming events relevant to this business (next 7 days, matching country).
    // Family events suppressed if no kids menu; outdoor events suppressed if outdoor unsuitable.
    const calendarEventFacts: string[] = []
    try {
      const businessCountry = location?.country || (business as any).country || 'Denmark'
      const sevenDaysLater = new Date(clientNow)
      sevenDaysLater.setDate(sevenDaysLater.getDate() + 7)
      const sevenDaysLaterStr = sevenDaysLater.toISOString().split('T')[0]
      const { data: calEvents } = await supabase
        .from('contextual_calendar')
        .select('event_name, event_type, content_angle, marketing_hook, relevance_tags')
        .lte('date_start', sevenDaysLaterStr)
        .or(`date_end.is.null,date_end.gte.${today}`)
        .ilike('country', `%${businessCountry}%`)
        .order('date_start', { ascending: true })
        .limit(5)
      if (calEvents && calEvents.length > 0) {
        for (const ev of calEvents) {
          const tags: string[] = Array.isArray(ev.relevance_tags) ? ev.relevance_tags : []
          if (tags.includes('families') && !hasKidsMenu) continue
          if (tags.includes('outdoor') && !outdoorSuitability) continue
          const hook = ev.marketing_hook || ev.content_angle || ev.event_name
          calendarEventFacts.push(`${ev.event_name}: ${hook}`)
          if (calendarEventFacts.length >= 3) break
        }
        if (calendarEventFacts.length > 0) {
          console.log(`📅 Calendar events: ${calendarEventFacts.join(' | ')}`)
        }
      }
    } catch (e) {
      console.warn('⚠️ Calendar fetch failed (non-fatal):', e)
    }

    // ── Fetch landmark proximity anchor + neighborhood + view signals ──
    // proximity_anchor: nearest strong landmark for content (e.g. "Nyhavn", "Åen").
    // neighborhood: area name (e.g. "Nørrebro", "Vesterbro") + character description.
    // has_view / view_type: a rooftop, harbour view, park view — a genuine draw for guests.
    // Fallback: first entry in landmarks_nearby JSONB array.
    let locationLandmarkFact: string | null = null
    let locationNeighborhoodFact: string | null = null
    let locationViewFact: string | null = null
    let locationHospitalityFact: string | null = null
    let locationMarketingHooks: string[] = []

    // Owner-entered local place term has highest priority (e.g. "ved åen", "Nyhavn")
    const localLocationReference: string | null =
      typeof (business as any).local_location_reference === 'string' &&
      (business as any).local_location_reference.trim().length > 0
        ? (business as any).local_location_reference.trim()
        : null
    if (localLocationReference) {
      locationLandmarkFact = `Beliggenhed: ${localLocationReference}`
      console.log(`📍 Local location reference (owner-set): ${locationLandmarkFact}`)
    }

    try {
      const { data: locIntel } = await supabase
        .from('business_location_intelligence')
        .select('proximity_anchor, landmarks_nearby, neighborhood, neighborhood_character, has_view, view_type, is_hidden_gem, nearby_hospitality, location_marketing_hooks')
        .eq('business_id', businessId)
        .maybeSingle()
      if (locIntel) {
        // Only use proximity_anchor / landmarks_nearby if owner hasn't set their own term
        if (!locationLandmarkFact) {
          const anchor = typeof locIntel.proximity_anchor === 'string'
            ? locIntel.proximity_anchor.trim()
            : ''
          if (anchor) {
            locationLandmarkFact = `Beliggenhed: ved ${anchor}`
          } else {
            const landmarks: Array<{ name: string }> = Array.isArray(locIntel.landmarks_nearby)
              ? locIntel.landmarks_nearby
              : []
            const firstName = landmarks[0]?.name
            if (firstName) locationLandmarkFact = `Beliggenhed: ved ${firstName}`
          }
          if (locationLandmarkFact) console.log(`📍 Landmark fact: ${locationLandmarkFact}`)
        }

        // Neighborhood: area name + optional 2-word character descriptor
        const nbhd = typeof locIntel.neighborhood === 'string' ? locIntel.neighborhood.trim() : ''
        if (nbhd) {
          const char = typeof locIntel.neighborhood_character === 'string'
            ? locIntel.neighborhood_character.trim()
            : ''
          locationNeighborhoodFact = char ? `Kvarter: ${nbhd} (${char})` : `Kvarter: ${nbhd}`
          console.log(`🏘️ Neighborhood fact: ${locationNeighborhoodFact}`)
        }

        // View: only inject when the business genuinely has a noteworthy view
        if (locIntel.has_view) {
          const viewTypes: string[] = Array.isArray(locIntel.view_type)
            ? locIntel.view_type.filter((v: unknown) => typeof v === 'string')
            : []
          const viewLabel = viewTypes.length > 0
            ? viewTypes.map((v: string) => v.replace('_', ' ')).join(', ')
            : 'udsigt'
          locationViewFact = `Udsigt: ${viewLabel}`
          console.log(`👁️ View fact: ${locationViewFact}`)
        }

        // Hospitality density: competitive context within 300m
        // Only inject for medium/high density — low density adds no strategic signal
        const nh = locIntel.nearby_hospitality
        if (nh && typeof nh === 'object' && nh.density_label && nh.density_label !== 'low' && nh.total_count > 0) {
          const breakdown: Record<string, number> = nh.breakdown || {}
          const parts: string[] = []
          if (breakdown.restaurant > 0) parts.push(`${breakdown.restaurant} restaurant${breakdown.restaurant !== 1 ? 'er' : ''}`)
          if (breakdown.cafe > 0) parts.push(`${breakdown.cafe} café${breakdown.cafe !== 1 ? 'er' : ''}`)
          if (breakdown.bar > 0) parts.push(`${breakdown.bar} bar${breakdown.bar !== 1 ? 'er' : ''}`)
          const densityDa = nh.density_label === 'high' ? 'tæt' : 'moderat'
          const breakdownStr = parts.length > 0 ? ` (${parts.join(', ')})` : ''
          locationHospitalityFact = `Konkurrencetæthed: ${densityDa} — ca. ${nh.total_count} spisesteder inden for ${nh.radius_meters}m${breakdownStr}`
          console.log(`🏪 Hospitality density: ${locationHospitalityFact}`)
        }

        // location_marketing_hooks: array of owner-validated copy hooks about the location.
        // Top 3 hooks injected as Slot B+C anchors — richer than marketing_focus (which is only 1).
        // Example: ["Den eneste café ved åen", "Terrasse med udsigt til gamle bro"]
        const mktHooks: Array<{ text?: string } | string> = Array.isArray(locIntel.location_marketing_hooks)
          ? locIntel.location_marketing_hooks
          : []
        if (mktHooks.length > 0) {
          const hookTexts = mktHooks
            .map((h: any) => typeof h === 'string' ? h : (h?.text ?? ''))
            .filter(Boolean)
            .slice(0, 3)
          if (hookTexts.length > 0) {
            locationMarketingHooks = hookTexts
            console.log(`🎣 Location marketing hooks: ${hookTexts.join(', ')}`)
          }
        }
      }
    } catch (e) {
      console.warn('⚠️ Failed to fetch landmark proximity (non-fatal):', e)
    }

    // ── Fetch active specials + events ──
    // Queries the specials table for records that are active and within date range.
    // Events (type='event') → injected into Slot B as high-priority time-sensitive anchors.
    // Ongoing promotions → injected into Slot C for brand/BTS context.
    let activeSpecialsItems: Array<{ title: string; type: string; description: string | null; recurrence_rule: string | null }> = []
    try {
      const todayIso = clientNow.toISOString().split('T')[0]
      const { data: rawSpecials } = await supabase
        .from('specials')
        .select('title, type, description, start_date, end_date, recurrence_rule')
        .eq('business_id', businessId)
        .eq('active', true)
        .or(`end_date.is.null,end_date.gte.${todayIso}`)
        .lte('start_date', todayIso)
        .order('start_date', { ascending: true })
        .limit(5)
      if (rawSpecials && rawSpecials.length > 0) {
        activeSpecialsItems = rawSpecials as typeof activeSpecialsItems
        console.log(`🎉 Active specials: ${activeSpecialsItems.length} found`)
      }
    } catch (e) {
      console.warn('⚠️ Failed to fetch specials (non-fatal):', e)
    }

    // ── Fetch brand filter + tone (tier-specific) ──
    // For paid tiers: builds a brand filter block that tells GPT:
    //   1. Which idea types/occasions fit this brand (content_strategy.anchors)
    //   2. What to actively avoid (things_to_avoid + tone_model.avoid_examples)
    //   3. How to write the titles (tone_model.writing_rules or tone_of_voice.value)
    // For free tier: safe hospitality fallback written style only (no idea filtering)
    let toneInstructions = ''
    // New brand context variables (populated for paid tier below)
    let businessCharacterText = ''
    let targetAudienceText = ''
    let activeSegmentAngleText = ''
    let primaryCopyHookQS = ''
    // V5 behavioral guidance variables
    let v5ToneNote: string | undefined = undefined
    let v5CTAType: string | undefined = undefined
    let v5ContentAngles: string[] = []
    let v5Voice: any = undefined  // Declare at function scope for later use
    let communicationGoalText = ''
    let identityKeywordsText = ''
    let ownerDifferentiatorText = ''
    let brandContextDifferentiator = ''
    let venueIdentityText = ''
    let venueEnergyText = ''
    let guestSituationText = ''
    let photographyStyleText = ''
    let photoTypesToAvoidText = ''
    let conceptFitAvoidItems: string[] = []
    let voiceRationaleText = ''
    let emotionalPromiseText = ''
    let contentExclusionsText = ''
    let locationMotivationsText = ''
    let businessIdentityPersona = ''  // V5 business identity persona, used for prompt context
    let touristContext = false  // set from location_intelligence.tourist_context below
    // price_level from business_operations \u2014 mapped to Danish register label
    const priceLevelMap: Record<number, string> = {
      1: 'budget', 2: 'afslappet/casual', 3: 'middelklasse', 4: 'premium/fine-dining',
    }
    const priceLevelText: string = (operations?.price_level != null)
      ? (priceLevelMap[operations.price_level as number] ?? '')
      : ''

    // ── Confirmed Facts Bank for Slot B/C concrete_anchor selection ──
    // Declared here (before isPaidTier block) because location_intelligence entries
    // are injected during brand profile processing and confirmedFacts must be in scope.
    const confirmedFactsSlotB: string[] = []
    const confirmedFacts: string[] = [] // full bank for Slot C

    // ── Unified Business Intelligence (same system as weekly strategy) ──
    console.log('🔄 Loading unified business intelligence (v5-aware)...')
    const businessIntel = await assembleBusinessIntelligence(supabase, businessId)
    console.log(`✅ Business intelligence loaded: brand=${!!businessIntel.brandVoice}, location=${!!businessIntel.locationPositioning}, menu=${!!businessIntel.menuIntelligence}`)

    // ══════════════════════════════════════════════════════════════════════
    // V5 PROGRAMME PROFILES & BUSINESS OPERATIONS (June 2026)
    // ══════════════════════════════════════════════════════════════════════
    // Load programme-level audience segments with behavioral data
    // Replaces flat audience_segments with programme-aware, time-filtered matching
    
    const { data: v5Programmes } = await supabase
      .from('business_programme_profiles')
      .select('programme_type, programme_name, time_windows, operating_days, audience_segments, decision_timing')
      .eq('business_id', businessId)
    
    const { data: businessOps } = await supabase
      .from('business_operations')
      .select('reservation_required, accepts_walk_ins')
      .eq('business_id', businessId)
      .single()
    
    const { data: businessProfile } = await supabase
      .from('business_profile')
      .select('booking_url')
      .eq('business_id', businessId)
      .single()
    
    console.log(`✅ V5 data loaded: ${v5Programmes?.length || 0} programmes, ops=${!!businessOps}`)

    let brandProfile: any = null
    let rawAudienceSegments: any = null  // Declared here for broader scope access
    if (isPaidTier) {
      const { data: _bp } = await supabase
        .from('business_brand_profile')
        .select('brand_profile_v5, brand_essence, tone_of_voice, tone_keywords, tone_model, things_to_avoid, content_strategy, communication_goal, target_audience, business_character, voice_rationale, posting_occasions, audience_segments, voice_guardrails, business_identity_persona, marketing_manager_brief')
        .eq('business_id', businessId)
        .single()
      brandProfile = _bp

      if (brandProfile) {
        const parts: string[] = []

        // Extract V5 profile for fallback chains
        // NEW (June 12, 2026): Use flattened columns first, fall back to nested structure
        const v5 = brandProfile.brand_profile_v5
        const v5Identity = v5?.identity
        v5Voice = v5?.voice  // Assign to function-scoped variable
        const v5WritingExamples = v5?.writing_examples
        const v5Guardrails = (brandProfile as any).voice_guardrails || v5?.guardrails
        const v5Programme = Array.isArray(v5?.programmes) && v5.programmes.length > 0 ? v5.programmes[0] : null
        const v5BusinessIdentityPersona = v5?.layer_0_intelligence?.business_identity?.system_persona
        const v5GeoNarrative = v5?.layer_0_intelligence?.geographic_context?.narrative
        const v5MarketingManagerBrief = v5?.marketing_manager_brief || (brandProfile as any).marketing_manager_brief

        // ══════════════════════════════════════════════════════════════════════
        // MARKETING MANAGER BRIEF (NEW V5.3 - June 21, 2026)
        // ══════════════════════════════════════════════════════════════════════
        // HIGHEST PRIORITY: Use synthesized marketing manager role instruction
        // This replaces scattered 15+ field assembly with ONE clear Danish brief.
        
        if (v5MarketingManagerBrief && typeof v5MarketingManagerBrief === 'string' && v5MarketingManagerBrief.trim().length > 100) {
          // ✅ MARKETING MANAGER BRIEF AVAILABLE - Use as primary system context
          parts.push(`MARKETING MANAGER BRIEF:\n${v5MarketingManagerBrief.trim()}`)
          
          // Extract business name for businessCharacterText if needed
          const briefFirstLine = v5MarketingManagerBrief.split('\n')[0]
          businessCharacterText = briefFirstLine || v5MarketingManagerBrief.substring(0, 150).trim()
          
          console.log('✅ Using marketing_manager_brief (V5.3 synthesized guidance)')
        } 
        // ══════════════════════════════════════════════════════════════════════
        // BUSINESS IDENTITY PERSONA INTEGRATION (June 12, 2026)
        // ══════════════════════════════════════════════════════════════════════
        // FALLBACK: Use full multi-paragraph persona if no marketing brief available.
        // Includes: venue description + strategic segments + communication strategy.
        // Falls back to legacy assembly for businesses without regenerated V5 profiles.
        
        else if ((typeof v5BusinessIdentityPersona === 'string' && v5BusinessIdentityPersona.trim().length > 50)) {
          businessIdentityPersona = v5BusinessIdentityPersona.trim()
          
          // ✅ PERSONA AVAILABLE - Use full strategic context
          parts.push(`BUSINESS IDENTITY PERSONA:\n${businessIdentityPersona.trim()}`)
          
          // Extract first paragraph or sentence for businessCharacterText (used in shared context)
          const firstParagraph = businessIdentityPersona.split('\n\n')[0]?.split('\n')[0]?.trim()
          businessCharacterText = firstParagraph || businessIdentityPersona.substring(0, 200).trim()

          if (v5GeoNarrative && typeof v5GeoNarrative === 'string' && v5GeoNarrative.trim().length > 0) {
            parts.push(`LOCATION NARRATIVE (tone and framing only):\n${v5GeoNarrative.trim()}`)
          }
          
          console.log('✅ Using business_identity_persona (includes strategic segments)')
        } else {
          // ❌ PERSONA NOT AVAILABLE - Fall back to piecemeal assembly (legacy)
          console.log('⚠️ business_identity_persona not available - using legacy assembly')
          
          // ── 1. Brand identity anchor ──
          // V5-first extraction: brand_profile_v5.identity.brand_essence → legacy fallback
          const brandEssence = extractBrandEssence(brandProfile)
          if (brandEssence && brandEssence.trim()) {
            parts.push(`BRAND IDENTITET (hvad stedet ER — lad dette styre ide-valget):\n${brandEssence.trim()}`)
          }

          // ── 2. Natural social moments → idea selection filter ──
          // V5-first fallback: v5Voice.content_anchors → tone_model.content_anchors → content_strategy.brand_anchors
          let naturalMoments: string[] = []
          if (Array.isArray(v5Voice?.content_anchors) && v5Voice.content_anchors.length > 0) {
            naturalMoments = v5Voice.content_anchors.slice(0, 3)
          } else {
            const cs = (brandProfile as any).content_strategy
            if (cs) {
              const csObj = typeof cs === 'string' ? (() => { try { return JSON.parse(cs) } catch { return null } })() : cs
              if (Array.isArray(csObj?.brand_anchors) && csObj.brand_anchors.length > 0) {
                naturalMoments = csObj.brand_anchors.slice(0, 3)
              }
            }
            if (naturalMoments.length === 0 && brandProfile.tone_model) {
              const tm = brandProfile.tone_model as any
              if (Array.isArray(tm?.content_anchors) && tm.content_anchors.length > 0) {
                naturalMoments = tm.content_anchors.slice(0, 3)
              }
            }
          }
          if (naturalMoments.length > 0) {
            const isConfirmed = (brandProfile as any).content_strategy_confirmed === true
            const anchorLabel = isConfirmed
              ? 'BEKRÆFTEDE ØJEBLIKKE (ejer-godkendt — høj prioritet)'
              : 'AI-FORESLÅEDE ØJEBLIKKE (ikke bekræftet af ejer — brug som ide-inspiration, men prioritér bekræftede servicefacts)'
            parts.push(`${anchorLabel}:\n${naturalMoments.map((m: string) => `- ${m}`).join('\n')}`)
          }

          // ── 3. Ideas to actively avoid ──
          // V5-first fallback: v5Voice.avoid_examples → tone_model.avoid_examples → things_to_avoid
          let avoidIdeas: string[] = []
          const avoidExamplesV5 = Array.isArray(v5Voice?.avoid_examples)
            ? v5Voice.avoid_examples.filter((s: any) => typeof s === 'string').slice(0, 2)
            : []
          if (avoidExamplesV5.length > 0) {
            avoidIdeas.push(...avoidExamplesV5.slice(0, 3))
          } else if ((brandProfile as any).things_to_avoid) {
            const ta = (brandProfile as any).things_to_avoid as any
            if (typeof ta === 'object' && ta !== null) {
              if (Array.isArray(ta.tone_constraints)) avoidIdeas.push(...ta.tone_constraints.slice(0, 3))
              if (Array.isArray(ta.language_constraints)) avoidIdeas.push(...ta.language_constraints.slice(0, 2))
            } else if (typeof ta === 'string' && ta.trim()) {
              avoidIdeas.push(ta.trim())
            }
          }
          // Legacy tone_model.avoid_examples fallback
          const tm = brandProfile.tone_model as any
          const avoidExamples: string[] = Array.isArray(tm?.avoid_examples)
            ? tm.avoid_examples.filter((s: any) => typeof s === 'string').slice(0, 2)
            : []
          if (avoidIdeas.length > 0 || avoidExamples.length > 0) {
            const avoidLines = [
              ...avoidIdeas.map((a: string) => `- ${a}`),
              ...avoidExamples.map((a: string) => `- (eksempel at undgå) "${a}"`),
            ].slice(0, 5)
            parts.push(`UNDGÅ IDEER DER LYDER SOM:\n${avoidLines.join('\n')}`)
          }

          // ── 4. Writing style for titles and why_explanation ──
          // V5-first fallback: v5Voice.tone_rules → tone_model.writing_rules → tone_of_voice → tone_keywords → personality_traits
          let toneText = ''
          if (Array.isArray(v5Voice?.tone_rules) && v5Voice.tone_rules.length > 0) {
            const rules = v5Voice.tone_rules.filter((s: any) => typeof s === 'string').slice(0, 4)
            toneText = rules.map((r: string) => `- ${r}`).join('\n')
          } else if (Array.isArray(tm?.writing_rules) && tm.writing_rules.length > 0) {
            const rules = tm.writing_rules.filter((s: any) => typeof s === 'string').slice(0, 4)
            toneText = rules.map((r: string) => `- ${r}`).join('\n')
          } else if (brandProfile.tone_of_voice) {
            const tov = brandProfile.tone_of_voice as any
            if (typeof tov === 'object' && tov !== null) {
              if (typeof tov.value === 'string' && tov.value.trim().length > 10) {
                toneText = tov.value.trim()
              } else {
                const p: string[] = []
                if (tov.primary_tone) p.push(tov.primary_tone)
                if (Array.isArray(tov.attributes) && tov.attributes.length > 0) p.push(tov.attributes.join(', '))
                if (tov.formality_level) p.push(`formalitet: ${tov.formality_level}`)
                toneText = p.join(' · ')
              }
            } else if (typeof brandProfile.tone_of_voice === 'string') {
              toneText = brandProfile.tone_of_voice
            }
          }
          // Fallback to personality_traits or tone_keywords if no tone rules found
          if (!toneText) {
            if (Array.isArray(v5Voice?.personality_traits) && v5Voice.personality_traits.length > 0) {
              toneText = v5Voice.personality_traits.join(', ')
            } else if (Array.isArray(brandProfile.tone_keywords) && brandProfile.tone_keywords.length > 0) {
              toneText = (brandProfile.tone_keywords as string[]).join(', ')
            }
          }
          // humor_level: modulate tone instructions when brand has a defined humor register.
          // V5-first fallback: v5Voice.humor_style → humor_level
          // Absent or 'none' → no change. 'dry' / 'warm' / 'playful' → append to skrivestil.
          const humorLevel = v5Voice?.humor_style ?? (brandProfile as any).humor_level
          if (humorLevel && typeof humorLevel === 'string' && humorLevel !== 'none' && humorLevel !== '') {
            toneText = (toneText ? toneText + '\n' : '') + `- Humor-register: ${humorLevel} — lad dette farve tonen i titles og why_explanation`
          }
          if (toneText) {
            parts.push(`SKRIVESTIL (til titles og why_explanation):\n${toneText}`)
          }

          // ── 5. Business character (AI plain-text description) ──
          // Fallback chain: v5Identity.business_description → business_character
          // V5.6 (June 22, 2026): Validate business_character to prevent persona corruption
          const businessCharacter = v5Identity?.business_description
            ?? (typeof (brandProfile as any).business_character === 'string' ? (brandProfile as any).business_character
              : (typeof (brandProfile as any).business_character === 'object' && (brandProfile as any).business_character?.value)
                ? String((brandProfile as any).business_character.value) : '')
          
          // Validate: business_character should be SHORT (< 200 chars), not the full persona
          if (businessCharacter && isValidBusinessCharacter(businessCharacter)) {
            businessCharacterText = businessCharacter.trim()
          } else if (businessCharacter && businessCharacter.length > 0) {
            // Corrupted (contains full persona) - extract first meaningful line
            console.warn('⚠️ business_character corrupted (contains persona), extracting first line')
            const firstLine = businessCharacter.split('\n').find(line => 
              line.trim() && 
              !line.includes('Du er Marketing ekspert') &&
              !line.includes('FORRETNING:') &&
              !line.includes('LOKATION:')
            )
            if (firstLine && firstLine.length < 200) {
              businessCharacterText = firstLine.trim()
            }
          }
        }
        
        // ══════════════════════════════════════════════════════════════════════
        // SHARED CONTEXT EXTRACTION (continues regardless of persona availability)
        // ══════════════════════════════════════════════════════════════════════
        // Extract confirmed facts from content_strategy (brand_anchors + loyalty_hooks)
        const cs = (brandProfile as any).content_strategy
        if (cs) {
          const csObj = typeof cs === 'string' ? (() => { try { return JSON.parse(cs) } catch { return null } })() : cs
          if (Array.isArray(csObj?.brand_anchors) && csObj.brand_anchors.length > 0) {
            const anchors = (csObj.brand_anchors as string[]).slice(0, 3).join('; ')
            confirmedFacts.push(`Brandankre (identitetsmarkører): ${anchors}`)
          }
          if (Array.isArray(csObj?.loyalty_hooks) && csObj.loyalty_hooks.length > 0) {
            const hooks = (csObj.loyalty_hooks as string[]).slice(0, 3).join('; ')
            confirmedFacts.push(`Fastholdelsesgrunde (gæster vender tilbage fordi): ${hooks}`)
          }
        }

        // ── 5b. Brand differentiator ──
        // V5-first extraction: brand_profile_v5.identity.what_makes_us_different → legacy fallback
        const differentiator = extractUSP(brandProfile)
        if (differentiator && differentiator.trim().length > 5) {
          brandContextDifferentiator = differentiator.trim()
        }

        // ── 6. Audience (V5 Programme-Based Matching) ──
        // NEW (June 2026): Use programme profiles with behavioral derivation
        // Replaces flat audience_segments with programme-aware matching
        // Provides: tone_note, cta_type, content_angles, matched_segment
        
        const now = new Date()
        let personaMatch: PersonaMatchResult
        
        if (v5Programmes && v5Programmes.length > 0 && businessOps) {
          // ✅ V5 PATH: Direct programme-based matching
          console.log(`[V5] Using programme-based matching (${v5Programmes.length} programmes)`)
          
          const businessOpsData: BusinessOperations = {
            reservation_required: businessOps.reservation_required ?? false,
            accepts_walk_ins: businessOps.accepts_walk_ins ?? true,
            booking_url: businessProfile?.booking_url ?? null
          }
          
          personaMatch = await matchPersonaWithV5Programmes(
            v5Programmes as V5ProgrammeProfile[],
            businessOpsData,
            now.getHours(),
            now.getDay(),
            supabase,
            businessId
          )
          
          console.log(`[V5] Matched: ${personaMatch.audienceText}`)
          console.log(`[V5] Tone: ${personaMatch.tone_note}`)
          console.log(`[V5] CTA: ${personaMatch.cta_type}`)
          console.log(`[V5] Content angles: ${personaMatch.content_angles?.length || 0}`)
          
        } else {
          // ⚠️ FALLBACK PATH: Legacy matching (deprecated)
          console.log(`[V5] Falling back to legacy matching (no programmes or ops)`)
          rawAudienceSegments = (brandProfile as any).audience_segments
          
          personaMatch = await matchPersonaToCurrentHour(
            null,  // audienceFramework removed (Sprint 1)
            rawAudienceSegments,
            now.getHours(),
            now.getDay(),
            now.getMonth(),
            supabase,
            businessId
          )
        }
        
        targetAudienceText = personaMatch.audienceText
        
        // Extract V5 behavioral data if available
        v5ToneNote = personaMatch.tone_note
        v5CTAType = personaMatch.cta_type
        v5ContentAngles = personaMatch.content_angles || []
        
        // Extract additional metadata for legacy compatibility and prompt enrichment
        if (personaMatch.source === 'segments') {
          // B5 audience_segments schema provides classification metadata
          primaryCopyHookQS = typeof rawAudienceSegments?.primary_copy_hook === 'string'
            ? rawAudienceSegments.primary_copy_hook : ''
          
          // Extract content angle from active segment (time-filtered)
          // Content angles provide framing hints (e.g., "social gathering", "quick bite")
          const segmentsArray = Array.isArray(rawAudienceSegments)
            ? rawAudienceSegments
            : Array.isArray(rawAudienceSegments?.segments) ? rawAudienceSegments.segments : null
          
          if (segmentsArray && segmentsArray.length > 0) {
            const activeSegment = matchActiveSegment(segmentsArray as AudienceSegment[], now.getDay(), now.getHours())
            if (activeSegment) {
              const angle = (activeSegment as any).content_angles?.[0]
              if (angle?.label) activeSegmentAngleText = angle.label
            }
          }
        }
        
        // Final safety net: Legacy target_audience field
        // Used only if all modern sources (framework + segments) returned empty
        if (!targetAudienceText && (brandProfile as any).target_audience) {
          const ta = (brandProfile as any).target_audience as any
          if (typeof ta === 'object' && ta !== null) {
            const audienceParts: string[] = []
            if (ta.primary) audienceParts.push(ta.primary)
            if (Array.isArray(ta.segments) && ta.segments.length > 0) audienceParts.push(ta.segments.join(', '))
            targetAudienceText = audienceParts.join(' · ')
          } else if (typeof ta === 'string') {
            targetAudienceText = ta.trim()
          }
        }

        // ── 7. Communication goal ──
        // V5-first fallback: v5Programme.communication_objectives → communication_goal
        const communicationGoalV5 = v5Programme?.communication_objectives
        if (Array.isArray(communicationGoalV5) && communicationGoalV5.length > 0) {
          communicationGoalText = communicationGoalV5.join(', ')
        } else if ((brandProfile as any).communication_goal) {
          const cg = (brandProfile as any).communication_goal as any
          communicationGoalText = typeof cg === 'string' ? cg.trim()
            : (typeof cg === 'object' && cg?.value) ? String(cg.value).trim()
            : (typeof cg === 'object' && cg?.primary) ? String(cg.primary).trim() : ''
        }

        // ── 8. Identity keywords ──
        // V5-first fallback: v5Identity.category_keywords → identity_keywords
        const categoryKeywords = v5Identity?.category_keywords
        if (Array.isArray(categoryKeywords) && categoryKeywords.length > 0) {
          identityKeywordsText = categoryKeywords.slice(0, 5).join(', ')
        } else if ((brandProfile as any).identity_keywords) {
          const ik = (brandProfile as any).identity_keywords as any
          if (Array.isArray(ik)) {
            identityKeywordsText = ik.slice(0, 5).join(', ')
          } else if (typeof ik === 'string') {
            identityKeywordsText = ik.trim()
          } else if (typeof ik === 'object' && ik !== null) {
            const arr = ik.keywords || ik.values || ik.items
            if (Array.isArray(arr)) identityKeywordsText = arr.slice(0, 5).join(', ')
          }
        }

        // ── 9. Venue identity (for atmosphere/BTS ideas) ──
        const riRaw = (brandProfile as any).recognizable_interior_identity
        if (riRaw) {
          venueIdentityText = typeof riRaw === 'string' ? riRaw.trim()
            : (typeof riRaw === 'object' && riRaw?.value) ? String(riRaw.value).trim() : ''
        }

        // ── 9b/9c. Venue energy + guest situation (live context) ──
        try {
          const { data: vsRow } = await supabase
            .from('business_brand_profile')
            .select('venue_energy, guest_situation_type')
            .eq('business_id', businessId)
            .single()
          if (vsRow?.venue_energy && typeof vsRow.venue_energy === 'string') {
            venueEnergyText = vsRow.venue_energy.trim()
          }
          if (vsRow?.guest_situation_type && typeof vsRow.guest_situation_type === 'string') {
            guestSituationText = vsRow.guest_situation_type.trim()
          }
        } catch (_) { /* column may not exist yet */ }

        // ── 9d. Visual identity — business_visual_identity table dropped April 2026.
        // photography_style + photo_types_to_avoid signals are no longer available.
        // (photographyStyleText and photoTypesToAvoidText remain empty strings)

        // ── 9e. Concept fit avoid — business_concept_fit table dropped April 2026.
        // concept_fit_avoid signals are no longer available.
        // (conceptFitAvoidItems remains empty array)

        // ── 10. Voice rationale register guard (for atmosphere/BTS ideas) ──
        // V5-first fallback: v5Voice.register_guidance → voice_rationale
        const registerGuidance = v5Voice?.register_guidance ?? (brandProfile as any).voice_rationale
        if (registerGuidance && typeof registerGuidance === 'string') voiceRationaleText = registerGuidance.trim()

        // ── 11. Emotional promise + content exclusions (Stage B3) ──
        // V5-first extraction: brand_profile_v5.identity.positioning → legacy fallback
        const positioning = extractPositioning(brandProfile)
        if (positioning && positioning.trim()) emotionalPromiseText = positioning.trim()
        // V5-first: content exclusions come from structured V5 guardrails only
        const exclusions = v5Guardrails?.content_exclusions
        if (Array.isArray(exclusions) && exclusions.length > 0) {
          contentExclusionsText = exclusions.join('; ')
        } else if (typeof exclusions === 'string' && exclusions.trim()) {
          contentExclusionsText = exclusions.trim()
        }
        
        // ── 11b. Extract avoid_patterns from voice_guardrails ──
        // Flatten brochure_language, superlatives, generic_marketing into conceptFitAvoid
        // to prevent promotional drift in idea selection & why_explanation
        if (v5Guardrails?.avoid_patterns) {
          const ap = v5Guardrails.avoid_patterns
          if (Array.isArray(ap.brochure_language)) conceptFitAvoidItems.push(...ap.brochure_language)
          if (Array.isArray(ap.superlatives)) conceptFitAvoidItems.push(...ap.superlatives)
          if (Array.isArray(ap.generic_marketing)) conceptFitAvoidItems.push(...ap.generic_marketing)
        }
        
        // ── 12. Location intelligence motivations + proximity anchor ──
        // Read from business_location_intelligence table (not brand_profile flat column which is NULL in V5)
        const businessLocationIntel = businessIntel.locationPositioning
        if (businessLocationIntel) {
          if (Array.isArray(businessLocationIntel.matched_motivations)) {
            const motivations = businessLocationIntel.matched_motivations.filter((s: unknown) => typeof s === 'string').slice(0, 3) as string[]
            if (motivations.length > 0) locationMotivationsText = motivations.join(', ')
          }
          // location_proximity_fact: inject area type and top marketing hook as confirmed Slot C fact.
          // primary_type gives AI the venue context (waterfront, city_centre etc.);
          // marketing_focus is the owner's own location hook (e.g. 'Den eneste café med udsigt over åen').
          const primaryType = typeof businessLocationIntel.primary_type === 'string' ? businessLocationIntel.primary_type.trim() : ''
          const marketingFocus = typeof businessLocationIntel.marketing_focus === 'string' ? businessLocationIntel.marketing_focus.trim() : ''
          if (primaryType && primaryType !== 'unknown') {
            confirmedFacts.push(`Beliggenheds-type: ${primaryType}`)
          }
          if (marketingFocus) {
            confirmedFacts.push(`Beliggenheds-hook: ${marketingFocus}`)
          }
          // Extract tourist context — used to frame English-named dishes appropriately
          if (businessLocationIntel.tourist_context === true
            || (typeof businessLocationIntel.tourist_factor === 'string' && businessLocationIntel.tourist_factor !== 'none')) {
            touristContext = true
          }
        }

        // ── 13. Posting occasions → occasion triggers for Slot B/C framing ──
        const poRaw = (brandProfile as any).posting_occasions
        if (poRaw) {
          const occasions = typeof poRaw === 'string'
            ? (() => { try { return JSON.parse(poRaw) } catch { return null } })()
            : poRaw
          if (Array.isArray(occasions) && occasions.length > 0) {
            const highPriority = (occasions as any[])
              .filter((o: any) => typeof o?.priority_weight === 'number' && o.priority_weight >= 3)
              .sort((a: any, b: any) => b.priority_weight - a.priority_weight)
              .slice(0, 5)
            if (highPriority.length > 0) {
              const occasionLines = highPriority.map((o: any) => {
                const customizations = Array.isArray(o.business_customizations) && o.business_customizations.length > 0
                  ? ` — ${(o.business_customizations as string[]).slice(0, 2).join('; ')}`
                  : ''
                return `- ${o.occasion_id} (prioritet: ${o.priority_weight}/5)${customizations}`
              }).join('\n')
              parts.push(`NØGLEANLEDNINGER TIL BESØG (prioriteret for dette sted — brug som ramme for Slot B og Slot C: start med anledningen, positionér stedet som svaret):\n${occasionLines}`)
            }
          }
        }

        if (parts.length > 0) {
          toneInstructions = '\n\n' + parts.join('\n\n')
          const usedPersona = businessIdentityPersona && businessIdentityPersona.trim().length > 50
          console.log(`✅ Brand context built: ${usedPersona ? 'persona-based (strategic segments)' : 'legacy (piecemeal assembly)'} — ${parts.length} sections`)
        } else {
          console.log('⚠️ Paid tier: brand profile found but empty — checking v5...')
        }
        
        // ── OVERRIDE with v5 brand voice if available (unified system) ──
        if (businessIntel.brandVoice) {
          const bv = businessIntel.brandVoice
          const v5Parts: string[] = []
          
          if (bv.formality) v5Parts.push(`Formalitet: ${bv.formality}`)
          if (bv.personality && bv.personality.length > 0) v5Parts.push(`Personlighed: ${bv.personality.join(', ')}`)
          if (bv.humor) v5Parts.push(`Humor: ${bv.humor}`)
          if (bv.emojiFrequency) v5Parts.push(`Emoji-brug: ${bv.emojiFrequency}`)
          if (bv.signatureThemes && bv.signatureThemes.length > 0) {
            v5Parts.push(`SIGNATUR-TEMAER:\n${bv.signatureThemes.join(', ')}`)
          }
          if (bv.voiceRules && bv.voiceRules.length > 0) {
            v5Parts.push(`STEMME-REGLER:\n${bv.voiceRules.map(r => `- ${r}`).join('\n')}`)
          }
          if (bv.gastronomicProfile) {
            v5Parts.push(`GASTRONOMISK PROFIL:\n${bv.gastronomicProfile}`)
          }
          
          if (v5Parts.length > 0) {
            toneInstructions = '\n\nTONE OF VOICE (fra v5 brand profile):\n' + v5Parts.join('\n')
            console.log(`✅ Using v5 brand voice: ${v5Parts.length} elements (overrides legacy)`)
          }
        }
        
        // ── Add location intelligence from unified system ──
        if (businessIntel.locationPositioning) {
          const loc = businessIntel.locationPositioning
          if (loc.primaryContext && !confirmedFacts.some(f => f.includes('Beliggenhed'))) {
            confirmedFacts.push(`Beliggenhed: ${loc.primaryContext}`)
          }
          if (loc.marketingHooks && loc.marketingHooks.length > 0) {
            toneInstructions += `\n\nSTEDETS MARKETING-HOOKS:\n${loc.marketingHooks.map(h => `- ${h}`).join('\n')}`
          }
        }
        
      }

      if (!toneInstructions) {
        console.log('⚠️ Paid tier but no brand profile found, using safe fallback')
        toneInstructions = `\n\nTONE OF VOICE:
- Formalitet: ${SAFE_HOSPITALITY_FALLBACK.formalityLevel}
- Tiltaleform: ${SAFE_HOSPITALITY_FALLBACK.addressForm}
- Sætningsstil: ${SAFE_HOSPITALITY_FALLBACK.sentenceStyle}
- Personlighed: ${SAFE_HOSPITALITY_FALLBACK.personalityTraits.join(', ')}`
      }
    } else {
      // Free tier: writing style only, no idea filtering
      toneInstructions = `\n\nTONE OF VOICE:
- Formalitet: ${SAFE_HOSPITALITY_FALLBACK.formalityLevel}
- Tiltaleform: ${SAFE_HOSPITALITY_FALLBACK.addressForm}
- Sætningsstil: ${SAFE_HOSPITALITY_FALLBACK.sentenceStyle}
- Personlighed: ${SAFE_HOSPITALITY_FALLBACK.personalityTraits.join(', ')}`
      console.log('✅ Free tier: Using safe hospitality fallback')
    }

    // ── Persona matching helper function for target times ──
    // Declared here (after isPaidTier block) so it's accessible throughout the rest of the function.
    // Used to match audience personas to Slot B/C target posting times instead of generation time.
    const matchPersonaForHour = async (targetHour: number): Promise<string> => {
      if (!rawAudienceSegments) return targetAudienceText
      try {
        const now = new Date()
        const match = await matchPersonaToCurrentHour(
          null,
          rawAudienceSegments,
          targetHour,
          now.getDay(),
          now.getMonth(),
          supabase,
          businessId
        )
        return match.audienceText
      } catch (e) {
        console.warn(`⚠️ Persona matching for hour ${targetHour} failed:`, e)
        return targetAudienceText
      }
    }

    // ── Use recent suggestions from context (fetched earlier) ──
    const recentSuggestions = context.recentSuggestions

    // ── Fetch actually-posted dishes from the last 14 days ──
    const fourteenDaysAgo = new Date(clientNow)
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
    
    // Query 1: Published posts (for recency claims like "postet 3 dage siden")
    // NOW INCLUDES posts without menu_item_name for manual post tracking
    const { data: recentPosts, error: postsError } = await supabase
      .from('posts')
      .select('menu_item_id, menu_item_name, posted_at, status, post_text')
      .eq('business_id', businessId)
      .eq('status', 'published')  // Only actually published posts for recency claims
      .gte('posted_at', fourteenDaysAgo.toISOString())
      .order('posted_at', { ascending: false })
    
    // Query 2: Scheduled posts (to exclude from suggestions, but don't use for recency claims)
    // NOW INCLUDES posts without menu_item_name for manual post tracking
    const { data: scheduledPosts } = await supabase
      .from('posts')
      .select('menu_item_id, menu_item_name, scheduled_for, post_text')
      .eq('business_id', businessId)
      .eq('status', 'scheduled')
      .gte('scheduled_for', today)  // Only future scheduled posts
      .order('scheduled_for', { ascending: true })

    let avoidSection = ''
    // Recent suggestions are now loaded from context
    if (postsError) {
      console.warn('⚠️ Could not fetch published posts:', postsError)
    }

    // Build avoid list: posted dishes take priority (they carry a date so the AI
    // can reason about recency), scheduled posts prevent redundancy, suggestions fill in the rest.
    const postedDishLines: string[] = []
    for (const post of (recentPosts || [])) {
      if (!post.menu_item_name) continue
      const daysAgo = Math.round((clientNow.getTime() - new Date(post.posted_at).getTime()) / 86_400_000)
      const label = daysAgo === 0 ? 'i dag' : daysAgo === 1 ? 'i går' : `${daysAgo} dage siden`
      postedDishLines.push(`${post.menu_item_name} (postet ${label})`)
    }
    
    // Scheduled posts - prevent suggesting the same dish that's already scheduled
    const scheduledDishLines: string[] = []
    const processedScheduled: Array<{ menu_item_id: string | null; menu_item_name: string | null }> = []
    
    for (const post of (scheduledPosts || [])) {
      let menuItemId = post.menu_item_id
      let menuItemName = post.menu_item_name
      
      // FIX: For manual scheduled posts without menu_item_name, extract from post_text
      if (!menuItemName && post.post_text) {
        const postTextLower = post.post_text.toLowerCase()
        let bestMatch: { id: string; name: string; length: number } | null = null
        
        for (const [normalizedName, dish] of dishNameLookup.entries()) {
          const pattern = new RegExp(`\\b${normalizedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
          if (pattern.test(postTextLower)) {
            if (!bestMatch || normalizedName.length > bestMatch.length) {
              bestMatch = { ...dish, length: normalizedName.length }
            }
          }
        }
        
        if (bestMatch) {
          menuItemId = bestMatch.id
          menuItemName = bestMatch.name
          console.log(`📅 Extracted dish from scheduled post text: "${bestMatch.name}"`)
        }
      }
      
      if (!menuItemName) continue
      
      processedScheduled.push({ menu_item_id: menuItemId, menu_item_name: menuItemName })
      
      const scheduledDate = new Date(post.scheduled_for)
      const daysUntil = Math.round((scheduledDate.getTime() - clientNow.getTime()) / 86_400_000)
      const label = daysUntil === 0 ? 'i dag' : daysUntil === 1 ? 'i morgen' : `om ${daysUntil} dage`
      scheduledDishLines.push(`${menuItemName} (planlagt ${label})`)
    }

    // Dishes that were only suggested (not necessarily posted) — deduplicate against posted and scheduled
    // Use menu_item_id (UUID) for accurate matching when available, fall back to name
    const postedKeys = new Set((recentPosts || []).map((p: any) => 
      p.menu_item_id || p.menu_item_name?.toLowerCase()
    ))
    const scheduledKeys = new Set(processedScheduled.map((p: any) => 
      p.menu_item_id || p.menu_item_name?.toLowerCase()
    ))
    const scheduledDishNamesWithAge = processedScheduled
      .map((p: any) => ({
        id: p.menu_item_id,
        name: p.menu_item_name,
      }))
    const suggestedOnlyDishes = (recentSuggestions || [])
      .filter((s: any) => {
        if (!s.menu_item_name) return false
        const suggestionKey = s.menu_item_id || s.menu_item_name?.toLowerCase()
        return !postedKeys.has(suggestionKey) && !scheduledKeys.has(suggestionKey)
      })
      .map((s: any) => s.menu_item_name)

    if (postedDishLines.length > 0 || scheduledDishLines.length > 0 || suggestedOnlyDishes.length > 0) {
      const lines: string[] = []
      if (postedDishLines.length > 0) {
        lines.push(`Faktisk postet for nylig (undgå):\n${postedDishLines.join('\n')}`)
      }
      if (scheduledDishLines.length > 0) {
        lines.push(`Allerede planlagt (undgå):\n${scheduledDishLines.join('\n')}`)
      }
      if (suggestedOnlyDishes.length > 0) {
        lines.push(`Foreslået for nylig (undgå gentagelse):\n${suggestedOnlyDishes.join(', ')}`)
      }
      avoidSection = `\n\nUndgå disse retter — de er fremhævet for nylig eller allerede planlagt:\n${lines.join('\n\n')}\n\nVælg en ANDEN ret fra menukortet.`
      console.log(`📋 Avoiding: ${postedDishLines.length} posted, ${scheduledDishLines.length} scheduled, ${suggestedOnlyDishes.length} suggested-only dishes`)
    }

    // ── Seasonal context from voice_guardrails.seasonal_notes ──
    // Prevents topically wrong suggestions (e.g., terrace focus in winter)
    // based on profile-defined seasonal rules rather than hardcoded logic
    if (isPaidTier && brandProfile) {
      const v5Guard = (brandProfile as any).voice_guardrails || (brandProfile as any).brand_profile_v5?.guardrails
      if (v5Guard?.seasonal_notes && Array.isArray(v5Guard.seasonal_notes) && v5Guard.seasonal_notes.length > 0) {
        const currentMonth = clientNow.getMonth() + 1 // 1-12
        const currentMonthName = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december'][currentMonth - 1]
        
        // Filter seasonal notes relevant to current month
        // Format examples: "oktober-marts: undgå terrasse", "december: julestemning"
        const relevantNotes: string[] = []
        for (const note of v5Guard.seasonal_notes) {
          if (typeof note !== 'string') continue
          const noteLower = note.toLowerCase()
          
          // Check if note contains current month name
          if (noteLower.includes(currentMonthName)) {
            relevantNotes.push(note)
            continue
          }
          
          // Check for month ranges (e.g., "oktober-marts")
          const rangeMatch = noteLower.match(/(\w+)-(\w+):/)
          if (rangeMatch) {
            const monthNames = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december']
            const startMonth = monthNames.indexOf(rangeMatch[1]) + 1
            const endMonth = monthNames.indexOf(rangeMatch[2]) + 1
            
            if (startMonth > 0 && endMonth > 0) {
              // Handle year-wrapping ranges (e.g., oktober-marts = Oct-Dec + Jan-Mar)
              const inRange = startMonth <= endMonth
                ? (currentMonth >= startMonth && currentMonth <= endMonth)
                : (currentMonth >= startMonth || currentMonth <= endMonth)
              
              if (inRange) {
                relevantNotes.push(note)
              }
            }
          }
        }
        
        if (relevantNotes.length > 0) {
          avoidSection += `\n\n⚠️ SÆSONKONTEKST: ${relevantNotes.join('; ')}`
          console.log(`🌍 Seasonal guidance applied: ${relevantNotes.length} rules for ${currentMonthName}`)
        }
      }
    }

    // Recent dishes already handled above - remove duplicate fetching

    // Selection bias removed - single menu suggestion doesn't need content-type preference signals

    // ── Day-of-week context ──
    const todayDate = clientNow
    const dayNames = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag']
    const dayName = dayNames[todayDate.getDay()]
    const dayBehavior = getDayBehavior(todayDate.getDay())
    const isWeekend = todayDate.getDay() === 0 || todayDate.getDay() === 6
    const activeServicePeriod = deriveServicePeriod(todayOpenTime, todayCloseTime)

    // Service-period override removed - single menu suggestion uses active period directly

    // Takeaway detection for context only
    const isTakeawayPrimary = hasTakeaway && !hasTableService

    // Single menu-focused suggestion - no slot planning needed
    const servicePeriodHint = activeServicePeriod && activeServicePeriod !== 'all_day'
      ? ` (serverer primært ${activeServicePeriod === 'dinner' ? 'aftensmad' : activeServicePeriod === 'brunch' ? 'brunch/morgenmad' : 'frokost'})`
      : ''

    // ── Populate Confirmed Facts Bank ──
    // Opening hours: for takeaway-primary businesses, prioritize kitchen hours (food service)
    // For dine-in or mixed service, use venue hours
    if (isTakeawayPrimary && kitchenCloseTime) {
      // Takeaway-only: kitchen hours = service hours
      confirmedFactsSlotB.push(`Takeaway tilgængelig: ${todayOpenTime}–${kitchenCloseTime}`)
      confirmedFacts.push(`Takeaway tilgængelig: ${todayOpenTime}–${kitchenCloseTime}`)
    } else if (todayOpenTime && todayCloseTime) {
      confirmedFactsSlotB.push(`Åbningstider i dag: ${todayOpenTime}–${todayCloseTime}`)
      confirmedFacts.push(`Åbningstider i dag: ${todayOpenTime}–${todayCloseTime}`)
    } else if (todayOpenTime) {
      confirmedFactsSlotB.push(`Åbner i dag kl. ${todayOpenTime}`)
      confirmedFacts.push(`Åbner i dag kl. ${todayOpenTime}`)
    }
    
    // ── Active Service Period (PAID TIERS) — Primary rationale anchor ──
    // Prioritize service period context over operational details (kitchen hours)
    // This gives rationales strategic framing: "Dette er en ret fra AFTEN-menuen"
    // rather than operational constraints: "Køkkenet holder åbent til kl. 21:00"
    // NEW: Shows ALL active periods when menus overlap (e.g., brunch + lunch)
    if (isPaidTier && currentServicePeriods.length > 0 && programsFromMenu.length > 0) {
      // Find all programs that are currently active
      const activePrograms: Array<{name: string; start: string; end: string; hoursUntilClose: number}> = []
      
      for (const program of programsFromMenu) {
        const progResult = getCurrentProgram([program], clientNow)
        if (progResult) {
          activePrograms.push(progResult)
        }
      }
      
      if (activePrograms.length > 0) {
        if (activePrograms.length === 1) {
          // Single active period (standard case)
          const prog = activePrograms[0]
          const periodLabel = currentServicePeriods[0].charAt(0).toUpperCase() + currentServicePeriods[0].slice(1)
          confirmedFactsSlotB.unshift(
            `🍽️ Aktiv serviceperiode: ${prog.name} (${prog.start}-${prog.end}) — vi serverer ${periodLabel.toLowerCase()} lige nu`
          )
          confirmedFacts.unshift(
            `🍽️ Aktiv serviceperiode: ${prog.name} (${prog.start}-${prog.end})`
          )
          console.log(`🍽️ Added active service period to confirmed facts: ${prog.name}`)
        } else {
          // Multiple overlapping periods (e.g., brunch + lunch active simultaneously)
          const periodDesc = activePrograms.map(p => `${p.name} (${p.start}-${p.end})`).join(' + ')
          const periodLabels = currentServicePeriods.map(p => 
            p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
          ).join(' og ')
          
          confirmedFactsSlotB.unshift(
            `🍽️ Aktive serviceperioder: ${periodDesc} — vi serverer ${periodLabels} lige nu`
          )
          confirmedFacts.unshift(
            `🍽️ Aktive serviceperioder: ${periodDesc}`
          )
          console.log(`🍽️ Added ${activePrograms.length} overlapping service periods to confirmed facts`)
        }
      }
    }
    
    // Outdoor seating: only a valid content anchor when the weather is actually suitable.
    // When weather is unsuitable, Gemini should not see this as an option — omit entirely.
    if (hasOutdoorSeating && outdoorSuitability) {
      confirmedFactsSlotB.push(`Udeservering i dag — GODT VEJR (${currentTemp}°C, lav vind, ingen nedbør)`)
      confirmedFacts.push(`Udeservering i dag — GODT VEJR (${currentTemp}°C, lav vind, ingen nedbør)`)
    }
    if (hasKidsMenu) {
      confirmedFactsSlotB.push('Har børnemenu')
      confirmedFacts.push('Har børnemenu')
    }
    if (hasTakeaway && !isTakeawayPrimary) {
      // Mixed service: note takeaway as additional option, not primary service
      confirmedFactsSlotB.push('Tilbyder også takeaway')
      confirmedFacts.push('Tilbyder også takeaway')
    }
    
    // ── Free Tier Enhancement: Add descriptive text facts for Slot B atmosphere ──
    if (tier === 'free') {
      const freeProfile = (globalThis as any).__freeTierProfile
      if (freeProfile) {
        // Priority order: ai_place_synopsis > user_about_text > menu_description > long_description
        // ai_place_synopsis: AI-generated concise place summary (ideal for atmosphere)
        if (freeProfile.aiPlaceSynopsis) {
          confirmedFactsSlotB.push(`Om stedet: ${freeProfile.aiPlaceSynopsis}`)
          confirmedFacts.push(`Om stedet: ${freeProfile.aiPlaceSynopsis}`)
          console.log('✅ Free tier: Using ai_place_synopsis for Slot B')
        }
        // user_about_text: Owner's own description (authentic voice)
        else if (freeProfile.userAboutText) {
          confirmedFactsSlotB.push(`Stedet er: ${freeProfile.userAboutText}`)
          confirmedFacts.push(`Stedet er: ${freeProfile.userAboutText}`)
          console.log('✅ Free tier: Using user_about_text for Slot B')
        }
        // menu_description: AI-generated menu overview
        else if (freeProfile.menuDescription) {
          confirmedFactsSlotB.push(`Stedet er: ${freeProfile.menuDescription}`)
          confirmedFacts.push(`Stedet er: ${freeProfile.menuDescription}`)
          console.log('✅ Free tier: Using menu_description for Slot B')
        }
        // long_description: Website "about" section (detailed but may be lengthy)
        else if (freeProfile.longDescription) {
          // Truncate if too long (keep first 200 chars for atmosphere context)
          const truncated = freeProfile.longDescription.length > 200
            ? freeProfile.longDescription.slice(0, 200) + '...'
            : freeProfile.longDescription
          confirmedFactsSlotB.push(`Beskrivelse: ${truncated}`)
          confirmedFacts.push(`Beskrivelse: ${truncated}`)
          console.log('✅ Free tier: Using long_description (truncated) for Slot B')
        }
        
        // Clean up global variable
        delete (globalThis as any).__freeTierProfile
      }
    }
    
    // 4D: If kitchen closes significantly before venue, inject bar-stays-open fact
    // BUT: Skip on Sundays (dag 0) — bar/drinks content doesn't fit Sunday brunch/family vibe
    if (kitchenCloseTime && todayCloseTime) {
      const dayOfWeek = clientNow.getDay() // 0 = Sunday, 6 = Saturday
      const isSunday = dayOfWeek === 0
      
      if (!isSunday) {
        const [kH, kM] = kitchenCloseTime.split(':').map(Number)
        const [cH, cM] = todayCloseTime.split(':').map(Number)
        const gapMins = (cH * 60 + cM) - (kH * 60 + kM)
        if (gapMins >= 90) {
          const gapH = Math.floor(gapMins / 60)
          confirmedFactsSlotB.push(`Bar åben til ${todayCloseTime} — ${gapH} timer efter køkkenet lukker kl. ${kitchenCloseTime}`)
          confirmedFacts.push(`Bar åben til ${todayCloseTime} — ${gapH} timer efter køkkenet lukker kl. ${kitchenCloseTime}`)
        }
      }
    }
    // Weekly programme: inject owner-entered recurring events as high-priority Slot B anchors.
    // Lines matching today's day name are injected first; remaining lines follow as secondary anchors.
    if (weeklyProgramme) {
      const dayNames: Record<number, string[]> = {
        0: ['søndag', 'søn'],
        1: ['mandag', 'man'],
        2: ['tirsdag', 'tir'],
        3: ['onsdag', 'ons'],
        4: ['torsdag', 'tor'],
        5: ['fredag', 'fre'],
        6: ['lørdag', 'lør'],
      }
      const todayDayAliases = dayNames[clientNow.getDay()] ?? []
      const lines = weeklyProgramme.split('\n').map(l => l.trim()).filter(Boolean)
      const todayLines: string[] = []
      const otherLines: string[] = []
      for (const line of lines) {
        const lower = line.toLowerCase()
        if (todayDayAliases.some(d => lower.startsWith(d))) {
          todayLines.push(line)
        } else {
          otherLines.push(line)
        }
      }
      // Today's events → top-priority Slot B anchor
      for (const line of todayLines) {
        confirmedFactsSlotB.push(`Ugentligt program (i dag): ${line}`)
        confirmedFacts.push(`Ugentligt program (i dag): ${line}`)
      }
      // Other days → background context (Slot C only, not primary Slot B anchor)
      for (const line of otherLines) {
        confirmedFacts.push(`Ugentligt program: ${line}`)
      }
    }
    if (businessCharacterText) {
      confirmedFactsSlotB.push(`Stedet er: ${businessCharacterText}`)
      confirmedFacts.push(`Stedet er: ${businessCharacterText}`)
    }
    // venue_energy and guest_situation_type: inject into Slot B (atmosphere anchor) and Slot C (BTS context).
    if (venueEnergyText || guestSituationText) {
      const venueParts: string[] = []
      if (venueEnergyText) venueParts.push(venueEnergyText)
      if (guestSituationText) venueParts.push(guestSituationText)
      const venueLine = `Stemning/energi: ${venueParts.join(' — ')}`
      confirmedFactsSlotB.push(venueLine)
      confirmedFacts.push(venueLine)
    }
    // Brand feeling: Slot C only — the synthesised feeling a guest takes home.
    // Injected as background evocation context for BTS/brand posts — NOT as a direct claim.
    // Label includes instruction so Gemini evokes the feeling rather than quoting it.
    if (emotionalPromiseText) {
      confirmedFacts.push(`Brandfølelse (evokér — skriv den IKKE direkte i opslaget): ${emotionalPromiseText}`)
    }
    // Interior inventory: Slot C only (background for BTS actions, not a guest motivation)
    if (venueIdentityText) confirmedFacts.push(`Rum/interiør: ${venueIdentityText}`)
    // Brand differentiator (V5 what_makes_us_different): Slot C only
    if (brandContextDifferentiator) {
      // Normalise to first person
      const escapedNameAI = business.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const firstPersonAI = brandContextDifferentiator
        .replace(/^Deres\b/i, 'Vores')
        .replace(/^De har\b/i, 'Vi har')
        .replace(/^De tilbyder\b/i, 'Vi tilbyder')
        .replace(new RegExp(`^${escapedNameAI}\\s+ligger\\b`, 'i'), 'Vi ligger')
        .replace(new RegExp(`^${escapedNameAI}\\s+har\\b`, 'i'), 'Vi har')
        .replace(new RegExp(`^${escapedNameAI}\\s+tilbyder\\b`, 'i'), 'Vi tilbyder')
        .replace(new RegExp(`^${escapedNameAI}\\s+er\\b`, 'i'), 'Vi er')
      confirmedFacts.push(`Hvad adskiller dem (AI-analyseret): ${firstPersonAI}`)
    }
    // Landmark proximity: valid Slot B+C location anchor (e.g. "ved Nyhavn", "ved Åen")
    if (locationLandmarkFact) {
      confirmedFactsSlotB.push(locationLandmarkFact)
      confirmedFacts.push(locationLandmarkFact)
    }
    // Neighborhood: valid Slot B+C anchor — area identity creates visit context
    if (locationNeighborhoodFact) {
      confirmedFactsSlotB.push(locationNeighborhoodFact)
      confirmedFacts.push(locationNeighborhoodFact)
    }
    // View: Slot B+C — a genuine view is a guest draw and a valid content anchor
    if (locationViewFact) {
      confirmedFactsSlotB.push(locationViewFact)
      confirmedFacts.push(locationViewFact)
    }
    // Hospitality density: Slot C only — competitive framing for brand/BTS posts
    // Not injected into Slot B (guest_moment) because density is a strategic meta-signal,
    // not a direct guest experience anchor
    if (locationHospitalityFact) {
      confirmedFacts.push(locationHospitalityFact)
    }
    // location_marketing_hooks: inject top hooks as Slot B+C anchors.
    // These are richer than marketing_focus (just one hook) — e.g. "Den eneste café ved åen".
    if (locationMarketingHooks.length > 0) {
      for (const hook of locationMarketingHooks) {
        confirmedFactsSlotB.push(`Lokations-hook: ${hook}`)
        confirmedFacts.push(`Lokations-hook: ${hook}`)
      }
    }
    // Active specials + events: inject as high-priority anchors.
    // Events (type='event') → Slot B primary anchor — time-sensitive, guest-facing.
    // All active specials → Slot C for brand/BTS context (promotions, recurring offers).
    if (activeSpecialsItems.length > 0) {
      for (const s of activeSpecialsItems) {
        const desc = s.description ? `: ${s.description.slice(0, 100)}` : ''
        const tag = s.type === 'event' ? ' (event)' : s.recurrence_rule ? ' (tilbagevendende)' : ''
        const line = `Aktiv event/tilbud: ${s.title}${desc}${tag}`
        if (s.type === 'event' || s.recurrence_rule) {
          // Time-bound events and recurring specials → strong Slot B anchor
          confirmedFactsSlotB.push(line)
        }
        // All active specials → Slot C context
        confirmedFacts.push(line)
      }
    }
    const confirmedFactsSlotBBlock = confirmedFactsSlotB.length > 0
      ? `\n\n──── BEKRÆFTEDE SERVICE-FACTS (eneste gyldige kilde til concrete_anchor for Slot B) ────\nSlot B er et gæstemoment — anker SKAL være en service- eller timingfact, IKKE interiørbeskrivelse.\nconcrete_anchor MÅ KUN vælges herfra — opfind IKKE nye facts:\n${confirmedFactsSlotB.map(f => `- ${f}`).join('\n')}\n`
      : ''
    const confirmedFactsSlotCBlock = confirmedFacts.length > 0
      ? `\n\n──── BEKRÆFTEDE FACTS (eneste gyldige kilde til concrete_anchor for Slot C) ────\nconcrete_anchor MÅ KUN vælges herfra — opfind IKKE nye facts om stedet:\n${confirmedFacts.map(f => `- ${f}`).join('\n')}\n`
      : ''
    
    // Menu intelligence block for Slot C — dietary options, drink programmes, named concepts from ai_summary
    const menuIntelligenceBlock = menuIntelligenceFacts.length > 0
      ? `\n\n──── MENU INTELLIGENCE (ide-signaler fra ai_summary) ────\n${menuIntelligenceFacts.map(f => `- ${f}`).join('\n')}\n`
      : ''
    
    // Legacy alias used by anchor repair and content-type clamping below
    const confirmedFactsBlock = confirmedFactsSlotCBlock

    // ── Effective vertical detection (3A) ──
    // Build TWO separate tracking maps:
    // 1. recencyMap: Used for FILTERING (includes both published posts AND suggestions for exclusion)
    // 2. publishedOnlyMap: Used for RECENCY CLAIMS (only actual published posts - no speculation)
    // 
    // KEY STRATEGY: Use menu_item_id (UUID) when available for accurate tracking.
    // Fall back to normalized name for legacy data without IDs.
    
    const recencyMap = new Map<string, { daysAgo: number; name: string }>() // For filtering
    const publishedOnlyMap = new Map<string, { daysAgo: number; name: string }>() // For recency claims

    // dishNameLookup is now built earlier (after context fetch) for reuse
    
    // Source 1: Published posts (ground truth - only actual published posts, status='published')
    for (const post of (recentPosts || [])) {
      const daysAgo = Math.ceil((clientNow.getTime() - new Date(post.posted_at).getTime()) / 86_400_000)
      
      let menuItemId = post.menu_item_id
      let menuItemName = post.menu_item_name
      
      // FIX: For manual posts without menu_item_name, extract from post_text
      if (!menuItemName && post.post_text) {
        // Try to match dish names from rotation queue in the post text
        const postTextLower = post.post_text.toLowerCase()
        let bestMatch: { id: string; name: string; length: number } | null = null
        
        for (const [normalizedName, dish] of dishNameLookup.entries()) {
          // Look for the dish name as a word (not substring of another word)
          const pattern = new RegExp(`\\b${normalizedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
          if (pattern.test(postTextLower)) {
            // Prefer longer matches (e.g., "Faustburger" over "Burger")
            if (!bestMatch || normalizedName.length > bestMatch.length) {
              bestMatch = { ...dish, length: normalizedName.length }
            }
          }
        }
        
        if (bestMatch) {
          menuItemId = bestMatch.id
          menuItemName = bestMatch.name
          console.log(`📝 Extracted dish from manual post text: "${bestMatch.name}" (${daysAgo} days ago)`)
        }
      }
      
      // Skip posts we couldn't resolve to a menu item
      if (!menuItemName) continue
      
      // Prefer UUID for accurate tracking; fall back to name for legacy data
      const key = menuItemId || menuItemName.toLowerCase().trim()
      
      // Update both maps (published posts count for both filtering AND recency claims)
      const cur = recencyMap.get(key)
      if (cur === undefined || daysAgo < cur.daysAgo) {
        recencyMap.set(key, { daysAgo, name: menuItemName as string })
      }
      
      const curPublished = publishedOnlyMap.get(key)
      if (curPublished === undefined || daysAgo < curPublished.daysAgo) {
        publishedOnlyMap.set(key, { daysAgo, name: menuItemName as string })
      }
    }
    
    // Source 2: AI suggestions — used for FILTERING ONLY, not for recency claims
    // (Prevents suggesting the same dish repeatedly, but doesn't make false claims about posting history)
    for (const s of (recentSuggestions || [])) {
      if (!s.menu_item_name || !s.created_at) continue
      const daysAgo = Math.ceil((clientNow.getTime() - new Date(s.created_at).getTime()) / 86_400_000)
      
      // Prefer UUID for accurate tracking; fall back to name for legacy data
      const key = s.menu_item_id || s.menu_item_name.toLowerCase().trim()
      const cur = recencyMap.get(key)
      
      // Only update recencyMap (for filtering), NOT publishedOnlyMap (for claims)
      if (cur === undefined || daysAgo < cur.daysAgo) {
        recencyMap.set(key, { daysAgo, name: s.menu_item_name as string })
      }
    }

    // Build TWO arrays:
    // 1. recentSlotADishesWithAge: ONLY published posts (for recency claims in prompts)
    // 2. Keep recencyMap for filtering logic below
    const recentSlotADishesWithAge: Array<{name: string; daysAgo: number}> =
      [...publishedOnlyMap.values()]
        .map(entry => ({ name: entry.name, daysAgo: entry.daysAgo }))
        .sort((a, b) => a.daysAgo - b.daysAgo) // most-recent first

    const confirmedPostCount = (recentPosts || []).filter((p: any) => p.menu_item_name).length
    const suggestionOnlyCount = [...recencyMap.keys()].filter(k =>
      // Check if this key (UUID or name) is NOT in published posts
      !(recentPosts || []).some((p: any) => {
        const postKey = p.menu_item_id || p.menu_item_name?.toLowerCase().trim()
        return postKey === k
      })
    ).length
    console.log(`📋 recencyMap: ${recencyMap.size} unique dishes for filtering (${confirmedPostCount} published, ${suggestionOnlyCount} suggested-only)`)
    console.log(`📋 publishedOnlyMap: ${publishedOnlyMap.size} dishes for recency claims (published posts only)`)

    const recentSlotADishes = recentSlotADishesWithAge.slice(0, 8).map(d => d.name)

    // Resolve using time-of-day for hybrid businesses (e.g. café-bar open mornings as café,
    // evenings as bar). detectHybridVerticals() returns ALL matched verticals;
    // resolveActiveVertical() picks the right one for the current hour.
    const hybridVerticals = detectHybridVerticals(
      business.vertical || '',
      businessCharacterText,
      identityKeywordsText,
    )
    const effectiveVertical = resolveActiveVertical(
      hybridVerticals,
      clientNow.getHours(),
      todayOpenTime,
      todayCloseTime,
    )
    const isHybridBusiness = hybridVerticals.length > 1
    if (isHybridBusiness) {
      console.log(`🔀 Hybrid verticals: ${hybridVerticals.join(', ')} → active: ${effectiveVertical}`)
    }
    const isBarVertical    = effectiveVertical === 'bar'
    const isBakeryVertical = effectiveVertical === 'bakery'
    const isCoffeeVertical = effectiveVertical === 'coffee_shop'

    // ── Determine current active program from menu times ──
    const currentProgram = programsFromMenu.length > 0 
      ? getCurrentProgram(programsFromMenu) 
      : null
    if (currentProgram) {
      console.log(`📅 Active program: ${currentProgram.name} (${currentProgram.start}-${currentProgram.end}, ${currentProgram.hoursUntilClose.toFixed(1)}h left)`)
    }

    // ── Soft menu prioritization (no hard filtering) ────────────────────────────
    // Builds priority hints for AI instead of removing dishes from the menu.
    // Prevents carousel effect while encouraging variety when possible.
    //
    // Tier 1: ≥3 dishes not posted in 7+ days  → soft priority guidance
    // Tier 2: ≥3 dishes not posted in 3+ days  → moderate priority guidance
    // Tier 3: all dishes posted within 3 days  → context-first (weather/time beats rotation)
    //
    // "Posted" = confirmed post (posts) OR AI suggestion (daily_suggestions).
    // recencyMap is built above from both sources.
    let rotationGuidance = ''
    {
      // Unified candidate list — works regardless of which data path the business uses
      const allCandidateNames: string[] = [
        ...menuCategoryEntries.flatMap(cat => cat.items.map((item: any) => item.name)),
        ...signatureItems,
      ]
      // Deduplicate (sig items sometimes overlap with category items)
      const seen = new Set<string>()
      const uniqueCandidates = allCandidateNames.filter(n => {
        const k = n.toLowerCase().trim()
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })

      const totalDishes = uniqueCandidates.length

      // Helper: Get dishes that haven't been posted within threshold days
      const getFreshDishes = (threshold: number) =>
        uniqueCandidates.filter(name => {
          const entry = recencyMap.get(name.toLowerCase().trim())
          return entry === undefined || entry.daysAgo >= threshold
        })

      // Helper: Get recent dishes with their ages
      const getRecentDishes = (maxAge: number) =>
        uniqueCandidates
          .map(name => {
            const entry = recencyMap.get(name.toLowerCase().trim())
            return { name, entry }
          })
          .filter(({ entry }) => entry && entry.daysAgo < maxAge)
          .sort((a, b) => (a.entry?.daysAgo || 0) - (b.entry?.daysAgo || 0))
          .map(({ name, entry }) => {
            const daysAgo = entry!.daysAgo
            const label = daysAgo === 0 ? 'i dag' : daysAgo === 1 ? 'i går' : `${daysAgo} dage siden`
            return `${name} (${label})`
          })

      const fresh7d = getFreshDishes(7)
      const fresh3d = getFreshDishes(3)

      if (fresh7d.length >= 3) {
        // Tier 1: Soft priority for dishes not posted in 7+ days
        const recent = getRecentDishes(7)
        rotationGuidance = `\n\n──── ROTATION PRIORITERING ────\n✅ PRIORITÉR DISSE (ikke delt for 7+ dage):\n${fresh7d.slice(0, 10).map(d => `- ${d}`).join('\n')}\n\n${recent.length > 0 ? `ℹ️ Nyligt delt (tilgængelige, men brug kun ved særlige omstændigheder):\n${recent.slice(0, 5).map(d => `- ${d}`).join('\n')}\n\n` : ''}→ Vælg primært fra første gruppe, men brug skøn hvis vejr, tid eller sæson kræver noget andet.`
        console.log(`🎯 Soft priority Tier 1: ${fresh7d.length} fresh dishes (7+ days), ${recent.length} recent`)
      } else if (fresh3d.length >= 3) {
        // Tier 2: Moderate priority for dishes not posted in 3+ days
        const recent = getRecentDishes(3)
        rotationGuidance = `\n\n──── ROTATION PRIORITERING ────\n✅ PRIORITÉR DISSE (ikke delt for 3+ dage):\n${fresh3d.slice(0, 10).map(d => `- ${d}`).join('\n')}\n\n${recent.length > 0 ? `⚠️ Meget nyligt delt (undgå medmindre perfekt match til vejr/tid):\n${recent.slice(0, 5).map(d => `- ${d}`).join('\n')}\n\n` : ''}→ Vælg fra første gruppe når muligt, men dagens kontekst har forrang.`
        console.log(`🎯 Soft priority Tier 2: ${fresh3d.length} fresh dishes (3+ days), ${recent.length} recent`)
      } else {
        // Tier 3: All dishes posted recently — context beats rotation
        const allRecent = uniqueCandidates
          .map(name => {
            const entry = recencyMap.get(name.toLowerCase().trim())
            return { name, daysAgo: entry?.daysAgo ?? 999 }
          })
          .sort((a, b) => b.daysAgo - a.daysAgo) // oldest first
          .slice(0, 15)
          .map(d => {
            const label = d.daysAgo === 999 ? 'aldrig delt' 
              : d.daysAgo === 0 ? 'i dag' 
              : d.daysAgo === 1 ? 'i går' 
              : `${d.daysAgo} dage siden`
            return `- ${d.name} (${label})`
          })

        rotationGuidance = `\n\n──── KONTEKST-FØRST TILSTAND ────\nAlle retter er delt inden for 3 dage. Vælg den ret der passer BEDST til:\n• Vejret i dag (${weatherInfo})\n• Tidspunkt (kl. ${clientNow.getHours()}:${clientNow.getMinutes().toString().padStart(2, '0')})\n• Aktuel service-periode\n\nℹ️ Rotation er sekundært. Hvis en nyligt delt ret er perfekt til vejret/tiden, vælg den.\n\nTilgængelige retter (ældste først):\n${allRecent.join('\n')}`
        console.log(`⚠️ Context-first mode: all ${totalDishes} dishes posted within 3 days — weather/time beats rotation`)
      }
    }

    // ── Build context object for prompt builder module ──
    const menuCategories: MenuCategory[] = menuCategoryEntries.map(cat => ({
      catName: cat.catName,
      items: cat.items
    }))

    const promptContext: DagensPromptContext = {
      // Business identity
      businessName: business.name,
      effectiveVertical,
      isHybridBusiness,
      businessCharacter: businessCharacterText,
      cuisineStyle: cuisineStyle ?? undefined,
      identityKeywords: identityKeywordsText,
      venueEnergyText,
      guestSituation: guestSituationText,
      emotionalPromise: emotionalPromiseText,
      
      // Location
      city: location?.city,
      country: location?.country,
      localLocationReference: localLocationReference ?? undefined,
      
      // Operations
      todayOpenTime: todayOpenTime ?? undefined,
      todayCloseTime: todayCloseTime ?? undefined,
      kitchenCloseTime: kitchenCloseTime ?? undefined,
      activeServicePeriod: activeServicePeriod ?? undefined,
      priceLevel: operations?.price_level,
      
      // Programs (service periods with accurate times from menu)
      currentProgram: currentProgram ?? undefined,
      allPrograms: programsFromMenu.length > 0 ? programsFromMenu : undefined,
      
      // Day/time context
      dayName,
      dayBehavior,
      isWeekend,
      currentHour: clientNow.getHours(),
      
      // Weather/season
      weatherInfo,
      season,
      outdoorNote,
      outdoorSuitability,
      outdoorProhibitionBlock,
      
      // Audience
      targetAudienceText,
      activeSegmentAngle: activeSegmentAngleText,
      primaryCopyHook: primaryCopyHookQS,
      
      // V5 Behavioral Guidance (June 2026)
      v5ToneNote,
      v5CTAType,
      v5ContentAngles: v5ContentAngles.length > 0 ? v5ContentAngles : undefined,
      
      // Menu
      menuCategories,
      signatureItems,
      // Pro tier: Reserved for future user-controlled priorities
      // Smart tier: No auto-prioritization - full AI freedom to choose best option
      timeAppropriateItems: isProTier && timeAppropriateItems.length > 0 ? timeAppropriateItems : undefined,
      menuDescriptionMap,
      socialLeadLabel: socialLeadLabel || undefined,
      menuLanguage,
      
      // Facts banks
      confirmedFacts,
      confirmedFactsSlotB,
      calendarEventFacts,
      locationMarketingHooks,
      menuIntelligenceFacts,
      
      // Constraints
      hasKidsMenu,
      hasTakeaway,
      hasOutdoorSeating,
      hasTableService,
      
      // Content strategy
      contentExclusions: contentExclusionsText,
      conceptFitAvoid: conceptFitAvoidItems,
      disabledSlots: [],
      
      // History
      recentSuggestions: (recentSuggestions || []) as any[],
      recentSlotADishes: recentSlotADishesWithAge.slice(0, 8).map(d => d.name), // recomputed after ghost-signal filter
      recentSlotADishesWithAge,
      selectionBiasBlock: '',
      
      // Brand voice
      toneInstructions,
      voiceRationale: voiceRationaleText,
      isPaidTier,
      touristContext: touristContext ? 'yes' : undefined,
      userContext: userContext?.trim() || undefined,
      
      // NEW V5.6: Team/people content anchors
      teamPeopleAnchors: v5Voice?.team_people_anchors || undefined,
    }

    // ── Build never-say list, shared context, menu block, and rules using module ──
    const { list: neverSayList, block: neverSayBlock } = buildComprehensiveNeverSayList(promptContext, brandProfile)
    const menuBlock = buildMenuBlock(promptContext)
    const userContextNote = userContext?.trim()
      ? `\n\n──── STYRENDE KONTEKST FRA VIRKSOMHEDEN ────\n${userContext.trim().slice(0, 120)}\n⚠️ Lad denne kontekst STYRE idévalget — den overstyrer generiske anbefalinger.`
      : ''
    
    // FREE TIER: Strip timing references for clean, simple prompts
    const sharedCtx = tier === 'free' 
      ? buildFreeSharedContext(promptContext) + userContextNote
      : buildSharedContext(promptContext) + userContextNote
    
    const sharedRules = tier === 'free'
      ? buildFreeSharedRules(promptContext, neverSayBlock)
      : buildSharedRules(promptContext, neverSayBlock)

    // ── GEMINI_API_KEY ──
    const GEMINI_API_KEY = getGeminiApiKey()

    // ── Dynamic Suggestion Calculator (June 2026) ──
    // NEW: Replaces fixed slot-calculator with dynamic 1-3 suggestion count
    // Implements:
    //   • Dynamic suggestion count (1-3) based on available time window
    //   • Decision tree logic (Q1-Q6) from specification
    //   • Content type selection (OFFERING vs ATMOSPHERE)
    //   • Smart closing time detection (kitchen vs business hours)
    //   • Timing rules: 30-60min immediate, 180min spacing, closing buffers
    console.log(`🎯 Dynamic suggestion calculator inputs:`)
    console.log(`   Current time: ${clientNow.toISOString()} (${clientNow.getHours()}:${clientNow.getMinutes().toString().padStart(2, '0')})`)
    console.log(`   Kitchen close: ${kitchenCloseTime || 'NOT SET'}`)
    console.log(`   Today hours: ${todayOpenTime} - ${todayCloseTime}`)
    console.log(`   Programs: ${programsFromMenu.map(p => `${p.name} (${p.start}-${p.end})`).join(', ')}`)
    console.log(`   V5 Programmes: ${v5Programmes?.length || 0}`)
    
    // Build programmes array from v5Programmes for dynamic calculator
    const programmesForCalculator = (v5Programmes || []).map(p => ({
      name: p.programme_name || p.programme_type,
      type: p.programme_type,
      time_windows: p.time_windows || [],
      operating_days: p.operating_days || []
    }))
    
    // Get weekday name for calculator
    const weekdayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const currentWeekday = weekdayNames[clientNow.getDay()]
    
    const dynamicSuggestionContext: CalculationContext = {
      now: clientNow,
      weekday: currentWeekday,
      openingTime: todayOpenTime ?? null,
      closingTime: todayCloseTime ?? null,
      programmes: programmesForCalculator,
      kitchenCloseTime: kitchenCloseTime ?? null,
      isClosedToday: isClosedToday
    }
    
    const dynamicResult = calculateDynamicSuggestions(dynamicSuggestionContext)
    
    console.log(`📊 Dynamic suggestion result: ${dynamicResult.suggestionCount} ideas`)
    console.log(`   Reasoning: ${dynamicResult.reasoning}`)
    
    // Legacy adapter: Create slotResult for backward compatibility
    const slotResult: SlotCalculationResult = {
      slotCount: dynamicResult.suggestionCount,
      availableHours: dynamicResult.metadata.availableHours,
      reasoning: dynamicResult.reasoning,
      slots: dynamicResult.ideas.map(idea => ({
        position: idea.ideaNumber,
        postAtMins: idea.postingTimeMins,
        postAt: idea.postingTime,
        serviceWindow: idea.eligibleProgrammes.length > 0 ? {
          name: idea.eligibleProgrammes[0],
          start: '00:00',  // Placeholder - not used downstream
          end: '23:59'     // Placeholder - not used downstream
        } : null,
        isFoodEligible: idea.contentType === 'OFFERING',
        allowedContentTypes: idea.contentType === 'OFFERING' ? ['menu_item', 'product'] : ['atmosphere', 'guest_moment', 'brand_behind'],
        isBarOnly: false,  // Deprecated
        label: idea.contentType
      })),
      activePeriods: currentServicePeriods,
      upcomingPeriods: [],
      isSocialDeadZone: clientNow.getHours() >= 0 && clientNow.getHours() < 6
    }

    // Create adapter for backward compatibility with existing code
    const nowMins = clientNow.getHours() * 60 + clientNow.getMinutes()
    const hasActivePeriods = slotResult.activePeriods.length > 0
    const hasUpcomingPeriods = slotResult.upcomingPeriods.length > 0
    
    const timeline: OperationalTimeline = {
      openMins: todayOpenTime ? parseInt(todayOpenTime.split(':')[0]) * 60 + parseInt(todayOpenTime.split(':')[1] || '0') : 0,
      closeMins: todayCloseTime ? parseInt(todayCloseTime.split(':')[0]) * 60 + parseInt(todayCloseTime.split(':')[1] || '0') : 1440,
      kitchenCloseMins: kitchenCloseTime ? parseInt(kitchenCloseTime.split(':')[0]) * 60 + parseInt(kitchenCloseTime.split(':')[1] || '0') : null,
      nowMins,
      serviceState: hasActivePeriods ? 'in_service' : hasUpcomingPeriods ? 'pre_opening' : !hasActivePeriods && !hasUpcomingPeriods ? 'post_service' : 'unknown',
      isClosedToday: false,
      isMidnightCrossing: false,
      windows: [],
      activeWindow: null,
      nextWindow: null,
      remainingWindows: [],
      inGap: !hasActivePeriods && hasUpcomingPeriods,
      gapNextWindow: null,
      effectiveSlotCount: slotResult.slotCount,
      isLateNight: slotResult.slots.some(s => s.isBarOnly),
      isSocialDeadZone: slotResult.isSocialDeadZone,
      slots: slotResult.slots.map(s => ({
        position: s.position,
        postAtMins: s.postAtMins,
        postAt: s.postAt,
        serviceWindow: s.serviceWindow ? {
          name: s.serviceWindow.name,
          start: s.serviceWindow.start,
          end: s.serviceWindow.end,
          isFoodService: s.isFoodEligible,
          startMins: 0,
          endMins: 0
        } : null,
        isFoodEligible: s.isFoodEligible,
        allowedContentTypes: s.allowedContentTypes,  // FIX: Include new field from slot calculator
        isBarOnly: s.isBarOnly,
        label: s.label
      })),
      summary: slotResult.reasoning
    }
    
    console.log(`📊 Slot calculation: ${slotResult.slotCount} slots, ${slotResult.availableHours.toFixed(1)}h available`)
    console.log(`   Reasoning: ${slotResult.reasoning}`)

    const routerHour = clientNow.getHours()
    const routerMins = clientNow.getMinutes()
    let effectiveSlotCount = timeline.effectiveSlotCount
    
    // Enhanced slot count logging (June 24, 2026)
    console.log(`🎯 Slot Count Decision:
      Timeline result: ${timeline.effectiveSlotCount}
      Current time: ${routerHour}:${routerMins.toString().padStart(2, '0')}
      Kitchen close: ${kitchenCloseTime || 'NOT SET'}
      Today close: ${todayCloseTime || 'NOT SET'}
      isLateNight: ${timeline.isLateNight}
      Service state: ${timeline.serviceState}
      Tier: ${tier}`)
    
    // FREE TIER OVERRIDE: Always generate 2 suggestions (1 menu + 1 atmosphere)
    // regardless of dynamic calculator result
    if (tier === 'free') {
      effectiveSlotCount = 2
      console.log(`📋 Free tier override: forcing 2 slots (1 menu + 1 atmosphere)`)
    }
    
    // FIX: Late night mode based on CURRENT hour, not future slot content
    // Late night: 21:00-05:59 (low social media reach, different framing)
    const isLateNightMode = routerHour >= 21 || routerHour < 6

    // For backward-compat with endedPrograms-based avoidSection augmentation
    const routerToMins = (hhmm: string) => { const [h, m = 0] = hhmm.split(':').map(Number); return h * 60 + m }
    const safeEndMins = (hhmm: string) => { const m = routerToMins(hhmm); return m < 600 ? m + 1440 : m }
    const normalizedNowMins = timeline.nowMins
    const endedPrograms = programsFromMenu.filter(p => safeEndMins(p.end) <= normalizedNowMins)
    const remainingPrograms = programsFromMenu.filter(p => safeEndMins(p.end) > normalizedNowMins)

    // ── Confirmed posting times for Slots B and C (replaces approximate smart time hints) ──
    // Times are now computed BEFORE any Gemini call and passed as hard facts.
    // The prompt tells Gemini the CONFIRMED time, not a "target ca. kl." approximation.
    const slotB = timeline.slots[1] ?? null
    const slotC = timeline.slots[2] ?? null
    const slotBTargetHour: number | null = slotB ? Math.floor(slotB.postAtMins / 60) : null
    const slotCTargetHour: number | null = slotC ? Math.floor(slotC.postAtMins / 60) : null

    let smartSlotBTimeHint = ''
    let smartSlotCTimeHint = ''
    let audienceTextForSlotB = ''
    let audienceTextForSlotC = ''
    if (isPaidTier && !isProTier && !isLateNightMode && slotB && effectiveSlotCount >= 2) {
      const preOpenNote = timeline.serviceState === 'pre_opening'
        ? ` (stedet åbner kl. ${todayOpenTime ?? `${routerHour}:00`} — vælg retter til dette tidspunkt og frem)`
        : ''
      const gapNote = timeline.inGap && slotB.isBarOnly
        ? ' [bar/atmosfære-indhold — køkkenet lukket i dette tidsrum]'
        : ''
      // Match persona to Slot B's target posting time (not generation time)
      if (slotBTargetHour !== null && slotBTargetHour !== routerHour && typeof matchPersonaForHour === 'function') {
        try {
          audienceTextForSlotB = await matchPersonaForHour(slotBTargetHour)
        } catch (e) {
          console.warn('⚠️ Slot B persona matching failed:', e)
          audienceTextForSlotB = targetAudienceText
        }
      } else {
        audienceTextForSlotB = targetAudienceText
      }
      const audienceNote = audienceTextForSlotB && slotBTargetHour !== null && slotBTargetHour !== routerHour
        ? `\n👥 MÅLGRUPPE PÅ DET TIDSPUNKT: Beskriv hvad der gør dette relevant for målgruppen PÅ kl. ${slotB.postAt} — ikke for folk der er ude nu kl. ${routerHour}:00.`
        : ''
      // If we're in pre-planning mode (before opening), emphasize future framing
      const tenseGuidanceB = timeline.isSocialDeadZone
        ? ` 🚫 STRENGT FORBUDT: Nutidsformuleringer som "Nu er det...", "Nu, hvor...", "I øjeblikket...", "Lige nu..." — Skriv ALTID fremtidsrettet: "Klokken ${slotB.postAt} er det tidspunkt, hvor...", "Når klokken runder ${slotB.postAt}..."`
        : ' Skriv fra perspektivet af at poste PÅ dette tidspunkt.'
      smartSlotBTimeHint = `\n\n🕑 MÅLRETTET POSTETID: Opslaget postes kl. ${slotB.postAt}${preOpenNote}${gapNote}.${audienceNote}${tenseGuidanceB}`
    }
    if (isPaidTier && !isProTier && !isLateNightMode && slotC && effectiveSlotCount >= 3) {
      const preOpenNote = timeline.serviceState === 'pre_opening'
        ? ` (stedet åbner kl. ${todayOpenTime ?? `${routerHour}:00`} — vælg retter til dette tidspunkt og frem)`
        : ''
      const barOnlyNote = slotC.isBarOnly
        ? ' [bar/atmosfære-indhold — foodslot deadline passeret]'
        : ''
      // Match persona to Slot C's target posting time (not generation time)
      if (slotCTargetHour !== null && slotCTargetHour !== routerHour && typeof matchPersonaForHour === 'function') {
        try {
          audienceTextForSlotC = await matchPersonaForHour(slotCTargetHour)
        } catch (e) {
          console.warn('⚠️ Slot C persona matching failed:', e)
          audienceTextForSlotC = targetAudienceText
        }
      } else {
        audienceTextForSlotC = targetAudienceText
      }
      const audienceNote = audienceTextForSlotC && slotCTargetHour !== null && slotCTargetHour !== routerHour
        ? `\n👥 MÅLGRUPPE PÅ DET TIDSPUNKT: Beskriv hvad der gør dette relevant for målgruppen PÅ kl. ${slotC.postAt} — ikke for folk der er ude nu kl. ${routerHour}:00.`
        : ''
      // If we're in pre-planning mode (before opening), emphasize future framing
      const tenseGuidanceC = timeline.isSocialDeadZone
        ? ` 🚫 STRENGT FORBUDT: Nutidsformuleringer som "Nu er det...", "Nu, hvor...", "I øjeblikket...", "Lige nu..." — Skriv ALTID fremtidsrettet: "Klokken ${slotC.postAt} er det tidspunkt, hvor...", "Når klokken runder ${slotC.postAt}..."`
        : ' Skriv fra perspektivet af at poste PÅ dette tidspunkt.'
      smartSlotCTimeHint = `\n\n🕒 MÅLRETTET POSTETID: Opslaget postes kl. ${slotC.postAt}${preOpenNote}${barOnlyNote}.${audienceNote}${tenseGuidanceC}`
    }

    // Augment avoidSection: tell Gemini which named service periods are already over.
    // Use actual program names when available; fall back to clock-time heuristics otherwise.
    if (endedPrograms.length > 0) {
      const endedNames   = endedPrograms.map(p => p.name).join(', ')
      const remainNames  = remainingPrograms.map(p => p.name).join(', ')
      avoidSection += `\n\n⛔ AFSLUTTEDE SERVICE-PERIODER I DAG: ${endedNames}. Undgå indhold og titler der refererer til disse perioder.${remainNames ? ` Fokusér i stedet på: ${remainNames}.` : ''}`
    } else if (programsFromMenu.length === 0) {
      // No program data — use clock-time heuristics as a rough guide
      if (isLateNightMode) {
        const nowHHMMavoid = `${String(clientNow.getHours()).padStart(2, '0')}:${String(clientNow.getMinutes()).padStart(2, '0')}`
        avoidSection += timeline.isSocialDeadZone
          ? `\n\n⛔ AKTUEL TID: kl. ${nowHHMMavoid} (nat). Ingen restaurantgæster er ude nu. Fokusér på et opslag til morgenstunden, ikke til natten.`
          : `\n\n⛔ AKTUEL TID: kl. ${nowHHMMavoid} — Dagens service er afsluttet. Fokusér på morgenstunden.`
      } else if (timeline.isSocialDeadZone) {
        // Pre-opening dead zone: user is planning ahead. Gemini needs to know
        // the suggestions are for upcoming service windows, not right now.
        const nowHHMMavoid = `${String(clientNow.getHours()).padStart(2, '0')}:${String(clientNow.getMinutes()).padStart(2, '0')}`
        avoidSection += `\n\n📅 FORHÅNDSPLANLÆGNING: Det er kl. ${nowHHMMavoid} (før åbning). Operatøren planlægger dagens opslag på forhånd. 🚫 FORBUDT: "nu", "i øjeblikket", "nu er det" — brug fremtid: "klar til", "venter på dig", "kom forbi", "klokken X er det tidspunkt, hvor..."`
      } else if (routerHour >= 15) {
        avoidSection += `\n\n⛔ AKTUEL TID: kl. ${routerHour}:00 — Morgenmad, brunch og frokost er typisk afsluttet. Fokusér på eftermiddag og aftenservice.`
      } else if (routerHour >= 11) {
        avoidSection += `\n\n⛔ AKTUEL TID: kl. ${routerHour}:00 — Morgenmad og brunch er ved at slutte. Prioritér frokost og eftermiddag.`
      }
    }

    // ── Append rotation guidance to avoid section ──
    // Soft prioritization hints built earlier are added to the prompt context
    if (rotationGuidance) {
      avoidSection += rotationGuidance
    }

    // ── Load language-specific system instruction ──
    const systemInstruction = await buildDagensSystemInstruction(language)

    // ── Day Framing (All Tiers) ──
    // Generate contextual framing for the day to display in UI
    let weatherParsed: { city: string; temperature: string; conditions: string } | null = null
    try {
      if (weatherForecast) {
        weatherParsed = JSON.parse(weatherForecast)
      }
    } catch (e) {
      console.warn('Failed to parse weather forecast:', e)
    }
    
    const hasSpecialPrograms = programsFromMenu.length > 0 && 
      programsFromMenu.some(p => !['brunch', 'frokost', 'lunch', 'aftensmad', 'dinner'].some(kw => p.name.toLowerCase().includes(kw)))
    
    const dayFraming = generateDayFraming(clientNow, business?.name || '', timeline, weatherParsed, hasSpecialPrograms)
    
    // ── Slot planner ───────────────────────────────────────────────────────
    // Free tier: fixed 2-slot mix = one menu item + one atmosphere/behind_scenes.
    // Smart tier (standardplus): menu_item only — no planner, no atmosphere/BTS.
    // Pro tier (premium): full planner decides content mix (atmosphere, BTS, etc.).
    let plannerResult: SlotPlannerResult = isPaidTier
      ? { slot_types: ['menu_item', 'menu_item', 'menu_item'], rationale: '' }
      : { slot_types: ['menu_item', 'atmosphere'], rationale: 'Free tier: one menu item + one atmosphere/behind_scenes based on web analysis.' }
    if (isProTier && effectiveSlotCount > 1) {
      plannerResult = await runSlotPlanner(promptContext, GEMINI_API_KEY)
    }
    const activeSlotTypes = plannerResult.slot_types.slice(0, effectiveSlotCount)
    
    // ── Generate timing rationale (tier-specific) ──
    let plannerRationale = ''
    
    if (isProTier && plannerResult.rationale) {
      // Pro tier: Full detailed strategic reasoning
      plannerRationale = `${dayFraming}. ${plannerResult.rationale}`
    } else if (isPaidTier) {
      // Smart tier: Simplified "post now vs post later" timing guidance
      const currentHour = clientNow.getHours()
      const currentDayOfWeek = clientNow.getDay() // 0 = Sunday, 5 = Friday, 6 = Saturday
      const isWeekendEvening = (currentDayOfWeek === 5 || currentDayOfWeek === 6) && currentHour >= 16
      const hasOutdoorOpportunity = outdoorSuitability
      const timeOfDayLabel = currentHour < 10 ? 'morgen'
        : currentHour < 14 ? 'formiddag'
        : currentHour < 17 ? 'eftermiddag'
        : currentHour < 21 ? 'aften'
        : 'sen aften'
      
      let postNowReason = ''
      let postLaterSuggestion = ''
      
      // Build "post now" reasoning
      if (isWeekendEvening && hasOutdoorOpportunity && isHybridBusiness) {
        postNowReason = `${currentDayOfWeek === 5 ? 'Fredag' : 'Lørdag'} aften med godt vejr — perfekt timing for at lokke gæster til drinks`
      } else if (hasOutdoorOpportunity && currentHour >= 11 && currentHour < 16) {
        postNowReason = `Godt vejr og ${timeOfDayLabel} — udeservering appellerer nu`
      } else if (currentHour >= 16 && currentHour < 19) {
        postNowReason = `${timeOfDayLabel.charAt(0).toUpperCase() + timeOfDayLabel.slice(1)} — gæster planlægger aftenens valg`
      } else if (currentHour >= 9 && currentHour < 11) {
        postNowReason = `${timeOfDayLabel.charAt(0).toUpperCase() + timeOfDayLabel.slice(1)} — fang morgengæster før de beslutter sig`
      } else {
        postNowReason = `${dayName} ${timeOfDayLabel} — nå gæster mens de er aktive`
      }
      
      // Build "or post later" suggestion
      if (currentHour < 10 && todayCloseTime && parseInt(todayCloseTime.split(':')[0]) >= 17) {
        postLaterSuggestion = ` eller gem til eftermiddag/aften når aftentrafik peaker`
      } else if (currentHour >= 10 && currentHour < 14 && todayCloseTime && parseInt(todayCloseTime.split(':')[0]) >= 18) {
        postLaterSuggestion = ` eller vent til aften (kl. 16-18) for maksimal rækkevidde`
      } else if (currentHour >= 14 && currentHour < 16) {
        postLaterSuggestion = ` eller post om 1-2 timer når aftentrafikken starter`
      }
      
      plannerRationale = `${dayFraming}. ${postNowReason}${postLaterSuggestion || ''}.`
    } else {
      // Free tier: Just day framing, no strategic reasoning
      plannerRationale = dayFraming
    }

    // ── Recent slot A section (for avoid block in prompts) ──
    // Only show dishes within the forbidden threshold (0-6 days = full week rotation) to avoid confusion
    const forbiddenDishes = recentSlotADishesWithAge.filter(d => d.daysAgo <= 6)
    const recentSlotASection = forbiddenDishes.length > 0
      ? `\n\nRetter brugt nyligt (undgå gentagelse):\n${forbiddenDishes.map(d => `- ${normalizeDishName(d.name)} (${d.daysAgo === 0 ? 'i dag' : d.daysAgo === 1 ? 'i går' : `${d.daysAgo} dage siden`})`).join('\n')}\n`
      : ''

    // ── confirmedFactsSlotBBlock and confirmedFactsSlotCBlock are already built above ──
    // (declared after active specials in the confirmed facts section)

    // ═══════════════════════════════════════════════════════════════════════════
    // SLOT A — Primary offering (always menu_item: food or drinks)
    // ═══════════════════════════════════════════════════════════════════════════
    const slotAType = 'menu_item'  // Quick Suggestions = menu items only (food OR drinks)

    // Get confirmed posting time for Slot A from timeline
    const slotA = timeline.slots[0] ?? null
    const slotATime = slotA?.postAt ?? todayOpenTime ?? '12:00'
    
    // Build timing context for Slot A — SEPARATED BY TIER
    let slotATimeHint = ''
    
    if (isPaidTier) {
      // ═══════════════════════════════════════════════════════════════════════
      // PAID TIER (Smart + Pro): Time-aware slot positioning
      // ═══════════════════════════════════════════════════════════════════════
      // Uses calculated posting times from dynamic suggestion calculator
      // AI is instructed to write for specific audience at that time
      if (!isLateNightMode && slotA) {
        // Determine time of day category
        const hourNum = Math.floor(slotA.postAtMins / 60)
        const timeOfDay = hourNum < 11 ? 'morgen/formiddag' 
          : hourNum < 14 ? 'frokosttid'
          : hourNum < 17 ? 'eftermiddag'
          : hourNum < 21 ? 'aftensmad'
          : 'sen aften'
        
        // If we're in pre-planning mode (before opening), emphasize future framing
        const tenseGuidance = timeline.isSocialDeadZone
          ? ` 🚫 STRENGT FORBUDT: Nutidsformuleringer som "Nu er det...", "Nu, hvor...", "I øjeblikket...", "Lige nu..." — Skriv ALTID fremtidsrettet: "Klokken ${slotATime} er det tidspunkt, hvor...", "Når klokken runder ${slotATime}..."`
          : ' Skriv fra perspektivet af at poste PÅ dette tidspunkt.'
        
        slotATimeHint = `\n\n🕐 MÅLRETTET POSTETID: Opslaget postes kl. ${slotATime} (${timeOfDay}). Skriv title og why_explanation om publikummet på DETTE tidspunkt.${tenseGuidance} Undgå at nævne tidspunkter eller målgrupper der IKKE passer til kl. ${slotATime}.`
      }
    } else {
      // ═══════════════════════════════════════════════════════════════════════
      // FREE TIER: Simple "post now" suggestion
      // ═══════════════════════════════════════════════════════════════════════
      // Slot A = immediate menu item suggestion (no specific timing references)
      // TODO: Remove time-specific guidance for Free tier
      if (!isLateNightMode && slotA) {
        // Determine time of day category
        const hourNum = Math.floor(slotA.postAtMins / 60)
        const timeOfDay = hourNum < 11 ? 'morgen/formiddag' 
          : hourNum < 14 ? 'frokosttid'
          : hourNum < 17 ? 'eftermiddag'
          : hourNum < 21 ? 'aftensmad'
          : 'sen aften'
        
        // If we're in pre-planning mode (before opening), emphasize future framing
        const tenseGuidance = timeline.isSocialDeadZone
          ? ` 🚫 STRENGT FORBUDT: Nutidsformuleringer som "Nu er det...", "Nu, hvor...", "I øjeblikket...", "Lige nu..." — Skriv ALTID fremtidsrettet: "Klokken ${slotATime} er det tidspunkt, hvor...", "Når klokken runder ${slotATime}..."`
          : ' Skriv fra perspektivet af at poste PÅ dette tidspunkt.'
        
        slotATimeHint = `\n\n🕐 MÅLRETTET POSTETID: Opslaget postes kl. ${slotATime} (${timeOfDay}). Skriv title og why_explanation om publikummet på DETTE tidspunkt.${tenseGuidance} Undgå at nævne tidspunkter eller målgrupper der IKKE passer til kl. ${slotATime}.`
      }
    }

    // Late-night / social dead zone: give Gemini full situational awareness and
    // a genuine advisor persona so it reasons correctly rather than following a template.
    // The timeline has already redirected the slot time to the venue's opening time.
    const nowHHMM = `${String(clientNow.getHours()).padStart(2, '0')}:${String(clientNow.getMinutes()).padStart(2, '0')}`
    const lateNightFraming = isLateNightMode
      ? (() => {
          const kitchenLine = kitchenCloseTime
            ? `Køkkenet lukkede kl. ${kitchenCloseTime}.`
            : 'Madservicen er afsluttet.'
          const openLine = todayOpenTime
            ? `Stedet åbner igen kl. ${todayOpenTime}.`
            : 'Stedet åbner igen om morgenen.'
          const deadZoneLine = timeline.isSocialDeadZone
            ? `Det er kl. ${nowHHMM} — ingen scroller Instagram efter restaurantanbefalinger på dette tidspunkt.`
            : `Det er kl. ${nowHHMM} — aftenindsatsen er afsluttet.`
          const slotTime = timeline.slots[0]?.postAt ?? todayOpenTime ?? '09:30'
          return `\n\n🌙 SITUATIONSKONTEKST:\n${deadZoneLine} ${kitchenLine} ${openLine}\n\nDu er restaurantens personlige social media-rådgiver — engageret, konkret og klog på hvad der faktisk virker. Operatøren har åbnet appen nu. Hvad er det FØRSTE opslag der giver ægte mening at sende ud, når morgenstunden nærmer sig?\n\nTænk som en rådgiver — ikke som et automatiseringssystem:\n- Hvilken konkret ret eller stemning fra menuen er perfekt til morgentimernes publikum?\n- Hvad vil tiltrække gæster til brunch, frokost eller den første kop kaffe?\n- why_explanation skal forklare præcist hvad der gør dette opslag relevant til morgenstunden — vær specifik om sæson, ugedag og det konkrete produkt. Undgå generiske formuleringer.\n- title skal lyde naturligt og indbydende — som om det er skrevet af et menneske der kender stedet, ikke genereret.\n\nSæt suggested_time til kl. ${slotTime}.\n`
        })()
      : ''

    const menuFallback: any = {
      title: signatureItems[0] ? `${signatureItems[0]} klar nu` : 'Dagens ret er klar',
      menu_item_name: signatureItems[0] || '',
      dish_text_brief: menuDescriptionMap.get(signatureItems[0] || '') || '',
      content_type: 'menu_item',
      slot: 'offering',
    }
    
    // Add why_explanation only for paid tiers (Free tier skips rationales)
    if (isPaidTier) {
      menuFallback.why_explanation = signatureItems[0]
        ? `${signatureItems[0]} serveres fra kl. ${todayOpenTime || '12:00'}.`
        : 'Del dagens tilbud med dine følgere.'
    }

    const menuPrompt = buildSlotAPrompt(
      promptContext,
      slotAType,
      sharedCtx,
      sharedRules,
      menuBlock,
      recentSlotASection,
      avoidSection + lateNightFraming + slotATimeHint
    )

    console.log(`🤖 Generating Slot A [${slotAType}] via Gemini${isLateNightMode ? ' (late-night framing)' : ''}`)
    const rawSlotA = await callGemini({
      apiKey: GEMINI_API_KEY,
      systemInstruction,
      userPrompt: menuPrompt,
      slotLabel: 'SlotA',
      fallback: menuFallback,
    })
    let suggestions: any[] = [rawSlotA]
    
    // Declare slot variables outside conditional blocks so they're accessible later
    let rawSlotB: any = null
    let rawSlotC: any = null

    // Fuzzy dish-name match used by Slot B/C context filters (hoisted so both blocks can use it)
    const _matchesDish = (a: string, b: string) =>
      a.toLowerCase().includes(b.toLowerCase()) || b.toLowerCase().includes(a.toLowerCase())

    // ═══════════════════════════════════════════════════════════════════════════
    // SLOTS B+C — UNIFIED GENERATION (Phase 1 Hybrid - June 2026)
    // ═══════════════════════════════════════════════════════════════════════════
    // Generate Slots B and C together in a single AI call for 50% latency reduction
    // Preserves Slot A deduplication logic by building avoidance rules first
    
    if (effectiveSlotCount >= 2) {
      const slotBType = activeSlotTypes[1] ?? 'menu_item'
      const slotBIsMenu = slotBType === 'menu_item'
      
      // Session deduplication for Slot B: exclude the dish already chosen in Slot A
      const sessionAvoidB = rawSlotA?.menu_item_name
        ? `\n\n⛔ DISSE RETTER ER ALLEREDE VALGT I DETTE SÆT — vælg en HELT ANDEN ret (inkl. alle variationer og kombinationer med dette navn):\n- ${rawSlotA.menu_item_name}\n\n⛔ TIDSANCHOR: "Køkkenet holder/lukker åbent til kl. X" er allerede brugt i Slot A. Brug et ANDET tidspunkt som anchor — fx service-periodens start, åbningstid, eller det nuværende klokkeslæt.`
        : `\n\n⛔ TIDSANCHOR: "Køkkenet holder/lukker åbent til kl. X" er allerede brugt i Slot A. Brug et ANDET tidspunkt som anchor — fx service-periodens start, åbningstid, eller det nuværende klokkeslæt.`

      const slotBFallback = {
        title: `${dayName}s gæstemoment`,
        concrete_anchor: confirmedFactsSlotB[0] || `Åbent fra kl. ${todayOpenTime || '09:00'}`,
        why_explanation: `Gæsterne er klar til ${dayName.toLowerCase()}. ${confirmedFactsSlotB[0] || ''}`,
        content_type: slotBType,
        slot: 'guest_moment',
      }

      // Build a filtered menu block that physically removes Slot A's dish and uses
      // the menu that will be ACTIVE at Slot B's target posting time (not the current menu).
      const slotAUsedNames = rawSlotA?.menu_item_name ? [rawSlotA.menu_item_name] : []
      let menuBlockForB: string
      if (slotBIsMenu && buildCategoriesForHour && slotBTargetHour !== null) {
        const catsForB = buildCategoriesForHour(slotBTargetHour)
          .map(cat => ({ ...cat, items: cat.items.filter(item => !slotAUsedNames.some(ex => item.name.toLowerCase().includes(ex.toLowerCase()) || ex.toLowerCase().includes(item.name.toLowerCase()))) }))
          .filter(cat => cat.items.length > 0)
        const ctxForB = { ...promptContext, menuCategories: catsForB, signatureItems: catsForB.flatMap(c => c.items.map(i => i.name)) }
        console.log(`🕑 Slot B menu: ${catsForB.reduce((n, c) => n + c.items.length, 0)} items from targetH=${slotBTargetHour} (${catsForB.map(c => c.catName).join(', ')})`)
        menuBlockForB = buildMenuBlock(ctxForB)
      } else if (slotBIsMenu) {
        menuBlockForB = buildMenuBlockExcluding(promptContext, slotAUsedNames)
      } else {
        menuBlockForB = menuBlock
      }

      // Build a context for Slot B that strips the Slot-A dish from the recency signal.
      const ctxForSlotB = slotAUsedNames.length > 0
        ? {
            ...promptContext,
            recentSlotADishesWithAge: (promptContext.recentSlotADishesWithAge ?? []).filter(
              d => !slotAUsedNames.some(ex => _matchesDish(d.name, ex))
            ),
            recentSlotADishes: promptContext.recentSlotADishes.filter(
              d => !slotAUsedNames.some(ex => _matchesDish(d, ex))
            ),
          }
        : promptContext

      // Prepare Slot C (if needed)
      const hasMenuBasedSlotA = rawSlotA?.content_type === 'menu_item'
      const shouldGenerateSlotC = effectiveSlotCount >= 3 && hasMenuBasedSlotA
      
      if (shouldGenerateSlotC) {
        // Slot C generation
        const slotCType = primaryCopyHookQS === 'identity' ? 'behind_scenes' : 'atmosphere'
        const slotCSlot = slotCType === 'behind_scenes' ? 'brand_behind' : 'guest_moment'
        const slotCAnchor = venueIdentityText || activeSegmentAngleText || businessCharacterText || confirmedFacts[0] || business.name

        const slotCFallback = {
          title: slotCType === 'behind_scenes' ? 'Bag facaden i dag' : 'Stedets stemning i dag',
          concrete_anchor: slotCAnchor,
          why_explanation: slotCType === 'behind_scenes'
            ? `Brug den levende identitet bag stedet som vinkel, så generate-text-from-idea kan bygge videre på en konkret, menneskelig idé.`
            : `Brug stedets identitet, lokationssignal og aktive gæstevinkel som anker, så generate-text-from-idea kan gøre ideen til en tekst uden at falde tilbage på menuen.`,
          occasion_context: slotCType === 'behind_scenes'
            ? `En bag-facaden-vinkel baseret på stedets aktive identitetsfelter.`
            : `En stemningsvinkel baseret på stedets aktive identitetsfelter og lokationssignaler.`,
          content_type: slotCType,
          slot: slotCSlot,
        }

        // ═══ UNIFIED B+C CALL ═══
        console.log(`🤖 Generating Slots B+C [${slotBType}, ${slotCType}] via Gemini (unified)`)
        
        const unifiedPromptBC = buildUnifiedPromptBC(
          ctxForSlotB,
          slotBType,
          slotCType,
          slotBIsMenu,
          sharedCtx,
          sharedRules,
          menuBlockForB,
          recentSlotASection,
          confirmedFactsSlotBBlock,
          confirmedFactsSlotCBlock,
          menuIntelligenceBlock,
          avoidSection + sessionAvoidB + smartSlotBTimeHint,
          slotB ? {
            targetPostTime: slotB.postAt,
            targetSegmentTime: audienceTextForSlotB,
            targetServiceWindow: slotB.serviceWindow ? {
              name: slotB.serviceWindow.name,
              start: slotB.serviceWindow.start,
              end: slotB.serviceWindow.end
            } : undefined
          } : undefined,
          slotC ? {
            targetPostTime: slotC.postAt,
            targetSegmentTime: audienceTextForSlotC,
            targetServiceWindow: slotC.serviceWindow ? {
              name: slotC.serviceWindow.name,
              start: slotC.serviceWindow.start,
              end: slotC.serviceWindow.end
            } : undefined
          } : undefined
        )

        const [slotBResult, slotCResult] = await callGeminiArray({
          apiKey: GEMINI_API_KEY,
          systemInstruction,
          userPrompt: unifiedPromptBC,
          slotLabel: 'Slots-B+C',
          fallback: slotBFallback, // Legacy parameter
          fallbacks: [slotBFallback, slotCFallback],
        })

        rawSlotB = slotBResult
        rawSlotC = slotCResult
        suggestions.push(rawSlotB, rawSlotC)
        
      } else if (effectiveSlotCount >= 3) {
        console.log('⏭️ Skipping Slot C because Slot A is not a menu_item — generating Slot B only')
        
        // Generate Slot B only (fallback to old single-slot logic)
        const slotBPrompt = buildSlotBPrompt(
          ctxForSlotB,
          slotBType,
          slotBIsMenu,
          sharedCtx,
          sharedRules,
          menuBlockForB,
          recentSlotASection,
          confirmedFactsSlotBBlock,
          avoidSection + sessionAvoidB + smartSlotBTimeHint,
          slotB?.postAt,
          audienceTextForSlotB,
          slotB?.serviceWindow ? {
            name: slotB.serviceWindow.name,
            start: slotB.serviceWindow.start,
            end: slotB.serviceWindow.end
          } : undefined
        )

        console.log(`🤖 Generating Slot B [${slotBType}] via Gemini`)
        rawSlotB = await callGemini({
          apiKey: GEMINI_API_KEY,
          systemInstruction,
          userPrompt: slotBPrompt,
          slotLabel: 'SlotB',
          fallback: slotBFallback,
        })
        suggestions.push(rawSlotB)
        
      } else {
        // Only Slot B needed (effectiveSlotCount === 2)
        const slotBPrompt = buildSlotBPrompt(
          ctxForSlotB,
          slotBType,
          slotBIsMenu,
          sharedCtx,
          sharedRules,
          menuBlockForB,
          recentSlotASection,
          confirmedFactsSlotBBlock,
          avoidSection + sessionAvoidB + smartSlotBTimeHint,
          slotB?.postAt,
          audienceTextForSlotB,
          slotB?.serviceWindow ? {
            name: slotB.serviceWindow.name,
            start: slotB.serviceWindow.start,
            end: slotB.serviceWindow.end
          } : undefined
        )

        console.log(`🤖 Generating Slot B [${slotBType}] via Gemini`)
        rawSlotB = await callGemini({
          apiKey: GEMINI_API_KEY,
          systemInstruction,
          userPrompt: slotBPrompt,
          slotLabel: 'SlotB',
          fallback: slotBFallback,
        })
        suggestions.push(rawSlotB)
      }
    }

    // ── Spell check titles with surface-level error signals ─────────────────
    const allSuggestions = [rawSlotA, rawSlotB, rawSlotC].filter(Boolean)
    
    // Spell check titles
    for (let i = 0; i < allSuggestions.length; i++) {
      const suggestion = allSuggestions[i]
      const title = suggestion.title
      
      if (title && needsSpellingCheck(title)) {
        console.log(`[Spell check ${i + 1}/${allSuggestions.length}] Checking title: "${title}"`)
        const correctedTitle = await silentCorrect(title, 'da')
        if (correctedTitle !== 'PASS') {
          console.log(`[Spell check ${i + 1}] Corrected: "${title}" → "${correctedTitle}"`)
          suggestion.title = correctedTitle
        } else {
          console.log(`[Spell check ${i + 1}] No corrections needed`)
        }
      }
    }

    // ── Validate: Reject recent dishes (hard constraint) ────────────────────
    // If AI ignored the avoidance instruction, reject the suggestion and log warning
    const recentDishNames = new Set(
      recentSlotADishesWithAge
        .filter(d => d.daysAgo <= 6) // Last 7 days: today (0) through 6 days ago (6)
        .map(d => d.name.toLowerCase().trim())
    )
    const scheduledDishNames = new Set(
      scheduledDishNamesWithAge
        .map(d => d.name?.toLowerCase().trim())
        .filter((name): name is string => Boolean(name))
    )
    
    for (let i = 0; i < allSuggestions.length; i++) {
      const suggestion = allSuggestions[i]
      const menuItemName = suggestion.menu_item_name
      const menuItemKey = suggestion.menu_item_id || menuItemName?.toLowerCase().trim() || ''
      
      if (menuItemName && suggestion.content_type === 'menu_item') {
        const normalizedName = menuItemName.toLowerCase().trim()
        const isRecentlyUsed = recentDishNames.has(normalizedName) || (menuItemKey !== '' && recentDishNames.has(menuItemKey))
        const isScheduled = scheduledDishNames.has(normalizedName) || (menuItemKey !== '' && scheduledKeys.has(menuItemKey))

        if (isRecentlyUsed || isScheduled) {
          const reason = isRecentlyUsed ? 'used recently' : 'already scheduled'
          console.warn(`⚠️ VALIDATION FAIL [Slot ${i === 0 ? 'A' : i === 1 ? 'B' : 'C'}]: AI suggested "${menuItemName}" despite being ${reason}. Replacing with fallback.`)
          
          // Find an unused dish from menu as replacement
          const unusedDish = signatureItems.find(dish => 
            !recentDishNames.has(dish.toLowerCase().trim()) && !scheduledDishNames.has(dish.toLowerCase().trim())
          )
          
          if (unusedDish) {
            console.log(`✅ Replacing with unused dish: "${unusedDish}"`)
            suggestion.menu_item_name = unusedDish
            suggestion.title = `${unusedDish} klar nu`
            suggestion.dish_text_brief = menuDescriptionMap.get(unusedDish) || ''
            suggestion.why_explanation = `${unusedDish} er klar og venter på dig.`
          } else {
            console.warn(`⚠️ No unused dishes found in signature items. Keeping original but logging warning.`)
          }
        }
      }
    }

    // ── Repair + validate ────────────────────────────────────────────────────
    // validateAndRepair runs the full suite: anchor repair, promotional copy strip,
    // ingredient hallucination detection, weather tone guard, kitchen-close guard.
    suggestions = validateAndRepair(
      suggestions,
      timeline.slots,
      confirmedFacts,
      business.name,
      outdoorSuitability,
      hasOutdoorSeating,
      menuDescriptionMap,
    )

    // ── Persist to DB, assemble response ─────────────────────────────────────
    // Slot C can now be a non-menu idea, while Slots A/B remain menu-led.
    const slotExpectedContentTypes = [
      'menu_item',
      activeSlotTypes[1] ?? 'menu_item',
      rawSlotC?.content_type || 'atmosphere',
    ].slice(0, effectiveSlotCount)
    const finalSuggestions = await persistAndAssemble(
      suggestions, effectiveSlotCount, supabase, businessId, today, weatherForecast,
      menuDescriptionMap, slotExpectedContentTypes, todayOpenTime, todayCloseTime, kitchenCloseTime,
      regenerate, plannerRationale, programsFromMenu, clientNow, timeline.slots,
      rotationQueue, currentServicePeriod, weatherInfo  // NEW: metadata parameters
    )

    // ── Query Weekly Plan ideas for today (cross-system awareness) ──────────
    const { data: weeklyPlanIdeas } = await supabase
      .from('daily_suggestions')
      .select('title, rationale, content_type')
      .eq('business_id', businessId)
      .eq('source', 'weekly_plan')
      .eq('date', today)
      .limit(3)

    return new Response(JSON.stringify({ 
      suggestions: finalSuggestions, 
      cached: false, 
      weatherForecast, 
      plannerRationale,
      weeklyPlanIdeas: weeklyPlanIdeas || [], // Pass to UI for context note
      debug: debug ? {
        tier,
        regenerate,
        count,
        effectiveSlotCount,
        slotCount: slotResult.slotCount,
        isSocialDeadZone: slotResult.isSocialDeadZone,
        generatedSuggestionCount: finalSuggestions.length,
        activeSlotTypes,
        slotExpectedContentTypes,
      } : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })


  } catch (error) {
    console.error('get-quick-suggestions error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    
    // Check if error message indicates business is closed or no content available
    const errorMsg = error instanceof Error ? error.message : String(error)
    const isLikelyClosedOrNoContent = 
      errorMsg.includes('No menu items') ||
      errorMsg.includes('No suggestions') ||
      errorMsg.includes('closed')
    
    return new Response(JSON.stringify({ 
      error: isLikelyClosedOrNoContent ? 'NO_CONTENT_AVAILABLE' : 'GENERATION_ERROR',
      message: isLikelyClosedOrNoContent 
        ? 'Vi kan ikke generere forslag lige nu. Kom tilbage i morgen! 😊'
        : 'Failed to generate suggestions',
      details: errorMsg
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

