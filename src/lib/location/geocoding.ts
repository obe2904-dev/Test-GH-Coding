/**
 * Geocoding & POI Analysis Service
 * Uses Google Maps Places API to analyze location context
 */

interface GeocodingResult {
  coordinates: { lat: number; lng: number };
  formattedAddress: string;
  city: string;
  country: string;
  countryCode: string;
}

interface POIAnalysisResult {
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

export async function geocodeAddress(address: string): Promise<GeocodingResult> {
  // Using Google Maps Geocoding API
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    // Mock response for development if no API key
    console.warn('No Google Maps API key found, using mock data');
    return getMockGeocodingResult(address);
  }
  
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status !== 'OK' || !data.results[0]) {
      console.warn('Geocoding failed, using mock data');
      return getMockGeocodingResult(address);
    }
    
    const result = data.results[0];
    const location = result.geometry.location;
    
    // Extract city and country from address components
    const components = result.address_components;
    const city = components.find((c: any) => c.types.includes('locality'))?.long_name || '';
    const country = components.find((c: any) => c.types.includes('country'))?.long_name || '';
    const countryCode = components.find((c: any) => c.types.includes('country'))?.short_name || '';
    
    return {
      coordinates: { lat: location.lat, lng: location.lng },
      formattedAddress: result.formatted_address,
      city,
      country,
      countryCode
    };
  } catch (error) {
    console.warn('Geocoding error, using mock data:', error);
    return getMockGeocodingResult(address);
  }
}

/**
 * Mock geocoding for development/testing
 */
function getMockGeocodingResult(address: string): GeocodingResult {
  const lowerAddress = address.toLowerCase();
  
  // Åboulevarden, Aarhus
  if (lowerAddress.includes('åboulevarden') || lowerAddress.includes('aboulevarden')) {
    return {
      coordinates: { lat: 56.1572, lng: 10.2107 },
      formattedAddress: 'Åboulevarden, 8000 Aarhus C, Denmark',
      city: 'Aarhus',
      country: 'Denmark',
      countryCode: 'DK'
    };
  }
  
  // Nyhavn, Copenhagen
  if (lowerAddress.includes('nyhavn')) {
    return {
      coordinates: { lat: 55.6795, lng: 12.5912 },
      formattedAddress: 'Nyhavn, 1051 København K, Denmark',
      city: 'København',
      country: 'Denmark',
      countryCode: 'DK'
    };
  }
  
  // Default Aarhus
  return {
    coordinates: { lat: 56.1629, lng: 10.2039 },
    formattedAddress: address,
    city: address.includes('København') ? 'København' : 'Aarhus',
    country: 'Denmark',
    countryCode: 'DK'
  };
}

export async function analyzePOIs(
  coordinates: { lat: number; lng: number },
  radiusMeters: number = 500
): Promise<POIAnalysisResult> {
  // Using Google Maps Places API - Nearby Search
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    console.warn('No Google Maps API key found, using mock POI data');
    return getMockPOIData(coordinates);
  }
  
  const result: POIAnalysisResult = {
    restaurants: 0,
    cafes: 0,
    hotels: 0,
    attractions: 0,
    offices: 0,
    schools_universities: 0,
    residential_buildings: 0,
    transit_stations: 0,
    shopping_centers: 0,
    parks: 0,
    water_distance: 9999,
    landmarks: []
  };
  
  try {
  
  // Define search types and mappings
  const searchQueries = [
    { type: 'restaurant', field: 'restaurants' },
    { type: 'cafe', field: 'cafes' },
    { type: 'lodging', field: 'hotels' },
    { type: 'tourist_attraction', field: 'attractions' },
    { type: 'university', field: 'schools_universities' },
    { type: 'school', field: 'schools_universities' },
    { type: 'transit_station', field: 'transit_stations' },
    { type: 'shopping_mall', field: 'shopping_centers' },
    { type: 'park', field: 'parks' }
  ];
  
  // Execute searches
  for (const query of searchQueries) {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${coordinates.lat},${coordinates.lng}&radius=${radiusMeters}&type=${query.type}&key=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK') {
      const field = query.field as keyof POIAnalysisResult;
      if (typeof result[field] === 'number') {
        result[field] = (result[field] as number) + data.results.length;
      }
      
      // Extract landmarks (important tourist attractions)
      if (query.type === 'tourist_attraction') {
        data.results.slice(0, 5).forEach((place: any) => {
          result.landmarks.push({
            name: place.name,
            type: 'attraction',
            distance: calculateDistance(
              coordinates,
              { lat: place.geometry.location.lat, lng: place.geometry.location.lng }
            )
          });
        });
      }
    }
  }
  
  // Check distance to water (simplified - in production use more sophisticated method)
  // This would require additional API calls or datasets
  result.water_distance = await estimateWaterDistance(coordinates);
  
  return result;
  } catch (error) {
    console.log('ℹ️ POI analysis: Using estimated data (Google Maps API unavailable)');
    return getMockPOIData(coordinates);
  }
}

