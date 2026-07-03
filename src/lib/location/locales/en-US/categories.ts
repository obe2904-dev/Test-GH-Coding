import { LocationCategoryId, LocalizedCategoryContent } from '../../core/types';

export const CATEGORIES_EN: Record<LocationCategoryId, LocalizedCategoryContent> = {
  city_centre: {
    name: 'City Centre',
    icon: '🏛️',
    definition: 'Central streets with dense retail, nightlife, and high foot traffic. Mix of locals, tourists, and shoppers.',
    whyItMatters: [
      'Later evening demand',
      'Strong walk-in traffic',
      'Competitive environment — clarity wins',
      'Higher marketing noise'
    ],
    ctaShifts: [
      'Walk-ins welcome',
      'Last tables tonight',
      'Drop by',
      'Book now'
    ],
    seasonalNotes: 'Year-round traffic with summer peak for outdoor seating'
  },

  residential: {
    name: 'Residential Area',
    icon: '🏘️',
    definition: 'Surrounded by housing with limited retail/nightlife. Locals dominate the customer base.',
    whyItMatters: [
      'Strong morning & weekend demand',
      'Family-oriented clientele',
      'Loyalty > impulse buying',
      'Local reputation is critical'
    ],
    ctaShifts: [
      'Your local spot',
      'Bring the family',
      'Easy weeknight dinner',
      'We know you'
    ],
    seasonalNotes: 'Consistent year-round, slight summer dip (holidays)'
  },

  tourist: {
    name: 'Tourist Area',
    icon: '📸',
    definition: 'Near landmarks, attractions, or cruise terminals. Seasonal traffic surges with high share of non-locals.',
    whyItMatters: [
      'Daytime + summer peaks',
      'Walk-ins dominate',
      'Low long-term loyalty',
      'Multi-language considerations'
    ],
    ctaShifts: [
      'Near [landmark]',
      'Walk-ins welcome',
      'Authentic local experience',
      'Perfect after sightseeing'
    ],
    seasonalNotes: 'Extreme summer peak (May–Sep), winter dip'
  },

  office: {
    name: 'Office / Business District',
    icon: '🏢',
    definition: 'Office buildings dominate. Weekday-only traffic, quiet evenings and weekends.',
    whyItMatters: [
      'Lunch is king (11:30–13:30)',
      'Speed > atmosphere',
      'Predictable demand patterns',
      'Pre-order opportunities'
    ],
    ctaShifts: [
      "Today's lunch",
      'Ready in 10 min',
      'Order ahead',
      'Fast delivery'
    ],
    seasonalNotes: 'Dead during holidays, consistent weekday pattern'
  },

  transport_hub: {
    name: 'Transport Hub',
    icon: '🚉',
    definition: 'Train/metro/bus stations with continuous foot traffic. Short dwell time, high throughput.',
    whyItMatters: [
      'Morning & afternoon rush spikes',
      'Grab-and-go behaviour',
      'Impulse decisions',
      'Speed is critical'
    ],
    ctaShifts: [
      'Take it with you',
      'Ready now',
      'On the go?',
      'Quick takeaway'
    ],
    seasonalNotes: 'Consistent commuter traffic, tourist boost in summer'
  },

  student: {
    name: 'Student / University Area',
    icon: '🎓',
    definition: 'Near universities or colleges. Young demographic with evening and weekday activity.',
    whyItMatters: [
      'Price-sensitive audience',
      'Group behaviour common',
      'Event-driven demand',
      'Friday-bar culture'
    ],
    ctaShifts: [
      'Student discount',
      'Share with friends',
      'Quiz / event tonight',
      'Budget-friendly'
    ],
    seasonalNotes: 'Dead during summer/Christmas holidays, peak during semester'
  },

  waterfront: {
    name: 'Waterfront',
    icon: '🌊',
    definition: 'Close to water (harbour, sea, lake, or river). High weather sensitivity, destination-based visits.',
    whyItMatters: [
      'Weekend & afternoon peaks',
      'Summer-heavy demand',
      'Walk-ins dominate',
      'Outdoor seating is premium'
    ],
    ctaShifts: [
      'Sit in the sun',
      'Out by the water',
      'Enjoy the view',
      'Drop by'
    ],
    seasonalNotes: 'Extreme summer focus, winter challenges'
  },

  nature_park: {
    name: 'Park / Nature Area',
    icon: '🌳',
    definition: 'Near parks, forests, or green spaces. Attracts walkers, dog owners, cyclists, and families doing outdoor activities.',
    whyItMatters: [
      'Seeking warmth and shelter',
      'Family outings and dog walks',
      'Seasonal peaks (spring/summer)',
      'Takeaway and outdoor seating are key factors'
    ],
    ctaShifts: [
      'Perfect after your walk',
      'Dogs welcome',
      'Family-friendly',
      'Coffee and cake to-go'
    ],
    seasonalNotes: 'Summer peak, quiet in winter'
  },

  shopping_district: {
    name: 'Shopping District',
    icon: '🛍️',
    definition: 'Retail-heavy area with high daytime traffic. Shoppers looking for a break.',
    whyItMatters: [
      'Lunch + afternoon coffee peaks',
      'Impulse buyers',
      'Rest-stop mentality',
      'Weekend traffic'
    ],
    ctaShifts: [
      'Shopping break?',
      'Take a break',
      'Relax',
      'In the middle of shopping'
    ],
    seasonalNotes: 'December peak (Christmas), summer moderate'
  },

  mixed_use: {
    name: 'Mixed Use / Urban Development',
    icon: '🏙️',
    definition: 'New developments combining residential, office, and retail. Varied demographics.',
    whyItMatters: [
      'Varied demand patterns',
      'Younger demographics',
      'Flexible positioning needed',
      'Growing area potential'
    ],
    ctaShifts: [
      'For everyone',
      'Flexible menu',
      'Morning to evening',
      'Your new local spot'
    ],
    seasonalNotes: 'Balanced year-round'
  },

  destination: {
    name: 'Destination / Drive-to Area',
    icon: '🚗',
    definition: 'Outside central foot-traffic zones with low walk-in flow. Customers typically arrive by car or make a deliberate trip (often due to parking, distance, or standalone location). Visits are more planned than spontaneous.',
    whyItMatters: [
      'Low walk-in traffic — marketing is critical',
      'Deliberate visits dominate',
      'Strong pre-booking potential',
      'Parking/accessibility communication is important'
    ],
    ctaShifts: [
      'Book your table',
      'Worth the drive',
      'A planned night out',
      'We have parking'
    ],
    seasonalNotes: 'Weather-dependent access, winter challenges if remote'
  }
};
