/**
 * MENU SCORING ENGINE (Layer 5 Component A)
 * 
 * Scores menu items for "post-worthiness" based on:
 * - Seasonal ingredients (0-50 points)
 * - Weather matching (0-40 points)
 * - Location amplification (0-35 points)
 * - Performance history (0-60 points)
 * - Newness (0-45 points)
 * - Recency penalty (-100 to 0 points)
 * 
 * Base scores:
 * - Signature dish: 100
 * - Seasonal special: 75
 * - Limited time offer: 85
 * - Regular menu item: 50
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// =====================================================
// TYPES
// =====================================================

export interface MenuItemMetadata {
  itemName: string
  itemCategory?: string
  itemSection?: string
  isSignature: boolean
  isSeasonal: boolean
  isLimitedTime: boolean
  dishTempCategory?: 'cold' | 'hot' | 'warm' | 'neutral'
  itemAddedDate: Date
  lastPostedDate?: Date
  locationTags: string[]
  seasonalIngredients: string[]
  totalTimesPosted: number
  avgEngagementRate: number
}

export interface MenuScoringContext {
  businessId: string
  season: 'spring' | 'summer' | 'autumn' | 'winter'
  currentMonth: number // 1-12
  weatherForecast: {
    avgTemp: number // Average of next 3 days
    condition: string // 'sunny', 'rainy', 'cloudy', etc.
  }
  locationScores: Record<string, number> // e.g., { waterfront: 85, tourist_area: 60 }
  businessAvgEngagement: number
  countryCode: string // 'DK', 'US', etc.
}

export interface MenuItemScore {
  itemId: string
  itemName: string
  itemCategory: string
  description?: string           // Menu item description from structured_data
  price?: string                 // Menu item price
  finalScore: number
  scoreBreakdown: {
    baseScore: number
    seasonalBonus: number
    weatherBonus: number
    locationBonus: number
    performanceBonus: number
    recencyPenalty: number
  }
  confidence: number
  selectionReason: string
  postFrequencyRecommendation: string
  visualSuggestions: string[]
  contentHooks: string[]
  // ✨ Service period fields (inherited from parent menu record)
  service_periods?: string[]     // Array of applicable service periods: brunch, lunch, dinner
  service_period_name?: string   // Primary service period name
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Infer dish temperature category from name and description
 */
function inferTempCategory(name: string, description: string): 'cold' | 'hot' | 'warm' | 'neutral' {
  const text = `${name} ${description}`.toLowerCase()
  
  // Cold dishes
  if (text.match(/salat|salad|smørrebrød|carpaccio|tartare|is(?!\w)|ice cream|sorbet/)) return 'cold'
  if (text.match(/røget.*laks|smoked.*salmon/)) return 'cold'
  
  // Hot dishes
  if (text.match(/gryde|stew|steg|roast|bøf|steak|frikadeller|schnitzel|grill|pasta|suppe|soup|risotto/)) return 'hot'
  
  // Warm dishes
  if (text.match(/tærte|tart|quiche|pai|pie|sandwich|burger|panini|toast/)) return 'warm'
  
  return 'neutral'
}

function inferIsSignature(name: string, category: string): boolean {
  const text = name.toLowerCase()
  // Classic Danish café signature dishes
  return text.match(/smørrebrød|frikadeller|stjerneskud|pariserbøf|flæskesteg|wienerschnitzel|sol over gudhjem/) !== null
}

function inferIsSeasonal(name: string, description: string): boolean {
  const text = `${name} ${description}`.toLowerCase()
  // Spring/Summer/Fall/Winter seasonal indicators
  return text.match(/asparges|asparagus|nye kartofler|new potato|lam|lamb|jordbær|strawberry|tomat|tomato|svampe|mushroom|græskar|squash|vildtpat|game|grønkål|kale|gryde|stew|rodfrugter|root vegetable/) !== null
}

