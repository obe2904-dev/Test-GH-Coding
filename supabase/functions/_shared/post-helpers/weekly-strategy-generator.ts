/**
 * WEEKLY STRATEGY GENERATOR — THIN ORCHESTRATOR
 *
 * Three-phase AI strategy generation:
 *   Phase 0: Contextual Analysis (behavioral insights)
 *   Phase 1: Strategic Brief (angles + reasoning)
 *   Phase 2: Content Plan (2a planner -> 2b detailer -> 2c narrative)
 *
 * This file is the entry-point. All logic lives in ./strategy/.
 *
 * v3.0.0 - THREE-PHASE ARCHITECTURE
 */

import type {
  WeekContext,
  WeeklyStrategy,
} from './types/strategy-types.ts';

import { generateContextualAnalysis } from './strategy/phase0.ts';
import { generateStrategicBrief } from './strategy/phase1.ts';
import { generateContentPlanSplit } from './strategy/phase2/index.ts';
import { validateStrategyOutput } from './strategy/validation.ts';
import { postProcessConsultantSpeak } from './strategy/post-processing.ts';

// ============================================================
// MAIN EXPORT
// ============================================================

export async function generateWeeklyStrategy(
  context: WeekContext,
  options?: { regenerate?: boolean }
): Promise<WeeklyStrategy> {
  const isRegenerating = options?.regenerate || false;
  console.log(
    `[Layer 0] THREE-PHASE strategy (0->1->2) for ${context.business_name}, week ${context.week_number}`,
    { regenerating: isRegenerating }
  );

  const targetPostCount = calculateTargetPostCount(context);
  console.log(`[Layer 0] Target post count: ${targetPostCount}`);

  // Phase 0: Contextual analysis
  console.log('[Layer 0] Starting Phase 0...');
  const { analysis: contextualAnalysis, rawOutput: contextualAnalysisRaw } =
    await generateContextualAnalysis(context);
  console.log(
    `[Layer 0] Phase 0 complete: ${contextualAnalysis.key_factors.length} factors`
  );

  // Phase 1: Strategic brief
  console.log('[Layer 0] Starting Phase 1...');
  const { brief: strategicBrief, rawOutput: strategicBriefRaw } =
    await generateStrategicBrief(context, targetPostCount, contextualAnalysis, isRegenerating);
  console.log(`[Layer 0] Phase 1 complete: ${strategicBrief.angles.length} angles`);

  // Phase 2: Content plan
  console.log('[Layer 0] Starting Phase 2...');
  const rawContent = await generateContentPlanSplit(
    context, strategicBrief, targetPostCount, contextualAnalysis
  );
  console.log(`[Layer 0] Phase 2 complete: ${rawContent.post_ideas?.length || 0} posts`);

  // Validate
  const validation = validateStrategyOutput(rawContent, context, targetPostCount, strategicBrief);
  if (!validation.passed) {
    console.error('[Layer 0] Validation failed:', validation.critical_errors);
    throw new Error(`Strategy validation failed: ${validation.critical_errors.join(', ')}`);
  }
  if (validation.warnings.length > 0) {
    console.warn('[Layer 0] Validation warnings:', validation.warnings);
  }

  // Post-process consultant-speak
  const cleanedContent = postProcessConsultantSpeak(rawContent);

  // Assemble final WeeklyStrategy
  const strategy: WeeklyStrategy = {
    contextual_analysis: contextualAnalysis,
    contextual_analysis_raw: contextualAnalysisRaw,
    strategic_brief: strategicBrief,
    strategic_brief_raw: strategicBriefRaw,
    narrative: cleanedContent.narrative,
    strategic_priorities: cleanedContent.strategic_priorities,
    post_ideas: cleanedContent.post_ideas,
    generated_at: new Date().toISOString(),
    week_number: context.week_number,
    business_type: context.business_type,
    platforms: context.platforms,
    subscription_tier: context.subscription_tier,
    target_post_count: targetPostCount,
    validation_passed: true,
    validation_warnings: validation.warnings,
  };

  console.log(
    `[Layer 0] THREE-PHASE complete. ` +
    `${strategy.post_ideas.length} posts, ` +
    `${strategy.strategic_brief.angles.length} angles, ` +
    `${strategy.contextual_analysis?.key_factors.length || 0} contextual factors.`
  );
  return strategy;
}

// ============================================================
// POST COUNT CALCULATION
// ============================================================

/** Minimum posts regardless of available days or user preference. */
const MIN_POST_COUNT = 2;

/**
 * Calculates the target post count for the week.
 *
 * Base: `preferred_posts_per_week` (from business settings / tier).
 * Event adjustment:
 *   - Week contains a high-commercial-weight event (holiday or commercial_weight ≥ 4):
 *     → push count up to at least 4 (a lead-up post needs a slot)
 *   - No notable events and base preference is 4: allow reduction to 3, freeing
 *     up the weakest angle slot for better quality on the remaining 3.
 *
 * Always clamped to [MIN_POST_COUNT, available_days.length].
 */
function calculateTargetPostCount(context: WeekContext): number {
  let target = context.preferred_posts_per_week;

  // Only count events that fall within this week (in_week !== false).
  // Out-of-week lookahead events must not inflate the post count for the current week.
  const inWeekEvents = (context.events ?? []).filter((e) => (e as any).in_week !== false);

  const inWeekHighValueEvents = inWeekEvents.filter(
    (e) => e.type === 'holiday' || ((e as any).commercial_weight ?? 0) >= 4
  );
  const hasHighValueEvent = inWeekHighValueEvents.length > 0;

  const hasAnyNotableEvent = inWeekEvents.some(
    (e) => e.type === 'holiday' || e.type === 'school_vacation' || ((e as any).commercial_weight ?? 0) >= 3
  );

  // Detect "single Monday holiday" pattern: only one high-value event exists and it falls
  // on Monday (the first day of the week). For these post-holiday weeks the remaining
  // days are normal, so no post-count boost is warranted.
  const isSingleMondayHoliday =
    hasHighValueEvent &&
    inWeekHighValueEvents.length === 1 &&
    new Date(inWeekHighValueEvents[0].date).getDay() === 1; // 1 = Monday

  if (hasHighValueEvent && !isSingleMondayHoliday) {
    // Full holiday week (multiple holidays / event spans the week): floor to 4 posts
    // so there is always a dedicated lead-up / follow-through slot.
    target = Math.max(target, 4);
    console.log('[Layer 0] High-value event week — post count floored to 4');
  } else if (isSingleMondayHoliday) {
    // Post-holiday Monday: the week is essentially normal after day 1 — don't boost.
    console.log('[Layer 0] Single Monday holiday (post-holiday week) — no post count boost');
  } else if (!hasAnyNotableEvent && target >= 5) {
    // Quiet week with no notable events: allow one fewer post for Pro users with ≥5
    // posts, to avoid forced filler. Never reduces the default 4-post Smart-tier count —
    // doing so would drop the Slot B (Wed-Thu) footfall post, leaving mid-week days
    // without coverage and making the strategy narrative undeliverable.
    target = target - 1;
    console.log('[Layer 0] Quiet week (no notable events) — post count reduced by 1');
  }

  target = Math.min(target, context.available_days.length);
  target = Math.max(target, MIN_POST_COUNT);
  return target;
}

// Framework selection has been removed.
// Business type classification is now handled by business_character — an
// AI-generated free-form description stored in business_brand_profile and
// passed through WeekContext.business_character to Phase 1 & 2 prompts.
// See: types/strategy-types.ts → WeekContext.business_character
