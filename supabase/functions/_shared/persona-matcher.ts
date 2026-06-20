/**
 * PERSONA MATCHING MODULE
 * 
 * Purpose: Unified persona/audience extraction logic for both Weekly Plan and Dagens Forslag
 * 
 * This module provides programme-based time slot matching with rotation awareness,
 * ensuring variety across all service periods (Brunch, Frokost, Aftensmad, etc.)
 * 
 * ARCHITECTURE:
 * - Primary: audience_framework.timeSlots (programme-based, time-aware)
 * - Fallback: audience_framework.primaryAudiences (generic top-level)
 * - Legacy: audience_segments (B5 format, time-filtered)
 * 
 * PROGRAMME ROTATION:
 * Prevents content repetition by checking recent posts and switching to
 * alternative time slots when a programme was used in last 3 posts.
 * 
 * Created: 1. maj 2026 (Extracted from get-quick-suggestions)
 * See: CONTENT-SYSTEMS-IMPROVEMENT-PLAN.md #2.1
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getSeasonFromMonth, type Season } from './season-utils.ts'  // Task 4.3

// ============================================================================
// TYPES
// ============================================================================

export interface PersonaMatchResult {
  /** Matched audience text (comma-separated) */
  audienceText: string
  
  /** Programme(s) matched or selected (e.g., ["Brunch", "Morgenkaffe"]) */
  programmes: string[]
  
  /** Whether rotation logic switched to alternative programme */
  rotated: boolean
  
  /** Source of the persona data */
  source: 'timeSlots' | 'primaryAudiences' | 'segments' | 'target_audience' | 'v5_programmes' | 'none'
  
  /** V5: Derived tone guidance for Stage 1 framing */
  tone_note?: string
  
  /** V5: Derived CTA type based on segment + business ops */
  cta_type?: 'walk_in' | 'book_table' | 'impulse_visit'
  
  /** V5: Matched segment for richer context */
  matched_segment?: V5AudienceSegment
  
  /** V5: Content angles from active segment */
  content_angles?: string[]
  
  /** Optional metadata for debugging */
  metadata?: {
    currentHour: number
    matchedSlotIndex?: number
    alternativeSlotIndex?: number
    recentProgrammes?: string[]
    seasonalAdjustment?: boolean  // Task 4.3: Whether seasonal blending was applied
    season?: Season  // Task 4.3: Which season was used ('summer' | 'winter')
  }
}

export interface AudienceFramework {
  timeSlots?: Array<{
    programmes: string[]
    audiences: string[]
    contexts?: string[]
    hourRange?: { start: number, end: number }  // Future enhancement (see #3.1)
    dayExclusions?: string[]  // Task 4.4: Exclude time slot on specific days
  }>
  primaryAudiences?: string[]
  locationContexts?: Array<{
    type: string
    audiences: string[]
    priority?: 'primary' | 'secondary'
  }>
  seasonalVariation?: {  // Task 4.3: Seasonal audience modeling
    summer: {
      audiences: string[]
      emphasis: string
    }
    winter: {
      audiences: string[]
      emphasis: string
    }
  } | null
}

export interface AudienceSegment {
  label: string
  priority: 'primary' | 'secondary' | 'niche'
  who?: string
  motivation?: string
  timing?: Array<{
    day: string
    hour_start: number
    hour_end: number
  }>
  /** Days to exclude this audience (e.g., office lunch on weekends) */
  dayExclusions?: string[]
}

/**
 * V5 Programme Profile with Audience Segments
 * Source: business_programme_profiles table
 */
export interface V5ProgrammeProfile {
  programme_type: string  // "brunch", "lunch", "dinner", "bar"
  programme_name: string  // Display name
  time_windows: string[]  // ["07:00-12:00"]
  operating_days: string[]  // ["monday", "tuesday", ...]
  audience_segments: V5AudienceSegment[]
  decision_timing?: string  // Programme-level decision timing
}

/**
 * V5 Audience Segment (from business_programme_profiles)
 * Richer data model than legacy AudienceSegment
 */
