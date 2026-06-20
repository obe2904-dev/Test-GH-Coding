// ============================================================
// COMMERCIAL MODE SYSTEM - TESTS
// ============================================================
// Test suite for commercial mode classifier and validation.
// Run with: deno test --allow-env commercial-mode.test.ts
//
// Generated: 5. maj 2026
// ============================================================

import { assertEquals, assertExists } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { classifyCommercialMode, __testing as classifierTesting } from './commercial-mode-classifier.ts';
import { validateCommercialStrategy, __testing as validationTesting } from './commercial-validation.ts';
import type { ClassifierContext, CommercialMode } from './types/commercial-mode-types.ts';

// ============================================================
// TEST DATA
// ============================================================

const mockBusinessConfig = {
  booking_push_restaurant: {
    business_id: 'test-1',
    commercial_baseline_mode: 'booking_push' as CommercialMode,
    has_reservation_system: true,
    business_type: 'FSE',
    trigger_configuration: {
      VD_WEEK: {
        enabled: true,
        mode: 'booking_push' as CommercialMode,
        min_booking_ideas: 4,
        min_footfall_ideas: 1,
        reasoning: 'Fine dining - Valentine\'s is critical'
      },
      MD_WEEK: {
        enabled: true,
        mode: 'booking_push' as CommercialMode,
        min_booking_ideas: 3,
        min_footfall_ideas: 1
      }
    }
  },
  footfall_cafe: {
    business_id: 'test-2',
    commercial_baseline_mode: 'footfall_push' as CommercialMode,
    has_reservation_system: false,
    business_type: 'SBO_coffee',
    trigger_configuration: {
      WEATHER_BREAK: {
        enabled: true,
        mode: 'footfall_push' as CommercialMode,
        min_booking_ideas: 0,
        min_footfall_ideas: 5,
        priority: 95
      },
      FIRST_WEEKEND: {
        enabled: true,
        mode: 'footfall_push' as CommercialMode,
        min_footfall_ideas: 4
      }
    }
  }
};

// ============================================================
// CLASSIFIER TESTS
// ============================================================

Deno.test('Classifier: Valentine\'s Week detection', () => {
  const context: ClassifierContext = {
    business_id: 'test-1',
    week_start: new Date(2026, 1, 9), // Feb 9, 2026 (Monday of Valentine's week)
    week_end: new Date(2026, 1, 15),
    business_type: 'FSE',
    has_reservation_system: true,
    commercial_baseline_mode: 'booking_push',
    trigger_configuration: mockBusinessConfig.booking_push_restaurant.trigger_configuration,
    contextual_calendar: [],
    week_number: 7,
    month: 2,
    first_weekend_of_month: false,
    is_payday_period: false
  };
  
  const result = classifyCommercialMode(context);
  
  assertEquals(result.commercial_mode, 'booking_push');
  assertEquals(result.min_booking_ideas, 4);
  assertEquals(result.triggered_by.includes('VD_WEEK'), true);
  assertExists(result.trigger_reason);
  console.log('  ✓ Valentine\'s Week correctly detected and configured');
});

Deno.test('Classifier: Weather trigger for outdoor café', () => {
  const context: ClassifierContext = {
    business_id: 'test-2',
    week_start: new Date(2026, 3, 13), // April 13, 2026
    week_end: new Date(2026, 3, 19),
    business_type: 'SBO_coffee',
    has_reservation_system: false,
    commercial_baseline_mode: 'footfall_push',
    trigger_configuration: mockBusinessConfig.footfall_cafe.trigger_configuration,
    contextual_calendar: [],
    weather_forecast: [
      { date: new Date(2026, 3, 15), temp_high: 22, conditions: 'sunny' }
    ],
    week_number: 16,
    month: 4,
    first_weekend_of_month: false,
    is_payday_period: false
  };
  
  const result = classifyCommercialMode(context);
  
  assertEquals(result.commercial_mode, 'footfall_push');
  assertEquals(result.min_footfall_ideas, 5);
  assertEquals(result.triggered_by.includes('WEATHER_BREAK'), true);
  console.log('  ✓ Weather trigger correctly activated for warm day');
});

Deno.test('Classifier: Baseline mode when no triggers active', () => {
  const context: ClassifierContext = {
    business_id: 'test-1',
    week_start: new Date(2026, 6, 20), // July 20, 2026 (no special events)
    week_end: new Date(2026, 6, 26),
    business_type: 'FSE',
    has_reservation_system: true,
    commercial_baseline_mode: 'booking_push',
    trigger_configuration: mockBusinessConfig.booking_push_restaurant.trigger_configuration,
    contextual_calendar: [],
    week_number: 30,
    month: 7,
    first_weekend_of_month: false,
    is_payday_period: false
  };
  
  const result = classifyCommercialMode(context);
  
  assertEquals(result.commercial_mode, 'booking_push'); // Uses baseline
  assertEquals(result.triggered_by.includes('QUIET_WEEK'), true);
  console.log('  ✓ Baseline mode used when no triggers active');
});

