#!/usr/bin/env node
/**
 * Test script for segmentation_breadth calculation
 * Validates that different business types get appropriate breadth scores
 */

// Mock the breadth calculation logic (extracted from audience-profile.ts)
function calculateSegmentationBreadth(programme, menu, operations, detectedFormat) {
  let score = 50; // Start at moderate baseline

  // FORMAT SIGNALS (±20 points)
  const broadFormats = ['ayce', 'buffet', 'brunch_buffet', 'fast_casual', 'table_grill'];
  const narrowFormats = ['tasting_menu'];
  
  if (detectedFormat && broadFormats.includes(detectedFormat)) {
    score += 20;
  } else if (detectedFormat && narrowFormats.includes(detectedFormat)) {
    score -= 20;
  }

  // PRICE POSITIONING (±15 points)
  const prices = menu.items
    .map(item => item.price)
    .filter(p => p !== null && p !== undefined);
  
  if (prices.length > 0) {
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    
    if (avgPrice < 100) score += 15;        // Budget-friendly
    else if (avgPrice < 200) score += 5;    // Affordable
    else if (avgPrice > 400) score -= 15;   // High-end
    else if (avgPrice > 250) score -= 5;    // Premium
  }

  // MENU VARIETY (±10 points)
  const itemCount = menu.items.length;
  if (itemCount >= 30) score += 10;        // Extensive variety
  else if (itemCount >= 15) score += 5;    // Good variety
  else if (itemCount < 8) score -= 10;     // Highly curated

  // OPERATIONS MODEL (±10 points)
  if (operations.accepts_walk_ins && !operations.reservation_required) {
    score += 5; // Easy access
  }
  if (operations.has_takeaway) {
    score += 5; // Broader reach
  }
  if (operations.reservation_required && !operations.accepts_walk_ins) {
    score -= 10; // Exclusive
  }

  // PROGRAMME TYPE (±10 points)
  const casualProgrammes = ['all_day', 'cafe', 'bar', 'lunch'];
  const exclusiveProgrammes = ['dinner', 'wine_bar'];
  
  if (casualProgrammes.includes(programme.programme_type)) {
    score += 5;
  } else if (exclusiveProgrammes.includes(programme.programme_type)) {
    score -= 5;
  }

  // HOURS SPAN (±5 points)
  const hoursSpan = calculateHoursSpan(programme.time_windows);
  if (hoursSpan >= 10) score += 5;  // All-day operation
  else if (hoursSpan <= 3) score -= 5;  // Limited service window

  // Clamp to 0-100
  score = Math.max(0, Math.min(100, score));

  // Map to tiers
  let tier;
  if (score <= 33) tier = 'narrow';
  else if (score >= 67) tier = 'broad';
  else tier = 'moderate';

  return { score, tier };
}

function calculateHoursSpan(timeWindows) {
  if (!timeWindows.length) return 0;

  const times = timeWindows.flatMap(window => {
    const match = window.match(/(\d{2}):(\d{2})-(\d{2}):(\d{2})/);
    if (!match) return [];
    return [
      parseInt(match[1]) * 60 + parseInt(match[2]),  // start minutes
      parseInt(match[3]) * 60 + parseInt(match[4])   // end minutes
    ];
  });

  if (times.length === 0) return 0;

  const earliest = Math.min(...times.filter((_, i) => i % 2 === 0));
  const latest = Math.max(...times.filter((_, i) => i % 2 === 1));

  return (latest - earliest) / 60;
}

// ===== TEST CASES =====

console.log('🧪 SEGMENTATION BREADTH CALCULATOR TEST\n');
console.log('═'.repeat(80));

