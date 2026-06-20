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
    'spontaneous_walk_in': 'spontaneous',
    'planned_reservation': 'planned',
    'mixed': 'mixed'
  };
  
  const layer4DecisionTiming = layer2ToLayer4TimingMap[commercialOrientation.decision_timing] || commercialOrientation.decision_timing;
  
  // For mixed programmes, guide AI to be SPECIFIC per segment
  const isMixedProgramme = commercialOrientation.decision_timing === 'mixed';

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

  // Danish prompt (fully localized)
  if (language === 'da') {
    return `FORRETNINGSKONTEKST:
Navn: ${business.business_name}
Type: ${business.establishment_type || business.business_category}
Beliggenhed: ${location.local_location_reference || location.neighborhood || business.city}
Områdetype: ${location.area_type || 'ukendt'}
Turistkontekst: ${location.tourist_context || 'ingen'}
${localPlaceInstruction}
${brunchWarning}
PROGRAMKONTEKST:
Program: ${programme.programme_name} (${programme.programme_type})
Åbningstider: ${programme.time_windows.join(', ')}
Åbningsdage: ${programme.operating_days.join(', ')}
Menubevis: ${programme.menu_evidence.join(', ')}
${programme.languageVariants && programme.languageVariants.length > 1 ? `Menusprog: ${programme.languageVariants.join(', ')} (→ internationalt turistpublikum sandsynligt)\n` : ''}

MENU UDSNIT (${menu.items.length} items i alt, viser 15):
${menuItems}

LAG 2 KOMMERCIEL ORIENTERING (SKAL MATCHE):
Beslutnings-timing: ${layer4DecisionTiming}
Primært mål: ${primaryGoal} (${Math.round(commercialOrientation.baseline_goal_split[primaryGoal as keyof typeof commercialOrientation.baseline_goal_split])}%)
Indholdsaffinitet: produkt ${commercialOrientation.content_type_affinity.product}, sted ${commercialOrientation.content_type_affinity.place}

${identity ? `LAG 3 IDENTITET:
Brand essence: ${identity.brand_essence}
Positionering: ${identity.positioning}
Kerneværdier: ${identity.core_values.join(', ')}
USP: ${identity.what_makes_us_different}

` : ''}OPGAVE:
Generer præcis ${targetSegmentCount} målgruppesegmenter for ${programme.programme_name}.

KRITISK ALIGNMENT REGEL:
Primært segment goal_contribution SKAL være: ${primaryGoal}

${isMixedProgramme ? `DECISION TIMING FOR MIXED PROGRAMME:
Programmet har MIXED timing (både planlagte og spontane kunder).

For hvert segment: Vælg den timing der PASSER BEDST:
• "planned" - hvis segmentet primært booker/planlægger (fx familier, fødselsdage, forretningsfrokoster)
• "spontaneous" - hvis segmentet primært beslutter samme dag (fx kontorfolk kl 11:50, havnegåtur, solskinsbeslutninger)
• "mixed" - KUN hvis segmentet har BEGGE mønstre ægte (fx stamgæster der både booker til events OG dropper spontant forbi)

Vær SPECIFIK når muligt - "mixed" er kun for segmenter med dokumenteret blandet adfærd.` : `Primært segment decision_timing SKAL være: ${layer4DecisionTiming}`}

BEVIS KRAV:
Hvert segment skal citere konkrete facts:
- Menupunkter (fra listen ovenfor - brug PRÆCISE navne, OPFIND IKKE)
- Åbningstider/dage (fra programkontekst)
- Stedkontekst (${location.local_location_reference || location.neighborhood || business.city})
- Programtype (${programme.programme_type})

SPROG KRAV:
- TEXT-felter SKAL være på DANSK:
  • "label": "Weekend-gæster på jagt efter natteliv" (ALDRIG "Weekend Nightlife Seekers")
  • "content_angles": "Cocktail-tilbud ved ${location.local_location_reference || 'vandet'}" (ALDRIG "Cocktail specials")
  • "evidence": "Menu har cocktails" (ALDRIG "Menu has cocktails")
  • "segment_reasoning": Dansk forklaring
- ENUM-felter SKAL være på ENGELSK (database-værdier):
  • "motivation": "social_gathering" (ALDRIG "social samvær")
  • "decision_timing": "planned" (ALDRIG "planlagt")
  • "goal_contribution": "strengthen_brand" (ALDRIG "styrk brand")
  • "segment_size": "primary" (ALDRIG "primær")

Generer nu ${targetSegmentCount} segmenter med komplet evidenskæde.`;
  }
  
  // English fallback (for other markets)
  return `BUSINESS CONTEXT:
Name: ${business.business_name}
Type: ${business.establishment_type || business.business_category}
Location: ${location.neighborhood || business.city}
Area Type: ${location.area_type || 'unknown'}
Tourist Context: ${location.tourist_context || 'none'}
${brunchWarning}
PROGRAMME CONTEXT:
Programme: ${programme.programme_name} (${programme.programme_type})
Operating Hours: ${programme.time_windows.join(', ')}
Operating Days: ${programme.operating_days.join(', ')}
Menu Evidence: ${programme.menu_evidence.join(', ')}
${programme.languageVariants && programme.languageVariants.length > 1 ? `Menu Languages: ${programme.languageVariants.join(', ')} (→ international tourist audience likely)\n` : ''}

MENU SNAPSHOT (${menu.items.length} total items, showing 15):
${menuItems}

LAYER 2 COMMERCIAL ORIENTATION (MUST ALIGN):
Decision Timing: ${layer4DecisionTiming}
Primary Goal: ${primaryGoal} (${Math.round(commercialOrientation.baseline_goal_split[primaryGoal as keyof typeof commercialOrientation.baseline_goal_split])}%)
Content Affinity: product ${commercialOrientation.content_type_affinity.product}, place ${commercialOrientation.content_type_affinity.place}

${identity ? `LAYER 3 IDENTITY:
Brand Essence: ${identity.brand_essence}
Positioning: ${identity.positioning}
Core Values: ${identity.core_values.join(', ')}
USP: ${identity.what_makes_us_different}

