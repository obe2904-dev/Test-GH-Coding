/**
 * Canonical Programme Mapping (Task 3.2)
 * 
 * Purpose: Normalize programme name variations to prevent tracking fragmentation
 * in rotation logic and analytics.
 * 
 * Problem: AI-extracted menu data uses inconsistent terms (Brunch vs Morgenmad vs Breakfast),
 * causing rotation logic to treat them as separate programmes.
 * 
 * Usage:
 * - When storing programmes to audience_framework.timeSlots[].programmes
 * - When tracking programme coverage in calculateProgrammePriorities()
 * - When generating content metadata
 * 
 * @see CONTENT-SYSTEMS-IMPROVEMENT-PLAN.md Task 3.2
 */

/**
 * Canonical programme names (the "standard" we normalize to)
 */
export type CanonicalProgramme = 'brunch' | 'frokost' | 'aftensmad' | 'cocktails' | 'dessert';

/**
 * Mapping of variations to canonical names
 * All keys are lowercase for case-insensitive matching
 */
export const PROGRAMME_VARIATIONS: Record<string, CanonicalProgramme> = {
  // Brunch / Morning variations
  'brunch': 'brunch',
  'morgenmad': 'brunch',
  'breakfast': 'brunch',
  'morgenkaffe': 'brunch',
  'morgenmenu': 'brunch',
  'morning': 'brunch',
  
  // Lunch variations
  'frokost': 'frokost',
  'lunch': 'frokost',
  'lunsj': 'frokost',
  'middagsmad': 'frokost',
  
  // Dinner variations
  'aftensmad': 'aftensmad',
  'dinner': 'aftensmad',
  'middag': 'aftensmad',
  'aftenmenu': 'aftensmad',
  'evening': 'aftensmad',
  
  // Bar / Drinks / Late night variations
  'cocktails': 'cocktails',
  'bar': 'cocktails',
  'drinks': 'cocktails',
  'natmenu': 'cocktails',
  'nightlife': 'cocktails',
  'aften bar': 'cocktails',
  
  // Dessert / Sweet variations
  'dessert': 'dessert',
  'kage': 'dessert',
  'cake': 'dessert',
  'kaffe & kage': 'dessert',
  'eftermiddagskaffe': 'dessert'
};

/**
 * Reverse mapping: canonical name → all variations (for documentation/UI)
 */
export const CANONICAL_PROGRAMME_GROUPS: Record<CanonicalProgramme, string[]> = {
  brunch: ['brunch', 'morgenmad', 'breakfast', 'morgenkaffe', 'morgenmenu', 'morning'],
  frokost: ['frokost', 'lunch', 'lunsj', 'middagsmad'],
  aftensmad: ['aftensmad', 'dinner', 'middag', 'aftenmenu', 'evening'],
  cocktails: ['cocktails', 'bar', 'drinks', 'natmenu', 'nightlife', 'aften bar'],
  dessert: ['dessert', 'kage', 'cake', 'kaffe & kage', 'eftermiddagskaffe']
};

/**
 * Canonicalize a programme name to its standard form
 * 
 * @param programmeName - Raw programme name (e.g., "Morgenmad", "BREAKFAST", "Brunch")
 * @returns Canonical programme name (e.g., "brunch") or original if no mapping exists
 * 
 * @example
 * canonicalizeProgramme("Morgenmad") // "brunch"
 * canonicalizeProgramme("LUNCH") // "frokost"
 * canonicalizeProgramme("Unknown") // "unknown" (passthrough)
 */
export function canonicalizeProgramme(programmeName: string): string {
  if (!programmeName) return '';
  
  const normalized = programmeName.toLowerCase().trim();
  const canonical = PROGRAMME_VARIATIONS[normalized];
  
  return canonical || normalized; // Fallback to normalized input if no mapping
}

/**
 * Canonicalize an array of programme names
 * 
 * @param programmes - Array of raw programme names
 * @returns Array of canonical programme names (deduplicated)
 * 
 * @example
 * canonicalizeProgrammes(["Brunch", "Morgenmad", "Lunch"]) 
 * // ["brunch", "frokost"]
 */
export function canonicalizeProgrammes(programmes: string[]): string[] {
  if (!programmes || !Array.isArray(programmes)) return [];
  
  const canonicalized = programmes
    .map(canonicalizeProgramme)
    .filter(p => p.length > 0);
  
  // Deduplicate
  return Array.from(new Set(canonicalized));
}

/**
 * Check if a programme name matches a canonical programme (case-insensitive)
 * 
 * @param programmeName - Programme name to check
 * @param canonical - Canonical programme to match against
 * @returns True if the name is a variation of the canonical programme
 * 
 * @example
 * isProgrammeVariant("Morgenmad", "brunch") // true
 * isProgrammeVariant("Lunch", "brunch") // false
 */
export function isProgrammeVariant(programmeName: string, canonical: CanonicalProgramme): boolean {
  const canonicalForm = canonicalizeProgramme(programmeName);
  return canonicalForm === canonical;
}
