/**
 * Waterfront Term Detector
 * 
 * Detects the SPECIFIC waterfront term to use in Danish brand profiles.
 * Replaces generic "waterfront" with authentic local language ("ved åen", "ved fjorden", etc.)
 * 
 * @module waterfront-detector
 */

/**
 * Danish waterfront term types
 */
export type WaterfrontTerm =
  | 'ved åen'       // River (most common in DK cities)
  | 'ved fjorden'   // Fjord
  | 'ved søen'      // Lake
  | 'ved havnen'    // Harbor/port
  | 'ved bugten'    // Bay
  | 'ved kanalen'   // Canal
  | 'ved stranden'  // Beach/coast
  | 'ved havet'     // Sea/ocean (for coastal)
  | 'ved vandet'    // Generic water (fallback only)

/**
 * Known waterfront mappings for Danish cities
 * Based on specific waterway names and geography
 */
const CITY_WATERFRONT_MAP: Record<string, WaterfrontTerm> = {
  // Cities with named rivers (åer)
  'aarhus': 'ved åen',           // Aarhus Å
  'odense': 'ved åen',           // Odense Å
  'silkeborg': 'ved søen',       // Silkeborg Søerne (lakes)
  'vejle': 'ved fjorden',        // Vejle Fjord
  
  // Cities with fjords
  'roskilde': 'ved fjorden',     // Roskilde Fjord
  'horsens': 'ved fjorden',      // Horsens Fjord
  'kolding': 'ved fjorden',      // Kolding Fjord
  'mariager': 'ved fjorden',     // Mariager Fjord
  
  // Cities with harbors (havne)
  'københavn': 'ved havnen',     // Copenhagen Harbor
  'copenhagen': 'ved havnen',
  'esbjerg': 'ved havnen',       // West coast harbor
  'fredericia': 'ved havnen',
  'helsingør': 'ved havnen',
  'aalborg': 'ved fjorden',      // Limfjorden
  
  // Cities with lakes (søer)
  'skanderborg': 'ved søen',     // Skanderborg Sø
  'viborg': 'ved søen',          // Viborg Søerne
  
  // Beach/coastal cities
  'skagen': 'ved havet',         // North tip, sea
  'ebeltoft': 'ved bugten',      // Ebeltoft Bugt
  'sønderborg': 'ved fjorden',   // Als Fjord
}

/**
 * Address keywords that indicate specific waterfront types
 * Used when city mapping is not specific enough
 */
const ADDRESS_WATERFRONT_KEYWORDS: Array<{ pattern: RegExp; term: WaterfrontTerm }> = [
  // River indicators
  { pattern: /\bå(boulevarden|gade|havnen|parken|en)\b/i, term: 'ved åen' },
  { pattern: /\briver\b/i, term: 'ved åen' },
  
  // Fjord indicators
  { pattern: /\bfjord(gade|vej|havnen|en)?\b/i, term: 'ved fjorden' },
  
  // Lake indicators
  { pattern: /\bsø(gade|vej|parken|en)\b/i, term: 'ved søen' },
  { pattern: /\blake\b/i, term: 'ved søen' },
  
  // Harbor indicators
  { pattern: /\bhavn(egade|gade|en)\b/i, term: 'ved havnen' },
  { pattern: /\b(harbor|harbour)\b/i, term: 'ved havnen' },
  { pattern: /\bnyhavn\b/i, term: 'ved havnen' },
  
  // Bay indicators
  { pattern: /\bbugt(en)?\b/i, term: 'ved bugten' },
  { pattern: /\bbay\b/i, term: 'ved bugten' },
  
  // Canal indicators
  { pattern: /\bkanal(en|gade)?\b/i, term: 'ved kanalen' },
  { pattern: /\bcanal\b/i, term: 'ved kanalen' },
  { pattern: /\bchristianshanvns?\b/i, term: 'ved kanalen' },
  
  // Beach/coast indicators
  { pattern: /\bstrand(vej|en)?\b/i, term: 'ved stranden' },
  { pattern: /\bbeach\b/i, term: 'ved stranden' },
  
  // Sea/ocean indicators
  { pattern: /\bhav(et|vej)?\b/i, term: 'ved havet' },
  { pattern: /\b(sea|ocean)\b/i, term: 'ved havet' },
]

