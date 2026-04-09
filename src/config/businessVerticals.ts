/**
 * Business Vertical Configuration System
 * 
 * Defines vertical-specific configurations for different business types.
 * Enables one platform to serve multiple industries with shared infrastructure
 * but vertical-specific data structures and content strategies.
 */

/**
 * Supported business verticals
 * 
 * NOTE: Platform is exclusively focused on food & beverage businesses.
 * Separate platforms will serve beauty, fitness, retail, and professional services.
 */
export type BusinessVertical = 
  // Food & Drink ONLY
  | 'cafe'
  | 'restaurant'
  | 'bar'
  | 'bakery'
  | 'food_truck'

/**
 * High-level business categories
 * 
 * NOTE: Only 'food-drink' category is supported on this platform.
 */
export type BusinessCategory = 
  | 'food-drink'

/**
 * Data schema capabilities for each vertical
 */
export interface VerticalDataSchema {
  hasMenu: boolean                    // Food menu (cafe, restaurant)
  hasServiceList: boolean             // Service offerings (salon, spa, gym)
  hasPriceList: boolean              // Price display
  hasProductCatalog: boolean         // Retail products
  hasBookingSystem: boolean          // Appointment/reservation system
  hasStaffProfiles: boolean          // Team member profiles
  hasClassSchedule: boolean          // Class/event schedule
  hasInventory: boolean              // Stock management
  requiresLicense: boolean           // Professional licensing (medical, legal)
}

/**
 * Content generation focus areas
 */
export interface VerticalContentFocus {
  primary: string[]                  // Main content pillars
  seasonal: string[]                 // Seasonal opportunities
  promotional: string[]              // Promotion types
  visualStyle: string[]              // Photo/visual emphasis
  engagementTactics: string[]        // How to drive engagement
}

/**
 * AI context priorities for prompt building
 */
export interface VerticalContextPriorities {
  internal: string[]                 // Business data to emphasize
  external: string[]                 // External triggers to use
  timeRelevance: 'high' | 'medium' | 'low'      // How time-sensitive is content
  weatherRelevance: 'high' | 'medium' | 'low'   // How weather-sensitive
  locationRelevance: 'high' | 'medium' | 'low'  // How location-specific
}

/**
 * Industry-specific terminology
 */
export interface VerticalTerminology {
  offering: string                   // What they sell/provide
  offeringPlural: string             // Plural form
  customer: string                   // How to refer to customers
  customerPlural: string             // Plural form
  location: string                   // Physical space name
  transaction: string                // Sale/booking/appointment
}

/**
 * Complete vertical configuration
 */
export interface VerticalConfig {
  id: BusinessVertical
  displayName: string
  category: BusinessCategory
  description: string
  
  dataSchema: VerticalDataSchema
  contentFocus: VerticalContentFocus
  contextPriorities: VerticalContextPriorities
  terminology: VerticalTerminology
  
  // SEO and discovery
  keywords: string[]
  
  // Onboarding hints
  setupGuide: {
    essentialData: string[]          // Must-have data for good results
    optionalData: string[]           // Nice-to-have data
    tipForNewUsers: string
  }
}

/**
 * ========================================
 * FOOD & DRINK VERTICALS
 * ========================================
 */

export const CAFE_CONFIG: VerticalConfig = {
  id: 'cafe',
  displayName: 'Cafe',
  category: 'food-drink',
  description: 'Coffee shops, cafes, and coffee houses',
  
  dataSchema: {
    hasMenu: true,
    hasServiceList: false,
    hasPriceList: true,
    hasProductCatalog: false,
    hasBookingSystem: false,
    hasStaffProfiles: false,
    hasClassSchedule: false,
    hasInventory: false,
    requiresLicense: false,
  },
  
  contentFocus: {
    primary: ['daily-specials', 'coffee-culture', 'atmosphere', 'food-photos', 'customer-experience'],
    seasonal: ['iced-drinks-summer', 'cozy-winter-drinks', 'pumpkin-spice-fall', 'outdoor-seating', 'holiday-treats'],
    promotional: ['happy-hour', 'loyalty-cards', 'new-menu-items', 'combo-deals', 'breakfast-specials'],
    visualStyle: ['overhead-shots', 'latte-art', 'cozy-ambiance', 'lifestyle', 'flat-lays'],
    engagementTactics: ['polls-favorite-drink', 'caption-this-coffee', 'share-your-spot', 'trivia-coffee-facts'],
  },
  
  contextPriorities: {
    internal: ['menu', 'vibe', 'location', 'opening-hours', 'specialty-drinks'],
    external: ['weather', 'time-of-day', 'nearby-transit', 'local-events', 'holidays'],
    timeRelevance: 'high',
    weatherRelevance: 'high',
    locationRelevance: 'high',
  },
  
  terminology: {
    offering: 'menu item',
    offeringPlural: 'menu items',
    customer: 'guest',
    customerPlural: 'guests',
    location: 'cafe',
    transaction: 'order',
  },
  
  keywords: ['cafe', 'coffee shop', 'coffee', 'espresso', 'latte', 'pastries', 'breakfast', 'brunch'],
  
  setupGuide: {
    essentialData: ['Menu with drinks and food', 'Opening hours', 'Location/address', 'Atmosphere description'],
    optionalData: ['Daily specials', 'Barista bios', 'Coffee origin stories', 'Seating capacity'],
    tipForNewUsers: 'Upload your menu as a PDF and add 5-10 photos showing your space, drinks, and food. Weather and time-of-day context work great for cafes!',
  },
}

