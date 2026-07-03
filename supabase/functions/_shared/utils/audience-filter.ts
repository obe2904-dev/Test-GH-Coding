/**
 * Audience Label Filter — single source of truth for location audience permissions.
 *
 * SCHEMA V3 (Physical Anchor Taxonomy):
 * - who: WHO is physically present {primary: WhoType[], secondary: WhoType[], notes?: string}
 * - category_scores: WHERE the business is (9 physical anchor types)
 *
 * Takes who + category_scores from business_location_intelligence and a max menu price,
 * and returns permission-gated audience labels that match exactly what is shown to the
 * user in the Location setup UI.
 *
 * V2 → V3 Migration Compatibility:
 * - Accepts both old demographic_proximity (scores) AND new who (arrays) formats
 * - Converts who arrays to score equivalents: primary=90, secondary=50, absent=0
 *
 * Rules (mirrors prompt-b.ts AUDIENCE PERMISSIONS block):
 *   - waterfront / tourist_destination / tourist:  secondary threshold ≥40
 *   - student:                             primary-only threshold ≥70,
 *                                          AND max menu price must be ≤150 kr
 *   - office:                              secondary threshold ≥40
 *   - others:                              ≥40, up to 2 additional labels
 *
 * Used by:
 *   - brand-profile-generator/index.ts  (SecondarySignals.audienceProfile)
 *   - _shared/brand-profile/prompts/prompt-b.ts  (strength vars for AUDIENCE PERMISSIONS)
 *   - get-weekly-strategy/index.ts (locationCategories calculation)
 *   - _shared/post-helpers/weekly-plan-generator.ts (location context building)
 */

export type AudienceStrength = 'primary' | 'secondary' | 'absent'

// V3: WHO field structure
export interface LocationWho {
  primary: string[];
  secondary: string[];
  notes?: string;
}

export interface AudienceFilterResult {
  /** Strength level for tourist/waterfront/destination cluster */
  touristStrength: AudienceStrength
  /** Strength level for student audience — never 'primary' if price-gated out */
  studentStrength: AudienceStrength
  /** Strength level for office/business audience */
  officeStrength: AudienceStrength
  /** Ordered permitted category keys (max 3), already price-validated */
  permittedKeys: string[]
  /** Danish display labels matching the Location UI exactly */
  permittedLabels: string[]
  /** Comma-joined string ready for prompt injection */
  audienceProfileString: string
}

/** Danish display labels — identical to Location UI translations */
export const AUDIENCE_LABEL_MAP: Record<string, string> = {
  waterfront:          'havne-/åmiljø',
  tourist_destination: 'turistområde',
  tourist:             'turister/besøgende',
  student:             'studerende',
  office:              'erhvervsgæster',
  office_worker:       'erhvervsgæster',
  transport_hub:       'pendlere',
  commuter:            'pendlere',
  shopping_district:   'shoppere',
  shopper:             'shoppende',
  residential:         'lokale beboere',
  local_resident:      'lokale beboere',
  city_centre:         'bymidten',
  nature_park:         'naturgæster',
  leisure_walker:      'promenadegæster',  // Default for urban waterfront
  night_life:          'aftenpublikum',
  family:              'familier',
  university_campus:   'studerende',
  hospital_campus:     'hospitalsområde',
  medical_staff:       'hospitalspersonale',
  hospital_visitor:    'hospitalsbesøgende',
  event_visitor:       'eventgæster',
};

/**
 * Context-aware label for leisure_walker based on location type
 */
function getLeisureWalkerLabel(categoryScores?: Record<string, number> | null): string {
  const safeCategory = categoryScores ?? {};
  const natureParkScore = safeCategory['nature_park'] ?? 0;
  
  // Only use "naturgæster" if it's actually a nature park (≥60)
  // Otherwise use "promenadegæster" for urban waterfront/city walkers
  return natureParkScore >= 60 ? 'naturgæster' : 'promenadegæster';
}

/**
 * Convert WHO field (v3) to score-based format (v2 compatibility)
 * primary = 90, secondary = 50, absent = 0
 */
function convertWhoToScores(who: LocationWho | null | undefined): Record<string, number> {
  if (!who) return {};
  
  const scores: Record<string, number> = {};
  
  // Map v3 WHO types to v2 demographic keys
  const whoTypeMapping: Record<string, string> = {
    'local_resident': 'local_resident',
    'office_worker': 'office_worker',
    'student': 'student',
    'shopper': 'shopper',
    'tourist': 'tourist',
    'commuter': 'commuter',
    'leisure_walker': 'leisure_walker',
    'family': 'family',
    'medical_staff': 'medical_staff',
    'hospital_visitor': 'hospital_visitor',
    'event_visitor': 'event_visitor'
  };
  
  (who.primary || []).forEach(whoType => {
    const key = whoTypeMapping[whoType];
    if (key) scores[key] = 90;  // Primary = very high score
  });
  
  (who.secondary || []).forEach(whoType => {
    const key = whoTypeMapping[whoType];
    if (key && !scores[key]) scores[key] = 50;  // Secondary = medium score (only if not already primary)
  });
  
  return scores;
}

