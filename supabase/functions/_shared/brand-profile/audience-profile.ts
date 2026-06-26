/**
 * Layer 4: Audience Segmentation
 * 
 * Purpose: Programme-specific audience segmentation
 * - WHO visits each programme
 * - WHEN they visit (timing_windows)
 * - WHAT resonates with them (content_angles)
 * 
 * Scope: Programme-level (different segments per programme)
 * Model: gpt-4o-mini (temperature 0.3, max_tokens 1500, ~15s per programme)
 * 
 * Strategic Principles (User-Approved):
 * 1. AI decides 2-4 segments per programme (complexity detector)
 * 2. Overlapping across programmes, exclusive within programme
 * 3. Replace Stage B5 (programme-level is source of truth)
 * 4. Must align with Layer 2 (primary segment matches decision_timing + goal_split)
 * 5. Include evidence field (menu items, hours, location facts)
 */

import OpenAI from "https://deno.land/x/openai@v4.20.1/mod.ts";
import { getV5Prompt } from './v5-prompts.ts';

// ===== TYPES =====

export interface AudienceSegment {
  label: string;                    // "Weekend-familier", "Brunch-entusiaster"
  timing_windows: string[];         // ["Lør-Søn 10:00-13:00"]
  content_angles: string[];         // ["Børnevenlig menu", "Hyggelige weekender"]
  segment_size: string;             // "primary" | "secondary" | "niche"
  motivation: string;               // "social_gathering" | "convenience" | "experience_seeking"
  decision_timing: string;          // "spontaneous" | "planned" | "mixed"
  goal_contribution: string;        // "drive_footfall" | "strengthen_brand" | "retain_regulars"
  evidence: string[];               // ["Menu has børneportioner", "Weekend hours 09:00-13:00"]
  concept_fit_reason: string;       // Why this segment fits the business concept + location (REQUIRED)
}

export interface ProgrammeAudienceProfile {
  programme_type: string;
  programme_name: string;
  audience_segments: AudienceSegment[];
  segment_confidence: number;       // 0-1
  segment_reasoning: string;        // Why these segments chosen
}

interface BusinessData {
  business_name: string;
  business_category: string;
  city: string;
  establishment_type?: string;
}

interface MenuData {
  items: Array<{
    name: string;
    description?: string;
    category?: string;
    price?: number;
  }>;
}

interface ProgrammeData {
  programme_type: string;
  programme_name: string;
  time_windows: string[];
  operating_days: string[];
  menu_evidence: string[];
  confidence: number;
  languageVariants?: string[];  // e.g., ['da', 'en'] - signals international audience
}

interface CommercialOrientationData {
  baseline_goal_split: {
    drive_footfall: number;
    strengthen_brand: number;
    retain_regulars: number;
  };
  decision_timing: string;          // "spontaneous" | "planned" | "mixed"
  content_type_affinity: {
    product: number;
    place: number;
    process: number;
    urgency: number;
    proof: number;
    retention: number;
  };
}

interface IdentityData {
  brand_essence: string;
  positioning: string;
  core_values: string[];
  what_makes_us_different: string;
}

interface LocationData {
  neighborhood?: string;
  area_type?: string;              // "urban_center" | "suburban" | "tourist_area"
  local_location_reference?: string;  // How locals refer to location (e.g., "ved åen")
  tourist_context?: string;
  landmarks?: string[];
  // Phase 2C: Reachable demographics from location strategy (brand-profile-generator-v5)
  reachable_demographics?: Array<{
    demographic: string;              // "local_resident" | "tourist" | "student" | "business_professional"
    proximity_score: number;          // 0-100 (from location intelligence)
    is_reachable: boolean;            // Can business actually serve this demographic?
    filter_reason?: string;           // Why filtered if not reachable (e.g., "price too high for students")
  }>;
  // NEW: Proximity signals for AI reasoning (replacing constraints)
  demographic_proximity_signals?: Array<{
    demographic: string;
    proximity_score: number;
    signal_source: string;
    caveat?: string;
  }>;
  physical_context?: {
    pedestrian_flow?: string;         // "very_high" | "high" | "medium" | "low"
    transit_within_150m?: boolean;
    nearest_transit?: { name: string; distance_meters: number };
    parking_within_300m?: boolean;
  };
}

// ===== FORMAT-OCCASION MAPPING =====

/**
 * Format-to-occasion mappings to help AI reason about social situations
 * without relying solely on training data
 */
