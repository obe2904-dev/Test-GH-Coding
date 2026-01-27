'use client';

import { useState, useEffect } from 'react';
import { LocationAnalysis } from '../../lib/location/core/types';
import LocationAnalysisDisplay from '../../components/setup/LocationAnalysis';
import { supabase } from '../../lib/supabase';
import { analyzeLocation } from '../../lib/location/core/analyzer';
import { analyzeConceptFit, ConceptFitInput, ConceptFitOutput } from '../../lib/location/conceptFitAnalyzer';
import { getLocaleConfig } from '../../lib/location/locales';


function LocationIntelligencePage() {
  const [address, setAddress] = useState('');
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoadingAddress, setIsLoadingAddress] = useState(true);
  const [analysis, setAnalysis] = useState<LocationAnalysis | null>(() => {
    // Try to restore analysis from sessionStorage on mount
    const stored = sessionStorage.getItem('location_analysis');
    if (stored) {
      try {
        console.log('🔄 Restoring analysis from sessionStorage');
        return JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse stored analysis:', e);
        return null;
      }
    }
    return null;
  });
  const [conceptFit, setConceptFit] = useState<Record<string, ConceptFitOutput> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Save analysis to sessionStorage whenever it changes
  useEffect(() => {
    if (analysis) {
      console.log('💾 Storing analysis in sessionStorage');
      sessionStorage.setItem('location_analysis', JSON.stringify(analysis));
    }
  }, [analysis]);

  // Load business address on mount
  useEffect(() => {
    const loadBusinessAddress = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        const user = authData?.user;
        if (!user) return;

        const { data: businessData } = await supabase
          .from('businesses')
          .select('*')
          .eq('owner_id', user.id)
          .maybeSingle();

        if (!businessData) return;

        // Load address from business_locations
        const bizId = (businessData as any).id;
        setBusinessId(bizId);
        
        const { data: locationData } = await supabase
          .from('business_locations')
          .select('*')
          .eq('business_id', bizId)
          .eq('is_primary', true)
          .maybeSingle();

        if (locationData) {
          const addressLine = (locationData as any)?.address_line1 ?? '';
          const city = (locationData as any)?.city ?? '';
          const fullAddress = `${addressLine}, ${city}`.trim();
          
          if (fullAddress && fullAddress !== ',') {
            setAddress(fullAddress);
          }
        }
      } catch (error) {
        console.error('Error loading business address:', error);
      } finally {
        setIsLoadingAddress(false);
      }
    };

    loadBusinessAddress();
  }, []);

  // Load saved location intelligence data on mount
  useEffect(() => {
    const loadSavedLocationData = async () => {
      if (!businessId) return;

      try {
        console.log('🔄 Loading saved location intelligence data...');
        
        const { data: savedData, error: loadError } = await supabase
          .from('business_location_intelligence')
          .select('*')
          .eq('business_id', businessId)
          .maybeSingle();

        if (loadError) {
          console.error('Error loading saved location data:', loadError);
          return;
        }

        if (savedData) {
          console.log('✅ Found saved location data:', savedData);
          
          // Reconstruct ALL matches from category_scores
          const matches: any[] = [];
          
          if (savedData.category_scores && typeof savedData.category_scores === 'object') {
            // Load all categories from category_scores
            const scores = savedData.category_scores as Record<string, number>;
            const hasScores = Object.keys(scores).length > 0;
            
            if (hasScores) {
              Object.entries(scores)
                .sort(([, a], [, b]) => b - a) // Sort by score descending
                .forEach(([categoryId, score]) => {
                  matches.push({
                    categoryId: categoryId as any,
                    score: score,
                    confidence: score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low',
                    reasoning: savedData.neighborhood_character ? [savedData.neighborhood_character] : [],
                    signals: categoryId === savedData.area_type 
                      ? (savedData.landmarks_nearby as any[])?.map((landmark: any) => ({
                          name: landmark.name || '',
                          type: landmark.type || 'landmark',
                          distance: landmark.distance || 0,
                          relevance: 1
                        })) || []
                      : []
                  });
                });
            }
          }
          
          // Fallback: if no scores, use area_type as single category
          if (matches.length === 0 && savedData.area_type) {
            matches.push({
              categoryId: savedData.area_type as any,
              score: 100,
              confidence: 'high' as const,
              reasoning: savedData.neighborhood_character ? [savedData.neighborhood_character] : [],
              signals: (savedData.landmarks_nearby as any[])?.map((landmark: any) => ({
                name: landmark.name || '',
                type: landmark.type || 'landmark',
                distance: landmark.distance || 0,
                relevance: 1
              })) || []
            });
          }
          
          // Reconstruct the analysis object from saved data
          const reconstructedAnalysis: LocationAnalysis = {
            address: address || `${savedData.neighborhood || ''}`,
            neighborhood: savedData.neighborhood || '',
            city: savedData.neighborhood || '',
            locale: 'da-DK', // Default to Danish locale
            coordinates: savedData.latitude && savedData.longitude 
              ? { lat: savedData.latitude, lng: savedData.longitude }
              : undefined,
            matches: matches,
            culturalContext: savedData.neighborhood_character || savedData.location_marketing_hooks?.length > 0 ? {
              description: savedData.neighborhood_character || '',
              knownFor: savedData.location_marketing_hooks || [],
              marketingAngle: savedData.location_marketing_hooks?.[0] || ''
            } : undefined
          };

          setAnalysis(reconstructedAnalysis);
          console.log('✅ Restored location analysis from database');
          
          // Also restore concept fit data if available
          const savedDataAny = savedData as any;
          if (savedDataAny.concept_fit_by_category && typeof savedDataAny.concept_fit_by_category === 'object') {
            setConceptFit(savedDataAny.concept_fit_by_category);
            console.log('✅ Restored concept fit from database');
          }
        } else {
          console.log('ℹ️ No saved location data found');
        }
      } catch (error) {
        console.error('Error loading saved location data:', error);
      }
    };

    if (businessId) {
      loadSavedLocationData();
    }
  }, [businessId, address]);

  /**
   * Load business data needed for concept fit analysis
   */
  const loadBusinessData = async (): Promise<ConceptFitInput | null> => {
    if (!businessId) return null;

    try {
      const untypedSupabase = supabase as any;

      // Load business profile (has description and other data)
      const { data: profile } = await supabase
        .from('business_profile')
        .select('short_description, long_description')
        .eq('business_id', businessId)
        .maybeSingle();

      // Load opening hours
      const { data: hours } = await supabase
        .from('opening_hours')
        .select('*')
        .eq('business_id', businessId);

      // Load latest menu result for pricing and structure
      const { data: menuResult } = await supabase
        .from('menu_results_v2')
        .select('structured_data')
        .eq('business_id', businessId)
        .eq('status', 'done')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Calculate average price from menu
      let avgPrice: number | undefined;
      const structured = (menuResult as any)?.structured_data;
      if (structured?.categories && Array.isArray(structured.categories)) {
        const prices: number[] = [];
        structured.categories.forEach((cat: any) => {
          if (Array.isArray(cat?.items)) {
            cat.items.forEach((item: any) => {
              const price = typeof item?.price === 'number' ? item.price : parseFloat(item?.price);
              if (!isNaN(price) && price > 0) prices.push(price);
            });
          }
        });
        if (prices.length > 0) {
          avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        }
      }

      // Convert opening hours to expected format
      const openingHours: ConceptFitInput['openingHours'] = {};
      if (hours && Array.isArray(hours)) {
        hours.forEach((h: any) => {
          const day = h.day_of_week?.toLowerCase();
          if (day && h.opens_at && h.closes_at) {
            openingHours[day as keyof typeof openingHours] = {
              open: h.opens_at,
              close: h.closes_at
            };
          }
        });
      }

      // Determine price level
      let priceLevel: 'budget' | 'mid' | 'premium' = 'mid';
      if (avgPrice) {
        if (avgPrice < 80) priceLevel = 'budget';
        else if (avgPrice > 150) priceLevel = 'premium';
      }

      // Load business operations for service model
      const { data: operations } = await supabase
        .from('business_operations')
        .select('has_takeaway, has_delivery, has_table_service')
        .eq('business_id', businessId)
        .maybeSingle();

      // Determine service model from operations data
      let serviceModel: 'dine-in' | 'takeaway' | 'both' | 'delivery' = 'dine-in';
      if (operations) {
        if (operations.has_table_service && operations.has_takeaway) {
          serviceModel = 'both';
        } else if (operations.has_takeaway && !operations.has_table_service) {
          serviceModel = 'takeaway';
        } else if (operations.has_delivery) {
          serviceModel = 'delivery';
        }
      }

      const conceptInput: ConceptFitInput = {
        aboutText: profile?.short_description || profile?.long_description || undefined,
        openingHours: Object.keys(openingHours).length > 0 ? openingHours : undefined,
        menuSummary: undefined, // No longer using menu metadata
        serviceModel: serviceModel,
        priceLevel: priceLevel
      };
      
      console.log('📊 Business data for concept fit:', {
        hasDescription: !!conceptInput.aboutText,
        hasHours: !!conceptInput.openingHours,
        serviceModel: conceptInput.serviceModel,
        priceLevel: conceptInput.priceLevel,
        hoursCount: Object.keys(openingHours).length,
        operationsLoaded: !!operations
      });
      
      return conceptInput;
    } catch (error) {
      console.error('Error loading business data for concept fit:', error);
      return null;
    }
  };

  const handleAnalyze = async () => {
    if (!address.trim()) {
      setError('Indtast venligst en adresse');
      return;
    }

    try {
      setIsAnalyzing(true);
      setError(null);
      
      // Try using Supabase function with real Google Maps data
      const session = await supabase.auth.getSession();
      const useSupabase = businessId && session.data.session?.access_token;
      
      const analysis = await analyzeLocation(address, {
        useSupabaseFunction: !!useSupabase,
        businessId: businessId || undefined,
        supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
        accessToken: session.data.session?.access_token
      });
      
      console.log('✅ Analysis complete:', analysis);
      setAnalysis(analysis);
      
      // Get business data first for country code
      const businessDataForCountry = await loadBusinessData();
      
      // STEP 1: Pure location type matching (independent of business)
      const { analyzeLocationTypes } = await import('../../lib/location/locationTypeMatcher');
      
      // Get country code from business data or default to DK
      const countryCode = (businessDataForCountry as any)?.country || 'DK';
      
      const locationContext = {
        address: address,
        neighborhood: (analysis as any).neighborhood,
        city: analysis.city,
        countryCode: countryCode, // Pass country code for pattern selection
        nearbyPOIs: {
          restaurants: analysis.matches[0]?.signals?.filter(s => s.type === 'restaurant').length || 0,
          cafes: analysis.matches[0]?.signals?.filter(s => s.type === 'cafe').length || 0,
          hotels: analysis.matches[0]?.signals?.filter(s => s.type === 'hotel').length || 0,
          tourist_attractions: analysis.matches[0]?.signals?.filter(s => s.type === 'tourist_attraction').length || 0
        },
        landmarks: analysis.matches[0]?.signals?.map(s => ({ name: s.name, type: s.type }))
      };
      const locationTypeMatches = analyzeLocationTypes(locationContext, countryCode);
      console.log('📍 STEP 1 - Location Type Matches (Country: ' + countryCode + '):', locationTypeMatches);
      
      // STEP 2: Concept fit analysis (how business fits each location type)
      const businessData = await loadBusinessData();
      if (businessData && analysis.matches.length > 0) {
        // Get locale config to get actual category display names
        const localeConfig = getLocaleConfig(analysis.locale);
        
        const categories = analysis.matches.map(m => ({
          categoryId: m.categoryId,
          score: m.score,
          displayName: localeConfig.categories[m.categoryId]?.name || m.categoryId
        }));
        
        // Filter categories >= 60% to call Edge Function
        const eligibleCategories = categories.filter(cat => cat.score >= 60);
        console.log(`🚀 Calling Edge Function for ${eligibleCategories.length} categories (≥60%):`, eligibleCategories.map(c => c.categoryId).join(', '));
        
        let fitResults: Record<string, ConceptFitOutput> = {};
        let edgeFunctionSuccessCount = 0;
        
        // Call Edge Function for ALL eligible categories
        for (let i = 0; i < eligibleCategories.length; i++) {
          const category = eligibleCategories[i];
          const isStrategyDriver = i === 0; // First category is strategy driver
          
          try {
            console.log(`🔄 [${i + 1}/${eligibleCategories.length}] Analyzing ${category.categoryId}...`);
            
            const { data: edgeFunctionData, error: edgeFunctionError } = await supabase.functions.invoke('analyze-concept-fit', {
              body: {
                businessId: businessId,
                locationType: category.categoryId
              }
            });
            
            if (edgeFunctionError) {
              console.error(`⚠️ Edge Function error for ${category.categoryId}:`, edgeFunctionError);
              throw edgeFunctionError;
            }
            
            if (edgeFunctionData?.success && edgeFunctionData.conceptFit) {
              edgeFunctionSuccessCount++;
              console.log(`✅ [${i + 1}/${eligibleCategories.length}] ${category.categoryId} analyzed successfully`);
              
              // Convert Edge Function output to match expected format
              const edgeConceptFit = edgeFunctionData.conceptFit;
              fitResults[category.categoryId] = {
                area_type: category.categoryId,
                category_score: category.score,
                strategy_score: category.score,
                seasonal_weight: 1.0,
                seasonal_relevance: 'year_round',
                is_strategy_driver: isStrategyDriver,
                fit_level: edgeConceptFit.overall_fit_level === 'strong' ? 'strong' : 
                          edgeConceptFit.overall_fit_level === 'challenging' ? 'challenging' : 'moderate',
                fit_confidence: edgeConceptFit.overall_fit_confidence || 0.7,
                ui_summary: {
                  one_liner: edgeConceptFit.strategy_positioning || `Konceptet passer ${edgeConceptFit.overall_fit_level} til ${category.displayName}`,
                  best_marketing_angle: edgeConceptFit.emphasis?.[0] || 'Kvalitet + service'
                },
                fit_reasons: edgeConceptFit.fit_reasons || [],
                marketing_implications: {
                  content_emphasis: edgeConceptFit.emphasis || [],
                  cta_style: edgeConceptFit.cta_style || 'Friendly invite',
                  timing_tweaks: []
                },
                recommended_adjustments: [],
                watchouts: edgeConceptFit.mismatch_reasons || []
              };
              
              console.log(`📊 ${category.categoryId} fit_reasons (${edgeConceptFit.fit_reasons?.length || 0}):`, edgeConceptFit.fit_reasons);
            } else {
              throw new Error('Edge Function returned no data');
            }
          } catch (edgeError) {
            console.warn(`⚠️ Edge Function failed for ${category.categoryId}, will use client-side fallback:`, edgeError);
          }
        }
        
        // Use client-side analysis ONLY for categories that failed Edge Function call
        if (edgeFunctionSuccessCount < eligibleCategories.length) {
          console.log(`🔄 Using client-side fallback for ${eligibleCategories.length - edgeFunctionSuccessCount} categories`);
          const failedCategories = eligibleCategories.filter(cat => !fitResults[cat.categoryId]);
          if (failedCategories.length > 0) {
            const clientResults = analyzeConceptFit(failedCategories, businessData);
            fitResults = { ...fitResults, ...clientResults };
          }
        }
        
        // Fallback: if all Edge Functions failed, use client-side for all
        if (Object.keys(fitResults).length === 0) {
          console.warn('⚠️ All Edge Functions failed, using full client-side analysis');
          fitResults = analyzeConceptFit(categories, businessData);
        }
        
        console.log(`🎯 STEP 2 - Concept Fit Analysis Complete: ${Object.keys(fitResults).length} categories analyzed (${edgeFunctionSuccessCount} via Edge Function)`);
        console.log('📊 Results:', fitResults);
        setConceptFit(fitResults);
        
        // Auto-save with location type matches AND concept fit
        await saveLocationProfile(analysis, fitResults, locationTypeMatches);
      } else {
        // Auto-save with just location type matches
        await saveLocationProfile(analysis, undefined, locationTypeMatches);
      }
      
    } catch (error) {
      console.error('Location analysis error:', error);
      setError(error instanceof Error ? error.message : 'Fejl ved analyse af lokation');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const saveLocationProfile = async (
    analysisData: LocationAnalysis, 
    fitData?: Record<string, ConceptFitOutput>,
    locationTypeMatches?: Record<string, any> // Location type matches from STEP 1
  ) => {
    if (!businessId) {
      console.error('❌ No business ID available for saving');
      return;
    }

    if (!analysisData.matches || analysisData.matches.length === 0) {
      console.error('❌ No category matches found in analysis');
      return;
    }

    setIsSaving(true);
    try {
      // Convert all matches to category_scores object
      const categoryScores: Record<string, number> = {};
      analysisData.matches.forEach(match => {
        categoryScores[match.categoryId] = match.score;
      });

      const dataToSave: any = {
        business_id: businessId,
        neighborhood: analysisData.neighborhood || analysisData.city || null,
        neighborhood_character: analysisData.culturalContext?.description || null,
        area_type: analysisData.matches[0].categoryId,
        category_scores: categoryScores, // Save ALL category scores
        location_type_matches: locationTypeMatches || {}, // STEP 1: Pure location analysis
        latitude: analysisData.coordinates?.lat || null,
        longitude: analysisData.coordinates?.lng || null,
        landmarks_nearby: analysisData.matches[0].signals?.map(signal => ({
          name: signal.name,
          type: signal.type,
          distance: signal.distance,
          walking_minutes: signal.distance ? Math.round(signal.distance / 80) : null
        })) || [],
        location_marketing_hooks: analysisData.culturalContext?.knownFor || [],
        last_updated_by_ai: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Add concept fit data if available (per-category format)
      if (fitData) {
        dataToSave.concept_fit_by_category = fitData;
        dataToSave.concept_fit_analyzed_at = new Date().toISOString();
      }

      console.log('💾 Auto-saving location data:', dataToSave);

      const { error: saveError } = await supabase
        .from('business_location_intelligence')
        .upsert(dataToSave, {
          onConflict: 'business_id'
        });

      if (saveError) {
        console.error('❌ Auto-save error:', saveError);
        setError('Kunne ikke gemme automatisk. Data er stadig tilgængelig.');
      } else {
        console.log('✅ Location profile auto-saved');
      }
    } catch (err) {
      console.error('❌ Unexpected auto-save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCategory = (categoryId: string) => {
    if (!analysis) return;
    
    // Remove the category from matches
    const updatedAnalysis = {
      ...analysis,
      matches: analysis.matches.filter(m => m.categoryId !== categoryId)
    };
    
    setAnalysis(updatedAnalysis);
    
    // Re-save with updated categories
    saveLocationProfile(updatedAnalysis);
  };

  const handleContinue = () => {
    // Auto-save is already enabled, so just navigate to next step
    window.location.href = '/dashboard/menu';
  };


  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Progress indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-center gap-2 text-sm">
          <a href="/dashboard/profile" className="text-gray-400 hover:text-gray-600">Profil</a>
          <span className="text-gray-300">→</span>
          <span className="text-indigo-600 font-semibold">Lokation</span>
          <span className="text-gray-300">→</span>
          <a href="/dashboard/menu" className="text-gray-400 hover:text-gray-600">Menu</a>
          <span className="text-gray-300">→</span>
          <a href="/dashboard/operations" className="text-gray-400 hover:text-gray-600">Drift</a>
          <span className="text-gray-300">→</span>
          <a href="/dashboard/brand" className="text-gray-400 hover:text-gray-600">Brand</a>
          <span className="text-gray-300">→</span>
          <a href="/dashboard/goals" className="text-gray-400 hover:text-gray-600">Mål</a>
        </div>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Din lokation</h1>
        <p className="text-gray-600">
          Vi analyserer din lokation og tilpasser indholdsstrategien.
        </p>
      </div>

      {/* Loading state */}
      {isLoadingAddress && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-3 text-gray-500">
              <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Henter adresse...</span>
            </div>
          </div>
        </div>
      )}

      {/* Address Display Card */}
      {!isLoadingAddress && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          {address ? (
            <div className="space-y-4">
              {/* Read-only address display */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Forretningsadresse
                </label>
                <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                  <p className="text-gray-900 font-medium">{address}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    Adresse hentes fra din virksomhedsprofil. Vil du ændre den? 
                    <a href="/dashboard/profile" className="text-blue-600 hover:underline ml-1">
                      Gå til Virksomhedsprofil
                    </a>
                  </p>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {isAnalyzing ? 'Analyserer...' : 'Analyser Lokation'}
              </button>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Ingen adresse fundet</h3>
              <p className="text-gray-600 mb-4">
                Tilføj din forretningsadresse i virksomhedsprofilen først
              </p>
              <a
                href="/dashboard/profile"
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Tilføj adresse i Virksomhedsprofil
              </a>
            </div>
          )}
        </div>
      )}

      {/* Analysis Results */}
      {analysis && (
        <>
          {console.log('🎨 Rendering analysis display:', analysis)}
          {console.log('🎨 ConceptFit state:', conceptFit)}
          <LocationAnalysisDisplay 
            analysis={analysis}
            conceptFits={conceptFit}
            onDeleteCategory={handleDeleteCategory}
          />

          {isSaving && (
            <div className="text-center text-sm text-gray-600 mt-4">
              💾 Gemmer automatisk...
            </div>
          )}

          <div className="flex gap-4 mt-6">
            <button
              onClick={() => {
                setAnalysis(null);
                sessionStorage.removeItem('location_analysis');
              }}
              className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Analyser igen
            </button>
            <button
              onClick={handleContinue}
              disabled={isSaving}
              className="flex-1 px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              Fortsæt
            </button>
          </div>
        </>
      )}

      {/* Navigation buttons */}
      <div className="flex justify-between mt-6">
        <a
          href="/dashboard/profile"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          ← Tilbage til Profil
        </a>
        <a
          href="/dashboard/menu"
          className="inline-flex items-center gap-2 px-6 py-2 text-sm bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Næste: Menu →
        </a>
      </div>
    </div>
  )
}

export default LocationIntelligencePage
