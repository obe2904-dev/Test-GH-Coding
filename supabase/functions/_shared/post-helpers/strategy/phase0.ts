/**
 * PHASE 0: CONTEXTUAL ANALYSIS (BEHAVIORAL INSIGHTS)
 *
 * "WHAT is happening this week?"
 * Analyzes raw context (weather, events, economic, location, season)
 * WITHOUT strategic decisions. Outputs behavioral implications.
 * Grounds later phases in factual analysis, reducing hallucination risk.
 *
 * Uses GPT-4o for all tiers.
 * Cost: ~$0.001 / call. Time: ~2s.
 */

import type { WeekContext, ContextualAnalysis } from '../types/strategy-types.ts';
import { callAI } from '../../ai-caption-generator/ai-provider.ts';
import { buildMotivationBlock } from './motivation-lookup.ts';

// ============================================================
// PHASE 0 ORCHESTRATOR
// ============================================================

export async function generateContextualAnalysis(
  context: WeekContext
): Promise<{ analysis: ContextualAnalysis; rawOutput: string }> {
  console.log(`[Phase 0] Analyzing contextual factors for week ${context.week_number}`);

  const prompt = buildPhase0Prompt(context);

  let rawText!: string;
  let rawAnalysis: any;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const phase0Model = context.subscription_tier === 'smart' ? 'gpt-4o' : 'gpt-4o';
      console.log(`[Phase 0] Attempt ${attempt}/3 using ${phase0Model} (tier: ${context.subscription_tier})`);

      const result = await callAI<any>(
        prompt,
        {
          temperature: attempt === 1 ? 0.3 : 0,
          maxTokens: 2048,
          model: phase0Model,
        }
      );

      rawText = JSON.stringify(result);
      rawAnalysis = result;
      console.log(`[Phase 0] ✅ Success on attempt ${attempt}`);
      break;

    } catch (error) {
      lastError = error as Error;
      console.error(`[Phase 0] Attempt ${attempt}/3 failed:`, lastError.message);

      if (attempt === 3) {
        throw new Error(`Contextual analysis generation failed after 3 attempts: ${lastError.message}`);
      }

      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }

  if (!rawAnalysis) {
    throw new Error(`Contextual analysis generation failed: ${lastError?.message || 'Unknown error'}`);
  }

  const analysis: ContextualAnalysis = {
    week_start: context.week_start,
    week_number: context.week_number,
    generated_at: new Date().toISOString(),
    key_factors: rawAnalysis.key_factors || [],
    factor_interactions: rawAnalysis.factor_interactions || [],
    strategic_priorities_suggestion: rawAnalysis.strategic_priorities_suggestion || [],
    context_summary_user: rawAnalysis.context_summary_user,
  };

  // Post-process: transform financial language → behavioral language
  analysis.key_factors = analysis.key_factors.map((factor: any) => {
    if (factor.behavioral_impact) {
      factor.behavioral_impact = factor.behavioral_impact
        .replace(/budgetbevidsthed/gi, 'folk overvejer mere hvad de bruger')
        .replace(/budgetbevidst(e)?/gi, 'folk vælger mere bevidst')
        .replace(/budgetstramt|stramt budget/gi, 'folk overvejer mere hvad de bruger')
        .replace(/impulskøb/gi, 'spontane valg')
        .replace(/værdi for pengene/gi, 'god oplevelse')
        .replace(/købekraft/gi, 'villighed til at bruge penge')
        .replace(/mindre tilbøjelig(e)? til/gi, 'færre folk')
        .replace(/øget købelyst/gi, 'folk er klar til at undte sig selv')
        .replace(/villighed til at forkæle/gi, 'stemning til at forkæle');
    }
    return factor;
  });

  // Post-process: cap weather strategic_weight based on pre-computed business relevance.
  // GPT-4o tends to assign weather "høj" regardless of business type. This overrides that
  // deterministically so weather cannot dominate Phase 1 for businesses where it is not material.
  const weatherRelevance = (context as any).weather_relevance_for_business as 'low' | 'medium' | 'high' | undefined;
  if (weatherRelevance === 'low' || weatherRelevance === 'medium') {
    const maxWeight = weatherRelevance === 'low' ? 'lav' : 'medium';
    analysis.key_factors = analysis.key_factors.map((factor: any) => {
      if (factor.type === 'weather') {
        const currentWeight: string = factor.strategic_weight ?? '';
        const isOverweight =
          (maxWeight === 'lav') ||
          (maxWeight === 'medium' && currentWeight === 'høj');
        if (isOverweight) {
          console.log(`[Phase 0] Weather weight capped: ${currentWeight} → ${maxWeight} (weather_relevance_for_business=${weatherRelevance})`);
          factor.strategic_weight = maxWeight;
        }
      }
      return factor;
    });
  }

  console.log('[Phase 0] Contextual analysis generated:', {
    factors_count: analysis.key_factors.length,
    interactions_count: analysis.factor_interactions.length,
    priorities_suggested: analysis.strategic_priorities_suggestion.length,
  });

  return { analysis, rawOutput: rawText };
}

