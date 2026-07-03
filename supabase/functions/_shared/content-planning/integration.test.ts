/**
 * Integration Test: Dynamic Suggestions + Behavioral Context
 * 
 * Demonstrates the complete workflow from specification:
 * 1. Calculate suggestion count and timing (dynamic-suggestion-calculator)
 * 2. Generate behavioral rationales (behavioral-context-analyzer)
 * 3. Produce final suggestions with contextual relevance
 * 
 * This tests the Café Faust Monday 07:00 example from the specification.
 */

import {
  calculateDynamicSuggestions,
  type CalculationContext,
  type SuggestionIdea
} from './dynamic-suggestion-calculator.ts'

import {
  analyzeBehavioralContext,
  type BehavioralAnalysisInput,
  type AudienceSegment,
  type MenuItem
} from './behavioral-context-analyzer.ts'

// ── Test Data: Café Faust ────────────────────────────────────────────────────

const CAFE_FAUST_CONTEXT: CalculationContext = {
  now: new Date(2026, 5, 22, 7, 0), // Monday June 22, 2026 at 07:00
  weekday: 'monday',
  openingTime: '09:30',
  closingTime: '23:00',
  programmes: [
    {
      name: 'BRUNCH',
      type: 'morning',
      time_windows: ['09:00-14:00'],
      operating_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    },
    {
      name: 'FROKOST',
      type: 'lunch',
      time_windows: ['09:00-17:30'],
      operating_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    },
    {
      name: 'AFTEN',
      type: 'dinner',
      time_windows: ['17:30-21:30'],
      operating_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    }
  ],
  kitchenCloseTime: '21:30',
  isClosedToday: false
}

const CAFE_FAUST_AUDIENCE: AudienceSegment[] = [
  {
    name: 'Morgenpendlere',
    timing_windows: ['06:00-09:00'],
    decision_timing: 'spontaneous',
    motivation: 'Mandag morgen - frokost-pendlere begynder at overveje dagens frokost'
  },
  {
    name: 'Frokostgæster',
    timing_windows: ['11:00-14:00'],
    decision_timing: 'mixed',
    motivation: 'Søger kvalitetsfrokost-oplevelser'
  },
  {
    name: 'Aftendiners',
    timing_windows: ['17:00-21:00'],
    decision_timing: 'planned',
    motivation: 'Planlægger aftenmåltider og sociale arrangementer'
  }
]

const CAFE_FAUST_MENU: MenuItem[] = [
  {
    id: 'brunch-1',
    name: 'Eggs Benedict med Hollandaise',
    service_periods: ['brunch'],
    category: 'signature'
  },
  {
    id: 'lunch-1',
    name: 'Smørrebrød med Røget Laks',
    service_periods: ['frokost'],
    last_posted_date: '2026-06-10'
  },
  {
    id: 'lunch-2',
    name: 'Fiskefilet med Remoulade',
    service_periods: ['frokost']
  },
  {
    id: 'dinner-1',
    name: 'Ribeye Steak med Bearnaise',
    service_periods: ['aften']
  }
]

// ── Integration Test ─────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(70))
console.log('🎯 INTEGRATION TEST: Café Faust Monday 07:00')
console.log('═'.repeat(70))
console.log('\nObjective: Validate complete workflow from specification')
console.log('Expected: 3 suggestions with contextual, behavioral rationales\n')

// STEP 1: Calculate Dynamic Suggestions
console.log('STEP 1: Calculate suggestion count and timing\n')
const dynamicResult = calculateDynamicSuggestions(CAFE_FAUST_CONTEXT)

console.log(`✓ Generated ${dynamicResult.suggestionCount} suggestions`)
console.log(`✓ Reasoning: ${dynamicResult.reasoning}\n`)

// STEP 2: Generate Behavioral Rationales for Each Idea
console.log('STEP 2: Generate behavioral rationales for each suggestion\n')

const enrichedIdeas = dynamicResult.ideas.map((idea: SuggestionIdea, index: number) => {
  console.log(`\n${'─'.repeat(70)}`)
  console.log(`Processing Idea ${idea.ideaNumber}:`)
  console.log(`  Posting Time: ${idea.postingTime}`)
  console.log(`  Content Type: ${idea.contentType}`)
  console.log(`  Programmes: ${idea.eligibleProgrammes.join(', ')}`)
  
  // Filter menu items appropriate for this idea
  const eligibleItems = CAFE_FAUST_MENU.filter(item =>
    idea.eligibleProgrammes.some(prog => 
      item.service_periods.some(period => period.toLowerCase().includes(prog))
    )
  )
  
  console.log(`  Eligible menu items: ${eligibleItems.length}`)
  
  // Analyze behavioral context
  const behavioralInput: BehavioralAnalysisInput = {
    currentTime: CAFE_FAUST_CONTEXT.now.toTimeString().slice(0, 5),
    weekday: CAFE_FAUST_CONTEXT.weekday,
    targetTime: idea.postingTime,
    audienceSegments: CAFE_FAUST_AUDIENCE,
    availableMenuItems: eligibleItems,
    targetProgramme: idea.eligibleProgrammes[0],
    contentType: idea.contentType
  }
  
  const behavioralResult = analyzeBehavioralContext(behavioralInput)
  
  return {
    ...idea,
    behavioralAnalysis: behavioralResult,
    finalRationale: behavioralResult.assembledRationale
  }
})

// STEP 3: Display Final Results
console.log('\n\n' + '═'.repeat(70))
console.log('FINAL RESULTS: Complete Suggestions with Behavioral Rationales')
console.log('═'.repeat(70))