const FORMAT_OCCASION_SIGNALS: Record<string, string[]> = {
  ayce: [
    'Friend groups — AYCE removes the awkwardness of splitting the bill',
    'Families — value-for-money, children can eat without a fixed price',
    'Couples on novelty date — interactive format (grill at table) is a draw',
  ],
  a_la_carte: [
    'Couples — controlled spend, intimate pacing',
    'Business lunch — individual choices, professional setting',
    'Solo diners — full menu access without over-ordering',
  ],
  brunch_buffet: [
    'Families with children — relaxed timing, variety for picky eaters',
    'Friend groups — weekend social ritual',
    'Couples — weekend leisure occasion',
  ],
  tasting_menu: [
    'Couples — special occasion, celebration',
    'Food enthusiasts — the format IS the draw',
  ],
  fast_casual: [
    'Solo weekday lunch — speed and value',
    'Small work groups — quick, no booking needed',
    'Shoppers pausing — proximity to retail is the trigger',
  ],
  table_grill: [
    'Friend groups — interactive social experience, shared cooking',
    'Families — kids enjoy the interactive element',
    'Couples seeking novelty — active participation creates engagement',
  ],
  buffet: [
    'Families with children — variety accommodates picky eaters, fixed price',
    'Large groups — easy coordination, no menu decisions needed',
    'Value seekers — unlimited food appeals to cost-conscious diners',
  ],
};

/**
 * Detect programme format from menu data and programme type
 */
function detectProgrammeFormat(
  menu: MenuData,
  programmeType: string,
  programmeName: string
): string | null {
  const nameLower = programmeName.toLowerCase();
  const typeLower = programmeType.toLowerCase();

  // Check for explicit format indicators
  if (nameLower.includes('ayce') || nameLower.includes('all you can eat') || nameLower.includes('ad libitum')) {
    return 'ayce';
  }
  
  if (nameLower.includes('brunch') && (nameLower.includes('buffet') || nameLower.includes('buffé'))) {
    return 'brunch_buffet';
  }
  
  if (nameLower.includes('buffet') || nameLower.includes('buffé')) {
    return 'buffet';
  }
  
  if (nameLower.includes('tasting') || nameLower.includes('smagsmenu')) {
    return 'tasting_menu';
  }
  
  if (nameLower.includes('bordgrill') || nameLower.includes('table grill') || nameLower.includes('grill ved bordet')) {
    return 'table_grill';
  }

  // Check menu items for format clues
  const hasFixedPrice = menu.items.every(item => item.price !== null && item.price !== undefined);
  const allItemsIndividual = menu.items.length > 5 && hasFixedPrice;
  
  if (allItemsIndividual && !nameLower.includes('buffet')) {
    return 'a_la_carte';
  }

  // Default: no clear format detected
  return null;
}

// ===== DEMOGRAPHIC PROXIMITY SIGNALS (NEW ARCHITECTURE) =====

/**
 * Build demographic proximity signals section for AI prompt
 * IMPORTANT: These are SIGNALS, not CONSTRAINTS. The AI must reason about them
 * in combination with the business concept and occasion logic.
 */
function buildDemographicProximitySignalsSection(
  location: LocationData,
  language: string = 'da'
): string {
  // Prefer new signal-based architecture if available
  if (location.demographic_proximity_signals && location.demographic_proximity_signals.length > 0) {
    const signals = location.demographic_proximity_signals;

    if (language === 'da') {
      const lines = [
        '\nDEMOGRAFISKE NÆRHEDSSIGNALER (geografisk rækkevidde, IKKE målgruppe):',
        'Disse tal viser hvem der er FYSISK TILGÆNGELIG i området — ikke hvem forretningen primært er rettet mod.',
        ''
      ];

      signals.forEach(signal => {
        const caveatText = signal.caveat ? ` ⚠️ Bemærk: ${signal.caveat}` : '';
        lines.push(`• ${signal.demographic}: ${signal.proximity_score}/100 (kilde: ${signal.signal_source})${caveatText}`);
      });

      lines.push('');
      lines.push('⚠️ KRITISK: Brug FORRETNINGSKONCEPTET (sektion A) som primært filter.');
      lines.push('Disse demografiske nærhedssignaler er ÉN input blandt tre — ikke en begrænsning.');

      return lines.join('\n');
    }

    // English version
    const lines = [
      '\nDEMOGRAPHIC PROXIMITY SIGNALS (geographic reach, NOT target audience):',
      'These numbers show who is PHYSICALLY REACHABLE in the area — not who the business primarily targets.',
      ''
    ];

    signals.forEach(signal => {
      const caveatText = signal.caveat ? ` ⚠️ Note: ${signal.caveat}` : '';
      lines.push(`• ${signal.demographic}: ${signal.proximity_score}/100 (source: ${signal.signal_source})${caveatText}`);
    });

    lines.push('');
    lines.push('⚠️ CRITICAL: Use BUSINESS CONCEPT (Section A) as the primary filter.');
    lines.push('These demographic proximity signals are ONE input among three — not a constraint.');

    return lines.join('\n');
  }

  // Legacy fallback: if only reachable_demographics exists (old architecture)
  if (location.reachable_demographics && location.reachable_demographics.length > 0) {
    const signals = location.reachable_demographics;

    if (language === 'da') {
      const lines = [
        '\nDEMOGRAFISKE NÆRHEDSSIGNALER:',
        ''
      ];

      signals.forEach(demo => {
        lines.push(`• ${demo.demographic}: ${demo.proximity_score}/100${demo.is_reachable ? ' (reachable)' : ` (filtered: ${demo.filter_reason})`}`);
      });

      lines.push('');
      lines.push('⚠️ Brug forretningskonceptet som primært filter, ikke kun disse signaler.');

      return lines.join('\n');
    }

    // English fallback
    const lines = [
      '\nDEMOGRAPHIC PROXIMITY SIGNALS:',
      ''
    ];

    signals.forEach(demo => {
      lines.push(`• ${demo.demographic}: ${demo.proximity_score}/100${demo.is_reachable ? ' (reachable)' : ` (filtered: ${demo.filter_reason})`}`);
    });

    lines.push('');
    lines.push('⚠️ Use business concept as primary filter, not just these signals.');

    return lines.join('\n');
  }

  return '';
}

