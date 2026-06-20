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
import type { ActivationEngineOutput } from '../types/activation-types.ts';
import { silentSpellingCorrection } from './infrastructure.ts';
import { generateSlotsFromRevenueDrivers, generateSlotsFromRevenueDriversUnified, type PostingStrategy, type BookingModel } from '../business-rules-engine.ts';

// ============================================================
// PHASE 1 ORCHESTRATOR
// ============================================================

export async function generateStrategicBrief(
  context: WeekContext,
  targetPostCount: number,
  phase0Analysis: ContextualAnalysis,
  isRegenerating: boolean = false,
  businessIntelligence?: BusinessIntelligence,
  activationOutput: ActivationEngineOutput | null = null
): Promise<{ brief: StrategicBrief; rawOutput: string }> {
  console.log(`[Phase 1] Generating strategic brief for ${context.business_name}`, {
    regenerating: isRegenerating,
    phase0_factors: phase0Analysis.key_factors.length,
    has_activation: !!activationOutput,
    activated_segments: activationOutput?.activated_segments.length || 0,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TWO-STEP GENERATION PROCESS
  // ═══════════════════════════════════════════════════════════════════════════
  // Step 1: Generate contextual_analysis ONLY (forces comprehensive scanning)
  // Step 2: Use contextual_analysis to generate week_summary, competitive_advantage, angles
  // This enforces the 6-step strategic process and prevents AI from skipping analysis

  const phase1Model = 'gpt-4o';

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 1: GENERATE CONTEXTUAL ANALYSIS
  // ─────────────────────────────────────────────────────────────────────────
  console.log('[Phase 1 Step 1] Generating contextual_analysis...');
  const step1Prompt = buildContextualAnalysisPrompt(context, targetPostCount, phase0Analysis, isRegenerating, activationOutput, businessIntelligence);
  
  let contextualAnalysis: any;
  let step1Error: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`[Phase 1 Step 1] Attempt ${attempt}/3 using ${phase1Model}`);
      contextualAnalysis = await callAI<any>(
        step1Prompt,
        {
          temperature: attempt === 1 ? (isRegenerating ? 0.55 : 0.3) : 0,
          maxTokens: 2048,
          model: phase1Model,
        }
      );
      
      // Validate that we got the required fields
      if (!contextualAnalysis?.unique_factors_this_week || !contextualAnalysis?.opportunity_synthesis) {
        throw new Error('AI response missing required fields (unique_factors_this_week or opportunity_synthesis)');
      }
      
      console.log('[Phase 1 Step 1] ✅ Contextual analysis generated:', {
        factors_count: contextualAnalysis.unique_factors_this_week.length,
        synthesis_length: contextualAnalysis.opportunity_synthesis.length
      });
      break;
    } catch (error) {
      step1Error = error instanceof Error ? error : new Error(String(error));
      console.error(`[Phase 1 Step 1] Attempt ${attempt}/3 failed:`, step1Error.message);
    }
  }
  
  if (!contextualAnalysis) {
    console.error('[Phase 1 Step 1] Failed after 3 attempts');
    throw new Error(`Contextual analysis generation failed: ${step1Error}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 2: GENERATE FULL STRATEGY USING CONTEXTUAL ANALYSIS
  // ─────────────────────────────────────────────────────────────────────────
  console.log('[Phase 1 Step 2] Generating full strategy using contextual_analysis...');
  const step2Prompt = buildFullStrategyPrompt(
    context, 
    targetPostCount, 
    phase0Analysis, 
    contextualAnalysis,
    isRegenerating,
    activationOutput,
    businessIntelligence
  );

  let rawText: string = '';
  let rawBrief: any;
  let step2Error: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`[Phase 1 Step 2] Attempt ${attempt}/3 using ${phase1Model}`);
      rawBrief = await callAI<any>(
        step2Prompt,
        {
          temperature: attempt === 1 ? (isRegenerating ? 0.55 : 0.3) : 0,
          maxTokens: 6144,
          model: phase1Model,
        }
      );
      
      // Inject the contextual_analysis from Step 1 into the final brief
      rawBrief.contextual_analysis = contextualAnalysis;
      rawText = JSON.stringify(rawBrief);
      
      console.log('[Phase 1 Step 2] ✅ Full strategy generated:', {
        angles_count: rawBrief.angles?.length || 0
      });
      break;
    } catch (error) {
      step2Error = error instanceof Error ? error : new Error(String(error));
      console.error(`[Phase 1 Step 2] Attempt ${attempt}/3 failed:`, step2Error.message);
    }
  }
  
  if (!rawBrief) {
    console.error('[Phase 1 Step 2] Failed after 3 attempts');
    throw new Error(`Full strategy generation failed: ${step2Error}`);
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

  // Spelling correction for all Danish narrative fields (parallel execution)
  try {
    console.log('[Phase 1] Running spelling correction on narrative fields...');
    const correctionPromises: Promise<string>[] = [];
    
    if (rawBrief.week_summary) {
      correctionPromises.push(silentSpellingCorrection(rawBrief.week_summary, 'da'));
    }
    if (rawBrief.competitive_advantage) {
      correctionPromises.push(silentSpellingCorrection(rawBrief.competitive_advantage, 'da'));
    }
    
    // Collect angle text fields for correction
    const angleTexts: Array<{ angleIndex: number; field: 'reasoning' | 'content_direction' | 'menu_alignment'; text: string }> = [];
    if (Array.isArray(rawBrief.angles)) {
      rawBrief.angles.forEach((angle, idx) => {
        if (angle.reasoning) angleTexts.push({ angleIndex: idx, field: 'reasoning', text: angle.reasoning });
        if (angle.content_direction) angleTexts.push({ angleIndex: idx, field: 'content_direction', text: angle.content_direction });
        if (angle.menu_alignment) angleTexts.push({ angleIndex: idx, field: 'menu_alignment', text: angle.menu_alignment });
      });
    }
    
    angleTexts.forEach(item => {
      correctionPromises.push(silentSpellingCorrection(item.text, 'da'));
    });
    
    const correctedTexts = await Promise.all(correctionPromises);
    
    // Apply corrections
    let idx = 0;
    if (rawBrief.week_summary) {
      const corrected = correctedTexts[idx++];
      if (corrected !== rawBrief.week_summary) {
        console.log('[Phase 1] Spelling corrected week_summary');
      }
      rawBrief.week_summary = corrected;
    }
    if (rawBrief.competitive_advantage) {
      const corrected = correctedTexts[idx++];
      if (corrected !== rawBrief.competitive_advantage) {
        console.log('[Phase 1] Spelling corrected competitive_advantage');
      }
      rawBrief.competitive_advantage = corrected;
    }
    
    angleTexts.forEach(item => {
      const corrected = correctedTexts[idx++];
      if (corrected !== item.text) {
        console.log(`[Phase 1] Spelling corrected angle ${item.angleIndex} ${item.field}`);
      }
      rawBrief.angles[item.angleIndex][item.field] = corrected;
    });
    
    console.log(`[Phase 1] ${correctionPromises.length} spelling corrections completed`);
  } catch (spellingError) {
    console.warn('[Phase 1] Spelling correction failed:', spellingError);
    // Continue without corrections - non-critical
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
    contextual_analysis: rawBrief.contextual_analysis,  // Injected from Step 1
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

  // ── Append deterministic content mix summary to week_summary ──────────────────
  // This ensures users see the brand/loyalty/footfall composition
  const footfallCount = brief.angles.filter(a => a.goal_mode === 'drive_footfall').length;
  const brandCount = brief.angles.filter(a => a.goal_mode === 'build_brand').length;
  const loyaltyCount = brief.angles.filter(a => a.goal_mode === 'retain_loyalty').length;
  
  const mixParts: string[] = [];
  if (footfallCount > 0) mixParts.push(`${footfallCount} opslag driver bookinger`);
  if (brandCount > 0) mixParts.push(`${brandCount} opslag styrker brand`);
  if (loyaltyCount > 0) mixParts.push(`${loyaltyCount} opslag plejer stamgæster`);
  
  if (mixParts.length > 0) {
    const mixSummary = `\n\nDenne uge: ${mixParts.join(', ')}.`;
    brief.week_summary = (brief.week_summary || '') + mixSummary;
  }

  console.log('[Phase 1] Slot assignments:', brief.angles.map(a => ({
    focus: a.focus,
    slot_id: a.slot_id,
    goal_mode: a.goal_mode,
    content_category: a.content_category
  })));

  return { brief, rawOutput: rawText };
}

// ============================================================
// IDENTITY BLOCK BUILDER
// Produces a stable 3-5 sentence identity paragraph from brand
// profile fields. Injected at the top of both Phase 1 prompts
// so the AI reasons from verified facts, not reconstructed guesses.
// ============================================================

function buildIdentityBlock(context: WeekContext): string {
  const bv = context.brand_voice as any;
  const lines: string[] = [];

  // Line 1: what the business is (essence or character)
  const essence = bv?.brand_essence || bv?.voice_style || context.business_character || '';
  if (essence) lines.push(essence.trim());

  // Line 2: operational facts (business_character, if not already used as essence)
  if (context.business_character && context.business_character !== essence) {
    lines.push(context.business_character.trim());
  }

  // Line 3: what makes them different
  const differentiator = bv?.what_makes_us_different;
  if (differentiator) lines.push(differentiator.trim());

  // Line 4: menu/gastronomic character
  const gastro = bv?.gastronomic_profile;
  if (gastro) lines.push(gastro.trim());

  if (lines.length === 0) return '';
  return `## FORRETNINGSIDENTITET\n${lines.join('\n')}`;
}

// ============================================================
// STEP 1: CONTEXTUAL ANALYSIS PROMPT BUILDER
// ============================================================

function buildContextualAnalysisPrompt(
  context: WeekContext,
  targetPostCount: number,
  phase0Analysis: ContextualAnalysis,
  isRegenerating: boolean = false,
  activationOutput: ActivationEngineOutput | null = null,
  businessIntelligence?: BusinessIntelligence
): string {
  const phase0Summary = phase0Analysis.key_factors.map((f: ContextFactor) =>
    `- ${f.name} (${f.type}, weight: ${f.strategic_weight})
  Adfærd: ${f.behavioral_impact}
  Målgruppe: ${f.target_audience}
  Timing: ${f.timing_recommendation}`
  ).join('\n\n');

  const interactionsSummary = phase0Analysis.factor_interactions.length > 0
    ? phase0Analysis.factor_interactions.map((i: FactorInteraction) =>
      `- ${(i.factors || []).join(' + ')}: ${i.synergy}`
    ).join('\n')
    : 'Ingen væsentlige interaktioner';

  // Build business intelligence context — COMPRESSED TABLE FORMAT
  const biContext = businessIntelligence?.servicePeriodStrategies && businessIntelligence.servicePeriodStrategies.length > 0 ? `
## BUSINESS INTELLIGENCE

Periode | Mål (F/B/L) | Primære målgrupper
--------|-------------|-------------------
${businessIntelligence.servicePeriodStrategies.map(sp => {
    const goals = sp.goals?.map(g => g.weight).join('/') || '';
    const topAudiences = sp.audienceSegments?.slice(0, 2).map(a => a.segmentName).join(', ') || '';
    return `${sp.periodLabel} | ${goals} | ${topAudiences}`;
  }).join('\n')}

F=footfall, B=brand, L=loyalty. Respektér disse vægtninger når du tildeler goal_mode.
` : '';

  // Build location context — shows ALL active location types (not just primary)
  // so the AI understands the business serves multiple visitor profiles
  const locationContext = (() => {
    const loc = context.location as any;
    if (!loc) return '';
    const parts: string[] = [];
    if (loc.local_location_reference) parts.push(`Placering: "${loc.local_location_reference}"`);
    if (loc.matched_motivations?.length > 0) {
      parts.push(`Besøgsmotivationer: ${loc.matched_motivations.join(', ')}`);
    }
    if (loc.location_categories?.length > 0) {
      const cats = loc.location_categories.map((c: any) => `${c.type} (${c.score})`).join(', ');
      parts.push(`Lokationstyper: ${cats}`);
    }
    if (loc.marketing_focus) parts.push(`Marketing-fokus: ${loc.marketing_focus}`);
    return parts.length > 0 ? `\n## LOKATION\n${parts.join('\n')}\n` : '';
  })();
  const activationContext = activationOutput ? `
## AKTIVEREDE SEGMENTER (${activationOutput.metadata.week_type})

Adfærdsmønstre: ${activationOutput.metadata.primary_behaviors.join(', ')}

${activationOutput.behavioral_patterns.map(p => `${p.pattern_name} (${p.activation_level}) → ${p.trigger_reason} · ${p.active_days.join(', ')}`).join('\n')}

Segment | Pri | Timing | Decision | Mål | Angles
--------|-----|--------|----------|------|-------
${activationOutput.allocation_guidance.recommended_segments.slice(0, 6).map(seg => `${seg.segment_name} [${seg.programme_name}] | ${seg.this_week_priority} | ${seg.extended_timing[0] || ''} | ${seg.this_week_decision} | ${seg.goal} | ${seg.content_angles.slice(0, 2).join(', ')}`).join('\n')}
${activationOutput.deactivated_segments.length > 0 ? `\nDeaktiveret: ${activationOutput.deactivated_segments.map(d => d.segment_name).join(', ')}` : ''}
` : '';

  const identityBlock = buildIdentityBlock(context);

  // Weather reframing instruction — injected into Step 1 task so it shapes angle
  // selection before any reasoning happens, not just language rules afterwards.
  const weatherReframingInstruction = (() => {
    const forecasts = context.weather?.daily_forecasts as any[] | undefined;
    if (!forecasts || forecasts.length === 0) return '';
    const badDays = forecasts.filter((d: any) => /rain|snow|fog/i.test(d.condition || '')).length;
    if (badDays < Math.ceil(forecasts.length / 2)) return '';
    // Rainy majority week — reframe outdoor as indoor pull
    const localRef = (context.location as any)?.local_location_reference;
    const locationPhrase = localRef ? `"${localRef}"` : 'stedet';
    return `
⚠️ VEJRREFRAMING (kritisk — gælder for hele analysen):
Ugen er primært regnfuld (${badDays}/${forecasts.length} dage med regn/sne/tåge).
• Udeservering er IKKE en mulighed denne uge — nævn det IKKE som faktor.
• Udendørs aktiviteter og sommer-stemning er IKKE relevante vinduer denne uge.
• Reframing: Regnvejr skaber spontane INDENDØRS-besøg. ${locationPhrase} fungerer som et varmt, tørt fristed — dette er den faktiske mulighed.
• Brug dette som compound opportunity: regn → indendørs pull → frokost/kaffe/aftenmad med udsigt = destinationsvalg på en grå dag.
• Alle faktorer og tidsvinduer skal analyseres i lyset af regnvejr, IKKE antage solskin.`;
  })();

  return `
## STEP 1: CONTEXTUAL ANALYSIS

Du er professionel dansk marketing manager. Lav STEP 1-3 for ${context.business_name}, uge ${context.week_number}.

${activationOutput ? `
⚠️ AKTIVEREDE SEGMENTER: Activation engine har identificeret aktive/deaktiverede segmenter (se nedenfor).

Opgave:
1. Forstå aktiverings-årsager (behavioral patterns)
2. Identificér unikke faktorer → driver mønstre
3. Beskriv tidsvinduer + compound opportunities
` : `
Opgave: Identificér
• Unique factors (min 2) + tidsvinduer
• Målgrupper påvirket
• Faktor-kombinationer (compound opportunities)
`}
${weatherReframingInstruction}
${identityBlock ? `${identityBlock}\n` : ''}
## BUSINESS CONTEXT

${context.business_name} (${context.city})${context.service_periods && context.service_periods.length > 0 ? ` · ${context.service_periods.join(', ')}` : ''}
Menu: ${context.signature_items.length} signature items
${locationContext}${biContext}
${activationContext}

## PHASE 0 ANALYSIS

${phase0Summary}

Interaktioner:
${interactionsSummary}

## UGE ${context.week_number} DATA

${context.week_start} → ${context.week_end}

${Array.isArray(context.weather?.daily_forecasts) && context.weather.daily_forecasts.length > 0 ? `VEJR:
${context.weather.daily_forecasts.map((w: any) => `${w.day || 'Day'}: ${w.temp}°C, ${w.condition}`).join('\n')}
` : ''}

${context.events && context.events.length > 0 ? `EVENTS/HELLIGDAGE:
${context.events.map((e: any) => `- ${e.name} (${e.date}): ${e.hospitality_traffic || 'normal'} traffic${e.typical_bridge_day ? ', typical bridge day' : ''}`).join('\n')}
` : 'EVENTS: Ingen events denne uge'}

${context.economic?.payday_this_week ? 'Lønningsuge: JA\n' : ''}

## OUTPUT (JSON)

SVAR KUN MED JSON:

{
  "unique_factors_this_week": [
    {
      "factor": "[navn på faktor, fx 'Kr. Himmelfartsdag Thursday + typical_bridge_day']",
      "customer_behavior_enabled": "[konkrete kunde-adfærder denne faktor muliggør]",
      "time_windows_activated": ["Thursday 11:00-15:00", "Thursday 17:00-22:00"],
      "audience_segments": ["${activationOutput ? activationOutput.allocation_guidance.recommended_segments[0]?.segment_name || 'primary segment' : 'families'}"]
    }
  ],
  "opportunity_synthesis": "[Forklar hvordan 2+ faktorer kombineres til compound opportunities. Beskriv det fulde tidsvindue og hvorfor dette er mere end summen af enkelte faktorer.]"
}
`;
}

// ============================================================
// STEP 2: FULL STRATEGY PROMPT BUILDER
// ============================================================

function buildFullStrategyPrompt(
  context: WeekContext,
  targetPostCount: number,
  phase0Analysis: ContextualAnalysis,
  contextualAnalysis: any,
  isRegenerating: boolean = false,
  activationOutput: ActivationEngineOutput | null = null,
  businessIntelligence?: BusinessIntelligence
): string {
  const menuCapabilities = analyzeMenuCapabilities(context);

  // Build business intelligence context for goal mode guidance
  const biGuidance = businessIntelligence?.servicePeriodStrategies && businessIntelligence.servicePeriodStrategies.length > 0 ? `
## GOAL MODE GUIDANCE

${businessIntelligence.servicePeriodStrategies.map(sp => {
    const goalsText = sp.goals?.map(g => `${g.weight}% ${g.goal}`).join(', ') || '';
    return `${sp.periodLabel}: ${goalsText}`;
  }).join(' · ')}

Tildel goal_mode (${targetPostCount} angles): MIX footfall/brand/loyalty → brug vægtninger som guide
` : '';

  const segmentGuidance = activationOutput ? `
## AKTIVEREDE SEGMENTER (${targetPostCount} angles)

${activationOutput.allocation_guidance.recommended_segments.map((seg, idx) => `${idx + 1}. ${seg.segment_name} [${seg.programme_name}] — ${seg.this_week_priority}\n   Timing: ${seg.extended_timing.join(', ')} · ${seg.goal}`).join('\n')}

⚠️ Hver angle matcher ét segment. Brug content_angles som inspiration, kontekstualisér til uge.
` : '';

  return `
## STEP 2: STRATEGIC BRIEF

Du er en erfaren markedsføringskonsulent der leverer en ugentlig strategisk briefing til ejeren af ${context.business_name}.

DIN KOMMUNIKATIONSSTIL (gælder for alt du skriver i dette output — IKKE for post-indhold):
• Professionel og direkte — som en kompetent konsulent der respekterer ejerens tid
• Personlig og konkret — brug ejerens virkelighed, ikke generiske marketingtermer
• Ingen akademisk jargon, ingen engelske strategilabels, ingen svulstig ros
• Kortfattet: hver sætning skal tilføje ny information
• Tone: varm faglig — som en betroet sparringspartner, ikke en salgspitch

Lav Step 4-6: Strategic brief for ${context.business_name}, uge ${context.week_number}.

## DIN CONTEXTUAL ANALYSIS (Step 1)

${JSON.stringify(contextualAnalysis, null, 2)}

↑ Brug denne til strategien nedenfor.
${biGuidance}
${segmentGuidance}
${(() => {
  const forecasts = context.weather?.daily_forecasts as any[] | undefined;
  if (!forecasts || forecasts.length === 0) return '';
  const badDays = forecasts.filter((d: any) => /rain|snow|fog/i.test(d.condition || '')).length;
  if (badDays < Math.ceil(forecasts.length / 2)) return '';
  const localRef = (context.location as any)?.local_location_reference;
  const locationPhrase = localRef ? `"${localRef}"` : 'stedet';
  return `⚠️ VEJRREFRAMING (gentaget fra Step 1 — gælder for ALLE angles og al formulering):
Ugen er primært regnfuld. Udeservering og udendørs aktivitet er IKKE muligheder.
Regnen skaber indendørs pull: ${locationPhrase} som tørt, varmt fristed med udsigt/atmosfære.
• week_summary og competitive_advantage må IKKE referere til udendørs, terrasse, sommervejr eller udeservering.
• content_direction for atmosphere-posts: fokus på indendørs stemning, vinduet mod åen, den varme café — IKKE solskin/udeservering.
• Skriv KUN på dansk — ingen engelske labels som "Terrace Pull", "Destination Visit" o.l. i output.

`;
})()} 

## BOOKING & CTA RULES (afgørende for CTA-valg på footfall-opslag)

${(() => {
  const ctaRules = (context as any).cta_rules;
  const bm = (context as any).booking_model;
  const bookingPhrases = (context as any).brand_voice?.booking_cta_phrases || [];
  
  if (!ctaRules && !bm) return '(Ingen booking-data tilgængelig — brug hybrid som default)';
  
  const lines: string[] = [];
  
  // Use cta_rules if available (new structured approach)
  if (ctaRules) {
    lines.push(`📋 CTA MODE: ${ctaRules.mode}`);
    lines.push(`📖 INSTRUKTION: ${ctaRules.instruction}`);
    lines.push('');
    
    if (ctaRules.booking_nudge_capable) {
      lines.push('🎯 BOOKING NUDGE STRATEGI:');
      lines.push(`  • Identificer ugens største travlhedsdag (brug busy_pattern eller standard: fredag/lørdag aften)`);
      lines.push(`  • Tildel ÉT opslag til at lande ${ctaRules.booking_nudge_lead_days} dage før peak-dagen`);
      lines.push(`  • Dette opslag skal have:`);
      lines.push(`    - goal_mode: "drive_footfall"`);
      lines.push(`    - content_category: "booking_nudge"`);
      lines.push(`    - suggested_time: 11:00-13:00 (optimal social reach)`);
      lines.push(`    - cta_mode: "booking" (brug godkendte booking_cta_phrases)`);
      if (bookingPhrases.length > 0) {
        lines.push(`  • Godkendte booking-fraser: ${bookingPhrases.join(', ')}`);
      }
      lines.push('');
    }
    
    if (ctaRules.mode === 'mixed') {
      lines.push('⚖️ MIXED MODE REGLER:');
      lines.push('  • Alle andre opslag (ikke booking nudge) = walk-in CTA');
      lines.push('  • Brug ALDRIG booking-sprog i atmosphere, team eller retention posts');
      lines.push('  • Kombiner ALDRIG walk-in og booking CTA i samme opslag');
    }
    
    if (ctaRules.mode === 'walk_in_only') {
      lines.push('🚶 WALK-IN ONLY:');
      lines.push('  • Ingen opslag i denne uge må referere til booking eller reservationer');
      lines.push('  • Brug kun: "kom forbi", "kig ind", "tag forbi"');
    }
  } else {
    // Fallback to old logic if cta_rules not available
    if (bm.reservation_required) {
      lines.push('RESERVATION PÅKRÆVET → alle footfall-opslag skal drive booking. cta_mode = "booking"');
    } else if (bm.accepts_walk_ins && bm.has_booking_link) {
      lines.push('BÅDE walk-in OG booking muligt → dit job er at beslutte per opslag:');
      lines.push('  • Normal uge / hverdagsfrokost → walk_in (lav tærskel, "kom forbi i dag")');
      lines.push('  • Særlig begivenhed / travl weekend / aftenservering → booking ("sikr din plads")');
      lines.push('  • cta_mode = "walk_in" | "booking" | "hybrid" — du bestemmer per angle ud fra ugens kontekst');
    } else if (bm.accepts_walk_ins) {
      lines.push('KUN walk-in (ingen booking-link) → alle footfall-opslag er invitationer. cta_mode = "walk_in"');
    } else {
      lines.push('Booking-only → cta_mode = "booking"');
    }
  }
  
  return lines.join('\n');
})()}

${(() => {
  const ctaRules = (context as any).cta_rules
  if (!ctaRules?.booking_nudge_capable) return ''

  // Pre-compute signals for inline prompt injection
  const isPaidWeek = context.economic?.is_payday_week === true
  const isSummer = context.economic?.is_summer === true
  const isTourist = context.location?.tourist_context === true
  const archetype = context.business_archetype ?? ''
  const isCasualArchetype = ['cafe', 'casual_dining', 'hybrid_cafe', 'bar_cafe'].includes(archetype)
  const weekMode = (context as any).week_mode ?? ''
  const isRetentionOrBrand = weekMode === 'retention_focus' || weekMode === 'brand_building'

  // High-weight events: within this week OR within lead_days of a posting day
  const leadDays = ctaRules.booking_nudge_lead_days ?? 2
  const highWeightEvents = (context.events ?? []).filter((e: any) =>
    (e.commercial_weight ?? 0) > 0.5
  )
  const hardOverrideEvents = (context.events ?? []).filter((e: any) =>
    (e.commercial_weight ?? 0) > 0.7
  )

  // Peak night from busy_pattern
  const busyPattern = (context as any).busy_pattern ?? []
  const hasPeakNight = Array.isArray(busyPattern) &&
    busyPattern.some((d: any) => d.level === 'peak' || d.intensity === 'high')

  return `
## BOOKING NUDGE JUDGMENT

booking_nudge_capable er true for denne forretning.
Du skal nu beslutte om denne specifikke uge skal have et booking nudge opslag.

---

### GUARDRAIL — EVENT HARD OVERRIDE (evaluer FØRST)

${hardOverrideEvents.length > 0
  ? `⛔ HARD OVERRIDE AKTIV: Følgende events har commercial_weight > 0.7:
${hardOverrideEvents.map((e: any) => `  - ${e.name} (${e.date}, weight: ${e.commercial_weight})`).join('\n')}

→ Booking nudge SKAL bruges denne uge. Spring STEP 1-3 over.
→ lead_days for store events: brug 4-5 dage frem for standard ${leadDays} dage.
→ Sæt booking_nudge_warranted: true og udfyld STEP 4 direkte.`
  : `✅ Ingen hard override events denne uge. Fortsæt til STEP 1.`
}

---

### STEP 1 — Skal denne uge have et booking nudge?

Evaluer følgende signaler og tæl hvor mange suppression-betingelser der er opfyldt:

| Signal | Status | Suppression? |
|--------|--------|-------------|
| week_mode er retention_focus eller brand_building | ${isRetentionOrBrand ? `JA (${weekMode})` : 'NEJ'} | ${isRetentionOrBrand ? '✅ Tæller' : '—'} |
| Ingen payday week signal | ${isPaidWeek ? 'NEJ — er payday week' : 'JA — ikke payday'} | ${isPaidWeek ? '—' : '✅ Tæller'} |
| Ingen events med commercial_weight > 0.5 | ${highWeightEvents.length > 0 ? `NEJ — ${highWeightEvents.length} event(s) fundet` : 'JA — ingen høj-vægt events'} | ${highWeightEvents.length > 0 ? '—' : '✅ Tæller'} |
| Tourist + casual archetype + sommer | ${isTourist && isCasualArchetype && isSummer ? `JA (tourist: ${isTourist}, archetype: ${archetype}, sommer: ${isSummer})` : 'NEJ'} | ${isTourist && isCasualArchetype && isSummer ? '✅ Tæller' : '—'} |
| Ingen stærk peak night i busy_pattern | ${hasPeakNight ? 'NEJ — peak night fundet' : 'JA — ingen peak night data'} | ${hasPeakNight ? '—' : '✅ Tæller'} |

**REGEL: Supprimér booking nudge KUN hvis 3 eller flere suppression-betingelser er opfyldt.**

→ Hvis suppression-betingelser < 3: sæt booking_nudge_warranted: true og fortsæt til STEP 2.
→ Hvis suppression-betingelser ≥ 3: sæt booking_nudge_warranted: false, skriv booking_nudge_reasoning og stop her.

---

### STEP 2 — Hvilken dag skal nudge-opslaget lande? (kun hvis warranted)

Vælg peak_day med denne prioritet:
1. busy_pattern peak day (mest pålidelig — forretningsspecifik data)
   ${hasPeakNight
     ? `→ busy_pattern indeholder peak night data — brug denne`
     : `→ Ingen busy_pattern peak data tilgængelig — gå til prioritet 2`}
2. Højeste commercial_weight event-dag hvor in_week: true
   ${highWeightEvents.filter((e: any) => e.in_week).length > 0
     ? `→ In-week events: ${highWeightEvents.filter((e: any) => e.in_week).map((e: any) => `${e.name} (${e.date})`).join(', ')}`
     : `→ Ingen in-week events tilgængelige — gå til prioritet 3`}
3. Standard: fredag eller lørdag (hospitality default)

Beregn: nudge_post_date = peak_day minus lead_days_used

---

### STEP 3 — Hvad er det rigtige lead time? (kun hvis warranted)

Standard: ${leadDays} dage. Override hvis:
${ctaRules.mode === 'reservation_only'
  ? `- reservation_required er true → brug 3 dage`
  : `- reservation_required er false → standard ${leadDays} dage`}
- Hvis busy_pattern viser at peak fylder op hurtigt → brug 3 dage
- Hvis walk-in dominerende forretning med valgfri booking link → brug 1 dag
- Hvis major event (commercial_weight > 0.7) → brug 4-5 dage

---

### STEP 4 — Output booking nudge beslutningen

Det post idea der får booking nudge rollen SKAL indeholde disse felter:

\`\`\`json
{
  "content_category": "booking_nudge",
  "goal_mode": "drive_footfall",
  "cta_intent": "booking",
  "suggested_time": "11:00",
  "booking_nudge_warranted": true,
  "booking_nudge_reasoning": "<én sætning: hvorfor warranted>",
  "peak_day": "<ISO date>",
  "nudge_post_date": "<ISO date>",
  "booking_target_day": "<ISO date — samme som peak_day>",
  "lead_days_used": <integer>,
  "nudge_rationale": "<dansk audit-streng, f.eks.: Første lønningsweekend — fredag forventes travl, booking-opfordring onsdag giver 3 dages forspring>"
}
\`\`\`

Hvis booking_nudge_warranted er false:
\`\`\`json
{
  "booking_nudge_warranted": false,
  "booking_nudge_reasoning": "<én sætning: hvorfor supprimeret, f.eks.: Retention-uge uden payday-signal, events eller peak-night data — walk-in CTAs bruges i stedet>"
}
\`\`\`

⚠️ nudge_rationale gemmes i strategy_rationale på weekly_strategies rækken.
   Skriv den så et menneske kan forstå AI's beslutning ved gennemgang.
`
})()}

