/**
 * PHASE 1: STRATEGIC BRIEF GENERATOR
 *
 * Pure strategic analysis connecting business profile, menu capabilities, and week context.
 * Uses Phase 0 analysis as foundation for grounded decision-making.
 * Outputs strategic angles with weights, reasoning and content direction.
 *
 * SLOT SYSTEM (Step 2 — Content Strategy):
 * A deterministic 4-slot system overlays the AI-generated angles so that every weekly post
 * has a concrete goal_mode and content_category derived from the brand's content_strategy.
 *
 * Slot definitions:
 *   A — Footfall driver: goal_mode=drive_footfall, category=product_menu, Thu-Fri 14:00
 *   B — Footfall support: goal_mode=drive_footfall, category=product_menu, Wed-Thu 11:00
 *   C — Brand builder:   goal_mode=build_brand,    category=behind_scenes, Mon 09:00
 *   D — Flexible:        goal_mode varies by context (loyalty or footfall), category varies
 *
 * When a business has content_strategy, the AI's angles are used for contextual reasoning only —
 * the slot system provides the definitive goal_mode and content_category.
 *
 * Uses gpt-4.1 (OpenAI) for both Smart and Pro tiers.
 */

import type {
  WeekContext,
  StrategicBrief,
  StrategicAngle,
  ContextualAnalysis,
  ContextFactor,
  FactorInteraction,
  MenuCapabilities,
  MenuSummary,
} from '../types/strategy-types.ts';
import { callAI } from '../../ai-caption-generator/ai-provider.ts';
import { cleanTextForConsultantSpeak } from './post-processing.ts';
import { buildMotivationBlock } from './motivation-lookup.ts';
import { buildForbiddenBlock } from './forbidden-phrases.ts';

// ============================================================
// PHASE 1 ORCHESTRATOR
// ============================================================

