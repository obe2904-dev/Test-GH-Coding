/**
 * Business Vertical Configuration System
 * 
 * Defines vertical-specific configurations for different business types.
 * Enables one platform to serve multiple industries with shared infrastructure
 * but vertical-specific data structures and content strategies.
 */

/**
 * Supported business verticals
 */
export type BusinessVertical = 
  // Food & Drink
  | 'cafe'
  | 'restaurant'
  | 'bar'
  | 'bakery'
  | 'food_truck'
  
  // Beauty & Wellness
  | 'hair_salon'
  | 'barber'
  | 'nail_salon'
  | 'spa'
  | 'beauty_clinic'
  
  // Fitness & Sports
  | 'gym'
  | 'yoga_studio'
  | 'personal_trainer'
  | 'crossfit'
  
  // Retail
  | 'boutique'
  | 'gift_shop'
  | 'bookstore'
  | 'flower_shop'
  
  // Professional Services
  | 'dental_clinic'
  | 'vet_clinic'
  | 'law_firm'
  | 'accounting'

/**
 * High-level business categories
 */
export type BusinessCategory = 
  | 'food-drink'
  | 'beauty-wellness'
  | 'fitness-sports'
  | 'retail'
  | 'professional-services'

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
 * BEAUTY & WELLNESS VERTICALS
 * ========================================
 */

export const HAIR_SALON_CONFIG: VerticalConfig = {
  id: 'hair_salon',
  displayName: 'Hair Salon',
  category: 'beauty-wellness',
  description: 'Hair salons offering cuts, color, and styling services',
  
  dataSchema: {
    hasMenu: false,
    hasServiceList: true,
    hasPriceList: true,
    hasProductCatalog: true, // Retail hair products
    hasBookingSystem: true,
    hasStaffProfiles: true,
    hasClassSchedule: false,
    hasInventory: true,
    requiresLicense: true,
  },
  
  contentFocus: {
    primary: ['transformations', 'trending-styles', 'stylist-expertise', 'before-after', 'hair-care-tips'],
    seasonal: ['summer-hair-protection', 'holiday-party-hair', 'wedding-season', 'back-to-school-cuts', 'fall-color-trends'],
    promotional: ['new-client-discount', 'referral-program', 'treatment-packages', 'product-bundles'],
    visualStyle: ['before-after', 'close-up-hair', 'stylist-action', 'product-shots', 'client-smiles'],
    engagementTactics: ['tag-your-stylist', 'hair-transformation-contest', 'style-poll', 'book-now-cta'],
  },
  
  contextPriorities: {
    internal: ['services', 'stylists', 'specialties', 'booking-availability', 'products'],
    external: ['local-events', 'fashion-trends', 'weather', 'wedding-season'],
    timeRelevance: 'high',
    weatherRelevance: 'medium', // Humidity affects hair!
    locationRelevance: 'medium',
  },
  
  terminology: {
    offering: 'service',
    offeringPlural: 'services',
    customer: 'client',
    customerPlural: 'clients',
    location: 'salon',
    transaction: 'appointment',
  },
  
  keywords: ['hair salon', 'hairstylist', 'haircut', 'hair color', 'balayage', 'blowout', 'keratin'],
  
  setupGuide: {
    essentialData: ['Service list with prices', 'Stylist profiles', 'Booking link', 'Specialties'],
    optionalData: ['Retail products', 'Before/after gallery', 'Hair care tips', 'Certifications'],
    tipForNewUsers: 'Before/after photos are your best content! Make sure to get client permission. Highlight stylist specialties.',
  },
}

/**
 * ========================================
 * FITNESS VERTICALS
 * ========================================
 */

export const GYM_CONFIG: VerticalConfig = {
  id: 'gym',
  displayName: 'Gym / Fitness Center',
  category: 'fitness-sports',
  description: 'Gyms and fitness centers with equipment and classes',
  
  dataSchema: {
    hasMenu: false,
    hasServiceList: true, // Personal training, classes
    hasPriceList: true, // Membership tiers
    hasProductCatalog: false,
    hasBookingSystem: true, // Class bookings
    hasStaffProfiles: true, // Trainers
    hasClassSchedule: true,
    hasInventory: false,
    requiresLicense: false,
  },
  
  contentFocus: {
    primary: ['workout-motivation', 'class-highlights', 'member-transformations', 'trainer-tips', 'fitness-challenges'],
    seasonal: ['new-year-goals', 'summer-body', 'outdoor-workouts', 'winter-fitness'],
    promotional: ['membership-deals', 'personal-training-packages', 'bring-a-friend', 'challenges'],
    visualStyle: ['workout-action', 'transformations', 'gym-floor', 'trainer-demos', 'group-classes'],
    engagementTactics: ['tag-workout-buddy', 'share-progress', 'challenge-participation', 'book-class-cta'],
  },
  
  contextPriorities: {
    internal: ['class-schedule', 'trainers', 'equipment', 'membership-options', 'community'],
    external: ['time-of-day', 'new-year', 'weather', 'fitness-trends'],
    timeRelevance: 'high',
    weatherRelevance: 'low',
    locationRelevance: 'medium',
  },
  
  terminology: {
    offering: 'class',
    offeringPlural: 'classes',
    customer: 'member',
    customerPlural: 'members',
    location: 'gym',
    transaction: 'class booking',
  },
  
  keywords: ['gym', 'fitness', 'workout', 'personal training', 'group classes', 'strength training'],
  
  setupGuide: {
    essentialData: ['Class schedule', 'Trainer profiles', 'Membership tiers', 'Equipment list'],
    optionalData: ['Member success stories', 'Workout plans', 'Nutrition tips'],
    tipForNewUsers: 'Transformation photos (with permission) and motivational content perform best. Early morning/evening posts target peak gym times.',
  },
}

/**
 * ========================================
 * VERTICAL CONFIGURATIONS REGISTRY
 * ========================================
 */

export const VERTICAL_CONFIGS: Record<BusinessVertical, VerticalConfig> = {
  // Food & Drink
  cafe: CAFE_CONFIG,
  restaurant: RESTAURANT_CONFIG,
  bar: CAFE_CONFIG, // Similar to cafe for now
  bakery: CAFE_CONFIG, // Similar to cafe for now
  food_truck: RESTAURANT_CONFIG, // Similar to restaurant for now
  
  // Beauty & Wellness
  hair_salon: HAIR_SALON_CONFIG,
  barber: HAIR_SALON_CONFIG, // Similar to salon for now
  nail_salon: HAIR_SALON_CONFIG, // Similar to salon for now
  spa: HAIR_SALON_CONFIG, // Similar to salon for now
  beauty_clinic: HAIR_SALON_CONFIG, // Similar to salon for now
  
  // Fitness & Sports
  gym: GYM_CONFIG,
  yoga_studio: GYM_CONFIG, // Similar to gym for now
  personal_trainer: GYM_CONFIG, // Similar to gym for now
  crossfit: GYM_CONFIG, // Similar to gym for now
  
  // Retail (using cafe as template for now - to be customized)
  boutique: CAFE_CONFIG,
  gift_shop: CAFE_CONFIG,
  bookstore: CAFE_CONFIG,
  flower_shop: CAFE_CONFIG,
  
  // Professional Services (using salon as template for now - to be customized)
  dental_clinic: HAIR_SALON_CONFIG,
  vet_clinic: HAIR_SALON_CONFIG,
  law_firm: HAIR_SALON_CONFIG,
  accounting: HAIR_SALON_CONFIG,
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
