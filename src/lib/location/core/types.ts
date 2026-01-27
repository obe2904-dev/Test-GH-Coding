/**
 * Core location intelligence types - language agnostic
 * 
 * This is the new i18n-ready type system.
 * For backward compatibility, import from src/types/location.ts
 */

export type LocationCategoryId = 
  | 'city_centre'
  | 'residential'
  | 'tourist'
  | 'office'
  | 'transport_hub'
  | 'student'
  | 'waterfront'
  | 'shopping_district'
  | 'mixed_use'
  | 'destination';

export type SupportedLocale = 'da-DK' | 'en-US' | 'sv-SE' | 'no-NO' | 'de-DE' | 'es-ES';

export type CountryCode = 'DK' | 'US' | 'SE' | 'NO' | 'DE' | 'ES';

/**
 * Localized category content - what users see
 */
export interface LocalizedCategoryContent {
  name: string;
  icon: string;
  definition: string;
  whyItMatters: string[];
  ctaShifts: string[];
  seasonalNotes?: string;
}

/**
 * Complete category definition with localized content
 */
export interface LocationCategory {
  id: LocationCategoryId;
  content: LocalizedCategoryContent;
}

/**
 * Analysis signal - structured data
 */
export interface AnalysisSignal {
  type: string;
  name: string;
  distance?: number; // meters
  weight: number;
  metadata?: Record<string, any>;
}

/**
 * Category match result
 */
export interface CategoryMatch {
  categoryId: LocationCategoryId;
  score: number;
  confidence: 'low' | 'medium' | 'high';
  reasoning: string[];
  signals: AnalysisSignal[];
}

/**
 * Complete location analysis
 */
export interface LocationAnalysis {
  address: string;
  coordinates: { lat: number; lng: number };
  country: CountryCode;
  city: string;
  locale: SupportedLocale;
  matches: CategoryMatch[];
  primaryCategory: LocationCategoryId;
  analyzedAt: string;
  dataSource?: 'google_maps' | 'openstreetmap';
  culturalContext?: CulturalContext;
}

/**
 * Cultural context for a specific location
 */
export interface CulturalContext {
  significance: 'low' | 'medium' | 'high' | 'very_high';
  description: string;
  knownFor: string[];
  seasonality?: string;
  historicalNote?: string;
}

/**
 * Known location (e.g., waterfront street)
 */
export interface KnownLocation {
  identifier: string; // street name, area name, etc.
  score: number;
  description: string;
  culturalContext?: CulturalContext;
}

/**
 * Locale configuration
 */
export interface LocaleConfig {
  locale: SupportedLocale;
  country: CountryCode;
  language: string;
  categories: Record<LocationCategoryId, LocalizedCategoryContent>;
  knownLocations: Record<string, KnownLocation[]>; // city -> locations
  keywords: LocationKeywords;
  culturalKnowledge: Record<string, CulturalContext>; // location key -> context
  timePatterns: TimePatterns;
  aiPrompts: AIPrompts;
}

/**
 * Location detection keywords
 */
export interface LocationKeywords {
  waterfront: string[];
  cityCenter: string[];
  residential: string[];
  tourist: string[];
  // ... etc
}

/**
 * Time-of-day demand patterns (from earlier discussion)
 */
export interface TimePatterns {
  weekday: Record<string, DemandBlock>;
  weekend: Record<string, DemandBlock>;
  seasonalModifiers: Record<string, SeasonModifier>;
}

export interface DemandBlock {
  timeBlock: string;
  demandLevel: 'low' | 'medium' | 'high' | 'peak';
  primaryBehaviors: string[];
  keyProducts: string[];
  optimalPostTime: string;
  messagingFocus: string[];
  appliesTo: string[];
  culturalNote?: string;
}

export interface SeasonModifier {
  months: number[];
  demandMultiplier: number;
  messagingShift: string[];
  locationBoosts?: Record<LocationCategoryId, number>;
}

/**
 * AI analysis prompts
 */
export interface AIPrompts {
  locationAnalysis: string;
  waterfrontDetection: string;
  culturalContext: string;
  businessTypeInference: string;
}

/**
 * What gets stored in Brand Profile
 */
export interface LocationProfile {
  address: string;
  coordinates: { lat: number; lng: number };
  primaryCategory: LocationCategoryId;
  secondaryCategories: LocationCategoryId[];
  categoryScores: Record<LocationCategoryId, number>;
  contentStrategy: {
    peakDemandTimes: string[];
    targetAudience: string[];
    recommendedCTAs: string[];
    competitionLevel: 'low' | 'medium' | 'high';
  };
  lastAnalyzed: string;
}
