/**
 * Google Maps API Service
 * Handles all interactions with Google Maps APIs
 */

interface GeocodeResult {
  latitude: number;
  longitude: number;
  formatted_address: string;
  neighborhood?: string;
  postal_code?: string;
  city?: string;
  place_id?: string;
}

interface NearbyPlace {
  name: string;
  type: string;
  distance_meters: number;
  walking_minutes: number;
  rating?: number;
  user_ratings_total?: number;
  place_id?: string;
}

interface CompetitiveVenue {
  place_id: string;
  name: string;
  distance_meters: number;
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
}

export interface CompDetails {
  place_id: string;
  name: string;
  types: string[];
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  opening_hours?: {
    weekday_text?: string[];
    periods?: any[];
  };
  reviews?: Array<{
    text: string;
    rating: number;
    author_name: string;
  }>;
  distance_meters: number;
}

export class GoogleMapsService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Geocode an address to get coordinates and location details
   */
  async geocodeAddress(address: string): Promise<GeocodeResult> {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${this.apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      throw new Error(`Geocoding failed: ${data.status}`);
    }

    const result = data.results[0];
    const location = result.geometry.location;

    // Extract neighborhood and postal code from address components
    let neighborhood: string | undefined;
    let postal_code: string | undefined;
    let city: string | undefined;

    for (const component of result.address_components) {
      if (component.types.includes('sublocality') || component.types.includes('neighborhood')) {
        neighborhood = component.long_name;
      }
      if (component.types.includes('postal_code')) {
        postal_code = component.long_name;
      }
      if (component.types.includes('locality')) {
        city = component.long_name;
      }
    }

    return {
      latitude: location.lat,
      longitude: location.lng,
      formatted_address: result.formatted_address,
      neighborhood,
      postal_code,
      city,
      place_id: result.place_id,
    };
  }

  /**
   * Find nearby landmarks and points of interest using Places API (New)
   * Falls back to old API if new API fails
   */
  async findNearbyPlaces(latitude: number, longitude: number, radius: number = 1500): Promise<NearbyPlace[]> {
    // Try new Places API first
    try {
      return await this.findNearbyPlacesNew(latitude, longitude, radius);
    } catch (error) {
      console.warn('⚠️ Places API (New) failed, falling back to old API:', error);
      return await this.findNearbyPlacesOld(latitude, longitude, radius);
    }
  }

  /**
   * Places API (New) - More efficient single request
   */
  private async findNearbyPlacesNew(latitude: number, longitude: number, radius: number): Promise<NearbyPlace[]> {
    console.log('🔍 Calling Places API (New) with:', { latitude, longitude, radius });
    
    const url = `https://places.googleapis.com/v1/places:searchNearby`;
    
    const includedTypes = [
      'tourist_attraction',
      'museum', 
      'art_gallery',
      'performing_arts_theater',
      'movie_theater',
      'restaurant',
      'cafe',
      'bar',
      'night_club',
      'park',
      'department_store',
      'shopping_mall',
      'book_store',
      'university',
      'library',
      'subway_station',
      'train_station',
      'transit_station',
      'bus_station',
      'hotel',
      'lodging'
    ];

    const requestBody = {
      includedTypes: includedTypes,
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: {
            latitude: latitude,
            longitude: longitude
          },
          radius: radius
        }
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': 'places.displayName,places.types,places.location,places.rating,places.userRatingCount,places.id'
      },
      body: JSON.stringify(requestBody)
    });

    console.log('📥 Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Places API (New) error:', errorText);
      throw new Error(`Places API (New) returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Places API (New) returned:', data.places?.length || 0, 'places');

    if (!data.places) {
      return [];
    }

    const places: NearbyPlace[] = data.places.map((place: any) => {
      const placeLocation = place.location;
      const distance = this.calculateDistance(
        latitude,
        longitude,
        placeLocation.latitude,
        placeLocation.longitude
      );

      const primaryType = place.types?.[0] || 'point_of_interest';

      return {
        name: place.displayName?.text || 'Unknown',
        type: primaryType,
        distance_meters: Math.round(distance),
        walking_minutes: Math.round(distance / 80),
        rating: place.rating || undefined,
        user_ratings_total: place.userRatingCount || undefined,
        place_id: place.id || undefined
      };
    });

    return places.sort((a, b) => a.distance_meters - b.distance_meters);
  }

  /**
   * Places API (Old) - Fallback for compatibility
   */
  private async findNearbyPlacesOld(latitude: number, longitude: number, radius: number): Promise<NearbyPlace[]> {
    console.log('🔄 Using old Places API as fallback');
    
    const relevantTypes = [
      'tourist_attraction',
      'museum',
      'art_gallery',
      'performing_arts_theater',
      'movie_theater',
      'restaurant',
      'cafe',
      'bar',
      'night_club',
      'park',
      'department_store',
      'shopping_mall',
      'book_store',
      'university',
      'library',
      'subway_station',
      'train_station',
      'hotel',
      'lodging'
    ];

    const places: NearbyPlace[] = [];

    for (const type of relevantTypes) {
      try {
        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=${radius}&type=${type}&key=${this.apiKey}`;
        
        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'OK' && data.results) {
          for (const place of data.results.slice(0, 3)) {
            const placeLocation = place.geometry.location;
            const distance = this.calculateDistance(
              latitude,
              longitude,
              placeLocation.lat,
              placeLocation.lng
            );

            places.push({
              name: place.name,
              type: type,
              distance_meters: Math.round(distance),
              walking_minutes: Math.round(distance / 80),
              rating: place.rating || undefined,
              user_ratings_total: place.user_ratings_total || undefined,
              place_id: place.place_id || undefined,
            });
          }
        }
      } catch (error) {
        console.warn(`Failed to fetch ${type} places:`, error);
      }
    }

    const deduplicated = this.deduplicatePlaces(places);
    return deduplicated.sort((a, b) => a.distance_meters - b.distance_meters);
  }

  /**
   * Find comparable/competitor venues near a location
   */
  async findComparableVenues(
    latitude: number,
    longitude: number,
    businessType: string,
    radius: number = 500
  ): Promise<CompetitiveVenue[]> {
    console.log(`🔍 Searching for comparable venues: type="${businessType}", radius=${radius}m`);
    
    // Map business types to search queries
    const typeToQuery: Record<string, string[]> = {
      'cafe': ['cafés', 'coffee shops'],
      'café': ['cafés', 'coffee shops'],
      'restaurant': ['restaurants', 'dining'],
      'bar': ['bars', 'wine bars'],
      'bakery': ['bakeries', 'bagerier'],
      'bistro': ['bistros', 'restaurants'],
      'fast_food': ['takeaway', 'fast food'],
    };

    const queries = typeToQuery[businessType.toLowerCase()] || [businessType];
    console.log(`📋 Using search queries: ${queries.join(', ')}`);
    
    const venues = new Map<string, CompetitiveVenue>();

    for (const query of queries) {
      try {
        // Use Text Search API for better semantic matching
        const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${latitude},${longitude}&radius=${radius}&key=${this.apiKey}`;
        
        const response = await fetch(url);
        const data = await response.json();

        console.log(`  Query "${query}": status=${data.status}, results=${data.results?.length || 0}`);

        if (data.status === 'OK' && data.results) {
          for (const place of data.results) {
            // Skip if already seen
            if (venues.has(place.place_id)) continue;

            // Calculate distance
            const placeLocation = place.geometry.location;
            const distance = this.calculateDistance(
              latitude,
              longitude,
              placeLocation.lat,
              placeLocation.lng
            );

            // Only include if within radius and has minimum quality signals
            if (
              distance <= radius &&
              place.rating >= 3.5 &&
              place.user_ratings_total >= 10
            ) {
              venues.set(place.place_id, {
                place_id: place.place_id,
                name: place.name,
                distance_meters: Math.round(distance),
                rating: place.rating,
                user_ratings_total: place.user_ratings_total,
                price_level: place.price_level,
              });
              console.log(`    ✓ Added: ${place.name} (${Math.round(distance)}m, ${place.rating}★, ${place.user_ratings_total} reviews)`);
            } else {
              console.log(`    ✗ Filtered: ${place.name} (distance=${Math.round(distance)}m, rating=${place.rating}, reviews=${place.user_ratings_total})`);
            }
          }
        } else {
          console.warn(`  Query "${query}" returned status: ${data.status}`);
        }
      } catch (error) {
        console.warn(`Failed to search for ${query}:`, error);
      }
    }

    // Return top 6 closest venues (will be trimmed further in caller)
    const sortedVenues = Array.from(venues.values())
      .sort((a, b) => a.distance_meters - b.distance_meters)
      .slice(0, 6);
    
    console.log(`✅ Found ${sortedVenues.length} comparable venues after filtering`);
    return sortedVenues;
  }

  /**
   * Get detailed information for a place.
   * Only requests Basic + Contact tier fields (name, types, opening_hours).
   * Rating, price_level, and user_ratings_total are carried in from the
   * Text Search result to avoid triggering the Atmosphere Data billing SKU.
   */
  async getPlaceDetails(
    placeId: string,
    distanceMeters: number = 0,
    preloaded?: { rating?: number; user_ratings_total?: number; price_level?: number }
  ): Promise<CompDetails | null> {
    // Basic + Contact fields only — avoids Atmosphere Data SKU (reviews, price_level, rating)
    const fields = ['place_id', 'name', 'types', 'opening_hours'].join(',');

    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${this.apiKey}`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK' || !data.result) {
        console.warn(`Place details not found for ${placeId}:`, data.status);
        return null;
      }

      const place = data.result;

      return {
        place_id: place.place_id,
        name: place.name,
        types: place.types || [],
        // Use pre-loaded values from Text Search (no extra Atmosphere charge)
        rating: preloaded?.rating,
        user_ratings_total: preloaded?.user_ratings_total,
        price_level: preloaded?.price_level,
        opening_hours: place.opening_hours ? {
          weekday_text: place.opening_hours.weekday_text,
          periods: place.opening_hours.periods
        } : undefined,
        reviews: [], // Reviews removed — were sole driver of Atmosphere Data cost
        distance_meters: distanceMeters
      };
    } catch (error) {
      console.error(`Error fetching details for ${placeId}:`, error);
      return null;
    }
  }

  /**
   * Get reviews for a specific place
   */
  async getPlaceReviews(placeId: string): Promise<Array<{ text: string; rating: number; author: string }>> {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews&key=${this.apiKey}`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK' || !data.result?.reviews) {
        console.warn('No reviews found for place:', placeId);
        return [];
      }

      // Return top 10 most recent reviews for better pattern detection
      return data.result.reviews.slice(0, 10).map((review: any) => ({
        text: review.text,
        rating: review.rating,
        author: review.author_name
      }));
    } catch (error) {
      console.error('Error fetching place reviews:', error);
      return [];
    }
  }

  /**
   * Remove duplicate places (same name, close proximity)
   */
  private deduplicatePlaces(places: NearbyPlace[]): NearbyPlace[] {
    const seen = new Map<string, NearbyPlace>();
    
    for (const place of places) {
      const key = place.name.toLowerCase().trim();
      
      if (!seen.has(key)) {
        seen.set(key, place);
      } else {
        // Keep the one with more reviews (higher prominence)
        const existing = seen.get(key)!;
        if ((place.user_ratings_total || 0) > (existing.user_ratings_total || 0)) {
          seen.set(key, place);
        }
      }
    }
    
    return Array.from(seen.values());
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}
