'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LocationAnalysis, LocationCategoryId } from '../../lib/location/core/types';
import type { SupportedLocale } from '../../lib/location/core/types';
import { LocationCategoryIcon } from '../../components/setup/LocationCategoryIcon';
import { supabase } from '../../lib/supabase';
import { getLocaleConfig } from '../../lib/location/locales';

const MapPinIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
    <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
  </svg>
);




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
  const [error, setError] = useState<string | null>(null);
  const [savedLocationData, setSavedLocationData] = useState<any | null>(null);
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
          
          // Store the full saved data for use in UI rendering
          setSavedLocationData(savedData);
          
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
                  categoryId: categoryId as LocationCategoryId,
                  score: score,
                  confidence: score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low',
                  reasoning: savedData.neighborhood_character ? [savedData.neighborhood_character] : [],
                  signals: categoryId === savedData.area_type 
                    ? landmarksArray.map((landmark: any) => ({
                        name: landmark.name || '',
                        type: landmark.type || 'landmark',
                        distance: landmark.distance || 0,
                        weight: 1
                      }))
                    : []
                });
              });
          }
          
          // Fallback: if no scores, use area_type as single category
          if (matches.length === 0 && savedData.area_type) {
            matches.push({
              categoryId: savedData.area_type as LocationCategoryId,
              score: 100,
              confidence: 'high' as const,
              reasoning: savedData.neighborhood_character ? [savedData.neighborhood_character] : [],
              signals: landmarksArray.map((landmark: any) => ({
                name: landmark.name || '',
                type: landmark.type || 'landmark',
                distance: landmark.distance || 0,
                weight: 1
              }))
            });
          }
          
          // Reconstruct the analysis object from saved data
          const reconstructedAnalysis: LocationAnalysis = {
            address: address || `${savedData.neighborhood || 'Din lokation'}`,
            city: savedData.neighborhood || savedData.neighborhood_character || 'Din lokation',
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
          console.log('📊 Analysis summary:', {
            city: reconstructedAnalysis.city,
            primaryCategory: reconstructedAnalysis.primaryCategory,
            matchesCount: reconstructedAnalysis.matches.length,
            hasculturalContext: !!reconstructedAnalysis.culturalContext
          });

          // Track when the analysis was last run
          if ((savedData as any).last_updated_by_ai) {
            setLastAnalyzedAt((savedData as any).last_updated_by_ai);
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
        .single();

      if (loadError) {
        throw new Error(`Failed to load location data: ${loadError.message}`);
      }

      if (!locationData) {
        throw new Error('No location data found after generation');
      }

      console.log('✅ Location intelligence loaded (schema v2):');
      console.log('   category_scores:', (locationData as any).category_scores);
      console.log('   demographic_proximity:', (locationData as any).demographic_proximity);
      console.log('   area_type:', (locationData as any).area_type);
      console.log('   neighborhood:', (locationData as any).neighborhood);

      // Store the full saved data for use in UI rendering
      setSavedLocationData(locationData);

      // Convert to the format expected by the UI
      const categoryScores = (locationData as any).category_scores || {};
      
      // Create matches array from category_scores (geographic types only)
      const matches = Object.entries(categoryScores)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .map(([categoryId, score]) => ({
          categoryId: categoryId as LocationCategoryId,
          score: score as number,
          confidence: (score as number) >= 70 ? 'high' as const : (score as number) >= 40 ? 'medium' as const : 'low' as const,
          reasoning: [(locationData as any).neighborhood_character || ''].filter(Boolean) as string[],
          signals: (Array.isArray((locationData as any).landmarks_nearby) ? (locationData as any).landmarks_nearby : []).map((landmark: any) => ({
            name: landmark.name || '',
            type: landmark.type || 'landmark',
            distance: landmark.distance || 0,
            weight: 1
          }))
        }));

      const analysis: LocationAnalysis = {
        address: address || '',
        city: (locationData as any).city || (locationData as any).neighborhood || '',
        country: 'DK',
        locale: 'da-DK',
        primaryCategory: (matches[0]?.categoryId || 'city_centre') as LocationCategoryId,
        analyzedAt: new Date().toISOString(),
        culturalContext: {
          significance: 'medium' as const,
          description: (locationData as any).neighborhood_character || '',
          knownFor: (locationData as any).location_marketing_hooks || []
        },
        matches: matches,
        coordinates: {
          lat: (locationData as any).latitude || 0,
          lng: (locationData as any).longitude || 0
        }
      };

      setAnalysis(analysis);

      console.log('✅ Location intelligence analysis complete');
    } catch (error) {
      console.error('Location analysis error:', error);
      setError(error instanceof Error ? error.message : t('location.errorAnalyzeFailed'));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const saveLocationProfile = async (
    analysisData: LocationAnalysis,
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

  // Use saveLocationProfile if needed in the future
  console.log('saveLocationProfile available:', typeof saveLocationProfile);

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

      {/* Location Intelligence Results - Factual Display */}
      {analysis && savedLocationData && (
        <>
          <div className="space-y-4">
            {/* Section 1: Location Types (category_scores, top 3 with score ≥ 50) */}
            {(() => {
              const localeConfig = getLocaleConfig(uiLocale);
              const categoryScores = (savedLocationData as any).category_scores || {};
              const topCategories = Object.entries(categoryScores)
                .filter(([_, score]) => (score as number) >= 50)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .slice(0, 3);

              if (topCategories.length === 0) return null;

              return (
                <div className="bg-surface rounded-lg border border-border p-6">
                  <h3 className="text-lg font-medium text-brand mb-4">Lokationstyper</h3>
                  <div className="space-y-3">
                    {topCategories.map(([categoryId, score]) => {
                      const categoryConfig = (localeConfig.categories as any)[categoryId];
                      if (!categoryConfig) return null;

                      return (
                        <div key={categoryId} className="flex items-center gap-3">
                          <LocationCategoryIcon categoryId={categoryId as any} className="w-8 h-8 text-[#0A7D5F]" />
                          <div className="flex-1">
                            <p className="text-[15px] font-medium text-[#111714]">{categoryConfig.name}</p>
                            <p className="text-[13px] text-[#5C5650]">Score: {Math.round(score as number)}%</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Section 2: WHO - Physical Anchor Taxonomy v3 */}
            {(() => {
              const who = (savedLocationData as any).who;
              const whoLabels: Record<string, string> = {
                local_resident: 'Lokale beboere',
                office_worker: 'Kontoransatte',
                student: 'Studerende',
                shopper: 'Shoppende',
                tourist: 'Turister/besøgende',
                commuter: 'Pendlere',
                leisure_walker: 'Fritidsgæster',
                family: 'Familier',
                medical_staff: 'Hospitalspersonale',
                hospital_visitor: 'Hospitalsbesøgende',
                event_visitor: 'Eventgæster',
                business_professional: 'Kontoransatte',
              };

              // V3: Use WHO field if available, otherwise fall back to demographic_proximity (v2)
              if (who && (who.primary?.length > 0 || who.secondary?.length > 0)) {
                return (
                  <div className="bg-surface rounded-lg border border-border p-6">
                    <h3 className="text-lg font-medium text-brand mb-4">Hvem er i området</h3>
                    <div className="space-y-4">
                      {who.primary && who.primary.length > 0 && (
                        <div>
                          <p className="text-[13px] font-medium text-[#5C5650] mb-2">Primær (70%+ tilstedeværelse)</p>
                          <div className="space-y-1">
                            {who.primary.map((whoType: string) => (
                              <div key={whoType} className="flex items-center gap-2">
                                <span className="text-[14px] text-[#0A7D5F] font-medium">●</span>
                                <span className="text-[14px] text-[#3C3830]">{whoLabels[whoType] || whoType}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {who.secondary && who.secondary.length > 0 && (
                        <div>
                          <p className="text-[13px] font-medium text-[#5C5650] mb-2">Sekundær (30-70% tilstedeværelse)</p>
                          <div className="space-y-1">
                            {who.secondary.map((whoType: string) => (
                              <div key={whoType} className="flex items-center gap-2">
                                <span className="text-[14px] text-[#8A8577]">○</span>
                                <span className="text-[14px] text-[#3C3830]">{whoLabels[whoType] || whoType}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {who.notes && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <p className="text-[13px] text-[#5C5650] italic">{who.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              
              // V2 fallback: demographic_proximity
              const demographicProximity = (savedLocationData as any).demographic_proximity || {};
              const demographicLabels: Record<string, string> = {
                local_resident: 'Lokale beboere',
                office_worker: 'Kontorarbejdere',
                business_professional: 'Kontorarbejdere', // alias
                tourist: 'Turister og besøgende',
                student: 'Studerende',
                family: 'Familier',
                shopper: 'Shoppende',
              };

              const demographics = Object.entries(demographicProximity)
                .filter(([key]) => key !== 'business_professional' || !demographicProximity.office_worker)
                .sort(([, a], [, b]) => (b as number) - (a as number));

              if (demographics.length === 0) return null;

              return (
                <div className="bg-surface rounded-lg border border-border p-6">
                  <h3 className="text-lg font-medium text-brand mb-4">Hvem er i området</h3>
                  <div className="space-y-2">
                    {demographics.map(([key, score]) => {
                      const label = demographicLabels[key] || key;
                      return (
                        <div key={key} className="flex items-center justify-between">
                          <span className="text-[14px] text-[#3C3830]">{label}</span>
                          <span className="text-[14px] font-medium text-[#0A7D5F]">{Math.round(score as number)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Section 2b: TRAFFIC RHYTHM - When does this location generate foot traffic */}
            {(() => {
              const trafficRhythm = (savedLocationData as any).traffic_rhythm;
              if (!trafficRhythm) return null;

              const weeklyPatternLabels: Record<string, string> = {
                'friday_saturday_peak': 'Fredag–lørdag peak',
                'saturday_dominant':    'Lørdag dominerer',
                'weekend_peak':         'Weekend peak',
                'weekday_lunch_only':   'Hverdagsfrokost',
                'all_week_even':        'Jævn hele ugen',
                'monday_friday_even':   'Mandag–fredag + weekend',
                'semester_only':        'Semesterbaseret',
                // Legacy support
                weekday: 'Hverdage',
                weekend: 'Weekend',
                both: 'Begge dage',
              };

              const seasonalPatternLabels: Record<string, string> = {
                stable: 'Stabil året rundt',
                summer_peak: 'Sommertoppen',
                semester_only: 'Kun semestertid',
                retail_calendar: 'Detailhandelskalender',
              };

              return (
                <div className="bg-surface rounded-lg border border-border p-6">
                  <h3 className="text-lg font-medium text-brand mb-4">Trafikrytme</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-[13px] font-medium text-[#5C5650]">Ugentligt mønster</p>
                      <p className="text-[14px] text-[#3C3830]">{weeklyPatternLabels[trafficRhythm.weekly_pattern || trafficRhythm.peak_days] || trafficRhythm.weekly_pattern || trafficRhythm.peak_days}</p>
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-[#5C5650]">Peak-timer</p>
                      <p className="text-[14px] text-[#3C3830]">{trafficRhythm.peak_hours}</p>
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-[#5C5650]">Døde perioder</p>
                      <p className="text-[14px] text-[#3C3830]">{trafficRhythm.dead_periods}</p>
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-[#5C5650]">Sæsonmønster</p>
                      <p className="text-[14px] text-[#3C3830]">{seasonalPatternLabels[trafficRhythm.seasonal_pattern] || trafficRhythm.seasonal_pattern}</p>
                    </div>
                    {trafficRhythm.seasonal_note && (
                      <div className="mt-2 pt-2 border-t border-border">
                        <p className="text-[13px] text-[#5C5650] italic">{trafficRhythm.seasonal_note}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Section 3: Physical Context */}
            {(() => {
              const physicalContext = (savedLocationData as any).physical_context;
              const nearbyHospitality = (savedLocationData as any).nearby_hospitality;

              if (!physicalContext && !nearbyHospitality) return null;

              const pedestrianFlowLabels: Record<string, string> = {
                very_high: 'Meget høj',
                high: 'Høj',
                medium: 'Middel',
                low: 'Lav',
              };

              return (
                <div className="bg-surface rounded-lg border border-border p-6">
                  <h3 className="text-lg font-medium text-brand mb-4">Fysisk kontekst</h3>
                  <div className="space-y-3">
                    {physicalContext && (
                      <>
                        <div>
                          <p className="text-[12px] font-medium text-[#A09A91] uppercase tracking-wider mb-1">Fodgængerflow</p>
                          <p className="text-[14px] text-[#3C3830]">{pedestrianFlowLabels[physicalContext.pedestrian_flow] || physicalContext.pedestrian_flow}</p>
                        </div>
                        {physicalContext.transit_within_150m && (
                          <div>
                            <p className="text-[12px] font-medium text-[#A09A91] uppercase tracking-wider mb-1">Offentlig transport</p>
                            <p className="text-[14px] text-[#3C3830]">
                              {physicalContext.nearest_transit?.name 
                                ? `${physicalContext.nearest_transit.name} (${Math.round(physicalContext.nearest_transit.distance_meters)}m)`
                                : 'Inden for 150m'}
                            </p>
                          </div>
                        )}
                        {physicalContext.parking_within_300m && (
                          <div>
                            <p className="text-[12px] font-medium text-[#A09A91] uppercase tracking-wider mb-1">Parkering</p>
                            <p className="text-[14px] text-[#3C3830]">Inden for 300m</p>
                          </div>
                        )}
                      </>
                    )}
                    {nearbyHospitality && (
                      <div>
                        <p className="text-[12px] font-medium text-[#A09A91] uppercase tracking-wider mb-1">Hospitality i området</p>
                        <p className="text-[14px] text-[#3C3830]">
                          {nearbyHospitality.total_count} steder inden for {nearbyHospitality.radius_meters}m
                          {nearbyHospitality.breakdown && (
                            <span className="text-[#5C5650] ml-1">
                              ({nearbyHospitality.breakdown.restaurant || 0} restauranter, 
                              {nearbyHospitality.breakdown.cafe || 0} cafeer, 
                              {nearbyHospitality.breakdown.bar || 0} barer)
                            </span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
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
