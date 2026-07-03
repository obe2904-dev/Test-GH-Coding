/**
 * Dynamic Suggestion Count & Timing Calculator
 * 
 * Implements the specification from _SPEC_DYNAMIC_SUGGESTION_COUNT_AND_BEHAVIORAL_LOGIC.md
 * 
 * Core Logic:
 * - Generates 1-3 suggestions based on available time window
 * - First suggestion for immediate posting (30-60 min)
 * - Content type determined by operational status (OFFERING vs ATMOSPHERE)
 * - Behavioral context integrated for relevance
 * 
 * Version: 1.0
 * Date: 2026-06-22
 */

// ── Constants ────────────────────────────────────────────────────────────────

export const TIMING_RULES = {
  MIN_SPACING: 120,           // 120 min (2 hours) minimum between suggestions
  IMMEDIATE_WINDOW: [30, 60], // 30-60 min from generation for Idea 1
  CLOSING_BUFFER: 180,        // 180 min before closing (no offering posts)
  FINAL_POST_BUFFER: 60,      // 60 min before closing (last atmosphere post)
  LEAD_TIME: [60, 120],       // 60-120 min before programme peak (decision window)
  MIN_PROGRAMME_DURATION: 180, // 180 min minimum programme length to be considered strategic
} as const

export type ContentType = 'OFFERING' | 'ATMOSPHERE'
export type AtmosphereAngle = 
  | 'informational'           // Closed today info
  | 'anticipatory'            // Opening soon
  | 'evening_ambiance'        // Closing mood
  | 'next_day_preview'        // Tomorrow teaser
  | 'location_ambiance'       // USP highlight
  | 'behind_scenes'           // Kitchen prep, staff
  | 'cultural'                // Seasonal, local
  | 'social_proof'            // Busy tables, happy guests
  | 'retention'               // Thank you messages

// ── Types ────────────────────────────────────────────────────────────────────

export interface SuggestionIdea {
  ideaNumber: 1 | 2 | 3
  postingTime: string         // HH:MM format
  postingTimeMins: number     // Minutes since midnight
  contentType: ContentType
  atmosphereAngle?: AtmosphereAngle
  rationale: string
  targetAudienceSegment?: string
  targetProgramme?: string
  eligibleProgrammes: string[]
  behavioralContext: {
    timeOfDay: 'early_morning' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'night'
    decisionPattern: string
    audienceBehavior: string
  }
}

export interface DynamicSuggestionResult {
  suggestionCount: number
  ideas: SuggestionIdea[]
  reasoning: string
  metadata: {
    generationTime: string
    openingTime: string | null
    closingTime: string
    effectiveClosing: string
    availableHours: number
    isClosedToday: boolean
    isBeforeOpening: boolean
    isCurrentlyOpen: boolean
    isAfterClosing: boolean
  }
}

export interface CalculationContext {
  now: Date
  weekday: string
  openingTime: string | null
  closingTime: string | null
  programmes: Array<{
    name: string
    type: string
    time_windows: string[]
    operating_days: string[]
  }>
  kitchenCloseTime: string | null
  isClosedToday: boolean
}

// ── Helper Functions ─────────────────────────────────────────────────────────