Deno.test('Classifier: Local high-commercial event', () => {
  const context: ClassifierContext = {
    business_id: 'test-1',
    week_start: new Date(2026, 5, 8), // June 8, 2026
    week_end: new Date(2026, 5, 14),
    business_type: 'FSE',
    has_reservation_system: true,
    commercial_baseline_mode: 'balanced',
    trigger_configuration: {
      LOCAL_EVENT: {
        enabled: true,
        mode: 'context_dependent' as CommercialMode
      }
    },
    contextual_calendar: [
      {
        date: new Date(2026, 5, 12),
        event: 'Copenhagen Jazz Festival Opening',
        commercial_weight: 9,
        booking_relevance: 8
      }
    ],
    week_number: 24,
    month: 6,
    first_weekend_of_month: false,
    is_payday_period: false
  };
  
  const result = classifyCommercialMode(context);
  
  assertEquals(result.commercial_mode, 'booking_push'); // Context-dependent resolved to booking
  assertEquals(result.triggered_by.includes('LOCAL_EVENT'), true);
  console.log('  ✓ High commercial event correctly triggered booking mode');
});

// ============================================================
// VALIDATION TESTS
// ============================================================

Deno.test('Validation: Well-formed commercial strategy passes', () => {
  const mockIdeas = [
    {
      id: 1,
      title: 'Book your Valentine\'s table now',
      commercial_intent: 'booking',
      cta_type: 'reserve_table',
      timing_window: 'this_week',
      conversion_hook: 'Kun 15 borde tilbage til Valentine\'s - book nu',
      expected_outcome: 'table_reservation'
    },
    {
      id: 2,
      title: 'Weekend brunch special',
      commercial_intent: 'footfall',
      cta_type: 'visit_this_weekend',
      timing_window: 'this_weekend',
      conversion_hook: 'Ny brunch menu kun denne weekend',
      expected_outcome: 'walk_in_visit'
    },
    {
      id: 3,
      title: 'Valentine\'s menu reveal',
      commercial_intent: 'booking',
      cta_type: 'reserve_table',
      timing_window: 'this_week',
      conversion_hook: '4-retters menu til 495 kr - begrænsede pladser',
      expected_outcome: 'table_reservation'
    },
    {
      id: 4,
      title: 'Try our new dessert',
      commercial_intent: 'footfall',
      cta_type: 'try_new_item',
      timing_window: 'this_week',
      conversion_hook: 'Eksklusiv chokolade creation - kun denne uge',
      expected_outcome: 'walk_in_visit'
    },
    {
      id: 5,
      title: 'Reserve for the 14th',
      commercial_intent: 'booking',
      cta_type: 'reserve_table',
      timing_window: 'today',
      conversion_hook: 'Sidste ledige borde til Valentine\'s aften - book i dag',
      expected_outcome: 'table_reservation'
    }
  ];
  
  const directive = {
    commercial_mode: 'booking_push' as CommercialMode,
    trigger_reason: 'Valentine\'s Week',
    triggered_by: ['VD_WEEK'],
    min_booking_ideas: 3,
    min_footfall_ideas: 1,
    required_cta_types: ['reserve_table', 'book_appointment'],
    timing_urgency: 'this_week' as const
  };
  
  const result = validateCommercialStrategy(mockIdeas, directive, true);
  
  assertEquals(result.passed, true);
  assertEquals(result.booking_ideas_count >= 3, true);
  assertEquals(result.score >= 3.5, true);
  assertEquals(result.quota_met, true);
  console.log(`  ✓ Well-formed strategy passed validation (score: ${result.score.toFixed(1)})`);
});

Deno.test('Validation: Insufficient booking ideas fails', () => {
  const mockIdeas = [
    {
      id: 1,
      title: 'Visit us today',
      commercial_intent: 'footfall',
      cta_type: 'visit_today',
      timing_window: 'today',
      conversion_hook: 'Come see our new interior',
      expected_outcome: 'walk_in_visit'
    },
    {
      id: 2,
      title: 'Check our menu',
      commercial_intent: 'brand',
      cta_type: 'check_menu',
      timing_window: 'ongoing',
      conversion_hook: 'New items available',
      expected_outcome: 'brand_awareness'
    }
  ];
  
  const directive = {
    commercial_mode: 'booking_push' as CommercialMode,
    trigger_reason: 'Valentine\'s Week',
    triggered_by: ['VD_WEEK'],
    min_booking_ideas: 3,
    min_footfall_ideas: 1,
    required_cta_types: ['reserve_table'],
    timing_urgency: 'this_week' as const
  };
  
  const result = validateCommercialStrategy(mockIdeas, directive, true);
  
  assertEquals(result.passed, false);
  assertEquals(result.quota_met, false);
  assertEquals(result.issues.length > 0, true);
  assertEquals(result.issues[0].includes('Insufficient booking ideas'), true);
  console.log('  ✓ Insufficient quota correctly fails validation');
});

