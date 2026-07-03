/**
 * Locale-Aware Waterfront Detection
 * Multi-method waterfront detection with locale awareness
 */

import { LocaleConfig, AnalysisSignal } from '../core/types';

export interface WaterfrontDetectionResult {
  score: number;
  confidence: 'low' | 'medium' | 'high';
  details: string[];
  signals: AnalysisSignal[];
}

/**
 * Multi-method waterfront detection with locale awareness
 */
export async function detectWaterfront(
  address: string,
  city: string,
  _country: string,
  coordinates: { lat: number; lng: number },
  localeConfig: LocaleConfig,
  websiteContext: any,
  poiData: any
): Promise<WaterfrontDetectionResult> {
  
  const results: WaterfrontDetectionResult[] = [];
  
  // Method 1: Known locations database (locale-specific)
  const knownLocationResult = checkKnownWaterfrontLocation(
    address,
    city,
    localeConfig
  );
  if (knownLocationResult.score > 0) {
    results.push(knownLocationResult);
  }
  
  // Method 2: Keyword detection (locale-specific keywords)
  const keywordResult = detectWaterfrontFromKeywords(
    address,
    websiteContext?.textContent || '',
    localeConfig
  );
  if (keywordResult.score > 0) {
    results.push(keywordResult);
  }
  
  // Method 3: POI analysis (universal but locale-aware messaging)
  const poiResult = await detectWaterfrontFromPOIs(
    coordinates,
    poiData,
    localeConfig
  );
  if (poiResult.score > 0) {
    results.push(poiResult);
  }
  
  // Combine results - take highest score, merge details
  if (results.length === 0) {
    return {
      score: 0,
      confidence: 'low',
      details: [],
      signals: []
    };
  }
  
  const bestResult = results.reduce((prev, curr) => 
    curr.score > prev.score ? curr : prev
  );
  
  // Merge all details and signals
  const allDetails = [...new Set(results.flatMap(r => r.details))];
  const allSignals = results.flatMap(r => r.signals);
  
  return {
    score: bestResult.score,
    confidence: bestResult.confidence,
    details: allDetails,
    signals: allSignals
  };
}

function checkKnownWaterfrontLocation(
  address: string,
  city: string,
  localeConfig: LocaleConfig
): WaterfrontDetectionResult {
  
  const cityLocations = localeConfig.knownLocations[city] || [];
  const addressLower = address.toLowerCase();
  
  for (const location of cityLocations) {
    if (addressLower.includes(location.identifier.toLowerCase())) {
      return {
        score: location.score,
        confidence: 'high',
        details: [
          `Lokaliseret på ${location.identifier}`,
          location.description
        ],
        signals: [
          {
            type: 'known_waterfront_street',
            name: location.identifier,
            weight: 5,
            metadata: {
              culturalSignificance: location.culturalContext?.significance
            }
          }
        ]
      };
    }
  }
  
  return { score: 0, confidence: 'low', details: [], signals: [] };
}

function detectWaterfrontFromKeywords(
  address: string,
  websiteContent: string,
  localeConfig: LocaleConfig
): WaterfrontDetectionResult {
  
  const searchText = `${address} ${websiteContent}`.toLowerCase();
  const keywords = localeConfig.keywords.waterfront;
  
  let score = 0;
  const foundKeywords: string[] = [];
  
  keywords.forEach(keyword => {
    if (searchText.includes(keyword.toLowerCase())) {
      // Weight based on keyword specificity
      const weight = keyword.length > 5 ? 25 : 15;
      score += weight;
      foundKeywords.push(keyword);
    }
  });
  
  const finalScore = Math.min(score, 80);
  
  if (foundKeywords.length === 0) {
    return { score: 0, confidence: 'low', details: [], signals: [] };
  }
  
  return {
    score: finalScore,
    confidence: finalScore > 60 ? 'high' : 'medium',
    details: [
      `Nøgleord fundet: "${foundKeywords.slice(0, 3).join('", "')}"`
    ],
    signals: [
      {
        type: 'waterfront_keywords',
        name: `Vandfront-beskrivelse fundet`,
        weight: 3,
        metadata: { keywords: foundKeywords }
      }
    ]
  };
}

async function detectWaterfrontFromPOIs(
  _coordinates: { lat: number; lng: number },
  poiData: any,
  _localeConfig: LocaleConfig
): Promise<WaterfrontDetectionResult> {
  
  let score = 0;
  const details: string[] = [];
  const signals: AnalysisSignal[] = [];
  
  if (poiData.water_distance !== undefined && poiData.water_distance < 500) {
    const distance = Math.round(poiData.water_distance);
    
    if (distance < 100) {
      score = 85;
      details.push(`${distance}m fra vandet - direkte vandudsigt sandsynlig`);
    } else if (distance < 250) {
      score = 65;
      details.push(`${distance}m fra vandet - kort gåafstand`);
    } else {
      score = 40;
      details.push(`${distance}m fra vandet`);
    }
    
    signals.push({
      type: 'water_proximity',
      name: `${distance}m fra vandkant`,
      distance: distance,
      weight: distance < 100 ? 5 : 3
    });
  }
  
  return {
    score,
    confidence: score > 60 ? 'high' : score > 35 ? 'medium' : 'low',
    details,
    signals
  };
}