function toMins(hhmm: string): number {
  const [h, m = 0] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function fromMins(mins: number): string {
  const wrapped = ((mins % 1440) + 1440) % 1440
  return `${Math.floor(wrapped / 60).toString().padStart(2, '0')}:${(wrapped % 60).toString().padStart(2, '0')}`
}

function roundToHalfHour(mins: number): number {
  return Math.round(mins / 30) * 30
}

function getTimeOfDay(mins: number): SuggestionIdea['behavioralContext']['timeOfDay'] {
  const hour = Math.floor(mins / 60) % 24
  if (hour >= 5 && hour < 9) return 'early_morning'
  if (hour >= 9 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 15) return 'midday'
  if (hour >= 15 && hour < 18) return 'afternoon'
  if (hour >= 18 && hour < 22) return 'evening'
  return 'night'
}

function getEffectiveClosingTime(
  closingTime: string | null,
  programmes: CalculationContext['programmes'],
  kitchenCloseTime: string | null
): { time: string; source: string } {
  // Priority 1: Explicit kitchen close time
  if (kitchenCloseTime) {
    return { time: kitchenCloseTime, source: 'kitchen_close_time' }
  }

  // Priority 2: Last food programme
  const foodProgrammes = programmes.filter(p => {
    const type = p.type.toLowerCase()
    return !['bar', 'drinks', 'cocktails'].includes(type)
  })

  if (foodProgrammes.length > 0) {
    const lastEnd = foodProgrammes.reduce((latest, p) => {
      const endTime = p.time_windows[0]?.split('-')[1]
      return endTime && toMins(endTime) > toMins(latest) ? endTime : latest
    }, '00:00')
    return { time: lastEnd, source: 'last_food_programme' }
  }

  // Priority 3: Last programme (any type)
  if (programmes.length > 0) {
    const lastEnd = programmes.reduce((latest, p) => {
      const endTime = p.time_windows[0]?.split('-')[1]
      return endTime && toMins(endTime) > toMins(latest) ? endTime : latest
    }, '00:00')
    return { time: lastEnd, source: 'last_programme' }
  }

  // Fallback: Business closing time
  return { time: closingTime || '23:00', source: 'business_closing_time' }
}

interface StrategicProgrammePeak {
  programmeName: string
  programmeType: string
  startMins: number
  endMins: number
  peakMins: number  // Middle of the programme window
  duration: number
}

function findStrategicProgrammePeaks(
  programmes: CalculationContext['programmes'],
  weekday: string,
  earliestPostingMins: number,
  effectiveClosingMins: number
): StrategicProgrammePeak[] {
  const peaks: StrategicProgrammePeak[] = []
  
  // We can target any peak that allows us to post with minimum lead time
  // earliestPeakMins = earliestPostingMins + LEAD_TIME[0] (60 min)
  const earliestPeakMins = earliestPostingMins + TIMING_RULES.LEAD_TIME[0]
  const latestPeakMins = effectiveClosingMins - TIMING_RULES.LEAD_TIME[0]
  
  for (const programme of programmes) {
    // Skip if not operating today
    if (!programme.operating_days.includes(weekday.toLowerCase())) continue
    
    // Parse time window
    const [start, end] = programme.time_windows[0]?.split('-') || []
    if (!start || !end) continue
    
    const startMins = toMins(start)
    const endMins = toMins(end)
    const duration = endMins - startMins
    
    // Skip short programmes (< 3 hours)
    if (duration < TIMING_RULES.MIN_PROGRAMME_DURATION) continue
    
    // Calculate peak time (middle of programme window)
    const peakMins = Math.floor((startMins + endMins) / 2)
    
    // Only include if peak is in the valid window
    if (peakMins >= earliestPeakMins && peakMins <= latestPeakMins) {
      peaks.push({
        programmeName: programme.name,
        programmeType: programme.type,
        startMins,
        endMins,
        peakMins,
        duration
      })
    }
  }
  
  // Sort by peak time
  return peaks.sort((a, b) => a.peakMins - b.peakMins)
}

function calculateStrategicPostingTime(
  peakMins: number,
  earliestPostMins: number
): number {
  // Post 60-120 min before peak to capture decision-making window
  const idealPostMins = peakMins - TIMING_RULES.LEAD_TIME[1] // 120 min before
  
  // If ideal time is too early, use minimum lead time (60 min before)
  if (idealPostMins < earliestPostMins) {
    return Math.min(peakMins - TIMING_RULES.LEAD_TIME[0], earliestPostMins + 60)
  }
  
  return roundToHalfHour(idealPostMins)
}

// ── Main Calculation Function ────────────────────────────────────────────────

export function calculateDynamicSuggestions(
  context: CalculationContext
): DynamicSuggestionResult {
  
  const nowMins = context.now.getHours() * 60 + context.now.getMinutes()
  const nowTime = fromMins(nowMins)
  
  // Calculate effective closing time
  const effectiveClosingInfo = getEffectiveClosingTime(
    context.closingTime,
    context.programmes,
    context.kitchenCloseTime
  )
  const effectiveClosingMins = toMins(effectiveClosingInfo.time)
  const minutesUntilClose = effectiveClosingMins - nowMins
  
  // Determine operational status
  // FIX (June 24, 2026): Use effectiveClosingMins instead of closingMins
  // Bug: closingTime="00:00" (midnight) resulted in closingMins=0,
  // causing isAfterClosing=true at 13:31 when kitchen closes at 21:30
  const openingMins = context.openingTime ? toMins(context.openingTime) : 0
  const closingMins = context.closingTime ? toMins(context.closingTime) : 1440
  
  const isBeforeOpening = context.openingTime && nowMins < openingMins
  // Use effectiveClosingMins (kitchen close or venue close) for accurate status
  const isCurrentlyOpen = !isBeforeOpening && nowMins < effectiveClosingMins
  const isAfterClosing = nowMins >= effectiveClosingMins
  const availableHours = minutesUntilClose / 60
  
  console.log(`🎯 Dynamic Suggestion Calculation:`)
  console.log(`   Current time: ${nowTime}`)
  console.log(`   Weekday: ${context.weekday}`)
  console.log(`   Opening: ${context.openingTime || 'N/A'}`)
  console.log(`   Closing: ${context.closingTime || 'N/A'}`)
  console.log(`   Effective closing: ${effectiveClosingInfo.time} (${effectiveClosingInfo.source})`)
  console.log(`   Status: ${context.isClosedToday ? 'CLOSED TODAY' : isBeforeOpening ? 'BEFORE OPENING' : isCurrentlyOpen ? 'OPEN' : 'AFTER CLOSING'}`)
  console.log(`   Available hours: ${availableHours.toFixed(1)}h`)
  
  const ideas: SuggestionIdea[] = []
  let reasoning = ''
  
  // ════════════════════════════════════════════════════════════════════════
  // IDEA 1 Logic (Always generated)
  // ════════════════════════════════════════════════════════════════════════
  
  const idea1PostingMins = roundToHalfHour(nowMins + TIMING_RULES.IMMEDIATE_WINDOW[0])
  
  // Q1: Is business CLOSED today?
  if (context.isClosedToday) {
    ideas.push({
      ideaNumber: 1,
      postingTime: fromMins(idea1PostingMins),
      postingTimeMins: idea1PostingMins,
      contentType: 'ATMOSPHERE',
      atmosphereAngle: 'informational',
      rationale: 'Business closed today - informational post about next opening',
      eligibleProgrammes: [],
      behavioralContext: {
        timeOfDay: getTimeOfDay(idea1PostingMins),
        decisionPattern: 'N/A (closed)',
        audienceBehavior: 'Looking for opening information'
      }
    })
    
    reasoning = 'Closed today - generated 1 ATMOSPHERE idea only'
    
    return {
      suggestionCount: 1,
      ideas,
      reasoning,
      metadata: {
        generationTime: nowTime,
        openingTime: context.openingTime,
        closingTime: context.closingTime || '23:00',
        effectiveClosing: effectiveClosingInfo.time,
        availableHours: 0,
        isClosedToday: true,
        isBeforeOpening: false,
        isCurrentlyOpen: false,
        isAfterClosing: false
      }
    }
  }
  
  // Q2: What's the current time status?
  if (isBeforeOpening) {
    // Q2.1: Before opening - OFFERING (anticipatory)
    ideas.push({
      ideaNumber: 1,
      postingTime: fromMins(idea1PostingMins),
      postingTimeMins: idea1PostingMins,
      contentType: 'OFFERING',
      rationale: `Before opening (opens ${context.openingTime}) - anticipatory offering for later consumption`,
      eligibleProgrammes: context.programmes.map(p => p.name.toLowerCase()),
      behavioralContext: {
        timeOfDay: getTimeOfDay(idea1PostingMins),
        decisionPattern: 'Planning ahead for later',
        audienceBehavior: 'Considering options for when business opens'
      }
    })
  } else if (isAfterClosing) {
    // Q2.2: After closing - ATMOSPHERE only
    ideas.push({
      ideaNumber: 1,
      postingTime: fromMins(idea1PostingMins),
      postingTimeMins: idea1PostingMins,
      contentType: 'ATMOSPHERE',
      atmosphereAngle: 'next_day_preview',
      rationale: 'After closing - next-day preview or appreciation post',
      eligibleProgrammes: [],
      behavioralContext: {
        timeOfDay: getTimeOfDay(idea1PostingMins),
        decisionPattern: 'Planning for tomorrow',
        audienceBehavior: 'Looking ahead to next visit'
      }
    })
    
    reasoning = 'After closing - generated 1 ATMOSPHERE idea only'
    
    return {
      suggestionCount: 1,
      ideas,
      reasoning,
      metadata: {
        generationTime: nowTime,
        openingTime: context.openingTime,
        closingTime: context.closingTime || '23:00',
        effectiveClosing: effectiveClosingInfo.time,
        availableHours: 0,
        isClosedToday: false,
        isBeforeOpening: false,
        isCurrentlyOpen: false,
        isAfterClosing: true
      }
    }
  } else {
    // Q3: Currently open - check if closing soon
    if (minutesUntilClose < TIMING_RULES.CLOSING_BUFFER) {
      // Closing soon (< 3 hours) - ATMOSPHERE
      ideas.push({
        ideaNumber: 1,
        postingTime: fromMins(idea1PostingMins),
        postingTimeMins: idea1PostingMins,
        contentType: 'ATMOSPHERE',
        atmosphereAngle: 'evening_ambiance',
        rationale: `Closing in ${(minutesUntilClose / 60).toFixed(1)}h - too late for offering conversion, atmosphere/mood content`,
        eligibleProgrammes: [],
        behavioralContext: {
          timeOfDay: getTimeOfDay(idea1PostingMins),
          decisionPattern: 'Limited time decision',
          audienceBehavior: 'Last-minute considerations'
        }
      })
    } else {
      // Q4: Normal operating hours - OFFERING
      const activeProgrammes = context.programmes.filter(p => {
        if (!p.operating_days.includes(context.weekday.toLowerCase())) return false
        const [start, end] = p.time_windows[0]?.split('-') || []
        if (!start || !end) return false
        const startMins = toMins(start)
        const endMins = toMins(end)
        return nowMins >= startMins && nowMins < endMins
      })
      
      ideas.push({
        ideaNumber: 1,
        postingTime: fromMins(idea1PostingMins),
        postingTimeMins: idea1PostingMins,
        contentType: 'OFFERING',
        rationale: `Currently open with ${(minutesUntilClose / 60).toFixed(1)}h until close - offering content for active programmes`,
        eligibleProgrammes: activeProgrammes.map(p => p.name.toLowerCase()),
        behavioralContext: {
          timeOfDay: getTimeOfDay(idea1PostingMins),
          decisionPattern: 'Active consumption window',
          audienceBehavior: 'Making immediate or near-term decisions'
        }
      })
    }
  }
  
  // ════════════════════════════════════════════════════════════════════════
  // IDEA 2 & 3 Logic (Strategic Programme-Based Timing)
  // ════════════════════════════════════════════════════════════════════════
  
  // Find strategic programme peaks for the remaining day
  const earliestIdea2Mins = idea1PostingMins + TIMING_RULES.MIN_SPACING
  const strategicPeaks = findStrategicProgrammePeaks(
    context.programmes,
    context.weekday,
    earliestIdea2Mins,
    effectiveClosingMins
  )
  
  console.log(`   Strategic peaks found: ${strategicPeaks.length}`)
  strategicPeaks.forEach(peak => {
    console.log(`     - ${peak.programmeName}: ${fromMins(peak.startMins)}-${fromMins(peak.endMins)} (peak: ${fromMins(peak.peakMins)})`)
  })
  
  // IDEA 2: Target first strategic peak
  if (strategicPeaks.length >= 1) {
    const targetPeak = strategicPeaks[0]
    const idea2PostingMins = calculateStrategicPostingTime(targetPeak.peakMins, earliestIdea2Mins)
    const timeRemainingAfterIdea2 = effectiveClosingMins - idea2PostingMins
    
    // Only generate if there's sufficient time remaining
    if (timeRemainingAfterIdea2 >= TIMING_RULES.CLOSING_BUFFER) {
      ideas.push({
        ideaNumber: 2,
        postingTime: fromMins(idea2PostingMins),
        postingTimeMins: idea2PostingMins,
        contentType: 'OFFERING',
        rationale: `Strategic post for ${targetPeak.programmeName} (${fromMins(targetPeak.startMins)}-${fromMins(targetPeak.endMins)}) - capturing decision window`,
        targetProgramme: targetPeak.programmeName,
        eligibleProgrammes: [targetPeak.programmeName.toLowerCase()],
        behavioralContext: {
          timeOfDay: getTimeOfDay(targetPeak.peakMins),
          decisionPattern: 'Advance planning',
          audienceBehavior: 'Planning ahead for upcoming programme'
        }
      })
    } else if (timeRemainingAfterIdea2 >= TIMING_RULES.FINAL_POST_BUFFER) {
      // Limited time but still worth an atmosphere post
      ideas.push({
        ideaNumber: 2,
        postingTime: fromMins(idea2PostingMins),
        postingTimeMins: idea2PostingMins,
        contentType: 'ATMOSPHERE',
        atmosphereAngle: 'cultural',
        rationale: `Only ${(timeRemainingAfterIdea2 / 60).toFixed(1)}h remaining - atmosphere content to maintain presence`,
        eligibleProgrammes: [],
        behavioralContext: {
          timeOfDay: getTimeOfDay(idea2PostingMins),
          decisionPattern: 'Limited window',
          audienceBehavior: 'Browsing or planning for next visit'
        }
      })
    }
  }
  
  // IDEA 3: Target second strategic peak (if Idea 2 was generated)
  if (ideas.length >= 2 && strategicPeaks.length >= 2) {
    const targetPeak = strategicPeaks[1]
    const earliestIdea3Mins = ideas[1].postingTimeMins + TIMING_RULES.MIN_SPACING
    const idea3PostingMins = calculateStrategicPostingTime(targetPeak.peakMins, earliestIdea3Mins)
    const timeRemainingAfterIdea3 = effectiveClosingMins - idea3PostingMins
    
    // Only generate if there's time and it makes sense
    if (timeRemainingAfterIdea3 >= TIMING_RULES.FINAL_POST_BUFFER && idea3PostingMins > earliestIdea3Mins) {
      // Determine if we should do OFFERING or ATMOSPHERE
      const isOfferingViable = timeRemainingAfterIdea3 >= TIMING_RULES.CLOSING_BUFFER
      
      if (isOfferingViable) {
        ideas.push({
          ideaNumber: 3,
          postingTime: fromMins(idea3PostingMins),
          postingTimeMins: idea3PostingMins,
          contentType: 'OFFERING',
          rationale: `Strategic post for ${targetPeak.programmeName} (${fromMins(targetPeak.startMins)}-${fromMins(targetPeak.endMins)}) - final offering opportunity`,
          targetProgramme: targetPeak.programmeName,
          eligibleProgrammes: [targetPeak.programmeName.toLowerCase()],
          behavioralContext: {
            timeOfDay: getTimeOfDay(targetPeak.peakMins),
            decisionPattern: 'Evening planning',
            audienceBehavior: 'Making decisions for later consumption'
          }
        })
      } else {
        ideas.push({
          ideaNumber: 3,
          postingTime: fromMins(idea3PostingMins),
          postingTimeMins: idea3PostingMins,
          contentType: 'ATMOSPHERE',
          atmosphereAngle: 'evening_ambiance',
          rationale: 'Evening atmosphere post to wrap up the day',
          eligibleProgrammes: [],
          behavioralContext: {
            timeOfDay: getTimeOfDay(idea3PostingMins),
            decisionPattern: 'Evening wind-down',
            audienceBehavior: 'End-of-day browsing or planning tomorrow'
          }
        })
      }
    }
  }
  // If only 1 strategic peak exists, we may still want a 3rd idea as atmosphere
  else if (ideas.length >= 2 && strategicPeaks.length === 1) {
    const earliestIdea3Mins = ideas[1].postingTimeMins + TIMING_RULES.MIN_SPACING
    const idea3PostingMins = roundToHalfHour(earliestIdea3Mins)
    const timeRemainingAfterIdea3 = effectiveClosingMins - idea3PostingMins
    
    if (timeRemainingAfterIdea3 >= TIMING_RULES.FINAL_POST_BUFFER) {
      ideas.push({
        ideaNumber: 3,
        postingTime: fromMins(idea3PostingMins),
        postingTimeMins: idea3PostingMins,
        contentType: 'ATMOSPHERE',
        atmosphereAngle: 'evening_ambiance',
        rationale: 'Evening atmosphere post to maintain presence',
        eligibleProgrammes: [],
        behavioralContext: {
          timeOfDay: getTimeOfDay(idea3PostingMins),
          decisionPattern: 'Evening wind-down',
          audienceBehavior: 'End-of-day browsing or planning tomorrow'
        }
      })
    }
  }
  
  // ════════════════════════════════════════════════════════════════════════
  // Build reasoning
  // ════════════════════════════════════════════════════════════════════════
  
  reasoning = `Generated ${ideas.length} ideas: `
  reasoning += ideas.map((idea, i) => 
    `Idea ${idea.ideaNumber} (${idea.contentType} @ ${idea.postingTime})`
  ).join(', ')
  reasoning += `. Available time: ${availableHours.toFixed(1)}h`
  
  return {
    suggestionCount: ideas.length,
    ideas,
    reasoning,
    metadata: {
      generationTime: nowTime,
      openingTime: context.openingTime,
      closingTime: context.closingTime || '23:00',
      effectiveClosing: effectiveClosingInfo.time,
      availableHours,
      isClosedToday: false,
      isBeforeOpening: !!isBeforeOpening,
      isCurrentlyOpen,
      isAfterClosing
    }
  }
}
