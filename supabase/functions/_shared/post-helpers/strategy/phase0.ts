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
import { formatProgrammeWindowsForPhase0, getProgrammeCount } from './phase0-v5-formatter.ts';

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

  lines.push(`Du er gæste-adfærdsrådgiver for restaurationsbranchen i Danmark.`);
  lines.push('');
  lines.push(`Din opgave: Analysér uge ${context.week_number} for ${context.business_name} og identificér 1-3 adfærdsmæssige faktorer der er MATERIELT FORSKELLIGE fra en normal uge.`);
  lines.push('');
  lines.push(`Svar på:`);
  lines.push(`1. Er der noget særligt ved denne uge? (events, vejr afviger fra normalen, lønning, sæsonskift)`);
  lines.push(`2. Hvordan påvirker det HVORNÅR gæsterne beslutter at besøge og HVORNÅR de faktisk kommer?`);
  lines.push(`3. Hvilke af virksomhedens målgrupper er mest påvirkede?`);
  lines.push('');
  lines.push(`Hvis ugen er normal (intet afviger fra baseline), er det KORREKT at rapportere 0-1 faktorer.`);
  lines.push(`Opfind IKKE dramatik hvor der ingen er.`);
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

  // ── V5 PROGRAMME OPERATING WINDOWS (temporal precision) ──────────────────
  // Add V5 programme windows if available - provides temporal precision for
  // cross-referencing contextual factors with actual business capability windows
  const v5Profile = (context as any).v5_profile;
  if (v5Profile) {
    try {
      const programmeWindows = formatProgrammeWindowsForPhase0(v5Profile);
      if (programmeWindows) {
        const programmeCount = getProgrammeCount(v5Profile);
        lines.push(`V5 PROGRAMME DRIFTSVINDUER (${programmeCount} programmer):`);
        lines.push(programmeWindows);
        lines.push('');
        lines.push('INSTRUKTION - TEMPORAL PRÆCISION:');
        lines.push('Når du identificerer tidsmæssige muligheder (frokosttrafik, weekendbesøg, etc.),');
        lines.push('bemærk tidsmæssig overensstemmelse med programme-vinduerne for præcision.');
        lines.push('Eksempel: "Helligdag øger frokosttrafik — aligner med Frokost Programme (Man-Fre, 11:30-15:00)"');
        lines.push('');
      }
    } catch (error) {
      // Graceful degradation: log error but continue without V5 enhancement
      console.warn('[Phase 0] Failed to format V5 programme windows:', error instanceof Error ? error.message : String(error));
    }
  }

  // ── POSTING TIMING STRATEGY (pre-computed behavioral windows) ────────────────
  if ((context as any).posting_windows_by_segment && (context as any).posting_windows_by_segment.primary_segments?.length > 0) {
    const windows = (context as any).posting_windows_by_segment;
    
    lines.push('POSTING TIMING STRATEGI (forberegnet — brug dette til timing_recommendation):');
    lines.push('');
    
    windows.primary_segments.forEach((seg: any) => {
      lines.push(`${seg.segment.toUpperCase()}:`);
      lines.push(`  Forbruger: ${seg.consumption_window.days.join('/')} ${seg.consumption_window.time_range}`);
      lines.push(`  Poster TIDSPUNKT: ${seg.posting_window.optimal_day} ${seg.posting_window.optimal_time_range}`);
      lines.push(`  Adfærd: ${seg.behavior_type}${seg.behavior_split ? ` (${seg.behavior_split.planned_pct}% planlagt, ${seg.behavior_split.impulse_pct}% impuls)` : ''}`);
      lines.push(`  Begrundelse: ${seg.posting_window.reasoning}`);
      lines.push('');
    });
    
    if (windows.seasonal_adjustments.length > 0) {
      const currentSeason = context.season.current.toLowerCase();
      const relevantAdjustments = windows.seasonal_adjustments.filter((adj: any) => 
        adj.season.toLowerCase() === currentSeason
      );
      
      if (relevantAdjustments.length > 0) {
        lines.push('SÆSONJUSTERINGER (denne sæson):');
        relevantAdjustments.forEach((adj: any) => {
          const direction = adj.weight_modifier > 1 ? 'ØGET' : 'REDUCERET';
          const percentage = Math.round(Math.abs(1 - adj.weight_modifier) * 100);
          lines.push(`  • ${adj.segment}: ${direction} ${percentage}% — ${adj.reasoning}`);
        });
        lines.push('');
      }
    }
    
    lines.push('INSTRUKTION - TIMING_RECOMMENDATION:');
    lines.push('Brug ovenstående posting-vinduer når du angiver timing_recommendation for hver faktor.');
    lines.push('Eksempel: "Post fredag 17:00 for weekend brunch (beslutningsvindue familier)"');
    lines.push('');
  }

  // ── SERVICE BEHAVIOR SIGNALS (posting capability modifiers) ──────────────────
  if ((context as any).service_behavior_signals) {
    const sbs = (context as any).service_behavior_signals;
    
    lines.push('SERVICE-ADFÆRDSSIGNALER:');
    lines.push(`  Booking-mønster: ${sbs.booking_pattern}`);
    if (sbs.booking_pattern !== 'impulse_friendly') {
      lines.push(`  Booking lead-time: ${sbs.booking_lead_time_days} dage typisk`);
    }
    lines.push(`  Familieorientering: ${sbs.family_orientation}`);
    
    if (sbs.posting_modifiers?.needs_advance_posts) {
      lines.push(`  ⚠️ KRÆVER FORUDPOSTS: Reservation påkrævet — poster SKAL lægges ${sbs.booking_lead_time_days}+ dage før forbrugsvindue`);
    }
    if (sbs.posting_modifiers?.supports_impulse_posts) {
      lines.push(`  ✓ UNDERSTØTTER IMPULSPOSTS: Walk-in eller takeaway muligt — samme-dag posts virker`);
    }
    if (sbs.posting_modifiers?.weekend_planning_critical) {
      lines.push(`  ✓ WEEKEND PLANLÆGNING KRITISK: Familiegæster booker forud — fredag eftermiddagsposts vigtige`);
    }
    
    lines.push('');
  }

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
    // Baseline signal: tells AI whether weather is genuinely unusual or just normal for the month
    if (wi.weather_is_newsworthy === false) {
      lines.push(`  Vejret er normalt for måneden (${wi.baseline_outdoor_viable ? 'udeservering normalt denne tid' : 'udeservering ikke normalt denne tid'}) — behandl IKKE vejret som et strategisk differentierings-signal denne uge.`);
    } else if (wi.weather_is_newsworthy === true) {
      lines.push(`  Vejret afviger fra normalen for måneden${!wi.baseline_outdoor_viable ? ' (normalt ikke udedejr denne tid — dette er et ægte signal)' : ''} — dette KAN bruges som strategisk signal.`);
    }
    
    // NEW: Day-by-day weather breakdown so AI can see nuanced patterns (e.g., rainy weekdays, sunny weekend)
    if (context.weather?.days && context.weather.days.length > 0) {
      lines.push('');
      lines.push('  Dag-for-dag detaljer:');
      const WEEKDAY_DA = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør'];
      const CONDITION_DA: Record<string, string> = {
        sunny: 'sol',
        partly_cloudy: 'let skyet',
        cloudy: 'skyet',
        rain: 'regn',
        snow: 'sne',
        fog: 'tåge',
      };
      for (const day of context.weather.days) {
        const date = new Date(day.date);
        const weekday = WEEKDAY_DA[date.getDay()];
        const conditionDa = CONDITION_DA[day.condition] || day.condition;
        const tempRange = `${day.temp_min}-${day.temp_max}°C`;
        const rainNote = (day.precipitation_chance && day.precipitation_chance >= 50) ? ` (${day.precipitation_chance}% regn)` : '';
        const windNote = (day.wind_speed && day.wind_speed > 7) ? ` blæsende ${day.wind_speed}m/s` : '';
        lines.push(`    ${weekday.charAt(0).toUpperCase() + weekday.slice(1)}: ${conditionDa}, ${tempRange}${rainNote}${windNote}`);
      }
    }
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
  lines.push('KRITISK REGEL OM EVENTS:');
  lines.push('- Brug KUN de events der er listet ovenfor');
  lines.push('- Brug det PRÆCISE navn som står i listen (f.eks. "Aarhus Festuge", IKKE "musikfestival")');
  lines.push('- Du må IKKE opfinde eller antage events baseret på by, årstid eller almen viden');
  lines.push('- Hvis "EVENTS: Ingen denne uge", må du IKKE nævne nogen events i din analyse');
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
  const isQuietNormal = context.week_modifiers?.overall_priority === 'quiet_normal';
  lines.push(`Generer JSON med key_factors array. Hver faktor skal have:
- type (vælg: "weather", "special_day", "economic", "season", "business_identity", "location_visit_motivation")
- name (kort navn)
- behavioral_impact (beskriver adfærd og stemning — IKKE finansielt sprog)
- target_audience
- strategic_weight ("høj", "medium" eller "lav")
${isQuietNormal ? `
VIGTIG INSTRUKTION — STILLE NORMAL UGE:
Denne uge har ingen events, intet lønningsskift og normalt vejr for måneden.
Det er en helt normal uge — opfind IKKE dramatiske narrativer eller exceptionelle signaler.
Det er legitimt og korrekt at konkludere at der ikke er markante signaler denne uge.
Nøglesignalerne skal afspejle virksomhedens baseline-identitet og normale adfærdsmønstre — ikke opfundne vinklinger.
Sæt strategic_weight "lav" på faktorer der ikke er konkret forstærkede denne uge.
` : ''}
Svar KUN med JSON:
{
  "key_factors": [],
  "factor_interactions": [],
  "strategic_priorities_suggestion": []
}`);

  return lines.join('\n').trim();
}

