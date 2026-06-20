/**
 * Location Enrichment Types
 * 
 * Structured location context for improving AI personalization.
 * Captures both macro (country/region/city-tier) and micro (area_type, nearby signals) context
 * without bloating prompts.
 * 
 * @version 1.0
 */

/**
 * Location enrichment data structure
 * Combines geographic coordinates, macro regional context, and micro area characteristics
 */
export type LocationEnrichment = {
  /** Optional geographic coordinates */
  geo?: {
    lat: number
    lng: number
    accuracy: "high" | "medium" | "low"
  }
  
  /** Macro location context - regional/city-level characteristics */
  macro: {
    country: string
    region?: string
    city: string
    city_tier?: "capital" | "major_city" | "mid_city" | "small_town" | "rural"
  }
  
  /** Micro location context - immediate area characteristics */
  micro: {
    area_type:
      | "tourist_zone"
      | "shopping_street"
      | "transit_hub"
      | "business_district"
      | "residential"
      | "waterfront"
      | "industrial"
      | "highway_roadside"
      | "campus"
      | "unknown"
    nearby_signals: string[] // Short labels only (e.g., "ved åen", "nær banegård", "i centrum")
    waterfront_term?: string // Specific waterfront term when area_type is "waterfront" (e.g., "ved åen", "ved fjorden", "ved søen")
    confidence: "high" | "medium" | "low"
  }
  
  /** Schema version for future compatibility */
  version: string // e.g. "1.0"
}

/**
 * Helper function to create a default LocationEnrichment object
 */
export function createDefaultLocationEnrichment(
  city: string,
  country: string = "Denmark"
): LocationEnrichment {
  return {
    macro: {
      country,
      city,
    },
    micro: {
      area_type: "unknown",
      nearby_signals: [],
      confidence: "low",
    },
    version: "1.0",
  }
}

/**
 * City tier classification helper
 * Maps city names to their tier classification
 */
export function classifyCityTier(
  city: string,
  country: string = "Denmark"
): LocationEnrichment["macro"]["city_tier"] {
  const cityLower = city.toLowerCase()
  
  if (country === "Denmark") {
    // Danish city classification
    if (cityLower === "københavn" || cityLower === "copenhagen") {
      return "capital"
    }
    if (["aarhus", "odense", "aalborg"].includes(cityLower)) {
      return "major_city"
    }
    if (["esbjerg", "randers", "kolding", "horsens", "vejle", "roskilde", "herning", "silkeborg", "næstved", "fredericia"].includes(cityLower)) {
      return "mid_city"
    }
    return "small_town"
  }
  
  // Default classification for other countries
  return undefined
}
