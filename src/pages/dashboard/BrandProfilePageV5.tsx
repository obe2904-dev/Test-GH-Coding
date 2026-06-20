import React, { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { BrandProfileV5Generator } from '@/components/brandProfile/BrandProfileV5Generator';
import { IdentitySection } from '@/components/brandProfile/IdentitySection';
import { GenerationProgress } from '@/components/brandProfile/GenerationProgress';
import { useBrandProfileV5Generation } from '@/hooks/useBrandProfileV5Generation';
import { useProgrammeProfiles } from '@/hooks/useProgrammeProfiles';
import { ProgrammeCard } from '@/components/brandProfile/ProgrammeCard';
import { AudienceSegmentCard } from '@/components/brandProfile/AudienceSegmentCard';
import { useTranslation } from 'react-i18next';

// Icon component
const StarFilledIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
  </svg>
);

const AudienceIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87" />
    <path d="M16 3.13a4 4 0 010 7.75" />
  </svg>
);

const VoiceProfileIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
    <path d="M21 15a4 4 0 01-4 4H8l-5 4V7a4 4 0 014-4h10a4 4 0 014 4v8z" />
    <path d="M8 10h8M8 14h5" />
  </svg>
);

const WritingExamplesIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
    <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5" />
    <path d="M18.5 2.5a2.1 2.1 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const GuardrailsIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
    <path d="M12 2l7 4v6c0 5-3.5 9.7-7 10-3.5-.3-7-5-7-10V6l7-4z" />
  </svg>
);

const AiReasoningIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
    <path d="M9 18h6M10 22h4M12 2a7 7 0 017 7c0 2.5-1.3 4.7-3.2 6H8.2C6.3 13.7 5 11.5 5 9a7 7 0 017-7z" />
  </svg>
);

