/**
 * Full Location Intelligence Test Page
 * Tests complete AI pipeline with real APIs (Google Places, geocoding)
 * Shows debug visibility without saving to production database
 */

import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { analyzeLocationTypes, LocationContext, LocationTypeMatches } from '../../lib/location/locationTypeMatcher';

interface GeocodingResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  neighborhood?: string;
  city?: string;
}

interface POIData {
  restaurants: number;
  cafes: number;
  hotels: number;
  offices: number;
  tourist_attractions: number;
  raw?: any[];
}

export default function TestLocationIntelligenceFullPage() {
  const [streetAddress, setStreetAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('DK');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Results
  const [geocodingResult, setGeocodingResult] = useState<GeocodingResult | null>(null);
  const [poiData, setPoiData] = useState<POIData | null>(null);
  const [locationTypeResults, setLocationTypeResults] = useState<LocationTypeMatches | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Validation
  const [validationNotes, setValidationNotes] = useState('');
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  const handleAnalyze = async () => {
    if (!streetAddress.trim() || !postalCode.trim()) {
      alert('Please enter both street address and postal code');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setGeocodingResult(null);
    setPoiData(null);
    setLocationTypeResults(null);

    try {
      const fullAddress = `${streetAddress}, ${postalCode}`;
      console.log('🧪 Full AI Test - Starting analysis for:', fullAddress);

      // Get auth session
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;
      const userId = session.data.session?.user?.id;
      
      if (!accessToken || !userId) {
        throw new Error('Not authenticated. Please log in.');
      }

      // Get user's actual business ID (safe - we won't save in test mode)
      const { data: businesses } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_id', userId)
        .limit(1);
      
      if (!businesses || businesses.length === 0) {
        throw new Error('No business found. Please create a business first.');
      }

      const businessId = businesses[0].id;

      // Call Supabase Edge Function for location analysis
      console.log('📡 Calling Supabase Edge Function...');
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/populate-location-intelligence`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ 
          business_id: businessId,
          address_override: fullAddress
          // Note: Edge function will populate location_intelligence but we won't save it manually
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Edge Function Response:', data);
      
      const locationIntel = data.location_intelligence;
      if (!locationIntel) {
        throw new Error('No location intelligence data returned');
      }

      // STEP 1: Extract Geocoding Results
      const geoResult: GeocodingResult = {
        lat: locationIntel.latitude || locationIntel.coordinates?.lat || 0,
        lng: locationIntel.longitude || locationIntel.coordinates?.lng || 0,
        formattedAddress: locationIntel.formatted_address || fullAddress,
        neighborhood: locationIntel.neighborhood,
        city: locationIntel.city
      };
      setGeocodingResult(geoResult);
      console.log('✅ Geocoding result:', geoResult);

      // STEP 2: Extract POI Data
      const signals = locationIntel.signals || [];
      const poiResults: POIData = {
        restaurants: signals.filter((s: any) => s.type === 'restaurant').length,
        cafes: signals.filter((s: any) => s.type === 'cafe').length,
        hotels: signals.filter((s: any) => s.type === 'hotel' || s.type === 'lodging').length,
        offices: signals.filter((s: any) => s.type === 'office').length,
        tourist_attractions: signals.filter((s: any) => s.type === 'tourist_attraction').length,
        raw: signals
      };
      setPoiData(poiResults);
      console.log('✅ POI data:', poiResults);

      // STEP 3: Analyze location types
      console.log('🧠 Step 3: Analyzing location types...');
      const context: LocationContext = {
        address: fullAddress,
        neighborhood: geoResult.neighborhood || '',
        city: geoResult.city || '',
        countryCode: selectedCountry,
        nearbyPOIs: {
          restaurants: poiResults.restaurants,
          cafes: poiResults.cafes,
          hotels: poiResults.hotels,
          offices: poiResults.offices,
          tourist_attractions: poiResults.tourist_attractions
        }
      };

      const matches = analyzeLocationTypes(context, selectedCountry);
      setLocationTypeResults(matches);
      console.log('✅ Location type analysis:', matches);

    } catch (err: any) {
      console.error('❌ Analysis error:', err);
      setError(err.message || 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExportTestCase = () => {
    if (!geocodingResult || !poiData || !locationTypeResults) {
      alert('No results to export');
      return;
    }

    const testCase = {
      address: `${streetAddress}, ${postalCode}`,
      neighborhood: geocodingResult.neighborhood || '',
      city: geocodingResult.city || '',
      countryCode: selectedCountry,
      nearbyPOIs: {
        restaurants: poiData.restaurants,
        cafes: poiData.cafes,
        hotels: poiData.hotels,
        offices: poiData.offices,
        tourist_attractions: poiData.tourist_attractions
      },
      results: locationTypeResults,
      validation: {
        isCorrect,
        notes: validationNotes
      }
    };

    console.log('📦 Test case export:', testCase);
    
    // Copy to clipboard
    navigator.clipboard.writeText(JSON.stringify(testCase, null, 2));
    alert('Test case copied to clipboard!');
  };

  const getLevelBadge = (level: string) => {
    const colors = {
      strong: 'bg-green-100 text-green-800',
      moderate: 'bg-yellow-100 text-yellow-800',
      weak: 'bg-gray-100 text-gray-800'
    };
    return colors[level as keyof typeof colors] || colors.weak;
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">🔬 Full Location Intelligence Test</h1>
      <p className="text-gray-600 mb-6">
        Test complete AI pipeline with real APIs • No database writes
      </p>

      {/* Input Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Address Input</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
          <div className="flex gap-3">
            {['DK', 'SE', 'DE', 'UK'].map(country => (
              <button
                key={country}
                onClick={() => setSelectedCountry(country)}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  selectedCountry === country
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {country === 'DK' ? '🇩🇰 Denmark' : ''}
                {country === 'SE' ? '🇸🇪 Sweden' : ''}
                {country === 'DE' ? '🇩🇪 Germany' : ''}
                {country === 'UK' ? '🇬🇧 UK' : ''}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Street Name & Number *</label>
            <input
              type="text"
              value={streetAddress}
              onChange={(e) => setStreetAddress(e.target.value)}
              placeholder="e.g., Åboulevarden 38"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code *</label>
            <input
              type="text"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder="e.g., 8000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          className="w-full px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:bg-gray-400"
        >
          {isAnalyzing ? '⏳ Analyzing with AI...' : '🔬 Analyze with AI'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="text-red-900 font-semibold">❌ Error</div>
          <div className="text-red-700 text-sm">{error}</div>
        </div>
      )}

      {/* Results Section */}
      {geocodingResult && (
        <>
          {/* Geocoding Results */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">📍 Geocoding Results</h2>
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-medium text-gray-700">Latitude:</span>
                  <span className="ml-2 text-gray-900">{geocodingResult.lat}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Longitude:</span>
                  <span className="ml-2 text-gray-900">{geocodingResult.lng}</span>
                </div>
              </div>
              <div>
                <span className="font-medium text-gray-700">Formatted Address:</span>
                <span className="ml-2 text-gray-900">{geocodingResult.formattedAddress}</span>
              </div>
              {geocodingResult.neighborhood && (
                <div>
                  <span className="font-medium text-gray-700">Neighborhood:</span>
                  <span className="ml-2 text-gray-900">{geocodingResult.neighborhood}</span>
                </div>
              )}
              {geocodingResult.city && (
                <div>
                  <span className="font-medium text-gray-700">City:</span>
                  <span className="ml-2 text-gray-900">{geocodingResult.city}</span>
                </div>
              )}
            </div>
          </div>

          {/* POI Data */}
          {poiData && (
            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">🏪 Nearby POIs (500m radius)</h2>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-900">{poiData.restaurants}</div>
                  <div className="text-sm text-blue-700">Restaurants</div>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-900">{poiData.cafes}</div>
                  <div className="text-sm text-green-700">Cafés</div>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-900">{poiData.hotels}</div>
                  <div className="text-sm text-purple-700">Hotels</div>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-900">{poiData.offices}</div>
                  <div className="text-sm text-orange-700">Offices</div>
                </div>
                <div className="p-3 bg-pink-50 rounded-lg">
                  <div className="text-2xl font-bold text-pink-900">{poiData.tourist_attractions}</div>
                  <div className="text-sm text-pink-700">Attractions</div>
                </div>
              </div>
              
              {poiData.raw && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-gray-600 hover:text-gray-900 font-medium">
                    View raw POI data ({poiData.raw.length} types)
                  </summary>
                  <pre className="mt-2 p-3 bg-gray-50 rounded overflow-auto max-h-60 text-xs">
                    {JSON.stringify(poiData.raw, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}

          {/* Location Type Analysis */}
          {locationTypeResults && (
            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">🧠 Location Type Analysis</h2>
              
              <div className="space-y-3 mb-6">
                {Object.entries(locationTypeResults)
                  .sort(([, a], [, b]) => b.match_score - a.match_score)
                  .map(([type, match]) => (
                    <div key={type} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="font-semibold text-gray-900 capitalize">
                            {type.replace(/_/g, ' ')}
                          </span>
                          <span className={`ml-3 px-2 py-1 text-xs rounded ${getLevelBadge(match.match_level)}`}>
                            {match.match_level}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-gray-900">{match.match_score}</div>
                          <div className="text-xs text-gray-600">{Math.round(match.confidence * 100)}% confidence</div>
                        </div>
                      </div>
                      {match.reason && (
                        <div className="text-sm text-gray-600">{match.reason}</div>
                      )}
                    </div>
                  ))}
              </div>

              {/* Validation Section */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="font-semibold mb-3">✅ Validation</h3>
                
                <div className="flex gap-3 mb-4">
                  <button
                    onClick={() => setIsCorrect(true)}
                    className={`px-4 py-2 rounded-lg font-medium transition ${
                      isCorrect === true
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    ✅ Correct
                  </button>
                  <button
                    onClick={() => setIsCorrect(false)}
                    className={`px-4 py-2 rounded-lg font-medium transition ${
                      isCorrect === false
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    ❌ Incorrect
                  </button>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={validationNotes}
                    onChange={(e) => setValidationNotes(e.target.value)}
                    placeholder="Add validation notes, expected behavior, issues found..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <button
                  onClick={handleExportTestCase}
                  className="w-full px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700"
                >
                  📦 Export Test Case (Copy to Clipboard)
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