interface LocationData {
  neighborhood?: string;
  area_type?: string;              // "urban_center" | "suburban" | "tourist_area"
  local_location_reference?: string;  // How locals refer to location (e.g., "ved åen")
  tourist_context?: string;
  landmarks?: string[];
  // Phase 2C: Reachable demographics from location strategy (brand-profile-generator-v5)
  reachable_demographics?: Array<{
    demographic: string;              // "local_resident" | "tourist" | "student" | "business_professional"
    proximity_score: number;          // 0-100 (from location intelligence)
    is_reachable: boolean;            // Can business actually serve this demographic?
    filter_reason?: string;           // Why filtered if not reachable (e.g., "price too high for students")
  }>;
  // NEW: Proximity signals for AI reasoning (replacing constraints)
  demographic_proximity_signals?: Array<{
    demographic: string;
    proximity_score: number;
    signal_source: string;
    caveat?: string;
  }>;
  physical_context?: {
    pedestrian_flow?: string;         // "very_high" | "high" | "medium" | "low"
    transit_within_150m?: boolean;
    nearest_transit?: { name: string; distance_meters: number };
    parking_within_300m?: boolean;
  };
}

// ===== AI COMPLEXITY DETECTOR =====

function determineSegmentCount(
  programme: ProgrammeData,
  menu: MenuData,
  location: LocationData
): number {
  let score = 0;

  // Menu variety (0-2 points)
  const menuItemCount = menu.items.length;
  if (menuItemCount >= 20) score += 2;
  else if (menuItemCount >= 10) score += 1;

  // Hours span (0-2 points)
  const hoursSpan = calculateHoursSpan(programme.time_windows);
  if (hoursSpan >= 6) score += 2;
  else if (hoursSpan >= 4) score += 1;

  // Location complexity (0-2 points)
  if (location.area_type === "tourist_area") score += 2;
  else if (location.area_type === "urban_center") score += 1;

  // Programme type signals (0-2 points)
  const complexProgrammes = ["brunch", "lunch", "all_day"];
  const simpleProgrammes = ["bar", "late_night"];
  if (complexProgrammes.includes(programme.programme_type)) score += 1;
  if (simpleProgrammes.includes(programme.programme_type)) score -= 1;

  // Map score to segment count (2-4)
  if (score >= 6) return 4;
  if (score >= 4) return 3;
  return 2;
}

function calculateHoursSpan(timeWindows: string[]): number {
  if (!timeWindows.length) return 0;

  const times = timeWindows.flatMap(window => {
    const match = window.match(/(\d{2}):(\d{2})-(\d{2}):(\d{2})/);
    if (!match) return [];
    return [
      parseInt(match[1]) * 60 + parseInt(match[2]),  // start minutes
      parseInt(match[3]) * 60 + parseInt(match[4])   // end minutes
    ];
  });

  if (times.length < 2) return 0;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  return (maxTime - minTime) / 60; // hours
}

// System prompt loaded from v5-prompts.ts at runtime via getV5Prompt('audience', language)

// ===== PROMPT BUILDER =====