function inferSeasonalIngredients(name: string, description: string): string[] {
  const text = `${name} ${description}`.toLowerCase()
  const ingredients: string[] = []
  
  if (text.match(/laks|salmon/)) ingredients.push('salmon')
  if (text.match(/bøf|beef/)) ingredients.push('beef')
  if (text.match(/kylling|chicken/)) ingredients.push('chicken')
  if (text.match(/svin|pork/)) ingredients.push('pork')
  if (text.match(/rejer|shrimp/)) ingredients.push('shrimp')
  if (text.match(/asparges|asparagus/)) ingredients.push('asparagus')
  if (text.match(/svampe|mushroom/)) ingredients.push('mushrooms')
  if (text.match(/tomat|tomato/)) ingredients.push('tomatoes')
  
  return ingredients
}

function inferLocationTags(name: string, category: string): string[] {
  const nameText = name.toLowerCase()
  const categoryText = category.toLowerCase()
  
  if (nameText.match(/smørrebrød/)) return ['danish_classic', 'photogenic', 'local_specialty']
  if (nameText.match(/frikadeller/)) return ['danish_classic', 'comfort_food']
  if (nameText.match(/stjerneskud/)) return ['photogenic', 'signature', 'seafood']
  if (nameText.match(/pariserbøf/)) return ['classic', 'comfort_food']
  if (categoryText.includes('drink')) return ['beverage']
  if (categoryText.includes('dessert')) return ['photogenic', 'sweet']
  
  return ['standard']
}

// =====================================================
// MAIN SCORING FUNCTION
// =====================================================

/**
 * Score all menu items for a business
 * @param context - Scoring context with season, weather, location
 * @param postSlotTime - Optional time (HH:MM) to filter menu items by availability
 */
