'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LocationAnalysis, LocationCategoryId } from '../../lib/location/core/types';
import type { SupportedLocale } from '../../lib/location/core/types';
import { LocationCategoryIcon } from '../../components/setup/LocationCategoryIcon';
import { supabase } from '../../lib/supabase';
import { analyzeLocation } from '../../lib/location/core/analyzer';
import { analyzeConceptFit, ConceptFitInput, ConceptFitOutput } from '../../lib/location/conceptFitAnalyzer';
import { getLocaleConfig } from '../../lib/location/locales';

// Icon component
const CheckCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
  </svg>
);

const MapPinIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
    <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
  </svg>
);

// Geographic location types (excludes demographics: student, tourist)
// Demographics are now stored in demographic_proximity, not displayed as location types
const GEOGRAPHIC_LOCATION_TYPES = new Set([
  'city_centre',
  'residential',
  'office',
  'transport_hub',
  'waterfront',
  'shopping_district',
  'mixed_use',
  'destination',
  'nature_park'
]);

// Seasonal relevance mapping for each location type
const SEASONAL_PATTERN_MAP: Record<string, 'year_round' | 'summer_peak' | 'semester_only' | 'weekday_only'> = {
  waterfront: 'summer_peak',
  tourist: 'summer_peak',
  nature_park: 'summer_peak',
  student: 'semester_only',
  office: 'weekday_only',
};