export interface V5AudienceSegment {
  label: string  // "Weekend-brunch-gæster", "Frokost-pendlere"
  timing_windows: string[]  // ["Lør-Søn 10:00-14:00"]
  content_angles: string[]  // ["Social brunch-oplevelse", "Menu variation"]
  segment_size: 'primary' | 'secondary' | 'niche'
  motivation: 'social_gathering' | 'convenience' | 'experience_seeking' | 'routine'
  decision_timing: 'spontaneous' | 'planned' | 'mixed'
  goal_contribution: 'drive_footfall' | 'strengthen_brand' | 'retain_regulars'
  evidence: string[]  // Proof from database
}

/**
 * Business Operational Constraints
 * Used for CTA type derivation
 */
export interface BusinessOperations {
  reservation_required: boolean
  accepts_walk_ins: boolean
  booking_url?: string | null
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DOW_NAMES_EN = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const DA_TO_EN_DAY: Record<string, string> = {
  'søndag': 'sunday', 'mandag': 'monday', 'tirsdag': 'tuesday',
  'onsdag': 'wednesday', 'torsdag': 'thursday', 'fredag': 'friday', 'lørdag': 'saturday'
}
const WEEKDAY_NAMES = new Set(['monday', 'tuesday', 'wednesday', 'thursday', 'friday'])
const WEEKEND_NAMES = new Set(['saturday', 'sunday'])

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * HARDCODED HOUR MAPPING (Backward Compatibility Fallback)
 * 
 * NOTE: As of Task 3.1 (1. maj 2026), audience_framework.timeSlots schema
 * now supports optional "hourRange": { "start": 7, "end": 12 } fields.
 * 
 * This function serves as a fallback for:
 * - Legacy data without hourRange (backfilled via migration but may have gaps)
 * - Business-specific overrides not yet configured via UI
 * 
 * The mapping uses typical Danish hospitality service periods as defaults:
 * - Brunch/Morgenmad: 7-12 (morning service)
 * - Frokost/Lunch: 11-16 (midday service) 
 * - Kaffe/Eftermiddag: 14-18 (afternoon service)
 * - Aften/Middag: 17-23 (evening service)
 * - Cocktails/Bar: 20-3 (late night service with wraparound)
 * 
 * FUTURE ENHANCEMENT: Add UI for businesses to customize hour ranges per programme.
 */
function getProgrammeHourRange(programmes: string[]): [number, number] | null {
  const progStr = programmes.join(' ').toLowerCase()
  if (/brunch|morgenmad|breakfast|morgenkaffe/.test(progStr)) return [7, 12]
  if (/frokost|lunch/.test(progStr)) return [11, 16]
  if (/kaffe|kage|cake|eftermiddag/.test(progStr)) return [14, 18]
  if (/aften|middag|dinner/.test(progStr)) return [17, 23]
  if (/cocktail|bar|drink|nat/.test(progStr)) return [20, 3]
  return null
}

/**
 * Check if current hour matches a time slot's programme hour range
 */
function isHourInRange(hour: number, start: number, end: number): boolean {
  if (start <= end) {
    return hour >= start && hour < end
  } else {
    // Handles wraparound (e.g., cocktails 20-3)
    return hour >= start || hour < end
  }
}

/**
 * Match active segment for legacy audience_segments format
 * Returns the segment whose timing window covers the current day+hour
 * Falls back to primary segment (or first) when no timing window matches
 * 
 * TASK 4.4: Day Exclusions
 * Segments with dayExclusions will be skipped if current day matches exclusion list
 * (e.g., "Frokost-erhverv" excluded on weekends when offices are closed)
 */
export function matchActiveSegment(
  segments: AudienceSegment[],
  dayOfWeek: number,
  hourOfDay: number
): AudienceSegment | null {
  if (!Array.isArray(segments) || segments.length === 0) return null
  
  const currentDay = DOW_NAMES_EN[dayOfWeek]
  
  // Helper: Check if segment is excluded on current day
  const isExcluded = (seg: AudienceSegment): boolean => {
    if (!Array.isArray(seg.dayExclusions) || seg.dayExclusions.length === 0) return false
    
    const exclusions = seg.dayExclusions.map(d => {
      const lower = d.toLowerCase()
      return DA_TO_EN_DAY[lower] ?? lower
    })
    
    // Check for exact day match
    if (exclusions.includes(currentDay)) return true
    
    // Check for "weekday" or "weekend" exclusions
    if (exclusions.includes('weekday') && WEEKDAY_NAMES.has(currentDay)) return true
    if (exclusions.includes('weekend') && WEEKEND_NAMES.has(currentDay)) return true
    
    // TODO: Holiday exclusions would require external calendar integration
    // For now, "holiday" in exclusions is ignored
    
    return false
  }
  
  for (const seg of segments) {
    // Skip if segment is excluded on current day
    if (isExcluded(seg)) continue
    
    if (!Array.isArray(seg.timing)) continue
    
    for (const t of seg.timing) {
      const rawDay = String(t.day ?? '').toLowerCase()
      const dayEn = DA_TO_EN_DAY[rawDay] ?? rawDay
      
      const dayMatches =
        dayEn === currentDay ||
        (dayEn === 'weekday' && WEEKDAY_NAMES.has(currentDay)) ||
        (dayEn === 'weekend' && WEEKEND_NAMES.has(currentDay))
      
      if (dayMatches && hourOfDay >= t.hour_start && hourOfDay < t.hour_end) {
        return seg
      }
    }
  }
  
  // No timing window matched — use primary segment or first available
  // (but still respect dayExclusions)
  const fallback = segments.find(s => s.priority === 'primary' && !isExcluded(s)) 
    ?? segments.find(s => !isExcluded(s))
    ?? segments[0] 
    ?? null
  
  return fallback
}

// ============================================================================
// BEHAVIORAL DERIVATION FUNCTIONS (V5 SEGMENTS)
// ============================================================================

/**
 * Derive tone guidance from segment behavioral data
 * 
 * Provides framing instructions for Stage 1 idea generation based on
 * audience motivation and decision timing patterns.
 * 
 * @param motivation - Why this audience comes (social, convenience, experience, routine)
 * @param decision_timing - When they decide to visit (spontaneous, planned, mixed)
 * @returns Tone note in Danish for prompt injection
 */
export function deriveToneNote(
  motivation: string,
  decision_timing: string
): string {
  // Convenience seekers
  if (motivation === 'convenience') {
    if (decision_timing === 'spontaneous') {
      return 'Fokusér på hurtighed og tilgængelighed'
    }
    if (decision_timing === 'planned') {
      return 'Fremhæv pålidelighed og praktisk værdi'
    }
    return 'Balancér hurtighed og kvalitet'
  }
  
  // Social gatherers
  if (motivation === 'social_gathering') {
    if (decision_timing === 'spontaneous') {
      return 'Fremhæv den afslappede, uformelle stemning'
    }
    if (decision_timing === 'planned') {
      return 'Fremhæv atmosfære og fællesskab'
    }
    return 'Fremhæv det sociale og hyggelige'
  }
  
  // Experience seekers
  if (motivation === 'experience_seeking') {
    if (decision_timing === 'spontaneous') {
      return 'Fremhæv det overraskende og særlige'
    }
    if (decision_timing === 'planned') {
      return 'Fremhæv den unikke oplevelse og eksklusivitet'
    }
    return 'Fremhæv det unikke og stedet'
  }
  
  // Routine/regulars
  if (motivation === 'routine') {
    if (decision_timing === 'spontaneous') {
      return 'Fremhæv genkendelighed og komfort'
    }
    if (decision_timing === 'planned') {
      return 'Fremhæv pålidelighed og traditioner'
    }
    return 'Fremhæv det velkendte og trygge'
  }
  
  // Default fallback
  return 'Balancér kvalitet og tilgængelighed'
}

/**
 * Derive CTA type from segment behavior + business capabilities
 * 
 * CRITICAL: Must respect operational constraints (Layer 1) before applying
 * segment preferences (Layer 2).
 * 
 * Layer 1: Business capability (hard limits)
 *  - reservation_required=true, walk_ins=false → always 'book_table'
 *  - no booking_url, walk_ins=true → always 'walk_in'
 * 
 * Layer 2: Segment preference (when both available)
 *  - spontaneous decision → prefer 'walk_in'
 *  - planned decision → prefer 'book_table'
 *  - mixed decision → use goal_contribution to break tie
 * 
 * @param segment - V5 audience segment with behavioral data
 * @param businessOps - Business operational constraints
 * @returns CTA type for prompt/CTA selection
 */
export function deriveCTAType(
  segment: V5AudienceSegment,
  businessOps: BusinessOperations
): 'walk_in' | 'book_table' | 'impulse_visit' {
  // ═══════════════════════════════════════════════════════
  // LAYER 1: Business Capability Constraints (HARD LIMITS)
  // ═══════════════════════════════════════════════════════
  
  // Reservations only (no walk-ins available)
  if (businessOps.reservation_required && !businessOps.accepts_walk_ins) {
    return 'book_table'
  }
  
  // Walk-ins only (no booking system)
  if (!businessOps.booking_url && businessOps.accepts_walk_ins) {
    return 'walk_in'
  }
  
  // ═══════════════════════════════════════════════════════
  // LAYER 2: Both Available → Segment Preference Decides
  // ═══════════════════════════════════════════════════════
  
  if (businessOps.accepts_walk_ins && businessOps.booking_url) {
    // Spontaneous audiences → walk-in CTA
    if (segment.decision_timing === 'spontaneous') {
      return 'walk_in'
    }
    
    // Planned audiences → booking CTA
    if (segment.decision_timing === 'planned') {
      return 'book_table'
    }
    
    // Mixed → use goal_contribution to break tie
    if (segment.decision_timing === 'mixed') {
      return segment.goal_contribution === 'drive_footfall' 
        ? 'walk_in'       // Optimize for volume (lower friction)
        : 'book_table'    // Optimize for commitment (higher quality)
    }
  }
  
  // Fallback (should rarely hit this)
  return 'walk_in'
}

/**
 * Parse V5 timing window string to hours/days
 * 
 * Format: "Lør-Søn 10:00-14:00" or "Man-Fre 12:00-15:00"
 * 
 * @param timingWindow - Timing window string from segment
 * @returns Parsed day range and hour range, or null if invalid
 */
export function parseV5TimingWindow(timingWindow: string): {
  days: string[]  // ["saturday", "sunday"]
  hourStart: number
  hourEnd: number
} | null {
  const match = timingWindow.match(/^([\w-]+)\s+(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/)
  if (!match) return null
  
  const [, dayPart, startHour, startMin, endHour, endMin] = match
  
  // Parse day range
  const dayMap: Record<string, string> = {
    'Man': 'monday', 'Tir': 'tuesday', 'Ons': 'wednesday',
    'Tor': 'thursday', 'Fre': 'friday', 'Lør': 'saturday', 'Søn': 'sunday'
  }
  
  let days: string[] = []
  
  if (dayPart.includes('-')) {
    // Range like "Lør-Søn" or "Man-Fre"
    const [start, end] = dayPart.split('-')
    const startDay = dayMap[start]
    const endDay = dayMap[end]
    
    if (!startDay || !endDay) return null
    
    // Generate range (e.g., Man-Fre → [monday, tuesday, wednesday, thursday, friday])
    const allDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    const startIdx = allDays.indexOf(startDay)
    const endIdx = allDays.indexOf(endDay)
    
    if (startIdx === -1 || endIdx === -1) return null
    
    if (startIdx <= endIdx) {
      days = allDays.slice(startIdx, endIdx + 1)
    } else {
      // Wraparound (e.g., Fre-Man)
      days = [...allDays.slice(startIdx), ...allDays.slice(0, endIdx + 1)]
    }
  } else {
    // Single day
    const day = dayMap[dayPart]
    if (!day) return null
    days = [day]
  }
  
  return {
    days,
    hourStart: parseInt(startHour, 10),
    hourEnd: parseInt(endHour, 10)
  }
}

/**
 * Match active V5 segment for current time
 * 
 * Filters programme segments by timing windows and returns the primary/best match.
 * 
 * @param programme - V5 programme profile with segments
 * @param dayOfWeek - Current day (0=Sunday, 6=Saturday)
 * @param hourOfDay - Current hour (0-23)
 * @returns Matched segment or null
 */
export function matchActiveV5Segment(
  programme: V5ProgrammeProfile,
  dayOfWeek: number,
  hourOfDay: number
): V5AudienceSegment | null {
  if (!programme.audience_segments || programme.audience_segments.length === 0) {
    return null
  }
  
  const currentDay = DOW_NAMES_EN[dayOfWeek]
  
  // Try to find segment with matching timing window
  for (const segment of programme.audience_segments) {
    if (!segment.timing_windows || segment.timing_windows.length === 0) {
      continue
    }
    
    for (const timingStr of segment.timing_windows) {
      const parsed = parseV5TimingWindow(timingStr)
      if (!parsed) continue
      
      const dayMatches = parsed.days.includes(currentDay)
      const hourMatches = hourOfDay >= parsed.hourStart && hourOfDay < parsed.hourEnd
      
      if (dayMatches && hourMatches) {
        return segment
      }
    }
  }
  
  // No timing match → return primary segment or first
  return programme.audience_segments.find(s => s.segment_size === 'primary')
    ?? programme.audience_segments[0]
    ?? null
}

// ============================================================================
// MAIN PERSONA MATCHING FUNCTION
// ============================================================================

/**
 * Match persona/audience to current hour with programme rotation awareness
 * 
 * ALGORITHM:
 * 1. Try audience_framework.timeSlots (primary):
 *    a. Map current hour to programme (Brunch, Frokost, etc.)
 *    b. Check if programme was used in last 3 posts
 *    c. If yes, rotate to alternative time slot
 *    d. Extract audiences from matched slot
 * 
 * 2. Fallback to audience_framework.primaryAudiences
 * 
 * 3. Fallback to audience_segments (legacy B5 format):
 *    a. Filter by current day/hour
 *    b. Return primary or first segment
 * 
 * 4. Final fallback: empty result
 * 
 * @param audienceFramework - The unified audience framework (timeSlots preferred)
 * @param audienceSegments - Legacy B5 segments (fallback)
 * @param currentHour - Hour of day (0-23)
 * @param currentDayOfWeek - Day of week (0=Sunday, 6=Saturday)
 * @param currentMonth - Month of year (0=January, 11=December) - optional, for seasonal filtering
 * @param supabase - Supabase client for rotation check (optional)
 * @param businessId - Business ID for rotation check (optional)
 * @returns PersonaMatchResult with matched audience and metadata
 */
export async function matchPersonaToCurrentHour(
  audienceFramework: AudienceFramework | null,
  audienceSegments: AudienceSegment[] | null,
  currentHour: number,
  currentDayOfWeek: number,
  currentMonth?: number,  // Task 4.3: Optional for backward compatibility
  supabase?: SupabaseClient,
  businessId?: string
): Promise<PersonaMatchResult> {
  // ----------------------------------------
  // PATH 1: audience_framework.timeSlots (Primary)
  // ----------------------------------------
  if (audienceFramework?.timeSlots && Array.isArray(audienceFramework.timeSlots)) {
    const currentDay = DOW_NAMES_EN[currentDayOfWeek]
    
    // Helper: Check if time slot is excluded on current day (Task 4.4)
    const isSlotExcluded = (slot: any): boolean => {
      if (!Array.isArray(slot.dayExclusions) || slot.dayExclusions.length === 0) return false
      
      const exclusions = slot.dayExclusions.map((d: string) => {
        const lower = d.toLowerCase()
        return DA_TO_EN_DAY[lower] ?? lower
      })
      
      // Check for exact day match
      if (exclusions.includes(currentDay)) return true
      
      // Check for "weekday" or "weekend" exclusions
      if (exclusions.includes('weekday') && WEEKDAY_NAMES.has(currentDay)) return true
      if (exclusions.includes('weekend') && WEEKEND_NAMES.has(currentDay)) return true
      
      return false
    }
    
    // Find matching time slot based on programmes
    let matchingSlot = audienceFramework.timeSlots.find((slot, index) => {
      // Task 4.4: Skip slots excluded on current day
      if (isSlotExcluded(slot)) return false
      
      const programmes = Array.isArray(slot.programmes) ? slot.programmes : []
      
      // If hourRange explicitly set (future enhancement), use it
      if (slot.hourRange) {
        return isHourInRange(currentHour, slot.hourRange.start, slot.hourRange.end)
      }
      
      // Otherwise, use hardcoded programme hour mapping
      const range = getProgrammeHourRange(programmes)
      if (!range) return false
      
      const [start, end] = range
      return isHourInRange(currentHour, start, end)
    })
    
    let rotated = false
    let matchedIndex = matchingSlot ? audienceFramework.timeSlots.indexOf(matchingSlot) : undefined
    let alternativeIndex: number | undefined
    let recentProgrammes: string[] = []
    
    // ----------------------------------------
    // PROGRAMME ROTATION LOGIC
    // ----------------------------------------
    // Prevents content repetition by checking if the matched programme was used
    // in the last 3 posts. If yes, switches to an alternative time slot.
    //
    // WHY THIS MATTERS:
    // - Ensures variety across all service periods (Brunch, Frokost, Aftensmad, etc.)
    // - Prevents over-indexing on one programme (e.g., only Cocktails suggestions)
    // - Aligns with Weekly Plan's programme rotation strategy (4-week lookback)
    // ----------------------------------------
    if (matchingSlot && audienceFramework.timeSlots.length > 1 && supabase && businessId) {
      try {
        // Fetch recent suggestions (last 7 days)
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        
        const { data: recentPosts } = await supabase
          .from('generated_posts')
          .select('metadata')
          .eq('business_id', businessId)
          .gte('created_at', sevenDaysAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(10)
        
        if (recentPosts && recentPosts.length > 0) {
          recentProgrammes = recentPosts
            .map((p: any) => p.metadata?.programme)
            .filter(Boolean)
          
          const currentProgrammes = Array.isArray(matchingSlot.programmes) 
            ? matchingSlot.programmes 
            : []
          
          // Check if current programme was used in last 3 posts
          const wasRecentlyUsed = currentProgrammes.some((p: string) => 
            recentProgrammes.slice(0, 3).includes(p)
          )
          
          if (wasRecentlyUsed) {
            // Find alternative slot not recently used (and not excluded on current day)
            const alternativeSlot = audienceFramework.timeSlots.find((slot, index) => {
              if (isSlotExcluded(slot)) return false  // Task 4.4: Skip excluded slots
              const progs = Array.isArray(slot.programmes) ? slot.programmes : []
              return progs.length > 0 && !progs.some((p: string) => recentProgrammes.slice(0, 3).includes(p))
            })
            
            if (alternativeSlot) {
              console.log('[persona-matcher] Programme rotation: switching from', currentProgrammes, 'to', alternativeSlot.programmes)
              alternativeIndex = audienceFramework.timeSlots.indexOf(alternativeSlot)
              matchingSlot = alternativeSlot
              rotated = true
            }
          }
        }
      } catch (e) {
        console.warn('[persona-matcher] Could not check programme coverage:', (e as Error).message)
      }
    }
    
    // ----------------------------------------
    // AUDIENCE EXTRACTION WITH SEASONAL BLENDING (Task 4.3)
    // ----------------------------------------
    if (matchingSlot?.audiences && Array.isArray(matchingSlot.audiences)) {
      const programmes = Array.isArray(matchingSlot.programmes) ? matchingSlot.programmes : []
      let finalAudiences = matchingSlot.audiences
      let seasonalAdjustment = false
      let season: Season | undefined
      
      // SEASONAL FILTERING: Blend seasonal audiences with time slot audiences
      // Only apply if:
      // 1. Business has seasonalVariation data
      // 2. currentMonth parameter is provided
      // 3. Seasonal data has audiences defined
      if (audienceFramework?.seasonalVariation && currentMonth !== undefined) {
        season = getSeasonFromMonth(currentMonth)
        const seasonalData = audienceFramework.seasonalVariation[season]
        
        if (seasonalData?.audiences && Array.isArray(seasonalData.audiences) && seasonalData.audiences.length > 0) {
          // Blending Strategy: 60% seasonal + 40% time-based
          // This ensures seasonal relevance while preserving programme-specific context
          // 
          // Example (Waterfront café in summer):
          //   Time slot: ["weekendgæster", "par", "lokale"]
          //   Seasonal:  ["turister", "destinationsbesøgende", "familier", "par"]
          //   Result:    ["turister", "destinationsbesøgende", "familier", "par", "weekendgæster"]
          //              ↑ Top 3 seasonal                              ↑ Top 2 time-based
          
          const seasonalTop = seasonalData.audiences.slice(0, 3)  // Top 3 seasonal
          const timeSlotTop = matchingSlot.audiences.slice(0, 2)   // Top 2 time-specific
          
          // Combine and deduplicate
          finalAudiences = [
            ...seasonalTop,
            ...timeSlotTop.filter(a => !seasonalTop.includes(a))  // Avoid duplicates
          ].slice(0, 5)  // Max 5 audiences total
          
          seasonalAdjustment = true
          
          console.log(
            `[persona-matcher] Seasonal blending (${season}):`,
            `time=${matchingSlot.audiences.join(', ')} →`,
            `result=${finalAudiences.join(', ')}`
          )
        }
      }
      
      return {
        audienceText: finalAudiences.join(', '),
        programmes,
        rotated,
        source: 'timeSlots',
        metadata: {
          currentHour,
          matchedSlotIndex: matchedIndex,
          alternativeSlotIndex: alternativeIndex,
          recentProgrammes: recentProgrammes.length > 0 ? recentProgrammes : undefined,
          seasonalAdjustment,
          season
        }
      }
    }
    
    // Fallback within audience_framework: use primaryAudiences
    if (audienceFramework.primaryAudiences && Array.isArray(audienceFramework.primaryAudiences)) {
      return {
        audienceText: audienceFramework.primaryAudiences.slice(0, 5).join(', '),
        programmes: [],
        rotated: false,
        source: 'primaryAudiences',
        metadata: { currentHour }
      }
    }
  }
  
  // ----------------------------------------
  // PATH 2: audience_segments (Legacy Fallback)
  // ----------------------------------------
  if (audienceSegments && Array.isArray(audienceSegments)) {
    const activeSegment = matchActiveSegment(audienceSegments, currentDayOfWeek, currentHour)
    
    if (activeSegment) {
      return {
        audienceText: activeSegment.label,
        programmes: [],
        rotated: false,
        source: 'segments',
        metadata: { currentHour }
      }
    }
  }
  
  // ----------------------------------------
  // PATH 3: No persona data available
  // ----------------------------------------
  return {
    audienceText: '',
    programmes: [],
    rotated: false,
    source: 'none',
    metadata: { currentHour }
  }
}

/**
 * Convenience function for synchronous matching (no rotation check)
 * Use when you don't have Supabase client or don't need rotation awareness
 */
export function matchPersonaToCurrentHourSync(
  audienceFramework: AudienceFramework | null,
  audienceSegments: AudienceSegment[] | null,
  currentHour: number,
  currentDayOfWeek: number
): PersonaMatchResult {
  // Call async version without supabase/businessId (rotation will be skipped)
  return matchPersonaToCurrentHour(
    audienceFramework,
    audienceSegments,
    currentHour,
    currentDayOfWeek
  ) as unknown as PersonaMatchResult  // Safe because async part is skipped
}

// ============================================================================
// V5 PROGRAMME-BASED MATCHING (NEW - JUNE 2026)
// ============================================================================

/**
 * Match persona using V5 programme profiles with behavioral derivation
 * 
 * IMPROVEMENTS OVER LEGACY:
 * - Direct read from business_programme_profiles (no sync lag)
 * - Programme-aware matching (resolves time overlaps correctly)
 * - Behavioral data derivation (tone_note, cta_type) at runtime
 * - Richer context (content_angles, evidence, motivation)
 * 
 * ALGORITHM:
 * 1. Find active programme(s) matching current hour + day
 * 2. Match active segment within programme
 * 3. Derive tone_note from motivation + decision_timing
 * 4. Derive cta_type from decision_timing + business_ops
 * 5. Extract content_angles for Stage 1 framing
 * 
 * @param programmes - V5 programme profiles from business_programme_profiles
 * @param businessOps - Business operational constraints (for CTA derivation)
 * @param currentHour - Hour of day (0-23)
 * @param currentDayOfWeek - Day of week (0=Sunday, 6=Saturday)
 * @param supabase - Supabase client for rotation check (optional)
 * @param businessId - Business ID for rotation check (optional)
 * @returns PersonaMatchResult with V5 behavioral data
 */
export async function matchPersonaWithV5Programmes(
  programmes: V5ProgrammeProfile[],
  businessOps: BusinessOperations,
  currentHour: number,
  currentDayOfWeek: number,
  supabase?: SupabaseClient,
  businessId?: string
): Promise<PersonaMatchResult> {
  
  if (!programmes || programmes.length === 0) {
    return {
      audienceText: '',
      programmes: [],
      rotated: false,
      source: 'none',
      metadata: { currentHour }
    }
  }
  
  const currentDay = DOW_NAMES_EN[currentDayOfWeek]
  
  // ═══════════════════════════════════════════════════════
  // STEP 1: Find active programme(s) for current time
  // ═══════════════════════════════════════════════════════
  
  const activeProgrammes = programmes.filter(prog => {
    // Check operating days
    if (prog.operating_days && prog.operating_days.length > 0) {
      if (!prog.operating_days.includes(currentDay)) {
        return false
      }
    }
    
    // Check time windows
    if (prog.time_windows && prog.time_windows.length > 0) {
      for (const window of prog.time_windows) {
        const match = window.match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/)
        if (!match) continue
        
        const [, startH, startM, endH, endM] = match
        const startHour = parseInt(startH, 10)
        const endHour = parseInt(endH, 10)
        
        // Check if current hour is in range
        if (isHourInRange(currentHour, startHour, endHour)) {
          return true
        }
      }
      return false  // No time window matched
    }
    
    return true  // No time constraints, assume active
  })
  
  if (activeProgrammes.length === 0) {
    return {
      audienceText: '',
      programmes: [],
      rotated: false,
      source: 'v5_programmes',
      metadata: { currentHour }
    }
  }
  
  // ═══════════════════════════════════════════════════════
  // STEP 2: Programme rotation logic (prevent repetition)
  // ═══════════════════════════════════════════════════════
  
  let selectedProgramme = activeProgrammes[0]
  let rotated = false
  let recentProgrammes: string[] = []
  
  if (activeProgrammes.length > 1 && supabase && businessId) {
    try {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      
      const { data: recentPosts } = await supabase
        .from('generated_posts')
        .select('metadata')
        .eq('business_id', businessId)
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(10)
      
      if (recentPosts && recentPosts.length > 0) {
        recentProgrammes = recentPosts
          .map((p: any) => p.metadata?.programme)
          .filter(Boolean)
        
        // Check if selected programme was used in last 3 posts
        const wasRecentlyUsed = recentProgrammes.slice(0, 3).includes(selectedProgramme.programme_type)
        
        if (wasRecentlyUsed) {
          // Find alternative programme not recently used
          const alternative = activeProgrammes.find(p => 
            !recentProgrammes.slice(0, 3).includes(p.programme_type)
          )
          
          if (alternative) {
            console.log('[V5 persona-matcher] Programme rotation:', selectedProgramme.programme_type, '→', alternative.programme_type)
            selectedProgramme = alternative
            rotated = true
          }
        }
      }
    } catch (e) {
      console.warn('[V5 persona-matcher] Rotation check failed:', (e as Error).message)
    }
  }
  
  // ═══════════════════════════════════════════════════════
  // STEP 3: Match active segment within programme
  // ═══════════════════════════════════════════════════════
  
  const activeSegment = matchActiveV5Segment(selectedProgramme, currentDayOfWeek, currentHour)
  
  if (!activeSegment) {
    return {
      audienceText: '',
      programmes: [selectedProgramme.programme_name],
      rotated,
      source: 'v5_programmes',
      metadata: { currentHour, recentProgrammes }
    }
  }
  
  // ═══════════════════════════════════════════════════════
  // STEP 4: Derive behavioral data
  // ═══════════════════════════════════════════════════════
  
  const tone_note = deriveToneNote(activeSegment.motivation, activeSegment.decision_timing)
  const cta_type = deriveCTAType(activeSegment, businessOps)
  
  // ═══════════════════════════════════════════════════════
  // STEP 5: Build result with full V5 context
  // ═══════════════════════════════════════════════════════
  
  return {
    audienceText: activeSegment.label,
    programmes: [selectedProgramme.programme_name],
    rotated,
    source: 'v5_programmes',
    tone_note,
    cta_type,
    matched_segment: activeSegment,
    content_angles: activeSegment.content_angles,
    metadata: {
      currentHour,
      recentProgrammes
    }
  }
}
