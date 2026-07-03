// Layer 2: Commercial Orientation
// Generates programme-specific commercial strategy baseline

import { OpenAI } from "https://esm.sh/openai@4.20.1";
import { getV5Prompt } from './v5-prompts.ts';

export interface ProgrammeData {
  name: string;
  type: "morning" | "lunch" | "dinner" | "bar";
  timeWindow: { start: string; end: string };
  operatingDays: string[];
  confidence: "high" | "medium" | "low";
  languageVariants?: string[];  // e.g., ['da', 'en'] - signals international appeal
}

export interface BusinessContext {
  name: string;
  category: string;
  price_level?: number;
  establishment_type?: string;
  reservation_required?: boolean;  // true = booking required, false = no booking
  accepts_walkins?: boolean;       // true = accepts walk-ins
}

export interface LocationContext {
  area_type?: string;
  neighborhood?: string;
  local_location_reference?: string;  // How locals refer to location (e.g., "ved åen")
  category_scores?: Record<string, number>;       // Full multi-valued location signal
  demographic_proximity?: Record<string, number>; // Demographic dimensions (split since migration 20260522000002)
  nearby_hospitality?: {
    density_label?: string;  // 'high' | 'medium' | 'low'
    total_count?: number;
    radius_meters?: number;
    breakdown?: {
      restaurant?: number;
      cafe?: number;
      bar?: number;
    };
  };
  // Legacy fields (deprecated, kept for backwards compatibility)
  competition_density?: string;
  competition_count?: number;
}

export interface MenuContext {
  price_range?: { min: number; max: number };
  item_count?: number;
  has_alcohol?: boolean;
  primary_categories?: string[];
}

export interface CommercialOrientation {
  baseline_goal_split: {
    drive_footfall: number;
    strengthen_brand: number;
  };
  decision_timing: "last_minute" | "planned" | "hybrid";
  draw_type: "passing_trade" | "local_draw" | "destination_draw";  // NEW: Commercial draw type
  reachable_guest_profile: string;  // NEW: 1-2 sentences Danish, who actually visits
  content_type_affinity: {
    product: number;
    place: number;
    process: number;
    urgency: number;
    proof: number;
    retention: number;
  };
  location_context_applied: {
    area_type?: string;
    tourist_context?: string;
    competition_density?: string;
    competition_count?: number;
    baseline_adjustment: string;
  };
  reasoning: string;
}

export async function generateCommercialOrientation(
  programme: ProgrammeData,
  business: BusinessContext,
  location: LocationContext,
  menu: MenuContext,
  language: string = 'da'  // Multi-language support (default Danish)
): Promise<CommercialOrientation> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is required");
  }

  const openai = new OpenAI({ apiKey });

  const prompt = buildCommercialOrientationPrompt(
    programme,
    business,
    location,
    menu
  );

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: getV5Prompt('commercial', language),  // Multi-language system prompt
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.3,
    max_tokens: 1500,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from OpenAI");
  }

  const result = JSON.parse(content);
  return validateCommercialOrientation(result);
}

// System prompt loaded from v5-prompts.ts at runtime via getV5Prompt('commercial', language)

