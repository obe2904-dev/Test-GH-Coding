/**
 * Programme Price Analyzer
 * 
 * Calculates price positioning per programme (brunch, lunch, dinner, etc.)
 * to enable context-aware content tone calibration.
 * 
 * Example: A business with 99 DKK børnemenu + 239 DKK brunch should have
 * different price positioning for different programmes, not a single "moderate" tier.
 */

export interface NormalizedMenuItem {
  name: string
  description?: string
  price?: number | null
  category?: string
  service_periods?: string[]
}

export interface PriceStats {
  min: number | null
  max: number | null
  avg: number | null
  spread: number
  sample_count: number
}

export interface ProgrammePricePositioning {
  tier: 'budget' | 'value' | 'moderate' | 'upscale' | 'premium'
  min: number | null
  max: number | null
  avg: number | null
  spread: number
  sample_count: number
}

/**
 * Maps programme types to their corresponding service period identifiers
 */
const SERVICE_PERIOD_MAP: Record<string, string[]> = {
  breakfast: ['breakfast', 'morgenmad', 'morning'],
  brunch: ['brunch'],
  lunch: ['lunch', 'frokost', 'midday'],
  dinner: ['dinner', 'aften', 'evening', 'aftensmad'],
  bar: ['bar', 'drinks', 'cocktails', 'beverages']
}

/**
 * Filters menu items that belong to a specific programme based on service periods
 */
export function filterMenuItemsByProgramme(
  menuItems: NormalizedMenuItem[],
  programmeType: string
): NormalizedMenuItem[] {
  const relevantPeriods = SERVICE_PERIOD_MAP[programmeType.toLowerCase()] || []
  
  if (relevantPeriods.length === 0) {
    console.warn(`No service period mapping for programme type: ${programmeType}`)
    return []
  }

  return menuItems.filter(item => {
    if (!item.service_periods || item.service_periods.length === 0) {
      return false
    }
    
    // Check if any of the item's service periods match this programme
    return item.service_periods.some(sp => 
      relevantPeriods.some(rp => sp.toLowerCase().includes(rp.toLowerCase()))
    )
  })
}

/**
 * Calculates price statistics from a list of menu items
 */
export function calculatePriceStats(items: NormalizedMenuItem[]): PriceStats {
  // Extract valid prices (non-null, positive numbers)
  // Defensive: parse to number in case data is stored as string
  const prices = items
    .map(i => {
      const price = i.price
      if (price == null) return null
      // Defensive parsing: handle both number and string types
      const numPrice = typeof price === 'string' ? parseFloat(price) : price
      return numPrice > 0 ? numPrice : null
    })
    .filter((p): p is number => p != null)
  
  if (prices.length === 0) {
    return { 
      min: null, 
      max: null, 
      avg: null, 
      spread: 0,
      sample_count: 0 
    }
  }
  
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
  
  return {
    min,
    max,
    avg,
    spread: max - min,
    sample_count: prices.length
  }
}

/**
 * Determines price tier based on average price
 * Same logic as global determinePricePositioning() but extracted for reuse
 */
export function determinePricePositioning(avgPrice?: number | null): 'budget' | 'value' | 'moderate' | 'upscale' | 'premium' {
  if (!avgPrice) return 'moderate'
  
  // Danish market pricing (DKK):
  // Budget: < 100 (fast casual, quick service)
  // Value: 100-150 (casual dining, good quality-price ratio)
  // Moderate: 150-220 (mid-range restaurants, quality focus)
  // Upscale: 220-350 (fine-casual, elevated dining)
  // Premium: > 350 (fine dining, destination restaurants)
  
  if (avgPrice < 100) return 'budget'
  if (avgPrice < 150) return 'value'
  if (avgPrice < 220) return 'moderate'
  if (avgPrice < 350) return 'upscale'
  return 'premium'
}

/**
 * Analyzes price positioning for a specific programme
 * 
 * @param menuItems - All normalized menu items for the business
 * @param programmeType - Programme type (breakfast, brunch, lunch, dinner, bar)
 * @param programmeName - Human-readable programme name for logging
 * @param fallbackAvg - Global average price to use if programme has insufficient data
 * @returns Price positioning with tier and statistics
 */
export function analyzeProgrammePricing(
  menuItems: NormalizedMenuItem[],
  programmeType: string,
  programmeName: string,
  fallbackAvg?: number | null
): ProgrammePricePositioning {
  // Filter items for this programme
  const programmeItems = filterMenuItemsByProgramme(menuItems, programmeType)
  
  // Calculate price stats
  const stats = calculatePriceStats(programmeItems)
  
  // Handle low sample count or missing data
  if (stats.sample_count === 0) {
    console.warn(`[${programmeName}] No menu items with prices found - using fallback`)
    const tier = determinePricePositioning(fallbackAvg)
    return {
      tier,
      min: null,
      max: null,
      avg: fallbackAvg || null,
      spread: 0,
      sample_count: 0
    }
  }
  
  if (stats.sample_count < 3) {
    console.warn(`[${programmeName}] Low price sample count: ${stats.sample_count} items`)
  }
  
  // Determine tier
  const tier = determinePricePositioning(stats.avg)
  
  console.log(`[${programmeName}] Price positioning: ${tier} (avg: ${stats.avg} DKK, range: ${stats.min}-${stats.max} DKK, n=${stats.sample_count})`)
  
  return {
    tier,
    min: stats.min,
    max: stats.max,
    avg: stats.avg,
    spread: stats.spread,
    sample_count: stats.sample_count
  }
}

/**
 * Generates tone guidance text based on price tier
 * Used in marketing manager brief to calibrate content tone per programme
 */
export function getPriceToneGuidance(tier: 'budget' | 'value' | 'moderate' | 'upscale' | 'premium'): string {
  const guidance = {
    budget: 'tilgængelighed, værdi, daglig glæde - undgå eksklusivitet',
    value: 'kvalitet til fair pris, smart valg - balance tilgængelighed og oplevelse',
    moderate: 'kvalitetsfokus, lokal favorit - bred appel',
    upscale: 'elevated experience, forkæl dig selv - aspirational tone',
    premium: 'destination dining, eksklusivitet, særlige øjeblikke - premium language'
  }
  return guidance[tier] || guidance.moderate
}