export async function generateStrategicBrief(
  context: WeekContext,
  targetPostCount: number,
  phase0Analysis: ContextualAnalysis,
  isRegenerating: boolean = false
): Promise<{ brief: StrategicBrief; rawOutput: string }> {
  console.log(`[Phase 1] Generating strategic brief for ${context.business_name}`, {
    regenerating: isRegenerating,
    phase0_factors: phase0Analysis.key_factors.length
  });

  const prompt = buildPhase1Prompt(context, targetPostCount, phase0Analysis, isRegenerating);

  let rawText: string;
  let rawBrief: any;
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const phase1Model = 'gpt-4.1';
      console.log(`[Phase 1] Attempt ${attempt}/3 using ${phase1Model} (tier: ${context.subscription_tier})`);
      rawBrief = await callAI<any>(
        prompt,
        {
          temperature: attempt === 1 ? (isRegenerating ? 0.55 : 0.3) : 0,
          maxTokens: 8192,
          model: phase1Model,
        }
      );
      rawText = JSON.stringify(rawBrief);
      break;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[Phase 1] Attempt ${attempt}/3 failed:`, lastError.message);
    }
  }
  if (!rawBrief) {
    console.error('[Phase 1] Failed after 3 attempts');
    throw new Error(`Strategic brief generation failed: ${lastError}`);
  }

  // Normalize angles
  if (Array.isArray(rawBrief.angles)) {
    rawBrief.angles = rawBrief.angles.map((a: any) => ({
      ...a,
      focus: a.focus || a.name || '',
    }));
  }

  // Clean consultant-speak
  if (rawBrief.week_summary) {
    rawBrief.week_summary = cleanTextForConsultantSpeak(rawBrief.week_summary);
  }
  if (rawBrief.competitive_advantage) {
    rawBrief.competitive_advantage = cleanTextForConsultantSpeak(rawBrief.competitive_advantage);
    // Enforce required opener — prepend if missing (content is preserved, just unlabeled)
    if (!/^netop denne uge er fordelen,?/i.test(rawBrief.competitive_advantage.trim())) {
      console.warn('[Phase 1] competitive_advantage missing required opener — auto-prepending. First 80 chars:', rawBrief.competitive_advantage.trim().slice(0, 80));
      rawBrief.competitive_advantage = 'Netop denne uge er fordelen, at ' + rawBrief.competitive_advantage.trim();
    }
  }

  // Build valid type set from actual Phase 0 factors for phase0_factors_used validation
  const validPhase0Types = new Set<string>([
    ...phase0Analysis.key_factors.map((f: ContextFactor) => f.type),
    'weather', 'economic', 'event', 'seasonal', 'special_day', 'location', 'business',
  ]);

  if (Array.isArray(rawBrief.angles)) {
    rawBrief.angles = rawBrief.angles.map((a: any) => ({
      ...a,
      reasoning: a.reasoning ? cleanTextForConsultantSpeak(a.reasoning) : a.reasoning,
      content_direction: a.content_direction ? cleanTextForConsultantSpeak(a.content_direction) : a.content_direction,
      menu_alignment: a.menu_alignment ? cleanTextForConsultantSpeak(a.menu_alignment) : a.menu_alignment,
      // Strip any fabricated/malformed IDs — keep only 'type:detail' format with known types
      phase0_factors_used: Array.isArray(a.phase0_factors_used)
        ? a.phase0_factors_used.filter((id: unknown) => {
            if (typeof id !== 'string') return false;
            const colonIdx = id.indexOf(':');
            return colonIdx !== -1 && validPhase0Types.has(id.slice(0, colonIdx));
          })
        : [],
    }));
  }

  // Validate content_direction quality — must be three-part (a — b — c) with sufficient specificity.
  // Pure observability: logs a warning so we can track how often the model under-delivers.
  if (Array.isArray(rawBrief.angles)) {
    for (const a of rawBrief.angles) {
      const cd: string = a.content_direction || '';
      const separatorCount = (cd.match(/ — /g) || []).length;
      const hasTiming = /\d{1,2}[:h]\d{0,2}|\bkl\.\s*\d|\bmandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag|hverdags|weekend/i.test(cd);
      if (separatorCount < 2 || cd.length < 100 || !hasTiming) {
        console.warn(
          `[Phase 1] content_direction quality warning on angle "${a.focus}":`,
          { separators: separatorCount, length: cd.length, hasTiming },
          'First 150 chars:', cd.slice(0, 150),
        );
      }
    }
  }

  const brief: StrategicBrief = {
    week_summary: rawBrief.week_summary || '',
    competitive_advantage: rawBrief.competitive_advantage || '',
    angles: rawBrief.angles || [],
    generated_at: new Date().toISOString(),
    week_number: context.week_number,
  };

  console.log('[Phase 1] Strategic brief generated:', {
    angles_count: brief.angles.length,
    total_weight: brief.angles.reduce((sum, a) => sum + a.weight, 0),
  });

  console.log('[Phase 1] FULL STRATEGIC BRIEF:\n' + JSON.stringify({
    week_summary: brief.week_summary,
    competitive_advantage: brief.competitive_advantage,
    angles: brief.angles.map(a => ({
      focus: a.focus,
      weight: a.weight,
      reasoning: a.reasoning,
      menu_alignment: a.menu_alignment,
      content_direction: a.content_direction
    }))
  }, null, 2));

  // ── SLOT SYSTEM: Overlay goal_mode + content_category on each angle ──────────
  // Driven by content_strategy from brand profile when available.
  brief.angles = assignSlotMetadata(brief.angles, targetPostCount, context);

  console.log('[Phase 1] Slot assignments:', brief.angles.map(a => ({
    focus: a.focus,
    slot_id: a.slot_id,
    goal_mode: a.goal_mode,
    content_category: a.content_category
  })));

  return { brief, rawOutput: rawText };
}

// ============================================================
// PHASE 1 PROMPT BUILDER
// ============================================================

function buildPhase1Prompt(
  context: WeekContext,
  targetPostCount: number,
  phase0Analysis: ContextualAnalysis,
  isRegenerating: boolean = false
): string {
  const menuCapabilities = analyzeMenuCapabilities(context);

  const phase0Summary = phase0Analysis.key_factors.map((f: ContextFactor) =>
    `- ${f.name} (${f.type}, weight: ${f.strategic_weight})
  Adfærd: ${f.behavioral_impact}
  Målgruppe: ${f.target_audience}
  Content: ${(f.content_opportunities || []).slice(0, 3).join('; ')}
  Timing: ${f.timing_recommendation}`
  ).join('\n\n');

  const interactionsSummary = phase0Analysis.factor_interactions.length > 0
    ? phase0Analysis.factor_interactions.map((i: FactorInteraction) =>
      `- Faktorer: ${(i.factors || []).join(' + ')}
  Synergi: ${i.synergy}
  Indsigt: ${i.insight}
  ${i.strategic_implication ? `Implikation: ${i.strategic_implication}` : ''}
  ${i.resolution ? `Løsning: ${i.resolution}` : ''}`
    ).join('\n\n')
    : 'Ingen væsentlige interaktioner';

  const suggestedPriorities = phase0Analysis.strategic_priorities_suggestion.map((p: any) =>
    `${p.priority}. ${p.theme} (${p.recommended_weight}): ${p.reasoning}`
  ).join('\n');

  return `
Du er marketing-chef for ${context.business_name}. Du briefer ejeren om ugens sociale medie-strategi.

OPGAVE:
Den strategiske retning for ugen er FORBEREGNET og fremgår nedenfor (week_mode, prioriterede kandidater, dagsdel, forbudte vinkler).
Din opgave er IKKE at beslutte strategien fra bunden — den er at oversætte den til konkret, ejervendt sprog og angles.
${isRegenerating ? `⚠️ VIGTIG: Dette er en regeneration. Tilbyd FORSKELLIGE vinkler og ideer end tidligere. Vær kreativ og udforsende, find nye muligheder i samme situation.\n` : ''}
STEMME OG REGISTER — LÆS DETTE FØR DU BEGYNDER:

PERSON: Skriv altid i tredje person om virksomheden. Outputtet er en briefing TIL ejeren, ikke virksomhedens kommunikation.
  ✗ FORBUDT: "vi", "vores", "gør os til", "giver os" som virksomhedsstemme
  ✓ KORREKT: "${context.business_name} er …", "stedet dækker …", "menuen inkluderer …"

ORDVALG: Brug ejer-sprog — konkrete dagsdels-navne, tidsrum og gæste-adfærd.
  ✗ FORBUDT: echo feltnavne som "Driftsprogrammer:", "business_mode", "location_behavior_mode" i output
  ✗ FORBUDT: systemtermer — "driftsprogram", "hybridformat", "content mix" — erstat med det konkrete spanning:
    fx "åbent fra brunch til aftenservering" i stedet for "driftsprogrammet dækker brunch til aftenservering"

STEMMEKALIBRERING — fejltype og korrekt eksempel:
  ✗ "Vores driftsprogram fra brunch og frokost til aftenservering gør os til en aktivt valgt destination."
     [FEJL: første person + input-etiket echo + abstrakt destinationsframing]
  ✓ "Åbent fra brunch til aftenservering — spændet fanger lunchtilstrømning kl. 12–14 og planlagte aftenbesøg torsdag–lørdag."
     [KORREKT: tredje person + ejer-ordbog + observerbar adfærd + konkret timing]

  Beståelseskravet: En sætning der (a) bruger vi/vores som virksomhedsstemme, (b) echoes et feltlabel,
  eller (c) passer på 20 andre virksomheder i branchen — er ugyldig. Erstat med: tredje person + observerbar adfærd + specifik egenskab + konkret timing.

Svar KUN med JSON-format (ingen forklaring udenfor).

═══════════════════════════════════════════════
PHASE 0: KONTEKST-SIGNALER (FAKTA-GRUNDLAG)
═══════════════════════════════════════════════

VIGTIGSTE FAKTORER DENNE UGE:
${phase0Summary}

FAKTOR-INTERAKTIONER:
${interactionsSummary}

FORESLÅEDE STRATEGISKE PRIORITETER:
${suggestedPriorities}

═══════════════════════════════════════════════

REFERENCE: I dit "reasoning" felt, angiv HVILKE faktorer du adresserer (brug factor IDs som "special_day:Valentinsdag", "weather:cold_indoor").

VIRKSOMHED:
- Navn: ${context.business_name}
- Beskrivelse: ${context.business_character || context.business_name}
- By: ${context.city}, Danmark
- Har udeservering: ${context.weather.has_outdoor_seating ? 'Ja' : 'Nej'}
${ (context as any).weather_is_differentiator === false ? '- VEJR-FRAMING: Vejret er IKKE et primært differentieringselement for denne virksomhed — undgå at lede strategiske vinkler med vejr. Brug kun vejr som sekundær kontekst hvis det direkte påvirker gæstens beslutning denne uge.' : ''}
- Har takeaway: ${(context.location as any)?.has_takeaway ? 'Ja' : 'Nej'}
- Har bordbetjening: ${(context.location as any)?.has_table_service !== false ? 'Ja' : 'Nej'}
${(context as any).menu_programmes && (context as any).menu_programmes.length > 0 ? `- Driftsprogrammer: ${(context as any).menu_programmes.map((p: { role: string; timeContext: string | null; items: string[] }) => `${p.role}${p.timeContext ? ` (${p.timeContext})` : ''}`).join(', ')}` : ''}
${(context as any).late_night_closing ? `- Senklukning: Ja — åbent efter midnat (nattelivs-/bar-vinkel er relevant)` : ''}

${(() => {
  const ranking = (context as any).business_driver_ranking as {
    primary_driver: string;
    secondary_driver: string;
    supporting_drivers: string[];
    deprioritized_drivers: string[];
  } | undefined;
  const framing = (context as any).weekly_framing as {
    location_framing: string;
    motivation_framing: string;
    daypart_framing: string;
  } | undefined;
  if (!ranking && !framing) return '';
  const lines: string[] = [];
  if (framing) {
    lines.push('BESØGSKARAKTER DENNE UGE — SÅDAN BRUGES DETTE STED:');
    lines.push(`  📍 Lokation:        ${framing.location_framing}`);
    lines.push(`  🎯 Besøgsmotiv:    ${framing.motivation_framing}`);
    lines.push(`  ⏰ Bedste dagsdel: ${framing.daypart_framing}`);
    lines.push('  → Disse tre linjer beskriver HVAD dette sted er for gæsterne. Al framing skal tage udgangspunkt heri — ikke i vejret.');
    lines.push('');
  }
  if (ranking) {
    lines.push('STRATEGISK ANKER (forberegnet — denne hierarki styrer al framing):');
    lines.push(`  1. FORRETNINGSIDENTITET (aldrig til forhandling): ${ranking.primary_driver}`);
    lines.push(`  2. LOKATIONSADFÆRD (strukturel gæstegrund): ${ranking.secondary_driver}`);
    if (ranking.supporting_drivers.length > 0) {
      lines.push(`  3. UNDERSTØTTENDE kontekstsignaler: ${ranking.supporting_drivers.join(' · ')}`);
    }
    if (ranking.deprioritized_drivers.length > 0) {
      lines.push(`  4. DEPRIORITÉR (lav forretningsrelevans denne uge): ${ranking.deprioritized_drivers.join(' · ')}`);
    }
    lines.push('  → Vinkler og reasoning SKAL forankres i niveau 1–2. Niveau 3 er supplerende kontekst. Niveau 4 må IKKE drive et fokusområde.');
  }
  return lines.join('\n');
})()}

${context.menu_summaries && context.menu_summaries.length > 0 ? `MENUER (overordnet oversigt – vælg hvilken menu/kategori der bedst matcher ugens vinkel og kontekst):
${context.menu_summaries.map((m: MenuSummary) => `[${m.title}]
${m.summary}`).join('\n\n')}` : `MENU-EVNER (ingen specifikke retter, kun kategorier):
${menuCapabilities.map(m => `- ${m.category}: ${m.count} items — ${m.strategic_value}`).join('\n')}`}

${context.brand_voice ? `
PERSONALITY ANCHOR (Styrer al content-skrivning):
${(context.brand_voice as any).brand_essence || context.brand_voice.voice_style ? `🏷️ "${(context.brand_voice as any).brand_essence || context.brand_voice.voice_style}"` : ''}
${(context.brand_voice as any).brand_essence_elaboration ? `📌 ${(context.brand_voice as any).brand_essence_elaboration}` : ''}
${(context.brand_voice as any).communication_goal ? `🎯 Kommunikationsmål: ${(context.brand_voice as any).communication_goal}` : ''}
${(() => {
  const kw: string[] = (context.brand_voice as any).identity_keywords || [];
  return kw.length > 0 ? `🔑 Identitet: ${kw.join(' · ')}` : '';
})()}
${(() => {
  const ta = (context.brand_voice as any).target_audience;
  if (!ta) return '';
  const primary = typeof ta === 'object' ? ta.primary : ta;
  return primary ? `• Målgruppe: ${primary}` : '';
})()}

TONE-GUIDE:
${(() => {
  const tone = context.brand_voice.tone_of_voice;
  if (typeof tone === 'string' && tone) return tone;
  if (typeof tone === 'object' && tone !== null) {
    const t = tone as any;
    const parts: string[] = [];
    if (t.primary_tone) parts.push(`Primær: ${t.primary_tone}${t.attributes?.length ? ` (${t.attributes.join(', ')})` : ''}`);
    if (t.formality_level) parts.push(`Formalitet: ${t.formality_level}`);
    return parts.join(' · ') || 'Ikke angivet';
  }
  return 'Ikke angivet';
})()}
${(() => {
  const toneKw: string[] = (context.brand_voice as any).tone_model?.primary_keywords || context.brand_voice.tone_keywords || [];
  return toneKw.length > 0 ? `• Kernepersonlighed: ${toneKw.join(' · ')}` : '';
})()}
${(context.brand_voice as any).humor_level ? `• Humor: ${(context.brand_voice as any).humor_level}` : ''}
${((context.brand_voice as any).typical_openings || [])[0] ? `✅ Typisk åbning: "${((context.brand_voice as any).typical_openings || [])[0]}"` : ''}
${(context.brand_voice as any).voice_constraints ? `⚠️ Skriveprincip: ${(context.brand_voice as any).voice_constraints}` : ''}
${(() => {
  const avoidEx: string[] = (context.brand_voice as any).tone_model?.avoid_examples || [];
  return avoidEx.length > 0 ? `❌ Undgå fx: ${avoidEx.slice(0, 2).map((e: string) => `"${e}"`).join(' / ')}` : '';
})()}

DO'S — Hvad der virker for dette brand:
${(() => {
  const pillars = context.brand_voice.content_pillars;
  const phrases = (context.brand_voice as any).signature_phrases || [];
  const parts: string[] = [];
  if (Array.isArray(pillars) && pillars.length > 0) {
    pillars.slice(0, 5).forEach((p: any) => {
      if (p?.hook) parts.push(`→ ${p.hook}${p.usage ? `: ${p.usage}` : ''}`);
      else if (typeof p === 'string') parts.push(`→ ${p}`);
    });
  } else if (pillars && typeof pillars === 'object' && !Array.isArray(pillars)) {
    Object.entries(pillars as object).slice(0, 5).forEach(([k, v]) => parts.push(`→ ${k}: ${v}`));
  }
  if (phrases[0]) parts.push(`→ Signatur-sprogbrug (caption-ordvalg, ikke strategisk indhold): "${phrases[0]}"`);
  return parts.length > 0 ? parts.join('\n') : 'Ikke specificeret';
})()}
${(() => {
  const cs = (context.brand_voice as any)?.content_strategy;
  if (!cs) return '';
  const lines: string[] = [];
  const co = (context.brand_voice as any)?.core_offerings;
  if (co) {
    const coText = typeof co === 'string' ? co : Array.isArray(co) ? (co as string[]).join(', ') : null;
    if (coText) lines.push(`Kernetilbud: ${coText}`);
  }
  if (cs.footfall_signals?.length > 0) lines.push(`Fodfæste: ${(cs.footfall_signals as string[]).slice(0, 3).join(' · ')}`);
  if (cs.brand_anchors?.length > 0) lines.push(`Brand-ankre: ${(cs.brand_anchors as string[]).slice(0, 3).join(' · ')}`);
  if (cs.loyalty_hooks?.length > 0) lines.push(`Loyalitet: ${(cs.loyalty_hooks as string[]).slice(0, 3).join(' · ')}`);
  return lines.length > 0
    ? `\nPOST STRATEGI — brandets egne ankre (brug til at konkretisere vinkler):\n${lines.join('\n')}`
    : '';
})()}
` : ''}

${(context.location as any).matched_motivations?.length ? `
LOKATIONSTYPE & BESØGSMOTIVER:
- Primær lokalitetstype: ${(context.location as any).type}${(context.location as any).tourist_context ? ' (turistzone — mix af lokale og besøgende)' : ''}
${(() => {
  const cats = (context.location as any).location_categories as Array<{type: string; score: number}> | null;
  return cats && cats.length > 1 ? `- Aktive lokationstyper (≥60%): ${cats.map(c => `${c.type} (${c.score}%)`).join(', ')}` : '';
})()}
${(() => {
  const motivations = (context.location as any).matched_motivations as string[] | null;
  if (!motivations || motivations.length === 0) return '';
  return `- Besøgsmotiver (struktureret):\n${buildMotivationBlock(motivations)}`;
})()}
${(context.location as any).marketing_focus ? `- Markedsføringsfokus: ${(context.location as any).marketing_focus}` : ''}
- Strategisk konsekvens: Ugens content skal resonere med disse motivationstyper. Kombiner sæson (${context.season.current}) med de dominerende motiver — f.eks. hvis "familieudflug" er et motiv og det er sommer, lean ind i familieoplevelsesframing. Hvis "turist_oplevelse" er til stede, inkluder en distinkt lokal vinkel.
` : ''}

UGE KONTEKST:
${(() => {
  const wi = context.weather_interpretation;
  if (wi) {
    const lines: string[] = [];
    lines.push(`Nedbørsdage: ${wi.precipitation_days && wi.precipitation_days.length > 0 ? wi.precipitation_days.join(', ') : 'ingen'}`);
    lines.push(`Ugens vejrkarakter: ${wi.week_character ?? wi.operational_note}`);
    lines.push(`  Bias: ${wi.indoor_outdoor_bias} | Weekend: ${wi.weekend_usability}${ wi.strongest_opportunity_day ? ` | Bedste dag: ${wi.strongest_opportunity_day}` : ''}${ wi.strongest_constraint_day ? ` | Sværeste dag: ${wi.strongest_constraint_day}` : ''}`);
    return lines.join('\n');
  }
  // Fallback: raw weather summary if interpretation not available
  return `Vejr: ${context.weather.pattern}, ${context.weather.avg_temp}°C gennemsnit`;
})()}

VEJR DAG-TIL-DAG (tidsmæssige mønstre — brug blød formulering for dag 5-7):
${context.weather.days.map(d => {
  const date = new Date(d.date);
  const weekdayNames = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør'];
  const weekday = weekdayNames[date.getDay()];
  const hedge = d.reliability === 'cautious' ? ' ~usikker' : d.reliability === 'seasonal' ? ' ~sæson-estimat' : '';
  return `${weekday}: ${d.temp_min}-${d.temp_max}°C${d.precipitation_chance ? `, ${d.precipitation_chance}% regn` : ''}${d.wind_speed ? `, ${d.wind_speed}m/s vind` : ''}${hedge}`;
}).join(' | ')}

Sæson: ${context.season.current}
${(() => {
  const relevance = (context as any).economic_relevance_for_business as string | undefined;
  if (context.economic.payday_this_week && (relevance ?? 'medium') !== 'low') {
    const dayLabel = context.economic.payday_day_name ? ` (${context.economic.payday_day_name})` : '';
    const note = relevance === 'high'
      ? 'gæsterne er klar til at bruge penge på noget særligt'
      : 'gæsterne har lidt mere at bruge af end normalt';
    return `Timing: Lønningsuge${dayLabel} — ${note}`;
  }
  return `Timing: Uge ${context.economic.week_of_month}/4`;
})()}
Events: ${(context.events || []).length > 0 ? context.events.map((e: any) => {
  const weight = e.commercial_weight ?? e.weight ?? 2;
  // Holidays always get ★★★ regardless of commercial_weight — they define the week
  const star = e.type === 'holiday' ? ' ★★★' : weight >= 5 ? ' ★★★' : weight >= 4 ? ' ★★' : weight >= 3 ? ' ★' : '';
  // Tag events that fall outside this week so the AI treats them as lead-up context only
  const label = e.in_week === false ? `${e.name_dk}${star} (kommende uge)` : e.name_dk + star;
  return label;
}).join(', ') : 'Ingen'}${(context.events || []).some((e: any) => e.in_week !== false && (e.type === 'holiday' || (e.commercial_weight ?? e.weight ?? 2) >= 4)) ? `\n⚠️ HØJTPRIORITERET ANLEDNING (★★+): Helligdag eller kommercielt stærk begivenhed i DENNE uge. Planen SKAL afspejle dette i week_summary og mindst 1 post der direkte adresserer anledningen (reservation, særlig menu eller tilbud).
MÅ IKKE ignoreres til fordel for vejr eller lønning alene.` : ''}${(context.events || []).some((e: any) => e.in_week === false && (e.type === 'holiday' || (e.commercial_weight ?? e.weight ?? 2) >= 4)) ? `\nℹ️ KOMMENDE ANLEDNING (næste uge): Begivenhed vises som kontekst til lead-up planlægning. Den TILHØRER IKKE denne uges dage og må IKKE nævnes som om den sker i denne uge.` : ''}
${context.previous_week.data_available && context.previous_week.top_post ? `Bedste post sidste uge: ${context.previous_week.top_post.content_type} (+${Math.round((context.previous_week.top_post.performance_vs_avg - 1) * 100)}%)` : ''}
${context.previous_week.selection_patterns && context.previous_week.selection_patterns.weeks_analyzed >= 1 ? (() => {
  const sp = context.previous_week.selection_patterns;
  // Apply floor of 15% so no goal_mode type can be squeezed out of the plan by history alone
  const FLOOR = 0.15;
  const rawRates = sp.goal_mode_rates as Record<string, number>;
  const floored = Object.fromEntries(Object.entries(rawRates).map(([k, v]) => [k, Math.max(v, FLOOR)]));
  const flooredTotal = Object.values(floored).reduce((s, v) => s + v, 0);
  const normalized = Object.fromEntries(Object.entries(floored).map(([k, v]) => [k, v / flooredTotal]));
  const rateLines = Object.entries(normalized)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .map(([mode, rate]) => {
      const label = mode === 'drive_footfall' ? 'besøgsposter' : mode === 'build_brand' ? 'brandposter' : 'loyalitetsposter';
      return `  • ${Math.round((rate as number) * 100)}% ${label}`;
    }).join('\n');
  return `\n📊 HISTORISK BRUGERPRÆFERENCE (de seneste ${sp.weeks_analyzed} uge${sp.weeks_analyzed !== 1 ? 'r' : ''} — hvad brugeren faktisk valgte at publicere):\n${rateLines}\nBrug dette som blød indikator ved fordeling af mål-types. Alle tre typer skal altid repræsenteres i planen — historik kan justere vægtningen men ikke eliminere en type. Afvig kun fra vægten hvis denne uges kontekst (vejr, events, timing) taler kraftigt imod.`;
})() : ''}
${context.previous_week.posted_menu_items.length > 0 ? `\n⛔ DISSE MENUPUNKTER MÅ IKKE VÆLGES DENNE UGE (brugt inden for de seneste 1-2 uger):\n${context.previous_week.posted_menu_items.map((item: string) => `  • ${item}`).join('\n')}\nVælg andre retter fra menukortets kategorier.` : ''}
${context.owner_note ? `\n🗒️ EJERENS NOTE DENNE UGE (HØJESTE PRIORITET — lad dette forme hele planen):\n"${context.owner_note}"\nDette er en direkte instruktion fra ejeren. Reflektér den i week_summary, competitive_advantage og mindst én vinkels content_direction.` : ''}
${(() => {
  const pct = context.previous_week.posted_content_types as string[] | undefined;
  if (!pct || pct.length < 3) return '';
  const recent = pct.slice(-4); // look at last 4 posts
  const menuVisualCount = recent.filter(t => t === 'product_menu' || t === 'craving_visual').length;
  const humanCount = recent.filter(t => t === 'behind_scenes' || t === 'team_people').length;
  if (menuVisualCount >= 3 && humanCount === 0) {
    return `\n⛔ INDHOLDSTYPEBALANCE: De seneste ${recent.length} posts har haft ${menuVisualCount} mad/produkt-posts (product_menu/craving_visual) og ingen menneskeposter — denne uge SKAL inkludere mindst 1 post af typen \'behind_scenes\' eller \'team_people\' for at bevare variationen.`;
  }
  if (menuVisualCount >= 3) {
    return `\n💡 INDHOLDSTYPEBALANCE: Mange mad/produkt-posts de seneste uger (${menuVisualCount} af ${recent.length}) — overvej om slot C (brand builder) med fordel kan være \'behind_scenes\' eller \'team_people\' for at vise menneskene bag stedet.`;
  }
  return '';
})()}
${(() => {
  const psct = (context.previous_week as any).previous_slot_content_types as Array<{ slot_id: string; content_category: string }> | undefined;
  if (!psct || psct.length === 0) return '';
  const slotMap: Record<string, string> = {};
  for (const s of psct) slotMap[s.slot_id] = s.content_category;
  // Only show C and D — A and B (drive_footfall) are intentionally stable
  const slotLines = (['C', 'D'] as const)
    .map(id => slotMap[id] ? `  • Slot ${id} (${id === 'C' ? 'build_brand' : 'retain_loyalty'}): ${slotMap[id]}` : null)
    .filter(Boolean);
  if (slotLines.length === 0) return '';
  const allSame = slotLines.length === 2; // Only suggest rotation when we have both slots
  return `\n🔄 FORRIGE UGES INDHOLDSTYPEFORDELING (Slots C + D):\n${slotLines.join('\n')}\n${allSame ? `Undgå at "suggested_content_category" for build_brand- og retain_loyalty-vinkler gentager nøjagtig samme kombination som forrige uge.\nByt om — fx hvis forrige uge var C=team_people og D=behind_scenes, brug C=behind_scenes og D=team_people (eller craving_visual) denne uge.\nGentag kun samme type, hvis ingen anden type passer til ugens kontekst (events, mål, vejr).` : `Overvej at variere "suggested_content_category" for enten build_brand- eller retain_loyalty-vinklen i forhold til forrige uge.`}`;
})()}
${(() => {
  const pws = (context.previous_week as any).past_week_summaries as Array<{ week_number: number; week_summary: string; overview: string }> | undefined;
  if (!pws || pws.length === 0) return '';
  const entryLines: string[] = [];
  pws.forEach(s => {
    if (s.week_summary) entryLines.push(`Uge ${s.week_number}: "${s.week_summary}"`);
  });
  if (entryLines.length === 0) return '';
  const eventsLine = (context.events || []).length > 0
    ? (context.events || []).map((e: any) => e.name_dk || e.name).join(', ')
    : 'ingen events denne uge';
  return `\nFORRIGE UGERS UGSBESKRIVELSE (til reference — disse tekster er allerede sendt til ejeren):\n${entryLines.join('\n')}\n\nUGSDIFFERENTIERING — OBLIGATORISK FOR week_summary:\nDin week_summary SKAL indeholde mindst én sætning der specifikt beskriver NETOP DENNE uge og ikke ville passe til ugerne ovenfor.\nMulige differentierings-signaler (vælg det mest konkrete):\n  • Temperatur denne uge — skriv det faktiske tal, ikke "varmere/koldere"\n  • Nedbørsdage denne uge — antal og hvilke dage (se Nedbørsdage ovenfor)\n  • Events: ${eventsLine}\n  • Lønningsuge: ${context.economic.payday_this_week ? 'JA — gæsterne har mere at bruge af' : 'NEJ — normal forbrugsuge'}\n  • Ugeprofil: ${context.available_days?.length || 0} åbne dage — hverdags- eller weekendtung?\n  • Sæsonændring der sker præcis i denne uge\nFORBUDT GENTAGELSE: Ord-for-ord eller nær-identisk gentagelse af formuleringer fra ugerne ovenfor. Omskriv — selv hvis observationen er lignende.`;
})()}
${(() => {
  const paf = (context.previous_week as any).previous_angle_focuses as string[] | undefined;
  if (!paf || paf.length === 0) return '';
  return `\n📋 FORRIGE UGERS DOMINANTE VINKLER (blød vejledning — undgå direkte gentagelse):\n${paf.map((f: string) => `  • "${f}"`).join('\n')}\nHvis en af dine kandidat-vinkler ligner en af ovenstående (samme occasion-type, samme dagsdel, samme gæstetrigger), skal du enten:\n  a) Reframe den med et konkret anderledes udgangspunkt (anden dagdel, anden gæstetype, anderledes begivenhed)\n  b) Erstatte den med en lavere-vægtet kandidat der differentierer\nUndtagelse: Gentag gerne samme tema hvis denne uges kontekst (vejr, events, lønning) specifikt peger på netop den vinkel igen — men skriv den da anderledes (ny indgang, ny detalje, nyt konkret datapunkt).`;
})()}

${context.weather.has_outdoor_seating ? `UDESERVERING-REGLER (Danmark):
- Optimalt: 18-25°C, sol, svag vind, tørvejr
- Minimum: +15°C, sol, vindstille
- Forår (april/maj): Starter når +15°C, sol, vindstille
- Sommer (juni-august): Højsæson med høj sol og lune aftener
- Sensommer/efterår: Muligt når +15°C, sol, vindstille
- Under 15°C eller blæst/regn: Udeservering IKKE attraktiv
` : ''}

SKRIV PRÆCIST:
• Brug de faktiske tal fra data. Vejr skrives som: "7°C mandag, falder til 2°C torsdag" — ikke "koldt vejr".
• NEDBØRSPRÆCISION: Brug KUN 'Nedbørsdage'-listen for præcis nedbørsspand. Skyet/delvist skyet vejr er IKKE nedbør. Skriv ALDRIG "regn/sne mandag–onsdag" hvis Nedbørsdage kun viser mandag. Cloudy-dage er ikke nedbørsdage.
• Skriv som marketing-chef der briefer ejeren med konkrete fakta — ikke som konsulent der genererer slides.
• Undgå: positionere, facilitere, optimere, markant behov, kontinuerlig appel, appellerer til.

${(() => {
  const candidatesV2 = (context as any).strategic_priority_candidates_v2 as Array<any> | undefined;
  if (!candidatesV2 || candidatesV2.length === 0) return '';
  const highConf = candidatesV2.filter((c: any) => c.confidence >= 0.70);
  const lines: string[] = [];
  lines.push('\nSTRATEGISKE KANDIDATER (forberegnet — confidence \u2265 0.70 SKAL adresseres):');
  candidatesV2.forEach((c: any) => {
    const marker = c.confidence >= 0.70 ? '\u2605' : '○';
    lines.push(`  ${marker} ${c.label} (${Math.round(c.confidence * 100)}%)`);
    lines.push(`     G\u00e6steadf\u00e6rd: ${c.customer_behavior_reason}`);
    lines.push(`     Forretning: ${c.business_reason}`);
  });
  if (highConf.length > 0) {
    lines.push(`\n  REGEL: De ${highConf.length} kandidater med \u2605 SKAL v\u00e6re repræsenteret i mindst ét fokusomr\u00e5de. Du v\u00e6lger formulering og framing — ikke indholdet af strategien.`);
  }
  return lines.join('\n');
})()}

${context.strategic_priority_candidates && context.strategic_priority_candidates.length > 0 && !(context as any).strategic_priority_candidates_v2?.length ? `UGENS PRIORITETER (forberegnet — brug som udgangspunkt, ikke som tvang):
${context.strategic_priority_candidates.map((p: string, i: number) => `  ${i + 1}. ${p}`).join('\n')}
` : ''}

${(() => {
  const cs = (context.brand_voice as any)?.content_strategy;
  const gb = cs?.week_goal_blend ?? cs?.goal_blend;
  const cw = cs?.week_content_category_weights ?? cs?.content_category_weights;
  const lines: string[] = [];
  if (gb) {
    const total = (gb.drive_footfall ?? 0) + (gb.build_brand ?? 0) + (gb.retain_loyalty ?? 0);
    if (total > 0) {
      const df = Math.round((gb.drive_footfall ?? 0) / total * 100);
      const bb = Math.round((gb.build_brand ?? 0) / total * 100);
      const rl = Math.round((gb.retain_loyalty ?? 0) / total * 100);
      lines.push(`Mål-fordeling (fra brand-profil): ${df}% besøgsdrivende · ${bb}% brand · ${rl}% loyalitet`);
    }
  }
  if (cw) {
    const catLabels: Record<string, string> = {
      product_menu: 'produkt',
      craving_visual: 'stemningsfulde madbilleder',
      behind_scenes: 'bag-om',
      team_people: 'menneskeposts',
    };
    const cats = (['product_menu', 'craving_visual', 'behind_scenes', 'team_people'] as const)
      .map(k => [k, cw[k] ?? 0] as [string, number])
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
    const catTotal = cats.reduce((s, [, v]) => s + v, 0);
    if (catTotal > 0) {
      lines.push(`Indholdsfordeling (fra brand-profil): ${cats.map(([k, v]) => `${Math.round(v / catTotal * 100)}% ${catLabels[k]}`).join(' · ')}`);
    }
  }
  return lines.length > 0
    ? lines.join('\n')
    : `Skab ${targetPostCount} vinkler med variation — mix menu-retter, stemning og mennesker.`;
})()}

${(() => {
  const guardrails = (context as any).narrative_guardrails as string[] | undefined;
  if (!guardrails || guardrails.length === 0) return '';
  return `SPROGLIGE GUARDRAILS (UFRAVIGELIGE — gælder for AL tekst i denne brief):\n${guardrails.map((g: string) => `  • ${g}`).join('\n')}\n`;
})()}
${(() => {
  const weekMode   = (context as any).week_mode as string | undefined;
  const deprioList = (context as any).deprioritize as string[] | undefined;
  const parts: string[] = [];
  if (weekMode && weekMode !== 'standard_week') {
    parts.push(`UGENS TILSTAND: ${weekMode.replace(/_/g, ' ')}`);
    // Add concrete commercial framing guidance per week_mode type
    if (weekMode.includes('indoor_refuge')) {
      parts.push(`KOMMERCIEL FORTOLKNING AF INDOOR_REFUGE: Regnfuldt/koldt vejr reducerer spontan udegang. For denne virksomhed betyder det øget sandsynlighed for planlagte frokostbesøg og kaffepause-besøg indenfor. Framing skal handle om BESØGSKONKURRENCEN (hvorfor vælge netop dette sted frem for ingen tur) — ikke om vejret som stemning.`);
    } else if (weekMode.includes('terrace')) {
      parts.push(`KOMMERCIEL FORTOLKNING AF TERRACE: Godt vejr øger spontan udegang og terrasse-trafik. Framing skal handle om det konkrete udendørs tilbud og hvornår på dagen det er bedst — ikke om "sommerfølelse" eller generel glæde.`);
    } else if (weekMode.includes('takeaway')) {
      parts.push(`KOMMERCIEL FORTOLKNING AF TAKEAWAY: Vejret øger demand for mad man tager med frem for at spise ude. Framing skal handler om convenience, hurtig ekspedition og konkret takeaway-tilbud — ikke om vejret som barriere.`);
    }
  }
  if (deprioList && deprioList.length > 0) {
    parts.push(`DEPRIORITÉR DENNE UGE: ${deprioList.join(', ')}\nDisse vinkler skal IKKE tildeles kapacitet — de har lav relevans for denne virksomhed i denne uge.`);
  }
  return parts.length > 0 ? parts.join('\n') + '\n' : '';
})()}
${buildForbiddenBlock('brief')}

REGLER:
1. Lav præcis ${targetPostCount} fokus-områder — ét per post denne uge.
   FOKUS-NAVN REGLER ("focus"-felt):
   - Navne SKAL være handlingsorienterede og bundet til observerbar adfærd, dagsdel eller et konkret location-argument
   - Brug formlen: [dagsdel/adfærd] + [situation/mekanisme] — fx "Hverdagsfrokost som indendørs destination", "Planlagt aftenbesøg torsdag–lørdag", "Søndag brunch — tilbagevendende ritual"
   ✗ FORBUDT i focus-navne: "frirum", "fristed", "oase", "refugium", "forkælelse", "stemning", "hygge", "ro", "atmosfære" — og andre abstrakte stemningsord
   ✗ FORBUDT: vejr-ord som suffix, prefix eller qualifier i fokus-navne — uanset vejrtype (temperatur, nedbør, vind, sæson):
     "i regnvejr", "i regnen", "på regnvejrsdage", "ved regnvejr", "i solrigt vejr", "i køligt vejr", "i vintervejr", "i det kolde vejr", "i blæsevejr"
     PRINCIPPET: Vejret forklarer i reasoning HVORFOR adfærden sker — det er ikke del af fokus-NAVNETS job.
     Fokus-navnet beskriver adfærden. Vejret er altid kontekst, aldrig navn.
     ✗ "Indendørs kaffepause i regnvejr" → ✓ "Spontan frokostpause tirsdag–torsdag"
     ✗ "Frokostpause indendørs på regnvejrsdage" → ✓ "Hverdagsfrokost som indendørs mødested"
   ✗ FORBUDT: lokation som dekorativt suffix — "Aftenmåltid ved åen", "Brunch ved åen" — lokationen er KUN tilladt som det egentlige valg-argument, fx "Åen som mødestedsargument"
   ✗ FORBUDT: generiske navne som "Frokost" eller "Aften" uden situation eller mekanisme
   ✓ KORREKT: navne der ikke ville passe på en anden type forretning i en anden by
2. Hvert område SKAL bruge: brand profile + menu + vejr/events + timing
3. reasoning = 2-4 sætninger — se FELT: angles[].reasoning nedenfor for de tre obligatoriske forankringspunkter.
4. Nævn ALDRIG specifikke menu-retter (kun kategorier som "varme retter", "klassikere")
5. Mindst ét fokus-område skal åbne for oplevelse-posts (ikke kun produkt): fx "Placeringen ved [lokationsfordel] som møde- og destinationsargument", "Morgenens åbningsritual", "Bag ved disken på en regnfuld tirsdag"
6. competitive_advantage: Se krav nedenfor i JSON-instruktionen
7. Vægte summer til 1.0
8. Nævn KUN konkrete ingredienser/råvarer hvis de fremgår af "Menustøttede sæsonråvarer" fra konteksten. Brug sæsonatmosfære-signaler til framing og stemning — ikke til specifikke ingrediensløfter.

─────────────────────────────────────────────────────────
FELT: week_summary
─────────────────────────────────────────────────────────
Præcis 3–4 sætninger. Struktur OBLIGATORISK — en sætning per punkt:

  SÆT. 1 — ADFÆRDSÆNDRING (ikke vejrbeskrivelse):
    Hvad ændrer sig i gæsternes adfærd denne uge, og hvornår?
    ✓ "7°C og regn mandag–onsdag øger spontane [primær dagsdel]-besøg indendørs [tidspunkt fra profil]"
    ✗ "Vejret er koldt og udfordrende denne uge" / "Foråret er på vej og stemningen er god" (deskriptivt/atmosfære — ikke adfærd)

  HELLIGDAG/FERIE-REGEL — OBLIGATORISK (overskriver normale prioriteringer):
    Hvis Events-listen indeholder en helligdag (★★★) eller en skoleferie, SKAL SÆT. 1 nævne begivenheden ved navn som den primære adfærdsdriver.
    Vejr og lønning er sekundære signaler — de kan nævnes i SÆT. 2–3, men ALDRIG som primærdriver i SÆT. 1 når en helligdag er til stede.
    ✓ "Påskeferie og Skærtorsdag torsdag skifter ugens rytme — familier er fri og søger restaurantoplevelser onsdag–søndag"
    ✓ "Langfredag og Påskesøndag definerer ugen — lukket eller reduceret drift giver anledning til tidlig kommunikation om åbningstider og særmenu"
    ✗ "Regn alle dage og lønningsuge fra tirsdag..." (ignorerer tilstedeværende helligdag — UGYLDIG hvis helligdag er i Events)

  SÆT. 2 — VIRKSOMHEDSSPECIFIK KOMMERCIEL IMPLIKATION (DENNE UGE — IKKE ALTID):
    Svar på: Hvorfor matcher NETOP DENNE virksomhed den adfærdsændring NETOP DENNE UGE?
    Vælg det mest uge-specifikke anker — mindst ét skal skifte uge til uge:
      • Hvilken servicetid bærer belastningen denne uge? (dagsdel + konkret tidsrum fra profil)
      • Er det primært en hverdags- eller weekendstyret uge — og hvad giver det dette sted?
      • Hvad er en konkret egenskab ved stedet der præcis matcher DENNE uges dominante mønster?
    TEST 1: Passer sæt. 2 på 20 andre spisesteder? → Ugyldig. Skriv om.
    TEST 2: Er sæt. 2 sand HVER eneste uge uanset vejr og events? → Ugyldig. Tilføj det uge-specifikke anker.
    ✓ "[Navn] dækker [konkret tidsrum fra profil] — det er præcis det spænd [hverdags/weekend-profil] øger belastningen på"
    ✗ "[Navn] er stedet der altid tilbyder god mad og god stemning" / "Beliggenheden ved åen gør stedet attraktivt" (statisk — ikke uge-specifik)

  SÆT. 3 — KONKRET KOMMERCIEL PRIORITET DENNE UGE:
    Hvad er det ene præcise taktiske træk: dagsdel + menu-kategori + content-vinkel.
    ✓ "Prioritér [primær dagsdel]-CTA [hverdage] [tidspunkt fra profil] med fokus på [relevant menukategori]"
    ✗ "Content denne uge bør fokusere på mad og oplevelser" (ikke konkret)

  SÆT. 4 — VALGFRI DE-PRIORITERING:
    Kun hvis der er noget der konkret skal nedprioriteres denne uge.
    Udelad hvis ingen reel modvægt eksisterer.

FORBUDT i dette felt:
  - Summaries der kun beskriver vejret som stemning eller kulisse
  - Summaries der kun anbefaler generelle menukategorier uden timing og mekanisme
  - Summaries der kun beskriver atmosfære uden adfærdskobling
  - Alle vendinger fra FORBUDTE VENDINGER-listen
  - Abstrakt kommercielt sprog: "aktivt valg", "aktivt destinationsvalg", "anledningsbesøg", "destination for" — erstat med konkret besøgstype: fx "planlagte aftenbesøg", "weekendbrunch", "frokostpause", "middag ude"
FORBUDT ved indoor_refuge: beskriv ALDRIG vejret som stemning — beskriv det som besøgsadfærd og kommerciel mekanisme.

─────────────────────────────────────────────────────────
FELT: competitive_advantage
─────────────────────────────────────────────────────────
MÅL: Bevis at NETOP DENNE virksomhed har en konkret fordel NETOP DENNE uge — ikke bare "er en god restaurant".

STRUKTUR (2 sætninger — begge obligatoriske):
  SÆT. A — start ALTID med: "Netop denne uge er fordelen, at …"
            Angiv den primære fit-dimension med konkrete data fra konteksten.
            ✓ "Netop denne uge er fordelen, at [navn] er [business_mode-specifik position fra profil]
               — regnfuld uge mandag–torsdag øger sandsynlighed for netop dette besøgsmønster [tidspunkt fra profil]"
            ✗ "Netop denne uge er fordelen, at de har god mad og hyggelig atmosfære"

  SÆT. B — angiv den sekundære fit-dimension fra en anden kategori end sæt A.
            Brug en konkret egenskab (dagsdel, menuform, driftsmodel, besøgsmotiv).

KRÆVER mindst 2 af disse 5 dimensioner — nævn dem eksplicit:
  1. Lokationsadfærd     — hvad giver location_behavior_mode en specifik fordel DENNE uge?
  2. Servicetidsfit      — hvad matcher primary_daypart_this_week eller menusammensætningen konkret?
  3. Driftsmodelfordel   — hvad giver business_mode en strukturel fordel i denne uges kontekst?
  4. Besøgsmotivfit      — hvad matcher primary_visit_motivation præcist DENNE uge?
  5. Ugespecifik fit     — hvad gør week_mode, et event eller en timing-faktor særlig relevant?

TEST: Kunne denne tekst bruges til en anden restaurant i en anden by DENNE uge? → Ugyldig. Skriv om.
FORBUDT som standalone-begrundelse: kvalitet, lokal, autentisk, hyggelig — med mindre direkte knyttet til et konkret faktum fra konteksten.
FORBUDT: abstrakt kommercielt sprog — "aktivt valg", "anledningsbesøg", "aktivt destinationsvalg" — erstat med konkret: fx "planlagte aftenbesøg", "weekendbrunch", "frokostpause".

─────────────────────────────────────────────────────────
FELT: angles[].reasoning
─────────────────────────────────────────────────────────
2–4 sætninger. ALLE tre forankringspunkter skal være til stede:
  a) ADFÆRD:         Observerbar gæsteadfærdsændring denne uge (vejr, event, timing — ikke redaktionel)
  b) VIRKSOMHEDSFIT: Hvorfor NETOP denne virksomhed matcher den adfærd (driftsform, menu, location_behavior_mode)
  c) UGE-RELEVANS:   Hvorfor NETOP denne vinkel virker denne uge (week_mode, dagsdel, content_role)
