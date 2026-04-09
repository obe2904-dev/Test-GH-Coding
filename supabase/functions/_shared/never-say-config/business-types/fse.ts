/**
 * FOOD SERVICE ESTABLISHMENTS (FSE)
 * Restaurants with table service, full meals
 * Examples: Restaurants, cafés with full menus, bistros
 */

export const FSE_NEVER_SAY = [
  // Fast food language (wrong positioning)
  'hurtig',
  'takeaway first',
  'on-the-go',
  'grab and go',
  'express menu',
]

/**
 * Conditional forbidden words based on price level
 */
export const FSE_CONDITIONAL_NEVER_SAY = {
  // If price_level === 'budget' or 'moderate':
  budget_moderate: [
    'eksklusiv',
    'luksuriøs',
    'premium',
    'eksquisit',
    'haute cuisine',
    'fine dining',
  ],
  
  // If price_level === 'upscale' or 'fine_dining':
  upscale: [
    'billig',
    'rimelig',
    'budget-venlig',
    'prisbillig',
    'discount',
  ]
}
