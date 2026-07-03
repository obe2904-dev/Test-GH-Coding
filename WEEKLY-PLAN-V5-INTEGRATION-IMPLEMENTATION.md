# Weekly Plan V5 Integration - Safe Implementation Plan

**Date:** May 8, 2026  
**Status:** 🟡 Planning Phase  
**Risk Level:** Medium (touching critical content generation pipeline)  
**Estimated Duration:** 4 weeks (1 phase per week)

---

## Table of Contents

1. [Implementation Philosophy](#implementation-philosophy)
2. [Phase 0: Preparation & Validation](#phase-0-preparation--validation)
3. [Phase 1: Layer 3 Integration (Read-Only)](#phase-1-layer-3-integration-read-only)
4. [Phase 2: Layer 4 Segment Matching](#phase-2-layer-4-segment-matching)
5. [Phase 3: Content Quality Rules](#phase-3-content-quality-rules)
6. [Phase 4: Evidence Validation & Cleanup](#phase-4-evidence-validation--cleanup)
7. [Testing Strategy](#testing-strategy)
8. [Rollback Procedures](#rollback-procedures)
9. [Success Metrics](#success-metrics)

---

## Implementation Philosophy

### Core Principles

**1. Feature Flags for All Changes**
```typescript
// Environment variable controls each phase
const ENABLE_V5_LAYER3 = Deno.env.get('ENABLE_V5_LAYER3') === 'true'
const ENABLE_V5_LAYER4 = Deno.env.get('ENABLE_V5_LAYER4') === 'true'
const ENABLE_V5_EVIDENCE = Deno.env.get('ENABLE_V5_EVIDENCE') === 'true'
```

**2. Graceful Degradation**
```typescript
// Always have fallback to current system
const brandProfile = await fetchV5Profile(businessId)
if (!brandProfile || !ENABLE_V5_LAYER3) {
  // Fall back to current business_brand_profile query
  return fetchLegacyProfile(businessId)
}
```

**3. Parallel Execution (A/B Comparison)**
```typescript
// Run both systems, compare outputs, log differences
const v5Result = await generateStrategyV5(context)
const legacyResult = await generateStrategyLegacy(context)

logComparison({ v5: v5Result, legacy: legacyResult })

// Return legacy by default until V5 validated
return ENABLE_V5_LAYER3 ? v5Result : legacyResult
```

**4. Comprehensive Logging**
```typescript
// Every V5 code path logs for debugging
console.log('[V5-INTEGRATION]', {
  phase: 'layer3',
  businessId,
  profileFound: !!brandProfile,
  fieldsPresent: Object.keys(brandProfile),
  fallbackUsed: false
})
```

**5. Non-Destructive Testing**
```typescript
// Test on single business first (Café Faust)
const TEST_BUSINESS_ID = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'
const isTestBusiness = businessId === TEST_BUSINESS_ID

if (isTestBusiness || ENABLE_V5_LAYER3) {
  // Use V5
} else {
  // Use legacy
}
```

---

## Phase 0: Preparation & Validation

**Duration:** Week 0 (3 days)  
**Risk:** Low  
**Goal:** Validate data quality and create infrastructure

### Step 0.1: Data Quality Audit

**File:** `scripts/audit-v5-data-quality.ts`

```typescript
// Audit all businesses for V5 readiness
interface V5Readiness {
  businessId: string
  businessName: string
  hasLayer3: boolean
  layer3Fields: {
    brand_essence: boolean
    positioning: boolean
    core_values: boolean
    what_makes_us_different: boolean
  }
  hasLayer4: boolean
  layer4Programmes: number
  totalSegments: number
  segmentsWithEvidence: number
  quality: 'ready' | 'partial' | 'missing'
}

async function auditV5Readiness() {
  const businesses = await supabase
    .from('businesses')
    .select('id, business_name')
  
  for (const biz of businesses) {
    // Check Layer 3
    const { data: profile } = await supabase
      .from('business_brand_profile')
      .select('brand_essence, positioning, core_values, what_makes_us_different')
      .eq('business_id', biz.id)
      .single()
    
    // Check Layer 4
    const { data: programmes } = await supabase
      .from('business_programme_profiles')
      .select('audience_segments')
      .eq('business_id', biz.id)
    
    // Assess quality
    const readiness: V5Readiness = {
      businessId: biz.id,
      businessName: biz.business_name,
      hasLayer3: !!profile,
      layer3Fields: {
        brand_essence: !!profile?.brand_essence,
        positioning: !!profile?.positioning,
        core_values: !!profile?.core_values,
        what_makes_us_different: !!profile?.what_makes_us_different
      },
      hasLayer4: programmes && programmes.length > 0,
      layer4Programmes: programmes?.length || 0,
      totalSegments: countSegments(programmes),
      segmentsWithEvidence: countSegmentsWithEvidence(programmes),
      quality: assessQuality(profile, programmes)
    }
    
    console.log(readiness)
  }
}
```

**Acceptance Criteria:**
- ✅ Café Faust (test business) has 100% V5 data
- ✅ At least 1 other business has V5 data for validation
- ✅ Report shows % of businesses ready for V5

### Step 0.2: Create Type Definitions

**File:** `src/types/brand-profile-v5.ts`

```typescript
// Layer 3: Identity Profile
export interface IdentityProfile {
  brand_essence: string
  positioning: string
  core_values: string[]  // Array of "Title - Description" strings
  what_makes_us_different: string
  confidence: number
}

// Layer 4: Audience Segment
export interface AudienceSegment {
  label: string
  timing_windows: string[]  // ["Lør-Søn 10:00-14:00"]
  content_angles: string[]
  segment_size: 'primary' | 'secondary' | 'niche'
  motivation: 'social_gathering' | 'convenience' | 'experience_seeking' | 'routine'
  decision_timing: 'spontaneous' | 'planned' | 'mixed'
  goal_contribution: 'drive_footfall' | 'strengthen_brand' | 'retain_regulars'
  evidence: string[]
}

// Programme Profile (contains segments)
export interface ProgrammeProfile {
  programme_type: string
  programme_name: string
  audience_segments: AudienceSegment[]
  segment_confidence?: number
  segment_reasoning?: string
}

// Timing Window Parser Result
export interface ParsedTimingWindow {
  startDay: number  // 0-6 (Sun-Sat)
  endDay: number
  startHour: number  // 0-23
  endHour: number
  daysOfWeek: number[]  // [1,2,3,4,5] for Mon-Fri
}

// Active Segment Match Result
export interface ActiveSegmentMatch {
  programme: ProgrammeProfile
  segment: AudienceSegment
  matchConfidence: number  // 0-1
  matchReason: string
}
```

### Step 0.3: Create Utility Functions

**File:** `supabase/functions/_shared/utils/v5-helpers.ts`

```typescript
import { ParsedTimingWindow } from '../types/brand-profile-v5.ts'

// Parse Danish day names to numbers
const DAY_MAP: Record<string, number> = {
  'søn': 0, 'søndag': 0,
  'man': 1, 'mandag': 1,
  'tir': 2, 'tirsdag': 2,
  'ons': 3, 'onsdag': 3,
  'tor': 4, 'torsdag': 4,
  'fre': 5, 'fredag': 5,
  'lør': 6, 'lørdag': 6
}

export function parseTimingWindow(window: string): ParsedTimingWindow | null {
  try {
    // "Lør-Søn 10:00-14:00"
    const [daysPart, hoursPart] = window.split(' ')
    
    // Parse days
    let daysOfWeek: number[] = []
    if (daysPart.includes('-')) {
      const [start, end] = daysPart.toLowerCase().split('-')
      const startDay = DAY_MAP[start.trim()]
      const endDay = DAY_MAP[end.trim()]
      
      if (startDay === undefined || endDay === undefined) {
        console.warn('[V5] Invalid day names:', daysPart)
        return null
      }
      
      // Generate range (handle wrap-around like Fri-Sun)
      if (startDay <= endDay) {
        for (let i = startDay; i <= endDay; i++) {
          daysOfWeek.push(i)
        }
      } else {
        for (let i = startDay; i <= 6; i++) daysOfWeek.push(i)
        for (let i = 0; i <= endDay; i++) daysOfWeek.push(i)
      }
    } else {
      // Single day or "alle dage"
      const day = DAY_MAP[daysPart.toLowerCase().trim()]
      if (day !== undefined) {
        daysOfWeek = [day]
      } else if (daysPart.toLowerCase().includes('alle')) {
        daysOfWeek = [0,1,2,3,4,5,6]
      }
    }
    
    // Parse hours
    const [startTime, endTime] = hoursPart.split('-')
    const startHour = parseInt(startTime.split(':')[0])
    const endHour = parseInt(endTime.split(':')[0])
    
    return {
      startDay: daysOfWeek[0],
      endDay: daysOfWeek[daysOfWeek.length - 1],
      startHour,
      endHour,
      daysOfWeek
    }
  } catch (error) {
    console.error('[V5] Failed to parse timing window:', window, error)
    return null
  }
}

export function matchesCurrentTime(
  window: ParsedTimingWindow,
  currentDay: number,
  currentHour: number
): boolean {
  // Check if current day is in range
  if (!window.daysOfWeek.includes(currentDay)) {
    return false
  }
  
  // Check if current hour is in range
  // Handle midnight crossing (e.g., 22:00-02:00)
  if (window.startHour <= window.endHour) {
    return currentHour >= window.startHour && currentHour < window.endHour
  } else {
    return currentHour >= window.startHour || currentHour < window.endHour
  }
}

export function getActiveSegment(
  programmes: ProgrammeProfile[],
  currentDay: number,
  currentHour: number,
  preferredProgramme?: string
): ActiveSegmentMatch | null {
  const matches: ActiveSegmentMatch[] = []
  
  for (const programme of programmes) {
    if (!programme.audience_segments) continue
    
    for (const segment of programme.audience_segments) {
      for (const windowStr of segment.timing_windows) {
        const window = parseTimingWindow(windowStr)
        if (!window) continue
        
        if (matchesCurrentTime(window, currentDay, currentHour)) {
          // Calculate match confidence
          let confidence = 0.8  // Base confidence
          
          // Boost if preferred programme
          if (preferredProgramme && programme.programme_type === preferredProgramme) {
            confidence += 0.15
          }
          
          // Boost for primary segments
          if (segment.segment_size === 'primary') {
            confidence += 0.05
          }
          
          matches.push({
            programme,
            segment,
            matchConfidence: Math.min(1.0, confidence),
            matchReason: `Matches timing window: ${windowStr}`
          })
        }
      }
    }
  }
  
  // Return highest confidence match
  if (matches.length === 0) return null
  
  matches.sort((a, b) => b.matchConfidence - a.matchConfidence)
  return matches[0]
}

// Validate brunch vs breakfast behavior
export function isBrunchProgramme(programmeName: string): boolean {
  const lower = programmeName.toLowerCase()
  return lower.includes('brunch') || 
         (lower.includes('morgenmad') && lower.includes('brunch'))
}

export function enforceBrunchTerminology(text: string, isBrunch: boolean): string {
  if (!isBrunch) return text
  
  // Replace "morgenmad" with "brunch" when programme is brunch
  return text
    .replace(/\bmorgenmad\b/gi, 'brunch')
    .replace(/\bbreakfast\b/gi, 'brunch')
}

// Extract content angles by priority
export function getContentAnglesByPriority(
  segment: AudienceSegment,
  usedAngles: string[] = []
): string[] {
  return segment.content_angles.filter(angle => 
    !usedAngles.some(used => 
      used.toLowerCase().includes(angle.toLowerCase().slice(0, 10))
    )
  )
}
```

**Testing:**
```typescript
// Test timing window parser
const tests = [
  { input: "Lør-Søn 10:00-14:00", expect: { days: [6,0], hours: [10,14] } },
  { input: "Man-Fre 11:00-15:00", expect: { days: [1,2,3,4,5], hours: [11,15] } },
  { input: "Fredag-Lørdag 22:00-02:00", expect: { days: [5,6], hours: [22,2] } }
]

for (const test of tests) {
  const result = parseTimingWindow(test.input)
  console.assert(
    result?.daysOfWeek.length === test.expect.days.length,
    `Failed: ${test.input}`
  )
}
```

### Step 0.4: Create Feature Flag System

**File:** `supabase/functions/_shared/config/v5-flags.ts`

```typescript
// Centralized feature flag management
export const V5_FLAGS = {
  // Global kill switch
  ENABLED: Deno.env.get('V5_ENABLED') === 'true',
  
  // Per-phase flags
  LAYER3_ENABLED: Deno.env.get('V5_LAYER3_ENABLED') === 'true',
  LAYER4_ENABLED: Deno.env.get('V5_LAYER4_ENABLED') === 'true',
  EVIDENCE_ENABLED: Deno.env.get('V5_EVIDENCE_ENABLED') === 'true',
  
  // Safety flags
  TEST_BUSINESS_ONLY: Deno.env.get('V5_TEST_BUSINESS_ONLY') === 'true',
  TEST_BUSINESS_ID: Deno.env.get('V5_TEST_BUSINESS_ID') || '2037d63c-a138-4247-89c5-5b6b8cef9f3f',
  
  // Logging
  DEBUG_LOGGING: Deno.env.get('V5_DEBUG') === 'true',
  LOG_COMPARISONS: Deno.env.get('V5_LOG_COMPARISONS') === 'true'
}

export function isV5EnabledForBusiness(businessId: string): boolean {
  if (!V5_FLAGS.ENABLED) return false
  
  if (V5_FLAGS.TEST_BUSINESS_ONLY) {
    return businessId === V5_FLAGS.TEST_BUSINESS_ID
  }
  
  return true
}

export function logV5(phase: string, data: any) {
  if (!V5_FLAGS.DEBUG_LOGGING) return
  
  console.log(`[V5-${phase.toUpperCase()}]`, JSON.stringify(data, null, 2))
}
```

**Acceptance Criteria:**
- ✅ All type definitions compile without errors
- ✅ Timing window parser passes all test cases
- ✅ Feature flags can be toggled via environment variables
- ✅ V5 data audit shows Café Faust is 100% ready

---

## Phase 1: Layer 3 Integration (Read-Only)

**Duration:** Week 1 (5 days)  
**Risk:** Low  
**Goal:** Integrate Layer 3 identity data into Weekly Plan Phase 1 (strategic brief)

### Step 1.1: Create Layer 3 Data Fetcher

**File:** `supabase/functions/_shared/data-fetchers/fetch-v5-profile.ts`

```typescript
import { IdentityProfile, ProgrammeProfile } from '../types/brand-profile-v5.ts'
import { V5_FLAGS, logV5 } from '../config/v5-flags.ts'

export async function fetchV5IdentityProfile(
  supabase: any,
  businessId: string
): Promise<IdentityProfile | null> {
  try {
    const { data, error } = await supabase
      .from('business_brand_profile')
      .select('brand_essence, positioning, core_values, what_makes_us_different, confidence')
      .eq('business_id', businessId)
      .single()
    
    if (error) {
      logV5('layer3-fetch', { error: error.message, businessId })
      return null
    }
    
    // Validate required fields
    if (!data?.brand_essence || !data?.positioning) {
      logV5('layer3-fetch', { 
        warning: 'Missing required fields',
        businessId,
        fieldsPresent: Object.keys(data || {})
      })
      return null
    }
    
    // Parse core_values (might be JSONB array or text)
    let coreValues: string[] = []
    if (Array.isArray(data.core_values)) {
      coreValues = data.core_values
    } else if (typeof data.core_values === 'string') {
      try {
        coreValues = JSON.parse(data.core_values)
      } catch {
        coreValues = [data.core_values]
      }
    }
    
    const profile: IdentityProfile = {
      brand_essence: data.brand_essence,
      positioning: data.positioning,
      core_values: coreValues,
      what_makes_us_different: data.what_makes_us_different || '',
      confidence: data.confidence || 0.9
    }
    
    logV5('layer3-fetch', { success: true, businessId, profile })
    return profile
    
  } catch (error) {
    console.error('[V5-LAYER3] Fetch error:', error)
    return null
  }
}

export async function fetchV5ProgrammeProfiles(
  supabase: any,
  businessId: string
): Promise<ProgrammeProfile[]> {
  try {
    const { data, error } = await supabase
      .from('business_programme_profiles')
      .select('programme_type, programme_name, audience_segments, segment_confidence, segment_reasoning')
      .eq('business_id', businessId)
    
    if (error || !data) {
      logV5('layer4-fetch', { error: error?.message, businessId })
      return []
    }
    
    logV5('layer4-fetch', { 
      success: true, 
      businessId, 
      programmeCount: data.length 
    })
    
    return data as ProgrammeProfile[]
    
  } catch (error) {
    console.error('[V5-LAYER4] Fetch error:', error)
    return []
  }
}
```

### Step 1.2: Update Phase 1 Prompt Builder

**File:** `supabase/functions/_shared/post-helpers/strategy/phase1.ts`

**Changes:**

```typescript
import { fetchV5IdentityProfile } from '../../data-fetchers/fetch-v5-profile.ts'
import { V5_FLAGS, isV5EnabledForBusiness, logV5 } from '../../config/v5-flags.ts'

export async function buildPhase1Prompt(context: WeekContext): Promise<string> {
  const { businessId } = context
  
  // Try V5 Layer 3 if enabled
  let identitySection = ''
  
  if (V5_FLAGS.LAYER3_ENABLED && isV5EnabledForBusiness(businessId)) {
    const v5Profile = await fetchV5IdentityProfile(context.supabase, businessId)
    
    if (v5Profile) {
      // Use V5 Layer 3 data
      identitySection = buildV5IdentitySection(v5Profile)
      logV5('phase1-prompt', { source: 'v5', businessId })
    } else {
      // Fallback to legacy
      identitySection = buildLegacyIdentitySection(context)
      logV5('phase1-prompt', { source: 'legacy-fallback', businessId })
    }
  } else {
    // Use legacy system
    identitySection = buildLegacyIdentitySection(context)
  }
  
  // Rest of prompt unchanged
  const prompt = `
${identitySection}

[... rest of Phase 1 prompt ...]
  `
  
  return prompt
}

function buildV5IdentitySection(profile: IdentityProfile): string {
  return `
═══════════════════════════════════════════════════════════════
BRAND IDENTITY (Layer 3)
═══════════════════════════════════════════════════════════════

BRAND ESSENCE (use as voice anchor):
${profile.brand_essence}

MARKET POSITIONING (use for differentiation angles):
${profile.positioning}

CORE VALUES (use as content pillars):
${profile.core_values.map((val, i) => `${i + 1}. ${val}`).join('\n')}

UNIQUE SELLING POINT:
${profile.what_makes_us_different}

═══════════════════════════════════════════════════════════════
STRATEGIC BRIEF REQUIREMENTS
═══════════════════════════════════════════════════════════════

When generating strategic angles:
1. Ground each angle in ONE of the core values above
2. Use brand essence phrasing in angle descriptions
3. Leverage positioning for competitive differentiation
4. Reference USP when suggesting "what makes us different" angles

Example angle structure:
{
  "focus": "Weekend brunch-hygge med regionale råvarer",
  "reasoning": "Core value: Regional forankring → leverage Tange Sø supplier mention. Brand essence: 'alsidig café ved åen' → emphasize all-day experience.",
  "content_direction": "Show brunchretter with regional ingredients, mention 'ved åen' location, no generic breakfast framing"
}
  `
}

function buildLegacyIdentitySection(context: WeekContext): string {
  // Current system (unchanged)
  return `
BRAND PROFILE:
Business Character: ${context.businessCharacter}
Target Audience: ${context.targetAudience}
Tone: ${context.tone}
  `
}
```

### Step 1.3: Add Comparison Logging

**File:** `supabase/functions/get-weekly-strategy/index.ts`

```typescript
import { V5_FLAGS, logV5 } from '../_shared/config/v5-flags.ts'

// After Phase 1 generation
if (V5_FLAGS.LOG_COMPARISONS && V5_FLAGS.LAYER3_ENABLED) {
  // Log which source was used
  const usedV5 = phase1Output.metadata?.source === 'v5'
  
  logV5('phase1-result', {
    businessId,
    weekStart,
    usedV5,
    angleCount: phase1Output.angles.length,
    avgConfidence: calculateAvgConfidence(phase1Output.angles),
    firstAngleFocus: phase1Output.angles[0]?.focus,
    coreValuesReferenced: countCoreValueReferences(phase1Output)
  })
}
```

### Step 1.4: Deploy with Feature Flag OFF

```bash
# Set environment variables in Supabase dashboard
V5_ENABLED=true
V5_LAYER3_ENABLED=false  # OFF initially
V5_TEST_BUSINESS_ONLY=true
V5_TEST_BUSINESS_ID=2037d63c-a138-4247-89c5-5b6b8cef9f3f
V5_DEBUG=true
V5_LOG_COMPARISONS=true

# Deploy
supabase functions deploy get-weekly-strategy --project-ref kvqdkohdpvmdylqgujpn
```

### Step 1.5: Controlled Activation & Testing

**Day 1-2: Shadow Mode (Flag OFF)**
- Code deployed but V5 not active
- Monitor logs for any errors in new code paths
- Verify fallback logic works

**Day 3: Test Business Only (Flag ON for Café Faust)**
```bash
# Update env vars
V5_LAYER3_ENABLED=true  # ON for test business only
```

- Generate weekly strategy for Café Faust
- Compare output quality vs legacy
- Check logs for V5 data usage
- Validate brand voice consistency

**Day 4: Secondary Test Business**
- Generate V5 profile for 1 more business
- Test with that business
- Verify generic solution (not hardcoded)

**Day 5: Assessment & Rollback Decision**
- Review comparison logs
- Measure quality improvement
- Decision: Keep enabled OR rollback

**Rollback:** Set `V5_LAYER3_ENABLED=false`

### Step 1.6: Success Criteria

✅ **Code Quality:**
- Zero TypeScript errors
- All helper functions have unit tests
- Feature flags work correctly

✅ **Data Quality:**
- V5 profile fetched successfully for test business
- Fallback triggered when profile missing
- No null pointer exceptions

✅ **Output Quality:**
- Phase 1 angles reference core values
- Brand essence appears in angle descriptions
- Positioning used for differentiation reasoning

✅ **Logging:**
- Comparison logs show V5 vs legacy differences
- Debug logs trace data flow
- No sensitive data in logs

---

## Phase 2: Layer 4 Segment Matching

**Duration:** Week 2 (5 days)  
**Risk:** Medium  
**Goal:** Add programme-specific audience segments to Phase 0 & Phase 1

### Step 2.1: Integrate Active Segment Detection

**File:** `supabase/functions/_shared/post-helpers/strategy/phase0.ts`

```typescript
import { fetchV5ProgrammeProfiles } from '../../data-fetchers/fetch-v5-profile.ts'
import { getActiveSegment } from '../../utils/v5-helpers.ts'
import { V5_FLAGS, logV5 } from '../../config/v5-flags.ts'

export async function buildPhase0Prompt(context: WeekContext): Promise<string> {
  let audienceInsightSection = ''
  
  if (V5_FLAGS.LAYER4_ENABLED && isV5EnabledForBusiness(context.businessId)) {
    // Fetch programme profiles
    const programmes = await fetchV5ProgrammeProfiles(context.supabase, context.businessId)
    
    if (programmes.length > 0) {
      // Determine which segments are active this week
      const weekDate = new Date(context.weekStart)
      const activeProgrammes = programmes.filter(p => 
        isActiveThisWeek(p, weekDate)
      )
      
      audienceInsightSection = buildV5AudienceSection(activeProgrammes)
      logV5('phase0-audience', { 
        source: 'v5',
        totalProgrammes: programmes.length,
        activeProgrammes: activeProgrammes.length
      })
    } else {
      audienceInsightSection = buildLegacyAudienceSection(context)
      logV5('phase0-audience', { source: 'legacy-fallback' })
    }
  } else {
    audienceInsightSection = buildLegacyAudienceSection(context)
  }
  
  return `
[... Phase 0 context ...]

${audienceInsightSection}

[... rest of Phase 0 prompt ...]
  `
}

function buildV5AudienceSection(programmes: ProgrammeProfile[]): string {
  let section = `
═══════════════════════════════════════════════════════════════
PROGRAMME-SPECIFIC AUDIENCE SEGMENTS (Layer 4)
═══════════════════════════════════════════════════════════════

The business serves different audiences across programmes:

`
  
  for (const prog of programmes) {
    section += `\n**${prog.programme_name} (${prog.programme_type})**\n`
    
    for (const seg of prog.audience_segments || []) {
      section += `
  → ${seg.label} (${seg.segment_size})
     Timing: ${seg.timing_windows.join(', ')}
     Motivation: ${seg.motivation}
     Content Angles: ${seg.content_angles.join(', ')}
     Evidence: ${seg.evidence.join(' | ')}
`
    }
  }
  
  section += `
═══════════════════════════════════════════════════════════════
PHASE 0 TASK: Behavioral Analysis
═══════════════════════════════════════════════════════════════

Analyze this week's context (weather, events, economic) and identify:
1. Which programme segments will be MOST influenced by this week's conditions
2. Which segment motivations align with this week's behavioral factors
3. Primary opportunities (which segment + which day/time window)

Output your key_factors with explicit segment references where applicable.
  `
  
  return section
}
```

### Step 2.2: Update Phase 1 Slot Assignment

**File:** `supabase/functions/_shared/post-helpers/strategy/phase1.ts`

```typescript
// After Phase 0 completes and we have key_factors

if (V5_FLAGS.LAYER4_ENABLED) {
  // Match Phase 0 factors to specific segments
  const programmes = await fetchV5ProgrammeProfiles(context.supabase, context.businessId)
  
  // For each slot (A, B, C, D), suggest which segment to target
  const slotSuggestions = assignSlotsToSegments(
    programmes,
    phase0Output.key_factors,
    context.weekStart
  )
  
  // Add to Phase 1 prompt
  slotGuidance = buildSlotGuidanceWithSegments(slotSuggestions)
}

function assignSlotsToSegments(
  programmes: ProgrammeProfile[],
  keyFactors: any[],
  weekStart: string
): SlotAssignment[] {
  // Slot A: Primary footfall (Thu-Fri 14:00)
  // → Find segment with goal_contribution=drive_footfall, timing includes Thu/Fri afternoon
  const slotASegment = findBestSegmentForSlot({
    goal: 'drive_footfall',
    preferredDays: [4, 5],  // Thu, Fri
    preferredHours: [14, 15, 16],
    size: 'primary'
  }, programmes)
  
  // Slot C: Brand builder (Mon 09:00)
  // → Find segment with goal_contribution=strengthen_brand, Mon morning
  const slotCSegment = findBestSegmentForSlot({
    goal: 'strengthen_brand',
    preferredDays: [1],  // Mon
    preferredHours: [9, 10],
    anySize: true
  }, programmes)
  
  return [
    { slot: 'A', segment: slotASegment },
    { slot: 'C', segment: slotCSegment }
  ]
}

function buildSlotGuidanceWithSegments(assignments: SlotAssignment[]): string {
  let guidance = '\n═══ SLOT-TO-SEGMENT MAPPING ═══\n'
  
  for (const assign of assignments) {
    if (!assign.segment) continue
    
    guidance += `
Slot ${assign.slot}:
  Target Segment: ${assign.segment.label}
  Programme: ${assign.programme.programme_name}
  Motivation: ${assign.segment.motivation}
  Content Angles: ${assign.segment.content_angles.join(', ')}
  Timing Window: ${assign.segment.timing_windows[0]}
  
  → Generate angle that appeals to "${assign.segment.motivation}" motivation
  → Use one of these content angles: ${assign.segment.content_angles[0]}
  → Evidence available: ${assign.segment.evidence.join(', ')}
`
  }
  
  return guidance
}
```

### Step 2.3: Add Segment Validation

**File:** `supabase/functions/_shared/post-helpers/strategy/validators.ts`

```typescript
import { AudienceSegment } from '../../types/brand-profile-v5.ts'

export function validateSegmentForAngle(
  angle: any,
  segment: AudienceSegment | null
): ValidationResult {
  if (!segment) {
    return { valid: true, warnings: ['No segment matched - using generic'] }
  }
  
  const warnings: string[] = []
  const errors: string[] = []
  
  // Check 1: Does angle's goal_mode match segment's goal_contribution?
  if (angle.goal_mode !== segment.goal_contribution) {
    warnings.push(
      `Goal mismatch: Angle wants ${angle.goal_mode} but segment contributes to ${segment.goal_contribution}`
    )
  }
  
  // Check 2: Does angle's content_category align with segment's content_angles?
  const angleMatches = segment.content_angles.some(sa => 
    angle.content_direction.toLowerCase().includes(sa.toLowerCase().slice(0, 8))
  )
  
  if (!angleMatches) {
    warnings.push(
      `Content angle mismatch: Angle direction doesn't reference segment angles: ${segment.content_angles.join(', ')}`
    )
  }
  
  // Check 3: Evidence validation (if programme is brunch, check evidence)
  if (isBrunchProgramme(angle.programme)) {
    const hasBrunchEvidence = segment.evidence.some(e => 
      e.toLowerCase().includes('brunch')
    )
    if (!hasBrunchEvidence) {
      errors.push('Brunch programme but no brunch evidence in segment')
    }
  }
  
  return {
    valid: errors.length === 0,
    warnings,
    errors
  }
}
```

### Step 2.4: Testing Protocol

**Test Case 1: Saturday Brunch Post**
```typescript
// Input:
weekStart: '2026-05-10'  // Saturday
currentDay: 6  // Saturday
currentHour: 11

// Expected V5 behavior:
// 1. getActiveSegment() returns "Weekend-brunch-gæster"
// 2. Phase 1 Slot A uses segment's content_angles
// 3. Angle includes "social brunch-oplevelse"
// 4. No mention of "morgenmad"

// Validation:
const result = await generateWeeklyStrategy(businessId, weekStart)
assert(result.angles[0].content_direction.includes('social'))
assert(!result.angles[0].content_direction.includes('morgenmad'))
```

**Test Case 2: Monday Lunch Post**
```typescript
// Input:
weekStart: '2026-05-05'  // Monday
currentDay: 1  // Monday
currentHour: 12

// Expected V5 behavior:
// 1. getActiveSegment() returns "Frokost-pendlere" (if exists)
// 2. Motivation: "convenience"
// 3. CTA style: "hard_urgency" (not relaxed)

// Validation:
const result = await generateWeeklyStrategy(businessId, weekStart)
const mondayAngle = result.angles.find(a => a.suggested_day.includes('05'))
assert(mondayAngle.cta_style === 'hard_urgency')
```

### Step 2.5: Deployment & Rollout

**Day 1-2: Test Business Only**
```bash
V5_LAYER4_ENABLED=true
V5_TEST_BUSINESS_ONLY=true
```

**Day 3-4: Compare Outputs**
- Generate 3 weekly strategies with V5
- Generate 3 with legacy (flag off)
- Manual review: Which has better audience targeting?

**Day 5: Decision**
- If V5 shows >30% improvement in audience relevance → Keep enabled
- If quality neutral or worse → Rollback

---

## Phase 3: Content Quality Rules

**Duration:** Week 3 (5 days)  
**Risk:** Low  
**Goal:** Enforce brunch terminology and factual constraints

### Step 3.1: Brunch/Breakfast Rule Enforcement

**File:** `supabase/functions/_shared/post-helpers/strategy/phase2/phase2b.ts`

```typescript
import { isBrunchProgramme, enforceBrunchTerminology } from '../../../utils/v5-helpers.ts'

// In Phase 2b post detail generation
export async function generatePostDetail(
  slot: any,
  context: WeekContext,
  segment: AudienceSegment | null
): Promise<PostDetail> {
  // Build prompt
  let prompt = buildPostDetailPrompt(slot, context, segment)
  
  // Add brunch rule if applicable
  if (segment && isBrunchProgramme(slot.programme_name)) {
    prompt += `\n
═══════════════════════════════════════════════════════════════
⚠️ CRITICAL RULE: BRUNCH TERMINOLOGY
═══════════════════════════════════════════════════════════════

This is a BRUNCH programme (NOT breakfast/morgenmad).

REQUIRED:
✅ Use "brunch" in all references
✅ Frame as social gathering (not quick convenience)
✅ Timing: 10:00-14:00 window (NOT 07:00-09:00)
✅ Motivation: leisurely experience (NOT before-work rush)

FORBIDDEN:
❌ Never say "morgenmad" (breakfast ≠ brunch in Denmark)
❌ Never say "hurtig morgenmad"
❌ Never say "før arbejde" (before work)
❌ Never frame as convenience (it's experience_seeking)

Segment motivation for this programme: ${segment.motivation}
Evidence: ${segment.evidence.join(', ')}
    `
  }
  
  // Call AI
  const rawDetail = await callAI(prompt)
  
  // Post-process: enforce brunch terminology
  const cleanedDetail = {
    ...rawDetail,
    title: enforceBrunchTerminology(rawDetail.title, isBrunchProgramme(slot.programme_name)),
    rationale: enforceBrunchTerminology(rawDetail.rationale, isBrunchProgramme(slot.programme_name)),
    media_direction: enforceBrunchTerminology(rawDetail.media_direction, isBrunchProgramme(slot.programme_name))
  }
  
  return cleanedDetail
}
```

### Step 3.2: Location Consistency Enforcement

```typescript
// Extract local_location_reference from Layer 3
const locationReference = context.v5Profile?.local_location_reference || null

if (locationReference) {
  prompt += `\n
═══════════════════════════════════════════════════════════════
LOCATION NAMING RULE
═══════════════════════════════════════════════════════════════

When mentioning location, use ONLY this exact phrase:
"${locationReference}"

CORRECT: "café ${locationReference}", "beliggenhed ${locationReference}"
WRONG: Adding city name, adding specifics, changing wording

This ensures brand consistency across all posts.
  `
}
```

### Step 3.3: Testing

**Test: Brunch Post Generation**
```typescript
const result = await generatePostDetail({
  programme_name: 'Morgenmad/Brunch',
  timing_window: 'Lør-Søn 10:00-14:00',
  ...
}, context, segment)

// Assertions
assert(!result.title.includes('morgenmad'))
assert(result.title.includes('brunch'))
assert(!result.rationale.includes('før arbejde'))
assert(result.rationale.includes(segment.motivation))
```

---

## Phase 4: Evidence Validation & Cleanup

**Duration:** Week 4 (5 days)  
**Risk:** Low  
**Goal:** Add evidence-based validation gates

### Step 4.1: Evidence Checker

**File:** `supabase/functions/_shared/utils/evidence-validator.ts`

```typescript
export function validateEvidence(
  claim: string,
  evidence: string[],
  context: any
): boolean {
  // Check if claim is supported by evidence
  
  // Example: Claim "børnevenlig menu"
  // Evidence must contain "børneportioner" or similar
  
  const claimLower = claim.toLowerCase()
  
  // Family-friendly claims
  if (claimLower.includes('familie') || claimLower.includes('børn')) {
    return evidence.some(e => 
      e.toLowerCase().includes('børn') ||
      e.toLowerCase().includes('familie') ||
      e.toLowerCase().includes('kids')
    )
  }
  
  // Outdoor claims
  if (claimLower.includes('terrasse') || claimLower.includes('udendørs')) {
    return evidence.some(e =>
      e.toLowerCase().includes('terrasse') ||
      e.toLowerCase().includes('outdoor') ||
      e.toLowerCase().includes('udendørs')
    )
  }
  
  // Location claims
  if (claimLower.includes('ved åen') || claimLower.includes('ved vandet')) {
    return evidence.some(e =>
      e.toLowerCase().includes('ved åen') ||
      e.toLowerCase().includes('waterfront') ||
      context.locationIntelligence?.landmarks?.includes('water')
    )
  }
  
  // Default: allow if no specific pattern matched
  return true
}
```

### Step 4.2: Integrate into Angle Validation

```typescript
// In Phase 1, after AI generates angles
for (const angle of angles) {
  if (segment && segment.evidence) {
    // Validate angle claims against segment evidence
    const isSupported = validateEvidence(
      angle.content_direction,
      segment.evidence,
      context
    )
    
    if (!isSupported) {
      console.warn('[V5-EVIDENCE] Unsupported claim in angle:', {
        claim: angle.content_direction,
        evidence: segment.evidence
      })
      
      // Add warning to angle metadata
      angle.validation_warnings = angle.validation_warnings || []
      angle.validation_warnings.push('Claim may not be supported by evidence')
    }
  }
}
```

---

## Testing Strategy

### Unit Tests

**File:** `tests/v5-helpers.test.ts`

```typescript
import { assertEquals } from "https://deno.land/std/testing/asserts.ts"
import { parseTimingWindow, matchesCurrentTime } from '../supabase/functions/_shared/utils/v5-helpers.ts'

Deno.test("parseTimingWindow - weekend range", () => {
  const result = parseTimingWindow("Lør-Søn 10:00-14:00")
  assertEquals(result?.daysOfWeek, [6, 0])
  assertEquals(result?.startHour, 10)
  assertEquals(result?.endHour, 14)
})

Deno.test("matchesCurrentTime - Saturday 11:00 matches weekend brunch", () => {
  const window = parseTimingWindow("Lør-Søn 10:00-14:00")!
  const matches = matchesCurrentTime(window, 6, 11)
  assertEquals(matches, true)
})

Deno.test("matchesCurrentTime - Monday 11:00 does NOT match weekend brunch", () => {
  const window = parseTimingWindow("Lør-Søn 10:00-14:00")!
  const matches = matchesCurrentTime(window, 1, 11)
  assertEquals(matches, false)
})

Deno.test("isBrunchProgramme - detects brunch correctly", () => {
  assertEquals(isBrunchProgramme("Morgenmad/Brunch"), true)
  assertEquals(isBrunchProgramme("Brunch"), true)
  assertEquals(isBrunchProgramme("Frokost"), false)
})
```

Run: `deno test tests/v5-helpers.test.ts`

### Integration Tests

**File:** `tests/integration/weekly-plan-v5.test.ts`

```typescript
Deno.test("Weekly Plan V5 - Café Faust brunch Saturday", async () => {
  const result = await callWeeklyStrategy({
    businessId: CAFE_FAUST_ID,
    weekStart: '2026-05-10'  // Saturday
  })
  
  // V5 should be used
  assertEquals(result.metadata.v5_enabled, true)
  
  // Should have Layer 3 data
  assert(result.brand_essence.includes('ved åen'))
  
  // Should have Layer 4 segments
  assert(result.segments_used.length > 0)
  
  // Should NOT say "morgenmad"
  const allText = JSON.stringify(result.angles)
  assertEquals(allText.includes('morgenmad'), false)
  
  // Should say "brunch"
  assert(allText.includes('brunch'))
})
```

### Manual QA Checklist

**For Each Phase:**

- [ ] Deploy with flag OFF
- [ ] Verify no errors in logs
- [ ] Enable flag for test business
- [ ] Generate 3 weekly strategies
- [ ] Compare with legacy output
- [ ] Check for:
  - [ ] Brand voice consistency
  - [ ] Factual accuracy (no hallucinations)
  - [ ] Audience targeting relevance
  - [ ] Brunch terminology (if applicable)
  - [ ] Location naming consistency
  - [ ] No null pointer exceptions
  - [ ] Proper fallbacks triggered

---

## Rollback Procedures

### Immediate Rollback (Emergency)

**If production breaks:**

```bash
# 1. Disable all V5 flags (Supabase Dashboard → Settings → Edge Functions → Secrets)
V5_ENABLED=false

# 2. Redeploy (picks up new env vars)
supabase functions deploy get-weekly-strategy --project-ref kvqdkohdpvmdylqgujpn
supabase functions deploy generate-weekly-plan --project-ref kvqdkohdpvmdylqgujpn

# 3. Verify legacy system working
curl -X POST https://[project].supabase.co/functions/v1/get-weekly-strategy \
  -H "Authorization: Bearer [key]" \
  -d '{"businessId":"...","weekStart":"2026-05-10"}'

# System should respond normally with legacy data
```

### Partial Rollback (One Phase)

**If Phase 2 (Layer 4) has issues but Phase 1 (Layer 3) works:**

```bash
# Keep Layer 3, disable Layer 4
V5_ENABLED=true
V5_LAYER3_ENABLED=true
V5_LAYER4_ENABLED=false  # Rollback just this phase
```

### Git Rollback

```bash
# If code needs reverting
git revert [commit-hash]
git push

# Redeploy
supabase functions deploy get-weekly-strategy
```

---

## Success Metrics

### Phase 1: Layer 3 Integration

**Target Metrics:**
- ✅ 95%+ brand voice consistency (all posts use same brand_essence phrasing)
- ✅ 100% location naming consistency (all use local_location_reference)
- ✅ Core values referenced in ≥50% of angles
- ✅ Zero null pointer exceptions

**Measurement:**
```sql
-- Check brand voice consistency
SELECT 
  business_id,
  COUNT(DISTINCT brand_essence_used) as essence_variations,
  COUNT(*) as total_strategies
FROM weekly_strategies
WHERE created_at > NOW() - INTERVAL '7 days'
  AND v5_enabled = true
GROUP BY business_id
HAVING COUNT(DISTINCT brand_essence_used) > 1
```

### Phase 2: Layer 4 Integration

**Target Metrics:**
- ✅ 80%+ angles matched to specific segment (not generic)
- ✅ 90%+ segment motivation alignment (angle matches segment motivation)
- ✅ 70%+ content angle usage (angle uses segment's content_angles)

**Measurement:**
```sql
-- Check segment matching rate
SELECT 
  COUNT(*) FILTER (WHERE segment_matched IS NOT NULL) * 100.0 / COUNT(*) as match_rate
FROM weekly_strategy_angles
WHERE created_at > NOW() - INTERVAL '7 days'
  AND v5_layer4_enabled = true
```

### Phase 3: Quality Rules

**Target Metrics:**
- ✅ 0 instances of "morgenmad" in brunch programme posts
- ✅ 100% brunch posts use "brunch" terminology
- ✅ 100% location mentions use exact local_location_reference

**Measurement:**
```typescript
// Automated scan
const violations = await scanForViolations({
  checkBrunchTerminology: true,
  checkLocationConsistency: true,
  dateRange: '7 days'
})

console.log('Violations found:', violations.length)
// Target: 0
```

### Phase 4: Evidence Validation

**Target Metrics:**
- ✅ 95%+ claims supported by evidence
- ✅ 0 hallucinated facilities
- ✅ <5% validation warnings

**Measurement:**
```sql
SELECT 
  COUNT(*) FILTER (WHERE validation_warnings IS NOT NULL) * 100.0 / COUNT(*) as warning_rate
FROM daily_suggestions
WHERE created_at > NOW() - INTERVAL '7 days'
  AND source = 'weekly_plan'
  AND v5_evidence_enabled = true
```

---

## Timeline Summary

| Week | Phase | Risk | Deliverable |
|------|-------|------|-------------|
| **0** | Preparation | Low | Types, utils, feature flags, data audit |
| **1** | Layer 3 Integration | Low | Brand identity in Phase 1 prompts |
| **2** | Layer 4 Segments | Medium | Programme-specific audience matching |
| **3** | Quality Rules | Low | Brunch/location enforcement |
| **4** | Evidence Validation | Low | Fact-checking gates |

**Total:** 4-5 weeks from start to full V5 integration

---

## Decision Gates

After each phase, assess:

1. **Quality Improvement:** Did output quality increase? (manual review + metrics)
2. **Stability:** Any production incidents? Error rate spike?
3. **Data Coverage:** What % of businesses have V5 data?

**GO Decision:** Quality ↑, Stability OK, Coverage >50%  
**NO-GO Decision:** Quality ↓, Stability issues, Coverage <20%

If NO-GO → Rollback and reassess approach.

---

## Next Steps

**Immediate Actions:**

1. [ ] Review this implementation plan
2. [ ] Adjust timeline if needed
3. [ ] Create feature flag environment variables in Supabase
4. [ ] Run data quality audit (Step 0.1)
5. [ ] Create types file (Step 0.2)
6. [ ] Implement timing window parser (Step 0.3)
7. [ ] Write unit tests for parser
8. [ ] Schedule Phase 1 kickoff

**Questions to Resolve:**

- Preferred testing business IDs (beyond Café Faust)?
- Acceptable quality improvement threshold to proceed to next phase?
- Logging retention period for comparison data?
- Manual review process owner?

---

**End of Implementation Plan**