export async function scoreMenuItems(
  context: MenuScoringContext,
  postSlotTime?: string
): Promise<MenuItemScore[]> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  
  if (!supabaseUrl || !supabaseKey) {
    console.warn('[MenuScorer] Missing Supabase credentials, returning empty scores')
    return []
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey)
  
  if (!supabase) {
    console.error('[MenuScorer] Failed to create Supabase client')
    return []
  }
  
  // Get all menu items with metadata
  const { data: menuResults, error } = await supabase
    .from('menu_results_v2')
    .select('*')
    .eq('business_id', context.businessId)
  
  if (error) {
    console.error('[MenuScorer] Failed to fetch menu items:', error)
    return []
  }
  
  if (!menuResults || menuResults.length === 0) {
    console.log('[MenuScorer] No menu records found in menu_results_v2')
  }
  
  // ✨ NEW HYBRID APPROACH: Query normalized table first (fast, indexed)
  // Fallback to JSON parsing if normalized table is empty (backward compatible)
  const { data: normalizedItems, error: normalizedError } = await supabase
    .from('menu_items_normalized')
    .select('*')
    .eq('business_id', context.businessId)
    .neq('category_type', 'kids_menu') // ✅ Exclude børnemenu items
    .order('is_signature', { ascending: false })
    .order('total_times_posted', { ascending: false })
  
  if (normalizedError) {
    console.error('[MenuScorer] Error querying normalized items:', normalizedError)
  }
  
  // Use normalized items if available, otherwise fall back to JSON parsing
  const menuItems: any[] = []
  let menuPeriods: any[] = []
  
  if (normalizedItems && normalizedItems.length > 0) {
    console.log(`[MenuScorer] ✅ Using normalized table: ${normalizedItems.length} items (excluding kids menu)`)
    
    // Convert normalized items to scoring format
    for (const item of normalizedItems) {
      menuItems.push({
        name: item.item_name,
        description: item.item_description || '',
        price: item.item_price,
        category: item.category_name,
        categoryTimeRange: null, // Not stored in normalized (use service_periods instead)
        business_id: item.business_id,
        service_periods: item.service_periods || [],
        service_period_name: item.service_period_name,
        // ✨ NEW: Metadata available directly
        is_signature: item.is_signature,
        is_seasonal: item.is_seasonal,
        dish_temp_category: item.dish_temp_category,
        seasonal_ingredients: item.seasonal_ingredients || [],
        location_tags: item.location_tags || [],
        total_times_posted: item.total_times_posted || 0,
        avg_engagement_rate: item.avg_engagement_rate || 0,
        last_posted_date: item.last_posted_date,
      })
    }
  } else {
    // FALLBACK: Parse JSON from menu_results_v2 (legacy path)
    console.log('[MenuScorer] ⚠️ Normalized table empty, falling back to JSON parsing')
    
    for (const result of menuResults) {
      if (result.structured_data) {
        try {
          const parsed = typeof result.structured_data === 'string' 
            ? JSON.parse(result.structured_data) 
            : result.structured_data
          
          // Store menuPeriods for time filtering
          if (parsed.menuPeriods && Array.isArray(parsed.menuPeriods)) {
            menuPeriods = parsed.menuPeriods
            console.log(`[MenuScorer] Found ${menuPeriods.length} menu periods with timing`)
          }
          
          // Get service periods from parent menu record
          const menuServicePeriods = result.service_periods || []
          const menuServicePeriodName = result.service_period_name || 'all_day'
          
          // Extract items from all categories
          if (parsed.categories && Array.isArray(parsed.categories)) {
            for (const category of parsed.categories) {
              if (category.items && Array.isArray(category.items)) {
                // ✅ Skip børnemenu categories in fallback too
                const categoryLower = category.name.toLowerCase()
                if (categoryLower.includes('børnemenu') || categoryLower.includes('kids')) {
                  console.log(`[MenuScorer] Skipping kids menu category: ${category.name}`)
                  continue
                }
                
                for (const item of category.items) {
                  menuItems.push({
                    name: item.name,
                    description: item.description || '',
                    price: item.price,
                    category: category.name,
                    categoryTimeRange: category.timeRange || null,
                    business_id: context.businessId,
                    service_periods: menuServicePeriods,
                    service_period_name: menuServicePeriodName,
                  })
                }
              }
            }
          }
        } catch (e) {
          console.error('[MenuScorer] Failed to parse structured_data:', e)
        }
      }
    }
  }
  
  // TIME-BASED FILTERING: Filter items by post slot time if provided
  let filteredItems = menuItems
  if (postSlotTime && menuPeriods.length > 0) {
    const postHour = parseInt(postSlotTime.split(':')[0])
    const postMinutes = parseInt(postSlotTime.split(':')[1] || '0')
    const postTimeMinutes = postHour * 60 + postMinutes
    
    console.log(`[MenuScorer] ⏰ Filtering menu items for post time: ${postSlotTime} (${postHour}:${String(postMinutes).padStart(2, '0')})`)
    
    // Find active menu periods at this time
    const activePeriods = menuPeriods.filter(period => {
      const startParts = period.startTime.split(':')
      const endParts = period.endTime.split(':')
      const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1] || '0')
      const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1] || '0')
      
      // Handle overnight periods (e.g., 22:00-02:00)
      if (endMinutes < startMinutes) {
        return postTimeMinutes >= startMinutes || postTimeMinutes < endMinutes
      }
      
      return postTimeMinutes >= startMinutes && postTimeMinutes < endMinutes
    })
    
    if (activePeriods.length > 0) {
      const activePeriodNames = activePeriods.map(p => p.name)
      console.log(`[MenuScorer]   ✅ Active periods: ${activePeriodNames.join(', ')}`)
      
      // Filter items: keep if category matches an active period OR has no time restriction
      filteredItems = menuItems.filter(item => {
        // All-day items (no time range) are always included
        if (!item.categoryTimeRange) {
          return true
        }
        
        // Check if item's category matches any active period
        const categoryInActivePeriod = activePeriods.some(period => {
          return period.name.toLowerCase() === item.category.toLowerCase() ||
                 period.items?.includes(item.name)
        })
        
        return categoryInActivePeriod
      })
      
      console.log(`[MenuScorer]   📊 Filtered from ${menuItems.length} to ${filteredItems.length} items (removed items not available at ${postSlotTime})`)
      
      if (filteredItems.length === 0) {
        console.warn(`[MenuScorer]   ⚠️ No items available at ${postSlotTime}! Using all items as fallback.`)
        filteredItems = menuItems
      }
    } else {
      console.log(`[MenuScorer]   ⚠️ No active menu periods at ${postSlotTime}, using all items`)
    }
  } else if (postSlotTime) {
    console.log(`[MenuScorer]   ℹ️ Post time provided (${postSlotTime}) but no menuPeriods found, using all items`)
  }
  
  // Score each menu item (after time filtering)
  const scores: MenuItemScore[] = []
  
  for (const item of filteredItems) {
    // ✨ HYBRID: If item already has metadata (from normalized table), use it
    // Otherwise query menu_item_metadata table
    let metadata = null
    
    if (item.is_signature !== undefined && item.total_times_posted !== undefined) {
      // Item came from normalized table with metadata already attached
      metadata = {
        is_signature: item.is_signature,
        is_seasonal: item.is_seasonal,
        is_limited_time: item.is_limited_time || false,
        dish_temp_category: item.dish_temp_category,
        seasonal_ingredients: item.seasonal_ingredients,
        location_tags: item.location_tags,
        total_times_posted: item.total_times_posted,
        avg_engagement_rate: item.avg_engagement_rate,
        last_posted_date: item.last_posted_date,
        item_added_date: new Date().toISOString() // Default for new items
      }
      console.log(`[MenuScorer] Using metadata from normalized table for: ${item.name}`)
    } else {
      // Fallback: Query metadata table (legacy path)
      const { data: queriedMetadata } = await supabase
        .from('menu_item_metadata')
        .select('*')
        .eq('business_id', item.business_id)
        .eq('item_name', item.name)
        .maybeSingle()
      
      metadata = queriedMetadata
    }
    
    // AUTO-CREATE METADATA if missing (Bug #5 fix)
    if (!metadata) {
      const inferredMetadata = {
        business_id: item.business_id,
        item_name: item.name,
        item_category: item.category,
        item_section: 'all_day',
        is_signature: inferIsSignature(item.name, item.category),
        is_seasonal: inferIsSeasonal(item.name, item.description),
        is_limited_time: false,
        dish_temp_category: inferTempCategory(item.name, item.description),
        item_added_date: new Date().toISOString(),
        seasonal_ingredients: inferSeasonalIngredients(item.name, item.description),
        location_tags: inferLocationTags(item.name, item.category),
        total_times_posted: 0,
        avg_engagement_rate: 0,
        last_posted_date: null,
      }
      
      // Insert metadata (fire-and-forget, don't block scoring)
      supabase.from('menu_item_metadata').insert(inferredMetadata).then(({ error }) => {
        if (error) {
          console.warn(`[MenuScorer] Failed to auto-create metadata for ${item.name}:`, error.message)
        } else {
          console.log(`[MenuScorer] ✅ Auto-created metadata for ${item.name} (signature: ${inferredMetadata.is_signature}, seasonal: ${inferredMetadata.is_seasonal})`)
        }
      })
    }
    
    // Prepare item with metadata for scoring (use inferred values if metadata missing)
    const enrichedItem = {
      item_name: item.name,
      item_category: item.category,
      description: item.description || '',
      price: item.price || '',
      is_signature: metadata?.is_signature ?? inferIsSignature(item.name, item.category),
      is_seasonal: metadata?.is_seasonal ?? inferIsSeasonal(item.name, item.description),
      is_limited_time: metadata?.is_limited_time || false,
      dish_temp_category: metadata?.dish_temp_category || inferTempCategory(item.name, item.description),
      seasonal_ingredients: metadata?.seasonal_ingredients || inferSeasonalIngredients(item.name, item.description),
      location_tags: metadata?.location_tags || inferLocationTags(item.name, item.category),
      item_added_date: metadata?.item_added_date || new Date().toISOString(),
      last_posted_date: metadata?.last_posted_date || null,
      total_times_posted: metadata?.total_times_posted || 0,
      avg_engagement_rate: metadata?.avg_engagement_rate || 0,
    }
    
    // Call REAL scoring function
    const scoredItem = await scoreMenuItem(enrichedItem, context, supabase)
    
    // Convert to MenuItemScore format with preserved fields
    const score: MenuItemScore = {
      itemId: `${item.business_id}-${item.name}`,
      itemName: scoredItem.itemName,
      itemCategory: scoredItem.itemCategory,
      description: item.description || '',  // Preserve description!
      price: item.price || '',              // Preserve price!
      finalScore: scoredItem.finalScore,
      scoreBreakdown: {
        baseScore: scoredItem.baseScore,
        seasonalBonus: scoredItem.bonuses.seasonal,
        weatherBonus: scoredItem.bonuses.weather,
        locationBonus: scoredItem.bonuses.location,
        performanceBonus: scoredItem.bonuses.performance,
        recencyPenalty: scoredItem.penalties.recency,
      },
      confidence: 0.7,
      selectionReason: scoredItem.reason,
      postFrequencyRecommendation: scoredItem.postWorthiness === 'critical' ? 'immediately' :
                                     scoredItem.postWorthiness === 'high' ? 'this_week' :
                                     scoredItem.postWorthiness === 'medium' ? 'weekly' : 'monthly',
      visualSuggestions: [item.description || `Showcase ${item.name}`],
      contentHooks: [
        `Discover our ${item.name}`,
        `Try ${item.name} today`,
      ],
      // ✨ Include service period fields from menu item
      service_periods: item.service_periods,
      service_period_name: item.service_period_name,
    }
    scores.push(score)
  }
  
  // Sort by final score (descending)
  scores.sort((a, b) => b.finalScore - a.finalScore)
  
  console.log(`[MenuScorer] Scored ${scores.length} items for ${context.businessId}`)
  console.log(`  Top 3: ${scores.slice(0, 3).map(s => `${s.itemName} (${s.finalScore})`).join(', ')}`)
  
  return scores
}