` : ''}TASK:
Generate exactly ${targetSegmentCount} audience segments for ${programme.programme_name}.

CRITICAL ALIGNMENT RULE:
Primary segment goal_contribution MUST be: ${primaryGoal}

${isMixedProgramme ? `DECISION TIMING FOR MIXED PROGRAMME:
Programme has MIXED timing (both planned and spontaneous customers).

For each segment: Choose the timing that FITS BEST:
• "planned" - if segment primarily books/plans ahead (e.g. families, celebrations, business lunches)
• "spontaneous" - if segment primarily decides same-day (e.g. office workers at 11:50am, harbor stroll, sunshine decisions)
• "mixed" - ONLY if segment has BOTH patterns genuinely (e.g. regulars who book for events AND drop by spontaneously)

Be SPECIFIC when possible - "mixed" is only for segments with documented mixed behavior.` : `Primary segment decision_timing MUST be: ${layer4DecisionTiming}`}

EVIDENCE REQUIREMENTS:
Each segment must cite concrete facts:
- Menu items (from list above)
- Operating hours/days
- Location context (${location.local_location_reference || location.area_type}, ${location.neighborhood || business.city})
- Programme type (${programme.programme_type})

Generate ${targetSegmentCount} segments with complete evidence chain.`;
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
    if (commercialOrientation.decision_timing !== 'mixed') {
      const layer2TimingMap: Record<string, string> = {
        'spontaneous_walk_in': 'spontaneous',
        'planned_reservation': 'planned'
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

  console.log(`✅ Generated ${profile.audience_segments.length} segments (confidence: ${profile.segment_confidence.toFixed(2)})`);

  return profile;
}