## BUSINESS PROFILE

${buildIdentityBlock(context) || `${context.business_name} (${context.city})`}
Menu: ${menuCapabilities.map(m => `${m.category} (${m.count})`).join(', ')}${(() => {
  const loc = context.location as any;
  if (!loc) return '';
  const parts: string[] = [];
  if (loc.local_location_reference) parts.push(`\nLokation: "${loc.local_location_reference}"`);
  if (loc.matched_motivations?.length > 0) parts.push(`\nBesøgsmotivationer: ${loc.matched_motivations.join(', ')}`);
  if (loc.location_categories?.length > 0) {
    parts.push(`\nLokationstyper: ${loc.location_categories.map((c: any) => `${c.type} (${c.score})`).join(', ')}`);
  }
  return parts.join('');
})()}
${context.opening_hours_summary ? `⏰ ÅBNINGSTIDER (faktiske — brug KUN disse, opfind ingen andre): ${context.opening_hours_summary}` : '⚠️ ÅBNINGSTIDER: Ingen data — nævn IKKE klokkeslæt for åbning/lukning.'}

## SPROG- OG LOKATIONSREGLER

⚠️ KRITISK: Skriv KUN på dansk. Undgå engelske termer.
${context.location?.local_location_reference ? `⚠️ LOKATION: Brug ALTID "${context.location.local_location_reference}" — ALDRIG generiske udtryk som "vandet", "havnefronten", "waterfront", "ved vandet", "området" osv.` : ''}
• Undgå engelske udtryk: "Day-to-Evening", "Waterfront Destination", "format" → brug danske termer
• Konkrete danske beskrivelser: "brunch-til-aften-service", "døgndrift", "kontinuerlig service" osv.
${(() => {
  // Weather-aware outdoor language constraint
  const forecasts = context.weather?.daily_forecasts as any[] | undefined;
  if (!forecasts || forecasts.length === 0) return '';
  const badDays = forecasts.filter((d: any) => /rain|snow|fog/i.test(d.condition || '')).length;
  if (badDays >= Math.ceil(forecasts.length / 2)) {
    return `⚠️ VEJR: Denne uge er overvejende regnfuld (${badDays}/${forecasts.length} dage). Undgå at skrive om "udendørsaktiviteter", "udendørs stemning" eller "sommer udendørs" — det er faktuelt forkert. Skriv i stedet om indendørs oplevelse, hygge inden for, regn som rammesætning for det varme indendørs-besøg.`;
  }
  return '';
})()}

