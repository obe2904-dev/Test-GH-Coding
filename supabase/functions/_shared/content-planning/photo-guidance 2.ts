/**
 * Photo Guidance - Cuisine-aware photography templates
 * 
 * @module photo-guidance
 * @description Generates amateur-friendly photo suggestions based on
 * cuisine style and content type (80-120 character guidance)
 */

export interface PhotoTemplate {
  /** Camera angle suggestion */
  angle: string
  
  /** Lighting recommendation */
  lighting: string
  
  /** Context, props, or composition details */
  context: string
}

/**
 * Cuisine-specific photo templates
 * 
 * Each template provides:
 * - angle: Camera position (overhead 90°, 45°, eye level, etc.)
 * - lighting: Light quality (bright daylight, warm ambient, soft diffused)
 * - context: Props, composition, or styling cues
 */
const CUISINE_PHOTO_TEMPLATES: Record<string, PhotoTemplate> = {
  'Thai': {
    angle: 'Overhead 90°',
    lighting: 'Bright daylight',
    context: 'Fresh herbs and lime visible, vibrant colors, chopsticks entering frame'
  },
  'Italian': {
    angle: 'Overhead 45°',
    lighting: 'Natural bright',
    context: 'Garnish visible, contrasting plate color, rustic texture'
  },
  'French': {
    angle: '45° table height',
    lighting: 'Warm ambient',
    context: 'Rustic ceramic dish, crusty bread or wine glass in background'
  },
  'Nordic': {
    angle: 'Eye level',
    lighting: 'Soft diffused',
    context: 'Minimal plating, ingredient textures visible, neutral tones'
  },
  'Danish': {
    angle: '45° table height',
    lighting: 'Natural bright',
    context: 'Rye bread or butter in background, simple Nordic aesthetic'
  },
  'Japanese': {
    angle: 'Overhead 90°',
    lighting: 'Soft natural',
    context: 'Minimalist plating, chopsticks parallel, negative space visible'
  },
  'Mediterranean': {
    angle: 'Overhead 60°',
    lighting: 'Bright natural',
    context: 'Olive oil bottle, fresh herbs, terracotta or white ceramic'
  },
  'Mexican': {
    angle: 'Overhead 75°',
    lighting: 'Bright daylight',
    context: 'Lime wedges, cilantro, colorful salsas, rustic presentation'
  },
  'Indian': {
    angle: '45° table height',
    lighting: 'Warm natural',
    context: 'Multiple small bowls, naan bread, vibrant curry colors'
  },
  'Middle Eastern': {
    angle: 'Overhead 60°',
    lighting: 'Natural bright',
    context: 'Pita bread, hummus swirl, olive oil drizzle, herbs scattered'
  },
  'Chinese': {
    angle: 'Overhead 45°',
    lighting: 'Bright natural',
    context: 'Multiple dishes sharing, chopsticks, steam visible if hot'
  },
  'Spanish': {
    angle: '45° table height',
    lighting: 'Warm ambient',
    context: 'Tapas-style small plate, wine glass, rustic ceramic'
  },
  'Greek': {
    angle: 'Overhead 60°',
    lighting: 'Bright natural',
    context: 'White plate, feta cheese visible, olive oil, Mediterranean colors'
  },
  'Vietnamese': {
    angle: 'Overhead 75°',
    lighting: 'Natural bright',
    context: 'Fresh herbs, lime, rice paper visible, clean presentation'
  },
  'Korean': {
    angle: 'Overhead 60°',
    lighting: 'Natural bright',
    context: 'Multiple banchan dishes, chopsticks, vibrant fermented colors'
  },
  'default': {
    angle: 'Overhead 45°',
    lighting: 'Natural bright',
    context: 'Dish centered, garnish visible, contrasting background'
  }
}

/**
 * Content type adjustments override cuisine defaults
 * 
 * For non-food content (drinks, atmosphere, behind-scenes),
 * these templates take precedence
 */
