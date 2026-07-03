/**
 * STRATEGY MODULATOR
 *
 * Weekly contextual modulation of content strategy.
 * Reads the business's static goal_blend + content_category_weights from the brand profile,
 * evaluates this week's contextual signals, and either:
 *   a) returns the baseline unchanged (zero AI cost) if signals are weak, or
 *   b) calls Gemini to produce a week-specific adjustment with a user-visible Danish rationale.
 *
 * Output: WeeklyModulation injected into WeekContext.brand_voice.content_strategy as:
 *   week_goal_blend + week_content_category_weights + week_strategic_rationale.
 *
 * Phase 1's assignSlotMetadata() reads week_goal_blend ?? goal_blend — so the weekly
 * modulation flows through to slot counts automatically.
 *
 * Trigger conditions (any one fires a Gemini call):
 *   - Outdoor seating + avg_temp > 18°C
 *   - avg_temp deviates > 5°C from seasonal norm (DK)
 *   - economic.pattern === 'salary_week' (post-payday, elevated purchase intent)
 *   - economic.pattern === 'december_high'
 *   - A public holiday falls within the week
 *   - Published goal_mode_rates diverge > 20% from baseline for ≥ 3 historical weeks
 */

import type { WeekContext } from '../types/strategy-types.ts';
import { callGeminiWithRetry } from './infrastructure.ts';

export interface WeeklyModulation {
  week_goal_blend: {
    drive_footfall: number;
    build_brand: number;
  };
  week_content_category_weights: {
    product_menu: number;
    craving_visual: number;
    behind_scenes: number;
    team_people: number;
  };
  /** 1–2 sentences in Danish shown to the business owner */
  week_strategic_rationale: string;
  /** Which specific signals drove the adjustment — for logging / debugging */
  modulation_factors: string[];
  /** Semantic label for the kind of week this is — consumed by Phase 1 for framing */
  week_mode: string;
  /** Topic labels Phase 1 must NOT allocate capacity to this week */
  deprioritize: string[];
  /** Intensity of modulation applied */
  modulation_intensity: 'none' | 'light' | 'strong';
}

// Seasonal baseline temperatures for Denmark (rough heuristic)
const SEASONAL_TEMP_DK: Record<string, number> = {
  winter: 2,
  spring: 10,
  summer: 20,
  autumn: 9,
};

interface ModulationScore {
  score: number;
  intensity: 'none' | 'light' | 'strong';
  factors: string[];
}

/**
 * Computes a weighted modulation score from contextual signals.
 * score < 1.0  → 'none'   — return baseline with zero AI cost
 * 1.0 ≤ score < 2.5 → 'light'  — call Gemini with ±8pp cap
 * score ≥ 2.5        → 'strong' — call Gemini with ±15pp cap
 */