⚠️ VARIATION — Dynamisér feeden, undgå et repetitivt broadcast:
${(() => {
  const prev = (context as any).previous_week;
  const prevPosts: any[] = prev?.posts ?? [];
  const prevCategories = prevPosts.map((p: any) => p.content_category || p.content_type || '').filter(Boolean);
  const menuCount = prevCategories.filter((t: string) => t.includes('product_menu')).length;
  const atmosphereCount = prevCategories.filter((t: string) => t.includes('craving') || t.includes('atmosphere')).length;
  const humanCount = prevCategories.filter((t: string) => t.includes('behind') || t.includes('team')).length;
  const dominatedByMenu = prevPosts.length > 0 && menuCount > prevPosts.length / 2;
  const dominatedByAtmosphere = prevPosts.length > 0 && atmosphereCount > prevPosts.length / 2;
  if (dominatedByMenu) return '• Forrige uge: primært produktfoto/tallerkener. Denne uge: prioritér mindst ét menneske-opslag (gæst/kok) og ét atmosfære-opslag (lokale, lys, detaljer). Varier timing inden for slot — prøv andre tidspunkter end standard.';
  if (dominatedByAtmosphere) return '• Forrige uge: primært atmosfære/stemning. Denne uge: prioritér mindst ét produktfoto og ét menneske-fokus. Skift det visuelle emne pr. opslag.';
  return '• Varier det visuelle emne pr. opslag: mad → menneske (gæst/kok) → atmosfære/detalje → mad. To tallerkener i træk er aldrig ideelt. Varier også timing inden for slottets vindue.';
})()}