/**
 * Score individual menu item
 * Returns detailed scoring breakdown
 */
async function scoreMenuItem(
  item: any,
  context: MenuScoringContext,
  supabase: any
): Promise<{
  itemName: string
  itemCategory: string
  baseScore: number
  bonuses: {
    seasonal: number
    weather: number
    location: number
    performance: number
    newness: number
  }
  penalties: {
    recency: number
  }
  finalScore: number
  postWorthiness: string
  reason: string
  details: string[]
}> {
  const details: string[] = []
  
  // 1. BASE SCORE
  let baseScore = 50 // Default regular item
  if (item.is_signature) {
    baseScore = 100
    details.push('Signature dish')
  } else if (item.is_limited_time) {
    baseScore = 85
    details.push('Limited time offer')
  } else if (item.is_seasonal) {
    baseScore = 75
    details.push('Seasonal special')
  }
  
  // 2. SEASONAL BONUS
  const seasonalBonus = await calculateSeasonalBonus(
    item.seasonal_ingredients || [],
    context.season,
    context.currentMonth,
    context.countryCode,
    supabase,
    details
  )
  
  // 3. WEATHER BONUS
  const weatherBonus = calculateWeatherBonus(
    item.dish_temp_category,
    item.item_name,
    context.weatherForecast,
    details
  )
  
  // 4. LOCATION BONUS
  const locationBonus = calculateLocationBonus(
    item.location_tags || [],
    context.locationScores,
    details
  )
  
  // 5. PERFORMANCE BONUS
  const performanceBonus = calculatePerformanceBonus(
    item.avg_engagement_rate || 0,
    context.businessAvgEngagement,
    item.total_times_posted || 0,
    details
  )
  
  // 6. NEWNESS BONUS
  const newnessBonus = calculateNewnessBonus(
    item.item_added_date ? new Date(item.item_added_date) : null,
    details
  )
  
  // 7. RECENCY PENALTY
  const recencyPenalty = calculateRecencyPenalty(
    item.last_posted_date ? new Date(item.last_posted_date) : null,
    item.item_added_date ? new Date(item.item_added_date) : null,
    details
  )
  
  // CALCULATE FINAL SCORE
  const finalScore = baseScore + seasonalBonus + weatherBonus + locationBonus + 
                     performanceBonus + newnessBonus + recencyPenalty
  
  // DETERMINE POST-WORTHINESS
  let postWorthiness: MenuItemScore['postWorthiness']
  let reason: string
  
  if (recencyPenalty === -100) {
    postWorthiness = 'blocked'
    reason = 'Posted too recently (within last 7 days)'
  } else if (finalScore >= 200) {
    postWorthiness = 'critical'
    reason = 'Exceptional opportunity - multiple strong factors align'
  } else if (finalScore >= 150) {
    postWorthiness = 'high'
    reason = 'Strong posting candidate - timely and relevant'
  } else if (finalScore >= 100) {
    postWorthiness = 'medium'
    reason = 'Solid option - good baseline appeal'
  } else if (finalScore >= 50) {
    postWorthiness = 'low'
    reason = 'Fallback option - consider if stronger options unavailable'
  } else {
    postWorthiness = 'blocked'
    reason = 'Not recommended - low relevance or recently posted'
  }
  
  return {
    itemName: item.item_name,
    itemCategory: item.item_category || 'unknown',
    baseScore,
    bonuses: {
      seasonal: seasonalBonus,
      weather: weatherBonus,
      location: locationBonus,
      performance: performanceBonus,
      newness: newnessBonus
    },
    penalties: {
      recency: recencyPenalty
    },
    finalScore,
    postWorthiness,
    reason,
    details
  }
}