function buildCommercialOrientationPrompt(
  programme: ProgrammeData,
  business: BusinessContext,
  location: LocationContext,
  menu: MenuContext
): string {
  const parts: string[] = [];

  // Programme context
  parts.push(`PROGRAM: ${programme.name}`);
  parts.push(`Type: ${programme.type}`);
  parts.push(`Tidspunkt: ${programme.timeWindow.start}-${programme.timeWindow.end}`);
  parts.push(`Dage: ${programme.operatingDays.join(", ")}`);
  
  // Language variants (tourist signal)
  if (programme.languageVariants && programme.languageVariants.length > 1) {
    parts.push(`Menu sprog: ${programme.languageVariants.join(", ")} (multi-language menu → international audience)`);
  }
  parts.push("");

  // Business context
  parts.push(`FORRETNING: ${business.name}`);
  parts.push(`Kategori: ${business.category}`);
  if (business.price_level) {
    parts.push(`Prisniveau: ${business.price_level}/5`);
  }
  
  // Booking policy (INFORMATIONAL - does not force decision_timing)
  if (business.reservation_required === true && business.accepts_walkins === false) {
    parts.push(`Booking policy: KUN reservation (ingen walk-in)`);
  } else if (business.reservation_required === false || business.accepts_walkins === true) {
    parts.push(`Booking policy: Walk-in accepteret (booking kan være muligt)`);
  } else if (business.reservation_required === true) {
    parts.push(`Booking policy: Reservation anbefalet`);
  }
  // NOTE: Walk-in only ≠ spontaneous decision timing!
  // Example: Food truck posts 3h before → planned timing despite walk-in only
  // AI should evaluate decision_timing based on program + competition + customer behavior
  
  parts.push("");

  // Location context (CRITICAL for baseline)
  parts.push(`LOKATION (alle geografiske dimensioner):`);
  
  // Multi-valued location signal with scores
  if (location.category_scores && Object.keys(location.category_scores).length > 0) {
    const sortedScores = Object.entries(location.category_scores)
      .filter(([, score]) => score >= 50)  // only above-threshold signals
      .sort(([, a], [, b]) => b - a);      // highest first
    
    if (sortedScores.length > 0) {
      parts.push(`Lokationsdimensioner (score 0-100):`);
      sortedScores.forEach(([type, score]) => {
        parts.push(`  ${type}: ${score}`);
      });
    }
  }
  
  // Demographic proximity — who is physically in this area (geographic fact)
  if (location.demographic_proximity &&
      Object.keys(location.demographic_proximity).length > 0) {
    const sortedDemo = Object.entries(location.demographic_proximity)
      .sort(([, a], [, b]) => b - a);
    parts.push(`Hvem er fysisk i området (geografisk kendsgerning):`);
    sortedDemo.forEach(([type, score]) => {
      parts.push(`  ${type}: ${score}`);
    });
    parts.push(`OBS: Disse scores beskriver hvem der PASSERER FORBI lokationen`);
    parts.push(`— ikke hvem der er kommercielt relevante for denne forretning.`);
    parts.push(`Kommerciel relevans afgøres af pris, åbningstid og service-model.`);
  }
  parts.push("");
  
  // Primary location type and reference
  if (location.area_type) {
    parts.push(`Primær lokationstype: ${location.area_type}`);
  }
  if (location.local_location_reference) {
    parts.push(`Lokal betegnelse: ${location.local_location_reference}`);
  }
  // Fallback chain: local_location_reference > neighborhood
  const locationContext = location.local_location_reference || location.neighborhood;
  if (locationContext && !location.local_location_reference) {
    parts.push(`Område: ${locationContext}`);
  }
  
  if (location.nearby_hospitality?.density_label && location.nearby_hospitality?.total_count !== undefined) {
    const radius = location.nearby_hospitality.radius_meters || 300;
    parts.push(
      `Konkurrence: ${location.nearby_hospitality.density_label} (${location.nearby_hospitality.total_count} konkurrenter inden for ${radius}m)`
    );
    
    // Include breakdown if available
    if (location.nearby_hospitality.breakdown) {
      const breakdown = location.nearby_hospitality.breakdown;
      const types = [];
      if (breakdown.restaurant) types.push(`${breakdown.restaurant} restauranter`);
      if (breakdown.cafe) types.push(`${breakdown.cafe} cafeer`);
      if (breakdown.bar) types.push(`${breakdown.bar} barer`);
      if (types.length > 0) {
        parts.push(`  Fordeling: ${types.join(', ')}`);
      }
    }
    
    // High competition density strategy
    if (location.nearby_hospitality.density_label === 'high' ||
        (location.nearby_hospitality.total_count || 0) >= 10) {
      parts.push(``);
      parts.push(`KONKURRENCESSSTRATEGI VED HØJ TÆTHED:`);
      parts.push(``);
      parts.push(`⚡ HØJ KONKURRENCESSTÆTHED DETEKTERET (${location.nearby_hospitality.total_count} spisesteder inden for ${radius}m):`);
      parts.push(``);
      parts.push(`Ved høj konkurrencesstæthed er awareness-indhold ("vi er åbne") utilstrækkeligt.`);
      parts.push(`Differentieringsindhold er afgørende.`);
      parts.push(``);
      parts.push(`Forretningens unikke lokationsanchor skal fremhæves i content strategy:`);
      parts.push(`- Waterfront/å-beliggenhed er ikke replikérbar af naboer`);
      parts.push(`- Specifikke landmarks i nærheden (se landmarks_nearby)`);
      parts.push(`- Unikke service-perioder eller programtyper der adskiller sig`);
      parts.push(``);
      parts.push(`Anbefalinger for dette programme:`);
      parts.push(`- content_type_affinity.place: boost med +10 (lokation som differentieringsfaktor)`);
      parts.push(`- content_type_affinity.proof: boost med +5 (sociale beviser vigtige ved mange alternativer)`);
      parts.push(`- Reducer urgency relativt — konkurrence gør det sværere at bruge`);
      parts.push(`  generisk "kom nu"-indhold`);
    }
  }
  
  parts.push("");
  
  // Danish food culture context
  parts.push(`DANSK MADKULTUR — KONTEKST FOR KOMMERCIEL VÆGTNING:`);
  parts.push(``);
  parts.push(`I Danmark gælder en vigtig kulturel forskel fra andre markeder:`);
  parts.push(`Kontorfolk (office_worker) medbringer typisk madpakke til frokost`);
  parts.push(`eller køber hos bageri/deli/mad-marked — IKKE på restaurant eller café.`);
  parts.push(``);
  parts.push(`Konsekvens for programme-baseret commercial orientation:`);
  parts.push(`- office_worker WHO-type → MORGENKAFFE (07:30–09:30): moderat relevans`);
  parts.push(`- office_worker WHO-type → FROKOST (11:30–14:00): LAV relevans`);
  parts.push(`  (madpakkekultur dominerer — kontorfolk er sjældent restaurant-frokost gæster)`);
  parts.push(`- office_worker WHO-type → EFTER-ARBEJDE (16:30–19:00): moderat relevans`);
  parts.push(``);
  parts.push(`Vægt office_worker lavt i FROKOST programme goal_split beregning.`);
  parts.push(`Vægt office_worker moderat i MORGEN og AFTEN programmer.`);
  parts.push(`Dette gælder ALLE F&B forretninger i Danmark uanset lokation.`);
  parts.push("");
  
  // WEEKLY PATTERN INTERPRETATION — commercial consequences
  if (location.traffic_rhythm?.weekly_pattern) {
    parts.push(`UGENTLIGT TRAFIKMØNSTER: ${location.traffic_rhythm.weekly_pattern}`);
    parts.push(``);
    
    const patternGuidance: Record<string, string> = {
      'friday_saturday_peak': `
FREDAG-LØRDAG PEAK — kommercielle konsekvenser for dette program:
  - Lørdag er den vigtigste omsætningsdag
  - Fredag eftermiddag er beslutningsvinduet for lørdag-besøg
  - Torsdag-fredag posts = størst konverteringseffekt for weekend-footfall
  - Mandag-onsdag posts = brand-building, ikke konvertering
  - Søndag: brunch-peak tidligt (09:30–13:00), stille derefter
  - decision_timing for weekend-programmer: 'planned' (folk planlægger
    fredag/lørdag besøg 1-2 dage i forvejen)
  - goal_split: drive_footfall vægtes højere torsdag-lørdag,
    strengthen_brand vægtes højere mandag-onsdag`,

      'weekday_lunch_only': `
HVERDAGS-FROKOST MØNSTER:
  - Weekend er kommercielt uinteressant for dette program
  - Mandags-post: ugens vigtigste konverteringspost (frokost-planlægning)
  - Fredag: ikke relevant (folk er ikke på kontoret tankegang)
  - decision_timing: 'last_minute' (samme-dag beslutning til frokost)`,

      'all_week_even': `
JÆVN UGEFORDELING:
  - Ingen markant peak-dag — posts kan fordeles jævnt
  - Tidlig morgen (06:00–08:00) er relevant hvis hospital_campus
  - decision_timing: 'last_minute'`,

      'saturday_dominant': `
LØRDAG DOMINANT:
  - Lørdag er langt den travleste dag
  - Torsdag-fredag posts = kritisk beslutningsvindue
  - Søndag og hverdage er sekundære
  - decision_timing: 'last_minute' til 'hybrid'`,

      'semester_only': `
SEMESTERBASERET:
  - Sommer og juleferier = dramatisk trafikfald (60-80%)
  - Aktiv periode: september-december og februar-maj
  - Weekender er svage selv i semestret
  - decision_timing: 'last_minute'`,

      'weekend_peak': `
WEEKEND PEAK (natur/destination):
  - Lørdag-søndag dominerer, ingen markant fredagsuplift
  - Vejrafhængig — posts bør tage højde for vejrudsigt
  - decision_timing: 'last_minute' (vejret afgør dagen)`,

      'monday_friday_even': `
JÆVN UGEFORDELING MED WEEKEND:
  - Stabil basis alle dage inkl. weekend
  - Weekend brunch-peak (09:30–14:00 lørdag-søndag)
  - decision_timing: 'hybrid'`,
    };

    const guidance = patternGuidance[location.traffic_rhythm.weekly_pattern]
      || patternGuidance['monday_friday_even'];
    parts.push(guidance);
    parts.push(``);
  }
  
  // DAYPART × LOCATION COMPOSITION INSTRUCTION
  parts.push(`LOKATIONSANALYSE — VIGTIG KOMPOSITION:`);
  parts.push(`Forretningen befinder sig i flere geografiske kontekster samtidig (se scores ovenfor).`);
  parts.push(`Din opgave: for DETTE programs tidspunkt (${programme.timeWindow.start}-${programme.timeWindow.end}),`);
  parts.push(`vurder hvilke lokationsdimensioner er KOMMERCIELT AKTIVE på dette tidspunkt`);
  parts.push(`og vægt dem derefter i din goal_split anbefaling.`);
  parts.push(``);
  parts.push(`Eksempel: waterfront-dimension er mest aktiv om aftenen (destination-besøg);`);
  parts.push(`city_centre/shopping-dimension er mest aktiv i frokosttiden (hverdagsbesøg).`);
  parts.push(`Disse giver FORSKELLIGE goal_splits for FROKOST vs AFTEN — det er korrekt og ønsket.`);
  parts.push(``);
  parts.push(`KOMMERCIEL TILTRÆKNINGSTYPE — AFGØR FOR DETTE PROGRAM:`);
  parts.push(``);
  parts.push(`Baseret på lokation + programmets pris/service/åbningstid:`);
  parts.push(``);
  parts.push(`PASSING_TRADE: Høj fodgængertrafik + lavt/moderat pris + walk-in`);
  parts.push(`  → Gæster er fysisk til stede og beslutter spontant`);
  parts.push(`  → demographic_proximity scores direkte relevante`);
  parts.push(`  → goal_split: footfall-domineret`);
  parts.push(``);
  parts.push(`LOCAL_DRAW: Boligområde + moderat pris + gentagne besøg`);
  parts.push(`  → Gæster bor/arbejder i nærheden, kommer tilbage`);
  parts.push(`  → goal_split: blandet footfall/brand`);
  parts.push(``);
  parts.push(`DESTINATION_DRAW: Lav passeringstrafik + højt pris + booking`);
  parts.push(`  → Gæster REJSER TIL restauranten som aktiv, planlagt beslutning`);
  parts.push(`  → De kan bo OVERALT i regionen — ikke begrænset af nærhed`);
  parts.push(`  → demographic_proximity for nærliggende område er IKKE relevant`);
  parts.push(`     (en studerende der passerer forbi er ikke gæst til 600 kr tasting)`);
  parts.push(`  → goal_split: booking/brand-domineret`);
  parts.push(`  → reachable_guest_profile: beskriv hvem der AKTIVT vælger at`);
  parts.push(`     rejse hertil — defineret af lejlighed og prisniveau, ikke nærhed`);
  parts.push("");

  // Menu context
  if (menu.price_range) {
    parts.push(`MENU:`);
    parts.push(`Prisrange: ${menu.price_range.min}-${menu.price_range.max} kr`);
    if (menu.item_count) {
      parts.push(`Antal retter: ${menu.item_count}`);
    }
    if (menu.primary_categories && menu.primary_categories.length > 0) {
      parts.push(`Kategorier: ${menu.primary_categories.join(", ")}`);
    }
    parts.push("");
  }

  parts.push(`OPGAVE:`);
  parts.push(
    `Generer BASELINE kommerciel orientering for "${programme.name}" programmet.`
  );
  
  // Build competition hint
  const competitionHint = location.nearby_hospitality?.density_label 
    ? `${location.nearby_hospitality.density_label} konkurrence`
    : 'konkurrence data tilgængelig ovenfor';
  
  // Build location context hint - use local reference if available (single source of truth)
  const locationHint = location.local_location_reference || location.area_type || 'location';
  
  parts.push(``);
  parts.push(`Tænk som en kunde der beslutter sig for at besøge dette program:`);
  parts.push(`- Beslutter de samme dag? (last_minute)`);
  parts.push(`- Planlægger de i forvejen? (planned)`);
  parts.push(`- Begge mønstre? (hybrid)`);
  parts.push(``);
  parts.push(
    `Location (${locationHint}, ${competitionHint}) og program-type (${programme.type}) informerer, men TÆNK SOM KUNDE.`
  );
  parts.push(
    `Output skal være JSON med: goal_split, decision_timing, draw_type, ` +
    `reachable_guest_profile, content_type_affinity, location_context_applied, og reasoning.`
  );
  parts.push(``);
  parts.push(`draw_type: "passing_trade" | "local_draw" | "destination_draw"`);
  parts.push(`reachable_guest_profile: 1-2 sætninger på dansk om hvem der faktisk besøger`);
  parts.push(`dette program — filtreret mod pris og åbningstid, ikke blot hvem der bor i nærheden.`);
  parts.push(`Eksempel DESTINATION_DRAW: "Par og vennegrupper i Aarhus-området der planlægger`);
  parts.push(`en gastronomisk aftensoplevelse. Gæsterne kører til restauranten — de bor ikke`);
  parts.push(`nødvendigvis i nærheden."`);
  parts.push(`Eksempel PASSING_TRADE: "Kontorfolk og shoppende i centrum der spontant vælger`);
  parts.push(`frokost eller kaffe på vej forbi."`);

  return parts.join("\n");
}

