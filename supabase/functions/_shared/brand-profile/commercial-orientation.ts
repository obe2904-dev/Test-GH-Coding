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
    retain_regulars: number;
  };
  decision_timing: "last_minute" | "planned" | "hybrid";
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
  parts.push(`LOCATION KONTEKST:`);
  if (location.local_location_reference) {
    parts.push(`Lokal betegnelse: ${location.local_location_reference}`);
  }
  // Fallback chain: local_location_reference > neighborhood > city
  const locationContext = location.local_location_reference || location.neighborhood || business.city;
  if (locationContext && !location.local_location_reference) {
    parts.push(`Område: ${locationContext}`);
  }
  if (location.area_type) {
    parts.push(`Type: ${location.area_type}`);
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
  }
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
    `Output skal være JSON med goal_split, decision_timing, content_type_affinity, location_context_applied, og reasoning.`
  );

  return parts.join("\n");
}

function validateCommercialOrientation(
  result: any
): CommercialOrientation {
  // Validate goal_split sums to 100
  const goalSplit = result.baseline_goal_split;
  const goalSum =
    (goalSplit?.drive_footfall || 0) +
    (goalSplit?.strengthen_brand || 0) +
    (goalSplit?.retain_regulars || 0);

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
