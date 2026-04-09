import React, { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { BrandProfileGenerator } from '@/components/brandProfile/BrandProfileGenerator';
import { BrandProfileDisplay } from '@/components/brandProfile/BrandProfileDisplay';
import { GenerationProgress } from '@/components/brandProfile/GenerationProgress';
import { useBrandProfileGeneration } from '@/hooks/useBrandProfileGeneration';
import { PhotoUploader } from '@/components/visualIdentity/PhotoUploader';
import { useVisualIdentityAnalyzer } from '@/hooks/useVisualIdentityAnalyzer';
import { useTranslation } from 'react-i18next';

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
    sample_posts: parseField(dbProfile.sample_posts) || [],
    humor_level: dbProfile.humor_level,
    formality: dbProfile.formality,
    storytelling_style: dbProfile.storytelling_style,
    emoji_style: dbProfile.emoji_style,
    brand_origin_story: dbProfile.brand_origin_story,
    what_makes_us_different: dbProfile.what_makes_us_different,
    signature_approach: dbProfile.signature_approach,
    voice_confidence_score: dbProfile.voice_confidence_score,
    // V2 FIELDS
    brand_essence_elaboration: dbProfile.brand_essence_elaboration ?? null,
    identity_keywords: dbProfile.identity_keywords ?? null,
    voice_constraints: dbProfile.voice_constraints ?? null,
    voice_rationale: dbProfile.voice_rationale ?? null,
    // Business type descriptor (AI-generated free text for hybrid businesses)
    business_character: dbProfile.business_character ?? null,
    // CONTENT STRATEGY
    content_strategy: parseField(dbProfile.content_strategy) ?? null,
    // VOICE ARCHETYPE
    voice_options: parseField(dbProfile.voice_options) ?? null,
    voice_archetype: dbProfile.voice_archetype ?? null,
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
        .select('*')
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
  const { profile, loading, error, updatedAt, refetch } = useBrandProfile(businessId);
  const { generating, generate } = useBrandProfileGeneration();
  const [interiorPhotoPaths, setInteriorPhotoPaths] = React.useState<string[]>([]);
  const [atmosphereDescription, setAtmosphereDescription] = React.useState<string>('');
  const [editingAtmosphere, setEditingAtmosphere] = React.useState(false);
  const { analyzing, recognizableInteriorIdentity, analyze, checkAndAutoAnalyze } = useVisualIdentityAnalyzer();

  // Handle regeneration - actually call the Edge Function
  const handleRegenerate = async () => {
    if (!businessId) return;
    await generate(businessId);
    // Always refetch — edge function writes directly to DB, response may not include brand_profile
    refetch();
  };

  // Fetch business ID from database — depend on user.id (not the user object)
  // to avoid re-running on every auth token refresh where the reference changes
  // but the identity stays the same.
  const userId = user?.id;
  useEffect(() => {
    const fetchBusiness = async () => {
      if (!userId) {
        setFetchingBusiness(false);
        return;
      }

      try {
        const { data: business } = await supabase
          .from('businesses')
          .select('id')
          .eq('owner_id', userId)
          .maybeSingle();

        if (business) {
          setBusinessId(business.id);
        }
      } catch (err) {
        console.error('❌ Error fetching business:', err);
      } finally {
        setFetchingBusiness(false);
      }
    };

    fetchBusiness();
  }, [userId]);

  // Load existing photos and atmosphere description
  useEffect(() => {
    if (!businessId) return;
    // Load atmosphere text from DB
    supabase
      .from('business_brand_profile')
      .select('recognizable_interior_identity')
      .eq('business_id', businessId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.recognizable_interior_identity) {
          setAtmosphereDescription(data.recognizable_interior_identity);
        }
      });
    // Load existing photos from storage
    checkAndAutoAnalyze(businessId).then((paths) => {
      if (paths.length > 0) setInteriorPhotoPaths(paths);
    });
  }, [businessId]);

  // Sync atmosphere text when analyzer completes
  useEffect(() => {
    if (recognizableInteriorIdentity) {
      setAtmosphereDescription(recognizableInteriorIdentity);
    }
  }, [recognizableInteriorIdentity]);

  const handleSaveAtmosphere = async () => {
    if (!businessId) return;
    await supabase
      .from('business_brand_profile')
      .upsert({ business_id: businessId, recognizable_interior_identity: atmosphereDescription }, { onConflict: 'business_id' });
    setEditingAtmosphere(false);
  };

  // Combined loading state (include generating state)
  if (fetchingBusiness || loading || generating) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <GenerationProgress message={generating ? t('brand.page.generating') : t('brand.page.loading')} />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-error-surface border border-error rounded-lg p-6">
          <h2 className="text-lg font-semibold text-error-text mb-2">{t('brand.page.errorTitle')}</h2>
          <p className="text-error">{error}</p>
        </div>
      </div>
    );
  }

  // Check if profile has actual content — only use brand_essence as the sentinel.
  // content_hooks may legitimately be [] on a base-only save (JSONB columns not yet migrated),
  // so treating an empty array as "profile is empty" causes the generator to show after generation.
  const isProfileEmpty = profile && (
    !profile.brand_essence ||
    profile.brand_essence.trim() === ''
  );

  return (
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
        <h1 className="text-xl font-bold text-brand mb-1">{t('brand.page.title')}</h1>
        <p className="text-sm text-text-secondary">{t('brand.page.subtitle')}</p>
      </div>

      {/* Fotos & atmosfære */}
      {businessId && (
        <div className="bg-surface border border-border rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-semibold text-text-primary">Fotos & atmosfære</h2>
              <p className="text-xs text-text-muted mt-0.5">AI analyserer dine fotos og bruger atmosfærebeskrivelsen i tekster om stemning, behind-the-scenes og brand.</p>
            </div>
          </div>
          <PhotoUploader
            businessId={businessId}
            onUploadComplete={(paths) => {
              setInteriorPhotoPaths(paths);
              analyze(businessId, paths);
            }}
          />
          {analyzing && (
            <p className="text-xs text-brand mt-3">AI analyserer fotos og registrerer atmosfære...</p>
          )}
          {atmosphereDescription && !editingAtmosphere && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-text-secondary">Atmosfærebeskrivelse</p>
                <button
                  onClick={() => setEditingAtmosphere(true)}
                  className="text-xs text-brand hover:underline"
                >
                  Rediger
                </button>
              </div>
              <p className="text-sm text-text-primary bg-surface-alt rounded-lg p-3">{atmosphereDescription}</p>
            </div>
          )}
          {editingAtmosphere && (
            <div className="mt-4">
              <label className="text-xs font-medium text-text-secondary block mb-1">Atmosfærebeskrivelse</label>
              <textarea
                value={atmosphereDescription}
                onChange={(e) => setAtmosphereDescription(e.target.value)}
                rows={4}
                className="w-full text-sm border border-border rounded-lg p-3 bg-surface text-text-primary resize-none focus:outline-none focus:ring-1 focus:ring-brand"
                placeholder="Beskriv atmosfæren og det visuelle udtryk i din virksomhed..."
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleSaveAtmosphere}
                  className="px-3 py-1.5 text-xs bg-brand text-white rounded-lg hover:bg-brand-hover"
                >
                  Gem
                </button>
                <button
                  onClick={() => setEditingAtmosphere(false)}
                  className="px-3 py-1.5 text-xs border border-border rounded-lg text-text-secondary hover:bg-surface-alt"
                >
                  Annuller
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      {profile && !isProfileEmpty ? (
        <BrandProfileDisplay 
          profile={profile} 
          businessId={businessId}
          onRegenerate={handleRegenerate}
          onArchetypeChanged={refetch}
        />
      ) : businessId ? (
        <BrandProfileGenerator 
          businessId={businessId} 
          onSuccess={refetch}
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
  );
}

export default BrandProfilePageV5;
