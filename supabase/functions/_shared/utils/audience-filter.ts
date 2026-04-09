/**
 * Audience Label Filter — single source of truth for location audience permissions.
 *
 * Takes raw category_scores from business_location_intelligence and a max menu price,
 * and returns permission-gated audience labels that match exactly what is shown to the
 * user in the Location setup UI.
 *
 * Rules (mirrors prompt-b.ts AUDIENCE PERMISSIONS block):
 *   - waterfront / destination / tourist:  secondary threshold ≥40
 *   - student:                             primary-only threshold ≥70,
 *                                          AND max menu price must be ≤150 kr
 *   - office:                              secondary threshold ≥40
 *   - others:                              ≥40, up to 2 additional labels
 *
 * Used by:
 *   - brand-profile-generator/index.ts  (SecondarySignals.audienceProfile)
 *   - _shared/brand-profile/prompts/prompt-b.ts  (strength vars for AUDIENCE PERMISSIONS)
 */

export type AudienceStrength = 'primary' | 'secondary' | 'absent'

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
  waterfront:        'havne-/åmiljø',
  destination:       'destinationsbesøg',
  tourist:           'turister/besøgende',
  student:           'studerende',
  office:            'erhvervsgæster',
  transport_hub:     'pendlere',
  shopping_district: 'shoppere',
  residential:       'lokale beboere',
  city_centre:       'bymidten',
  nature_park:       'naturgæster',
  night_life:        'aftenpublikum',
}

/**
 * @param categoryScores  Raw map from business_location_intelligence.category_scores
 * @param maxMenuPrice    Highest menu item price in DKK — used to gate student audience.
 *                        Pass null if unknown (student gate falls back to score-only).
 */
export function filterAudienceLabels(
  categoryScores: Record<string, number>,
  maxMenuPrice: number | null
): AudienceFilterResult {
  // Tourist strength: max of the three tourist-family keys
  const touristScore = Math.max(
    categoryScores['tourist']     ?? 0,
    categoryScores['destination'] ?? 0,
    categoryScores['waterfront']  ?? 0
  )
  const studentScore = categoryScores['student'] ?? 0
  const officeScore  = categoryScores['office']  ?? 0

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

  // Tourist/waterfront/destination cluster — secondary threshold ≥40
  if (touristScore >= 40) {
    const topKey = (['waterfront', 'destination', 'tourist'] as const)
      .find(k => (categoryScores[k] ?? 0) === touristScore) ?? 'tourist'
    permittedKeys.push(topKey)
  }

  // Student — primary-only + price gate
  if (studentScore >= 70 && !isPricedAboveStudentBudget) {
    permittedKeys.push('student')
  }

  // Office — secondary threshold ≥40
  if (officeScore >= 40) permittedKeys.push('office')

  // Everything else ≥40, up to 2 additional (excludes already-handled keys)
  const handled = new Set(['student', 'tourist', 'destination', 'waterfront', 'office'])
  const extras = Object.entries(categoryScores)
    .filter(([k, v]) => (v as number) >= 40 && !handled.has(k) && !permittedKeys.includes(k))
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 2)
    .map(([k]) => k)
  permittedKeys.push(...extras)

  // Cap at 3 for prompt readability
  const finalKeys = permittedKeys.slice(0, 3)
  const permittedLabels = finalKeys.map(k => AUDIENCE_LABEL_MAP[k] ?? k.replace(/_/g, ' '))
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
