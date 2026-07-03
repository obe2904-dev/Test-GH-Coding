export const LOCATION_TOKENS = {
  WATERFRONT: 'waterfront',
  CITY_CENTRE: 'city_centre',
  SHOPPING: 'shopping_street',
  TOURIST: 'tourist_area',
  RESIDENTIAL: 'residential',
  BUSINESS_DISTRICT: 'business_district',
} as const

export type LocationToken = typeof LOCATION_TOKENS[keyof typeof LOCATION_TOKENS]

export const CUSTOMER_TOKENS = {
  FAMILIES: 'families_with_kids',
  COUPLES: 'couples',
  FRIENDS: 'friends_social_groups',
} as const

export type CustomerToken = typeof CUSTOMER_TOKENS[keyof typeof CUSTOMER_TOKENS]