/**
 * Mock POI data for development/testing
 */
function getMockPOIData(coordinates: { lat: number; lng: number }): POIAnalysisResult {
  // Åboulevarden area (waterfront, high activity)
  if (Math.abs(coordinates.lat - 56.1572) < 0.01 && Math.abs(coordinates.lng - 10.2107) < 0.01) {
    return {
      restaurants: 25,
      cafes: 18,
      hotels: 3,
      attractions: 5,
      offices: 8,
      schools_universities: 0,
      residential_buildings: 12,
      transit_stations: 2,
      shopping_centers: 4,
      parks: 3,
      water_distance: 50, // Very close to Aarhus Å
      landmarks: [
        { name: 'Aarhus Å', type: 'waterway', distance: 50 },
        { name: 'ARoS Aarhus Kunstmuseum', type: 'museum', distance: 400 },
        { name: 'Musikhuset Aarhus', type: 'performing_arts', distance: 350 }
      ]
    };
  }
  
  // Nyhavn area (tourist, waterfront)
  if (Math.abs(coordinates.lat - 55.6795) < 0.01 && Math.abs(coordinates.lng - 12.5912) < 0.01) {
    return {
      restaurants: 35,
      cafes: 20,
      hotels: 12,
      attractions: 15,
      offices: 5,
      schools_universities: 0,
      residential_buildings: 8,
      transit_stations: 3,
      shopping_centers: 6,
      parks: 2,
      water_distance: 20, // Right on the harbor
      landmarks: [
        { name: 'Nyhavn', type: 'harbor', distance: 20 },
        { name: 'Det Kgl. Teater', type: 'performing_arts', distance: 300 },
        { name: 'Amalienborg', type: 'castle', distance: 500 }
      ]
    };
  }
  
  // Default city centre
  return {
    restaurants: 20,
    cafes: 12,
    hotels: 5,
    attractions: 3,
    offices: 15,
    schools_universities: 1,
    residential_buildings: 10,
    transit_stations: 2,
    shopping_centers: 5,
    parks: 2,
    water_distance: 800,
    landmarks: [
      { name: 'Byens centrum', type: 'landmark', distance: 200 }
    ]
  };
}

function calculateDistance(
  point1: { lat: number; lng: number },
  point2: { lat: number; lng: number }
): number {
  // Haversine formula
  const R = 6371000; // Earth radius in meters
  const dLat = (point2.lat - point1.lat) * Math.PI / 180;
  const dLon = (point2.lng - point1.lng) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

async function estimateWaterDistance(coordinates: { lat: number; lng: number }): Promise<number> {
  // Simplified: search for natural water features
  // In production, use more sophisticated coastline/water body datasets
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${coordinates.lat},${coordinates.lng}&radius=1000&type=natural_feature&keyword=water|harbor|marina|beach&key=${apiKey}`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.status === 'OK' && data.results.length > 0) {
    // Return distance to nearest water feature
    const nearest = data.results[0];
    return calculateDistance(
      coordinates,
      { lat: nearest.geometry.location.lat, lng: nearest.geometry.location.lng }
    );
  }
  
  return 9999; // No water nearby
}