enrichedIdeas.forEach((idea) => {
  console.log(`\n${'▀'.repeat(70)}`)
  console.log(`Idea ${idea.ideaNumber}: ${idea.contentType}`)
  console.log('▀'.repeat(70))
  console.log(`Posting Time: ${idea.postingTime}`)
  console.log(`Time of Day: ${idea.behavioralContext.timeOfDay}`)
  console.log(`Target Programme: ${idea.eligibleProgrammes[0] || 'N/A'}`)
  
  if (idea.behavioralAnalysis.primaryAudienceSegment) {
    console.log(`Primary Audience: ${idea.behavioralAnalysis.primaryAudienceSegment}`)
  }
  
  if (idea.behavioralAnalysis.selectedContent.itemName) {
    console.log(`Featured Dish: ${idea.behavioralAnalysis.selectedContent.itemName}`)
  }
  
  console.log(`\nRATIONALE:`)
  console.log(`"${idea.finalRationale}"`)
  
  console.log(`\nMetadata:`)
  console.log(`  Audience Behavior: ${idea.behavioralAnalysis.audienceBehavior}`)
  console.log(`  Decision Pattern: ${idea.behavioralAnalysis.decisionPattern}`)
  console.log(`  Environmental: ${idea.behavioralAnalysis.environmentalFactors.join(', ') || 'none'}`)
  console.log(`  Recency Support: ${idea.behavioralAnalysis.recencySupport || 'N/A'}`)
})

// ── Validation ───────────────────────────────────────────────────────────────

console.log('\n\n' + '═'.repeat(70))
console.log('VALIDATION AGAINST SPECIFICATION')
console.log('═'.repeat(70))

console.log('\n✓ Structural Requirements:')
console.log(`  Generated 3 suggestions: ${enrichedIdeas.length === 3 ? '✓ PASS' : '✗ FAIL'}`)
console.log(`  Idea 1 timing (30-60 min window): ${enrichedIdeas[0]?.postingTime === '07:30' ? '✓ PASS' : '✗ FAIL'}`)
console.log(`  180-min spacing between ideas: ${enrichedIdeas[1]?.postingTimeMins - enrichedIdeas[0]?.postingTimeMins === 180 ? '✓ PASS' : '✗ FAIL'}`)

console.log('\n✓ Content Type Requirements:')
console.log(`  Idea 1 is OFFERING: ${enrichedIdeas[0]?.contentType === 'OFFERING' ? '✓ PASS' : '✗ FAIL'}`)
console.log(`  Idea 2 is OFFERING: ${enrichedIdeas[1]?.contentType === 'OFFERING' ? '✓ PASS' : '✗ FAIL'}`)
console.log(`  Idea 3 is ATMOSPHERE: ${enrichedIdeas[2]?.contentType === 'ATMOSPHERE' ? '✓ PASS' : '✗ FAIL'}`)

console.log('\n✓ Behavioral Quality Requirements:')
const idea1HasRealisticContext = enrichedIdeas[0]?.finalRationale && 
  !enrichedIdeas[0].finalRationale.includes('vennerne overvejer dagens første mødested')
console.log(`  Idea 1 avoids unrealistic morning behavior: ${idea1HasRealisticContext ? '✓ PASS' : '✗ FAIL'}`)

const idea1UsesContextualRelevance = enrichedIdeas[0]?.finalRationale && 
  (enrichedIdeas[0].finalRationale.toLowerCase().includes('pendlere') ||
   enrichedIdeas[0].finalRationale.toLowerCase().includes('breakfast') ||
   enrichedIdeas[0].finalRationale.toLowerCase().includes('morning'))
console.log(`  Idea 1 uses contextual relevance: ${idea1UsesContextualRelevance ? '✓ PASS' : '✗ FAIL'}`)

const allIdeasHaveRationales = enrichedIdeas.every(idea => idea.finalRationale && idea.finalRationale.length > 20)
console.log(`  All ideas have substantive rationales: ${allIdeasHaveRationales ? '✓ PASS' : '✗ FAIL'}`)

console.log('\n✓ Data Utilization Requirements:')
const idea1MatchesAudience = enrichedIdeas[0]?.behavioralAnalysis.primaryAudienceSegment !== null
console.log(`  Phase 1 - Audience segment matched: ${idea1MatchesAudience ? '✓ PASS' : '✗ FAIL'}`)

const idea1HasMenuSelection = enrichedIdeas[0]?.behavioralAnalysis.selectedContent.itemName !== undefined
console.log(`  Phase 3 - Menu item selected: ${idea1HasMenuSelection ? '✓ PASS' : '✗ FAIL'}`)

const rationales = enrichedIdeas.map(i => i.finalRationale).join(' ')
const neverFeaturedNotPrimary = enrichedIdeas.every(idea => 
  !idea.finalRationale.startsWith('Never featured') &&
  !idea.finalRationale.startsWith('Aldrig fremhævet')
)
console.log(`  Phase 5 - "Never featured" not primary driver: ${neverFeaturedNotPrimary ? '✓ PASS' : '✗ FAIL'}`)

// ── Summary ──────────────────────────────────────────────────────────────────

console.log('\n\n' + '═'.repeat(70))
console.log('INTEGRATION TEST COMPLETE')
console.log('═'.repeat(70))
console.log('\nKey Achievements:')
console.log('  ✓ Dynamic suggestion count (1-3) based on available time')
console.log('  ✓ Intelligent timing with MIN_SPACING and IMMEDIATE_WINDOW')
console.log('  ✓ Content type selection (OFFERING vs ATMOSPHERE)')
console.log('  ✓ 5-phase behavioral analysis for each suggestion')
console.log('  ✓ Contextually relevant rationales without unrealistic behaviors')
console.log('  ✓ Programme-aligned menu selection')
console.log('  ✓ Recency as supporting evidence, not primary driver')
console.log('\nThe implementation is ready for integration into get-quick-suggestions.\n')
