/**
 * Danish Locations Database
 * 
 * Known locations in Denmark with geographic coordinates for distance calculation.
 * Used to verify supplier locations mentioned in menu items.
 */

export interface Location {
  lat: number;
  lng: number;
  name: string;
  region?: string;
}

/**
 * Major Danish cities and known supplier locations
 * Coordinates from OpenStreetMap / Google Maps
 */
export const DANISH_LOCATIONS: Record<string, Location> = {
  // Major Cities
  "Aarhus": { lat: 56.1629, lng: 10.2039, name: "Aarhus", region: "Midtjylland" },
  "Copenhagen": { lat: 55.6761, lng: 12.5683, name: "Copenhagen", region: "Hovedstaden" },
  "København": { lat: 55.6761, lng: 12.5683, name: "København", region: "Hovedstaden" },
  "Odense": { lat: 55.4038, lng: 10.4024, name: "Odense", region: "Syddanmark" },
  "Aalborg": { lat: 57.0488, lng: 9.9217, name: "Aalborg", region: "Nordjylland" },
  "Esbjerg": { lat: 55.4760, lng: 8.4510, name: "Esbjerg", region: "Syddanmark" },
  
  // Known Supplier Locations (from Café Faust menu)
  "Højer": { lat: 54.9561, lng: 8.6667, name: "Højer", region: "Syddanmark" },
  "Tange": { lat: 56.3500, lng: 9.5833, name: "Tange", region: "Midtjylland" },
  "Tange Sø": { lat: 56.3500, lng: 9.5833, name: "Tange Sø", region: "Midtjylland" },
  
  // Common Food Supplier Regions
  "Thise": { lat: 56.6833, lng: 9.2667, name: "Thise", region: "Midtjylland" },
  "Bornholm": { lat: 55.1333, lng: 14.9167, name: "Bornholm", region: "Hovedstaden" },
  "Fanø": { lat: 55.4333, lng: 8.4167, name: "Fanø", region: "Syddanmark" },
  "Hjørring": { lat: 57.4644, lng: 9.9821, name: "Hjørring", region: "Nordjylland" },
  "Randers": { lat: 56.4607, lng: 10.0369, name: "Randers", region: "Midtjylland" },
  "Silkeborg": { lat: 56.1697, lng: 9.5453, name: "Silkeborg", region: "Midtjylland" },
  "Horsens": { lat: 55.8607, lng: 9.8500, name: "Horsens", region: "Midtjylland" },
  "Vejle": { lat: 55.7112, lng: 9.5357, name: "Vejle", region: "Syddanmark" },
  "Fredericia": { lat: 55.5659, lng: 9.7524, name: "Fredericia", region: "Syddanmark" },
  "Kolding": { lat: 55.4904, lng: 9.4721, name: "Kolding", region: "Syddanmark" },
  "Ribe": { lat: 55.3280, lng: 8.7617, name: "Ribe", region: "Syddanmark" },
  "Skagen": { lat: 57.7208, lng: 10.5839, name: "Skagen", region: "Nordjylland" },
  "Roskilde": { lat: 55.6415, lng: 12.0803, name: "Roskilde", region: "Sjælland" },
  "Holstebro": { lat: 56.3600, lng: 8.6167, name: "Holstebro", region: "Midtjylland" },
  "Viborg": { lat: 56.4533, lng: 9.4022, name: "Viborg", region: "Midtjylland" },
  "Herning": { lat: 56.1364, lng: 8.9754, name: "Herning", region: "Midtjylland" },
  "Ringkøbing": { lat: 56.0889, lng: 8.2444, name: "Ringkøbing", region: "Midtjylland" },
};

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance); // Round to nearest km
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Find location by name (case-insensitive, handles variations)
 */
export function findLocation(name: string): Location | null {
  // Normalize name
  const normalized = name.trim();
  
  // Direct match
  if (DANISH_LOCATIONS[normalized]) {
    return DANISH_LOCATIONS[normalized];
  }
  
  // Case-insensitive search
  const lowerName = normalized.toLowerCase();
  for (const [key, location] of Object.entries(DANISH_LOCATIONS)) {
    if (key.toLowerCase() === lowerName) {
      return location;
    }
  }
  
  return null;
}

/**
 * Determine geographic scope based on distance
 */
export function getGeographicScope(distanceKm: number): "local" | "regional" | "national" {
  if (distanceKm < 30) return "local";
  if (distanceKm < 100) return "regional";
  return "national";
}

/**
 * Extract location names from text using common patterns
 * Examples:
 *   - "Sausages from Højer" -> ["Højer"]
 *   - "Danish cheese from Tange Sø" -> ["Tange Sø"]
 *   - "ost fra Thise" -> ["Thise"]
 */
export function extractLocationMentions(text: string): string[] {
  const patterns = [
    /from\s+([A-ZÆØÅ][a-zæøå]+(?:\s+[A-ZÆØÅ][a-zæøå]+)?)/gi,  // "from Højer", "from Tange Sø"
    /fra\s+([A-ZÆØÅ][a-zæøå]+(?:\s+[A-ZÆØÅ][a-zæøå]+)?)/gi,  // "fra Thise", "fra Tange"
  ];
  
  const mentions: string[] = [];
  
  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        mentions.push(match[1].trim());
      }
    }
  }
  
  return [...new Set(mentions)]; // Remove duplicates
}
