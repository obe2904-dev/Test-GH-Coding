/**
 * Test Page for Location Type Matching (STEP 1 only)
 * Now supports multiple countries: DK, SE, DE, UK
 */

import { useState } from 'react';
import { analyzeLocationTypes, LocationContext, LocationTypeMatches } from '../../lib/location/locationTypeMatcher';

export default function TestLocationTypesPage() {
  const [results, setResults] = useState<LocationTypeMatches | null>(null);
  const [testCase, setTestCase] = useState<string>('stroget');
  const [selectedCountry, setSelectedCountry] = useState<string>('DK');
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  
  // Custom input fields
  const [customStreetAddress, setCustomStreetAddress] = useState<string>('');
  const [customPostalCode, setCustomPostalCode] = useState<string>('');
  const [customNeighborhood, setCustomNeighborhood] = useState<string>('');
  const [customCity, setCustomCity] = useState<string>('');
  const [customRestaurants, setCustomRestaurants] = useState<number>(0);
  const [customCafes, setCustomCafes] = useState<number>(0);
  const [customHotels, setCustomHotels] = useState<number>(0);
  const [customOffices, setCustomOffices] = useState<number>(0);
  const [customTouristAttractions, setCustomTouristAttractions] = useState<number>(0);
  const [customWaterDistance, setCustomWaterDistance] = useState<string>('');

  const testCases: Record<string, LocationContext> = {
    // DENMARK
    // Small cities
    vejen_centrum: {
      address: 'Rådhuspassagen 3, Vejen',
      neighborhood: 'Vejen Centrum',
      city: 'Vejen',
      countryCode: 'DK',
      nearbyPOIs: {
        restaurants: 6,
        cafes: 4,
        hotels: 1,
        offices: 3
      }
    },
    holstebro_centrum: {
      address: 'Nørregade 15, Holstebro',
      neighborhood: 'Holstebro Centrum',
      city: 'Holstebro',
      countryCode: 'DK',
      nearbyPOIs: {
        restaurants: 12,
        cafes: 8,
        hotels: 2,
        tourist_attractions: 1
      }
    },
    roskilde_centrum: {
      address: 'Algade 20, Roskilde',
      neighborhood: 'Roskilde Centrum',
      city: 'Roskilde',
      countryCode: 'DK',
      nearbyPOIs: {
        restaurants: 18,
        cafes: 12,
        hotels: 4,
        tourist_attractions: 3
      }
    },
    ebeltoft_centrum: {
      address: 'Torvet 5, Ebeltoft',
      neighborhood: 'Ebeltoft Centrum',
      city: 'Ebeltoft',
      countryCode: 'DK',
      waterDistance: 120,
      nearbyPOIs: {
        restaurants: 10,
        cafes: 6,
        hotels: 5,
        tourist_attractions: 4
      }
    },
    // Medium cities
    odense_centrum: {
      address: 'Vestergade 25, Odense',
      neighborhood: 'Odense C',
      city: 'Odense',
      nearbyPOIs: {
        restaurants: 28,
        cafes: 18,
        hotels: 6,
        tourist_attractions: 5
      }
    },
    aarhus_centrum: {
      address: 'Store Torv 8, Aarhus',
      neighborhood: 'Midtbyen',
      city: 'Aarhus',
      nearbyPOIs: {
        restaurants: 35,
        cafes: 25,
        hotels: 10,
        tourist_attractions: 6
      }
    },
    aarhus_waterfront: {
      address: 'Aarhus Ø, Aarhus',
      neighborhood: 'Aarhus Ø',
      city: 'Aarhus',
      waterDistance: 80,
      nearbyPOIs: {
        restaurants: 18,
        cafes: 12,
        hotels: 4,
        offices: 15
      }
    },
    aarhus_university: {
      address: 'Universitetsparken 15, Aarhus',
      neighborhood: 'Universitetsområdet',
      city: 'Aarhus',
      nearbyPOIs: {
        universities: 3,
        restaurants: 8,
        cafes: 6,
        hotels: 1
      }
    },
    kolding_centrum: {
      address: 'Helligkorsgade 10, Kolding',
      neighborhood: 'Kolding Midtby',
      city: 'Kolding',
      nearbyPOIs: {
        restaurants: 15,
        cafes: 10,
        hotels: 3,
        tourist_attractions: 2
      }
    },
    herning_business: {
      address: 'Vardevej 1, Herning',
      neighborhood: 'Messecenter',
      city: 'Herning',
      nearbyPOIs: {
        offices: 30,
        restaurants: 12,
        cafes: 6,
        hotels: 8
      }
    },
    herning_centrum: {
      address: 'Østergade 20, Herning',
      neighborhood: 'Herning Centrum',
      city: 'Herning',
      nearbyPOIs: {
        restaurants: 18,
        cafes: 12,
        hotels: 4,
        offices: 10
      }
    },
    aalborg_centrum: {
      address: 'Boulevarden 15, Aalborg',
      neighborhood: 'Aalborg Centrum',
      city: 'Aalborg',
      nearbyPOIs: {
        restaurants: 32,
        cafes: 22,
        hotels: 8,
        tourist_attractions: 4
      }
    },
    aalborg_waterfront: {
      address: 'Limfjorden, Aalborg',
      neighborhood: 'Aalborg Havn',
      city: 'Aalborg',
      waterDistance: 60,
      nearbyPOIs: {
        restaurants: 25,
        cafes: 15,
        hotels: 6,
        tourist_attractions: 3
      }
    },
    aalborg_university: {
      address: 'Fredrik Bajers Vej 5, Aalborg',
      neighborhood: 'Aalborg Øst',
      city: 'Aalborg',
      nearbyPOIs: {
        universities: 2,
        restaurants: 10,
        cafes: 8,
        offices: 5
      }
    },
    
    // SWEDEN
    stockholm_gamla_stan: {
      address: 'Drottninggatan 45, Stockholm',
      neighborhood: 'Gamla Stan',
      city: 'Stockholm',
      countryCode: 'SE',
      nearbyPOIs: {
        restaurants: 40,
        cafes: 28,
        hotels: 12,
        tourist_attractions: 8
      }
    },
    gothenburg_centrum: {
      address: 'Kungsgatan 20, Göteborg',
      neighborhood: 'Centrum',
      city: 'Göteborg',
      countryCode: 'SE',
      nearbyPOIs: {
        restaurants: 30,
        cafes: 20,
        hotels: 8,
        tourist_attractions: 5
      }
    },
    
    // GERMANY
    berlin_mitte: {
      address: 'Friedrichstraße 100, Berlin',
      neighborhood: 'Mitte',
      city: 'Berlin',
      countryCode: 'DE',
      nearbyPOIs: {
        restaurants: 45,
        cafes: 30,
        hotels: 15,
        tourist_attractions: 10
      }
    },
    munich_marienplatz: {
      address: 'Marienplatz 5, München',
      neighborhood: 'Altstadt',
      city: 'München',
      countryCode: 'DE',
      nearbyPOIs: {
        restaurants: 38,
        cafes: 25,
        hotels: 12,
        tourist_attractions: 8
      }
    },
    
    // UK
    london_soho: {
      address: 'Carnaby Street, London',
      neighborhood: 'Soho',
      city: 'London',
      countryCode: 'UK',
      nearbyPOIs: {
        restaurants: 50,
        cafes: 35,
        hotels: 18,
        tourist_attractions: 12
      }
    },
    manchester_city_centre: {
      address: 'Market Street, Manchester',
      neighborhood: 'City Centre',
      city: 'Manchester',
      countryCode: 'UK',
      nearbyPOIs: {
        restaurants: 32,
        cafes: 22,
        hotels: 10,
        tourist_attractions: 6
      }
    }
  };

  const handleTest = () => {
    let context: LocationContext;
    
    if (isCustomMode) {
      // Validate required fields
      if (!customStreetAddress.trim()) {
        alert('Please enter a street address');
        return;
      }
      
      // Build context from custom inputs
      const pois: any = {};
      if (customRestaurants > 0) pois.restaurants = customRestaurants;
      if (customCafes > 0) pois.cafes = customCafes;
      if (customHotels > 0) pois.hotels = customHotels;
      if (customOffices > 0) pois.offices = customOffices;
      if (customTouristAttractions > 0) pois.tourist_attractions = customTouristAttractions;
      
      // Combine street address and postal code
      const fullAddress = customPostalCode 
        ? `${customStreetAddress}, ${customPostalCode}` 
        : customStreetAddress;
      
      context = {
        address: fullAddress,
        neighborhood: customNeighborhood || '',
        city: customCity || '',
        countryCode: selectedCountry,
        nearbyPOIs: Object.keys(pois).length > 0 ? pois : undefined,
        ...(customWaterDistance ? { waterDistance: parseInt(customWaterDistance) } : {})
      };
      
      console.log('🎯 Custom context built:', context);
    } else {
      context = testCases[testCase];
    }
    
    console.log('🧪 Testing:', context.address, 'Country:', context.countryCode || 'DK');
    const matches = analyzeLocationTypes(context, context.countryCode);
    console.log('📍 Results:', matches);
    setResults(matches);
  };
  
  // Filter test cases by selected country
  const getFilteredTestCases = () => {
    return Object.entries(testCases).filter(([_key, context]) => 
      (context.countryCode || 'DK') === selectedCountry
    );
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600 bg-green-50';
    if (score >= 40) return 'text-yellow-600 bg-yellow-50';
    return 'text-gray-600 bg-gray-50';
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
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">🧪 Test Location Type Matching (STEP 1) - Multi-Country</h1>
      
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="text-2xl">💡</div>
          <div>
            <div className="font-semibold text-yellow-900 mb-1">Testing with Real POI Data</div>
            <div className="text-sm text-yellow-800">
              This page is for <strong>pattern testing with manual POI counts</strong>. For full automated testing with real Google Places POI data, 
              use <strong>Location Intelligence</strong> from any business profile page (it automatically geocodes addresses and fetches nearby POIs).
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Select Country</h2>
        
        <div className="flex gap-4 mb-6">
          {['DK', 'SE', 'DE', 'UK'].map(country => (
            <button
              key={country}
              onClick={() => {
                setSelectedCountry(country);
                // Auto-select first test case for that country
                if (!isCustomMode) {
                  const firstCase = getFilteredTestCases()[0];
                  if (firstCase) {
                    setTestCase(firstCase[0]);
                  }
                }
              }}
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
        
        <div className="mb-6 flex gap-4">
          <button
            onClick={() => setIsCustomMode(false)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              !isCustomMode
                ? 'bg-cta text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            📋 Predefined Cases
          </button>
          <button
            onClick={() => setIsCustomMode(true)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              isCustomMode
                ? 'bg-cta text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            ✏️ Custom Address
          </button>
        </div>
        
        {!isCustomMode ? (
          <>
            <h2 className="text-lg font-semibold mb-4">Select Test Case</h2>
            
            <div className="space-y-3 mb-6">
              {getFilteredTestCases().map(([key, context]) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="testCase"
                    value={key}
                    checked={testCase === key}
                    onChange={(e) => setTestCase(e.target.value)}
                    className="w-4 h-4"
                  />
                  <div>
                    <div className="font-medium">{context.address}</div>
                    <div className="text-sm text-gray-600">
                      {context.neighborhood} • {Object.entries(context.nearbyPOIs || {})
                        .filter(([, val]) => val && val > 0)
                        .map(([key, val]) => `${val} ${key}`)
                        .join(', ')}
                      {context.waterDistance ? ` • ${context.waterDistance}m from water` : ''}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold mb-4">Custom Address Input</h2>
            
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Street Name & Number *</label>
                  <input
                    type="text"
                    value={customStreetAddress}
                    onChange={(e) => setCustomStreetAddress(e.target.value)}
                    placeholder="e.g., Åboulevarden 38"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code *</label>
                  <input
                    type="text"
                    value={customPostalCode}
                    onChange={(e) => setCustomPostalCode(e.target.value)}
                    placeholder="e.g., 8000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Neighborhood</label>
                  <input
                    type="text"
                    value={customNeighborhood}
                    onChange={(e) => setCustomNeighborhood(e.target.value)}
                    placeholder="e.g., Midtbyen"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={customCity}
                    onChange={(e) => setCustomCity(e.target.value)}
                    placeholder="e.g., Aarhus"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              
              <div className="border-t border-gray-200 pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Nearby POIs</label>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Restaurants</label>
                    <input
                      type="number"
                      min="0"
                      value={customRestaurants}
                      onChange={(e) => setCustomRestaurants(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Cafés</label>
                    <input
                      type="number"
                      min="0"
                      value={customCafes}
                      onChange={(e) => setCustomCafes(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Hotels</label>
                    <input
                      type="number"
                      min="0"
                      value={customHotels}
                      onChange={(e) => setCustomHotels(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Offices</label>
                    <input
                      type="number"
                      min="0"
                      value={customOffices}
                      onChange={(e) => setCustomOffices(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Tourist Attractions</label>
                    <input
                      type="number"
                      min="0"
                      value={customTouristAttractions}
                      onChange={(e) => setCustomTouristAttractions(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Water Distance (m)</label>
                    <input
                      type="number"
                      min="0"
                      value={customWaterDistance}
                      onChange={(e) => setCustomWaterDistance(e.target.value)}
                      placeholder="Optional"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {isCustomMode && customStreetAddress && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-sm font-medium text-blue-900 mb-1">Preview:</div>
            <div className="text-sm text-blue-700">
              {customStreetAddress}{customPostalCode && `, ${customPostalCode}`}
              {customNeighborhood && ` • ${customNeighborhood}`}
              {customCity && ` • ${customCity}`}
            </div>
            {(customRestaurants > 0 || customCafes > 0 || customHotels > 0 || customOffices > 0 || customTouristAttractions > 0) && (
              <div className="text-xs text-blue-600 mt-1">
                POIs: {[
                  customRestaurants > 0 && `${customRestaurants} restaurants`,
                  customCafes > 0 && `${customCafes} cafés`,
                  customHotels > 0 && `${customHotels} hotels`,
                  customOffices > 0 && `${customOffices} offices`,
                  customTouristAttractions > 0 && `${customTouristAttractions} attractions`
                ].filter(Boolean).join(', ')}
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleTest}
          className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
        >
          🧪 Run Test
        </button>
      </div>

      {results && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">📊 Results</h2>
          
          <div className="space-y-3">
            {Object.entries(results)
              .sort(([, a], [, b]) => b.match_score - a.match_score)
              .map(([type, match]) => (
                <div key={type} className={`border rounded-lg p-4 ${getScoreColor(match.match_score)}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold">{match.match_score}</span>
                      <div>
                        <div className="font-semibold capitalize">{type.replace('_', ' ')}</div>
                        <span className={`text-xs px-2 py-1 rounded ${getLevelBadge(match.match_level)}`}>
                          {match.match_level}
                        </span>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">
                      {Math.round(match.confidence * 100)}% confidence
                    </div>
                  </div>
                  <div className="text-sm mt-2 border-t pt-2">
                    {match.reason}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