/**
 * Business name waterfront indicators
 * Some businesses have waterfront references in their name
 */
const BUSINESS_NAME_KEYWORDS: Array<{ pattern: RegExp; term: WaterfrontTerm }> = [
  { pattern: /\bå(en|boulevarden)?\b/i, term: 'ved åen' },
  { pattern: /\bhavn(en|café|restaurant)?\b/i, term: 'ved havnen' },
  { pattern: /\bfjord(en)?\b/i, term: 'ved fjorden' },
  { pattern: /\bstrand(en)?\b/i, term: 'ved stranden' },
]

/**
 * Detect specific waterfront term from location context
 * 
 * Strategy (in priority order):
 * 1. Check address for specific waterfront keywords (highest confidence)
 * 2. Check business name for waterfront references
 * 3. Fall back to city-level mapping (good for most cases)
 * 4. Return generic "ved vandet" as last resort
 * 
 * @param city - City name
 * @param address - Full address string (can include street, postal, etc.)
 * @param businessName - Business name (optional, may contain waterfront reference)
 * @returns Specific waterfront term to use in brand profile
 */
export function detectWaterfrontTerm(
  city: string = '',
  address: string = '',
  businessName: string = ''
): WaterfrontTerm | null {
  const cityLower = city.toLowerCase().trim()
  const addressLower = address.toLowerCase().trim()
  const businessNameLower = businessName.toLowerCase().trim()

  // Priority 1: Check address for specific waterfront type
  for (const { pattern, term } of ADDRESS_WATERFRONT_KEYWORDS) {
    if (pattern.test(addressLower)) {
      return term
    }
  }

  // Priority 2: Check business name for waterfront references
  for (const { pattern, term } of BUSINESS_NAME_KEYWORDS) {
    if (pattern.test(businessNameLower)) {
      return term
    }
  }

  // Priority 3: City-level mapping (covers most common cases)
  if (CITY_WATERFRONT_MAP[cityLower]) {
    return CITY_WATERFRONT_MAP[cityLower]
  }

  // No specific waterfront detected
  return null
}

/**
 * Get waterfront term with fallback to generic "ved vandet"
 * Use this when you KNOW it's a waterfront location but don't have the specific term
 * 
 * @param city - City name
 * @param address - Address string
 * @param businessName - Business name
 * @returns Waterfront term (never null, uses "ved vandet" as fallback)
 */
export function getWaterfrontTermWithFallback(
  city: string = '',
  address: string = '',
  businessName: string = ''
): WaterfrontTerm {
  return detectWaterfrontTerm(city, address, businessName) || 'ved vandet'
}

/**
 * Helper: Enhance nearby_signals with specific waterfront term
 * Replaces generic "waterfront" signal with specific term
 * 
 * @param signals - Current nearby_signals array
 * @param city - City name
 * @param address - Address string
 * @param businessName - Business name
 * @returns Enhanced signals with specific waterfront term
 */
export function enhanceWaterfrontSignals(
  signals: string[],
  city: string = '',
  address: string = '',
  businessName: string = ''
): string[] {
  // Check if there's a generic waterfront signal
  const hasWaterfrontSignal = signals.some(s => 
    s.toLowerCase().includes('waterfront') || 
    s.toLowerCase().includes('ved vandet')
  )

  if (!hasWaterfrontSignal) {
    return signals // No waterfront, no change
  }

  // Detect specific term
  const specificTerm = detectWaterfrontTerm(city, address, businessName)
  
  if (!specificTerm) {
    return signals // Can't be more specific, keep as-is
  }

  // Replace generic waterfront signal with specific term
  return signals.map(signal => {
    const lower = signal.toLowerCase()
    if (lower.includes('waterfront') || lower.includes('ved vandet')) {
      return specificTerm
    }
    return signal
  })
}
