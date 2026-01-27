/**
 * Context Triggers
 * 
 * Handles dynamic external data lookups triggered by business context.
 * Examples: address → nearby transit, location → weather, season → seasonal menu items
 */

import type { UserTier } from '../config/features'

/**
 * Trigger definition
 */
export interface ContextTrigger {
  id: string
  name: string
  triggerField: string // Field that activates this trigger (e.g., 'address', 'location')
  requiredTier: UserTier | 'all'
  action: (value: any, context?: any) => Promise<any>
  cacheKey: (value: any) => string
  cacheTTL: number // Seconds
  rateLimitPerDay?: number // API call limit per day
}

/**
 * Weather API integration (OpenWeatherMap)
 * DISABLED: Weather should be fetched through backend Edge Functions only
 * See: supabase/functions/ai-generate-v2/data-sources/weather.ts
 */
async function fetchWeatherData(city: string): Promise<any | null> {
  // Frontend direct weather API calls disabled
  // Weather data is now handled by backend Edge Functions
  console.log('⚠️ Frontend weather fetch disabled - use backend Edge Functions')
  return null
}

/**
 * Helper: Determine weather mood for content generation
 */
function getWeatherMood(condition: string, temp: number): string {
  const conditionLower = condition.toLowerCase()
  
  if (conditionLower.includes('rain')) return 'rainy and cozy'
  if (conditionLower.includes('snow')) return 'snowy and magical'
  if (conditionLower.includes('clear') && temp > 20) return 'sunny and warm'
  if (conditionLower.includes('clear') && temp <= 20) return 'crisp and clear'
  if (conditionLower.includes('cloud')) return 'grey and contemplative'
  if (conditionLower.includes('storm')) return 'stormy and dramatic'
  
  return 'pleasant'
}

/**
 * Transit API integration (Google Places Nearby Search)
 */