function computeModulationScore(context: WeekContext): ModulationScore {
  let score = 0;
  const factors: string[] = [];

  const weatherRelevance   = (context as any).weather_relevance_for_business as string | undefined;
  const weatherEffect      = (context as any).weather_effect_on_visit_behavior as string | undefined;
  const economicRelevance  = (context as any).economic_relevance_for_business as string | undefined;
  const locationBehaviorMode = (context as any).location_behavior_mode as string | undefined;
  const locationType       = context.location?.type;

  // ── Weather signals ───────────────────────────────────────────────────────
  if (weatherEffect === 'terrace_pull' && weatherRelevance === 'high') {
    score += 2.0;
    factors.push('terrace_opportunity');
  } else if (weatherEffect === 'indoor_refuge' && weatherRelevance === 'high') {
    score += 1.5;
    factors.push('indoor_refuge_high_relevance');
  } else if (weatherEffect === 'takeaway_pull' && weatherRelevance !== 'low') {
    score += 1.5;
    factors.push('takeaway_pull');
  } else if (weatherRelevance === 'medium') {
    const seasonalAvg = SEASONAL_TEMP_DK[context.season.current] ?? 10;
    if (Math.abs(context.weather.avg_temp - seasonalAvg) > 5) {
      score += 0.75;
      factors.push('temp_deviation_medium_relevance');
    }
  } else if (weatherRelevance === 'low') {
    // Low weather sensitivity — tiny score only for extreme temp deviations
    const seasonalAvg = SEASONAL_TEMP_DK[context.season.current] ?? 10;
    if (Math.abs(context.weather.avg_temp - seasonalAvg) > 8) {
      score += 0.25;
      factors.push('temp_deviation_low_relevance');
    }
  }

  // ── Economic signals ──────────────────────────────────────────────────────
  if (context.economic.payday_this_week) {
    if (economicRelevance === 'high') {
      score += 1.5;
      factors.push('payday_high_relevance');
      // Extra bonus for late-week payday (Thu/Fri → weekend spend unlocked)
      if (context.economic.payday_day_name === 'torsdag' || context.economic.payday_day_name === 'fredag') {
        score += 0.5;
        factors.push('payday_late_week');
      }
    } else if (economicRelevance === 'medium') {
      score += 0.75;
      factors.push('payday_medium_relevance');
    }
    // low relevance: no score
  }

  // budget_conscious: modest score so Gemini can fire and apply caution framing (high/medium relevance only)
  if (context.economic.pattern === 'budget_conscious') {
    if (economicRelevance === 'high') {
      score += 0.5;
      factors.push('budget_conscious_high_relevance');
    } else if (economicRelevance === 'medium') {
      score += 0.25;
      factors.push('budget_conscious_medium_relevance');
    }
  }

  if (context.economic.pattern === 'december_high') {
    score += 1.0;
    factors.push('december_high');
  }

  if (context.economic.pattern === 'july_vacation' &&
      (locationType === 'tourist_area' || locationType === 'waterfront')) {
    score += 1.0;
    factors.push('july_vacation_tourist_location');
  }

  // ── Event signals ─────────────────────────────────────────────────────────
  if ((context.events || []).some(e => e.type === 'holiday')) {
    score += 1.0;
    factors.push('public_holiday');
  }

  // ── Location signals ──────────────────────────────────────────────────────
  if (locationBehaviorMode === 'waterfront_outing') {
    score += 1.0;
    factors.push('waterfront_location');
  } else if (locationBehaviorMode === 'tourist_discovery') {
    score += 0.75;
    factors.push('tourist_area');
  } else if (locationBehaviorMode === 'city_office_lunch') {
    score += 1.0;
    factors.push('office_lunch_location');
  }

  // ── Historical divergence ─────────────────────────────────────────────────
  const sp = context.previous_week?.selection_patterns;
  const cs = context.brand_voice?.content_strategy;
  if ((sp?.weeks_analyzed ?? 0) >= 3 && cs?.goal_blend) {
    const rates = sp!.goal_mode_rates as Record<string, number>;
    const blend = cs.goal_blend;
    const total = blend.drive_footfall + blend.build_brand;
    if (total > 0) {
      const blendNorm = {
        drive_footfall: blend.drive_footfall / total,
        build_brand:    blend.build_brand    / total,
      };
      for (const key of ['drive_footfall', 'build_brand'] as const) {
        if (Math.abs((rates[key] || 0) - blendNorm[key]) > 0.20) {
          score += 1.0;
          factors.push('historical_divergence');
          break;
        }
      }
    }
  }

  const intensity: 'none' | 'light' | 'strong' =
    score < 1.0 ? 'none' :
    score < 2.5 ? 'light' :
    'strong';

  return { score, intensity, factors };
}

/**
 * Re-normalise a record of numbers to sum exactly to 100
 * using the Hamilton/largest-remainder method.
 */
