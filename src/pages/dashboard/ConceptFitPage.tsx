'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ConceptFitOutput } from '../../lib/location/conceptFitAnalyzer';
import { getLocaleConfig } from '../../lib/location/locales';

interface LocationData {
  concept_fit_by_category?: Record<string, ConceptFitOutput>;
  category_scores?: Record<string, number>;
}

export default function ConceptFitPage() {
  const [loading, setLoading] = useState(true);
  const [conceptFits, setConceptFits] = useState<Record<string, ConceptFitOutput> | null>(null);
  const [categoryScores, setCategoryScores] = useState<Record<string, number>>({});
  const [businessType, setBusinessType] = useState<string | null>(null);
  
  const [error, setError] = useState<string | null>(null);
  const [selectedAbbr, setSelectedAbbr] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);

  useEffect(() => {
    loadConceptFitData();
  }, []);

  const loadConceptFitData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) {
        setError('Bruger ikke logget ind');
        return;
      }

      // Get business and type (minimal safe columns)
      const { data: business } = await (supabase as any)
        .from('businesses')
        .select('id, category, vertical, name, logo_url')
        .eq('owner_id', user.id)
        .single();

      if (!business) {
        setError('Ingen virksomhed fundet');
        return;
      }

      // Set business type for display (prefer explicit category, fallback to vertical/name)
      const bizType = (business as any).category || (business as any).vertical || (business as any).name || null;
      setBusinessType(bizType);
      setBusinessId((business as any).id || null);

      // Try to fetch capability columns if the DB has them (safe: ignore failures)
      let hasTableFlag = false
      let menusList: string[] = []
      try {
        const { data: caps } = await (supabase as any)
          .from('businesses')
          .select('has_table_seating, menus')
          .eq('id', (business as any).id)
          .maybeSingle()
        if (caps) {
          hasTableFlag = Boolean((caps as any).has_table_seating)
          menusList = Array.isArray((caps as any).menus) ? (caps as any).menus : []
        }
      } catch (err) {
        // ignore - column may not exist yet
      }

      // Auto-select common abbreviation based on category/vertical/name heuristics and DB signals
      const pickAbbr = (cat?: string, vert?: string, name?: string, hasTable?: boolean, menus?: string[]) => {
        const text = `${cat || ''} ${vert || ''} ${name || ''}`.toLowerCase();
        // If DB signals table seating and menus, prefer FSE
        if (hasTable || (menus && menus.length > 0)) return 'FSE'
        if (/restaurant|menu|full[ -]?service|dining|table|sit[- ]down|bistro|brasserie/.test(text)) return 'FSE'
        if (/coffee|cafe|espresso|latte|barista|brew/.test(text)) return 'SBO'
        if (/food truck|mobile food|street food|truck/.test(text)) return 'MFV'
        if (/pre-?pack|prepack|dispenser|vending/.test(text)) return 'MFD'
        if (/fast food|burger|qsr|takeaway|kebab|pizza|fries/.test(text)) return 'QSR'
        return 'FSE'
      }

      // If user previously saved a preferred abbreviation, prefer that and do not overwrite it.
      let persistedAbbr: string | null = null
      try {
        const { data: profile } = await (supabase as any)
          .from('business_profile')
          .select('target_audience')
          .eq('business_id', (business as any).id)
          .maybeSingle()
        if (profile && profile.target_audience) {
          persistedAbbr = profile.target_audience as string
        }
      } catch (e) {
        // ignore - table/column may not exist yet
      }

      if (persistedAbbr) {
        setSelectedAbbr(persistedAbbr)
      } else {
        const abbr = pickAbbr((business as any).category, (business as any).vertical, (business as any).name, hasTableFlag, menusList)
        setSelectedAbbr(abbr)

        // Persist automatic selection only when there is no user-saved value
        try {
          await (supabase as any)
            .from('business_profile')
            .upsert({ business_id: (business as any).id, target_audience: abbr }, { onConflict: 'business_id' })
        } catch (e) {
          console.warn('Failed to persist abbreviation', e)
        }
      }

      // Load location intelligence data (includes concept fit)
      const { data: locationData, error: loadError } = await (supabase as any)
        .from('business_location_intelligence')
        .select('concept_fit_by_category, category_scores')
        .eq('business_id', (business as any).id)
        .maybeSingle();

      if (loadError) {
        console.error('Error loading concept fit:', loadError);
        setError('Fejl ved indlæsning af data');
        return;
      }

      if (!locationData?.concept_fit_by_category) {
        setError('Ingen koncept fit data fundet. Analyser din lokation først.');
        return;
      }

      const data = locationData as LocationData;
      setConceptFits(data.concept_fit_by_category || null);
      setCategoryScores(data.category_scores || {});

    } catch (err) {
      console.error('Error:', err);
      setError('Uventet fejl');
    } finally {
      setLoading(false);
    }
  };

  const getFitBadge = (fitLevel: string) => {
    switch (fitLevel) {
      case 'strong': return { emoji: '✅', label: 'Stærk Match', color: 'bg-green-100 text-green-800 border-green-300' };
      case 'moderate': return { emoji: '🟡', label: 'Moderat Match', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' };
      case 'challenging': return { emoji: '⚠️', label: 'Udfordrende Match', color: 'bg-amber-100 text-amber-800 border-amber-300' };
      default: return { emoji: '❓', label: 'Ukendt', color: 'bg-gray-100 text-gray-800 border-gray-300' };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Indlæser koncept fit analyse...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">{error}</p>
                <a 
                  href="/dashboard/location" 
                  className="mt-3 inline-flex items-center px-4 py-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 text-sm font-medium rounded-md transition-colors"
                >
                  Gå til Lokationsanalyse
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!conceptFits || Object.keys(conceptFits).length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎯</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Ingen Koncept Fit Data</h2>
            <p className="text-gray-600 mb-6">Analyser din lokation først for at se koncept fit</p>
            <a 
              href="/dashboard/location" 
              className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Analyser Lokation
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Filter categories with score >= 60%
  const eligibleCategories = Object.entries(conceptFits)
    .filter(([categoryId]) => {
      const score = categoryScores[categoryId] || 0;
      return score >= 60;
    })
    .sort(([, a], [, b]) => {
      // Sort by strategy driver first, then by score
      if (a.is_strategy_driver) return -1;
      if (b.is_strategy_driver) return 1;
      return (categoryScores[a.area_type] || 0) - (categoryScores[b.area_type] || 0);
    });

  const localeConfig = getLocaleConfig('da-DK');

  const commonAbbreviations = [
    { abbr: 'FSE', text: 'Food Service Establishment (broad, full-service operators)' },
    { abbr: 'SBO', text: 'Specialty Beverage Operator / Limited Service Restaurant' },
    { abbr: 'MFV', text: 'Mobile Food Vehicle / Mobile Food Preparer' },
    { abbr: 'MFD', text: 'Mobile Food Dispenser (pre-packaged)' },
    { abbr: 'QSR', text: 'Quick Service Restaurant / Fast Food' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
              <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-gray-900">🎯 Koncept Fit Analyse</h1>
                {businessType && (
                  <span className="inline-block px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium border border-gray-200">
                    {businessType}
                  </span>
                )}
                {/* Small business type badge only (capabilities removed) */}
              </div>
              <p className="text-gray-600 mt-2">
                Detaljeret analyse af hvordan dit koncept passer til hver lokationstype
              </p>
            </div>
            <a 
              href="/dashboard/location" 
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              ← Tilbage til Lokation
            </a>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>💡 Tip:</strong> Denne analyse viser hvorfor dit koncept passer (eller ikke passer) til hver lokationstype baseret på åbningstider, priser, service og menu.
            </p>
          </div>
          {/* Common abbreviations small frame */}
          <div className="mt-4">
            <div className="bg-white border border-gray-200 rounded-md p-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-gray-900">Forkortelser</h4>
                <span className="text-xs text-gray-500">Almindelige branchestandarder</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {commonAbbreviations.map((it) => (
                    <button
                      key={it.abbr}
                      type="button"
                      onClick={async () => {
                        setSelectedAbbr(it.abbr)
                        try {
                          if (businessId) {
                            await (supabase as any)
                              .from('business_profile')
                              .upsert({ business_id: businessId, target_audience: it.abbr }, { onConflict: 'business_id' })
                          }
                        } catch (e) {
                          console.warn('Failed to persist abbreviation', e)
                        }
                      }}
                      className={`text-left w-full flex items-start gap-3 p-2 border rounded text-sm ${selectedAbbr === it.abbr ? 'border-blue-600 bg-blue-50' : ''}`}
                    >
                      <div className="w-12 h-8 flex items-center justify-center bg-gray-50 border border-gray-100 rounded font-semibold text-gray-800">{it.abbr}</div>
                      <div className="text-xs text-gray-700">{it.text}</div>
                    </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Concept Fit Cards */}
        <div className="space-y-6">
          {eligibleCategories.map(([categoryId, fit]) => {
            const score = categoryScores[categoryId] || 0;
            const categoryContent = (localeConfig.categories as any)[categoryId];
            const badge = getFitBadge(fit.fit_level);

            return (
              <div 
                key={categoryId}
                className="bg-white rounded-lg shadow-md border-2 border-gray-200 overflow-hidden"
              >
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-50 to-cta-surface p-6 border-b border-gray-200">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <span className="text-5xl">{categoryContent.icon}</span>
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-1">{categoryContent.name}</h2>
                        <p className="text-gray-600 text-sm mb-3">{categoryContent.definition}</p>
                        <div className="flex items-center gap-3">
                          {fit.is_strategy_driver && (
                            <span className="inline-block px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                              📍 Strategisk Fokus
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fit Level */}
                <div className={`p-6 border-b border-gray-200 ${badge.color}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-3xl">{badge.emoji}</span>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold mb-2">{badge.label}</h3>
                      <p className="text-base mb-2">{fit.ui_summary.one_liner}</p>
                      <div className="text-sm">
                        💡 <span className="font-medium">Marketing vinkel:</span> {fit.ui_summary.best_marketing_angle}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Detailed Fit Reasons */}
                {fit.fit_reasons && fit.fit_reasons.length > 0 && (
                  <div className="p-6 bg-gray-50 border-b border-gray-200">
                    <h4 className="font-semibold text-gray-900 mb-3">✅ Hvorfor det passer:</h4>
                    <ul className="space-y-2">
                      {fit.fit_reasons.map((reason, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                          <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Marketing Implications */}
                {fit.marketing_implications && fit.marketing_implications.content_emphasis && fit.marketing_implications.content_emphasis.length > 0 && (
                  <div className="p-6 border-b border-gray-200">
                    <h4 className="font-semibold text-gray-900 mb-3">📢 Marketing Implikationer:</h4>
                    <div className="space-y-3">
                      <div>
                        <h5 className="text-sm font-medium text-gray-600 mb-2">Content Fokus:</h5>
                        <div className="flex flex-wrap gap-2">
                          {fit.marketing_implications.content_emphasis.map((emphasis, idx) => (
                            <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                              {emphasis}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h5 className="text-sm font-medium text-gray-600 mb-1">CTA Style:</h5>
                        <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                          {fit.marketing_implications.cta_style}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Watchouts */}
                {fit.watchouts && fit.watchouts.length > 0 && (
                  <div className="p-6 bg-amber-50">
                    <h4 className="font-semibold text-amber-900 mb-3">⚠️ Opmærksomhedspunkter:</h4>
                    <ul className="space-y-2">
                      {fit.watchouts.map((watchout, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-amber-800">
                          <span className="text-amber-500 mt-0.5 flex-shrink-0">⚠</span>
                          <span>{watchout}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {eligibleCategories.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-600">Ingen lokationstyper med score ≥ 60% fundet</p>
          </div>
        )}
      </div>
    </div>
  );
}