## STELLAR EXAMPLE

Givet contextual_analysis viste "4-day window":

{
  "week_summary": "Kr. Himmelfartsdag torsdag og typisk klemmedag fredag skaber 4-dages vindue: Butikker lukket torsdag øger frokost-trafik 11-15, men mange har fri fredag hvilket også aktiverer aftenbesøg torsdag 17-22 (fejring, ingen arbejde næste dag) og hele fredagen (leisure-mode frokost + aften). Caféens brede åbningstider matcher præcis denne dobbelte surge — ikke kun frokost, men også aften-/fredag-segmentet.",
  
  "competitive_advantage": "Netop denne uge er fordelen, at caféen dækker kontinuerlig service fra morgen til nat — Kr. Himmelfartsdag aktiverer primært frokost-segmentet torsdag, men klemmedag-mønsteret rykker også aftenbesøg ind i samme vindue. Placeringen ved åen giver ekstra pull fredag ved 16°C.",
  
  "angles": [
    {
      "focus": "Planlagt frokostbesøg torsdag-fredag (helligdag + klemmedag)",
      "weight": 0.35,
      "goal_mode": "drive_footfall",
      "cta_mode": "booking",
      "content_type": "menu_item",
      "content_category": "product_menu",
      "timing_window": "Wed-Thu 10:00",
      "promoted_moment": "frokost torsdag-fredag",
      "reasoning": "Kr. Himmelfartsdag torsdag (butikker lukket, familier søger restaurantbesøg) + mange tager fredag fri = 2-dages frokost-surge. Caféens frokostmenu og åbningstider dækker præcis dette vindue. Uge-relevans: Ikke standard hverdagsfrokost — dette er planlagte helligdags-/klemmedags-besøg.",
      "menu_alignment": "Frokostretter",
      "content_direction": "product_menu fordi surge-vindue kræver konkret ret + booking-CTA — vis dampende varm hovedret med synlige ingredienser — trigger booking-intention onsdag-torsdag formiddag",
      "suggested_content_category": "product_menu",
      "phase0_factors_used": ["special_day:Kr. Himmelfartsdag"]
    },
    {
      "focus": "Aftenbesøg torsdag-fredag (fejringsmode + bridge day leisure)",
      "weight": 0.35,
      "goal_mode": "drive_footfall",
      "cta_mode": "booking",
      "content_type": "menu_item",
      "content_category": "product_menu",
      "timing_window": "Thu-Fri 14:00",
      "promoted_moment": "aftenservering torsdag-fredag",
      "reasoning": "Torsdag aften aktiveret af 'ingen arbejde fredag'-mønster + fredag aften aktiveret af forlænget weekend-stemning. Caféens cocktail-menu giver evening appeal. Uge-relevans: 4-dages vindue starter torsdag.",
      "menu_alignment": "Cocktails og drinksmenu",
      "content_direction": "craving_visual fordi aften-stemning > specifik ret — vis cocktails i aftenbelysning, fokus på glassene — trigger spontant besøg torsdag-fredag 17-21",
      "suggested_content_category": "craving_visual",
      "phase0_factors_used": ["special_day:Kr. Himmelfartsdag"]
    }
  ]
}
↑ Bemærk: BEGGE lunch+evening dækket (dual opportunity).