function buildAudiencePrompt(
  business: BusinessData,
  menu: MenuData,
  programme: ProgrammeData,
  commercialOrientation: CommercialOrientationData,
  identity: IdentityData | undefined,
  location: LocationData,
  targetSegmentCount: number,
  language: string = 'da'
): string {
  const menuItems = menu.items.slice(0, 15).map(item => 
    `- ${item.name}${item.description ? `: ${item.description}` : ''}${item.price ? ` (${item.price} kr)` : ''}`
  ).join('\n');

  const primaryGoal = Object.entries(commercialOrientation.baseline_goal_split)
    .sort(([, a], [, b]) => b - a)[0][0];

  // Map Layer 2 decision_timing values to Layer 4 values for AI prompt
  const layer2ToLayer4TimingMap: Record<string, string> = {
    'last_minute': 'spontaneous',
    'planned': 'planned',
    'hybrid': 'mixed'
  };
  
  const layer4DecisionTiming = layer2ToLayer4TimingMap[commercialOrientation.decision_timing] || commercialOrientation.decision_timing;
  
  // For mixed programmes, guide AI to be SPECIFIC per segment
  const isMixedProgramme = commercialOrientation.decision_timing === 'mixed';

  // Build demographic proximity signals section (NEW ARCHITECTURE)
  const demographicProximitySection = buildDemographicProximitySignalsSection(location, language);

  // Detect programme format
  const detectedFormat = detectProgrammeFormat(menu, programme.programme_type, programme.programme_name);
  
  // Get format occasion signals
  const formatSignals = detectedFormat && FORMAT_OCCASION_SIGNALS[detectedFormat]
    ? FORMAT_OCCASION_SIGNALS[detectedFormat]
    : [];

  // Check if this is a brunch programme
  const isBrunchProgramme = programme.programme_name.toLowerCase().includes('brunch') || 
                            programme.programme_name.toLowerCase().includes('morgenmad');

  // CRITICAL: Local place name enforcement
  const localPlaceInstruction = location.local_location_reference ? `

🎯 LOKALT STEDNAVN (KRITISK):
Dette sted er beliggende "${location.local_location_reference}"
Du SKAL bruge dette præcise udtryk i alle content_angles der refererer til location.
ALDRIG opfind alternative navne eller tilføj bynavne til denne reference.
Korrekt: "ved åen" | Forkert: "ved Aarhus Å", "ved åen i Aarhus"` : '';

  const brunchWarning = isBrunchProgramme ? `

⚠️  KRITISK: Dette er et BRUNCH programme (IKKE morgenmad/breakfast)
FAKTA: Der serveres KUN brunch - ingen morgenmad/breakfast service.
FORBUDT: Content angles med "før arbejde", "quick", "hurtig", "convenience på hverdage før 10:00"
KRÆVET: Alle segments skal have social_gathering eller experience_seeking motivation
KRÆVET: Timing skal reflektere brunch hours (primært 10:00-14:00, især weekends)
KRÆVET: Content angles skal være social/leisurely: "Social brunch", "Weekend hygge", "Variation i menu"
` : '';

  // Danish prompt (fully localized with THREE-SECTION ARCHITECTURE)
  if (language === 'da') {
    return `
═══════════════════════════════════════════════════════════════════════
SEKTION A — FORRETNINGSKONCEPT
═══════════════════════════════════════════════════════════════════════

Beskrivelse af hvad forretningen faktisk tilbyder, hvordan, og til hvilken pris.

Forretning: ${business.business_name}
Type: ${business.establishment_type || business.business_category}
Beliggenhed: ${location.local_location_reference || location.neighborhood || business.city}
${localPlaceInstruction}

PROGRAM OG TIDSVINDUER:
Program: ${programme.programme_name} (${programme.programme_type})
Åbningstider: ${programme.time_windows.join(', ')}
Åbningsdage: ${programme.operating_days.join(', ')}
${programme.languageVariants && programme.languageVariants.length > 1 ? `Menusprog: ${programme.languageVariants.join(', ')} (→ internationalt publikum)\n` : ''}
MENU FORMAT${detectedFormat ? ` (${detectedFormat})` : ''}:
${menuItems}

${detectedFormat && formatSignals.length > 0 ? `FORMAT-ANLEDNING SIGNALER (${detectedFormat}):
${formatSignals.map(s => `• ${s}`).join('\n')}
` : ''}
PRISPOSITIONERING: ${business.business_name ? 'Se menupunkter ovenfor' : 'Ikke specificeret'}
${brunchWarning}
${identity ? `
BRAND IDENTITET:
Brand essence: ${identity.brand_essence}
Positionering: ${identity.positioning}
Kerneværdier: ${identity.core_values.join(', ')}
USP: ${identity.what_makes_us_different}
` : ''}
═══════════════════════════════════════════════════════════════════════
SEKTION B — STEDSFAKTA
═══════════════════════════════════════════════════════════════════════

Rå signaler om hvem der er fysisk tilstede nær dette sted og hvornår.

OMRÅDE & KARAKTER:
Områdetype: ${location.area_type || 'ukendt'}
Nabolag: ${location.neighborhood || 'ikke specificeret'}
${location.physical_context ? `
FYSISK KONTEKST:
Fodgængerflow: ${location.physical_context.pedestrian_flow || 'ukendt'}
${location.physical_context.transit_within_150m ? `Transit inden for 150m: ${location.physical_context.nearest_transit?.name || 'ja'}` : ''}
${location.physical_context.parking_within_300m ? 'Parkering inden for 300m: ja' : ''}
` : ''}${demographicProximitySection}

⚠️ KRITISK BEMÆRK: Disse er GEOGRAFISKE NÆRHEDSSIGNALER. De indikerer hvem der
KUNNE VÆRE tilgængelig, IKKE hvem forretningen primært er for. FORRETNINGSKONCEPTET
i Sektion A er den primære determinant for målgruppen.

═══════════════════════════════════════════════════════════════════════
SEKTION C — ANLEDNINGSLOGIK
═══════════════════════════════════════════════════════════════════════

OPGAVE: Generer præcis ${targetSegmentCount} målgruppesegmenter for ${programme.programme_name}.

For hvert potentielt segment skal du gennemtænke følgende:

1. PASSER FORRETNINGSFORMATET til denne type person?
   (AYCE passer til grupper, ikke solo-spisende. Smagsmenu passer til par, ikke familier med små børn.)

2. GØR STEDETS BELIGGENHED denne person tilgængelig i det relevante tidsvinduer?

3. Hvilken specifik ANLEDNING bringer denne person hertil — hvad fejrer de,
   undslipper fra, eller prøver at opnå?

Kun overflade et segment hvis det består alle tre checks.

KRITISKE ALIGNMENT REGLER:
• Primært segment goal_contribution SKAL være: ${primaryGoal}
${isMixedProgramme ? `• Programmet har MIXED timing — vælg den mest passende timing per segment:
  - "planned" hvis segmentet primært booker/planlægger
  - "spontaneous" hvis segmentet primært beslutter samme dag
  - "mixed" KUN hvis segmentet har BEGGE mønstre ægte` : `• Primært segment decision_timing SKAL være: ${layer4DecisionTiming}`}

SEGMENTERINGS-STRATEGI (KRITISK):
Prioriter ANLEDNINGS-baserede segmenter:

PRIMÆR AKSE (social kontekst + anledning):
• Familier (aftensmåltid, weekendmiddage, børnefødselsdag)
• Venner (casual dining, grin og hygge, fredagsaften)
• Par (date night, stille middag for to, fejre jubilæum)
• Grupper (fællesspisning, firmafester, vennegrupper der deler retter)
• Enkeltpersoner (quick lunch, arbejdsaftensmad, stamkunder)

BEVIS & CONCEPT FIT KRAV (NYT KRAV):
Hvert segment SKAL inkludere:
• "concept_fit_reason": En-linje begrundelse der refererer til BÅDE forretningsformat 
  (fra Sektion A) OG stedssignal (fra Sektion B)
  Eksempel: "AYCE + bordgrill er et socialt gruppeformat — passer til venner der vil 
  hygge sig en aften i ${location.local_location_reference || 'centrum'}"
• "evidence": Konkrete facts fra Sektion A (menupunkter, åbningstider, programtype)

SPROG KRAV:
- TEXT-felter SKAL være på DANSK: label, content_angles, evidence, segment_reasoning, concept_fit_reason
- ENUM-felter SKAL være på ENGELSK: motivation, decision_timing, goal_contribution, segment_size

Generer nu ${targetSegmentCount} segmenter med komplet concept_fit_reason og evidenskæde.`;
  }
  
  
  // English fallback (for other markets) with THREE-SECTION ARCHITECTURE
  return `
═══════════════════════════════════════════════════════════════════════
SECTION A — BUSINESS CONCEPT
═══════════════════════════════════════════════════════════════════════

Description of what the business actually offers, how, and at what price point.

Business: ${business.business_name}
Type: ${business.establishment_type || business.business_category}
Location: ${location.local_location_reference || location.neighborhood || business.city}

PROGRAMME & TIME WINDOWS:
Programme: ${programme.programme_name} (${programme.programme_type})
Operating Hours: ${programme.time_windows.join(', ')}
Operating Days: ${programme.operating_days.join(', ')}
${programme.languageVariants && programme.languageVariants.length > 1 ? `Menu Languages: ${programme.languageVariants.join(', ')} (→ international audience)\n` : ''}

MENU FORMAT${detectedFormat ? ` (${detectedFormat})` : ''}:
${menuItems}

${detectedFormat && formatSignals.length > 0 ? `FORMAT-OCCASION SIGNALS (${detectedFormat}):
${formatSignals.map(s => `• ${s}`).join('\n')}
` : ''}
PRICE POSITIONING: See menu items above
${brunchWarning}
${identity ? `
BRAND IDENTITY:
Brand Essence: ${identity.brand_essence}
Positioning: ${identity.positioning}
Core Values: ${identity.core_values.join(', ')}
USP: ${identity.what_makes_us_different}
` : ''}
═══════════════════════════════════════════════════════════════════════
SECTION B — LOCATION FACTS
═══════════════════════════════════════════════════════════════════════

Raw signals about who is physically present near this location and when.

AREA & CHARACTER:
Area Type: ${location.area_type || 'unknown'}
Neighborhood: ${location.neighborhood || 'not specified'}
${location.physical_context ? `
PHYSICAL CONTEXT:
Pedestrian Flow: ${location.physical_context.pedestrian_flow || 'unknown'}
${location.physical_context.transit_within_150m ? `Transit within 150m: ${location.physical_context.nearest_transit?.name || 'yes'}` : ''}
${location.physical_context.parking_within_300m ? 'Parking within 300m: yes' : ''}
` : ''}${demographicProximitySection}

⚠️ CRITICAL NOTE: These are GEOGRAPHIC PROXIMITY SIGNALS. They indicate who
COULD BE reachable, NOT who the business is primarily for. BUSINESS CONCEPT
in Section A is the primary determinant of the target audience.

═══════════════════════════════════════════════════════════════════════
SECTION C — OCCASION LOGIC
═══════════════════════════════════════════════════════════════════════

TASK: Generate exactly ${targetSegmentCount} audience segments for ${programme.programme_name}.

For each potential segment, reason through the following:

1. Does the business FORMAT suit this type of person?
   (AYCE suits groups, not solo diners. Tasting menu suits couples, not families with toddlers.)

2. Does the LOCATION make this person reachable at the relevant time windows?

3. What specific OCCASION brings this person here — what are they celebrating,
   escaping from, or trying to accomplish?

Only surface a segment if it passes all three checks.

CRITICAL ALIGNMENT RULES:
• Primary segment goal_contribution MUST be: ${primaryGoal}
${isMixedProgramme ? `• Programme has MIXED timing — choose most appropriate timing per segment:
  - "planned" if segment primarily books/plans ahead
  - "spontaneous" if segment primarily decides same-day
  - "mixed" ONLY if segment has BOTH patterns genuinely` : `• Primary segment decision_timing MUST be: ${layer4DecisionTiming}`}

SEGMENTATION STRATEGY (CRITICAL):
Prioritize OCCASION-based segments:

PRIMARY AXIS (social context + occasion):
• Families (dinner out, weekend meals, children's birthdays)
• Friends (casual dining, laughs and hangout, Friday nights)
• Couples (date night, quiet dinner for two, celebrating anniversary)
• Groups (shared dining, corporate parties, friend groups sharing dishes)
• Individuals (quick lunch, work dinner, regulars)

EVIDENCE & CONCEPT FIT REQUIREMENTS (NEW REQUIREMENT):
Each segment MUST include:
• "concept_fit_reason": One-line justification referencing BOTH business format 
  (from Section A) AND location signal (from Section B)
  Example: "AYCE + table grill is a social group format — fits friends looking for 
  a fun evening in ${location.local_location_reference || 'city center'}"
• "evidence": Concrete facts from Section A (menu items, hours, programme type)

LANGUAGE REQUIREMENTS:
- TEXT fields in ${language === 'da' ? 'DANISH' : 'ENGLISH'}: label, content_angles, evidence, segment_reasoning, concept_fit_reason
- ENUM fields in ENGLISH: motivation, decision_timing, goal_contribution, segment_size

Generate ${targetSegmentCount} segments with complete concept_fit_reason and evidence chain.`;
}

