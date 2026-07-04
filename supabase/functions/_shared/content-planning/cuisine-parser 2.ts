/**
 * Cuisine Parser - Extracts cuisine style from menu_results_v2.ai_summary
 * 
 * @module cuisine-parser
 * @description Parses AI-generated menu summaries to identify cuisine types
 * and culinary approaches for content generation and photo guidance
 */

export interface CuisineContext {
  /** Primary cuisine detected (e.g., "Thai", "Italian", "Nordic") */
  primary: string | null
  
  /** Secondary cuisine for fusion concepts */
  secondary: string | null
  
  /** Culinary approach (Traditional, Modern, Fusion) */
  approach: string | null
  
  /** Key for photo guidance templates */
  photoGuidanceKey: string
  
  /** Detection confidence level */
  confidence: 'high' | 'medium' | 'low' | 'none'
}

/**
 * Cuisine detection patterns with word boundaries to avoid false positives
 * 
 * Word boundaries (\b) ensure:
 * - "italian" matches but "internationale" doesn't
 * - Dish-specific terms (pasta, sushi) don't need boundaries
 */
const CUISINE_PATTERNS: Record<string, RegExp> = {
  'Thai': /\b(thai|thailandsk)\b/i,
  'Italian': /\b(italiensk|italian)\b|pasta|pizza|risotto/i,
  'French': /\b(fransk|french)\b|bistro|brasserie/i,
  'Nordic': /\bnordisk\b|\bnordic\b|ny nordisk|new nordic/i,
  'Danish': /dansk madkultur|traditional danish|smørrebrød|frikadeller/i,
  'Japanese': /\b(japansk|japanese)\b|sushi|ramen|izakaya/i,
  'Mediterranean': /\bmediterran(ean)?\b/i,
  'Mexican': /\b(mexicansk|mexican)\b|taco|burrito/i,
  'Indian': /\b(indisk|indian)\b|curry|tandoori/i,
  'Middle Eastern': /mellemøstlig|middle eastern|falafel|hummus|mezze/i,
  'Chinese': /\b(kinesisk|chinese)\b|dim sum|wok/i,
  'Spanish': /\b(spansk|spanish)\b|tapas|paella/i,
  'Greek': /\b(græsk|greek)\b|gyros|souvlaki/i,
  'Vietnamese': /\b(vietnamesisk|vietnamese)\b|pho|banh mi/i,
  'Korean': /\b(koreansk|korean)\b|bibimbap|kimchi/i,
}

/**
 * Culinary approach detection patterns
 */
const APPROACH_PATTERNS: Record<string, RegExp> = {
  'Traditional': /traditionel|klassisk|autentisk|traditional|classic|authentic/i,
  'Modern': /moderne|ny|contemporary|modern|new/i,
  'Fusion': /møder|meets|fusion|blanding|mix/i,
}

/**
 * Parse cuisine context from menu AI summary
 * 
 * @param aiSummary - The ai_summary field from menu_results_v2
 * @returns Parsed cuisine context with primary, secondary, and approach
 * 
 * @example
 * ```typescript
 * const summary = "Dansk madkultur møder italienske klassikere (smørrebrød, pasta)"
 * const context = parseCuisineFromSummary(summary)
 * // → { primary: "Danish", secondary: "Italian", approach: "Fusion", ... }
 * ```
 */
export function parseCuisineFromSummary(aiSummary: string | null): CuisineContext {
  if (!aiSummary || aiSummary.trim().length === 0) {
    return {
      primary: null,
      secondary: null,
      approach: null,
      photoGuidanceKey: 'default',
      confidence: 'none'
    }
  }

  const text = aiSummary.toLowerCase()
  
  // Detect primary cuisine (first match wins)
  let primary: string | null = null
  for (const [cuisine, pattern] of Object.entries(CUISINE_PATTERNS)) {
    if (pattern.test(text)) {
      primary = cuisine
      break
    }
  }

  // Detect culinary approach
  let approach: string | null = null
  for (const [app, pattern] of Object.entries(APPROACH_PATTERNS)) {
    if (pattern.test(text)) {
      approach = app
      break
    }
  }

  // Detect fusion pattern: "X møder Y" or "X meets Y"
  let secondary: string | null = null
  const fusionMatch = text.match(/(\w+)\s+(?:møder|meets)\s+(\w+)/i)
  if (fusionMatch) {
    secondary = fusionMatch[2]
    approach = 'Fusion'
  }

  // Determine confidence based on what was detected
  let confidence: CuisineContext['confidence'] = 'none'
  if (primary && approach) {
    confidence = 'high'
  } else if (primary) {
    confidence = 'medium'
  } else if (approach) {
    confidence = 'low'
  }

  // Map to photo guidance key (fallback to default if not detected)
  const photoGuidanceKey = primary || 'default'

  return {
    primary,
    secondary,
    approach,
    photoGuidanceKey,
    confidence
  }
}

/**
 * Format cuisine context as human-readable description
 * 
 * @param context - Parsed cuisine context
 * @returns Formatted string for prompt context or UI display
 * 
 * @example
 * ```typescript
 * formatCuisineForPrompt({ primary: "Thai", secondary: null, approach: "Traditional" })
 * // → "Traditional Thai"
 * 
 * formatCuisineForPrompt({ primary: "Danish", secondary: "French", approach: "Fusion" })
 * // → "Danish-French fusion"
 * ```
 */
export function formatCuisineForPrompt(context: CuisineContext): string | null {
  if (!context.primary) return null

  if (context.secondary && context.approach === 'Fusion') {
    return `${context.primary}-${context.secondary} fusion`
  }

  if (context.approach) {
    return `${context.approach} ${context.primary}`
  }

  return context.primary
}

/**
 * Detect all matching cuisines (for multi-cuisine venues)
 * 
 * @param aiSummary - The ai_summary field from menu_results_v2
 * @returns Array of detected cuisine types
 * 
 * @example
 * ```typescript
 * const summary = "Dansk madkultur med italienske pasta og japansk sushi"
 * const cuisines = detectAllCuisines(summary)
 * // → ["Danish", "Italian", "Japanese"]
 * ```
 */
export function detectAllCuisines(aiSummary: string | null): string[] {
  if (!aiSummary || aiSummary.trim().length === 0) {
    return []
  }

  const text = aiSummary.toLowerCase()
  const detected: string[] = []

  for (const [cuisine, pattern] of Object.entries(CUISINE_PATTERNS)) {
    if (pattern.test(text)) {
      detected.push(cuisine)
    }
  }

  return detected
}