/**
 * @param who                   V3: WHO field {primary, secondary, notes}
 * @param demographicProximity  V2: WHO passes by scores (deprecated, for backwards compatibility)
 * @param maxMenuPrice          Highest menu item price in DKK — used to gate student audience.
 *                              Pass null if unknown (student gate falls back to score-only).
 * @param categoryScores        WHERE business is: {city_centre, waterfront, residential, transport_hub, etc.}
 */
export function filterAudienceLabels(
  demographicProximity: Record<string, number> | null | undefined,
  maxMenuPrice: number | null,
  categoryScores?: Record<string, number> | null,
  who?: LocationWho | null
): AudienceFilterResult {
  // V3: Prefer WHO field if available, otherwise fall back to demographic_proximity (v2)
  const safeDemographic = who 
    ? convertWhoToScores(who)
    : (demographicProximity ?? {});
  const safeCategory = categoryScores ?? {};
  
  // SCHEMA V3: Tourist from who field OR category scores
  const touristDemographic = safeDemographic['tourist'] ?? 0;
  const waterfrontGeographic = safeCategory['waterfront'] ?? 0;
  const touristDestinationGeographic = safeCategory['tourist_destination'] ?? 0;  // Updated from 'destination'
  
  // Tourist strength = max of demographic tourist + geographic waterfront/tourist_destination
  const touristScore = Math.max(touristDemographic, waterfrontGeographic, touristDestinationGeographic);
  
  const studentScore = safeDemographic['student'] ?? 0
  const officeScore  = safeDemographic['office_worker']
    ?? safeDemographic['business_professional']  // fallback for records not yet re-analyzed
    ?? 0

  const touristStrength: AudienceStrength =
    touristScore >= 70 ? 'primary' : touristScore >= 40 ? 'secondary' : 'absent'

  // Student strength reflects geographic score only — price gate applied separately below
  const studentStrengthRaw: AudienceStrength =
    studentScore >= 70 ? 'primary' : studentScore >= 40 ? 'secondary' : 'absent'

  const officeStrength: AudienceStrength =
    officeScore >= 70 ? 'primary' : officeScore >= 40 ? 'secondary' : 'absent'

  // Students are a budget audience: exclude if menu prices suggest mid-premium or higher
  const isPricedAboveStudentBudget = maxMenuPrice !== null && maxMenuPrice > 150
  const studentStrength: AudienceStrength =
    isPricedAboveStudentBudget ? 'absent' : studentStrengthRaw

  // ── Build permitted keys ───────────────────────────────────────────────────

  const permittedKeys: string[] = []

  // Tourist/waterfront/tourist_destination cluster — secondary threshold ≥40
  if (touristScore >= 40) {
    // Prefer geographic location types (waterfront/tourist_destination) over demographic "tourist"
    const topKey = waterfrontGeographic >= touristDestinationGeographic && waterfrontGeographic >= touristDemographic
      ? 'waterfront'
      : touristDestinationGeographic >= touristDemographic
        ? 'tourist_destination'
        : 'tourist'
    permittedKeys.push(topKey)
  }

  // Student — primary-only + price gate
  if (studentScore >= 70 && !isPricedAboveStudentBudget) {
    permittedKeys.push('student')
  }

  // Office — secondary threshold ≥40
  if (officeScore >= 40) permittedKeys.push('office')

  // Everything else ≥40, up to 2 additional (check both who AND category_scores)
  const handled = new Set(['student', 'tourist', 'tourist_destination', 'waterfront', 'office', 'office_worker', 'business_professional'])
  
  const demographicExtras = Object.entries(safeDemographic)
    .filter(([k, v]) => (v as number) >= 40 && !handled.has(k) && !permittedKeys.includes(k))
  
  const categoryExtras = Object.entries(safeCategory)
    .filter(([k, v]) => (v as number) >= 40 && !handled.has(k) && !permittedKeys.includes(k))
  
  const allExtras = [...demographicExtras, ...categoryExtras]
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 2)
    .map(([k]) => k)
  
  permittedKeys.push(...allExtras)

  // Cap at 3 for prompt readability
  const finalKeys = permittedKeys.slice(0, 3)
  
  // Map keys to labels with context-aware leisure_walker handling
  const permittedLabels = finalKeys.map(k => {
    if (k === 'leisure_walker') {
      return getLeisureWalkerLabel(categoryScores);
    }
    return AUDIENCE_LABEL_MAP[k] ?? k.replace(/_/g, ' ');
  });
  
  const audienceProfileString = permittedLabels.length > 0
    ? permittedLabels.join(', ')
    : 'lokalt nærområde'

  return {
    touristStrength,
    studentStrength,
    officeStrength,
    permittedKeys: finalKeys,
    permittedLabels,
    audienceProfileString,
  }
}