const testCases = [
  {
    name: 'K-BBQ Silkeborg (AYCE Korean BBQ)',
    programme: {
      programme_type: 'all_day',
      time_windows: ['12:00-22:00'],
      operating_days: ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']
    },
    menu: {
      items: [
        { name: 'AYCE Menu', price: 249 },
        { name: 'AYCE Premium', price: 299 },
        { name: 'Kids AYCE', price: 149 }
      ]
    },
    operations: {
      accepts_walk_ins: true,
      reservation_required: false,
      has_table_service: true,
      has_takeaway: false
    },
    detectedFormat: 'ayce',
    expectedTier: 'broad'
  },
  {
    name: 'Michelin Fine Dining (Tasting Menu)',
    programme: {
      programme_type: 'dinner',
      time_windows: ['18:00-22:00'],
      operating_days: ['Tir', 'Ons', 'Tor', 'Fre', 'Lør']
    },
    menu: {
      items: [
        { name: '7-course tasting menu', price: 850 },
        { name: 'Wine pairing', price: 550 }
      ]
    },
    operations: {
      accepts_walk_ins: false,
      reservation_required: true,
      has_table_service: true,
      has_takeaway: false
    },
    detectedFormat: 'tasting_menu',
    expectedTier: 'narrow'
  },
  {
    name: 'Standard Italian Restaurant',
    programme: {
      programme_type: 'dinner',
      time_windows: ['17:00-22:00'],
      operating_days: ['Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']
    },
    menu: {
      items: Array.from({ length: 18 }, (_, i) => ({
        name: `Item ${i + 1}`,
        price: 150 + Math.random() * 100
      }))
    },
    operations: {
      accepts_walk_ins: true,
      reservation_required: false,
      has_table_service: true,
      has_takeaway: false
    },
    detectedFormat: 'a_la_carte',
    expectedTier: 'moderate'
  },
  {
    name: 'Casual Café (All-Day)',
    programme: {
      programme_type: 'cafe',
      time_windows: ['08:00-18:00'],
      operating_days: ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']
    },
    menu: {
      items: Array.from({ length: 35 }, (_, i) => ({
        name: `Café item ${i + 1}`,
        price: 45 + Math.random() * 80
      }))
    },
    operations: {
      accepts_walk_ins: true,
      reservation_required: false,
      has_table_service: true,
      has_takeaway: true
    },
    detectedFormat: null,
    expectedTier: 'broad'
  },
  {
    name: 'Brunch Buffet (Weekend)',
    programme: {
      programme_type: 'brunch',
      time_windows: ['10:00-15:00'],
      operating_days: ['Lør', 'Søn']
    },
    menu: {
      items: [
        { name: 'Brunch Buffet Adult', price: 189 },
        { name: 'Brunch Buffet Child', price: 95 }
      ]
    },
    operations: {
      accepts_walk_ins: true,
      reservation_required: false,
      has_table_service: true,
      has_takeaway: false
    },
    detectedFormat: 'brunch_buffet',
    expectedTier: 'broad'
  }
];

let passCount = 0;
let failCount = 0;

testCases.forEach(testCase => {
  const result = calculateSegmentationBreadth(
    testCase.programme,
    testCase.menu,
    testCase.operations,
    testCase.detectedFormat
  );

  const passed = result.tier === testCase.expectedTier;
  const icon = passed ? '✅' : '❌';
  
  if (passed) passCount++;
  else failCount++;

  console.log(`\n${icon} ${testCase.name}`);
  console.log(`   Expected: ${testCase.expectedTier.toUpperCase()}`);
  console.log(`   Got: ${result.tier.toUpperCase()} (score: ${result.score}/100)`);
  
  if (!passed) {
    console.log(`   ⚠️  MISMATCH!`);
  }

  // Show scoring breakdown
  console.log(`   Details:`);
  console.log(`   - Format: ${testCase.detectedFormat || 'none'}`);
  console.log(`   - Avg price: ${testCase.menu.items.filter(i => i.price).length > 0 ? Math.round(testCase.menu.items.filter(i => i.price).map(i => i.price).reduce((a,b) => a+b, 0) / testCase.menu.items.filter(i => i.price).length) : 'N/A'} DKK`);
  console.log(`   - Menu items: ${testCase.menu.items.length}`);
  console.log(`   - Hours span: ${calculateHoursSpan(testCase.programme.time_windows).toFixed(1)}h`);
  console.log(`   - Operations: ${testCase.operations.accepts_walk_ins ? 'walk-in' : 'reservation-only'}${testCase.operations.has_takeaway ? ', takeaway' : ''}`);
});

console.log('\n' + '═'.repeat(80));
console.log(`\n📊 TEST RESULTS: ${passCount} passed, ${failCount} failed`);

if (failCount === 0) {
  console.log('✅ All tests passed!');
  process.exit(0);
} else {
  console.log('❌ Some tests failed - review breadth calculation logic');
  process.exit(1);
}