const CONTENT_TYPE_ADJUSTMENTS: Record<string, Partial<PhotoTemplate>> = {
  'drink': {
    angle: 'Eye level',
    context: 'Condensation or garnish visible, bar background softly blurred'
  },
  'atmosphere': {
    angle: '45° room height',
    context: 'Natural guest activity, warm lighting, depth of field'
  },
  'behind_scenes': {
    angle: 'Eye level or slight low',
    context: 'Action in progress, authentic moment, kitchen tools visible'
  }
}

/**
 * Generate photo guidance for menu items and drinks
 * 
 * @param cuisineContext - Detected cuisine style (from parseCuisineFromSummary)
 * @param contentType - Type of content (menu_item, drink, atmosphere, etc.)
 * @returns Formatted photo guidance string (80-120 chars)
 * 
 * @example
 * ```typescript
 * // Thai menu item
 * generatePhotoGuidance("Thai", "menu_item")
 * // → "Overhead 90°, bright daylight, fresh herbs and lime visible, vibrant colors, chopsticks entering frame"
 * 
 * // French menu item
 * generatePhotoGuidance("French", "menu_item")
 * // → "45° table height, warm ambient, rustic ceramic dish, crusty bread or wine glass in background"
 * 
 * // Generic drink
 * generatePhotoGuidance(null, "drink")
 * // → "Eye level, natural bright, condensation or garnish visible, bar background softly blurred"
 * ```
 */
export function generatePhotoGuidance(
  cuisineContext: string | null,
  contentType: string
): string {
  // Get base template from cuisine (or default)
  const baseTemplate = cuisineContext && CUISINE_PHOTO_TEMPLATES[cuisineContext]
    ? CUISINE_PHOTO_TEMPLATES[cuisineContext]
    : CUISINE_PHOTO_TEMPLATES['default']

  // Apply content-type specific adjustments
  const adjustment = CONTENT_TYPE_ADJUSTMENTS[contentType] || {}
  const template = { ...baseTemplate, ...adjustment }

  // Format as single string (target: 80-120 chars)
  return `${template.angle}, ${template.lighting}, ${template.context}`
}

/**
 * Generate lightweight photo guidance for non-menu content
 * 
 * @param contentType - atmosphere, behind_scenes, drink
 * @returns Simple photo guidance without cuisine context
 * 
 * @example
 * ```typescript
 * generateNonMenuPhotoGuidance("atmosphere")
 * // → "45° room height, natural lighting, guests in natural poses, warm ambiance visible"
 * 
 * generateNonMenuPhotoGuidance("behind_scenes")
 * // → "Eye level, natural bright, authentic action in progress, kitchen tools or ingredients visible"
 * ```
 */
export function generateNonMenuPhotoGuidance(contentType: string): string {
  if (contentType === 'atmosphere') {
    return '45° room height, natural lighting, guests in natural poses, warm ambiance visible'
  }
  
  if (contentType === 'behind_scenes') {
    return 'Eye level, natural bright, authentic action in progress, kitchen tools or ingredients visible'
  }

  if (contentType === 'drink') {
    return 'Eye level, natural bright, garnish or condensation visible, bar context softly blurred'
  }

  return 'Natural angle, good lighting, subject clearly visible, context appropriate'
}

/**
 * Get all available cuisine templates (for testing/debugging)
 * 
 * @returns Array of available cuisine keys
 */
export function getAvailableCuisines(): string[] {
  return Object.keys(CUISINE_PHOTO_TEMPLATES).filter(k => k !== 'default')
}

/**
 * Validate photo guidance length (should be 80-120 chars for optimal UX)
 * 
 * @param guidance - Generated photo guidance string
 * @returns Validation result with warning if too long/short
 */
export function validateGuidanceLength(guidance: string): {
  valid: boolean
  length: number
  warning?: string
} {
  const length = guidance.length
  
  if (length < 60) {
    return {
      valid: false,
      length,
      warning: 'Too short - add more context details'
    }
  }
  
  if (length > 150) {
    return {
      valid: false,
      length,
      warning: 'Too long - simplify for quick scanning'
    }
  }
  
  return { valid: true, length }
}