// ============================================================
// OCCASION RESOLVER  (deterministic — no AI call)
// ============================================================

import type { ActiveOccasion, PostingOccasion } from '../occasions/occasion-library.ts';
import { getOccasionById, getMarketTiming, OCCASION_DEFINITIONS } from '../occasions/occasion-library.ts';

/**
 * Resolves the stored PostingOccasion[] into an ActiveOccasion[] for this specific week.
 *
 * Rules:
 * 1. For each stored PostingOccasion, look up the universal definition +  market timing.
 * 2. Apply week signals (payday, events, available_days) to compute activation_weight.
 * 3. Sort by activation_weight descending.
 * 4. Distribute slots: sum default_slot_count values until we reach targetPostCount.
 * 5. Apply booking-pressure override: if booking_link exists AND booking_eligible AND
 *    (payday || december || high_value_event) → set resolved_cta = 'book_table'
 *    AND bring timing forward by decision_latency if that makes it earlier.
 *
 * Returns [] if no occasions stored — Phase 1 falls back to BASE_SLOTS.
 */
export function resolveActiveOccasions(
  context: WeekContext,
  targetPostCount: number,
): ActiveOccasion[] {
  const storedOccasions: PostingOccasion[] = (context as any).posting_occasions ?? [];

  // ── Archetype-based fallback when posting_occasions hasn't been generated yet ──
  // Stage B2 (brand-profile-generator) normally populates posting_occasions.
  // If it's empty (new business or pre-Stage-B2 profile), derive sensible defaults
  // from the occasion library's archetype_fit so Saturday/Friday slots aren't
  // left to the Phase 1 AI's free-form content_category choices.
  //
  // NOTE: BusinessArchetype (context-interpreters taxonomy) ≠ BusinessArchetypeTag (occasion library).
  // Map from one to the other, including multiple tags for hybrid operating models.
  const ARCHETYPE_TO_OCCASION_TAGS: Record<string, string[]> = {
    full_service_restaurant: ['full_service_cafe'],
    all_day_cafe:            ['full_service_cafe', 'coffee_bar', 'bakery'],
    brunch_cafe:             ['full_service_cafe', 'coffee_bar', 'bakery'],
    morning_cafe:            ['coffee_bar', 'bakery'],
    lunch_restaurant:        ['full_service_cafe'],
    dinner_restaurant:       ['full_service_cafe'],
    evening_bar:             ['cocktail_bar', 'wine_bar', 'full_service_cafe'],
    late_night_bar:          ['cocktail_bar'],
    wine_bar:                ['wine_bar', 'cocktail_bar'],
    fast_casual:             ['takeaway', 'coffee_bar'],
  };

  let effectiveOccasions = storedOccasions;
  if (storedOccasions.length === 0) {
    const archetype: string | undefined = (context as any).business_archetype;
    if (archetype) {
      const occasionTags = ARCHETYPE_TO_OCCASION_TAGS[archetype] ?? [archetype];
      const archetypeDefaults = OCCASION_DEFINITIONS
        .filter(def => def.archetype_fit.some(tag => occasionTags.includes(tag)))
        .sort((a, b) => b.base_weight - a.base_weight)
        .slice(0, Math.max(targetPostCount, 4)) // enough to cover all slots
        .map(def => ({
          occasion_id: def.id,
          priority_weight: def.base_weight,
          default_slot_count: 1 as 1 | 2,
          business_customizations: [],
          conditional_modifiers: [],
        } as PostingOccasion));
      if (archetypeDefaults.length > 0) {
        console.log(`[Phase 0] posting_occasions empty — archetype fallback '${archetype}' → tags [${occasionTags.join(', ')}]:`, archetypeDefaults.map(o => o.occasion_id).join(', '));
        effectiveOccasions = archetypeDefaults;
      } else {
        console.log(`[Phase 0] posting_occasions empty and no occasion match for archetype '${archetype}' — no occasions resolved`);
        return [];
      }
    } else {
      return [];
    }
  }

  // Country → locale mapping for MARKET_TIMING lookup
  const locale = (() => {
    const country = (context.country ?? 'DK').toUpperCase();
    if (country === 'DK' || country === 'DK') return 'da-DK';
    return `da-${country}`; // generalised; falls back to da-DK inside getMarketTiming
  })();

  // ── Week signal detection ──────────────────────────────────────────────────
  const availableDayDows = (context.available_days ?? []).map(d => new Date(d + 'T00:00:00').getDay());
  // 0=Sun, 1=Mon, …, 6=Sat
  const hasSaturday    = availableDayDows.includes(6);
  const hasFriday      = availableDayDows.includes(5);
  const hasThursday    = availableDayDows.includes(4);
  const hasMonday      = availableDayDows.includes(1);
  const hasWeekend     = hasSaturday || availableDayDows.includes(0);
  const isPaydayWeek   = (context.economic?.payday_this_week ?? false)
    || ((context.economic as any)?.payday_week_of_month ?? 99) <= 2;
  const isDecember     = new Date(context.week_start).getMonth() === 11; // 0-indexed
  const hasHighValueEvent = (context.events ?? []).some(
    (e: any) => (e.commercial_weight ?? e.weight ?? 0) >= 4 || e.type === 'holiday',
  );
  const hasBookingLink = !!(context.booking_link);

  // ── Activation scoring ─────────────────────────────────────────────────────
  type Candidate = {
    stored: PostingOccasion;
    weight: number;
    reasons: string[];
    bookingPressure: boolean;
  };

  const candidates: Candidate[] = [];

  for (const stored of effectiveOccasions) {
    const def = getOccasionById(stored.occasion_id);
    if (!def) {
      console.warn(`[Phase 0] Unknown occasion_id: ${stored.occasion_id} — skipping`);
      continue;
    }
    const timing = getMarketTiming(stored.occasion_id, locale);
    if (!timing) {
      console.warn(`[Phase 0] No market timing for ${stored.occasion_id} in ${locale} — skipping`);
      continue;
    }

    let weight = stored.priority_weight / 5; // normalise to 0–1
    const reasons: string[] = [];

    // Apply conditional trigger boosts
    for (const trigger of def.conditional_triggers) {
      switch (trigger) {
        case 'saturday_in_week':   if (hasSaturday)    { weight += 0.2; reasons.push('lørdag i ugen'); } break;
        case 'friday_in_week':     if (hasFriday)      { weight += 0.15; reasons.push('fredag i ugen'); } break;
        case 'thursday_in_week':   if (hasThursday)    { weight += 0.1; reasons.push('torsdag i ugen'); } break;
        case 'weekend_in_week':    if (hasWeekend)     { weight += 0.1; reasons.push('weekend i ugen'); } break;
        case 'week_start':         if (hasMonday)      { weight += 0.05; reasons.push('mandag i ugen'); } break;
        case 'payday_week':        if (isPaydayWeek)   { weight += 0.2; reasons.push('lønningsuge'); } break;
        case 'month_december':     if (isDecember)     { weight += 0.25; reasons.push('december'); } break;
        case 'high_value_event':   if (hasHighValueEvent) { weight += 0.2; reasons.push('høj-værdievent'); } break;
        case 'holiday_week':       if (hasHighValueEvent) { weight += 0.15; reasons.push('helligdagsuge'); } break;
        case 'booking_pressure':
          if (hasBookingLink && def.booking_eligible && (isPaydayWeek || isDecember || hasHighValueEvent)) {
            weight += 0.25; reasons.push('booking-pres');
          }
          break;
        // self-referential triggers already handled above via day checks
        case 'summer_season': {
          const month = new Date(context.week_start).getMonth();
          if (month >= 5 && month <= 7) { weight += 0.15; reasons.push('sommersæson'); }
          break;
        }
      }
    }

    // Detect booking pressure for CTA override
    const bookingPressure = hasBookingLink && def.booking_eligible &&
      (isPaydayWeek || isDecember || hasHighValueEvent);

    candidates.push({ stored, weight, reasons, bookingPressure });
  }

  // Sort by descending weight
  candidates.sort((a, b) => b.weight - a.weight);

  // ── Two-pass spread: prefer occasions whose timing DOWs don't overlap ───────
  // Pass 1: accept candidates with non-conflicting timing windows (in score order).
  // Pass 2: append deferred candidates so remaining slot budget can still be filled.
  // This prevents two high-scoring occasions with identical windows (e.g. both
  // "Thu-Fri 14:00") from displacing a lower-scoring occasion on a distinct day.
  const DOW_MAP: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const usedSpreadDows = new Set<number>();
  const spreadAccepted: typeof candidates = [];
  const spreadDeferred: typeof candidates = [];

  for (const candidate of candidates) {
    const timingEntry = getMarketTiming(candidate.stored.occasion_id, locale);
    if (!timingEntry) { spreadDeferred.push(candidate); continue; }
    const dayPart = timingEntry.post_timing.split(' ')[0]; // "Thu-Fri" or "Mon"
    const candidateDows = new Set(dayPart.split('-').map(a => DOW_MAP[a]).filter(d => d !== undefined) as number[]);
    const hasConflict = [...candidateDows].some(d => usedSpreadDows.has(d));
    if (hasConflict) {
      spreadDeferred.push(candidate);
    } else {
      spreadAccepted.push(candidate);
      for (const d of candidateDows) usedSpreadDows.add(d);
    }
  }

  // Append deferred in original score order so the budget loop below can use them as fallback
  const orderedCandidates = [...spreadAccepted, ...spreadDeferred];

  console.log(`[Phase 0] Spread reorder: accepted=[${spreadAccepted.map(c => c.stored.occasion_id).join(', ')}] deferred=[${spreadDeferred.map(c => c.stored.occasion_id).join(', ')}]`);

  // ── Distribute slot counts up to targetPostCount ───────────────────────────
  // Track spread-accepted pending count so we can protect each spread-accepted occasion
  // from being starved by a high default_slot_count predecessor.
  // Rule: if slotsRemaining <= spreadAcceptedPending, cap this occasion to 1 slot so every
  // spread-accepted occasion is guaranteed at least one slot.
  const spreadAcceptedIds = new Set(spreadAccepted.map(c => c.stored.occasion_id));
  let spreadAcceptedPending = spreadAccepted.length;

  const resolved: ActiveOccasion[] = [];
  let slotsRemaining = targetPostCount;

  for (const { stored, weight, reasons, bookingPressure } of orderedCandidates) {
    if (slotsRemaining <= 0) break;

    const def = getOccasionById(stored.occasion_id)!;
    const timing = getMarketTiming(stored.occasion_id, locale)!;

    const isSpreadAccepted = spreadAcceptedIds.has(stored.occasion_id);
    // Cap to 1 slot when the remaining budget only just covers all pending spread-accepted occasions
    const maxForOccasion = (isSpreadAccepted && slotsRemaining <= spreadAcceptedPending)
      ? 1
      : stored.default_slot_count;
    const slotCount = Math.min(maxForOccasion, slotsRemaining) as 1 | 2;
    if (isSpreadAccepted) spreadAcceptedPending--;
    slotsRemaining -= slotCount;

    // CTA: booking pressure overrides to book_table
    const resolvedCta = bookingPressure ? 'book_table' : timing.default_cta;

    // Timing: use market timing as-is (booking-pressure advance handled in phase2b via resolved_cta)
    const resolvedTiming = timing.post_timing;

    const activationReasons = reasons.length > 0 ? reasons : ['base_priority'];

    resolved.push({
      occasion_id: stored.occasion_id,
      resolved_post_timing: resolvedTiming,
      resolved_cta: resolvedCta,
      activation_weight: Math.min(weight, 1),
      activation_reasons: activationReasons,
      slot_count: slotCount,
      goal_mode: def.goal_mode,
      content_type: def.content_type,
      label_dk: def.label_dk,
      description_dk: def.description_dk,
    });
  }

  console.log(`[Phase 0] resolveActiveOccasions: ${resolved.length} occasions resolved (target=${targetPostCount})`);
  return resolved;
}