function validateCommercialOrientation(
  result: any
): CommercialOrientation {
  // Validate goal_split sums to 100 (TWO-DIMENSIONAL FRAMEWORK)
  const goalSplit = result.baseline_goal_split;
  const goalSum =
    (goalSplit?.drive_footfall || 0) +
    (goalSplit?.strengthen_brand || 0);

  if (Math.abs(goalSum - 100) > 1) {
    throw new Error(
      `baseline_goal_split must sum to 100, got ${goalSum}`
    );
  }

  // Validate content_type_affinity sums to 100
  const affinity = result.content_type_affinity;
  const affinitySum =
    (affinity?.product || 0) +
    (affinity?.place || 0) +
    (affinity?.process || 0) +
    (affinity?.urgency || 0) +
    (affinity?.proof || 0) +
    (affinity?.retention || 0);

  if (Math.abs(affinitySum - 100) > 1) {
    throw new Error(
      `content_type_affinity must sum to 100, got ${affinitySum}`
    );
  }

  // Validate decision_timing
  const validTimings = ["last_minute", "planned", "hybrid"];
  if (!validTimings.includes(result.decision_timing)) {
    throw new Error(
      `decision_timing must be one of: ${validTimings.join(", ")}`
    );
  }

  // Validate draw_type
  const validDrawTypes = ["passing_trade", "local_draw", "destination_draw"];
  if (!validDrawTypes.includes(result.draw_type)) {
    throw new Error(
      `draw_type must be one of: ${validDrawTypes.join(", ")}, got: ${result.draw_type}`
    );
  }

  // Validate reachable_guest_profile
  if (!result.reachable_guest_profile ||
      result.reachable_guest_profile.length < 20) {
    throw new Error(
      "reachable_guest_profile must be a non-empty Danish description (>20 chars)"
    );
  }

  // Validate reasoning exists and is not generic
  if (
    !result.reasoning ||
    result.reasoning.length < 20 ||
    result.reasoning.includes("god kvalitet") ||
    result.reasoning.includes("autentisk oplevelse")
  ) {
    throw new Error(
      "reasoning must be specific and non-generic (>20 chars, no banned phrases)"
    );
  }

  return result as CommercialOrientation;
}
