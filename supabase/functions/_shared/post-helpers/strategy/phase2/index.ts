/**
 * PHASE 2: SPLIT ARCHITECTURE ORCHESTRATOR
 *
 * Orchestrates Content Planner (2a) → Content Detailer (2b) → Narrative (2c).
 */

import type { WeekContext, StrategicBrief, ContextualAnalysis, CTAIntent } from '../../types/strategy-types.ts';
import type { BusinessIntelligence } from '../../assemble-business-intelligence.ts';
import { generateContentPlan2a } from './phase2a.ts';
import { generatePostDetail } from './phase2b.ts';
import { generateNarrative } from './phase2c.ts';
import { resolveCtaIntent } from '../cta-resolver.ts';
import {
  buildContextSummaryFromData,
  buildStrategyReasoningFromAngles,
  type ContextSummary,
  type StrategyReasoning,
} from '../ui-builders.ts';
import { assembleBusinessIntelligence, formatBusinessIntelligenceForPrompt } from '../../assemble-business-intelligence.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function generateContentPlanSplit(
  context: WeekContext,
  strategicBrief: StrategicBrief,
  targetPostCount: number,
  contextualAnalysis: ContextualAnalysis,
  businessIntelligence?: BusinessIntelligence,
  typeAllocations?: Array<{ content_type: string; type_rationale: string }> // Phase C: analytics type only (not template routing)
): Promise<any> {
  console.log(`[Phase 2 Split] Starting split generation for ${targetPostCount} posts`);

  // ── Business Intelligence ──
  // If not provided, fetch it now (fallback for direct calls)
  let businessIntel = businessIntelligence;
  if (!businessIntel) {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('[Phase 2] Assembling business intelligence (fallback)...');
    businessIntel = await assembleBusinessIntelligence(supabase, context.business_id);
  }
  
  const businessIntelligencePrompt = formatBusinessIntelligenceForPrompt(businessIntel);
  console.log(`[Phase 2] Business intelligence loaded: ${businessIntel.dataCompleteness.overallScore}% complete`);
  console.log('[Phase 2] ═══ BUSINESS INTELLIGENCE PROMPT ═══');
  console.log(businessIntelligencePrompt);
  console.log('[Phase 2] ═══════════════════════════════════════');

  // ── 2a: Content Planner ──
  // Pass Phase C type allocations to Phase 2a for analytics tagging only (not template routing)
  console.log('[Phase 2 Split DEBUG] Revenue drivers before calling 2a:', {
    hasRevenueDrivers: !!(context as any).revenue_drivers,
    revenueDriversType: typeof (context as any).revenue_drivers,
    hasPreferredPattern: !!((context as any).revenue_drivers as any)?.preferred_day_pattern,
    preferredPattern: ((context as any).revenue_drivers as any)?.preferred_day_pattern
  });
  
  const contentPlan = await generateContentPlan2a(
    strategicBrief,
    context.available_days,
    targetPostCount,
    context.platforms,
    (context.brand_voice as any)?.content_strategy?.content_category_weights,
    (context.previous_week as any)?.previous_flexible_dows,   // Change B: flexible DOW history
    context.events ?? [],                                       // Change C: event-pin
    typeAllocations,                                            // Phase C: analytics types (content_type only)
    (context as any).revenue_drivers,                          // Multi-primary revenue drivers for day allocation
  );
  console.log(`[Phase 2a] Plan: ${contentPlan.length} posts`);

  if (contentPlan.length === 0) {
    throw new Error('Phase 2a returned empty content plan');
  }

  // ── 2b: Content Detailer (sequential to avoid rate limits) ──
  const postDetails: any[] = [];
  // Pre-seed with last week's menu items so Phase 2b won't re-use dishes from the previous week.
  // Phase 1's prompt already tells the AI not to pick these — this ensures Phase 2b's dedup
  // filter also honours the constraint at the item-selection level.
  const usedMenuItems: string[] = [...((context as any).previous_week?.posted_menu_items ?? [])];
  const usedMenuItemIds: Set<string> = new Set(); // UUID-based deduplication (preferred)
  if (usedMenuItems.length > 0) {
    console.log(`[Phase 2] Pre-seeded ${usedMenuItems.length} previous-week menu items into dedup list: ${usedMenuItems.join(', ')}`);
  }
  const usedMenuCategories: string[] = []; // Track used categories (prevents 2x BRUNCH, 2x DESSERT, etc.)
  const usedExperiencePosts: Array<{ title: string; angle_focus: string }> = [];
  // Track which Phase 0 rationale themes each post has claimed, so the next post
  // is forced to lead with a DIFFERENT insight (prevents all 4 posts saying the same thing).
  const usedRationaleThemes: string[] = [];

  // Compute CTA flavor rotation index: cycles 0→1→2→0 each week so engagement posts
  // don't repeat the same call-to-action phrasing week after week.
  const weekNumber: number = (context as any).week_number ?? 0;
  const ctaFlavorIndex = weekNumber % 3;

  for (let i = 0; i < contentPlan.length; i++) {
    const slot = contentPlan[i];
    const isLastPost = i === contentPlan.length - 1;
    const ctaResolution = resolveCtaIntent(slot.type, context, isLastPost);

    // Override cta_intent based on goal_mode (slot system takes precedence over legacy type resolver)
    let finalCtaIntent: CTAIntent = ctaResolution.intent;
    if (slot.goal_mode === 'drive_footfall') {
      // 'traffic' = visit us now; includes spontaneous walk-ins, opening times, AND booking
      finalCtaIntent = 'traffic';
    } else if (slot.goal_mode === 'build_brand') {
      finalCtaIntent = 'engagement';
    } else if (slot.goal_mode === 'retain_loyalty') {
      finalCtaIntent = 'awareness';
    }
    console.log(`[Phase 2b] Processing post ${i + 1}/${contentPlan.length} (ID: ${slot.id}, type: ${slot.type}, goal: ${slot.goal_mode || 'none'}, cta: ${finalCtaIntent})`);

    const detail = await generatePostDetail(slot, context, strategicBrief, contextualAnalysis, contentPlan, usedMenuItems, usedExperiencePosts, finalCtaIntent, usedRationaleThemes, ctaFlavorIndex, businessIntelligencePrompt, businessIntel, usedMenuCategories, i, usedMenuItemIds);
    postDetails.push(detail);

    // Track the rationale theme this post used (first clause of rationale = theme)
    if (detail.rationale) {
      const firstClause = detail.rationale.split(/[.,]/)[0].trim();
      if (firstClause) usedRationaleThemes.push(firstClause);
    }

    // Track menu item used — check content_category OR menu_item_used being set,
    // because Phase 2a type ('atmosphere' etc.) may not match Phase 1 content_category
    // ('product_menu'). Using menu_item_used presence is the authoritative signal.
    // NOTE: craving_visual = atmosphere/experience posts (NO menu items)
    const isMenuSlot = slot.content_category === 'product_menu' || slot.type === 'menu_item';
    if (isMenuSlot && detail.menu_item_used) {
      usedMenuItems.push(detail.menu_item_used);
      console.log(`[Phase 2b] Tracked menu item: "${detail.menu_item_used}" (${usedMenuItems.length} total used)`);
      
      // Track UUID for deduplication (preferred method)
      if (detail.menu_item_id) {
        usedMenuItemIds.add(detail.menu_item_id);
        console.log(`[Phase 2b] Tracked menu item UUID: ${detail.menu_item_id}`);
      }
      
      // Track category to prevent duplicate categories (e.g., 2x BRUNCH)
      if (detail.menu_category) {
        usedMenuCategories.push(detail.menu_category);
        console.log(`[Phase 2b] Tracked menu category: "${detail.menu_category}" (${usedMenuCategories.length} total used)`);
      }
    }

    if (!isMenuSlot && detail.title) {
      usedExperiencePosts.push({ title: detail.title, angle_focus: slot.angle_focus });
      console.log(`[Phase 2b] Tracked experience concept: "${detail.title}" / ${slot.angle_focus} (${usedExperiencePosts.length} total used)`);
    }

    if (i < contentPlan.length - 1) {
      const delayMs = 800;
      console.log(`[Phase 2b] Waiting ${delayMs}ms before next post...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  console.log(`[Phase 2b] Details: ${postDetails.length} posts generated`);

  // ── 2c: Narrative Generator ──
  const postSummary = postDetails.map(p => ({
    type: p.content_type,
    title: p.title || '(uden titel)',
    angle_focus: p.angle_focus,
    suggested_day: p.suggested_day,
    rationale: p.rationale || '',
  }));
  const narrative = await generateNarrative(context, strategicBrief, postSummary, contextualAnalysis);
  console.log(`[Phase 2c] Narrative generated`);

  // ── Build strategic_priorities from Phase 1 angles ──
  const strategicPriorities = strategicBrief.angles.map(a => ({
    focus: a.focus,
    weight: a.weight,
    rationale: a.reasoning,
  }));

  // ── Build context_summary PROGRAMMATICALLY ──
  let contextSummary: ContextSummary;
  try {
    contextSummary = buildContextSummaryFromData(context, strategicBrief);
    console.log(`[Phase 2] Context summary: ${contextSummary.key_factors.length} faktorer`);
  } catch (error) {
    console.error('[Phase 2] ERROR building context_summary:', error);
    throw new Error(`Failed to build context summary: ${error}`);
  }

  // ── Build strategy_reasoning PROGRAMMATICALLY ──
  let strategyReasoning: StrategyReasoning;
  try {
    const postPlanForReasoning = postDetails.map(p => ({
      type: p.content_type,
      angle_focus: p.angle_focus,
    }));
    strategyReasoning = buildStrategyReasoningFromAngles(strategicBrief, postPlanForReasoning);
    console.log(`[Phase 2] Strategy reasoning: primary angle = ${strategyReasoning.primary_angle}`);
  } catch (error) {
    console.error('[Phase 2] ERROR building strategy_reasoning:', error);
    throw new Error(`Failed to build strategy reasoning: ${error}`);
  }

  return {
    narrative: {
      ...narrative,
      context_summary: contextSummary,
      strategy_reasoning: strategyReasoning,
    },
    strategic_priorities: strategicPriorities,
    post_ideas: postDetails,
  };
}