// Transform database profile to display format
function transformProfile(dbProfile: any) {
  if (!dbProfile) return null;

  // Parse JSON fields that might be stored as strings
  const parseField = (field: any) => {
    if (!field) return field;
    if (typeof field === 'string') {
      try {
        return JSON.parse(field);
      } catch {
        return field;
      }
    }
    return field;
  };

  // Parse tone_of_voice: old format = {primary_tone, attributes, formality_level} JSON;
  // new format = rules text string.
  const rawToneOfVoice = parseField(dbProfile.tone_of_voice);
  const toneOfVoiceIsLegacy = rawToneOfVoice !== null &&
    typeof rawToneOfVoice === 'object' &&
    'primary_tone' in rawToneOfVoice;

  // Helper: ensure a field has the expected object shape; wrap strings gracefully.
  const ensureTargetAudience = (raw: any): { primary: string; characteristics: string[] } => {
    const parsed = parseField(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return {
        primary: parsed.primary || (typeof raw === 'string' ? raw : '') || '',
        characteristics: Array.isArray(parsed.characteristics) ? parsed.characteristics : [],
      };
    }
    // raw is a plain string (new compact format) or null
    return { primary: typeof parsed === 'string' ? parsed : '', characteristics: [] };
  };

  const ensureCompetitivePositioning = (raw: any): { differentiators: string[]; key_advantages: string[] } => {
    const parsed = parseField(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return {
        differentiators: Array.isArray(parsed.differentiators) ? parsed.differentiators : [],
        key_advantages: Array.isArray(parsed.key_advantages) ? parsed.key_advantages : [],
      };
    }
    // raw is a plain string — treat it as a single differentiator
    return {
      differentiators: typeof parsed === 'string' && parsed ? [parsed] : [],
      key_advantages: [],
    };
  };

  const ensureArray = (raw: any): any[] => {
    const parsed = parseField(raw);
    if (Array.isArray(parsed)) return parsed;
    if (typeof parsed === 'string' && parsed) return [];
    return [];
  };

  return {
    brand_essence: dbProfile.brand_essence || '',
    brand_positioning: '',  // core_offerings is a bulleted list — not a hero sub-headline
    // V5 JSONB (complete 5-layer structure)
    brand_profile_v5: dbProfile.brand_profile_v5 || null,
    // Layer 3 fields (V5 AI-generated)
    positioning: dbProfile.positioning ?? null,
    core_values: parseField(dbProfile.core_values) ?? (dbProfile.values ? parseField(dbProfile.values) : null), // V5 uses core_values, fallback to old 'values'
    what_makes_us_different: dbProfile.what_makes_us_different ?? null,
    identity_confidence: dbProfile.identity_confidence ?? null,
    identity_reasoning: dbProfile.identity_reasoning ?? null,
    // Legacy: old values field (keep for backwards compatibility)
    values: dbProfile.values ?? null,
    // New: rules text for the "Skriv sådan her" block
    tone_of_voice_value: toneOfVoiceIsLegacy
      ? ''  // old profile - no rules text available
      : (typeof rawToneOfVoice === 'string' ? rawToneOfVoice : ''),
    // Legacy adjective format (kept for profiles that haven't been regenerated)
    tone_of_voice: toneOfVoiceIsLegacy
      ? rawToneOfVoice
      : { primary_tone: '', attributes: [], formality_level: 'casual' },
    // Structured tone model (JSONB)
    tone_model: parseField(dbProfile.tone_model) || null,
    content_hooks: (() => {
      const raw = parseField(dbProfile.content_focus);
      if (Array.isArray(raw)) {
        return raw.map((item: any) =>
          typeof item === 'string' ? { hook: item.replace(/^-\s*/, '') } : item
        );
      }
      if (typeof raw === 'string' && raw.trim()) {
        return raw.split('\n').filter(Boolean).map(l => ({ hook: l.replace(/^-\s*/, '') }));
      }
      return [];
    })(),
    banned_words: ensureArray(dbProfile.things_to_avoid),
    target_audience: ensureTargetAudience(dbProfile.target_audience),
    competitive_positioning: ensureCompetitivePositioning(dbProfile.communication_goal),
    // ENRICHMENT FIELDS
    signature_phrases: dbProfile.signature_phrases || [],
    never_say: dbProfile.never_say || [],
    typical_openings: dbProfile.typical_openings || [],
    typical_closings: dbProfile.typical_closings || [],
    humor_level: dbProfile.humor_level,
    formality: dbProfile.formality,
    storytelling_style: dbProfile.storytelling_style,
    emoji_style: dbProfile.emoji_style,
    brand_origin_story: dbProfile.brand_origin_story,
    signature_approach: dbProfile.signature_approach,
    voice_confidence_score: dbProfile.voice_confidence_score,
    // V2 FIELDS
    brand_essence_elaboration: dbProfile.brand_essence_elaboration ?? null,
    identity_keywords: dbProfile.identity_keywords ?? null,
    voice_constraints: dbProfile.voice_constraints ?? null,
    voice_rationale: dbProfile.voice_rationale ?? null,
    // V5.2: Menu description examples (from brand_profile_v5.voice.menu_description_examples)
    menu_description_examples: dbProfile.brand_profile_v5?.voice?.menu_description_examples ?? null,
    // Business type descriptor (AI-generated free text for hybrid businesses)
    business_character: dbProfile.business_character ?? null,
    // CONTENT STRATEGY
    content_strategy: parseField(dbProfile.content_strategy) ?? null,
    // VOICE ARCHETYPE
    // voice_options: REMOVED (Sprint 1 - Complexity Reduction)
    // voice_archetype: REMOVED (Sprint 1 - Complexity Reduction)
    // Owner gets ONE voice. If unsatisfied, they regenerate or manually edit.
    // STAGE B3 SYNTHESIS
    emotional_promise: dbProfile.emotional_promise ?? null,
    content_exclusions: dbProfile.content_exclusions ?? null,
    // STAGE B4 OWNER DOCUMENT
    owner_document: parseField(dbProfile.owner_document) ?? null,
    // STAGE B5 AUDIENCE SEGMENTS
    audience_segments: parseField(dbProfile.audience_segments) ?? null,
    // DATA QUALITY
    content_strategy_confirmed: dbProfile.content_strategy_confirmed ?? false,
    // MENU OVERVIEW SUMMARY (Layer 0 Intelligence)
    menu_overview_summary: parseField(dbProfile.menu_overview_summary) ?? null,
    // GASTRONOMIC PROFILE (separate field for easy access)
    gastronomic_profile: dbProfile.gastronomic_profile ?? null,
    // SIGNATURE THEMES (separate field for easy querying)
    signature_themes: dbProfile.signature_themes ?? null,
    // 2026 MULTI-DIMENSIONAL FRAMEWORKS
    audience_framework: parseField(dbProfile.audience_framework) ?? null,
    voice_system: parseField(dbProfile.voice_system) ?? null,
    // Task 4.1: Programme revenue weights
    programme_revenue_weights: parseField(dbProfile.programme_revenue_weights) ?? null,
    // Commercial strategy
    commercial_baseline_mode: dbProfile.commercial_baseline_mode ?? 'balanced',
    trigger_configuration: parseField(dbProfile.trigger_configuration) ?? null,
    commercial_strategy_reasoning: dbProfile.commercial_strategy_reasoning ?? null,
    trigger_updated_by: dbProfile.trigger_updated_by ?? null,
  };
}