function LocationIntelligencePage() {
  const { t, i18n } = useTranslation();
  // Map i18n language to locale config key for location category names
  const uiLocale: SupportedLocale = i18n.language === 'en' ? 'en-US' : 'da-DK';

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
  const [locationTypeScores, setLocationTypeScores] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // ISO string of the last time AI analysis completed — used to gate re-analysis
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<string | null>(null);
  // Task 4.5: Force refresh option to bypass 90-day cache
  const [forceRefresh, setForceRefresh] = useState(false);

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
        
        const { data: savedData, error: loadError } = await (supabase as any)
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
            city: savedData.neighborhood || '',
            country: 'DK',
            primaryCategory: (matches[0]?.categoryId || 'city_centre') as LocationCategoryId,
            analyzedAt: new Date().toISOString(),
            locale: 'da-DK', // Default to Danish locale
            coordinates: (savedData.latitude && savedData.longitude 
              ? { lat: savedData.latitude as number, lng: savedData.longitude as number }
              : { lat: 0, lng: 0 }),
            matches: matches,
            culturalContext: (savedData.neighborhood_character || savedData.location_marketing_hooks?.length > 0 ? {
              significance: 'medium' as const,
              description: savedData.neighborhood_character || '',
              knownFor: savedData.location_marketing_hooks || [],
            } : undefined),
          };

          setAnalysis(reconstructedAnalysis);
          console.log('✅ Restored location analysis from database');

          // Track when the analysis was last run
          if ((savedData as any).last_updated_by_ai) {
            setLastAnalyzedAt((savedData as any).last_updated_by_ai);
          }
          
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

      // Load business profile (has long_description - user-entered description)
      const { data: profile } = await supabase
        .from('business_profile')
        .select('long_description')
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
      const { data: operations } = await (supabase as any)
        .from('business_operations')
        .select('has_takeaway, has_delivery, has_table_service')
        .eq('business_id', businessId)
        .maybeSingle();

      // Determine service model from operations data
      let serviceModel: 'dine-in' | 'takeaway' | 'both' | 'delivery' = 'dine-in';
      if (operations) {
        if ((operations as any).has_table_service && (operations as any).has_takeaway) {
          serviceModel = 'both';
        } else if ((operations as any).has_takeaway && !(operations as any).has_table_service) {
          serviceModel = 'takeaway';
        } else if ((operations as any).has_delivery) {
          serviceModel = 'delivery';
        }
      }

      const conceptInput: ConceptFitInput = {
        aboutText: profile?.long_description || undefined,
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
      setError(t('location.errorNoAddress'));
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
        accessToken: session.data.session?.access_token,
        forceRefresh: forceRefresh  // Task 4.5: Pass force refresh flag
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
      console.log('🔍 DEBUG - locationTypeMatches scores:', Object.entries(locationTypeMatches).map(([k, v]: [string, any]) => `${k}=${v.match_score}`).join(', '));
      
      // STEP 2: Concept fit analysis (how business fits each location type)
      const businessData = await loadBusinessData();
      if (businessData && analysis.matches.length > 0) {
        // Get locale config to get actual category display names
        const localeConfig = getLocaleConfig(analysis.locale);
        
        // Persist fresh scores into state for rendering
        const freshScores: Record<string, number> = {};
        analysis.matches.forEach(m => { freshScores[m.categoryId] = m.score; });
        setLocationTypeScores(freshScores);

        // Categories where client-side detection is reliable (keyword + transit POI based).
        // If the lightweight matcher confidently gives these 0, they're infrastructure mismatches
        // that only survive from stale DB scores — suppress them.
        const RELIABLE_CLIENT_VETO = new Set(['transport_hub', 'office', 'shopping_district']);

        // Use DB/analysis.matches scores (Google Maps-based, authoritative) for gating.
        console.log('🔍 DEBUG - analysis.matches:', analysis.matches.map(m => `${m.categoryId}=${m.score}`).join(', '));
        
        const categories = analysis.matches.map(m => ({
          categoryId: m.categoryId,
          score: (RELIABLE_CLIENT_VETO.has(m.categoryId) && locationTypeMatches[m.categoryId]?.match_score === 0)
            ? 0
            : m.score,
          displayName: localeConfig.categories[m.categoryId]?.name || m.categoryId
        }));
        
        console.log('🔍 DEBUG - categories after veto logic:', categories.map(c => `${c.categoryId}=${c.score}`).join(', '));

        // Filter categories >= 60% AND geographic types only (exclude demographics)
        const eligibleCategories = categories.filter(cat => 
          cat.score >= 60 && GEOGRAPHIC_LOCATION_TYPES.has(cat.categoryId)
        );
        console.log(`🚀 Calling Edge Function for ${eligibleCategories.length} geographic categories (≥60%):`, eligibleCategories.map(c => c.categoryId).join(', '));
        
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
                locationType: category.categoryId,
                language: i18n.language === 'en' ? 'en' : 'da',
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
                seasonal_relevance: (SEASONAL_PATTERN_MAP[category.categoryId] !== 'year_round' ? 'high' : 'medium') as 'high' | 'medium' | 'low',
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
      setError(error instanceof Error ? error.message : t('location.errorAnalyzeFailed'));
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
        neighborhood: analysisData.city || null,
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

      const { error: saveError } = await (supabase as any)
        .from('business_location_intelligence')
        .upsert(dataToSave, {
          onConflict: 'business_id'
        });

      if (saveError) {
        console.error('❌ Auto-save error:', saveError);
        setError(t('location.errorSaveFailed'));
      } else {
        console.log('✅ Location profile auto-saved');
      }
    } catch (err) {
      console.error('❌ Unexpected auto-save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-surface-page min-h-full py-6 px-6">
      <div className="max-w-6xl mx-auto">
      {/* Progress indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-center gap-2 text-sm">
          <a href="/dashboard/profile" className="text-text-muted hover:text-text-secondary">{t('location.breadcrumb.profile')}</a>
          <span className="text-text-muted">→</span>
          <a href="/dashboard/menu" className="text-text-muted hover:text-text-secondary">{t('location.breadcrumb.menu')}</a>
          <span className="text-text-muted">→</span>
          <span className="bg-[#E6F4F1] text-brand font-medium px-3 py-1 rounded-lg">{t('location.breadcrumb.location')}</span>
          <span className="text-text-muted">→</span>
          <a href="/dashboard/brand-v5" className="text-text-muted hover:text-text-secondary">{t('location.breadcrumb.brand')}</a>
        </div>
      </div>

      <div className="text-center mb-4">
        <h1 className="text-xl font-medium text-brand mb-1">{t('location.title')}</h1>
        <p className="text-sm text-text-secondary">{t('location.subtitle')}</p>
      </div>

      {/* AI usage transparency banner — shown once analysis data exists */}
      {(analysis || lastAnalyzedAt) && (
        <div className="mb-4 px-4 py-3 bg-[#F0EEFE] border-[0.5px] border-[#C7BAF7] rounded-lg text-[13px] text-[#5547C4]">
          <strong className="font-medium text-[#3D339A]">{t('location.aiDataUsageLabel')}</strong> {t('location.aiDataUsageInfo')}
        </div>
      )}

      {/* Loading state */}
      {isLoadingAddress && (
        <div className="bg-surface rounded-lg border border-border p-6 mb-6">
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-3 text-text-muted">
              <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>{t('location.loadingAddress')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Address Display Card */}
      {!isLoadingAddress && (
        <div className="bg-surface rounded-lg border border-border p-4 mb-6">
          {address ? (
            <div className="space-y-4">
              {/* Read-only address display */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  {t('location.addressLabel')}
                </label>
                <div className="bg-[#F4F1EC] border-[0.5px] border-[#C8C3BB] rounded-lg px-3 py-2.5">
                  <p className="text-[15px] font-medium text-[#111714]">{address}</p>
                  <p className="text-[12px] text-[#A09A91] mt-2">
                    {t('location.addressNote')}
                    <a href="/dashboard/profile" className="text-[#076B4E] font-medium ml-1">
                      {t('location.addressNoteLink')}
                    </a>
                  </p>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-error-surface border border-error rounded-lg">
                  <p className="text-sm text-error">{error}</p>
                </div>
              )}

              {/* Cache gate: show info + prominent re-analyze button when analysis is < 7 days old */}
              {(() => {
                const GATE_DAYS = 7;
                const cacheAgeDays = lastAnalyzedAt
                  ? (Date.now() - new Date(lastAnalyzedAt).getTime()) / (1000 * 60 * 60 * 24)
                  : null;
                const isCacheRecent = cacheAgeDays !== null && cacheAgeDays < GATE_DAYS;

                if (isCacheRecent) {
                  return (
                    <div className="p-3 bg-surface-alt border border-border rounded-lg">
                      <p className="text-xs text-text-muted mb-2">
                        {t('location.cacheValid', { count: Math.round(cacheAgeDays!) })} — Re-analysér hvis I har skiftet lokation eller ændret jeres koncept.
                      </p>
                      {/* Task 4.5: Force refresh checkbox */}
                      <label className="flex items-center gap-2 mb-2 text-xs text-text-secondary cursor-pointer">
                        <input
                          type="checkbox"
                          checked={forceRefresh}
                          onChange={(e) => setForceRefresh(e.target.checked)}
                          className="rounded border-border text-info focus:ring-info"
                        />
                        <span>{t('location.forceRefreshShort')}</span>
                      </label>
                      <button
                        onClick={handleAnalyze}
                        disabled={isAnalyzing}
                        className="w-full px-4 py-2 text-sm font-medium border border-border rounded-lg text-text-secondary hover:bg-surface hover:border-brand hover:text-brand disabled:cursor-not-allowed transition-colors"
                      >
                        {isAnalyzing ? t('location.analyzing') : t('location.forceReanalyze')}
                      </button>
                    </div>
                  );
                }

                return (
                  <>
                    {/* Task 4.5: Force refresh checkbox for primary analyze button */}
                    <label className="flex items-center gap-2 mb-3 text-xs text-text-secondary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={forceRefresh}
                        onChange={(e) => setForceRefresh(e.target.checked)}
                        className="rounded border-border text-info focus:ring-info"
                      />
                      <span>{t('location.forceRefreshLong')}</span>
                    </label>
                    <button
                      onClick={handleAnalyze}
                      disabled={isAnalyzing}
                      className="w-full px-5 py-2.5 text-[13px] bg-cta text-text-inverse font-medium rounded-lg hover:bg-cta-hover disabled:bg-surface-alt disabled:cursor-not-allowed transition-colors"
                    >
                      {isAnalyzing ? t('location.analyzing') : t('location.analyzeButton')}
                    </button>
                  </>
                );
              })()}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-text-muted mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-brand mb-2">{t('location.noAddress')}</h3>
              <p className="text-text-secondary mb-4">
                {t('location.noAddressHint')}
              </p>
              <a
                href="/dashboard/profile"
                className="inline-flex items-center gap-2 px-6 py-3 bg-cta text-text-inverse font-medium rounded-lg hover:bg-cta-hover transition-colors"
              >
                {t('location.addAddressLink')}
              </a>
            </div>
          )}
        </div>
      )}

      {/* Concept Fit Results - Din Lokation hidden, only show final fit analysis */}
      {analysis && conceptFit && Object.keys(conceptFit).length > 0 && (
        <>
          {console.log('🎨 Rendering Concept Fit:', conceptFit)}
          
          {/* Optional: Uncomment to restore location type detection display
          <LocationAnalysisDisplay 
            analysis={analysis}
            conceptFits={conceptFit}
            onDeleteCategory={handleDeleteCategory}
          />
          */}
          
          {/* Show Concept Fit cards directly */}
          <div className="space-y-3">
            {(() => {
              const localeConfig = getLocaleConfig(uiLocale);
              const eligibleCategories = Object.entries(conceptFit)
                .filter(([categoryId]) => {
                  // Filter to geographic types only (exclude demographics: student, tourist)
                  if (!GEOGRAPHIC_LOCATION_TYPES.has(categoryId)) return false;
                  
                  // Use fresh scores (locationTypeScores) if available, else fall back to stored analysis
                  const score = locationTypeScores[categoryId] 
                    ?? (analysis.matches.find(m => m.categoryId === categoryId)?.score || 0);
                  return score >= 60;
                })
                .sort(([, a], [, b]) => {
                  if (a.is_strategy_driver) return -1;
                  if (b.is_strategy_driver) return 1;
                  const scoreA = locationTypeScores[a.area_type] 
                    ?? (analysis.matches.find(m => m.categoryId === a.area_type)?.score || 0);
                  const scoreB = locationTypeScores[b.area_type] 
                    ?? (analysis.matches.find(m => m.categoryId === b.area_type)?.score || 0);
                  return scoreB - scoreA;
                });

              return eligibleCategories
                .filter(([, fit]) => fit.fit_level !== 'challenging')
                .map(([categoryId, fit]) => {
                const categoryConfig = (localeConfig.categories as any)[categoryId];
                
                return (
                  <div key={categoryId} className="bg-surface rounded-lg border border-border p-6">
                    <div className="flex items-start gap-4 mb-4">
                      <LocationCategoryIcon categoryId={categoryId as any} className="w-10 h-10 text-[#0A7D5F]" />
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-xl font-medium text-brand">{categoryConfig.name}</h3>
                          {fit.is_strategy_driver && (
                            <span className="inline-flex items-center gap-1 bg-[#F0EEFE] text-[#3D339A] border-[0.5px] border-[#C7BAF7] rounded-full px-[10px] py-[3px] text-[11px] font-medium">
                              <MapPinIcon className="w-3 h-3 text-[#6B5CE7]" />
                              {t('location.strategyFocus')}
                            </span>
                          )}
                        </div>

                        {fit.ui_summary && (
                          <p className="text-[14px] font-medium text-[#3C3830] mb-3">
                            {fit.ui_summary.one_liner}
                          </p>
                        )}
                        {fit.fit_reasons && fit.fit_reasons.length > 0 && (
                          <div className="mb-3">
                            <p className="text-[11px] font-medium tracking-[0.07em] uppercase text-[#A09A91] mb-1">{t('location.strengths')}</p>
                            <ul className="text-[13px] text-[#5C5650] space-y-1" style={{lineHeight: '1.7'}}>
                              {fit.fit_reasons.map((reason: string, i: number) => (
                                <li key={i} className="flex items-start gap-2">
                                  <CheckCircleIcon className="w-[14px] h-[14px] text-[#0A7D5F] flex-shrink-0 mt-0.5" />
                                  <span>{reason}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {fit.marketing_implications && (
                          <div className="mt-3 bg-[#F0EEFE] border-[0.5px] border-[#C7BAF7] rounded-lg px-[14px] py-3">
                            <p className="text-[12px] font-medium text-[#3D339A] tracking-[0.05em] uppercase mb-1">{t('location.marketingStrategy')}</p>
                            {fit.marketing_implications.content_emphasis && fit.marketing_implications.content_emphasis.length > 0 ? (
                              <ul className="text-[13px] text-[#5547C4] space-y-1">
                                {fit.marketing_implications.content_emphasis.map((item: string, i: number) => (
                                  <li key={i}>&rarr; {item}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-[13px] text-[#5547C4]">{fit.ui_summary?.best_marketing_angle}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>

          {isSaving && (
            <div className="text-center text-sm text-text-secondary mt-4">
              {t('location.autoSaving')}
            </div>
          )}
        </>
      )}

      {/* Navigation buttons */}
      <div className="flex justify-between mt-6">
        <a
          href="/dashboard/menu"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm text-text-secondary border border-border rounded-lg hover:bg-surface-alt transition-colors"
        >
          {t('location.backToProfile')}
        </a>
        <a
          href="/dashboard/brand-v5"
          className="inline-flex items-center gap-2 px-6 py-2 text-sm bg-cta text-text-inverse font-medium rounded-lg hover:bg-cta-hover transition-colors"
        >
          {t('location.nextMenu')}
        </a>
      </div>
    </div>
    </div>
  )
}

export default LocationIntelligencePage