function normaliseToHundred(values: Record<string, number>): Record<string, number> {
  const keys = Object.keys(values);
  const total = keys.reduce((s, k) => s + (values[k] || 0), 0);
  if (total === 0) {
    const even = Math.round(100 / keys.length);
    return Object.fromEntries(keys.map(k => [k, even]));
  }
  const scaled     = Object.fromEntries(keys.map(k => [k, values[k] / total * 100]));
  const floors     = Object.fromEntries(keys.map(k => [k, Math.floor(scaled[k])]));
  const remainders = Object.fromEntries(keys.map(k => [k, scaled[k] - Math.floor(scaled[k])]));
  let deficit = 100 - keys.reduce((s, k) => s + floors[k], 0);
  const sorted = [...keys].sort((a, b) => remainders[b] - remainders[a]);
  for (let i = 0; i < deficit; i++) {
    floors[sorted[i % sorted.length]]++;
  }
  return floors;
}

/**
 * Derives a semantic label for the kind of week this is.
 * Deterministic — no AI. Consumed by Phase 1 for framing.
 */
function deriveWeekMode(context: WeekContext, scoreFactors: string[]): string {
  const weatherEffect      = (context as any).weather_effect_on_visit_behavior as string | undefined;
  const locationMode       = (context as any).location_behavior_mode as string | undefined;
  const economicRelevance  = (context as any).economic_relevance_for_business as string | undefined;
  const econ               = context.economic.pattern;

  // Weather-first: strongest single-dimension signal
  if (weatherEffect === 'terrace_pull' && locationMode === 'waterfront_outing') return 'terrace_season_opener';
  if (weatherEffect === 'terrace_pull') return 'terrace_pull_week';
  if (weatherEffect === 'indoor_refuge' && locationMode === 'city_office_lunch') return 'indoor_refuge_with_lunch_conversion';
  if (weatherEffect === 'indoor_refuge' && locationMode === 'waterfront_outing') return 'indoor_refuge_waterfront';
  if (weatherEffect === 'indoor_refuge') return 'indoor_refuge_week';
  if (weatherEffect === 'takeaway_pull') return 'takeaway_opportunity_week';

  // Economic patterns
  if (econ === 'july_vacation' && (locationMode === 'tourist_discovery' || locationMode === 'waterfront_outing')) return 'summer_discovery_peak';
  if (econ === 'december_high') return 'december_festive_push';
  if (context.economic.payday_this_week && economicRelevance === 'high') {
    const paydayDay = context.economic.payday_day_name;
    if (paydayDay === 'torsdag' || paydayDay === 'fredag') return 'payday_weekend_push';
    return 'payday_evening_push';
  }

  // Location character
  if (locationMode === 'waterfront_outing') return 'waterfront_pause_week';
  if (locationMode === 'tourist_discovery') return 'tourist_discovery_week';
  if (locationMode === 'city_office_lunch') return 'city_lunch_week';

  // Weak signals
  if (scoreFactors.includes('public_holiday')) return 'holiday_leisure_week';
  if (scoreFactors.includes('historical_divergence')) return 'rebalance_week';

  return 'standard_week';
}

/**
 * Computes topics that Phase 1 should NOT allocate capacity to this week.
 * Deterministic — no AI.
 */
function deriveDeprioritize(context: WeekContext): string[] {
  const deprioritize: string[] = [];
  const weatherRelevance  = (context as any).weather_relevance_for_business as string | undefined;
  const economicRelevance = (context as any).economic_relevance_for_business as string | undefined;
  const weatherEffect     = (context as any).weather_effect_on_visit_behavior as string | undefined;
  const locationType      = context.location?.type;

  // Weather not relevant for this business — suppress weather hooks
  if (weatherRelevance === 'low') deprioritize.push('weather_story');

  // Payday timing irrelevant — suppress economic push angles
  if (economicRelevance === 'low') {
    deprioritize.push('salary_push');
    deprioritize.push('payday_deal');
  }

  // Weather drives indoors or no outdoor seating — suppress outdoor vibe content
  if (weatherEffect === 'indoor_refuge' || !context.weather.has_outdoor_seating) {
    deprioritize.push('outdoor_seating_vibe');
  }

  // Residential area in July without tourist boost — locals are away, tourist angle misfires
  if (context.economic.pattern === 'july_vacation' &&
      locationType === 'residential' &&
      !context.location?.is_july_tourist_boost) {
    deprioritize.push('tourist_oplevelse');
  }

  return deprioritize;
}