// Simple hook to fetch brand profile from database
function useBrandProfile(businessId: string | undefined) {
  const [profile, setProfile] = React.useState<any>(null);
  const [updatedAt, setUpdatedAt] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchProfile = React.useCallback(async () => {
    if (!businessId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('business_brand_profile')
        .select('*, brand_profile_v5')  
        .eq('business_id', businessId)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          // No profile exists yet
          setProfile(null);
        } else {
          throw fetchError;
        }
      } else {
        // Transform database format to display format
        const transformed = transformProfile(data);
        setProfile(transformed);
        setUpdatedAt(data.updated_at || null);
      }
    } catch (err) {
      console.error('Error fetching brand profile:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchProfile();
  }, [businessId]); // ✅ Only depend on businessId, not fetchProfile

  return { profile, loading, error, updatedAt, refetch: fetchProfile };
}

export function BrandProfilePageV5() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [businessId, setBusinessId] = React.useState<string | undefined>(undefined);
  const [fetchingBusiness, setFetchingBusiness] = React.useState(true);
  const [showV5Generator, setShowV5Generator] = React.useState(false);
  const { profile, loading, error, updatedAt: _updatedAt, refetch } = useBrandProfile(businessId);
  const { programmes, loading: programmesLoading, refetch: refetchProgrammes } = useProgrammeProfiles(businessId);
  const { generating: generatingV5, generate: generateV5 } = useBrandProfileV5Generation();

  // DEBUG: Log programmes state
  React.useEffect(() => {
    console.log('[BrandProfilePageV5] 🎨 Programmes state:', {
      businessId,
      programmes,
      count: programmes?.length,
      loading: programmesLoading,
      showGenerator: showV5Generator
    });
  }, [programmes, programmesLoading, businessId, showV5Generator]);

  // Handle V5 regeneration
  const handleRegenerateV5 = async () => {
    if (!businessId) return;
    const result = await generateV5(businessId, true);
    if (result) {
      // Refetch both profile and programmes
      refetch();
      refetchProgrammes();
      setShowV5Generator(false);
    }
  };

  // Fetch business ID from database — depend on user.id (not the user object)
  // to avoid re-running on every auth token refresh where the reference changes
  // but the identity stays the same.
  const userId = user?.id;
  useEffect(() => {
    const fetchBusiness = async () => {
      if (!userId) {
        console.log('[BrandProfilePageV5] ⚠️ No userId found, skipping business fetch');
        setFetchingBusiness(false);
        return;
      }

      console.log('[BrandProfilePageV5] 🔍 Fetching business for userId:', userId);

      try {
        const { data: business, error: fetchError } = await supabase
          .from('businesses')
          .select('id, owner_id')
          .eq('owner_id', userId)
          .maybeSingle();

        console.log('[BrandProfilePageV5] 📥 Business fetch result:', { business, error: fetchError });

        if (business) {
          setBusinessId(business.id);
          console.log('[BrandProfilePageV5] ✅ Business ID set:', business.id);
        } else {
          console.log('[BrandProfilePageV5] ⚠️ No business found for this user');
        }
      } catch (err) {
        console.error('[BrandProfilePageV5] ❌ Error fetching business:', err);
      } finally {
        setFetchingBusiness(false);
      }
    };

    fetchBusiness();
  }, [userId]);

  // Combined loading state
  if (fetchingBusiness || loading || generatingV5) {
    return (
      <div className="min-h-full bg-[#FAFAF8]">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <GenerationProgress 
            message={
              generatingV5 
                ? 'Generating V5 Profile (Layers 1-5)...' 
                : t('brand.page.loading')
            } 
          />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-full bg-[#FAFAF8]">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="bg-error-surface border border-error rounded-lg p-6">
            <h2 className="text-lg font-semibold text-error-text mb-2">{t('brand.page.errorTitle')}</h2>
            <p className="text-error">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Check if profile has actual content
  // V5 ARCHITECTURE: brand_essence is deprecated, replaced by brand_profile_v5 JSONB
  // Check for V5 data (brand_profile_v5) OR legacy data (brand_essence)
  const isProfileEmpty = profile && (
    // V5 check: brand_profile_v5 JSONB should exist
    !profile.brand_profile_v5 &&
    // Legacy fallback: old profiles might still have brand_essence
    (!profile.brand_essence || profile.brand_essence.trim() === '')
  );

  return (
    <div className="min-h-full bg-[#FAFAF8]">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Progress indicator */}
        <div className="mb-6">
        <div className="flex items-center justify-center gap-2 text-sm">
          <a href="/dashboard/profile" className="text-text-muted hover:text-text-secondary">{t('location.breadcrumb.profile')}</a>
          <span className="text-border">→</span>
          <a href="/dashboard/menu" className="text-text-muted hover:text-text-secondary">{t('location.breadcrumb.menu')}</a>
          <span className="text-border">→</span>
          <a href="/dashboard/location" className="text-text-muted hover:text-text-secondary">{t('location.breadcrumb.location')}</a>
          <span className="text-border">→</span>
          <span className="text-brand font-semibold">{t('location.breadcrumb.brand')}</span>
        </div>
      </div>
      {/* Page header */}
      <div className="text-center mb-4">
        <h1 className="text-xl font-medium text-brand mb-1">{t('brand.page.title')}</h1>
        <p className="text-sm text-text-secondary">{t('brand.page.subtitle')}</p>
      </div>

      {/* Data quality nudge — shown when profile exists but key fields are missing */}
      {profile && !isProfileEmpty && (() => {
        const nudges: { key: string; label: string; hint: string }[] = [];
        // Note: what_makes_us_different removed - AI generates differentiation in brand_essence_elaboration

        if (nudges.length === 0) return null;
        return (
          <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-xs font-semibold text-amber-800 mb-2">
              {nudges.length === 1
                ? '1 felt mangler for fuld AI-effekt'
                : `${nudges.length} felter mangler for fuld AI-effekt`}
            </p>
            <ul className="space-y-1.5">
              {nudges.map(n => (
                <li key={n.key} className="flex items-start gap-2 text-xs text-amber-800">
                  <span className="mt-0.5 shrink-0">→</span>
                  <span><strong>{n.label}</strong> — {n.hint}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })()}

      {/* Content */}
      {profile && !isProfileEmpty ? (
        <div className="space-y-6">
          {/* V5 REGENERATE SECTION (if showing generator) */}
          {showV5Generator && businessId && (
            <BrandProfileV5Generator
              businessId={businessId}
              onSuccess={() => {
                refetch();
                refetchProgrammes();
                setShowV5Generator(false);
              }}
              mode="regenerate"
            />
          )}

          {/* V5 SECTIONS (only show when not in generator mode) */}
          {!showV5Generator && (
            <>
              {/* HEADER WITH REGENERATE BUTTON */}
              {programmes && programmes.length > 0 && (
                <div className="flex justify-end">
                  <button
                    onClick={handleRegenerateV5}
                    disabled={generatingV5}
                    className="px-4 py-2 text-sm font-medium bg-[#0A7D5F] text-white rounded-lg hover:bg-[#076849] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    {generatingV5 ? 'Regenerating...' : '🔄 Regenerate'}
                  </button>
                </div>
              )}

              {/* LAYER 1: Programme Detection */}
              {programmes && programmes.length > 0 ? (
                <div className="border border-slate-300 rounded-lg overflow-hidden bg-white">
                  <div className="bg-slate-100 px-4 py-3 border-b border-slate-200">
                    <h2 className="text-lg font-medium text-slate-900 mb-1">{t('brandProfileV5.programmeDetection')}</h2>
                    <p className="text-[13px] text-[#A09A91]">{t('brandProfileV5.programmeDetectionDesc')}</p>
                  </div>
                  <div className="p-4 space-y-4">
                    {/* Menu Overview Summary (if available) */}
                    {profile.menu_overview_summary && (
                      <div className="space-y-4 pb-4 border-b border-slate-200">
                        {/* Cross-Menu Summary */}
                        {profile.menu_overview_summary.cross_menu_summary && (
                          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                            <p className="text-[11px] font-medium text-[#A09A91] uppercase tracking-[0.07em] mb-2">Overordnet Menu-Oversigt</p>
                            <div className="space-y-1 text-sm text-gray-700 leading-relaxed">
                              {profile.menu_overview_summary.cross_menu_summary
                                .split('\n')
                                .filter(line => line.trim().length > 0)
                                .map((line, index) => (
                                  <p key={index} className="pl-3 -indent-3 whitespace-pre-wrap">
                                    {line}
                                  </p>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Gastronomic Profile (ultra-short) */}
                        {(profile.gastronomic_profile || profile.menu_overview_summary?.gastronomic_profile) && (
                          <div className="bg-white rounded-lg p-3 border border-slate-300">
                            <p className="text-[11px] font-medium text-[#A09A91] uppercase tracking-[0.07em] mb-1">Gastronomisk Profil</p>
                            <p className="text-[14px] font-normal text-[#3C3830] leading-[1.65]">
                              {profile.gastronomic_profile || profile.menu_overview_summary?.gastronomic_profile}
                            </p>
                          </div>
                        )}

                        {/* Signature Themes */}
                        {((profile.signature_themes && profile.signature_themes.length > 0) || 
                          (profile.menu_overview_summary?.signature_themes && profile.menu_overview_summary.signature_themes.length > 0)) && (
                          <div className="bg-white rounded-lg p-3 border border-slate-200">
                            <p className="text-[11px] font-medium tracking-[0.07em] uppercase text-[#A09A91] mb-2">Signatur-Temaer</p>
                            <div className="flex flex-wrap gap-2">
                              {(profile.signature_themes || profile.menu_overview_summary?.signature_themes || []).map((theme: string, i: number) => (
                                <span key={i} className="px-[10px] py-[3px] bg-[var(--color-background-secondary)] border-[0.5px] border-[#C8C3BB] rounded-full text-[12px] font-medium text-[#5C5650]">
                                  {theme}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Programme Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {programmes.map((prog) => (
                        <div key={prog.programme_type} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                          <div className="text-[13px] font-medium text-[#111714] mb-1 normal-case">{prog.programme_name}</div>
                          <div className="text-xs text-slate-600 mb-2">{prog.time_windows?.join(', ')}</div>
                          <div className="text-xs">
                            <div className="text-[#A09A91] text-[12px]">Confidence: <span className="font-medium text-[#076B4E]">{((prog.confidence || 0) * 100).toFixed(0)}%</span></div>
                            <div className="text-[#A09A91] text-[12px]">Menu items: {prog.menu_evidence?.length || 0}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border border-slate-300 rounded-lg overflow-hidden bg-white">
                  <div className="bg-slate-100 px-4 py-3 border-b border-slate-200">
                    <h2 className="text-lg font-medium text-slate-900">{t('brandProfileV5.programmeDetection')}</h2>
                    <p className="text-[13px] text-[#A09A91] mt-1">{t('brandProfileV5.programmeDetectionDesc')}</p>
                  </div>
                  <div className="p-6 text-center">
                    <p className="text-gray-600 mb-4">{t('brandProfileV5.noProgrammes')}</p>
                    <button
                      onClick={() => setShowV5Generator(true)}
                      className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      🆕 {t('brandProfileV5.generateV5')}
                    </button>
                  </div>
                </div>
              )}

              {/* LAYER 2: Commercial Strategy */}
              {programmes && programmes.length > 0 && (
                <div className="border border-indigo-300 rounded-lg overflow-hidden bg-white">
                  <div className="bg-[#EBF4FD] px-4 py-3 border-b border-indigo-200 border-t-2 border-t-[#3D8BCD]">
                    <h2 className="text-lg font-medium text-[#111714] mb-1">{t('brandProfileV5.commercialStrategy')}</h2>
                    <p className="text-[13px] text-[#185FA5]">{t('brandProfileV5.commercialStrategyDesc')}</p>
                  </div>
                  <div className="p-4 space-y-4">
                    {programmes.map((prog) => (
                      <div key={prog.programme_type} className="bg-indigo-50/30 rounded-lg p-4 border border-indigo-200">
                        <h3 className="text-[13px] font-medium text-[#111714] mb-3 normal-case">
                          🍽️ {prog.programme_name ? prog.programme_name.toLowerCase().replace(/^\w/, c => c.toUpperCase()) : ''}
                        </h3>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-[11px] font-medium text-[#A09A91] uppercase tracking-[0.07em] mb-2">{t('brandProfileV5.goalSplit')}</p>
                            {prog.baseline_goal_split && (
                              <div className="space-y-2">
                                <div>
                                  <div className="flex justify-between text-xs mb-1">
                                    <span>{t('brandProfileV5.driveFootfall')}</span>
                                    <span className="font-medium">{prog.baseline_goal_split.drive_footfall}%</span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div className="bg-[#3D8BCD] h-2 rounded-full" style={{ width: `${prog.baseline_goal_split.drive_footfall}%` }} />
                                  </div>
                                </div>
                                <div>
                                  <div className="flex justify-between text-xs mb-1">
                                    <span>{t('brandProfileV5.strengthenBrand')}</span>
                                    <span className="font-medium">{prog.baseline_goal_split.strengthen_brand}%</span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div className="bg-[#0A7D5F] h-2 rounded-full" style={{ width: `${prog.baseline_goal_split.strengthen_brand}%` }} />
                                  </div>
                                </div>
                                <div>
                                  <div className="flex justify-between text-xs mb-1">
                                    <span>{t('brandProfileV5.retainRegulars')}</span>
                                    <span className="font-medium">{prog.baseline_goal_split.retain_regulars}%</span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div className="bg-[#6B5CE7] h-2 rounded-full" style={{ width: `${prog.baseline_goal_split.retain_regulars}%` }} />
                                  </div>
                                </div>
                              </div>
                            )}
                            <p className="text-xs text-slate-600 mt-3">
                              <span className="font-medium">{t('brandProfileV5.decisionTiming')}</span> {prog.decision_timing || 'N/A'}
                            </p>
                          </div>
                          {prog.commercial_reasoning && (
                            <div className="bg-[#F0EEFE] rounded-lg p-[12px_14px] border-[0.5px] border-[#C7BAF7]">
                              <p className="text-[11px] font-medium tracking-[0.07em] uppercase text-[#3D339A] mb-1">{t('brandProfileV5.aiReasoning')}</p>
                              <p className="text-[13px] text-[#5547C4] leading-[1.6]">{prog.commercial_reasoning}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DEPRECATED: Identity Section removed - replaced by signature themes + gastronomic profile */}
              {/* Use menu intelligence (signature themes, gastronomic profile) for more specific insights */}

              {/* LAYER 4: Audience Segments */}
              {programmes && programmes.length > 0 && (
                <div className="border border-amber-300 rounded-lg overflow-hidden bg-white">
                  <div className="bg-[#FEF3E6] px-4 py-3 border-b border-amber-200 border-t-2 border-t-[#D97849]">
                    <h2 className="text-lg font-medium text-[#3C3830] mb-1">{t('brandProfileV5.audienceSegments')}</h2>
                    <p className="text-[13px] text-[#9B4E20]">{t('brandProfileV5.audienceSegmentsDesc')}</p>
                  </div>
                  <div className="p-4 space-y-4">
                    {programmes.map((prog) => (
                      <div key={prog.programme_type} className="bg-amber-50/30 rounded-lg p-4 border border-amber-200">
                        <h3 className="text-[13px] font-medium text-[#9B4E20] mb-3 normal-case">
                          {prog.programme_name ? prog.programme_name.toLowerCase().replace(/^\w/, c => c.toUpperCase()) : ''}
                        </h3>
                        {prog.audience_segments && prog.audience_segments.length > 0 ? (
                          <div className="space-y-3">
                            {prog.audience_segments.map((segment, i) => (
                              <AudienceSegmentCard key={i} segment={segment} />
                            ))}
                            {prog.segment_reasoning && (
                              <div className="mt-3 bg-[#FEF3E6] border-[0.5px] border-[#F5C67C] rounded-lg p-[12px_14px]">
                                <p className="text-[11px] font-medium tracking-[0.07em] uppercase text-[#9B4E20] mb-2">{t('brandProfileV5.aiReasoningWithConfidence', { confidence: ((prog.segment_confidence || 0) * 100).toFixed(0) })}</p>
                                <p className="text-[13px] text-[#5C5650] leading-[1.7]">{prog.segment_reasoning}</p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">{t('brandProfileV5.noAudienceSegments')}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* V5 SECTION 3: Voice & Guidelines (Layer 5) */}
              {profile.brand_profile_v5?.voice && (
                <div className="border border-[#C2E3D8] rounded-lg overflow-hidden bg-white">
                  <div className="bg-[#E6F4F1] px-4 py-3 border-b border-[#C2E3D8] border-t-2 border-t-[#0A7D5F]">
                    <h2 className="text-lg font-medium text-[#111714] mb-1">{t('brandProfileV5.voiceGuidelines')}</h2>
                    <p className="text-[13px] text-[#076B4E]">
                      {t('brandProfileV5.voiceGuidelinesDesc')}
                    </p>
                  </div>
                  <div className="p-4 space-y-6">
                    {/* Voice Profile (Layer 5a) */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium text-[#076B4E] flex items-center gap-2">
                          <VoiceProfileIcon className="w-4 h-4 flex-shrink-0 text-[#076B4E]" />
                          <span>{t('brandProfileV5.voiceProfile')}</span>
                        </h3>
                        {profile.brand_profile_v5.voice.voice_confidence !== undefined && (
                          <div className="flex items-center gap-1">
                            <div className="flex items-center">
                              {[...Array(4)].map((_, i) => (
                                <StarFilledIcon key={i} className="w-3.5 h-3.5 text-[#D97849]" />
                              ))}
                            </div>
                            <span className="text-xs font-medium text-[#076B4E]">
                              {(profile.brand_profile_v5.voice.voice_confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="bg-white rounded-lg p-4 space-y-3">
                        <div>
                          <p className="text-[11px] font-medium text-[#A09A91] uppercase tracking-[0.07em] mb-1">{t('brandProfileV5.toneRules')}</p>
                          <ul className="space-y-1">
                            {profile.brand_profile_v5.voice.tone_rules?.map((rule: string, i: number) => (
                              <li key={i} className="text-[13px] text-[#3C3830] leading-[1.6]">
                                <span className="font-medium text-[#076B4E]">{i + 1}.</span> {rule}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-2 text-[12px] text-[#5C5650]">
                          <div>
                            <span className="font-medium text-[#3C3830]">{t('brandProfileV5.personality')}</span> 
                            <span className="ml-1 text-[#5C5650]">{profile.brand_profile_v5.voice.personality_traits?.join(', ')}</span>
                          </div>
                          <div>
                            <span className="font-medium text-[#3C3830]">{t('brandProfileV5.formality')}</span> 
                            <span className="ml-1 text-[#5C5650]">{profile.brand_profile_v5.voice.formality_level}</span>
                          </div>
                          <div>
                            <span className="font-medium text-[#3C3830]">{t('brandProfileV5.humor')}</span> 
                            <span className="ml-1 text-[#5C5650]">{profile.brand_profile_v5.voice.humor_style}</span>
                          </div>
                          <div>
                            <span className="font-medium text-[#3C3830]">{t('brandProfileV5.emoji')}</span> 
                            <span className="ml-1 text-[#5C5650]">{profile.brand_profile_v5.voice.emoji_level}</span>
                            <span className="ml-1 text-gray-500 text-[10px]">(+29% engagement)</span>
                          </div>
                          <div>
                            <span className="font-medium text-[#3C3830]">{t('brandProfileV5.sentenceStyle')}</span> 
                            <span className="ml-1 text-[#5C5650]">{profile.brand_profile_v5.voice.sentence_structure}</span>
                          </div>
                        </div>
                        {profile.brand_profile_v5.voice.emoji_reasoning && (
                          <div className="bg-[#E6F4F1] rounded px-3 py-2 border border-[#C2E3D8]">
                            <p className="text-xs text-[#5C5650]">
                              <span className="font-semibold text-[#076B4E]">{t('brandProfileV5.emojiStrategy')}</span> {profile.brand_profile_v5.voice.emoji_reasoning}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Writing Examples (Layer 5b) */}
                    <div>
                      <h3 className="text-sm font-medium text-[#076B4E] mb-2 flex items-center gap-2">
                        <WritingExamplesIcon className="w-4 h-4 flex-shrink-0 text-[#076B4E]" />
                        <span>{t('brandProfileV5.writingExamples')}</span>
                      </h3>
                      <div className="bg-white rounded-lg p-4 space-y-3">
                        
                        {/* Social Writing Examples (V5.4) - Tone-demonstrating phrases */}
                        {profile.brand_profile_v5.voice?.social_writing_examples && profile.brand_profile_v5.voice.social_writing_examples.length > 0 && (
                          <div>
                            <p className="text-[11px] font-medium text-[#A09A91] uppercase tracking-[0.07em] mb-3 flex items-center gap-2">
                              <VoiceProfileIcon className="w-4 h-4 flex-shrink-0 text-[#076B4E]" />
                              <span>Social Media Tone (fraser der viser hvordan vi taler)</span>
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              {profile.brand_profile_v5.voice.social_writing_examples.map((phrase: string, i: number) => (
                                <div key={i} className="bg-[#F4F1EC] border-[0.5px] border-[#C8C3BB] rounded-lg px-[14px] py-[10px]">
                                  <p className="text-[13px] text-[#3C3830] leading-relaxed italic">"{phrase}"</p>
                                </div>
                              ))}
                            </div>
                            <p className="text-xs text-gray-600 mt-3">
                              Disse fraser demonstrerer tone og stemme på tværs af forskellige sociale kontekster (atmosfære, kvalitet, filosofi, tid). Kun tone - ikke CTAs eller emojis.
                            </p>
                          </div>
                        )}
                        
                        {/* Menu Description Examples (V5.2) */}
                        {profile.brand_profile_v5.voice?.menu_description_examples && profile.brand_profile_v5.voice.menu_description_examples.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-[#C2E3D8]">
                            <p className="text-[11px] font-medium text-[#A09A91] uppercase tracking-[0.07em] mb-3 flex items-center gap-2">
                              <WritingExamplesIcon className="w-4 h-4 flex-shrink-0 text-[#076B4E]" />
                              <span>Menueksempler (sådan beskriver vi mad)</span>
                            </p>
                            <div className="space-y-4">
                              {/* Group examples in pairs (Variation A + B for each dish) */}
                              {Array.from({ length: Math.ceil(profile.brand_profile_v5.voice.menu_description_examples.length / 2) }).map((_, pairIndex) => {
                                const variationA = profile.brand_profile_v5.voice.menu_description_examples![pairIndex * 2];
                                const variationB = profile.brand_profile_v5.voice.menu_description_examples![pairIndex * 2 + 1];
                                
                                return (
                                  <div key={pairIndex} className="space-y-2">
                                    {/* Variation A */}
                                    {variationA && (
                                      <div className="bg-[#F4F1EC] border-[0.5px] border-[#C8C3BB] rounded-lg px-[14px] py-[10px]">
                                        <p className="text-[13px] text-[#3C3830] leading-relaxed italic">"{variationA}"</p>
                                      </div>
                                    )}
                                    {variationA && variationB && (
                                      <div className="h-px bg-[#E2DDD6]" />
                                    )}
                                    {/* Variation B (alternative) */}
                                    {variationB && (
                                      <div className="bg-[#F4F1EC] border-[0.5px] border-[#C8C3BB] rounded-lg px-[14px] py-[10px] border-dashed">
                                        <p className="text-[12px] font-medium text-[#076B4E] mb-1">Alternative:</p>
                                        <p className="text-[13px] text-[#5C5650] leading-relaxed italic">"{variationB}"</p>
                                      </div>
                                    )}
                                    {/* Divider between dish groups (except last) */}
                                    {pairIndex < Math.ceil(profile.brand_profile_v5.voice.menu_description_examples.length / 2) - 1 && (
                                      <div className="h-px bg-[#C2E3D8] my-3"></div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            <p className="text-[12px] text-[#A09A91] mt-3 leading-[1.6]">
                              Disse eksempler viser hvordan vi beskriver retter med den rigtige balance mellem casual tone og kulinarisk bevidsthed. Hver ret vises med 2 variationer for at demonstrere fleksibilitet.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Guardrails (Layer 5c) */}
                    <div>
                      <h3 className="text-sm font-medium text-[#111714] mb-2 flex items-center gap-2">
                        <GuardrailsIcon className="w-4 h-4 flex-shrink-0 text-[#D97849]" />
                        <span>{t('brandProfileV5.guardrails')}</span>
                      </h3>
                      <div className="bg-white rounded-lg p-4 space-y-3">
                        <div>
                          <p className="text-[11px] font-medium text-[#A09A91] uppercase tracking-[0.07em] mb-1">{t('brandProfileV5.neverSay')}</p>
                          <ul className="space-y-1">
                            {profile.brand_profile_v5.guardrails?.never_say?.map((rule: string, i: number) => (
                              <li key={i} className="text-[13px] text-[#5C5650] leading-[1.7]">• {rule}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="text-[11px] font-medium text-[#A09A91] uppercase tracking-[0.07em] mb-1">{t('brandProfileV5.contentExclusions')}</p>
                          <ul className="space-y-1">
                            {profile.brand_profile_v5.guardrails?.content_exclusions?.map((ex: string, i: number) => (
                              <li key={i} className="text-[13px] text-[#5C5650] leading-[1.7]">• {ex}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="text-[11px] font-medium text-[#A09A91] uppercase tracking-[0.07em] mb-1">{t('brandProfileV5.factualConstraints')}</p>
                          <ul className="space-y-1">
                            {profile.brand_profile_v5.guardrails?.factual_constraints?.map((constraint: string, i: number) => (
                              <li key={i} className="text-[13px] text-[#5C5650] leading-[1.7]">• {constraint}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* AI Reasoning for Layer 5 */}
                    {profile.brand_profile_v5.voice.voice_reasoning && (
                      <div className="bg-[#E6F4F1] rounded-lg p-[14px] border-[0.5px] border-[#88CDB9]">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[11px] font-medium tracking-[0.07em] uppercase text-[#076B4E] flex items-center gap-2">
                            <AiReasoningIcon className="w-4 h-4 flex-shrink-0 text-[#076B4E]" />
                            <span>{t('brandProfileV5.aiReasoning')}</span>
                          </p>
                          {profile.brand_profile_v5.voice.voice_confidence !== undefined && (
                            <span className="text-xs font-medium text-[#076B4E]">
                              {(profile.brand_profile_v5.voice.voice_confidence * 100).toFixed(0)}% confidence
                            </span>
                          )}
                        </div>
                        <p className="text-[13px] text-[#076B4E] leading-[1.6]">{profile.brand_profile_v5.voice.voice_reasoning}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : businessId ? (
        <BrandProfileV5Generator 
          businessId={businessId} 
          onSuccess={refetch}
          mode="initial"
        />
      ) : (
        <div className="text-center py-12">
          <p className="text-text-secondary">{t('brand.page.noBusiness')}</p>
        </div>
      )}

        {/* Navigation buttons */}
        <div className="flex justify-between mt-6">
          <a
            href="/dashboard/menu"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm text-text-secondary border border-border rounded-lg hover:bg-surface-alt transition-colors"
          >
            {t('brand.backToMenu')}
          </a>
        </div>
      </div>
    </div>
  );
}

export default BrandProfilePageV5;
