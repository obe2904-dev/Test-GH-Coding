/**
 * Location Category Definitions
 * 9 universal location types for business positioning
 */

import type { LocationCategory, LocationCategoryId } from '../../types/location';

export const LOCATION_CATEGORIES: Record<LocationCategoryId, LocationCategory> = {
  city_centre: {
    id: 'city_centre',
    name: 'City Centre',
    icon: '🏛️',
    definition: 'Central streets with dense retail, nightlife, and high pedestrian flow. Mix of locals, tourists, and shoppers.',
    whyItMatters: [
      'Later evening demand',
      'Strong walk-in traffic',
      'Competitive environment - clarity wins',
      'Higher marketing noise'
    ],
    ctaShifts: [
      'Walk-ins velkommen',
      'Sidste borde i aften',
      'Kig forbi',
      'Book nu'
    ],
    seasonalNotes: 'Year-round traffic, summer peak for outdoor seating'
  },
  
  residential: {
    id: 'residential',
    name: 'Residential Area',
    icon: '🏘️',
    definition: 'Surrounded by housing with limited retail/nightlife. Locals dominate customer base.',
    whyItMatters: [
      'Strong mornings & weekends',
      'Family-oriented clientele',
      'Loyalty > impulse visits',
      'Community reputation critical'
    ],
    ctaShifts: [
      'Dit lokale sted',
      'Tag familien med',
      'Nem aftensmad',
      'Vi kender dig'
    ],
    seasonalNotes: 'Consistent year-round, slight summer dip (vacations)'
  },
  
  tourist: {
    id: 'tourist',
    name: 'Tourist Area',
    icon: '📸',
    definition: 'Near landmarks, attractions, or cruise terminals. Seasonal traffic spikes with high share of non-locals.',
    whyItMatters: [
      'Daytime + summer peaks',
      'Walk-ins dominate',
      'Low long-term loyalty',
      'Multi-language considerations'
    ],
    ctaShifts: [
      'Tæt på [landmark]',
      'Walk-ins velkommen',
      'Authentic local experience',
      'Perfect after sightseeing'
    ],
    seasonalNotes: 'Extreme summer peak (May-Sep), winter drop-off'
  },
  
  office: {
    id: 'office',
    name: 'Office / Business District',
    icon: '🏢',
    definition: 'Office buildings dominate. Weekday-only traffic, quiet evenings and weekends.',
    whyItMatters: [
      'Lunch is king (11:30-13:30)',
      'Speed > atmosphere',
      'Predictable demand patterns',
      'Pre-order opportunities'
    ],
    ctaShifts: [
      'Dagens frokost',
      'Klar på 10 min',
      'Bestil på forhånd',
      'Hurtig levering'
    ],
    seasonalNotes: 'Dead during holidays, consistent weekday pattern'
  },
  
  transport_hub: {
    id: 'transport_hub',
    name: 'Transport Hub',
    icon: '🚉',
    definition: 'Train/metro/bus stations with continuous foot traffic. Short dwell time, high throughput.',
    whyItMatters: [
      'Morning & afternoon spikes',
      'Grab-and-go behavior',
      'Impulse decisions',
      'Speed is critical'
    ],
    ctaShifts: [
      'Tag med',
      'Klar nu',
      'På farten?',
      'Hurtig takeaway'
    ],
    seasonalNotes: 'Consistent commuter traffic, tourist boost in summer'
  },
  
  student: {
    id: 'student',
    name: 'Student / Educational Area',
    icon: '🎓',
    definition: 'Near universities or colleges. Young demographic with evening and weekday activity.',
    whyItMatters: [
      'Price-sensitive audience',
      'Group behavior common',
      'Event-driven demand',
      'Friday bar culture'
    ],
    ctaShifts: [
      'Studierabat',
      'Del med venner',
      'Quiz / event i aften',
      'Budget-venlig'
    ],
    seasonalNotes: 'Dead during summer/Christmas breaks, peaks during semester'
  },
  
  waterfront: {
    id: 'waterfront',
    name: 'Waterfront / Leisure',
    icon: '🌊',
    definition: 'Close to water, parks, or promenades. High weather sensitivity, destination-based visits.',
    whyItMatters: [
      'Weekend & afternoon peaks',
      'Summer-heavy demand',
      'Walk-ins dominate',
      'Outdoor seating premium'
    ],
    ctaShifts: [
      'Sid i solen',
      'Perfekt efter gåturen',
      'Nyd udsigten',
      'Kig forbi'
    ],
    seasonalNotes: 'Extreme summer focus, winter challenges'
  },
  
  shopping_district: {
    id: 'shopping_district',
    name: 'Shopping District',
    icon: '🛍️',
    definition: 'Retail-heavy area with high daytime foot traffic. Shoppers looking for breaks.',
    whyItMatters: [
      'Lunch + afternoon coffee peaks',
      'Impulse buyers',
      'Rest stop mentality',
      'Weekend traffic'
    ],
    ctaShifts: [
      'Shopping pause?',
      'Tag en break',
      'Slap af',
      'Midt i shoppingen'
    ],
    seasonalNotes: 'December peak (Christmas), summer moderate'
  },
  
  mixed_use: {
    id: 'mixed_use',
    name: 'Mixed-Use / Modern Development',
    icon: '🏙️',
    definition: 'New areas combining residential, office, and retail. Diverse demographic.',
    whyItMatters: [
      'Varied demand patterns',
      'Younger demographic',
      'Flexible positioning needed',
      'Growing area potential'
    ],
    ctaShifts: [
      'For alle',
      'Fleksibel menu',
      'Morgen til aften',
      'Dit nye lokale sted'
    ],
    seasonalNotes: 'Balanced year-round'
  },
  
  destination: {
    id: 'destination',
    name: 'Destination / Drive-To Area',
    icon: '🚗',
    definition: 'Outside central foot-traffic zones with low walk-in flow. Customers typically arrive by car or make a deliberate trip (often due to parking, distance, or a standalone location). Visits are more planned than spontaneous.',
    whyItMatters: [
      'Low walk-in traffic - marketing critical',
      'Intentional visits dominate',
      'Strong pre-booking potential',
      'Parking/accessibility messaging important'
    ],
    ctaShifts: [
      'Book dit bord',
      'Værd at køre efter',
      'Planlagt aften ud',
      'Vi har parkering'
    ],
    seasonalNotes: 'Weather-dependent access, winter challenges if remote'
  }
};

/**
 * Get category by ID
 */
export function getCategoryById(id: LocationCategoryId): LocationCategory {
  return LOCATION_CATEGORIES[id];
}

/**
 * Get all categories as array
 */
export function getAllCategories(): LocationCategory[] {
  return Object.values(LOCATION_CATEGORIES);
}

/**
 * Get category name with icon
 */
export function getCategoryLabel(id: LocationCategoryId): string {
  const category = LOCATION_CATEGORIES[id];
  return `${category.icon} ${category.name}`;
}
