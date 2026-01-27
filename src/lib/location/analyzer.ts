/**
 * Main Location Analyzer
 * Orchestrates geocoding, POI analysis, and category scoring
 */

import { geocodeAddress, analyzePOIs } from './geocoding';
import { scoreLocation } from './scoring';
import { LocationAnalysis, LocationProfile, LocationCategoryId, CategoryMatch } from '@/types/location';

export async function analyzeLocation(address: string): Promise<LocationAnalysis> {
  // Step 1: Geocode the address
  const geocodingResult = await geocodeAddress(address);
  
  // Step 2: Analyze POIs around the location
  const poiData = await analyzePOIs(geocodingResult.coordinates);
  
  // Step 3: Score against all categories
  const matches = scoreLocation(poiData, address);
  
  // Step 4: Determine primary category
  const primaryCategory = matches[0].categoryId;
  
  return {
    address: geocodingResult.formattedAddress,
    coordinates: geocodingResult.coordinates,
    country: geocodingResult.country,
    city: geocodingResult.city,
    matches,
    primaryCategory,
    analyzedAt: new Date().toISOString(),
    dataSource: 'google_maps'
  };
}

export function generateLocationProfile(analysis: LocationAnalysis): LocationProfile {
  const topMatches = analysis.matches.filter(m => m.score > 30).slice(0, 3);
  const primaryMatch = topMatches[0];
  const secondaryCategories = topMatches.slice(1).map(m => m.categoryId);
  
  // Generate content strategy based on categories
  const contentStrategy = deriveContentStrategy(topMatches);
  
  return {
    address: analysis.address,
    coordinates: analysis.coordinates,
    primaryCategory: analysis.primaryCategory,
    secondaryCategories,
    categoryScores: Object.fromEntries(
      analysis.matches.map(m => [m.categoryId, m.score])
    ) as Record<LocationCategoryId, number>,
    contentStrategy,
    lastAnalyzed: analysis.analyzedAt
  };
}

function deriveContentStrategy(matches: CategoryMatch[]) {
  const primary = matches[0];
  
  // This maps categories to content strategies
  const strategies: Record<string, any> = {
    city_centre: {
      peakDemandTimes: ['lunch_12-14', 'evening_18-21', 'night_21-24'],
      targetAudience: ['locals', 'tourists', 'shoppers', 'nightlife'],
      recommendedCTAs: ['Walk-ins velkommen', 'Book nu', 'Sidste borde'],
      competitionLevel: 'high' as const
    },
    residential: {
      peakDemandTimes: ['morning_7-10', 'evening_17-20', 'weekend_all_day'],
      targetAudience: ['families', 'local_regulars', 'neighbors'],
      recommendedCTAs: ['Dit lokale sted', 'Tag familien med', 'Nem aftensmad'],
      competitionLevel: 'medium' as const
    },
    tourist: {
      peakDemandTimes: ['lunch_11-15', 'afternoon_15-18', 'summer_all_day'],
      targetAudience: ['tourists', 'international_visitors', 'day_trippers'],
      recommendedCTAs: ['Tæt på seværdigheder', 'Authentic experience', 'Walk-ins velkommen'],
      competitionLevel: 'high' as const
    },
    office: {
      peakDemandTimes: ['morning_7-9', 'lunch_11:30-13:30', 'afternoon_coffee_14-16'],
      targetAudience: ['office_workers', 'business_meetings', 'corporate_catering'],
      recommendedCTAs: ['Dagens frokost', 'Klar på 10 min', 'Bestil på forhånd'],
      competitionLevel: 'medium' as const
    },
    transport_hub: {
      peakDemandTimes: ['morning_7-9', 'afternoon_16-18', 'all_day_continuous'],
      targetAudience: ['commuters', 'travelers', 'on_the_go'],
      recommendedCTAs: ['Tag med', 'Klar nu', 'Hurtig takeaway'],
      competitionLevel: 'high' as const
    },
    student: {
      peakDemandTimes: ['lunch_12-15', 'evening_18-22', 'friday_afternoon_15-24'],
      targetAudience: ['students', 'young_adults', 'groups'],
      recommendedCTAs: ['Studierabat', 'Del med venner', 'Event i aften'],
      competitionLevel: 'medium' as const
    },
    waterfront: {
      peakDemandTimes: ['afternoon_14-18', 'evening_18-21', 'summer_all_day'],
      targetAudience: ['leisure_seekers', 'tourists', 'weekend_visitors'],
      recommendedCTAs: ['Sid i solen', 'Nyd udsigten', 'Perfekt efter gåturen'],
      competitionLevel: 'medium' as const
    },
    shopping_district: {
      peakDemandTimes: ['lunch_12-14', 'afternoon_coffee_14-17', 'weekend_11-18'],
      targetAudience: ['shoppers', 'families', 'break_seekers'],
      recommendedCTAs: ['Shopping pause?', 'Tag en break', 'Slap af'],
      competitionLevel: 'high' as const
    },
    mixed_use: {
      peakDemandTimes: ['varied'],
      targetAudience: ['mixed', 'local_residents', 'office_workers'],
      recommendedCTAs: ['For alle', 'Morgen til aften', 'Fleksibel'],
      competitionLevel: 'medium' as const
    }
  };
  
  return strategies[primary.categoryId] || strategies.city_centre;
}
