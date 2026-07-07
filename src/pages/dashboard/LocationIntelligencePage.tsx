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

const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
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
  // Track which detail sections are expanded for each category
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (categoryId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

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
          
          // Parse landmarks_nearby if it's a JSON string
          let landmarksArray: any[] = [];
          if (savedData.landmarks_nearby) {
            if (typeof savedData.landmarks_nearby === 'string') {
              try {
                landmarksArray = JSON.parse(savedData.landmarks_nearby);
              } catch (e) {
                console.error('Failed to parse landmarks_nearby:', e);
              }
            } else if (Array.isArray(savedData.landmarks_nearby)) {
              landmarksArray = savedData.landmarks_nearby;
            }
          }
          
          // Reconstruct ALL matches from category_scores
          const matches: any[] = [];
          
          // Parse category_scores if it's a JSON string
          let categoryScoresData: Record<string, number> = {};
          if (savedData.category_scores) {
            if (typeof savedData.category_scores === 'string') {
              try {
                categoryScoresData = JSON.parse(savedData.category_scores);
              } catch (e) {
                console.error('Failed to parse category_scores:', e);
              }
            } else if (typeof savedData.category_scores === 'object') {
              categoryScoresData = savedData.category_scores as Record<string, number>;
            }
          }
          
          if (Object.keys(categoryScoresData).length > 0) {
            Object.entries(categoryScoresData)
              .sort(([, a], [, b]) => b - a) // Sort by score descending
              .forEach(([categoryId, score]) => {
                matches.push({
                  categoryId: categoryId as any,
                  score: score,
                  confidence: score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low',
                  reasoning: savedData.neighborhood_character ? [savedData.neighborhood_character] : [],
                  signals: categoryId === savedData.area_type 
                    ? landmarksArray.map((landmark: any) => ({
                        name: landmark.name || '',
                        type: landmark.type || 'landmark',
                        distance: landmark.distance || 0,
                        relevance: 1
                      }))
                    : []
                });
              });
          }
          
          // Fallback: if no scores, use area_type as single category
          if (matches.length === 0 && savedData.area_type) {
            matches.push({
              categoryId: savedData.area_type as any,
              score: 100,
              confidence: 'high' as const,
              reasoning: savedData.neighborhood_character ? [savedData.neighborhood_character] : [],
              signals: landmarksArray.map((landmark: any) => ({
                name: landmark.name || '',
                type: landmark.type || 'landmark',
                distance: landmark.distance || 0,
                relevance: 1
              }))
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
            culturalContext: (() => {
              // Parse location_marketing_hooks if needed
              let hooks: string[] = [];
              if (savedData.location_marketing_hooks) {
                if (typeof savedData.location_marketing_hooks === 'string') {
                  try {
                    hooks = JSON.parse(savedData.location_marketing_hooks);
                  } catch (e) {
                    console.error('Failed to parse location_marketing_hooks:', e);
                  }
                } else if (Array.isArray(savedData.location_marketing_hooks)) {
                  hooks = savedData.location_marketing_hooks;
                }
              }
              
              if (savedData.neighborhood_character || hooks.length > 0) {
                return {
                  significance: 'medium' as const,
                  description: savedData.neighborhood_character || '',
                  knownFor: hooks,
                };
              }
              return undefined;
            })(),
          };

          setAnalysis(reconstructedAnalysis);
          console.log('✅ Restored location analysis from database');

          // Track when the analysis was last run
          if ((savedData as any).last_updated_by_ai) {
            setLastAnalyzedAt((savedData as any).last_updated_by_ai);
          }
          
          // Also restore concept fit data if available - handle both parsed and string formats
          const savedDataAny = savedData as any;
          if (savedDataAny.concept_fit_by_category) {
            let conceptFitData = savedDataAny.concept_fit_by_category;
            
            // Parse if it's a JSON string
            if (typeof conceptFitData === 'string') {
              try {
                conceptFitData = JSON.parse(conceptFitData);
              } catch (e) {
                console.error('Failed to parse concept_fit_by_category:', e);
                conceptFitData = {};
              }
            }
            
            if (typeof conceptFitData === 'object' && Object.keys(conceptFitData).length > 0) {
              setConceptFit(conceptFitData);
              console.log('✅ Restored concept fit from database');
            } else {
              console.log('ℹ️ concept_fit_by_category is empty - user needs to run analysis');
            }
          } else {
            console.log('ℹ️ No concept_fit_by_category in database - user needs to run analysis');
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
    if (!businessId) {
      setError('No business ID found');
      return;
    }

    try {
      setIsAnalyzing(true);
      setError(null);
      
      // Call the REAL backend Edge Function that generates schema v2 with separated demographic_proximity
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;
      
      if (!accessToken) {
        throw new Error('No access token - please log in');
      }
      
      console.log('📡 Calling populate-location-intelligence Edge Function (schema v2)...');
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/populate-location-intelligence`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ 
          business_id: businessId,
          address_override: address.trim() || undefined,
          force_refresh: forceRefresh
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Edge Function failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Edge Function Response:', data);
      
      if (!data.success) {
        throw new Error(data.error || 'Location intelligence generation failed');
      }

      // Reload location intelligence from database to get the saved schema v2 data
      console.log('📥 Loading saved location intelligence from database...');
      const { data: locationData, error: loadError } = await supabase
        .from('business_location_intelligence')
        .select('*')
        .eq('business_id', businessId)
        .maybeSingle();

      if (loadError) {
        throw new Error(`Failed to load location data: ${loadError.message}`);
      }

      if (!locationData) {
        throw new Error('No location data found after generation - AI analysis may have failed and fallback was not saved');
      }

      console.log('✅ Location intelligence loaded (schema v2):');
      console.log('   category_scores:', locationData.category_scores);
      console.log('   demographic_proximity:', locationData.demographic_proximity);
      console.log('   area_type:', locationData.area_type);
      console.log('   neighborhood:', locationData.neighborhood);

      // Convert to the format expected by the UI
      const categoryScores = locationData.category_scores || {};
      const demographicProximity = locationData.demographic_proximity || {};
      
      // Create matches array from category_scores (geographic types only)
      const matches = Object.entries(categoryScores)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .map(([categoryId, score]) => ({
          categoryId,
          score: score as number,
          signals: locationData.landmarks_nearby || []
        }));

      const analysis: LocationAnalysis = {
        address: locationData.local_location_reference || '',
        coordinates: {
          lat: locationData.latitude || 0,
          lng: locationData.longitude || 0
        },
        country: 'DK' as const,
        city: locationData.neighborhood || locationData.local_location_reference || '',
        locale: 'da-DK',
        primaryCategory: (matches[0]?.categoryId || 'city_centre') as LocationCategoryId,
        analyzedAt: new Date().toISOString(),
        matches: matches as any, // Type cast for Json compatibility
        culturalContext: {
          description: locationData.neighborhood_character || '',
          knownFor: locationData.location_marketing_hooks || [],
          significance: 'medium' as const
        }
      };

      setAnalysis(analysis);

      // Display demographic_proximity separately
      console.log('📊 Schema V2 Demographics (separate field):');
      Object.entries(demographicProximity).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
      });

      // Concept fit analysis on geographic categories only (not demographics)
      const businessData = await loadBusinessData();
      if (businessData && matches.length > 0) {
        const localeConfig = getLocaleConfig('da-DK');
        
        const categories = matches.map(m => ({
          categoryId: m.categoryId,
          score: m.score,
          displayName: (localeConfig.categories as any)[m.categoryId]?.name || m.categoryId
        }));
        
        // Filter top 3 categories >= 50% AND geographic types only
        const eligibleCategories = categories
          .filter(cat => cat.score >= 50 && GEOGRAPHIC_LOCATION_TYPES.has(cat.categoryId))
          .sort((a, b) => b.score - a.score)
          .slice(0, 3);
        
        console.log(`🚀 Calling concept fit for top ${eligibleCategories.length} geographic categories (≥50%, max 3):`, eligibleCategories.map(c => c.categoryId).join(', '));
        
        let fitResults: Record<string, ConceptFitOutput> = {};
        
        // Call Edge Function for concept fit
        for (let i = 0; i < eligibleCategories.length; i++) {
          const category = eligibleCategories[i];
          const isStrategyDriver = i === 0;
          
          try {
            const { data: edgeFunctionData, error: edgeFunctionError } = await supabase.functions.invoke('analyze-concept-fit', {
              body: {
                businessId: businessId,
                locationType: category.categoryId,
                language: i18n.language === 'en' ? 'en' : 'da',
              }
            });
            
            if (edgeFunctionError) throw edgeFunctionError;
            
            if (edgeFunctionData?.success && edgeFunctionData.conceptFit) {
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
            }
          } catch (edgeError) {
            console.warn(`⚠️ Concept fit failed for ${category.categoryId}:`, edgeError);
          }
        }
        
        setConceptFit(fitResults);
        
        // Save concept fit to database for future page loads
        if (Object.keys(fitResults).length > 0 && analysis) {
          console.log('💾 Saving concept fit to database...');
          await saveLocationProfile(analysis, fitResults);
        }
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
          <a href="/dashboard/brand" className="text-text-muted hover:text-text-secondary">{t('location.breadcrumb.brand')}</a>
        </div>
      </div>

      <div className="text-center mb-4">
        <h1 className="text-xl font-medium text-brand mb-1">{t('location.title')}</h1>
        <p className="text-sm text-text-secondary">{t('location.subtitle')}</p>
      </div>

      {/* AI usage transparency banner — shown once analysis data exists */}
      {(analysis || lastAnalyzedAt) && (
        <div className="mb-4 px-4 py-3 bg-[#F0EEFE] border-[0.5px] border-[#C7BAF7] rounded-lg text-[13px] text-[#5547C4]">
          {t('location.aiDataUsageInfo')}
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

      {/* Location Overview - Always show when analysis exists */}
      {analysis && (
        <div className="bg-surface rounded-lg border border-border p-6 mb-6">
          <div className="flex items-start gap-4 mb-4">
            <MapPinIcon className="w-10 h-10 text-[#0A7D5F]" />
            <div className="flex-1">
              <h3 className="text-xl font-medium text-brand mb-2">{t('location.basicDataTitle', 'Lokationsdata')}</h3>
              
              {analysis.city && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-text-muted mb-1">{t('location.neighborhood', 'Neighborhood')}</p>
                  <p className="text-sm text-brand font-medium">{analysis.city}</p>
                </div>
              )}
              
              {analysis.culturalContext?.description && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-text-muted mb-1">{t('location.character', 'Area Character')}</p>
                  <p className="text-sm text-text">{analysis.culturalContext.description}</p>
                </div>
              )}
              
              {analysis.matches && analysis.matches.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-text-muted mb-2">{t('location.locationTypes', 'Location Types')}</p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.matches
                      .filter(m => m.score >= 50)
                      .sort((a, b) => b.score - a.score)
                      .slice(0, 3)
                      .map(match => (
                        <div key={match.categoryId} className="inline-flex items-center gap-2 bg-surface-alt border border-border rounded-lg px-3 py-1.5">
                          <LocationCategoryIcon categoryId={match.categoryId} className="w-4 h-4 text-text-secondary" />
                          <span className="text-xs text-text">{match.categoryId.replace(/_/g, ' ')}</span>
                          <span className="text-xs font-medium text-text-muted">{Math.round(match.score)}%</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
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
                  return score >= 50;
                })
                .sort(([, a], [, b]) => {
                  if (a.is_strategy_driver) return -1;
                  if (b.is_strategy_driver) return 1;
                  const scoreA = locationTypeScores[a.area_type] 
                    ?? (analysis.matches.find(m => m.categoryId === a.area_type)?.score || 0);
                  const scoreB = locationTypeScores[b.area_type] 
                    ?? (analysis.matches.find(m => m.categoryId === b.area_type)?.score || 0);
                  return scoreB - scoreA;
                })
                .slice(0, 3); // Limit to top 3 highest scoring categories

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
                            <button
                              onClick={() => toggleSection(categoryId)}
                              className="flex items-center gap-2 w-full text-left group hover:opacity-80 transition-opacity"
                            >
                              <p className="text-[11px] font-medium tracking-[0.07em] uppercase text-[#A09A91]">{t('location.strengths')}</p>
                              <ChevronDownIcon 
                                className={`w-3 h-3 text-[#A09A91] transition-transform ${
                                  expandedSections[categoryId] ? 'rotate-180' : ''
                                }`}
                              />
                            </button>
                            {expandedSections[categoryId] && (
                              <ul className="text-[13px] text-[#5C5650] space-y-1 mt-1" style={{lineHeight: '1.7'}}>
                                {fit.fit_reasons.map((reason: string, i: number) => (
                                  <li key={i} className="flex items-start gap-2">
                                    <CheckCircleIcon className="w-[14px] h-[14px] text-[#0A7D5F] flex-shrink-0 mt-0.5" />
                                    <span>{reason}</span>
                                  </li>
                                ))}
                              </ul>
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

      {/* Fallback: Show message when analysis exists but no concept fit */}
      {analysis && (!conceptFit || Object.keys(conceptFit).length === 0) && (
        <div className="bg-surface rounded-lg border border-border p-6 mb-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="flex-1">
              <p className="text-sm text-text-secondary">
                {t('location.basicDataSubtitle', 'Din lokation er analyseret. Detaljeret konceptanalyse genereres når kategori-scores er højere (≥40%).')}
              </p>
              <p className="text-xs text-text-muted mt-3">
                💡 {t('location.lowScoreHint', 'Tip: Scores under 40% udløser ikke detaljeret konceptanalyse. Dette er normalt for unikke lokationer.')}
              </p>
            </div>
          </div>
        </div>
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
