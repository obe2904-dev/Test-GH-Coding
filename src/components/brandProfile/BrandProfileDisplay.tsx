import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BrandProfileSection } from './BrandProfileSection';
import { BrandSectionIcon } from './BrandSectionIcon';
import { VoiceArchetypeSelector } from './VoiceArchetypeSelector';

interface ToneModel {
  primary_keywords?: string[];
  writing_rules?: string[];
  good_examples?: string[];
  avoid_examples?: string[];
  formality?: string;
  confidence?: string;
}

interface ContentPillar {
  hook: string;
  usage?: string;
}

interface SamplePost {
  post_text: string;
  why_this_works?: string;
}

interface ContentStrategy {
  primary_goal: 'drive_footfall' | 'build_brand' | 'retain_loyalty';
  goal_blend: { drive_footfall: number; build_brand: number; retain_loyalty: number };
  footfall_signals: string[];
  brand_anchors: string[];
  loyalty_hooks: string[];
  content_category_weights: { product_menu: number; craving_visual: number; behind_scenes: number; team_people: number };
}

interface BrandProfile {
  // Gruppe 1 — Identitet
  brand_essence: string;
  brand_essence_elaboration?: string | null;
  identity_keywords?: string[] | null;
  // Gruppe 2 — Stemme
  tone_of_voice_value?: string;
  tone_model?: ToneModel | null;
  typical_openings?: string[];
  humor_level?: string;
  // Legacy tone (old profiles)
  tone_of_voice?: { primary_tone: string; attributes: string[]; formality_level: string } | null;
  // Gruppe 3 — Content Pillars
  content_hooks: ContentPillar[];
  // Gruppe 4 — Grænser
  voice_constraints?: string | null;
  signature_phrases?: string[];
  // Gruppe 5 — Baggrundskontekst
  target_audience?: { primary: string; characteristics: string[] };
  sample_posts?: SamplePost[];
  brand_origin_story?: string;
  what_makes_us_different?: string;
  // Business type — AI-inferred free text (hybrid-friendly)
  business_character?: string | null;
  // Voice derivation rationale (shown collapsed in Stemme section)
  voice_rationale?: string | null;
  // Voice archetype options (from brand-profile-generator voice options generation)
  voice_options?: {
    recommended: string;
    recommended_reason?: string;
    options: Record<string, {
      archetype: string;
      label: string;
      tagline: string;
      tone_model?: { primary_keywords?: string[]; writing_rules?: string[]; good_examples?: string[]; avoid_examples?: string[]; formality?: string; emoji_level?: string };
      things_to_avoid?: { language_constraints?: string[]; factual_constraints?: string[] };
      voice_constraints?: string;
      example_posts?: string[];
    }>;
    generated_at?: string;
  } | null;
  voice_archetype?: string | null;  // Active archetype key
  // Legacy / internal (not displayed)
  brand_positioning?: string;
  banned_words?: string[];
  never_say?: string[];
  voice_confidence_score?: number;
  content_strategy?: ContentStrategy | null;
}

interface BrandProfileDisplayProps {
  profile: BrandProfile;
  businessId?: string;
  onRegenerate?: () => void;
  onArchetypeChanged?: (archetype: string) => void;
}

