/**
 * Location Category Analysis Types
 * 
 * COMPATIBILITY LAYER: This file now re-exports from the new core types system
 * while maintaining backward compatibility for existing components.
 * 
 * New code should import from: src/lib/location/core/types
 * Existing code can continue using this file without changes.
 */

// Re-export core types (these are identical)
export type {
  LocationCategoryId,
  CategoryMatch,
  CountryCode,
  SupportedLocale,
  LocalizedCategoryContent,
  CulturalContext,
  KnownLocation,
  LocaleConfig,
  LocationKeywords,
  TimePatterns,
  DemandBlock,
  SeasonModifier,
  AIPrompts,
  LocationProfile,
} from '../lib/location/core/types';

// Re-export LocationAnalysis from core (now has locale field)
export type {
  LocationAnalysis,
} from '../lib/location/core/types';

// Re-export AnalysisSignal (now has optional distance)
export type {
  AnalysisSignal,
} from '../lib/location/core/types';

// Re-export LocationCategory (now has nested content structure)
export type {
  LocationCategory,
} from '../lib/location/core/types';

/**
 * LEGACY: Flat category structure (deprecated, use LocationCategory from core)
 * Kept for components that haven't migrated yet.
 */
export interface LocationCategoryLegacy {
  id: LocationCategoryId;
  name: string;
  icon: string;
  definition: string;
  whyItMatters: string[];
  ctaShifts: string[];
  seasonalNotes?: string;
}

// Import to re-export
import type { LocationCategoryId } from '../lib/location/core/types';