// =====================================================
// SCORING COMPONENTS
// =====================================================

/**
 * Calculate seasonal bonus (0-50 points)
 */
async function calculateSeasonalBonus(
  ingredientsList: string[],
  season: string,
  currentMonth: number,
  countryCode: string,
  supabase: any,
  details: string[]
): Promise<number> {
  if (!ingredientsList || ingredientsList.length === 0) {
    return 0
  }
  
  // Query seasonal ingredients database
  const { data: seasonalData } = await supabase
    .from('seasonal_ingredients')
    .select('ingredient_name, bonus_points, peak_months')
    .eq('country_code', countryCode)
    .eq('season', season)
  
  if (!seasonalData || seasonalData.length === 0) {
    return 0
  }
  
  let totalBonus = 0
  const matchedIngredients: string[] = []
  
  for (const ingredient of ingredientsList) {
    const match = seasonalData.find(s => 
      s.ingredient_name.toLowerCase() === ingredient.toLowerCase() &&
      s.peak_months.includes(currentMonth)
    )
    
    if (match) {
      totalBonus += match.bonus_points
      matchedIngredients.push(ingredient)
    }
  }
  
  // Cap at +50
  const bonus = Math.min(totalBonus, 50)
  
  if (bonus > 0) {
    details.push(`Seasonal ingredients (${matchedIngredients.join(', ')}): +${bonus}`)
  }
  
  return bonus
}

