import React, { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { useBrandProfileV5Generation } from '@/hooks/useBrandProfileV5Generation';
import { useProgrammeProfiles } from '@/hooks/useProgrammeProfiles';
import { GenerationProgress } from '@/components/brandProfile/GenerationProgress';

interface IdentityProfile {
  brand_essence: string | null;
  positioning: string | null;
  core_values: string[] | null;
  what_makes_us_different: string | null;
  identity_confidence: number | null;
  identity_reasoning: string | null;
}

export function ProgrammeProfilesPage() {
  const { user } = useAuthStore();
  const [businessId, setBusinessId] = useState<string | undefined>(undefined);
  const [fetchingBusiness, setFetchingBusiness] = useState(true);
  const [identity, setIdentity] = useState<IdentityProfile | null>(null);
  const [loadingIdentity, setLoadingIdentity] = useState(true);
  
  const { programmes, loading: programmesLoading, refetch: refetchProgrammes } = useProgrammeProfiles(businessId);
  const { generating, error, generate } = useBrandProfileV5Generation();

  // Fetch business ID
  useEffect(() => {
    const fetchBusiness = async () => {
      if (!user?.id) {
        setFetchingBusiness(false);
        return;
      }

      try {
        const { data: business } = await supabase
          .from('businesses')
          .select('id')
          .eq('owner_id', user.id)
          .maybeSingle();

        if (business) {
          setBusinessId(business.id);
        }
      } catch (err) {
        console.error('Error fetching business:', err);
      } finally {
        setFetchingBusiness(false);
      }
    };

    fetchBusiness();
  }, [user?.id]);

  // Fetch Layer 3 identity data
  useEffect(() => {
    const fetchIdentity = async () => {
      if (!businessId) {
        setLoadingIdentity(false);
        return;
      }

      try {
        setLoadingIdentity(true);
        const { data, error: fetchError } = await supabase
          .from('business_brand_profile')
          .select('brand_essence, positioning, core_values, what_makes_us_different, identity_confidence, identity_reasoning')
          .eq('business_id', businessId)
          .single();

        if (fetchError) {
          if (fetchError.code !== 'PGRST116') {
            throw fetchError;
          }
          setIdentity(null);
        } else {
          setIdentity(data);
        }
      } catch (err) {
        console.error('Error fetching identity:', err);
      } finally {
        setLoadingIdentity(false);
      }
    };

    fetchIdentity();
  }, [businessId]);

  // Handle V5 regeneration
  const handleRegenerate = async () => {
    if (!businessId) return;
    const result = await generate(businessId, true);
    if (result) {
      // Refetch both identity and programmes
      const fetchIdentity = async () => {
        const { data } = await supabase
          .from('business_brand_profile')
          .select('brand_essence, positioning, core_values, what_makes_us_different, identity_confidence, identity_reasoning')
          .eq('business_id', businessId)
          .single();
        if (data) setIdentity(data);
      };
      fetchIdentity();
      refetchProgrammes();
    }
  };

  // Loading state
  if (fetchingBusiness || loadingIdentity || programmesLoading || generating) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <GenerationProgress 
          message={generating ? 'Generating V5 Profile (Layers 1-4)...' : 'Loading programme profiles...'}
          subtitle={generating ? 'This may take 20-30 seconds' : undefined}
        />
      </div>
    );
  }

  // No data state - show generator
  const hasData = programmes && programmes.length > 0;

  if (!hasData) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Generate Programme Profiles</h2>
          <p className="text-gray-600 mb-8">
            Create AI-powered programme profiles with Layers 1-4 analysis
          </p>
          
          {error && (
            <div className="bg-red-50 border border-red-300 rounded-lg p-4 mb-6 max-w-md mx-auto">
              <p className="text-red-800 text-sm">
                <strong>Error:</strong> {error}
              </p>
            </div>
          )}

          <button
            onClick={handleRegenerate}
            disabled={generating || !businessId}
            className="px-8 py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-lg shadow-lg hover:shadow-xl"
          >
            {generating ? 'Generating...' : '🆕 Generate V5 Profile'}
          </button>
          <p className="text-sm text-gray-500 mt-4">⏱️ Estimated time: 20-30 seconds</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Programme Profiles</h1>
            <p className="text-gray-600 mt-1">AI-powered brand profile with 4-layer programme analysis</p>
          </div>
          <button
            onClick={handleRegenerate}
            disabled={generating}
            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-md hover:shadow-lg"
          >
            {generating ? '⏳ Generating...' : '🔄 Regenerate All'}
          </button>
        </div>
        
        {error && (
          <div className="bg-red-50 border border-red-300 rounded-lg p-4 mb-4">
            <p className="text-red-800 text-sm">
              <strong>Error:</strong> {error}
            </p>
          </div>
        )}
      </div>

      <div className="space-y-8">
        {/* LAYER 1: Programme Detection (all programmes) */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">🔍</span>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Layer 1: Programme Detection</h2>
              <p className="text-sm text-gray-600">Deterministic programme identification from menu and hours</p>
            </div>
          </div>
          
          {programmes.map((programme) => (
            <section key={`layer1-${programme.programme_type}`} className="bg-white border-2 border-gray-300 rounded-xl shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🍽️</span>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{programme.programme_name}</h3>
                      <p className="text-sm text-gray-600">
                        {programme.time_windows.join(', ')} • {programme.operating_days.join(', ')}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-3 py-1 bg-gray-500 text-white rounded-full">
                    {programme.programme_type}
                  </span>
                </div>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Detection Confidence</p>
                    <p className="text-lg font-bold text-gray-900">{(programme.confidence * 100).toFixed(0)}%</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Operating Days</p>
                    <p className="text-sm text-gray-900">{programme.operating_days.length} days/week</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Menu Evidence</p>
                    <p className="text-sm text-gray-900">{programme.menu_evidence.length} items</p>
                  </div>
                </div>

                {programme.menu_evidence.length > 0 && (
                  <details className="mt-3">
                    <summary className="text-sm text-gray-600 cursor-pointer hover:text-gray-900">
                      View menu evidence ({programme.menu_evidence.length} items)
                    </summary>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {programme.menu_evidence.slice(0, 10).map((item, idx) => (
                        <span key={idx} className="text-xs px-2 py-1 bg-gray-100 border border-gray-300 rounded">
                          {item}
                        </span>
                      ))}
                      {programme.menu_evidence.length > 10 && (
                        <span className="text-xs px-2 py-1 text-gray-500">
                          +{programme.menu_evidence.length - 10} more
                        </span>
                      )}
                    </div>
                  </details>
                )}
              </div>
            </section>
          ))}
        </div>

        {/* LAYER 2: Commercial Orientation (all programmes) */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">💼</span>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Layer 2: Commercial Orientation</h2>
              <p className="text-sm text-gray-600">AI-powered commercial strategy per programme • gpt-4o-mini</p>
            </div>
          </div>
          
          {programmes.map((programme) => (
            <section key={`layer2-${programme.programme_type}`} className="bg-white border-2 border-green-300 rounded-xl shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-green-50 to-green-100 px-6 py-4 border-b border-green-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🍽️</span>
                    <div>
                      <h3 className="text-xl font-bold text-green-900">{programme.programme_name}</h3>
                      <p className="text-sm text-green-700">{programme.programme_type}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-6 space-y-4">
                {/* Goal Split */}
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Baseline Goal Split</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-sm text-gray-700">Drive Footfall</span>
                          <span className="text-sm font-semibold text-gray-900">
                            {programme.baseline_goal_split.drive_footfall}%
                          </span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500"
                            style={{ width: `${programme.baseline_goal_split.drive_footfall}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-sm text-gray-700">Strengthen Brand</span>
                          <span className="text-sm font-semibold text-gray-900">
                            {programme.baseline_goal_split.strengthen_brand}%
                          </span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500"
                            style={{ width: `${programme.baseline_goal_split.strengthen_brand}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-sm text-gray-700">Retain Regulars</span>
                          <span className="text-sm font-semibold text-gray-900">
                            {programme.baseline_goal_split.retain_regulars}%
                          </span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-500"
                            style={{ width: `${programme.baseline_goal_split.retain_regulars}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Decision Timing */}
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase mb-1">Decision Timing</p>
                  <p className="text-sm text-gray-900 capitalize">{programme.decision_timing.replace('_', ' ')}</p>
                </div>

                {/* Content Type Affinity */}
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Content Type Affinity</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.entries(programme.content_type_affinity).map(([type, value]) => (
                      <div key={type} className="bg-white rounded p-2 border border-gray-200">
                        <p className="text-xs text-gray-600 capitalize mb-1">{type.replace('_', ' ')}</p>
                        <p className="text-lg font-bold text-gray-900">{value}%</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Commercial Reasoning */}
                {programme.commercial_reasoning && (
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">🤖 AI Reasoning</h3>
                    <p className="text-sm text-gray-700 leading-relaxed">{programme.commercial_reasoning}</p>
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>

        {/* LAYER 3: Identity Profile (Business-level) */}
        {identity && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">🎨</span>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Layer 3: Identity Profile</h2>
                <p className="text-sm text-gray-600">Business-level brand identity • gpt-4o</p>
              </div>
            </div>
            
            <section className="bg-white border-2 border-purple-300 rounded-xl shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-purple-50 to-purple-100 px-6 py-4 border-b border-purple-200">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">✨</span>
                  <div>
                    <h3 className="text-xl font-bold text-purple-900">Brand Identity</h3>
                    <p className="text-sm text-purple-700">Core identity elements for your business</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Brand Essence */}
                {identity.brand_essence && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Brand Essence</h3>
                    <p className="text-gray-900 text-lg leading-relaxed">{identity.brand_essence}</p>
                  </div>
                )}

                {/* Positioning */}
                {identity.positioning && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Positioning</h3>
                    <p className="text-gray-900 leading-relaxed">{identity.positioning}</p>
                  </div>
                )}

                {/* Core Values */}
                {identity.core_values && identity.core_values.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Core Values</h3>
                    <ul className="space-y-2">
                      {identity.core_values.map((value, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-purple-600 mt-1">•</span>
                          <span className="text-gray-900">{value}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* What Makes Us Different */}
                {identity.what_makes_us_different && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">What Makes Us Different</h3>
                    <p className="text-gray-900 leading-relaxed">{identity.what_makes_us_different}</p>
                  </div>
                )}

                {/* Confidence & Reasoning */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                  {identity.identity_confidence !== null && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">AI Confidence</h3>
                      <div className="flex items-center gap-2">
                        <div className="flex">
                          {[...Array(5)].map((_, i) => (
                            <span
                              key={i}
                              className={i < Math.round(identity.identity_confidence! * 5) ? 'text-yellow-400' : 'text-gray-300'}
                            >
                              ⭐
                            </span>
                          ))}
                        </div>
                        <span className="text-sm text-gray-600">
                          {(identity.identity_confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {identity.identity_reasoning && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">AI Reasoning</h3>
                      <details className="text-sm text-gray-700">
                        <summary className="cursor-pointer text-purple-600 hover:text-purple-700">View reasoning</summary>
                        <p className="mt-2 text-gray-600">{identity.identity_reasoning}</p>
                      </details>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}

        {/* LAYER 4: Audience Segments (all programmes) */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">👥</span>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Layer 4: Audience Segments</h2>
              <p className="text-sm text-gray-600">AI-powered audience segmentation per programme • gpt-4o-mini</p>
            </div>
          </div>
          
          {programmes.map((programme) => (
            <section key={`layer4-${programme.programme_type}`} className="bg-white border-2 border-orange-300 rounded-xl shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-orange-50 to-orange-100 px-6 py-4 border-b border-orange-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🍽️</span>
                    <div>
                      <h3 className="text-xl font-bold text-orange-900">{programme.programme_name}</h3>
                      <p className="text-sm text-orange-700">{programme.programme_type}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-6 space-y-4">
                {programme.audience_segments.map((segment, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-4 border border-orange-300">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-bold text-gray-900 text-lg">{segment.people_type || (segment as any).label || 'Unknown'}</h4>
                        <p className="text-sm text-gray-600 capitalize">
                          {segment.segment_size} • {segment.motivation.replace('_', ' ')} • {
                            segment.decision_timing === 'mixed' ? 'planned og footfall' : segment.decision_timing
                          }
                        </p>
                      </div>
                      {(segment as any).goal_contribution && (
                        <span className="text-xs px-2 py-1 bg-orange-100 text-orange-800 rounded">
                          {(segment as any).goal_contribution.replace('_', ' ')}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {segment.timing_windows && segment.timing_windows.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Timing Windows</p>
                          <div className="space-y-1">
                            {segment.timing_windows.map((window, wIdx) => (
                              <p key={wIdx} className="text-sm text-gray-900">📅 {window}</p>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Content Angles</p>
                        <div className="space-y-1">
                          {segment.content_angles.map((angle, aIdx) => (
                            <p key={aIdx} className="text-sm text-gray-900">💡 {angle}</p>
                          ))}
                        </div>
                      </div>
                    </div>

                    {segment.evidence && segment.evidence.length > 0 && (
                      <details className="mt-3">
                        <summary className="text-sm text-orange-600 cursor-pointer hover:text-orange-700">
                          View evidence ({segment.evidence.length} items)
                        </summary>
                        <ul className="mt-2 space-y-1">
                          {segment.evidence.map((item, eIdx) => (
                            <li key={eIdx} className="text-sm text-gray-700 flex items-start gap-2">
                              <span className="text-orange-500">✓</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                ))}

                {/* Segment Reasoning */}
                {programme.segment_reasoning && (
                  <details className="mt-4 pt-4 border-t border-orange-200">
                    <summary className="text-sm font-semibold text-gray-700 cursor-pointer hover:text-gray-900">
                      AI Reasoning ({(programme.segment_confidence * 100).toFixed(0)}% confidence)
                    </summary>
                    <p className="mt-2 text-sm text-gray-600">{programme.segment_reasoning}</p>
                  </details>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ProgrammeProfilesPage;