En reasoning der mangler ét af de tre punkter er ugyldig.

─────────────────────────────────────────────────────────
FELT: angles[].content_direction
─────────────────────────────────────────────────────────
Dette felt er DEN ENESTE BRO fra strategisk analyse til konkret posteksekveringen.
Post-generatoren læser dette felt direkte — IKKE reasoning. Skriv det som en instruktion til en content-skaber, ikke som en analyse.

3 dele i ét felt — adskil med " — ":

  a) FORMAT-VALG: "[category] fordi [konkret fit-argument med dagsdel/timing]"
     ✗ FORBUDT: "product_menu da det er en foodpost" (ingen adfærdskobling)
     ✓ KORREKT: "product_menu fordi regnvejr mandag–torsdag øger konverteringsværdien af en konkret ret + booking-CTA ved frokoststart kl. 12"
     ✓ KORREKT: "behind_scenes fordi slot C på mandag er brandidentitets-post — vis det konkrete morgenritual inden åbning, ikke mad"

  b) KREATIV KERNE: Beskriv det SPECIFIKKE, OBSERVERBARE øjeblik eller scene der vises i posten.
     ✗ FORBUDT: "vis retten på en appetitvækkende måde" (generisk — passer på alle restauranter)
     ✗ FORBUDT: "vis stedet i en hyggelig stemning indendørs" (atmosfære uden anker)
     ✓ KORREKT: "vis dampende suppe med synlige grøntsager i dagslys fra vindue — fokus på tekstur og damp"
     ✓ KORREKT: "vis det øjeblik terrassen klargøres — tomme borde, stearinlys tændes, ikke en gæst i syne"

  c) GÆSTE-HANDLING: Præcis én adfærd gæsten skal trigges til, bundet til timing.
     ✗ FORBUDT: "engager gæsterne" (for bredt)
     ✓ KORREKT: "trigger spontant frokostbesøg tirsdag–torsdag 12–14"
     ✓ KORREKT: "plant booking-intention til torsdagsaften inden weekend"
     ✓ KORREKT: "aktivér loyalitet via genkendelse af det ugentlige åbningsritual"