/**
 * Calculate weather bonus (0-40 points) or penalty (-30)
 */
function calculateWeatherBonus(
  dishTemp: string | null,
  itemName: string,
  weather: { avgTemp: number; condition: string },
  details: string[]
): number {
  if (!dishTemp && !itemName) {
    return 0
  }
  
  let bonus = 0
  const temp = weather.avgTemp
  
  // Detect dish temperature from category or keywords
  const tempCategory = dishTemp || detectTempFromName(itemName)
  
  if (temp > 23) {
    // Hot weather
    if (tempCategory === 'cold') {
      bonus = 40
      details.push(`Cold dish + hot weather (${temp}°C): +40`)
    } else if (itemName.match(/ice cream|sorbet|is|smoothie|iced/i)) {
      bonus = 40
      details.push(`Frozen dessert + hot weather: +40`)
    } else if (tempCategory === 'hot') {
      bonus = -30
      details.push(`Hot dish + hot weather: -30 penalty`)
    } else if (itemName.match(/grilled|grill/i)) {
      bonus = 25
      details.push(`Grilled item + summer weather: +25`)
    }
  } else if (temp < 8) {
    // Cold weather
    if (tempCategory === 'hot') {
      bonus = 40
      details.push(`Hot dish + cold weather (${temp}°C): +40`)
    } else if (itemName.match(/stew|soup|brais|gryde|suppe/i)) {
      bonus = 40
      details.push(`Comfort food + cold weather: +40`)
    } else if (tempCategory === 'cold') {
      bonus = -10
      details.push(`Cold dish + cold weather: -10 penalty`)
    }
  } else if (temp >= 8 && temp <= 15) {
    // Cool weather
    if (itemName.match(/soup|pasta|risotto|suppe/i)) {
      bonus = 35
      details.push(`Warm comfort food + cool weather: +35`)
    }
  }
  
  if (weather.condition === 'rainy' && itemName.match(/comfort|cozy|hearty|hygge/i)) {
    bonus += 15
    details.push(`Comfort food + rainy weather: +15`)
  }
  
  return bonus
}

