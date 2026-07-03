/**
 * POI Analyzer - Wrapper around Google Maps APIs
 * Re-exports existing geocoding functions with consistent interface
 */

import { 
  geocodeAddress as geocode, 
  analyzePOIs as analyzePOIsRaw 
} from '../geocoding';

export interface GeocodingResult {
  coordinates: { lat: number; lng: number };
  formattedAddress: string;
  city: string;
  country: string;
  countryCode: string;
}

export interface POIAnalysisResult {
  restaurants: number;
  cafes: number;
  hotels: number;
  attractions: number;
  offices: number;
  schools_universities: number;
  residential_buildings: number;
  transit_stations: number;
  shopping_centers: number;
  parks: number;
  water_distance: number;
  landmarks: { name: string; type: string; distance: number }[];
}

/**
 * Geocode address to coordinates and location details
 */
export async function geocodeAddress(address: string): Promise<GeocodingResult> {
  return await geocode(address);
}

/**
 * Analyze POIs around coordinates
 */
export async function analyzePOIs(
  coordinates: { lat: number; lng: number },
  radiusMeters: number = 500
): Promise<POIAnalysisResult> {
  return await analyzePOIsRaw(coordinates, radiusMeters);
}