async function fetchNearbyTransit(address: string): Promise<any | null> {
  try {
    const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY
    
    if (!apiKey) {
      console.warn('Google Places API key not configured')
      return null
    }

    // First, geocode the address to get coordinates
    const geocodeResponse = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
    )

    if (!geocodeResponse.ok) {
      console.error('Geocoding API error:', geocodeResponse.status)
      return null
    }

    const geocodeData = await geocodeResponse.json()
    
    if (!geocodeData.results || geocodeData.results.length === 0) {
      console.warn('No geocoding results for address:', address)
      return null
    }

    const location = geocodeData.results[0].geometry.location
    
    // Search for nearby transit stations
    const placesResponse = await fetch(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?` +
      `location=${location.lat},${location.lng}&` +
      `radius=500&` + // 500 meters
      `type=transit_station&` +
      `key=${apiKey}`
    )

    if (!placesResponse.ok) {
      console.error('Places API error:', placesResponse.status)
      return null
    }

    const placesData = await placesResponse.json()

    if (!placesData.results || placesData.results.length === 0) {
      return { hasNearbyTransit: false, stations: [] }
    }

    // Calculate walking distance and format results
    const stations = placesData.results.slice(0, 3).map((place: any) => {
      const distance = calculateDistance(
        location.lat,
        location.lng,
        place.geometry.location.lat,
        place.geometry.location.lng
      )
      
      return {
        name: place.name,
        distance: Math.round(distance),
        walkingTime: Math.ceil(distance / 80), // Assume 80m/min walking speed
        types: place.types,
      }
    })

    return {
      hasNearbyTransit: true,
      stations,
      closest: stations[0],
    }
  } catch (error) {
    console.error('Error fetching transit data:', error)
    return null
  }
}

/**
 * Helper: Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3 // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lon2 - lon1) * Math.PI / 180

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c // Distance in meters
}

/**
 * Seasonal menu items trigger
 */
async function fetchSeasonalItems(season: string, menuData: any): Promise<any | null> {
  // This is a simple filter, no external API needed
  if (!menuData?.categories) return null

  const seasonalKeywords: Record<string, string[]> = {
    spring: ['asparagus', 'peas', 'lamb', 'strawberry', 'rhubarb'],
    summer: ['tomato', 'cucumber', 'melon', 'berry', 'salad', 'bbq', 'grilled'],
    autumn: ['pumpkin', 'squash', 'mushroom', 'apple', 'pear', 'cinnamon'],
    winter: ['root vegetable', 'stew', 'hot', 'warm', 'chocolate', 'soup'],
  }

  const keywords = seasonalKeywords[season.toLowerCase()] || []
  const seasonalItems: any[] = []

  menuData.categories?.forEach((category: any) => {
    category.items?.forEach((item: any) => {
      const text = `${item.name} ${item.description}`.toLowerCase()
      if (keywords.some(keyword => text.includes(keyword))) {
        seasonalItems.push({
          name: item.name,
          category: category.name,
          description: item.description,
        })
      }
    })
  })

  return seasonalItems.length > 0 ? seasonalItems : null
}

/**
 * All available triggers
 */
export const CONTEXT_TRIGGERS: Record<string, ContextTrigger> = {
  'weather': {
    id: 'weather',
    name: 'Weather Lookup',
    triggerField: 'city',
    requiredTier: 'premium',
    action: fetchWeatherData,
    cacheKey: (city: string) => `weather:${city.toLowerCase()}`,
    cacheTTL: 3600, // 1 hour
    rateLimitPerDay: 100, // 100 calls per day for free tier of OpenWeather
  },

  'nearby-transit': {
    id: 'nearby-transit',
    name: 'Nearby Transit Lookup',
    triggerField: 'address',
    requiredTier: 'standardplus',
    action: fetchNearbyTransit,
    cacheKey: (address: string) => `transit:${address.toLowerCase().replace(/\s+/g, '-')}`,
    cacheTTL: 86400, // 24 hours
    rateLimitPerDay: 50, // Conservative limit for Google Places API
  },

  'seasonal-items': {
    id: 'seasonal-items',
    name: 'Seasonal Menu Items',
    triggerField: 'season',
    requiredTier: 'all',
    action: async (season: string, context: any) => {
      return fetchSeasonalItems(season, context?.business?.menu)
    },
    cacheKey: (season: string) => `seasonal:${season}`,
    cacheTTL: 604800, // 7 days
  },
}

/**
 * Execute a trigger if conditions are met
 */
export async function executeTrigger(
  triggerId: string,
  value: any,
  userTier: UserTier,
  context?: any
): Promise<any | null> {
  const trigger = CONTEXT_TRIGGERS[triggerId]
  
  if (!trigger) {
    console.warn('Unknown trigger:', triggerId)
    return null
  }

  // Check tier requirement
  if (trigger.requiredTier !== 'all') {
    const tierOrder = ['free', 'standardplus', 'premium']
    const userTierIndex = tierOrder.indexOf(userTier)
    const requiredTierIndex = tierOrder.indexOf(trigger.requiredTier)
    
    if (userTierIndex < requiredTierIndex) {
      console.log(`Trigger ${triggerId} requires ${trigger.requiredTier} tier, user is ${userTier}`)
      return null
    }
  }

  try {
    return await trigger.action(value, context)
  } catch (error) {
    console.error(`Error executing trigger ${triggerId}:`, error)
    return null
  }
}

/**
 * Check if trigger should fire based on available data
 */
export function shouldTrigger(triggerId: string, context: any): boolean {
  const trigger = CONTEXT_TRIGGERS[triggerId]
  
  if (!trigger) return false

  // Check if trigger field exists in context
  if (trigger.triggerField === 'city') {
    return !!context.business?.city
  }
  
  if (trigger.triggerField === 'address') {
    return !!context.business?.address
  }
  
  if (trigger.triggerField === 'season') {
    return !!context.externalStatic?.season
  }

  return false
}