function detectTempFromName(name: string): 'cold' | 'hot' | 'warm' | 'neutral' {
  const nameLower = name.toLowerCase()
  
  if (nameLower.match(/cold|chilled|iced|salad|tartare|kold|is/)) {
    return 'cold'
  }
  if (nameLower.match(/hot|warm|soup|stew|brais|grill|varm|suppe|gryde/)) {
    return 'hot'
  }
  if (nameLower.match(/risotto|pasta|saut/)) {
    return 'warm'
  }
  
  return 'neutral'
}

/**
 * Calculate location bonus (0-35 points)
 */
function calculateLocationBonus(
  locationTags: string[],
  locationScores: Record<string, number>,
  details: string[]
): number {
  if (!locationTags || locationTags.length === 0) {
    return 0
  }
  
  let bonus = 0
  const matches: string[] = []
  
  // Waterfront location + seafood
  if ((locationScores.waterfront || 0) >= 70) {
    if (locationTags.includes('seafood')) {
      bonus += 35
      matches.push('seafood + waterfront')
    }
    if (locationTags.includes('fish')) {
      bonus += 30
      matches.push('fish + waterfront')
    }
  }
  
  // Tourist area + local specialty
  if ((locationScores.tourist_area || 0) >= 70) {
    if (locationTags.includes('local_specialty')) {
      bonus += 35
      matches.push('local specialty + tourist area')
    }
    if (locationTags.includes('photogenic')) {
      bonus += 30
      matches.push('photogenic + tourist area')
    }
  }
  
  // Business district + quick lunch
  if ((locationScores.business_district || 0) >= 70) {
    if (locationTags.includes('quick_lunch')) {
      bonus += 25
      matches.push('quick lunch + business district')
    }
  }
  
  // Residential + family-friendly
  if ((locationScores.residential || 0) >= 70) {
    if (locationTags.includes('family_friendly')) {
      bonus += 25
      matches.push('family-friendly + residential')
    }
    if (locationTags.includes('comfort_food')) {
      bonus += 30
      matches.push('comfort food + residential')
    }
  }
  
  if (bonus > 0) {
    details.push(`Location amplification (${matches.join(', ')}): +${bonus}`)
  }
  
  return Math.min(bonus, 35) // Cap at 35
}

/**
 * Calculate performance bonus (-40 to +60 points)
 */