Deno.test('Validation: Low clarity scores fail', () => {
  const mockIdeas = [
    {
      id: 1,
      title: 'Generic post',
      commercial_intent: 'brand',
      // Missing CTA, timing, and hook
    },
    {
      id: 2,
      title: 'Another generic post',
      commercial_intent: 'booking',
      cta_type: 'browse_offerings', // Weak CTA
      timing_window: 'ongoing', // No urgency
      conversion_hook: 'We exist' // Weak hook
    }
  ];
  
  const directive = {
    commercial_mode: 'balanced' as CommercialMode,
    trigger_reason: 'Baseline',
    triggered_by: ['QUIET_WEEK'],
    min_booking_ideas: 1,
    min_footfall_ideas: 1,
    required_cta_types: ['visit_this_week'],
    timing_urgency: 'flexible' as const
  };
  
  const result = validateCommercialStrategy(mockIdeas, directive, true);
  
  assertEquals(result.passed, false);
  assertEquals(result.score < 3.5, true);
  console.log(`  ✓ Low clarity score correctly fails (score: ${result.score.toFixed(1)})`);
});

Deno.test('Validation: Score calculation accuracy', () => {
  const testIdea = {
    id: 1,
    commercial_intent: 'booking',
    cta_type: 'reserve_table',
    timing_window: 'today',
    conversion_hook: 'Kun 5 ledige borde tilbage i dag - book nu eller gå glip af det'
  };
  
  const score = validationTesting.calculateIdeaScore(testIdea);
  
  // Should score 5: intent (1) + CTA (1) + timing (1) + strong hook (1) = 5
  assertEquals(score >= 4.5, true);
  assertEquals(score <= 5.0, true);
  console.log(`  ✓ Idea scoring working correctly (score: ${score})`);
});

// ============================================================
// INTEGRATION TESTS
// ============================================================

Deno.test('Integration: Full workflow for Valentine\'s Week', () => {
  // Step 1: Classify
  const classifierContext: ClassifierContext = {
    business_id: 'test-1',
    week_start: new Date(2026, 1, 9),
    week_end: new Date(2026, 1, 15),
    business_type: 'FSE',
    has_reservation_system: true,
    commercial_baseline_mode: 'booking_push',
    trigger_configuration: mockBusinessConfig.booking_push_restaurant.trigger_configuration,
    contextual_calendar: [],
    week_number: 7,
    month: 2,
    first_weekend_of_month: false,
    is_payday_period: false
  };
  
  const directive = classifyCommercialMode(classifierContext);
  
  // Step 2: Mock strategy generation (would come from AI)
  const mockStrategy = [
    {
      id: 1,
      commercial_intent: 'booking',
      cta_type: 'reserve_table',
      timing_window: 'today',
      conversion_hook: 'Valentine\'s menu udsolgt snart - book nu'
    },
    {
      id: 2,
      commercial_intent: 'booking',
      cta_type: 'reserve_table',
      timing_window: 'this_week',
      conversion_hook: 'Romantisk middag for to - kun 10 ledige borde'
    },
    {
      id: 3,
      commercial_intent: 'booking',
      cta_type: 'reserve_table',
      timing_window: 'this_week',
      conversion_hook: 'Book din Valentine\'s aften inden mandag'
    },
    {
      id: 4,
      commercial_intent: 'booking',
      cta_type: 'reserve_table',
      timing_window: 'this_week',
      conversion_hook: 'Eksklusiv 4-retters menu - begrænsede pladser'
    },
    {
      id: 5,
      commercial_intent: 'footfall',
      cta_type: 'visit_this_week',
      timing_window: 'this_week',
      conversion_hook: 'Prøv vores nye dessert menu denne uge'
    }
  ];
  
  // Step 3: Validate
  const validation = validateCommercialStrategy(mockStrategy, directive, true);
  
  // Assert full workflow success
  assertEquals(directive.commercial_mode, 'booking_push');
  assertEquals(directive.min_booking_ideas, 4);
  assertEquals(validation.booking_ideas_count, 4);
  assertEquals(validation.quota_met, true);
  assertEquals(validation.passed, true);
  
  console.log('  ✓ Full workflow completed successfully');
  console.log(`    - Mode: ${directive.commercial_mode}`);
  console.log(`    - Booking ideas: ${validation.booking_ideas_count}/${directive.min_booking_ideas}`);
  console.log(`    - Validation score: ${validation.score.toFixed(1)}/5.0`);
  console.log(`    - Status: ${validation.passed ? 'PASS' : 'FAIL'}`);
});

// ============================================================
// TEST SUMMARY
// ============================================================

console.log('\n========================================');
console.log('Commercial Mode System Tests Complete');
console.log('========================================\n');
console.log('Run these tests with:');
console.log('  deno test --allow-env commercial-mode.test.ts\n');