export const RESTAURANT_CONFIG: VerticalConfig = {
  id: 'restaurant',
  displayName: 'Restaurant',
  category: 'food-drink',
  description: 'Full-service restaurants and dining establishments',
  
  dataSchema: {
    hasMenu: true,
    hasServiceList: false,
    hasPriceList: true,
    hasProductCatalog: false,
    hasBookingSystem: true,
    hasStaffProfiles: true, // Chef, sommelier
    hasClassSchedule: false,
    hasInventory: false,
    requiresLicense: false,
  },
  
  contentFocus: {
    primary: ['chef-specials', 'seasonal-menu', 'wine-pairing', 'dining-experience', 'ingredients'],
    seasonal: ['spring-vegetables', 'summer-grill', 'harvest-menu', 'holiday-reservations', 'valentines-dinner'],
    promotional: ['tasting-menu', 'wine-nights', 'chef-table', 'private-events', 'early-bird'],
    visualStyle: ['plated-dishes', 'chef-action', 'wine-glasses', 'ambiance', 'table-settings'],
    engagementTactics: ['reserve-now-cta', 'share-food-pics', 'tag-dinner-companion', 'vote-next-special'],
  },
  
  contextPriorities: {
    internal: ['menu', 'chef', 'cuisine-type', 'ambiance', 'reservations'],
    external: ['holidays', 'local-events', 'weather', 'special-occasions'],
    timeRelevance: 'high',
    weatherRelevance: 'medium',
    locationRelevance: 'high',
  },
  
  terminology: {
    offering: 'dish',
    offeringPlural: 'dishes',
    customer: 'diner',
    customerPlural: 'diners',
    location: 'restaurant',
    transaction: 'reservation',
  },
  
  keywords: ['restaurant', 'dining', 'cuisine', 'chef', 'menu', 'fine dining', 'reservations'],
  
  setupGuide: {
    essentialData: ['Full menu', 'Chef info', 'Cuisine type', 'Reservation system', 'Dress code (if any)'],
    optionalData: ['Wine list', 'Seasonal ingredients sources', 'Private dining options'],
    tipForNewUsers: 'Showcase your chef\'s expertise and signature dishes. Holiday and event-based content performs well.',
  },
}

/**
 * ========================================
 * VERTICAL CONFIGURATIONS REGISTRY
 * ========================================
 * 
 * Platform exclusively serves food & beverage businesses.
 * All verticals map to either CAFE_CONFIG or RESTAURANT_CONFIG.
 */

export const VERTICAL_CONFIGS: Record<BusinessVertical, VerticalConfig> = {
  cafe: CAFE_CONFIG,
  restaurant: RESTAURANT_CONFIG,
  bar: CAFE_CONFIG, // Similar to cafe for now
  bakery: CAFE_CONFIG, // Similar to cafe for now
  food_truck: RESTAURANT_CONFIG, // Similar to restaurant for now
}

/**
 * Get vertical configuration by ID
 */
export function getVerticalConfig(vertical: string): VerticalConfig {
  return VERTICAL_CONFIGS[vertical as BusinessVertical] || CAFE_CONFIG
}

/**
 * Get all verticals in a category
 */
export function getVerticalsByCategory(category: BusinessCategory): VerticalConfig[] {
  return Object.values(VERTICAL_CONFIGS).filter(config => config.category === category)
}

/**
 * Check if vertical has specific capability
 */
export function verticalHasCapability(
  vertical: BusinessVertical, 
  capability: keyof VerticalDataSchema
): boolean {
  const config = VERTICAL_CONFIGS[vertical]
  return config?.dataSchema[capability] || false
}