function buildModulationPrompt(context: WeekContext, intensity: 'light' | 'strong', weekMode: string, deprioritize: string[]): string {
  const cs = context.brand_voice!.content_strategy!;
  const bg = cs.goal_blend;
  const bw = cs.content_category_weights;

  const rainChances = context.weather.days.map(d => d.precipitation_chance || 0).filter(r => r > 0);
  const windSpeeds  = context.weather.days.map(d => d.wind_speed || 0).filter(w => w > 0);
  let weatherDesc = `${context.weather.pattern}, ${context.weather.avg_temp}°C gennemsnit`;
  if (rainChances.length > 0) weatherDesc += `, ~${Math.round(rainChances.reduce((a, b) => a + b, 0) / rainChances.length)}% regnchance`;
  if (windSpeeds.length > 0)  weatherDesc += `, ~${Math.round(windSpeeds.reduce((a, b) => a + b, 0) / windSpeeds.length)}m/s vind`;

  const sp = context.previous_week?.selection_patterns;
  const historicalHint = (sp?.weeks_analyzed ?? 0) >= 2
    ? `Historisk publicering (${sp!.weeks_analyzed} uger): drive_footfall ${Math.round(((sp!.goal_mode_rates as any)?.drive_footfall || 0) * 100)}%, build_brand ${Math.round(((sp!.goal_mode_rates as any)?.build_brand || 0) * 100)}%`
    : 'Ikke tilstrækkelig historisk data endnu';

  return `Du er content-strateg for ${context.business_name}. Justér den ugentlige content-strategi ud fra ugens konkrete kontekst.

BASELINE (normal fordeling — udgangspunkt):
- goal_blend: drive_footfall ${bg.drive_footfall}%, build_brand ${bg.build_brand}%
- content_category_weights: product_menu ${bw.product_menu}%, craving_visual ${bw.craving_visual}%, behind_scenes ${bw.behind_scenes}%, team_people ${bw.team_people}%

UGENS KARAKTER:
- week_mode: ${weekMode}
- Justeringsintensitet: ${intensity === 'strong' ? 'stærk (op til ±15pp)' : 'let (op til ±8pp)'}
${deprioritize.length > 0 ? `- Deprioriteringsangivelse: ${deprioritize.join(', ')} (disse vinkler har lav relevans denne uge)` : ''}

UGENS KONTEKST:
- Vejr: ${weatherDesc}
- Udeservering: ${context.weather.has_outdoor_seating ? 'Ja' : 'Nej'}
${(context as any).weather_relevance_for_business ? `- Vejrrelevans for denne virksomhed: ${(context as any).weather_relevance_for_business}` : ''}
${(context as any).weather_effect_on_visit_behavior ? `- Vejr-adfærdseffekt: ${(context as any).weather_effect_on_visit_behavior}` : ''}
${(context as any).weather_effect_on_daypart ? `- Vejr-dagsdelseffekt: ${(context as any).weather_effect_on_daypart}` : ''}
${(context as any).business_archetype ? `- Virksomhedsarketype: ${(context as any).business_archetype.replace(/_/g, ' ')}` : ''}
${(context as any).business_mode ? `- Driftsform: ${{ morning_cafe: 'morgenbar/café (morgen, lukker før frokost)', coffee_bar_takeaway: 'kaffeudtag (primært take-away)', brunch_lunch_cafe: 'brunch- og frokostcafé (morgen til midt eftermiddag)', all_day_cafe: 'heldagscafé (morgen til sen eftermiddag, intet aftenkøkken)', lunch_restaurant: 'frokostrestaurant (kun frokost)', dinner_restaurant: 'aftenrestaurant (kun aften, forudbestilling)', evening_bar: 'aftenbar (drinks/cocktails/vinkort om aftenen)', hybrid_day_to_evening: 'dag- og aftensted (åbner til dagsbesøg, fortsætter til aftenservering)' }[(context as any).business_mode as string] ?? (context as any).business_mode.replace(/_/g, ' ')}` : ''}
${context.service_periods && context.service_periods.length > 0 ? `- Serviceprogrammer: ${context.service_periods.join(', ')} (alle perioder denne virksomhed dækker)` : ''}
${(context as any).menu_programmes && (context as any).menu_programmes.length > 0 ? `- Menu-programmer: ${(context as any).menu_programmes.map((p: { role: string; timeContext: string | null }) => `${p.role}${p.timeContext ? ` (${p.timeContext})` : ''}`).join(', ')}` : ''}
${(context as any).visit_mode ? `- Besøgsmodel: ${(context as any).visit_mode}` : ''}
${(context as any).primary_visit_motivation ? `- Primær besøgsmotivation: ${(context as any).primary_visit_motivation}` : ''}
${(context as any).secondary_visit_motivations && (context as any).secondary_visit_motivations.length > 0 ? `- Sekundære motivationer: ${(context as any).secondary_visit_motivations.join(', ')}` : ''}
${context.core_guest_occasions && (context.core_guest_occasions as any[]).length > 0 ? `- Kerneanledninger: ${(context.core_guest_occasions as Array<{occasion: string; primary: boolean; day_pattern: string}>).map(o => `${o.occasion} (${o.day_pattern}${o.primary ? ', primær' : ''})`).join('; ')}` : ''}
${(context as any).primary_daypart_this_week ? `- Primær dagsdel denne uge: ${(context as any).primary_daypart_this_week}` : ''}
${(context as any).location_behavior_mode ? `- Lokalitetsadfærd: ${(context as any).location_behavior_mode.replace(/_/g, ' ')}` : ''}
${context.location?.type ? `- Lokationstype: ${context.location.type.replace(/_/g, ' ')}` : ''}
${context.location?.tourist_context ? `- Turistkontekst: Ja (turisttrafik er en reel faktor)` : ''}
${context.location?.location_categories && (context.location.location_categories as any[]).length > 0 ? `- Lokationskategorier (score ≥60%): ${(context.location.location_categories as Array<{type: string; score: number}>).map(c => `${c.type.replace(/_/g, ' ')} (${Math.round(c.score * 100)}%)`).join(', ')}` : ''}
${context.location?.matched_motivations && (context.location.matched_motivations as string[]).length > 0 ? `- Besøgsmotiver (matchede): ${(context.location.matched_motivations as string[]).join(', ')}` : ''}
${(context as any).late_night_closing ? `- Senklukning: Ja (åbent efter midnat)` : ''}
${(context.location as any)?.has_takeaway ? `- Takeaway: Ja` : ''}
- Sæson: ${context.season.current}
- Timing: Uge ${context.economic.week_of_month}/4 · mønster: ${context.economic.pattern}${context.economic.december_phase ? ` · december-fase: ${context.economic.december_phase}` : ''}${(context as any).economic_relevance_for_business ? ` · øk.relevans for denne virksomhed: ${(context as any).economic_relevance_for_business}` : ''}${context.economic.payday_this_week && context.economic.payday_day_name ? ` · løndag: ${context.economic.payday_day_name}` : ''}
- Events denne uge: ${(context.events || []).length > 0 ? context.events.map(e => `${e.name_dk} (${e.type})`).join(', ') : 'Ingen'}
- ${historicalHint}

ARKETYPE-FRAMING:
Din justering skal afspejle det naturlige besøgsvindue for denne virksomhedstype:
- morning_cafe / brunch_cafe: tyngdepunktet er hverdagsmorgen og weekendbrunch — vægt craving_visual og product_menu for dagtimerne; events og payday har begrænset aftenvægt
- lunch_restaurant / fast_casual: tyngdepunktet er hverdagsfrokost 11:30–14:00 — drive_footfall er primær driver; weekendvægt lavere end for aftenkoncept
- dinner_restaurant / full_service_restaurant: tyngdepunktet er aften og weekender — social motivation og brand-opbygning vejer tungt; payday og events er stærke signaler
- evening_bar / wine_bar / late_night_bar: tyngdepunktet er aften, sociale events og fredage — build_brand frem for footfall-push; senklukning forstærker weekend-signaler
- all_day_cafe: dækker hele dagen — brug primary_daypart_this_week til at afgøre om vægten denne uge falder på morgen/middag eller eftermiddag
- hybrid_day_to_evening (fx café+restaurant+bar, frokoststed+aftenbar): dækker flere perioder — serviceprogrammer og menu-programmer viser alle aktive perioder; brug primary_daypart_this_week som autoritet for DENNE UGES tyngdepunkt. Juster ikke blindt mod aftenvægt bare fordi virksomheden har bar — vægten skal følge hvad konteksten (vejr, event, timing) faktisk driver trafik til DENNE uge.

HYBRID-TIEBREAKER: Hvis driftsform er hybrid_day_to_evening og serviceprogrammer spænder over både dag og aften:
  → primary_daypart_this_week er den afgørende faktor for ugens vægtning
  → Eks: primary_daypart = "lunch" → dagtidsprogrammer (frokost, café) får højere vægt denne uge
  → Eks: primary_daypart = "evening" + payday fredag → aftenprogrammer (bar, dinner) får højere vægt denne uge
  → Begge programmer kan stadig repræsenteres — men én retning skal dominere

LOKATIONS-FRAMING: Brug lokationskategorier og besøgsmotiver til at farve indholdsretningen:
- waterfront / destination + motiver som "destination_meal" / "familieudflug": løft craving_visual og build_brand — folk rejser til stedet, oplevelsesfremstilling virker
- city_center + motiver som "office_lunch" / "quick_meal": løft drive_footfall og product_menu — nytteframing og synlighed i hverdagen virker
- tourist_area / tourist_context = Ja: løft build_brand og behind_scenes — introductory framing frem for loyalty; stedet er nyt for mange
- residential (ingen turistboost): hverdagslokal framing, stamkunder og genbesøg er primær driver
- Hvis lokation scorer højt på FLERE kategorier: vægt efter den kategori med højest score; de andre kategorier kan understøtte men ikke overstyre

DAGSDEL × VEJR-KRYDS: Kombiner vejr-adfærdseffekt og vejr-dagsdelseffekt til konkret indholdsretning:
- vejr_dagsdelseffekt = "morning" + indoor_refuge: løft product_menu (varm morgenmad, kaffe, komfortret) + craving_visual — morgenbesøg er habituel, komfort er differentiator; hold drive_footfall
- vejr_dagsdelseffekt = "morning" + takeaway_pull: løft product_menu (konkret tilbud) + drive_footfall; sænk experiential (craving_visual, behind_scenes) — convenience er hele mekanismen
- vejr_dagsdelseffekt = "lunch" + indoor_refuge: løft drive_footfall + product_menu — frokostpause-refuge er den stærkeste konverteringsmekanisme; folk beslutter spontant om de går ud
- vejr_dagsdelseffekt = "lunch" eller "all_day" + terrace_pull: løft craving_visual — udetid er begrænset, visuel udendørs posting er den stærkeste pull-mekanisme
- vejr_dagsdelseffekt = "evening" eller "minimal": vejr er IKKE en faktor for aftenkoncepter — flyt IKKE vægte pga. vejr; hold arketype-baseline
- vejr_dagsdelseffekt = "all_day" + indoor_refuge: spred løft ligeligt mellem product_menu og craving_visual; ingen enkelt dagsdel dominerer
VIGTIGT: Brug kun dette kryds når vejr-adfærdseffekt ≠ "minimal" — ellers er vejr irrelevant som justeringsgrundlag.

MOTIVATIONS-FRAMING: Primær besøgsmotivation sætter den grundlæggende indholdsretning uafhængigt af vejr:
- social: løft build_brand + behind_scenes/team_people — stedet og menneskene er differentiator; folk deler oplevelsen
- pause: løft drive_footfall + product_menu — hverdagssynlighed og nytteframing; besøget er rutinebaseret, ikke planlagt
- meal: løft drive_footfall + product_menu — frokost/middagsnødvendighed; konkret tilbud > atmosfære
- treat: løft craving_visual + product_menu (premium) — sensorisk fremstilling og belønningslogik; folk retfærdiggør valget med produktet
- discovery: løft build_brand + craving_visual — stedet er nyt for gæsten; førstehåndsindtryk > loyalitetshooks
- discovery + visit_mode = destination (COMPOUND): forstærket build_brand løft — folk har aktivt valgt stedet, brandfortællingen bærer ekstra vægt
Sekundære motivationer nuancerer men overstyrer ALDRIG primær retning. Brug dem kun hvis primær retning allerede er sat.

ØKONOMI-FRAMING: Brug kun økonomi-timing som justeringsgrundlag når øk.relevans ≠ low:
- salary_week + øk.relevans high: løft craving_visual og build_brand (spend-intent er åben); if løndag = torsdag/fredag løft OGSÅ drive_footfall for weekend-push
- salary_week + øk.relevans medium: let løft craving_visual; ingen footfall-push — løn udløser ikke nødvendigvis besøg, men sænker prisfølsomheden
- salary_week + løndag = mandag/tirsdag + high: temper forventning — spend spredes over ugen, ingen skarp weekend-effekt
- budget_conscious + øk.relevans high: løft value-framing i product_menu; sænk premium craving_visual — gæster er prisfølsomme, konkret tilbud virker bedre end forkælelsesframing
- budget_conscious + øk.relevans medium: minimal justering; flyt IKKE category weights
- normal_spend: hold baseline — ingen timing-baseret justering; lad arketype og motivation bære vægten
- december_high: løft build_brand + craving_visual uanset uge-position — december er en samlet premium-periode
- december_fase = jul_nytaar: løft build_brand og behind_scenes; de faste gæster er tilbage
VIGTIGT: Økonomi-framing overstyrer ALDRIG arketype-baseline — den justerer kun inden for intensity-grænsen.

VIGTIGT: Arketype sætter den naturlige retning — konteksten (vejr, events, payday) sætter intensiteten. Juster KUN inden for ±${intensity === 'strong' ? '15' : '8'}pp fra baseline.

REGLER:
- Maksimalt ${intensity === 'strong' ? '±15' : '±8'} procentpoint afvigelse fra baseline pr. dimension
- Ingen dimension under 10%
- goal_blend skal summere til 100, content_category_weights skal summere til 100
- week_strategic_rationale: max 2 sætninger på DANSK, forståeligt for restaurantejeren (hvad ændrer sig og hvorfor)
- modulation_factors: array af de specifikke signaler der begrunder justeringen (f.eks. ["vejr 22°C + udeservering", "salary_week"])
- Hvis ingen signaler berettiger justering: returner baseline-tal uændret, rationale = "Ingen markante kontekstuelle signaler denne uge — vi holder den faste strategi."

Returner UDELUKKENDE valid JSON:
{
  "week_goal_blend": { "drive_footfall": number, "build_brand": number },
  "week_content_category_weights": { "product_menu": number, "craving_visual": number, "behind_scenes": number, "team_people": number },
  "week_strategic_rationale": "string",
  "modulation_factors": ["string"]
}`.trim();
}