TEST: Kan en post-generator skrive et konkret post KUN fra dette felt + brand voice? Hvis svaret er "hvad skal jeg vise?" er feltet ikke konkret nok.

${(() => {
  const weekMode = (context as any).week_mode as string | undefined;
  if (!weekMode || weekMode === 'standard_week') return '';
  const lines: string[] = ['─────────────────────────────────────────────────────────'];
  lines.push(`AKTIV UGE-FRAMING: ${weekMode.replace(/_/g, ' ').toUpperCase()}`);
  if (weekMode.includes('indoor_refuge')) {
    lines.push('→ Vejret i ALLE felter: beskriv som besøgsmekanisme (hvornår, hvem, sandsynlighed for besøg) — IKKE som stemning, kulisse eller hygge-argument.');
    lines.push('→ Venue-atmosfære som konkurrencefordel er FORTSAT TILLADT — men skal bindes til en konkret egenskab (interiørform, siddearrangement, driftsmodel), ikke til vejret.');
  } else if (weekMode.includes('terrace')) {
    lines.push('→ Vejret i ALLE felter: beskriv det konkrete udendørs tilbud og hvornår på dagen det er optimalt — IKKE som "sommerfølelse" eller generel naturglæde.');
    lines.push('→ Terrasse-stemning som konkurrencefordel er TILLADT — bind det til konkret dagsdel, kapacitet eller siddearrangement.');
  } else if (weekMode.includes('takeaway')) {
    lines.push('→ Vejret i ALLE felter: beskriv convenience, ekspeditionshastighed og konkret tilbud — IKKE vejret som stemnings-barriere for udegang.');
    lines.push('→ Vurder om venue-atmosfære er relevant denne uge, eller om besøgsincitamentet er rent convenience-drevet.');
  }
  lines.push('─────────────────────────────────────────────────────────');
  return lines.join('\n') + '\n';
})()}
SVAR I JSON-FORMAT (præcis ${targetPostCount} objekter i "angles"):
{
  \"week_summary\": \"[skriv 3-4 sætninger jf. FELT: week_summary ovenfor]\",
  \"competitive_advantage\": \"[SÆT. A starter med 'Netop denne uge er fordelen, at …' + SÆT. B sekundær dimension — jf. FELT: competitive_advantage ovenfor]\",
  \"angles\": [
    {
      \"focus\": \"[dagsdel/adfærd + location/mekanisme — IKKE stemning/frirum/oase]\",
      \"weight\": 0.5,
      \"reasoning\": \"[a) adfærd b) virksomhedsfit c) uge-relevans — jf. FELT: angles[].reasoning]\",
      \"menu_alignment\": \"Hvilke menu-kategorier understøtter denne vinkel\",
      \"content_direction\": \"[a) format-valg fordi timing/adfærd-argument] — [b) konkret scene/øjeblik der VISES] — [c) præcis gæste-handling + timing] — jf. FELT: angles[].content_direction\",
      \"suggested_content_category\": \"product_menu\",
      \"phase0_factors_used\": [\"special_day:Valentinsdag\", \"weather:cold_indoor\"]
    }
  ]
}
`;
}

// ============================================================
// MENU CAPABILITIES ANALYZER
// ============================================================

export function analyzeMenuCapabilities(context: WeekContext): MenuCapabilities[] {
  const items = context.signature_items;
  const capabilities: MenuCapabilities[] = [];

  if (items.length > 0) {
    capabilities.push({
      category: 'Signatur-retter',
      count: items.length,
      strategic_value: 'Høj genkendelse, etableret brand-værdi'
    });
  }

  const n = (i: { name: string }) => i.name.toLowerCase();

  const hasWarmDishes  = items.some(i => /gryde|bøf|steg|pasta|risotto|curry|frikadell|schnitzel|kylling|laks/.test(n(i)));
  const hasSoups       = items.some(i => /suppe|soup/.test(n(i)));
  const hasCoffee      = items.some(i => /kaffe|coffee|espresso|latte|cappuccino|americano/.test(n(i)));
  const hasPastries    = items.some(i => /croissant|bolle|bagværk|kage|muffin|scone|wienerbrød/.test(n(i)));
  const hasSalads      = items.some(i => /salat/.test(n(i)));
  const hasSandwiches  = items.some(i => /sandwich|smørrebrød|toast|wrap|burger/.test(n(i)));
  const hasBrunchItems = items.some(i => /omelett|pancake|pandekage|benedict/.test(n(i)));
  const hasDesserts    = items.some(i => /dessert|tærte|fondant|brownie|tiramisu/.test(n(i)));

  if (hasWarmDishes)  capabilities.push({ category: 'Varme retter',            count: Math.ceil(items.length * 0.5), strategic_value: 'Passer til koldt vejr, comfort-content' });
  if (hasSoups)       capabilities.push({ category: 'Supper',                   count: Math.ceil(items.length * 0.2), strategic_value: 'Varm og mættende — stærk ved regnvejr og kulde' });
  if (hasCoffee)      capabilities.push({ category: 'Kaffemenu',                count: Math.ceil(items.length * 0.3), strategic_value: 'Hverdagsritual — loyalitet og daglig gentagelse' });
  if (hasPastries)    capabilities.push({ category: 'Bagværk og sødt',          count: Math.ceil(items.length * 0.3), strategic_value: 'Supplement til kaffe, impuls ved brunch' });
  if (hasSalads)      capabilities.push({ category: 'Salater',                  count: Math.ceil(items.length * 0.2), strategic_value: 'Let og frisk — passer til sol og sommerperiode' });
  if (hasSandwiches)  capabilities.push({ category: 'Sandwich og lette retter', count: Math.ceil(items.length * 0.3), strategic_value: 'Hurtig frokost og take-away-venlig' });
  if (hasBrunchItems) capabilities.push({ category: 'Brunch og æggeret',        count: Math.ceil(items.length * 0.2), strategic_value: 'Weekendbrunch — planlagt besøg, høj dwell-time' });
  if (hasDesserts)    capabilities.push({ category: 'Dessert',                  count: Math.ceil(items.length * 0.2), strategic_value: 'Premium afslutning — loyalitets- og wow-content' });

  // Service-period fallback when item list is too sparse to yield useful capability hits
  if (capabilities.length <= 1) {
    const periods = (context.service_periods as string[] | undefined) ?? [];
    if (periods.includes('dinner'))                                    capabilities.push({ category: 'Aftenmenu',       count: 3, strategic_value: 'Aftenservering — planlagte besøg og premium' });
    if (periods.includes('lunch') || periods.includes('brunch'))       capabilities.push({ category: 'Frokost/brunch',  count: 3, strategic_value: 'Dagsbesøg — frokost og brunch' });
    if (periods.includes('morning') || periods.includes('breakfast'))  capabilities.push({ category: 'Morgen og kaffe', count: 3, strategic_value: 'Morgensegment — daglig rutine, kaffe og bagværk' });
  }

  return capabilities;
}

// ============================================================
// SLOT METADATA ASSIGNMENT (Step 2 – Deterministic slot system)
// ============================================================

/**
 * Slot definitions (4 fixed weekly content slots):
 *
 *  A — Footfall driver   goal_mode=drive_footfall  category=product_menu     Fri-Sat 14:00
 *  B — Footfall support  goal_mode=drive_footfall  category=product_menu     Wed-Thu 11:00
 *  C — Brand builder     goal_mode=build_brand     category=behind_scenes    Mon 09:00
 *  D — Flexible          goal_mode=contextual      category=contextual       any
 *
 * When N < 4, fewer slots are used (priority order: A → B → C → D).
 * When N > 4, slot D is repeated (as D1, D2, ...) with alternating categories.
 *
 * category_weights from content_strategy are used to pick the category for slot D.
 */
type GoalMode = 'drive_footfall' | 'build_brand' | 'retain_loyalty';
type ContentCategory = 'product_menu' | 'craving_visual' | 'behind_scenes' | 'team_people';

interface SlotTemplate {
  slot_id: 'A' | 'B' | 'C' | 'D';
  goal_mode: GoalMode;
  content_category: ContentCategory;
  timing_window: string;
}

const BASE_SLOTS: SlotTemplate[] = [
  { slot_id: 'A', goal_mode: 'drive_footfall', content_category: 'product_menu',   timing_window: 'Fri-Sat 14:00' },
  { slot_id: 'B', goal_mode: 'drive_footfall', content_category: 'product_menu',   timing_window: 'Wed-Thu 11:00' },
  { slot_id: 'C', goal_mode: 'build_brand',    content_category: 'behind_scenes',  timing_window: 'Mon 09:00' },
  { slot_id: 'D', goal_mode: 'retain_loyalty', content_category: 'craving_visual', timing_window: 'any' },
];

/**
 * Compatible content categories per goal_mode, ranked by default priority.
 * Used when content_category_weights is not available.
 */
const COMPATIBLE_CATS: Record<GoalMode, ContentCategory[]> = {
  drive_footfall: ['product_menu', 'craving_visual'],
  build_brand:    ['behind_scenes', 'team_people'],
  retain_loyalty: ['craving_visual', 'behind_scenes', 'team_people', 'product_menu'],
};

/**
 * Pick the i-th best content_category for a goal_mode (0 = first post, 1 = second, etc.).
 * Ranks the compatible category set by content_category_weights when available,
 * otherwise uses the default priority order from COMPATIBLE_CATS.
 * This ensures the category mix across all slots reflects the brand's Post Strategi.
 */
function pickCategory(
  goalMode: GoalMode,
  pickIndex: number,
  ccWeights: Record<string, number> | undefined
): ContentCategory {
  const compatible = COMPATIBLE_CATS[goalMode];
  if (!ccWeights) {
    return compatible[pickIndex % compatible.length];
  }
  const ranked = [...compatible].sort((a, b) => (ccWeights[b] ?? 0) - (ccWeights[a] ?? 0));
  return ranked[pickIndex % ranked.length];
}

/**
 * Pick goal_mode for slot D based on content_strategy.
 * Prefer the second-highest goal after drive_footfall.
 */
function pickSlotDGoalMode(contentStrategy: any): GoalMode {
  if (!contentStrategy?.goal_blend) return 'retain_loyalty';

  // Prefer weekly modulation blend if available — falls back to static baseline
  const blend = contentStrategy.week_goal_blend ?? contentStrategy.goal_blend;
  // Remove drive_footfall (already covered by A+B), find next highest
  const candidates: Array<[GoalMode, number]> = [
    ['build_brand',    blend.build_brand    ?? 0],
    ['retain_loyalty', blend.retain_loyalty ?? 0],
  ];
  candidates.sort((a, b) => b[1] - a[1]);
  return candidates[0][0];
}

/**
 * Compute how many posts of each goal_mode to assign, driven by goal_blend weights.
 * Uses the Hamilton/largest-remainder method to ensure integer counts sum to targetPostCount.
 */
function computeSlotCounts(
  targetPostCount: number,
  goalBlend: { drive_footfall?: number; build_brand?: number; retain_loyalty?: number }
): { drive_footfall: number; build_brand: number; retain_loyalty: number } {
  const df = goalBlend.drive_footfall ?? 0;
  const bb = goalBlend.build_brand ?? 0;
  const rl = goalBlend.retain_loyalty ?? 0;
  const total = df + bb + rl;

  // Normalise weights (fall back to sensible defaults if blank)
  const w = total > 0
    ? { drive_footfall: df / total, build_brand: bb / total, retain_loyalty: rl / total }
    : { drive_footfall: 0.50, build_brand: 0.25, retain_loyalty: 0.25 };

  // Raw floats
  const raw = {
    drive_footfall: w.drive_footfall * targetPostCount,
    build_brand:    w.build_brand    * targetPostCount,
    retain_loyalty: w.retain_loyalty * targetPostCount,
  };

  // Floor all
  const counts = {
    drive_footfall: Math.floor(raw.drive_footfall),
    build_brand:    Math.floor(raw.build_brand),
    retain_loyalty: Math.floor(raw.retain_loyalty),
  };

  // Distribute remainder posts to whichever goal has the largest fractional part
  const remainders = {
    drive_footfall: raw.drive_footfall - counts.drive_footfall,
    build_brand:    raw.build_brand    - counts.build_brand,
    retain_loyalty: raw.retain_loyalty - counts.retain_loyalty,
  };
  let remaining = targetPostCount - counts.drive_footfall - counts.build_brand - counts.retain_loyalty;
  const keys = ['drive_footfall', 'build_brand', 'retain_loyalty'] as const;
  while (remaining > 0) {
    const best = keys.reduce((a, b) => remainders[a] >= remainders[b] ? a : b);
    counts[best]++;
    remainders[best] = 0;
    remaining--;
  }

  return counts;
}

/**
 * Assign slot_id, goal_mode, content_category, timing_window to each angle.
 * Slot count distribution is driven by content_strategy.goal_blend weights.
 * Falls back to sensible defaults when content_strategy is not available.
 *
 * Example for N=4 with default weights (df=0.5, bb=0.25, rl=0.25):
 *   drive_footfall=2 → A (Thu-Fri 14:00) + B (Wed-Thu 11:00)
 *   build_brand=1    → C (Mon 09:00)
 *   retain_loyalty=1 → D (any)
 *
 * If build_brand=0.60, drive_footfall=0.30, retain_loyalty=0.10 with N=4:
 *   build_brand=2, drive_footfall=1, retain_loyalty=1  → C, C2, A, D
 */
export function assignSlotMetadata(
  angles: StrategicAngle[],
  targetPostCount: number,
  context: WeekContext
): StrategicAngle[] {
  const contentStrategy = context.brand_voice?.content_strategy;
  // Prefer weekly modulation weights if available — falls back to static baseline
  const ccWeights = ((contentStrategy as any)?.week_content_category_weights
    ?? (contentStrategy as any)?.content_category_weights) as Record<string, number> | undefined;
  const slotDGoalMode  = pickSlotDGoalMode(contentStrategy);

  // Compute how many posts go to each goal mode, driven by goal_blend weights
  // Prefer weekly modulation blend if available — falls back to static baseline
  const goalBlend = contentStrategy?.week_goal_blend ?? contentStrategy?.goal_blend ?? {};
  const counts = computeSlotCounts(targetPostCount, goalBlend);

  // Build slot sequence: drive_footfall → build_brand → retain_loyalty
  // Each slot's content_category is chosen by pickCategory(), which ranks compatible
  // categories by the brand's content_category_weights (Post Strategi) when available.
  const slotSequence: SlotTemplate[] = [];

  // drive_footfall: A (Thu-Fri 14:00), then B (Wed-Thu 11:00), then extra B-style
  for (let i = 0; i < counts.drive_footfall; i++) {
    const category = pickCategory('drive_footfall', i, ccWeights);
    if (i === 0) {
      slotSequence.push({ ...BASE_SLOTS[0], content_category: category }); // Slot A
    } else if (i === 1) {
      slotSequence.push({ ...BASE_SLOTS[1], content_category: category }); // Slot B
    } else {
      slotSequence.push({ slot_id: 'B', goal_mode: 'drive_footfall', content_category: category, timing_window: 'Wed-Thu 11:00' });
    }
  }

  // build_brand: C (Mon 09:00), then extra C-style
  for (let i = 0; i < counts.build_brand; i++) {
    const category = pickCategory('build_brand', i, ccWeights);
    if (i === 0) {
      slotSequence.push({ ...BASE_SLOTS[2], content_category: category }); // Slot C
    } else {
      slotSequence.push({ slot_id: 'C', goal_mode: 'build_brand', content_category: category, timing_window: 'Mon 09:00' });
    }
  }

  // retain_loyalty: D with weight-ranked categories
  for (let i = 0; i < counts.retain_loyalty; i++) {
    const category = pickCategory(slotDGoalMode, i, ccWeights);
    slotSequence.push({ slot_id: 'D', goal_mode: slotDGoalMode, content_category: category, timing_window: 'any' });
  }

  // ── Diversity rebalancing pass ──────────────────────────────────────────────
  // After goal-blend assignment, ensure every non-zero-weight content category
  // appears at least once per week. When a category is absent AND another category
  // appears more than once across non-footfall slots, swap one duplicate → missing.
  // drive_footfall slots (A/B) are intentionally left untouched (conversion-critical).
  //
  // Example: [product_menu, product_menu, behind_scenes, craving_visual]
  //   → team_people is absent (weight > 0), craving_visual or product_menu is
  //     duplicated → swap one eligible duplicate to team_people.
  const allCats: ContentCategory[] = ['product_menu', 'craving_visual', 'behind_scenes', 'team_people'];
  // Categories that should appear (weight > 0, or all 4 when weights are absent)
  const requiredCats: ContentCategory[] = ccWeights
    ? allCats.filter(c => (ccWeights[c] ?? 0) > 0)
    : allCats;

  for (const missing of requiredCats) {
    // Skip if already present
    if (slotSequence.some(s => s.content_category === missing)) continue;

    // Count current usage of each category across ALL slots
    const usageCount = new Map<ContentCategory, number>();
    for (const s of slotSequence) {
      usageCount.set(s.content_category, (usageCount.get(s.content_category) ?? 0) + 1);
    }

    // Find the best swap candidate: non-footfall slot whose category is duplicated
    // and whose goal_mode is compatible with the missing category
    const candidateIdx = slotSequence.findIndex(s =>
      s.goal_mode !== 'drive_footfall' &&
      (usageCount.get(s.content_category) ?? 0) > 1 &&
      (COMPATIBLE_CATS[s.goal_mode] as ContentCategory[]).includes(missing)
    );

    if (candidateIdx !== -1) {
      slotSequence[candidateIdx] = { ...slotSequence[candidateIdx], content_category: missing };
    }
  }
  // ────────────────────────────────────────────────────────────────────────────

  // ── Semantic angle-to-slot matching ────────────────────────────────────────────
  // If Phase 1 AI provided suggested_content_category hints, use a compatibility-score
  // matrix to pair each angle to the slot it fits best (semantically), rather than
  // pairing by weight-rank index. Falls back to index-order when hints are absent.
  const hasSuggestions = angles.some(a => (a as any).suggested_content_category);

  if (!hasSuggestions) {
    // Legacy path — index-order matching (no AI content-category hints available)
    // Build result and fall through to deterministic rotation
    const legacyResult = angles.map((angle, idx) => {
      const slot = slotSequence[idx];
      if (!slot) return angle;
      return { ...angle, slot_id: slot.slot_id, goal_mode: slot.goal_mode, content_category: slot.content_category, timing_window: slot.timing_window };
    });

    // Apply deterministic slot rotation (same logic as semantic path below)
    const legacyPrevSlotTypes = (context.previous_week as any).previous_slot_content_types as
      Array<{ slot_id: string; content_category: string }> | undefined;
    if (legacyPrevSlotTypes && legacyPrevSlotTypes.length > 0) {
      const legacyPrevMap: Record<string, ContentCategory> = {};
      for (const s of legacyPrevSlotTypes) legacyPrevMap[s.slot_id] = s.content_category as ContentCategory;
      const legacyUsedCats = new Set(legacyResult.map(a => a.content_category as ContentCategory | undefined).filter(Boolean)) as Set<ContentCategory>;
      for (const angle of legacyResult) {
        if (!angle.slot_id || !angle.goal_mode) continue;
        if (angle.goal_mode === 'drive_footfall') continue;
        const prevCat = legacyPrevMap[angle.slot_id];
        if (!prevCat || angle.content_category !== prevCat) continue;
        const compatible = COMPATIBLE_CATS[angle.goal_mode as GoalMode] ?? [];
        if (compatible.length <= 1) continue;
        const alternative = compatible.find(c => c !== prevCat && !legacyUsedCats.has(c));
        if (alternative) {
          console.log(`[Phase 1] Deterministic rotation (legacy): slot ${angle.slot_id} ${angle.content_category} → ${alternative}`);
          legacyUsedCats.delete(angle.content_category as ContentCategory);
          angle.content_category = alternative;
          legacyUsedCats.add(alternative);
        }
      }
    }
    return legacyResult;
  }

  // Build score matrix: scores[angleIdx][slotIdx]
  const scores: number[][] = angles.map((angle) =>
    slotSequence.map((slot) => {
      let score = 0;
      const suggested = (angle as any).suggested_content_category as string | undefined;
      if (suggested) {
        if (suggested === slot.content_category) score += 3; // exact category match
        // partial compatibility: angle's suggested category is in the same goal_mode family
        const COMPAT: Record<string, string[]> = {
          drive_footfall: ['product_menu', 'craving_visual'],
          build_brand:    ['behind_scenes', 'team_people'],
          retain_loyalty: ['craving_visual', 'behind_scenes', 'team_people', 'product_menu'],
        };
        if ((COMPAT[slot.goal_mode] ?? []).includes(suggested)) score += 1;
      }
      return score;
    })
  );

  // Greedy assignment: pick the highest-scoring unmatched (angle, slot) pair first
  const usedAngleIdxs = new Set<number>();
  const usedSlotIdxs  = new Set<number>();
  const pairings: Array<{ angleIdx: number; slotIdx: number }> = [];

  const n = Math.min(angles.length, slotSequence.length);
  for (let pick = 0; pick < n; pick++) {
    let bestScore = -1, bestA = -1, bestS = -1;
    for (let a = 0; a < angles.length; a++) {
      if (usedAngleIdxs.has(a)) continue;
      for (let s = 0; s < slotSequence.length; s++) {
        if (usedSlotIdxs.has(s)) continue;
        if (scores[a][s] > bestScore) {
          bestScore = scores[a][s]; bestA = a; bestS = s;
        }
      }
    }
    if (bestA === -1) break;
    pairings.push({ angleIdx: bestA, slotIdx: bestS });
    usedAngleIdxs.add(bestA);
    usedSlotIdxs.add(bestS);
  }

  console.log('[Phase 1] Semantic slot pairings:', pairings.map(p =>
    `angle[${p.angleIdx}]="${angles[p.angleIdx].focus}" → slot ${slotSequence[p.slotIdx].slot_id}/${slotSequence[p.slotIdx].content_category}`
  ));

  // Build result preserving original angle order
  const slotByAngleIdx: Record<number, SlotTemplate> = {};
  pairings.forEach(({ angleIdx, slotIdx }) => { slotByAngleIdx[angleIdx] = slotSequence[slotIdx]; });

  const result = angles.map((angle, idx) => {
    const slot = slotByAngleIdx[idx] ?? slotSequence[idx]; // fallback to index-order if unmatched
    if (!slot) return angle;
    return { ...angle, slot_id: slot.slot_id, goal_mode: slot.goal_mode, content_category: slot.content_category, timing_window: slot.timing_window };
  });

  // ── Deterministic slot rotation: guarantee C/D don't repeat same content_category as last week ──
  // Post-processing pass independent of the AI's suggested_content_category hints.
  // For each non-footfall slot where the assigned content_category exactly matches last week's
  // same slot_id, swap to the next compatible category that isn't already used this week.
  const prevSlotTypes = (context.previous_week as any).previous_slot_content_types as
    Array<{ slot_id: string; content_category: string }> | undefined;

  if (prevSlotTypes && prevSlotTypes.length > 0) {
    const prevMap: Record<string, ContentCategory> = {};
    for (const s of prevSlotTypes) prevMap[s.slot_id] = s.content_category as ContentCategory;

    const usedCats = new Set(result.map(a => a.content_category as ContentCategory | undefined).filter(Boolean)) as Set<ContentCategory>;

    for (const angle of result) {
      if (!angle.slot_id || !angle.goal_mode) continue;
      if (angle.goal_mode === 'drive_footfall') continue; // A/B slots: intentionally stable
      const prevCat = prevMap[angle.slot_id];
      if (!prevCat || angle.content_category !== prevCat) continue;

      const compatible = COMPATIBLE_CATS[angle.goal_mode as GoalMode] ?? [];
      if (compatible.length <= 1) continue; // No alternative available

      const alternative = compatible.find(c => c !== prevCat && !usedCats.has(c));
      if (alternative) {
        console.log(`[Phase 1] Deterministic rotation: slot ${angle.slot_id} ${angle.content_category} → ${alternative} (was same as last week)`);
        usedCats.delete(angle.content_category as ContentCategory);
        angle.content_category = alternative;
        usedCats.add(alternative);
      }
    }
  }
  // ────────────────────────────────────────────────────────────────────────────

  return result;
}
