/**
 * Behavioral Context Analyzer
 * 
 * Implements 5-phase behavioral logic from the specification:
 * Phase 1: Temporal-Behavioral Context (audience segment matching with timing)
 * Phase 2: Environmental Context (weather, location advantages)
 * Phase 3: Strategic Content Selection (programme-aligned)
 * Phase 4: Recency & Rotation (supporting evidence, not primary)
 * Phase 5: Rationale Assembly (contextual relevance over "never featured")
 * 
 * Version: 1.0
 * Date: 2026-06-22
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface AudienceSegment {
  name: string
  timing_windows: string[]
  decision_timing: 'spontaneous' | 'planned' | 'mixed'
  motivation?: string
}

export interface WeatherContext {
  temperature?: number
  condition?: string
  is_favorable?: boolean
  advantage_timing?: string
}

export interface LocationAdvantage {
  type: string
  description: string
  peak_timing?: string
}

export interface MenuItem {
  id: string
  name: string
  service_periods: string[]
  last_posted_date?: string
  category?: string
}

export interface BehavioralAnalysisInput {
  currentTime: string           // HH:MM
  weekday: string
  targetTime?: string           // HH:MM (for future suggestions)
  audienceSegments: AudienceSegment[]
  weather?: WeatherContext
  locationAdvantages?: LocationAdvantage[]
  availableMenuItems: MenuItem[]
  recentlyPostedItemIds?: string[]
  targetProgramme?: string
  contentType: 'OFFERING' | 'ATMOSPHERE'
}

export interface BehavioralAnalysisResult {
  primaryAudienceSegment: string | null
  audienceBehavior: string
  decisionPattern: string
  environmentalFactors: string[]
  selectedContent: {
    itemId?: string
    itemName?: string
    rationale: string
  }
  recencySupport: string | null
  assembledRationale: string
  metadata: {
    phase1_temporal: string
    phase2_environmental: string
    phase3_strategic: string
    phase4_recency: string
    phase5_assembly: string
  }
}

// ── Helper Functions ─────────────────────────────────────────────────────────

function toMins(hhmm: string): number {
  const [h, m = 0] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function isWithinTimeWindow(currentMins: number, timeWindow: string): boolean {
  const [start, end] = timeWindow.split('-')
  if (!start || !end) return false
  
  const startMins = toMins(start)
  const endMins = toMins(end)
  
  // Handle midnight crossing
  if (endMins < startMins) {
    return currentMins >= startMins || currentMins < endMins
  }
  
  return currentMins >= startMins && currentMins < endMins
}

function getBehavioralContext(timeMins: number, weekday: string): {
  timeOfDay: string
  typicalBehavior: string
  decisionWindow: string
} {
  const hour = Math.floor(timeMins / 60) % 24
  const dayType = ['saturday', 'sunday'].includes(weekday.toLowerCase()) ? 'weekend' : 'weekday'
  
  // Early morning (05:00-09:00)
  if (hour >= 5 && hour < 9) {
    return {
      timeOfDay: 'early_morning',
      typicalBehavior: dayType === 'weekday' 
        ? 'Commuters and early workers starting their day'
        : 'Early risers and weekend brunch planners',
      decisionWindow: 'Planning immediate breakfast or mid-morning options'
    }
  }
  
  // Morning (09:00-12:00)
  if (hour >= 9 && hour < 12) {
    return {
      timeOfDay: 'morning',
      typicalBehavior: dayType === 'weekday'
        ? 'Mid-morning break seekers and lunch planners'
        : 'Brunch crowd and leisure diners',
      decisionWindow: 'Considering lunch options or late brunch'
    }
  }
  
  // Midday (12:00-15:00)
  if (hour >= 12 && hour < 15) {
    return {
      timeOfDay: 'midday',
      typicalBehavior: 'Active lunch crowd and afternoon cafe visitors',
      decisionWindow: 'Immediate lunch decisions or afternoon plans'
    }
  }
  
  // Afternoon (15:00-18:00)
  if (hour >= 15 && hour < 18) {
    return {
      timeOfDay: 'afternoon',
      typicalBehavior: dayType === 'weekday'
        ? 'Afternoon break takers and dinner planners'
        : 'Leisurely diners and early dinner crowd',
      decisionWindow: 'Planning evening meals or afternoon treats'
    }
  }
  
  // Evening (18:00-22:00)
  if (hour >= 18 && hour < 22) {
    return {
      timeOfDay: 'evening',
      typicalBehavior: 'Dinner crowd and social gatherings',
      decisionWindow: 'Active dinner decisions and evening socializing'
    }
  }
  
  // Night (22:00-05:00)
  return {
    timeOfDay: 'night',
    typicalBehavior: 'Late-night diners and next-day planners',
    decisionWindow: 'Late-night options or planning tomorrow'
  }
}

// ── Phase 1: Temporal-Behavioral Context ─────────────────────────────────────

function analyzeTemporalBehavioral(
  timeMins: number,
  weekday: string,
  audienceSegments: AudienceSegment[]
): {
  matchedSegment: AudienceSegment | null
  behavior: string
  decision: string
} {
  // Find matching audience segments based on timing windows
  const matchedSegments = audienceSegments.filter(segment => 
    segment.timing_windows.some(window => isWithinTimeWindow(timeMins, window))
  )
  
  if (matchedSegments.length === 0) {
    const context = getBehavioralContext(timeMins, weekday)
    return {
      matchedSegment: null,
      behavior: context.typicalBehavior,
      decision: context.decisionWindow
    }
  }
  
  // Prefer segments with spontaneous decision timing for immediate posts
  const primarySegment = matchedSegments.find(s => s.decision_timing === 'spontaneous') 
    || matchedSegments[0]
  
  const context = getBehavioralContext(timeMins, weekday)
  
  return {
    matchedSegment: primarySegment,
    behavior: primarySegment.motivation || context.typicalBehavior,
    decision: primarySegment.decision_timing === 'spontaneous'
      ? 'Making immediate or spontaneous decisions'
      : primarySegment.decision_timing === 'planned'
      ? 'Planning ahead and booking reservations'
      : context.decisionWindow
  }
}

// ── Phase 2: Environmental Context ───────────────────────────────────────────

function analyzeEnvironmental(
  weather?: WeatherContext,
  locationAdvantages?: LocationAdvantage[],
  timeMins?: number
): string[] {
  const factors: string[] = []
  
  // Weather factors
  if (weather?.is_favorable && weather.condition) {
    factors.push(`Favorable weather (${weather.condition})`)
  } else if (weather?.condition) {
    factors.push(`Weather: ${weather.condition}`)
  }
  
  // Location advantages with timing
  if (locationAdvantages && timeMins !== undefined) {
    locationAdvantages.forEach(advantage => {
      if (advantage.peak_timing) {
        const [start, end] = advantage.peak_timing.split('-')
        if (start && end && isWithinTimeWindow(timeMins, advantage.peak_timing)) {
          factors.push(`${advantage.type} peak time: ${advantage.description}`)
        }
      } else {
        factors.push(`${advantage.type}: ${advantage.description}`)
      }
    })
  }
  
  return factors
}

// ── Phase 3: Strategic Content Selection ─────────────────────────────────────

function selectStrategicContent(
  availableItems: MenuItem[],
  targetProgramme?: string,
  recentlyPosted?: string[]
): MenuItem | null {
  // Filter out recently posted items
  const eligibleItems = availableItems.filter(item => 
    !recentlyPosted?.includes(item.id)
  )
  
  if (eligibleItems.length === 0) {
    return availableItems[0] || null
  }
  
  // If target programme specified, prefer items from that programme
  if (targetProgramme) {
    const programmeItems = eligibleItems.filter(item =>
      item.service_periods.some(period => 
        period.toLowerCase().includes(targetProgramme.toLowerCase())
      )
    )
    
    if (programmeItems.length > 0) {
      return programmeItems[0]
    }
  }
  
  // Return first eligible item
  return eligibleItems[0]
}

// ── Phase 4: Recency Analysis ────────────────────────────────────────────────

function analyzeRecency(
  selectedItem: MenuItem | null,
  recentlyPosted?: string[]
): string | null {
  if (!selectedItem) return null
  
  // Check if item was never posted or posted long ago
  if (!selectedItem.last_posted_date) {
    return 'Never featured before'
  }
  
  const lastPosted = new Date(selectedItem.last_posted_date)
  const now = new Date()
  const daysSince = Math.floor((now.getTime() - lastPosted.getTime()) / (1000 * 60 * 60 * 24))
  
  if (daysSince > 30) {
    return `Last featured ${daysSince} days ago`
  } else if (daysSince > 14) {
    return 'Not featured recently'
  }
  
  return null // Too recent, don't mention
}

// ── Phase 5: Rationale Assembly ──────────────────────────────────────────────

function assembleRationale(
  audienceBehavior: string,
  decisionPattern: string,
  environmentalFactors: string[],
  selectedItem: MenuItem | null,
  recencySupport: string | null,
  contentType: 'OFFERING' | 'ATMOSPHERE'
): string {
  const parts: string[] = []
  
  // Lead with time-audience fit
  if (audienceBehavior && decisionPattern) {
    parts.push(`${audienceBehavior} - ${decisionPattern.toLowerCase()}`)
  }
  
  // Add environmental context
  if (environmentalFactors.length > 0) {
    parts.push(environmentalFactors[0]) // Use first/most relevant factor
  }
  
  // Add content-specific details
  if (contentType === 'OFFERING' && selectedItem) {
    parts.push(`Featuring: ${selectedItem.name}`)
  }
  
  // Add recency as supporting evidence (optional)
  if (recencySupport) {
    parts.push(`(${recencySupport})`)
  }
  
  return parts.join('. ')
}

// ── Main Analysis Function ───────────────────────────────────────────────────

export function analyzeBehavioralContext(
  input: BehavioralAnalysisInput
): BehavioralAnalysisResult {
  
  const targetTimeMins = input.targetTime 
    ? toMins(input.targetTime) 
    : toMins(input.currentTime)
  
  // Phase 1: Temporal-Behavioral Context
  console.log('🔍 Phase 1: Analyzing Temporal-Behavioral Context...')
  const temporal = analyzeTemporalBehavioral(
    targetTimeMins,
    input.weekday,
    input.audienceSegments
  )
  
  // Phase 2: Environmental Context
  console.log('🌤️  Phase 2: Analyzing Environmental Context...')
  const environmental = analyzeEnvironmental(
    input.weather,
    input.locationAdvantages,
    targetTimeMins
  )
  
  // Phase 3: Strategic Content Selection
  console.log('🎯 Phase 3: Strategic Content Selection...')
  const selectedContent = input.contentType === 'OFFERING'
    ? selectStrategicContent(
        input.availableMenuItems,
        input.targetProgramme,
        input.recentlyPostedItemIds
      )
    : null
  
  // Phase 4: Recency Analysis
  console.log('📅 Phase 4: Analyzing Recency...')
  const recency = analyzeRecency(
    selectedContent,
    input.recentlyPostedItemIds
  )
  
  // Phase 5: Rationale Assembly
  console.log('📝 Phase 5: Assembling Rationale...')
  const rationale = assembleRationale(
    temporal.behavior,
    temporal.decision,
    environmental,
    selectedContent,
    recency,
    input.contentType
  )
  
  return {
    primaryAudienceSegment: temporal.matchedSegment?.name || null,
    audienceBehavior: temporal.behavior,
    decisionPattern: temporal.decision,
    environmentalFactors: environmental,
    selectedContent: {
      itemId: selectedContent?.id,
      itemName: selectedContent?.name,
      rationale: rationale
    },
    recencySupport: recency,
    assembledRationale: rationale,
    metadata: {
      phase1_temporal: `Matched: ${temporal.matchedSegment?.name || 'Generic'}, Behavior: ${temporal.behavior}`,
      phase2_environmental: environmental.join('; ') || 'No environmental factors',
      phase3_strategic: selectedContent?.name || 'No content selected (ATMOSPHERE)',
      phase4_recency: recency || 'Not applicable',
      phase5_assembly: 'Complete'
    }
  }
}