export function BrandProfileDisplay({ profile, businessId, onRegenerate, onArchetypeChanged }: BrandProfileDisplayProps) {
  const { t } = useTranslation();
  const [gruppe5Open, setGruppe5Open] = useState(false);
  const [gruppe1Open, setGruppe1Open] = useState(false);

  const toneChips = profile.tone_model?.primary_keywords?.filter(Boolean) ?? [];
  const contentPillars = Array.isArray(profile.content_hooks) ? profile.content_hooks : [];
  const avoidExamples = profile.tone_model?.avoid_examples?.filter(Boolean) ?? [];
  const signaturePhrases = (profile.signature_phrases ?? []).slice(0, 5);
  const firstOpening = profile.typical_openings?.[0] ?? null;
  const humorLabel = profile.humor_level
    ? (t(`brand.display.humor.${profile.humor_level}`, { defaultValue: profile.humor_level }))
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-end">
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            className="px-4 py-2 text-sm font-medium text-cta hover:text-cta-text hover:bg-cta-surface rounded-lg transition-colors"
          >
          🔄 {t('brand.display.regenerate')}
          </button>
        )}
      </div>

      {/* ── GRUPPE 1 — IDENTITET ─────────────────────────────── */}
      <div className="bg-accent-surface rounded-xl p-8 border border-accent space-y-5">
        <div>
          <p className="text-xs font-semibold tracking-widest text-info uppercase mb-2">
          {t('brand.display.group1Badge')}
          </p>
          <p className="text-lg font-bold text-text leading-snug">
            {profile.brand_essence}
          </p>
        </div>

        {profile.business_character && (
          <div className="flex items-start gap-3 pt-1">
            <BrandSectionIcon id="businessType" className="w-5 h-5 text-text shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-info uppercase tracking-wide mb-1">{t('brand.display.businessType')}</p>
              <p className="text-sm font-medium text-text leading-relaxed">{profile.business_character}</p>
            </div>
          </div>
        )}

        {profile.brand_essence_elaboration && (
          <div>
            <button
              onClick={() => setGruppe1Open(o => !o)}
              className="flex items-center gap-1.5 text-xs font-medium text-cta hover:text-cta-text transition-colors mt-1"
            >
              <span>{gruppe1Open ? '▾' : '▸'}</span>
              <span>{gruppe1Open ? t('brand.display.hideDetails') : t('brand.display.showPositioning')}</span>
            </button>

            {gruppe1Open && (
              <div className="mt-4 space-y-4">
                {profile.brand_essence_elaboration && (
                  <p className="text-base text-text-secondary leading-relaxed border-l-4 border-info pl-4">
                    {profile.brand_essence_elaboration}
                  </p>
                )}

              </div>
            )}
          </div>
        )}
      </div>

      {/* ── GRUPPE 2 — STEMME ───────────────────────────────── */}
      <BrandProfileSection
        title={t('brand.display.voice.title')}
        icon={<BrandSectionIcon id="voice" className="w-6 h-6 text-text" />}
        badge={t('brand.display.voice.badge')}
      >
        {/* ── When voice_options exist: show only the selector (cards contain all info) ── */}
        {profile.voice_options && businessId ? (
          <VoiceArchetypeSelector
            voiceOptions={profile.voice_options}
            voiceArchetype={profile.voice_archetype ?? null}
            businessId={businessId}
            onArchetypeChanged={onArchetypeChanged ?? (() => {})}
          />
        ) : (
          <>
            {/* Legacy view — shown only for businesses without voice_options */}

            {/* Tone keyword chips */}
            {toneChips.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {toneChips.map((kw, i) => (
                  <span key={i} className="px-3 py-1 bg-accent-surface text-accent-text text-xs font-medium rounded-full border border-accent">
                    {kw}
                  </span>
                ))}
              </div>
            )}

            {/* Rules text */}
            {profile.tone_of_voice_value ? (
              <div className="bg-surface-alt rounded-lg p-4 border border-border mb-4">
                <pre className="text-sm text-text whitespace-pre-wrap font-sans leading-relaxed">
                  {(profile.tone_of_voice_value || '').replace(/\s*\(signal:[^)]+\)/g, '')}
                </pre>
              </div>
            ) : profile.tone_of_voice?.primary_tone ? (
              <div className="space-y-3 mb-4">
                <div>
                  <span className="text-sm font-medium text-text-muted">Primær tone:</span>
                  <p className="text-base font-medium text-text">{profile.tone_of_voice.primary_tone}</p>
                </div>
                <p className="text-xs text-warning bg-warning-surface px-3 py-2 rounded">
                  {t('brand.display.voice.legacyWarning')}
                </p>
              </div>
            ) : null}

            {/* Voice rationale */}
            {profile.voice_rationale && (
              <details className="mt-4 group">
                <summary className="cursor-pointer text-xs font-medium text-text-muted hover:text-text-secondary list-none flex items-center gap-1">
                  <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
                  {t('brand.display.voice.rationale')}
                </summary>
                <div className="mt-2 p-3 bg-surface-alt rounded-lg border border-border">
                  <p className="text-sm text-text-secondary leading-relaxed">{profile.voice_rationale}</p>
                </div>
              </details>
            )}

            {/* Typical opening + humor */}
            {(firstOpening || humorLabel) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                {firstOpening && (
                  <div className="p-3 bg-success-surface rounded-lg border border-success">
                    <p className="text-xs font-medium text-success mb-1">{t('brand.display.voice.typicalOpening')}</p>
                    <p className="text-sm text-text italic">"{firstOpening}"</p>
                  </div>
                )}
                {humorLabel && (
                  <div className="p-3 bg-warning-surface rounded-lg border border-warning">
                    <p className="text-xs font-medium text-warning-text mb-1">{t('brand.display.voice.humorLabel')}</p>
                    <p className="text-sm text-text">{humorLabel}</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </BrandProfileSection>

      {/* ── GRUPPE 3 — CONTENT PILLARS ─────────────────────── */}
      <BrandProfileSection
        title={t('brand.display.pillars.title')}
        icon={<BrandSectionIcon id="pillars" className="w-6 h-6 text-text" />}
        badge={t('brand.display.pillars.badge')}
      >
        <div className="space-y-3">
          {contentPillars.map((pillar, i) => (
            <div key={i} className="border-l-4 border-accent pl-4 py-1.5">
              <p className="font-medium text-text">→ {pillar.hook}</p>
              {pillar.usage && <p className="text-sm text-text-muted mt-0.5">{pillar.usage}</p>}
            </div>
          ))}
          {contentPillars.length === 0 && (
            <p className="text-sm text-text-muted italic">{t('brand.display.pillars.empty')}</p>
          )}
        </div>
      </BrandProfileSection>

      {/* ── GRUPPE 4 — GRÆNSER ──────────────────────────────── */}
      <BrandProfileSection
        title={t('brand.display.limits.title')}
        icon={<BrandSectionIcon id="limits" className="w-6 h-6 text-text" />}
        badge={t('brand.display.limits.badge')}
      >
        {/* Voice constraints */}
        {profile.voice_constraints && (
          <div className="p-4 bg-warning-surface rounded-lg border border-warning mb-4">
            <p className="text-xs font-semibold text-warning-text uppercase tracking-wide mb-1">{t('brand.display.limits.principle')}</p>
            <p className="text-sm text-text leading-relaxed">{profile.voice_constraints}</p>
          </div>
        )}

        {/* Avoid examples */}
        {avoidExamples.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-error mb-2">{t('brand.display.limits.avoid')}</p>
            <div className="space-y-2">
              {avoidExamples.map((ex, i) => (
                <div key={i} className="flex items-start gap-2 p-2 bg-error-surface rounded text-sm text-text-secondary">
                  <span className="text-error shrink-0 mt-0.5">✕</span>
                  <span>"{ex}"</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Signature phrases */}
        {signaturePhrases.length > 0 && (
          <div>
            <p className="text-xs font-medium text-accent-text mb-2">{t('brand.display.limits.signature')}</p>
            <div className="flex flex-wrap gap-2">
              {signaturePhrases.map((phrase, i) => (
                <span
                  key={i}
                  className="px-3 py-1.5 bg-cta-surface text-cta-text text-sm font-medium rounded-lg border border-cta cursor-pointer hover:bg-cta hover:text-text-inverse transition-colors"
                  onClick={() => navigator.clipboard?.writeText(phrase)}
                  title={t('brand.display.limits.copy')}
                >
                  "{phrase}"
                </span>
              ))}
            </div>
          </div>
        )}

        {(!profile.voice_constraints && avoidExamples.length === 0 && signaturePhrases.length === 0) && (
          <p className="text-sm text-text-muted italic">{t('brand.display.limits.empty')}</p>
        )}
      </BrandProfileSection>

      {/* ── POST STRATEGI ───────────────────────────────────── */}
      {profile.content_strategy && (() => {
        const cs = profile.content_strategy!;
        const GOAL_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
          drive_footfall: { label: t('brand.display.strategy.goals.drive_footfall'), color: 'text-success', bg: 'bg-success-surface', border: 'border-success' },
          build_brand:    { label: t('brand.display.strategy.goals.build_brand'),    color: 'text-info',  bg: 'bg-info-surface',  border: 'border-info' },
          retain_loyalty: { label: t('brand.display.strategy.goals.retain_loyalty'), color: 'text-accent-text',bg: 'bg-accent-surface',border: 'border-accent' },
        };
        const GOAL_COLORS: Record<string, { bar: string; text: string }> = {
          drive_footfall: { bar: 'bg-success', text: 'text-success' },
          build_brand:    { bar: 'bg-info',  text: 'text-info' },
          retain_loyalty: { bar: 'bg-accent',text: 'text-accent-text' },
        };
        const primaryMeta = GOAL_LABELS[cs.primary_goal] ?? GOAL_LABELS.drive_footfall;
        const blendEntries = Object.entries(cs.goal_blend ?? {}) as [string, number][];
        const allSignals = [
          ...(cs.footfall_signals ?? []).map(s => ({ label: s, icon: '🏃', tip: t('brand.display.strategy.tips.footfall') })),
          ...(cs.brand_anchors ?? []).map(s => ({ label: s, icon: '⚓', tip: t('brand.display.strategy.tips.brand') })),
          ...(cs.loyalty_hooks ?? []).map(s => ({ label: s, icon: '🔁', tip: t('brand.display.strategy.tips.loyalty') })),
        ];

        // Build a prose rationale from the strategy signals using locale templates
        const buildRationale = (): string => {
          const goalLabels: Record<string, string> = {
            drive_footfall: t('brand.display.strategy.goals.drive_footfall'),
            build_brand:    t('brand.display.strategy.goals.build_brand'),
            retain_loyalty: t('brand.display.strategy.goals.retain_loyalty'),
          };
          const blend = cs.goal_blend ?? {} as Record<string, number>;
          const sorted = (Object.entries(blend) as [string, number][]).sort((a, b) => b[1] - a[1]);
          const parts: string[] = [];

          sorted.forEach(([key, pct]) => {
            const label = goalLabels[key] ?? key;
            if (key === 'drive_footfall') {
              const sigs = cs.footfall_signals ?? [];
              if (sigs.length > 0) {
                parts.push(t('brand.display.strategy.rationale.footfall_with_signals', { label, pct, signals: sigs.join(', ') }));
              } else {
                parts.push(t('brand.display.strategy.rationale.footfall_no_signals', { label, pct }));
              }
            } else if (key === 'build_brand') {
              const anchors = cs.brand_anchors ?? [];
              if (anchors.length > 0) {
                parts.push(t('brand.display.strategy.rationale.brand_with_anchors', { label, pct, anchors: anchors.join(', ') }));
              } else {
                parts.push(t('brand.display.strategy.rationale.brand_no_anchors', { label, pct }));
              }
            } else if (key === 'retain_loyalty') {
              const hooks = cs.loyalty_hooks ?? [];
              if (hooks.length > 0) {
                parts.push(t('brand.display.strategy.rationale.loyalty_with_hooks', { label, pct, hooks: hooks.join(', ') }));
              } else {
                parts.push(t('brand.display.strategy.rationale.loyalty_no_hooks', { label, pct }));
              }
            }
          });

          return parts.join('\n\n');
        };

        const rationale = buildRationale();
        return (
          <BrandProfileSection
            title={t('brand.display.strategy.title')}
            icon={<BrandSectionIcon id="strategy" className="w-6 h-6 text-text" />}
            badge={t('brand.display.strategy.badge')}
          >
            {/* Primary goal badge */}
            <div className="mb-5">
              <p className="text-xs font-medium text-text-muted mb-2">{t('brand.display.strategy.primaryGoal')}</p>
              <span className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold border ${primaryMeta.bg} ${primaryMeta.color} ${primaryMeta.border}`}>
                {cs.primary_goal === 'drive_footfall' ? '🏃' : cs.primary_goal === 'build_brand' ? '⚓' : '🔁'}
                {primaryMeta.label}
              </span>
            </div>

            {/* Goal blend bar */}
            {blendEntries.length > 0 && (
              <div className="mb-5">
                <p className="text-xs font-medium text-text-muted mb-2">{t('brand.display.strategy.goalBlend')}</p>
                <div className="flex h-4 rounded-full overflow-hidden border border-border mb-2">
                  {blendEntries.map(([key, pct]) => (
                    <div
                      key={key}
                      className={`${GOAL_COLORS[key]?.bar ?? 'bg-border'} transition-all`}
                      style={{ width: `${pct}%` }}
                      title={`${GOAL_LABELS[key]?.label ?? key}: ${pct}%`}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-3">
                  {blendEntries.map(([key, pct]) => (
                    <span key={key} className={`text-xs font-medium ${GOAL_COLORS[key]?.text ?? 'text-text-secondary'}`}>
                      {GOAL_LABELS[key]?.label ?? key}: {pct}%
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Content category weights — hidden from UI (used internally as slot-planner sort weights, not post-count allocations; showing percentages alongside goal_blend would mislead owners into reconciling two non-comparable distributions) */}

            {/* Rationale */}
            {rationale && (
              <div className="mt-2 p-4 bg-warning-surface border border-warning rounded-lg">
                <p className="text-xs font-semibold text-warning-text uppercase tracking-wide mb-3">
                  {t('brand.display.strategy.rationaleTitle')}
                </p>
                <div className="space-y-2">
                  {rationale.split('\n\n').map((para, i) => {
                    // Render **bold** text within each paragraph
                    const parts = para.split(/\*\*(.+?)\*\*/);
                    return (
                      <p key={i} className="text-sm text-text leading-relaxed">
                        {parts.map((part, j) =>
                          j % 2 === 1
                            ? <strong key={j} className="font-semibold text-text">{part}</strong>
                            : part
                        )}
                      </p>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Signals — compact chip row */}
            {allSignals.length > 0 && (
              <div>
                <p className="text-xs font-medium text-text-muted mb-2">{t('brand.display.strategy.signalsTitle')}</p>
                <div className="flex flex-wrap gap-2">
                  {allSignals.map((s, i) => (
                    <span key={i} className="flex items-center gap-1 px-3 py-1 bg-surface-alt border border-border text-xs text-text-secondary rounded-full" title={s.tip}>
                      <span>{s.icon}</span>{s.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </BrandProfileSection>
        );
      })()}

      {/* ── GRUPPE 5 — BAGGRUNDSKONTEKST (collapsible) ──────── */}
      <div className="border border-border rounded-xl overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-6 py-4 bg-surface-alt hover:bg-surface-alt transition-colors text-left"
          onClick={() => setGruppe5Open(o => !o)}
        >
          <div className="flex items-center gap-3">
            <span className="text-lg">📁</span>
            <div>
              <span className="text-sm font-semibold text-text-secondary">{t('brand.display.background.title')}</span>
            </div>
          </div>
          <span className="text-text-muted text-sm">{gruppe5Open ? '▲' : '▼'}</span>
        </button>

        {gruppe5Open && (
          <div className="p-6 space-y-6 bg-surface">
            {/* Target audience */}
            {profile.target_audience && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">🎯</span>
                  <span className="text-sm font-semibold text-text-secondary">{t('brand.display.background.audience')}</span>
                  <span className="text-xs text-warning bg-warning-surface px-2 py-0.5 rounded border border-warning">
                    {t('brand.display.background.unverified')}
                  </span>
                </div>
                <p className="text-sm text-text mb-2">{profile.target_audience.primary}</p>
                {profile.target_audience.characteristics.length > 0 && (
                  <ul className="space-y-1">
                    {profile.target_audience.characteristics.map((c, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                        <span className="text-accent-text shrink-0">•</span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Sample posts */}
            {profile.sample_posts && profile.sample_posts.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">📱</span>
                  <span className="text-sm font-semibold text-text-secondary">{t('brand.display.background.samplePosts')}</span>
                  <span className="text-xs text-cta bg-info-surface px-2 py-0.5 rounded border border-info">
                    {t('brand.display.background.generatorInput')}
                  </span>
                </div>
                <div className="space-y-3">
                  {profile.sample_posts.map((post, i) => (
                    <div key={i} className="p-3 bg-surface-alt rounded-lg border border-border">
                      <p className="text-sm text-text italic mb-1">"{post.post_text}"</p>
                      {post.why_this_works && (
                        <p className="text-xs text-text-muted">💡 {post.why_this_works}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Brand story */}
            {(profile.brand_origin_story || profile.what_makes_us_different) && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">📖</span>
                  <span className="text-sm font-semibold text-text-secondary">{t('brand.display.background.story')}</span>
                </div>
                {profile.brand_origin_story && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-text-muted mb-1">{t('brand.display.background.ourStory')}</p>
                    <p className="text-sm text-text">{profile.brand_origin_story}</p>
                  </div>
                )}
                {profile.what_makes_us_different && (
                  <div>
                    <p className="text-xs font-medium text-text-muted mb-1">{t('brand.display.background.differentiator')}</p>
                    <p className="text-sm text-text">{profile.what_makes_us_different}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