// ===== VALIDATION =====

function validateAudienceProfile(
  profile: ProgrammeAudienceProfile,
  commercialOrientation: CommercialOrientationData,
  programme: ProgrammeData,
  targetSegmentCount: number
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check segment count
  if (profile.audience_segments.length < 2 || profile.audience_segments.length > 4) {
    errors.push(`Segment count must be 2-4, got ${profile.audience_segments.length}`);
  }

  if (profile.audience_segments.length !== targetSegmentCount) {
    errors.push(`Expected ${targetSegmentCount} segments, got ${profile.audience_segments.length}`);
  }

  // Check primary segment exists
  const primarySegment = profile.audience_segments.find(s => s.segment_size === "primary");
  if (!primarySegment) {
    errors.push("No primary segment found");
  } else {
    // For non-mixed programmes, validate primary segment matches programme timing
    // For mixed programmes, allow AI to choose specific timing per segment
    if (commercialOrientation.decision_timing !== 'hybrid') {
      const layer2TimingMap: Record<string, string> = {
        'last_minute': 'spontaneous',
        'planned': 'planned'
      };
      
      const expectedTiming = layer2TimingMap[commercialOrientation.decision_timing] || commercialOrientation.decision_timing;
      
      if (primarySegment.decision_timing !== expectedTiming) {
        errors.push(
          `Primary segment decision_timing (${primarySegment.decision_timing}) must match Layer 2 (${expectedTiming}, from ${commercialOrientation.decision_timing})`
        );
      }
    }
    // For mixed programmes: No validation - trust AI to choose appropriate timing per segment

    const primaryGoal = Object.entries(commercialOrientation.baseline_goal_split)
      .sort(([, a], [, b]) => b - a)[0][0];
    
    if (primarySegment.goal_contribution !== primaryGoal) {
      errors.push(
        `Primary segment goal_contribution (${primarySegment.goal_contribution}) must match Layer 2 primary goal (${primaryGoal})`
      );
    }
  }

  // Validate each segment
  profile.audience_segments.forEach((segment, index) => {
    if (!segment.label || segment.label.length < 3) {
      errors.push(`Segment ${index + 1}: label too short or missing`);
    }

    // Check for generic/forbidden terms (expanded list)
    const genericPattern = /\b(customers|locals|people|guests|tourists|families|couples|visitors|patrons)\b/i;
    if (genericPattern.test(segment.label)) {
      errors.push(`Segment ${index + 1}: label too generic ("${segment.label}") - use role + context instead`);
    }

    if (!segment.timing_windows || segment.timing_windows.length === 0) {
      errors.push(`Segment ${index + 1}: timing_windows missing`);
    }

    if (!segment.content_angles || segment.content_angles.length < 2) {
      errors.push(`Segment ${index + 1}: need at least 2 content_angles`);
    }

    if (!segment.evidence || segment.evidence.length < 2) {
      errors.push(`Segment ${index + 1}: need at least 2 evidence items`);
    }

    // NEW: Validate concept_fit_reason (CRITICAL for new architecture)
    if (!segment.concept_fit_reason || segment.concept_fit_reason.length < 20) {
      errors.push(`Segment ${index + 1}: concept_fit_reason missing or too short (must reference both business format AND location/timing)`);
    }

    if (!["primary", "secondary", "niche"].includes(segment.segment_size)) {
      errors.push(`Segment ${index + 1}: invalid segment_size "${segment.segment_size}"`);
    }

    if (!["social_gathering", "convenience", "experience_seeking", "routine"].includes(segment.motivation)) {
      errors.push(`Segment ${index + 1}: invalid motivation "${segment.motivation}"`);
    }

    if (!["spontaneous", "planned", "mixed"].includes(segment.decision_timing)) {
      errors.push(`Segment ${index + 1}: invalid decision_timing "${segment.decision_timing}"`);
    }

    if (!["drive_footfall", "strengthen_brand", "retain_regulars"].includes(segment.goal_contribution)) {
      errors.push(`Segment ${index + 1}: invalid goal_contribution "${segment.goal_contribution}"`);
    }
  });

  // Check confidence
  if (profile.segment_confidence < 0 || profile.segment_confidence > 1) {
    errors.push(`segment_confidence must be 0-1, got ${profile.segment_confidence}`);
  }

  // Check reasoning
  if (!profile.segment_reasoning || profile.segment_reasoning.length < 20) {
    errors.push("segment_reasoning too short or missing");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// ===== DEMOGRAPHIC FILTER VALIDATION =====

/**
 * Validate segments respect reachable_demographics constraints
 * Catches AI hallucinations where it ignores the guard
 */
function validateDemographicFiltering(
  profile: ProgrammeAudienceProfile,
  location: LocationData
): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (!location.reachable_demographics || location.reachable_demographics.length === 0) {
    return { valid: true, warnings }; // No guard data - skip validation
  }

  const filteredDemographics = location.reachable_demographics
    .filter(d => !d.is_reachable)
    .map(d => d.demographic.toLowerCase());

  if (filteredDemographics.length === 0) {
    return { valid: true, warnings }; // All demographics reachable - no filtering needed
  }

  // Check each segment label and content for filtered demographic references
  profile.audience_segments.forEach((segment, index) => {
    const labelLower = segment.label.toLowerCase();
    const contentAnglesLower = segment.content_angles.join(' ').toLowerCase();

    filteredDemographics.forEach(demo => {
      // Common patterns for each demographic
      const patterns: Record<string, string[]> = {
        'tourist': ['turist', 'tourist', 'visitor', 'besøgende', 'traveler', 'rejsende'],
        'student': ['student', 'studerende', 'university', 'universitet', 'college'],
        'business_professional': ['business', 'forretning', 'corporate', 'kontor', 'office'],
        'local_resident': ['local', 'lokal', 'resident', 'beboer', 'neighbor']
      };

      const demoPatterns = patterns[demo] || [demo];
      
      demoPatterns.forEach(pattern => {
        if (labelLower.includes(pattern)) {
          warnings.push(
            `⚠️  Segment ${index + 1} "${segment.label}" references filtered demographic "${demo}" (reason: ${location.reachable_demographics?.find(d => d.demographic === demo)?.filter_reason})`
          );
        }

        if (contentAnglesLower.includes(pattern)) {
          warnings.push(
            `⚠️  Segment ${index + 1} content_angles reference filtered demographic "${demo}" (reason: ${location.reachable_demographics?.find(d => d.demographic === demo)?.filter_reason})`
          );
        }
      });
    });
  });

  return {
    valid: warnings.length === 0,
    warnings
  };
}

// ===== MAIN GENERATION FUNCTION =====

export async function generateAudienceSegments(
  business: BusinessData,
  menu: MenuData,
  programme: ProgrammeData,
  commercialOrientation: CommercialOrientationData,
  identity: IdentityData | undefined,
  location: LocationData,
  apiKey: string,
  language: string = 'da'  // Multi-language support (default Danish)
): Promise<ProgrammeAudienceProfile> {
  // Log demographic guard status
  if (location.reachable_demographics && location.reachable_demographics.length > 0) {
    const reachable = location.reachable_demographics.filter(d => d.is_reachable);
    const filtered = location.reachable_demographics.filter(d => !d.is_reachable);
    console.log(`🛡️  Demographic guard active: ${reachable.length} reachable, ${filtered.length} filtered`);
    if (reachable.length > 0) {
      console.log(`   ✓ Reachable: ${reachable.map(d => `${d.demographic} (${d.proximity_score})`).join(', ')}`);
    }
    if (filtered.length > 0) {
      console.log(`   ✗ Filtered: ${filtered.map(d => `${d.demographic} (${d.filter_reason})`).join(', ')}`);
    }
  }

  // Determine optimal segment count
  const targetSegmentCount = determineSegmentCount(programme, menu, location);

  console.log(`🎯 AI Complexity Detector: ${targetSegmentCount} segments recommended for ${programme.programme_name}`);
  console.log(`   Menu items: ${menu.items.length}, Hours span: ${calculateHoursSpan(programme.time_windows).toFixed(1)}h, Area: ${location.area_type}`);

  // Build prompt (language-aware)
  const userPrompt = buildAudiencePrompt(
    business,
    menu,
    programme,
    commercialOrientation,
    identity,
    location,
    targetSegmentCount,
    language  // Pass language to prompt builder
  );

  // Call OpenAI
  const client = new OpenAI({ apiKey });

  console.log(`🤖 Calling OpenAI (gpt-4o-mini, temperature 0.3, max_tokens 1500)...`);

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: getV5Prompt('audience', language) },  // Multi-language system prompt
      { role: "user", content: userPrompt }
    ],
    temperature: 0.3,
    max_tokens: 1500,
    response_format: { type: "json_object" }
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from OpenAI");
  }

  const result = JSON.parse(content);

  const profile: ProgrammeAudienceProfile = {
    programme_type: programme.programme_type,
    programme_name: programme.programme_name,
    audience_segments: result.audience_segments || [],
    segment_confidence: result.segment_confidence || 0,
    segment_reasoning: result.segment_reasoning || ""
  };

  // Validate
  const validation = validateAudienceProfile(
    profile,
    commercialOrientation,
    programme,
    targetSegmentCount
  );

  if (!validation.valid) {
    console.error("❌ Validation failed:", validation.errors);
    throw new Error(`Validation failed: ${validation.errors.join('; ')}`);
  }

  // Validate demographic filtering (guard compliance)
  const filterValidation = validateDemographicFiltering(profile, location);
  if (!filterValidation.valid) {
    console.warn("⚠️  Demographic filter warnings:");
    filterValidation.warnings.forEach(warning => console.warn(`   ${warning}`));
    // Log warnings but don't fail - AI sometimes uses creative segment names
  }

  console.log(`✅ Generated ${profile.audience_segments.length} segments (confidence: ${profile.segment_confidence.toFixed(2)})`);

  return profile;
}