function calculatePerformanceBonus(
  itemEngagement: number,
  businessAvg: number,
  timesPosted: number,
  details: string[]
): number {
  if (timesPosted === 0 || businessAvg === 0) {
    // No data yet - give small bonus (benefit of doubt)
    details.push('No performance data yet: +5')
    return 5
  }
  
  if (timesPosted < 3) {
    // Not enough data for confident assessment
    return 0
  }
  
  const percentDiff = ((itemEngagement - businessAvg) / businessAvg) * 100
  let bonus = 0
  
  if (percentDiff >= 50) {
    bonus = 60
    details.push(`Strong performer (+${percentDiff.toFixed(0)}% vs avg): +60`)
  } else if (percentDiff >= 25) {
    bonus = 40
    details.push(`Above average performer (+${percentDiff.toFixed(0)}%): +40`)
  } else if (percentDiff >= 10) {
    bonus = 20
    details.push(`Good performer (+${percentDiff.toFixed(0)}%): +20`)
  } else if (percentDiff >= -10) {
    bonus = 0
    details.push('Average performer: 0')
  } else if (percentDiff >= -25) {
    bonus = -20
    details.push(`Below average performer (${percentDiff.toFixed(0)}%): -20`)
  } else {
    bonus = -40
    details.push(`Poor performer (${percentDiff.toFixed(0)}%): -40`)
  }
  
  return bonus
}

/**
 * Calculate newness bonus (0-45 points, decaying)
 */
function calculateNewnessBonus(
  addedDate: Date | null,
  details: string[]
): number {
  if (!addedDate) {
    return 0
  }
  
  const daysSinceAdded = Math.floor(
    (Date.now() - addedDate.getTime()) / (24 * 60 * 60 * 1000)
  )
  
  let bonus = 0
  
  if (daysSinceAdded <= 7) {
    bonus = 45
    details.push(`Brand new item (${daysSinceAdded} days): +45`)
  } else if (daysSinceAdded <= 14) {
    bonus = 35
    details.push(`New item (${daysSinceAdded} days): +35`)
  } else if (daysSinceAdded <= 21) {
    bonus = 25
    details.push(`Recent addition (${daysSinceAdded} days): +25`)
  } else if (daysSinceAdded <= 30) {
    bonus = 15
    details.push(`Added recently (${daysSinceAdded} days): +15`)
  } else if (daysSinceAdded <= 60) {
    bonus = 5
    details.push(`Relatively new (${daysSinceAdded} days): +5`)
  }
  
  return bonus
}

/**
 * Calculate recency penalty (-100 to 0 points)
 */
function calculateRecencyPenalty(
  lastPostedDate: Date | null,
  addedDate: Date | null,
  details: string[]
): number {
  if (!lastPostedDate) {
    return 0 // Never posted
  }
  
  const daysSincePosted = Math.floor(
    (Date.now() - lastPostedDate.getTime()) / (24 * 60 * 60 * 1000)
  )
  
  // Exception: If brand new and hasn't been posted since being added
  if (addedDate) {
    const daysSinceAdded = Math.floor(
      (Date.now() - addedDate.getTime()) / (24 * 60 * 60 * 1000)
    )
    
    if (daysSinceAdded <= 7 && lastPostedDate < addedDate) {
      // Item added after last post date - not actually posted yet
      return 0
    }
  }
  
  let penalty = 0
  
  if (daysSincePosted <= 6) {
    penalty = -100
    details.push(`BLOCKED: Posted ${daysSincePosted} days ago (too recent)`)
  } else if (daysSincePosted <= 10) {
    penalty = -60
    details.push(`Posted ${daysSincePosted} days ago (strongly discouraged): -60`)
  } else if (daysSincePosted <= 14) {
    penalty = -30
    details.push(`Posted ${daysSincePosted} days ago (discouraged): -30`)
  } else if (daysSincePosted <= 21) {
    penalty = -10
    details.push(`Posted ${daysSincePosted} days ago (slight penalty): -10`)
  }
  
  return penalty
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Get current season from month
 */
export function getCurrentSeason(month: number): 'spring' | 'summer' | 'autumn' | 'winter' {
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter'
}

/**
 * Export for testing and external use
 */
export default {
  scoreMenuItems,
  getCurrentSeason
}