// ============================================================
// PHASE 0 PROMPT BUILDER
// ============================================================

function buildPhase0Prompt(context: WeekContext): string {
  const lines: string[] = [];

  lines.push(`Du er data-analytiker. Analysér vigtigste faktorer for ${context.business_name} i uge ${context.week_number}.`);
  lines.push('');

  // ── Operating model context (pre-computed) ───────────────────────────────
  if ((context as any).business_mode || (context as any).visit_mode || (context as any).primary_daypart_this_week) {
    lines.push('FORRETNINGSMODEL (forberegnet):');
    if ((context as any).business_mode) {
      const modeLabels: Record<string, string> = {
        morning_cafe:          'morgenbar/café (morgen, lukker før frokost)',
        coffee_bar_takeaway:   'kaffeudtag (primært take-away)',
        brunch_lunch_cafe:     'brunch- og frokostcafé (morgen til midt eftermiddag)',
        all_day_cafe:          'heldagscafé (morgen til sen eftermiddag, intet aftenkøkken)',
        lunch_restaurant:      'frokostrestaurant (kun frokost)',
        dinner_restaurant:     'aftenrestaurant (kun aften, forudbestilling)',
        evening_bar:           'aftenbar (drinks/cocktails/vinkort om aftenen)',
        hybrid_day_to_evening: 'dag- og aftensted (åbner til dagsbesøg, fortsætter til aftenservering)',
      };
      lines.push(`  Driftsform: ${modeLabels[(context as any).business_mode] ?? (context as any).business_mode.replace(/_/g, ' ')}`);
    }
    if ((context as any).visit_mode) lines.push(`  Besøgsmodel: ${(context as any).visit_mode}`);
    if ((context as any).primary_visit_motivation) lines.push(`  Primær besøgsmotivation: ${(context as any).primary_visit_motivation}`);
    if ((context as any).primary_daypart_this_week) lines.push(`  Primær dagsdel denne uge: ${(context as any).primary_daypart_this_week}`);
    if ((context as any).secondary_daypart_this_week) lines.push(`  Sekundær dagsdel: ${(context as any).secondary_daypart_this_week}`);
    if ((context as any).daypart_reasoning) lines.push(`  Begrundelse: ${(context as any).daypart_reasoning}`);
    lines.push('');
  }

  // ── Driver hierarchy (pre-ranked) ─────────────────────────────────────────
  // ── Weekly framing (synthesised — location + motivation + daypart) ─────────
  const framing0 = (context as any).weekly_framing as {
    location_framing: string;
    motivation_framing: string;
    daypart_framing: string;
  } | undefined;
  if (framing0) {
    lines.push('BESØGSKARAKTER DENNE UGE (forberegnet — disse signaler vejer tungere end vejret):');
    lines.push(`  Lokation:        ${framing0.location_framing}`);
    lines.push(`  Besøgsmotiv:    ${framing0.motivation_framing}`);
    lines.push(`  Bedste dagsdel: ${framing0.daypart_framing}`);
    lines.push('  → Brug dette som den primære strategiske linse. Vejrsignalet er sekundært med mindre relevans=høj.');
    lines.push('');
  }

  const ranking = (context as any).business_driver_ranking as {
    primary_driver: string;
    secondary_driver: string;
    supporting_drivers: string[];
    deprioritized_drivers: string[];
  } | undefined;
  if (ranking) {
    lines.push('DRIVER HIERARKI (forberegnet — brug dette til at veje faktorer korrekt):');
    lines.push(`  PRIMÆR (forretningsidentitet): ${ranking.primary_driver}`);
    lines.push(`  SEKUNDÆR (lokationsadfærd): ${ranking.secondary_driver}`);
    if (ranking.supporting_drivers.length > 0) {
      lines.push(`  UNDERSTØTTENDE (lejlighedstyper + kontekst): ${ranking.supporting_drivers.join(' · ')}`);
    }
    if (ranking.deprioritized_drivers.length > 0) {
      lines.push(`  DEPRIORITÉR (lav forretningsrelevans): ${ranking.deprioritized_drivers.join(' · ')}`);
    }
    lines.push('  → Tildel strategic_weight høj/medium/lav til faktorer ud fra dette hierarki — ikke udelukkende ud fra vejrsignalets styrke.');
    lines.push('');
  }

  // ── Strategic starting points (pre-computed structured candidates) ────────
  const candidatesV2 = (context as any).strategic_priority_candidates_v2 as Array<any> | undefined;
  if (candidatesV2 && candidatesV2.length > 0) {
    lines.push('FORESLÅEDE STRATEGISKE UDGANGSPUNKTER (forberegnet med begrundelse):');
    candidatesV2.forEach((c, i) => {
      lines.push(`  ${i + 1}. ${c.label} (confidence: ${Math.round(c.confidence * 100)}%)`);
      lines.push(`     Gæsteadfærd: ${c.customer_behavior_reason}`);
      lines.push(`     Forretning: ${c.business_reason}`);
      if (c.daypart_relevance?.length) lines.push(`     Dagsdel: ${c.daypart_relevance.join(', ')}`);
    });
    lines.push('');
  } else if (context.strategic_priority_candidates && context.strategic_priority_candidates.length > 0) {
    lines.push('FORESLÅEDE STRATEGISKE UDGANGSPUNKTER (forberegnet):');
    context.strategic_priority_candidates.forEach((p, i) => lines.push(`  ${i + 1}. ${p}`));
    lines.push('');
  }

  // ── Business identity ─────────────────────────────────────────────────────
  const archetype = context.business_archetype ? ` [${context.business_archetype}]` : '';
  lines.push(`VIRKSOMHED: ${context.business_character || context.business_name}${archetype}`);

  // ── Business drivers (pre-computed) ──────────────────────────────────────
  if (context.business_drivers && context.business_drivers.length > 0) {
    const alwaysOn = context.business_drivers.filter(d => d.always_relevant).map(d => d.driver);
    const contextual = context.business_drivers.filter(d => !d.always_relevant).map(d => d.driver);
    if (alwaysOn.length > 0) lines.push(`FORRETNINGSDRIVERE (konstante): ${alwaysOn.join('; ')}`);
    if (contextual.length > 0) lines.push(`FORRETNINGSDRIVERE (kontekstuelle): ${contextual.join('; ')}`);
  }
  lines.push('');

  // ── Location + motivations ────────────────────────────────────────────────
  const locType = context.location.type || 'restaurant';
  lines.push(`LOKATION: ${locType}, ${context.city}`);
  const motivations = context.location.matched_motivations;
  if (motivations && motivations.length > 0) {
    lines.push('BESØGSMOTIVATION (fra lokationsanalyse):');
    lines.push(buildMotivationBlock(motivations));
  }
  if (context.core_guest_occasions && context.core_guest_occasions.length > 0) {
    const primary = context.core_guest_occasions.filter(o => o.primary).map(o => o.occasion);
    if (primary.length > 0) lines.push(`PRIMÆRE BESØGSANLEDNINGER: ${primary.join(', ')}`);
  }
  lines.push('');

  // ── Service periods ───────────────────────────────────────────────────────
  const servicePeriods = Array.isArray(context.service_periods) && context.service_periods.length > 0
    ? context.service_periods.join(', ')
    : 'ikke specificeret';
  lines.push(`SERVICE-PERIODER: ${servicePeriods}`);
  lines.push('');

  // ── Weather interpretation ────────────────────────────────────────────────
  if (context.weather_interpretation) {
    const wi = context.weather_interpretation;
    const weatherEffect = (context as any).weather_effect_on_visit_behavior as string | undefined;
    const weatherRelevance = (context as any).weather_relevance_for_business as string | undefined;
    lines.push('VEJR-FORTOLKNING:');
    if (weatherRelevance) lines.push(`  Relevans for denne forretning: ${weatherRelevance}`);
    if (weatherEffect) lines.push(`  Gæsteadfærd-effekt: ${weatherEffect.replace(/_/g, ' ')}`);
    lines.push(`  Bias: ${wi.indoor_outdoor_bias}`);
    lines.push(`  Weekend-brugbarhed: ${wi.weekend_usability}`);
    if (wi.strongest_opportunity_day) lines.push(`  Bedste dag: ${wi.strongest_opportunity_day}`);
    if (wi.strongest_constraint_day) lines.push(`  Sværeste dag: ${wi.strongest_constraint_day}`);
    lines.push(`  Nedbørsdage: ${wi.precipitation_days && wi.precipitation_days.length > 0 ? wi.precipitation_days.join(', ') : 'ingen'}`);
    lines.push(`  Ugens vejrkarakter: ${wi.week_character ?? wi.operational_note}`);
  } else {
    lines.push(`VEJR: ${context.weather.avg_temp}°C gennemsnit, ${context.weather.pattern}`);
    const weatherEffect = (context as any).weather_effect_on_visit_behavior as string | undefined;
    if (weatherEffect) lines.push(`  Gæsteadfærd-effekt: ${weatherEffect.replace(/_/g, ' ')}`);
  }
  lines.push('');

  // ── Season ────────────────────────────────────────────────────────────────
  lines.push(`SÆSON: ${context.season.current}`);
  // seasonal_mood_signals = abstract behavioural descriptors (no ingredient names).
  // ingredients_in_season fallback is intentionally NOT used here — it contains raw ingredient
  // names that the model will pick up as narrative content even when labelled atmosphere-only.
  const moodSignals = context.season.seasonal_mood_signals ?? [];
  const menuSignals = context.season.menu_supported_seasonal_signals;
  if (moodSignals.length > 0) {
    lines.push(`  Sæsonkontekst (adfærd og timing — IKKE fødevarer): ${moodSignals.join(' · ')}`);
  }
  if (menuSignals && menuSignals.length > 0) {
    lines.push(`  Menustøttede sæsonråvarer (eneste konkrete ingredienser der må nævnes): ${menuSignals.join(', ')}`);
  } else {
    lines.push('  Menustøttede sæsonråvarer: ingen — nævn IKKE specifikke sæsoningredienser');
  }
  lines.push('');

  // ── Events ───────────────────────────────────────────────────────────────
  if (context.events.length > 0) {
    const eventLines = context.events.map(e => `${e.name_dk || e.name} om ${e.days_away} dage — ${e.strategic_angle}`);
    lines.push(`EVENTS: ${eventLines.join('; ')}`);
  } else {
    lines.push('EVENTS: Ingen denne uge');
  }
  lines.push('');

  // ── Economic (only when payday AND relevant for this business type) ───────
  if (context.economic.payday_this_week && (context.economic_relevance_for_business ?? 'medium') !== 'low') {
    const dayLabel = context.economic.payday_day_name ? ` (${context.economic.payday_day_name})` : '';
    const relevanceNote = context.economic_relevance_for_business === 'high'
      ? ' — gæsterne er klar til at bruge penge på noget særligt'
      : ' — gæsterne har lidt mere at bruge af end normalt';
    lines.push(`ØKONOMI: Lønningsuge${dayLabel}${relevanceNote}`);
    lines.push('');
  }

  // ── Week signal summary ───────────────────────────────────────────────────
  if (context.week_modifiers) {
    const wm = context.week_modifiers;
    lines.push(`UGENS NØGLESIGNAL: prioritet=${wm.overall_priority}, økonomi=${wm.economic_signal}, events=${wm.event_weight}, vejr=${wm.weather_opportunity}`);
    lines.push('');
  }

  // ── Instruction ───────────────────────────────────────────────────────────
  lines.push(`Generer JSON med key_factors array. Hver faktor skal have:
- type (vælg: "weather", "special_day", "economic", "season", "business_identity", "location_visit_motivation")
- name (kort navn)
- behavioral_impact (beskriver adfærd og stemning — IKKE finansielt sprog)
- target_audience
- strategic_weight ("høj", "medium" eller "lav")

Svar KUN med JSON:
{
  "key_factors": [],
  "factor_interactions": [],
  "strategic_priorities_suggestion": []
}`);

  return lines.join('\n').trim();
}