⚠️ Eksempel viser 2 angles. Du leverer ${targetPostCount} angles.

## OUTPUT - ${targetPostCount} ANGLES

**VIGTIG DAG-FORDELING for ${targetPostCount} opslag:**
Fordel opslag jævnt henover ugen — IKKE alle i slutningen:
- drive_footfall (slot A): timing_window = "Thu-Fri" (beslutningsvindue for weekendbesøg)
- drive_footfall (slot B): timing_window = "Tue-Wed" (midtuge-boost)
- build_brand: timing_window = "Mon-Tue" (ugeopener — byg kendskab tidligt på ugen)
- retain_loyalty: timing_window = "Wed-Thu" (midtuge — nær stamgæster inden weekend)

Mål: mindst ét opslag mandag-onsdag, mindst ét torsdag-søndag.

SVAR KUN MED JSON:

{
  "week_summary": "[3-4 sætninger baseret på din contextual_analysis]",
  "competitive_advantage": "[Start med 'Netop denne uge er fordelen, at...']",
  "angles": [
    {
      "focus": "[dagsdel/adfærd + mekanisme]",
      "weight": 0.4,
      "goal_mode": "drive_footfall",
      "cta_mode": "walk_in",
      "content_type": "menu_item",
      "content_category": "product_menu",
      "timing_window": "Thu-Fri 14:00",
      "promoted_moment": "frokost torsdag-fredag",
      "reasoning": "[2-4 sætninger: adfærd + virksomhedsfit + uge-relevans]",
      "menu_alignment": "[relevante menu-kategorier]",
      "content_direction": "[format fordi argument — vis konkret scene — trigger gæste-handling]",
      "suggested_content_category": "product_menu",
      "phase0_factors_used": []
    },
    {
      "focus": "[brand-fortælling + identitet]",
      "weight": 0.25,
      "goal_mode": "build_brand",
      "cta_mode": "walk_in",
      "content_type": "atmosphere",
      "content_category": "craving_visual",
      "timing_window": "Mon-Tue 09:00",
      "promoted_moment": "mandag morgen",
      "reasoning": "[2-4 sætninger: brand-angle + uge-relevans]",
      "menu_alignment": "",
      "content_direction": "[atmosfære/oplevelse — vis sted/stemning — byg kendskab]",
      "suggested_content_category": "craving_visual",
      "phase0_factors_used": []
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

  // Drink detection — check both signature_items AND drink_items for cocktails/wine/beer
  const drinkNames = (context.drink_items || []).map(i => i.name.toLowerCase());
  const allDrinkText = [...items.map(i => n(i)), ...drinkNames].join(' ');
  const hasDrinks = /cocktail|negroni|spritz|gin|whisky|mojito|margarita|vin\b|wine|øl\b|beer|aperitif|aperol|prosecco|champagne|cava/.test(allDrinkText);

  if (hasWarmDishes)  capabilities.push({ category: 'Varme retter',            count: Math.ceil(items.length * 0.5), strategic_value: 'Passer til koldt vejr, comfort-content' });
  if (hasSoups)       capabilities.push({ category: 'Supper',                   count: Math.ceil(items.length * 0.2), strategic_value: 'Varm og mættende — stærk ved regnvejr og kulde' });
  if (hasCoffee)      capabilities.push({ category: 'Kaffemenu',                count: Math.ceil(items.length * 0.3), strategic_value: 'Hverdagsritual — loyalitet og daglig gentagelse' });
  if (hasPastries)    capabilities.push({ category: 'Bagværk og sødt',          count: Math.ceil(items.length * 0.3), strategic_value: 'Supplement til kaffe, impuls ved brunch' });
  if (hasSalads)      capabilities.push({ category: 'Salater',                  count: Math.ceil(items.length * 0.2), strategic_value: 'Let og frisk — passer til sol og sommerperiode' });
  if (hasSandwiches)  capabilities.push({ category: 'Sandwich og lette retter', count: Math.ceil(items.length * 0.3), strategic_value: 'Hurtig frokost og take-away-venlig' });
  if (hasBrunchItems) capabilities.push({ category: 'Brunch og æggeret',        count: Math.ceil(items.length * 0.2), strategic_value: 'Weekendbrunch — planlagt besøg, høj dwell-time' });
  if (hasDesserts)    capabilities.push({ category: 'Dessert',                  count: Math.ceil(items.length * 0.2), strategic_value: 'Premium afslutning — loyalitets- og wow-content' });
  if (hasDrinks)      capabilities.push({ category: 'Drinksmenu',                count: Math.max(drinkNames.length, 3), strategic_value: 'Cocktails/vin/øl — social aften-content, drink-pairing med retter' });

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

/**
 * Legacy BASE_SLOTS - kept as fallback when revenue_drivers unavailable
 * See business-rules-engine.ts for data-driven slot generation
 */
const BASE_SLOTS_FALLBACK: SlotTemplate[] = [
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
  // Phase 1 AI now determines goal_mode, content_type, content_category, timing_window,
  // and promoted_moment directly per angle. This function passes those values through and
  // fills fallbacks only for fields the AI left missing.
  // The deterministic slot rotation (prevent repeating last week's category) still runs.

  // ── Pre-pass: semantically match each occasion to an angle ──────────────────
  // The AI was told to copy each occasion's resolved_post_timing as the angle's
  // timing_window. We match by timing DOW overlap first (strongest signal), then
  // fall back to goal_mode affinity. This is robust even if the AI re-ordered angles.
  const activeOccasions = (context as any).active_occasions_this_week as
    import('../occasions/occasion-library.ts').ActiveOccasion[] | undefined;

  const occasionByAngleIdx = new Map<number, import('../occasions/occasion-library.ts').ActiveOccasion>();
  if (activeOccasions && activeOccasions.length > 0) {
    const DOW_MAP: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const getTimingDows = (w: string): number[] =>
      w.replace(/\s+\d+:\d+/, '').split('-').map(d => DOW_MAP[d]).filter((d): d is number => d !== undefined);

    const remaining = [...activeOccasions];

    // Pass 1: match by timing_window DOW overlap (AI should have copied occasion timings)
    for (const [aIdx, angle] of angles.entries()) {
      if (remaining.length === 0) break;
      const aiTw = ((angle as any).timing_window as string | undefined) ?? '';
      const aiDows = new Set(getTimingDows(aiTw));
      if (aiDows.size === 0) continue;
      const matchIdx = remaining.findIndex(o => getTimingDows(o.resolved_post_timing).some(d => aiDows.has(d)));
      if (matchIdx !== -1) occasionByAngleIdx.set(aIdx, remaining.splice(matchIdx, 1)[0]);
    }

    // Pass 2: match remaining occasions by goal_mode affinity
    for (const [aIdx, angle] of angles.entries()) {
      if (occasionByAngleIdx.has(aIdx) || remaining.length === 0) continue;
      const aiGoalMode = (angle as any).goal_mode as string | undefined;
      const matchIdx = aiGoalMode ? remaining.findIndex(o => o.goal_mode === aiGoalMode) : -1;
      occasionByAngleIdx.set(aIdx, matchIdx !== -1 ? remaining.splice(matchIdx, 1)[0] : remaining.shift()!);
    }

    console.log('[Phase 1] Occasion→angle matching:', [...occasionByAngleIdx.entries()]
      .map(([aIdx, o]) => `angles[${aIdx}](${(angles[aIdx] as any)?.timing_window})←${o.occasion_id}(${o.resolved_post_timing})`).join(', '));
  }

  let footfallCount = 0;
  const result = angles.map((angle, idx) => {
    const aiGoalMode     = (angle as any).goal_mode as GoalMode | undefined;
    const aiContentCatRaw = ((angle as any).content_category ?? (angle as any).suggested_content_category) as string | undefined;

    // Normalize Phase 1 AI vocabulary: the prompt allows content_type values like
    // 'atmosphere' / 'menu_item' / 'seasonal' to bleed into content_category.
    // Map them to valid ContentCategory values so phase2b template routing is correct.
    const CONTENT_CATEGORY_NORMALIZE: Record<string, ContentCategory> = {
      atmosphere: 'craving_visual',
      menu_item:  'product_menu',
      seasonal:   'craving_visual',
      experience: 'craving_visual',
    };
    const aiContentCat: ContentCategory | undefined =
      aiContentCatRaw && CONTENT_CATEGORY_NORMALIZE[aiContentCatRaw]
        ? CONTENT_CATEGORY_NORMALIZE[aiContentCatRaw]
        : aiContentCatRaw as ContentCategory | undefined;
    const aiTimingWindow = (angle as any).timing_window as string | undefined;

    // Occasion binding: semantically matched above (not by raw index)
    const occasionForSlot = occasionByAngleIdx.get(idx);
    const occasionTiming  = occasionForSlot?.resolved_post_timing;

    // Occasion goal_mode is a structural binding — overrides AI choice.
    const occasionGoalMode = occasionForSlot?.goal_mode as GoalMode | undefined;

    // Occasion content_type → content_category: only bind for 1:1 mappings.
    // 'behind_scenes' maps directly; other types let AI pick the sub-category.
    const occasionContentCat: ContentCategory | undefined =
      occasionForSlot?.content_type === 'behind_scenes' ? 'behind_scenes' : undefined;

    // Fallback: Revenue-driven slots (or BASE_SLOTS if revenue_drivers unavailable)
    const revenueDrivers = (context as any).revenue_drivers;
    const postingStrategy = (context as any).posting_strategy as PostingStrategy | null | undefined;
    const bookingModel = (context as any).booking_model as BookingModel | null | undefined;
    const slots = revenueDrivers 
      ? generateSlotsFromRevenueDriversUnified(revenueDrivers, postingStrategy, bookingModel)
      : BASE_SLOTS_FALLBACK;
    const fallback = slots[idx % slots.length];
    const goalMode:        GoalMode        = occasionGoalMode  ?? aiGoalMode  ?? fallback.goal_mode;
    const contentCategory: ContentCategory = occasionContentCat ?? aiContentCat ?? fallback.content_category;
    // Occasion timing takes priority over AI-generated timing; AI timing over BASE_SLOTS fallback
    const timingWindow:    string          = occasionTiming ?? aiTimingWindow ?? fallback.timing_window;

    // Derive slot_id for Phase 2b's SLOT_CANONICAL_TIMES lookup
    let slotId: 'A' | 'B' | 'C' | 'D';
    if (goalMode === 'drive_footfall') {
      slotId = footfallCount === 0 ? 'A' : 'B';
      footfallCount++;
    } else if (goalMode === 'build_brand') {
      slotId = 'C';
    } else {
      slotId = 'D';
    }

    // cta_mode: pass through from Phase 1 AI output; derive fallback from booking_model if absent
    const aiCtaMode = (angle as any).cta_mode as 'walk_in' | 'booking' | 'hybrid' | undefined;
    const bm = (context as any).booking_model;
    const fallbackCtaMode: 'walk_in' | 'booking' | 'hybrid' = bm?.reservation_required
      ? 'booking'
      : (bm?.accepts_walk_ins && bm?.has_booking_link)
        ? 'hybrid'
        : bm?.accepts_walk_ins
          ? 'walk_in'
          : 'booking';
    const ctaMode = aiCtaMode ?? fallbackCtaMode;

    return { ...angle, slot_id: slotId, goal_mode: goalMode, content_category: contentCategory, timing_window: timingWindow, cta_mode: ctaMode };
  });

  // ── Goal-blend enforcement: validate and correct AI's goal_mode distribution ──
  const contentStrategy = (context.brand_voice as any)?.content_strategy;
  const goalBlend = contentStrategy?.week_goal_blend ?? contentStrategy?.goal_blend;
  
  const actualCounts = {
    drive_footfall: result.filter(a => a.goal_mode === 'drive_footfall').length,
    build_brand:    result.filter(a => a.goal_mode === 'build_brand').length,
    retain_loyalty: result.filter(a => a.goal_mode === 'retain_loyalty').length,
  };
  
  console.log(`[Phase 1] AI output composition: ${actualCounts.drive_footfall} footfall, ${actualCounts.build_brand} brand, ${actualCounts.retain_loyalty} loyalty (of ${targetPostCount} posts)`);
  
  // If brand profile has goal_blend, enforce it strictly
  if (goalBlend) {
    const expectedCounts = computeSlotCounts(targetPostCount, goalBlend);
    console.log(`[Phase 1] Expected composition (from goal_blend): ${expectedCounts.drive_footfall} footfall, ${expectedCounts.build_brand} brand, ${expectedCounts.retain_loyalty} loyalty`);
    
    const needsCorrection = 
      actualCounts.drive_footfall !== expectedCounts.drive_footfall ||
      actualCounts.build_brand !== expectedCounts.build_brand ||
      actualCounts.retain_loyalty !== expectedCounts.retain_loyalty;
    
    if (needsCorrection) {
      console.warn(`[Phase 1] Goal-blend mismatch detected — enforcing brand profile distribution`);
      
      // Strategy: reassign goal_mode to match expected counts
      // Priority: keep angles with strong reasoning, swap weakest matches
      type GoalMode = 'drive_footfall' | 'build_brand' | 'retain_loyalty';
      const corrections: Array<{ from: GoalMode; to: GoalMode; count: number }> = [];
      
      // Calculate deltas
      const deltas = {
        drive_footfall: expectedCounts.drive_footfall - actualCounts.drive_footfall,
        build_brand:    expectedCounts.build_brand - actualCounts.build_brand,
        retain_loyalty: expectedCounts.retain_loyalty - actualCounts.retain_loyalty,
      };
      
      // Find which goal_mode has surplus (negative delta) and which needs more (positive delta)
      const surplus: GoalMode[] = (Object.keys(deltas) as GoalMode[]).filter(k => deltas[k] < 0);
      const deficit: GoalMode[] = (Object.keys(deltas) as GoalMode[]).filter(k => deltas[k] > 0);
      
      // Reassign from surplus to deficit
      for (const fromGoal of surplus) {
        let toReassign = Math.abs(deltas[fromGoal]);
        const candidateAngles = result.filter(a => a.goal_mode === fromGoal);
        
        // Sort by occasion binding (unbound first = easier to reassign)
        candidateAngles.sort((a, b) => {
          const aHasOccasion = occasionByAngleIdx.has(result.indexOf(a));
          const bHasOccasion = occasionByAngleIdx.has(result.indexOf(b));
          if (aHasOccasion && !bHasOccasion) return 1;  // b is easier to reassign
          if (!aHasOccasion && bHasOccasion) return -1; // a is easier to reassign
          return 0;
        });
        
        for (const angle of candidateAngles) {
          if (toReassign <= 0) break;
          
          // Find best deficit goal_mode for this angle
          const bestDeficitGoal = deficit.find(g => deltas[g] > 0);
          if (!bestDeficitGoal) break;
          
          console.log(`[Phase 1] Reassigning angle "${(angle as any).focus}" from ${fromGoal} → ${bestDeficitGoal}`);
          
          // Update goal_mode
          const oldGoalMode = angle.goal_mode;
          angle.goal_mode = bestDeficitGoal as any;
          
          // Update deltas
          deltas[fromGoal]++;
          deltas[bestDeficitGoal]--;
          toReassign--;
          
          // Re-derive slot_id based on new goal_mode
          // Important: Count how many angles with the NEW goal_mode appear BEFORE this one in result array
          if (bestDeficitGoal === 'drive_footfall') {
            const angleIndex = result.indexOf(angle);
            const priorFootfallCount = result.slice(0, angleIndex).filter(a => a.goal_mode === 'drive_footfall').length;
            angle.slot_id = priorFootfallCount === 0 ? 'A' : 'B';
          } else if (bestDeficitGoal === 'build_brand') {
            angle.slot_id = 'C';
          } else {
            angle.slot_id = 'D';
          }
        }
      }
      
      // Log final composition after enforcement
      const finalCounts = {
        drive_footfall: result.filter(a => a.goal_mode === 'drive_footfall').length,
        build_brand:    result.filter(a => a.goal_mode === 'build_brand').length,
        retain_loyalty: result.filter(a => a.goal_mode === 'retain_loyalty').length,
      };
      console.log(`[Phase 1] Final composition after enforcement: ${finalCounts.drive_footfall} footfall, ${finalCounts.build_brand} brand, ${finalCounts.retain_loyalty} loyalty`);
    }
  } else {
    // No goal_blend in brand profile — apply sensible warning
    if (actualCounts.drive_footfall > 2 && targetPostCount <= 4) {
      console.warn(`[Phase 1] Composition warning: ${actualCounts.drive_footfall} drive_footfall posts in ${targetPostCount}-post week — check reasoning for justification.`);
    }
  }

  // ── Deterministic slot rotation: guarantee C/D don't repeat same content_category as last week ──
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
      if (compatible.length <= 1) continue;

      const alternative = compatible.find(c => c !== prevCat && !usedCats.has(c));
      if (alternative) {
        console.log(`[Phase 1] Deterministic rotation: slot ${angle.slot_id} ${angle.content_category} → ${alternative} (was same as last week)`);
        usedCats.delete(angle.content_category as ContentCategory);
        angle.content_category = alternative;
        usedCats.add(alternative);
      }
    }
  }

  // ── Day-spread enforcement: prevent all posts clustering on Thu-Fri ─────────
  // If build_brand or retain_loyalty slots have a Thu/Fri timing_window, correct
  // them to their canonical early-week windows so the week has posts Mon-Wed too.
  // Footfall slots (A/B) intentionally stay on Thu-Fri (peak conversion window).
  // Only applies when timing_window is the generic "Thu-Fri" fallback — not when
  // an occasion or specific event drives a Thu/Fri brand post (e.g. a Thursday
  // event worth covering for awareness).
  const THU_FRI_PATTERN = /^(Thu|Fri|Thu-Fri|Fri-Sat)/i;
  const EARLY_WEEK_DEFAULTS: Record<string, string> = {
    build_brand:    'Mon-Tue 09:00',
    retain_loyalty: 'Wed-Thu 11:00',
  };
  for (const angle of result) {
    if (angle.goal_mode === 'drive_footfall') continue; // footfall stays Thu-Fri
    const tw = (angle as any).timing_window as string | undefined;
    if (!tw || !THU_FRI_PATTERN.test(tw)) continue;
    // Only correct if NOT occasion-bound (occasion may legitimately be on Thu/Fri)
    const angleIdx = result.indexOf(angle);
    if (occasionByAngleIdx.has(angleIdx)) continue;
    const corrected = EARLY_WEEK_DEFAULTS[angle.goal_mode] ?? 'Mon-Tue 09:00';
    console.log(`[Phase 1] Day-spread: slot ${angle.slot_id} (${angle.goal_mode}) timing_window "${tw}" → "${corrected}"`);
    (angle as any).timing_window = corrected;
  }

  return result;
}