/**
 * Generate (or passthrough) a weekly modulation for the given WeekContext.
 * Call once per weekly plan generation, before Phase 1.
 */
export async function generateWeeklyModulation(context: WeekContext): Promise<WeeklyModulation> {
  const cs = context.brand_voice?.content_strategy;

  // No baseline: return sensible defaults (should be rare in production)
  if (!cs?.goal_blend) {
    console.log('[Modulator] No baseline content_strategy — returning defaults');
    return {
      week_goal_blend:               { drive_footfall: 65, build_brand: 35 },
      week_content_category_weights: { product_menu: 35, craving_visual: 25, behind_scenes: 25, team_people: 15 },
      week_strategic_rationale:      'Ingen baseline content strategy fundet — standardfordeling anvendt.',
      modulation_factors:            ['no_baseline'],
      week_mode:                     'standard_week',
      deprioritize:                  [],
      modulation_intensity:          'none',
    };
  }

  const { score, intensity, factors } = computeModulationScore(context);
  const week_mode   = deriveWeekMode(context, factors);
  const deprioritize = deriveDeprioritize(context);

  console.log('[Modulator] Score:', { score, intensity, week_mode, factors });

  // No notable signals: return baseline as-is (zero AI cost)
  if (intensity === 'none') {
    console.log('[Modulator] Intensity none — returning baseline unchanged');
    return {
      week_goal_blend:               { ...cs.goal_blend },
      week_content_category_weights: { ...cs.content_category_weights },
      week_strategic_rationale:      'Ingen markante kontekstuelle signaler denne uge — vi holder den faste strategi.',
      modulation_factors:            [],
      week_mode,
      deprioritize,
      modulation_intensity:          'none',
    };
  }

  console.log('[Modulator] Context signals detected — calling Gemini for weekly modulation');
  const prompt = buildModulationPrompt(context, intensity, week_mode, deprioritize);

  try {
    const result = await callGeminiWithRetry(
      prompt,
      { temperature: 0.3, maxOutputTokens: 512, jsonMode: true, model: 'gemini-2.5-flash' },
      'Weekly Modulator'
    );
    const raw = result.parsed;

    // Validate — if AI returned junk, throw to trigger graceful fallback
    if (!raw?.week_goal_blend || !raw?.week_content_category_weights) {
      throw new Error('Modulator response missing required fields');
    }

    // Re-normalise to exact 100 sums (guards against AI rounding drift)
    const normBlend = normaliseToHundred(raw.week_goal_blend);
    const normCCW   = normaliseToHundred(raw.week_content_category_weights);

    const modulation: WeeklyModulation = {
      week_goal_blend: {
        drive_footfall: normBlend.drive_footfall,
        build_brand:    normBlend.build_brand,
      },
      week_content_category_weights: {
        product_menu:   normCCW.product_menu,
        craving_visual: normCCW.craving_visual,
        behind_scenes:  normCCW.behind_scenes,
        team_people:    normCCW.team_people,
      },
      week_strategic_rationale: raw.week_strategic_rationale || 'Strategi justeret ud fra ugens kontekst.',
      modulation_factors: Array.isArray(raw.modulation_factors) ? raw.modulation_factors : factors,
      week_mode,
      deprioritize,
      modulation_intensity: intensity,
    };

    console.log('[Modulator] Result:', {
      intensity,
      week_mode,
      factors: modulation.modulation_factors,
      rationale: modulation.week_strategic_rationale,
      blend_delta: {
        drive_footfall: modulation.week_goal_blend.drive_footfall - cs.goal_blend.drive_footfall,
        build_brand:    modulation.week_goal_blend.build_brand    - cs.goal_blend.build_brand,
      },
    });

    return modulation;

  } catch (err) {
    console.error('[Modulator] Gemini call failed — falling back to baseline:', err);
    return {
      week_goal_blend:               { ...cs.goal_blend },
      week_content_category_weights: { ...cs.content_category_weights },
      week_strategic_rationale:      'Strategi-justering utilgængelig denne uge — baseline strategi anvendt.',
      modulation_factors:            ['fallback_error'],
      week_mode,
      deprioritize,
      modulation_intensity:          'none',
    };
  }
}
