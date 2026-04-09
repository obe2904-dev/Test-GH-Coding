#!/usr/bin/env -S deno run --allow-net --allow-env

/**
 * LAYER 0 STRATEGY GENERATOR - TEST SCRIPT
 * 
 * Run with: deno run --allow-net --allow-env test-layer0-strategy.ts
 * 
 * Tests the weekly strategy generator with mock data.
 * Validates Gemini integration and output quality.
 */

import { generateWeeklyStrategy } from '../weekly-strategy-generator.ts';
import { 
  MOCK_WEEK_CONTEXT_CAFE_FAUST, 
  MOCK_WEEK_CONTEXT_WINE_BAR,
  MOCK_WEEK_CONTEXT_HYBRID 
} from '../mock/mock-week-context.ts';
import type { WeekContext } from '../types/strategy-types.ts';

// ============================================================
// TEST RUNNER
// ============================================================

async function runTest(testName: string, context: WeekContext) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`TEST: ${testName}`);
  console.log('='.repeat(70));

  try {
    const startTime = Date.now();
    const strategy = await generateWeeklyStrategy(context);
    const duration = Date.now() - startTime;

    console.log('\n📊 HEADLINE:', strategy.narrative.headline);
    console.log('\n📝 OVERVIEW:', strategy.narrative.overview);
    
    console.log('\n📖 DETAILED SECTIONS:');
    console.log('  Weather/Season:', strategy.narrative.detailed_sections.weather_season);
    if (strategy.narrative.detailed_sections.events) {
      console.log('  Events:', strategy.narrative.detailed_sections.events);
    }
    console.log('  Business Advantage:', strategy.narrative.detailed_sections.business_advantage);
    if (strategy.narrative.detailed_sections.performance_insight) {
      console.log('  Performance Insight:', strategy.narrative.detailed_sections.performance_insight);
    }
    console.log('  Post Plan:', strategy.narrative.detailed_sections.post_plan);
    
    console.log('\n🎯 STRATEGIC PRIORITIES:');
    strategy.strategic_priorities.forEach(p => {
      console.log(`  - ${p.focus} (${Math.round(p.weight * 100)}%): ${p.rationale}`);
    });
    
    console.log('\n💡 POST IDEAS:');
    strategy.post_ideas.forEach(idea => {
      const flag = idea.weather_dependent ? ' ⚠️ VEJRAFHÆNGIG' : '';
      console.log(`\n  ${idea.id}. [${idea.suggested_day} ${idea.suggested_time}] ${idea.title}${flag}`);
      console.log(`     Type: ${idea.content_type}`);
      console.log(`     Rationale: ${idea.rationale}`);
      console.log(`     Performance: ${idea.estimated_performance} | Fit: ${idea.strategic_fit.toFixed(2)}`);
    });
    
    console.log('\n✅ VALIDATION:');
    console.log(`   Passed: ${strategy.validation_passed ? 'YES' : 'NO'}`);
    console.log(`   Week: ${strategy.week_number}`);
    console.log(`   Business Type: ${strategy.business_type}`);
    console.log(`   Generated: ${strategy.generated_at}`);
    console.log(`   Duration: ${duration}ms`);
    
    if (strategy.validation_warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      strategy.validation_warnings.forEach(w => console.log(`   - ${w}`));
    }

    // Quality checks
    console.log('\n🔍 QUALITY CHECKS:');
    const weightSum = strategy.strategic_priorities.reduce((sum, p) => sum + p.weight, 0);
    console.log(`   Weight sum: ${weightSum.toFixed(2)} ${Math.abs(weightSum - 1.0) < 0.01 ? '✓' : '✗'}`);
    console.log(`   Post count: ${strategy.post_ideas.length} ${strategy.post_ideas.length === 7 ? '✓' : '✗'}`);
    console.log(`   All have dates: ${strategy.post_ideas.every(p => p.suggested_day) ? '✓' : '✗'}`);
    console.log(`   All have times: ${strategy.post_ideas.every(p => p.suggested_time) ? '✓' : '✗'}`);

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    if (error instanceof Error) {
      console.error('   Error message:', error.message);
      console.error('   Stack:', error.stack?.split('\n').slice(0, 3).join('\n'));
    }
  }
}

// ============================================================
// CHECK API KEY
// ============================================================

function checkApiKey(): boolean {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    console.error('\n❌ GEMINI_API_KEY not set in environment');
    console.error('\nTo run this test, set your Gemini API key:');
    console.error('  export GEMINI_API_KEY=your_key_here');
    console.error('\nOr check if it\'s set in Supabase:');
    console.error('  supabase secrets list');
    return false;
  }
  console.log('✓ GEMINI_API_KEY found');
  return true;
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log('\n🧪 LAYER 0 STRATEGY GENERATOR - TEST SUITE');
  console.log('='.repeat(70));
  
  if (!checkApiKey()) {
    Deno.exit(1);
  }

  // Run all test scenarios
  await runTest('Café Faust (FSE) - Valentine\'s Week', MOCK_WEEK_CONTEXT_CAFE_FAUST);
  await runTest('Vinhuset Nord (SBO_wine) - Valentine\'s Week', MOCK_WEEK_CONTEXT_WINE_BAR);
  await runTest('Coffee & Wine (HYBRID) - Valentine\'s Week', MOCK_WEEK_CONTEXT_HYBRID);

  console.log('\n' + '='.repeat(70));
  console.log('✓ All tests completed');
  console.log('='.repeat(70) + '\n');
}

// Run tests
main().catch(error => {
  console.error('\n💥 Fatal error:', error);
  Deno.exit(1);
});
