import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';

// ─── Types ─────────────────────────────────────────────────────────────────────────────

interface VoiceArchetypeOption {
  source?: string;
  source_label?: string;
  label: string;
  tagline: string;
  voice_rationale?: string;
  tone_model?: {
    primary_keywords?: string[];
    writing_rules?: string[];
    good_examples?: string[];
    avoid_examples?: string[];
    formality?: string;
    emoji_level?: string;
  };
  things_to_avoid?: {
    language_constraints?: string[];
  };
  voice_constraints?: string;
  example_posts?: string[];
  content_strategy?: {
    anchors?: string[];
    reasoning?: string;
  };
}

interface VoiceOptions {
  recommended: string;
  recommended_reason?: string;
  options: Record<string, VoiceArchetypeOption>;
  generated_at?: string;
}

interface VoiceArchetypeSelectorProps {
  voiceOptions: VoiceOptions;
  voiceArchetype: string | null;
  businessId: string;
  onArchetypeChanged: (archetype: string) => void;
}

// ─── Source identity (header + colours) ──────────────────────────────────────────────────────

const SOURCE_STYLE: Record<string, {
  headerBg: string;
  headerText: string;
  activeBorder: string;
  activeBg: string;
  chip: string;
  dot: string;
  btn: string;
  rationaleBorder: string;
  rationaleText: string;
}> = {
  website: {
    headerBg:        'bg-surface-alt',
    headerText:      'text-text-secondary',
    activeBorder:    'border-border',
    activeBg:        'bg-surface-alt',
    chip:            'bg-surface-alt text-text-muted border-border',
    dot:             'bg-border',
    btn:             'bg-cta hover:bg-cta-hover',
    rationaleBorder: 'border-border',
    rationaleText:   'text-text-secondary',
  },
  ai_enriched: {
    headerBg:        'bg-cta-surface',
    headerText:      'text-cta',
    activeBorder:    'border-cta',
    activeBg:        'bg-cta-surface',
    chip:            'bg-cta-surface text-cta-text border-cta-surface',
    dot:             'bg-cta',
    btn:             'bg-cta hover:bg-cta-hover',
    rationaleBorder: 'border-cta',
    rationaleText:   'text-cta-text',
  },
};

// Fallback for legacy archetype keys
const FALLBACK_STYLE = {
  headerBg: 'bg-gray-100', headerText: 'text-gray-500',
  activeBorder: 'border-blue-500', activeBg: 'bg-blue-50',
  chip: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500',
  btn: 'bg-cta hover:bg-cta-hover',
  rationaleBorder: 'border-gray-300', rationaleText: 'text-gray-600',
};

function styleFor(source: string | undefined) {
  return SOURCE_STYLE[source ?? ''] ?? FALLBACK_STYLE;
}

function getSourceHeader(source: string | undefined, t: (key: string) => string): { title: string; subtitle: string } {
  if (source === 'website') return {
    title: t('brand.archetype.sources.website.title'),
    subtitle: t('brand.archetype.sources.website.subtitle'),
  };
  if (source === 'ai_enriched') return {
    title: t('brand.archetype.sources.ai_enriched.title'),
    subtitle: t('brand.archetype.sources.ai_enriched.subtitle'),
  };
  return { title: t('brand.archetype.fallbackTitle'), subtitle: '' };
}

// ─── Panel body ────────────────────────────────────────────────────────────────────────────────────

function OptionBody({ option, sourceKey }: { option: VoiceArchetypeOption; sourceKey: string }) {
  const { t } = useTranslation();
  const s = styleFor(option.source ?? sourceKey);
  const [showRules, setShowRules] = useState(false);
  const [showRationale, setShowRationale] = useState(false);

  const keywords = option.content_strategy?.anchors?.slice(0, 3)
    ?? option.tone_model?.primary_keywords?.slice(0, 4)
    ?? [];
  const rules = option.tone_model?.writing_rules?.slice(0, 3) ?? [];
  const examples = option.example_posts?.slice(0, 2)
    ?? option.tone_model?.good_examples?.slice(0, 2)
    ?? [];

  return (
    <div className="space-y-4">
      {/* 1. Title + description */}
      <div>
        <h4 className="text-lg font-bold text-text leading-tight">{option.label}</h4>
        <p className="text-sm text-text-secondary mt-0.5">{option.tagline}</p>
      </div>

      {/* 2. Example posts */}
      {examples.length > 0 && (
        <div className="space-y-2">
          {examples.map((ex, i) => (
            <div key={i} className="bg-surface rounded p-3 text-sm italic text-text-secondary border border-border">
              "{ex}"
            </div>
          ))}
        </div>
      )}

      {/* 3. Context chips */}
      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {keywords.map((kw, i) => (
            <span key={i} className="bg-surface-alt text-text-muted text-xs px-2 py-0.5 rounded">
              {kw}
            </span>
          ))}
        </div>
      )}

      {/* 4. Skriveregler — collapsible, collapsed by default */}
      {rules.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowRules(v => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted hover:text-text-secondary"
          >
            <svg
              className={`w-3 h-3 transition-transform ${showRules ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            {t('brand.archetype.writingRules')}
          </button>
          {showRules && (
            <ul className="mt-2 space-y-1">
              {rules.map((rule, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
                  {rule}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 5. Reasoning — collapsible, collapsed by default */}
      {option.voice_rationale && (
        <div>
          <button
            type="button"
            onClick={() => setShowRationale(v => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted hover:text-text-secondary"
          >
            <svg
              className={`w-3 h-3 transition-transform ${showRationale ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            Hvorfor denne anbefaling?
          </button>
          {showRationale && (
            <blockquote className={`mt-2 border-l-2 ${s.rationaleBorder} pl-3`}>
              <p className={`text-sm italic leading-relaxed ${s.rationaleText}`}>
                {option.voice_rationale}
              </p>
            </blockquote>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Single option card (legacy keys only) ─────────────────────────────────────────────────────────

function OptionCard({
  sourceKey,
  option,
  isActive,
  isRecommended,
  applying,
  onSelect,
}: {
  sourceKey: string;
  option: VoiceArchetypeOption;
  isActive: boolean;
  isRecommended: boolean;
  applying: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const s = styleFor(option.source ?? sourceKey);
  const { title: headerTitle, subtitle: headerSubtitle } = getSourceHeader(option.source ?? sourceKey, t);

  return (
    <div
      className={[
        'relative flex flex-col rounded-xl border-2 overflow-hidden transition-all',
        isActive ? `${s.activeBorder} shadow-md ${s.activeBg}` : 'border-gray-200 bg-white',
      ].join(' ')}
    >
      {/* Source header */}
      <div className={`${s.headerBg} px-4 pt-3 pb-2`}>
        <div className="flex items-center justify-between">
          <span className={`text-xs font-bold uppercase tracking-widest ${s.headerText}`}>
            {headerTitle}
          </span>
          {isRecommended && (
            <span className="text-xs font-semibold text-cta bg-white border border-cta-surface rounded-full px-2 py-0.5">
              {t('brand.archetype.recommended')}
            </span>
          )}
        </div>
        {headerSubtitle && (
          <p className={`text-xs mt-0.5 ${s.headerText} opacity-80`}>{headerSubtitle}</p>
        )}
      </div>

      {/* Status bar */}
      <div className={[
        'px-4 py-1.5 text-xs font-semibold flex items-center gap-1.5 border-b border-border',
        isActive ? `${s.activeBg} ${s.headerText}` : 'bg-surface text-text-muted',
      ].join(' ')}>
        {isActive ? (
          <><span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{t('brand.archetype.activeVoice')}</>
        ) : (
          <><span className="w-1.5 h-1.5 rounded-full bg-border" />{t('brand.archetype.inactiveVoice')}</>
        )}
      </div>

      {/* Card body */}
      <div className="flex-1 p-5">
        <OptionBody option={option} sourceKey={sourceKey} />
      </div>

      {/* Footer CTA */}
      <div className="px-5 pb-5">
        {isActive ? (
          <div className="flex items-center gap-2 text-sm font-medium text-text-muted">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {t('brand.archetype.currentVoice')}
          </div>
        ) : (
          <button
            type="button"
            disabled={applying}
            onClick={onSelect}
            className={[
              'w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-text-inverse transition-all',
              applying ? 'opacity-50 cursor-not-allowed bg-gray-400' : s.btn,
            ].join(' ')}
          >
            {applying ? t('brand.archetype.switching') : t('brand.archetype.useThisVoice')}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────────────────────────

export function VoiceArchetypeSelector({
  voiceOptions,
  voiceArchetype,
  businessId,
  onArchetypeChanged,
}: VoiceArchetypeSelectorProps) {
  const rawKeys = Object.keys(voiceOptions.options ?? {});
  const orderedKeys = ['website', 'ai_enriched'].filter(k => rawKeys.includes(k));
  const remainingKeys = rawKeys.filter(k => !orderedKeys.includes(k));
  const displayKeys = [...orderedKeys, ...remainingKeys];

  const activeKey = voiceArchetype ?? voiceOptions.recommended ?? displayKeys[0] ?? '';

  const { t } = useTranslation();
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [showWebsite, setShowWebsite] = useState(false);

  async function handleSelect(archetypeKey: string) {
    if (archetypeKey === activeKey || applying) return;
    setApplying(true);
    setApplyError(null);
    try {
      const { data, error } = await supabase.functions.invoke('apply-voice-archetype', {
        body: { businessId, archetype: archetypeKey },
      });
      if (error) throw new Error(error.message ?? 'Ukendt fejl');
      if (!data?.success) throw new Error(data?.error ?? 'Ukendt fejl');
      onArchetypeChanged(archetypeKey);
    } catch (err: any) {
      setApplyError(err?.message ?? t('brand.archetype.error'));
    } finally {
      setApplying(false);
    }
  }

  if (displayKeys.length === 0) return null;

  const aiKey = rawKeys.includes('ai_enriched') ? 'ai_enriched' : null;
  const websiteKey = rawKeys.includes('website') ? 'website' : null;
  const legacyKeys = displayKeys.filter(k => k !== 'ai_enriched' && k !== 'website');

  const aiOption = aiKey ? voiceOptions.options[aiKey] : null;
  const websiteOption = websiteKey ? voiceOptions.options[websiteKey] : null;

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t('brand.archetype.voiceOptions')}</p>

      {/* AI ANBEFALING — full width, primary */}
      {aiOption && (
        <div className="bg-cta-surface border border-cta rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-cta-text">
              {t('brand.archetype.sources.ai_enriched.title')}
            </span>
            {aiKey === voiceOptions.recommended && (
              <span className="bg-surface text-text-muted text-xs px-2 py-0.5 rounded border border-border">
                {t('brand.archetype.recommended')}
              </span>
            )}
          </div>
          {activeKey === aiKey && (
            <p className="text-sm font-medium text-cta-text">{t('brand.archetype.activeVoice')}</p>
          )}
          <OptionBody option={aiOption} sourceKey="ai_enriched" />
        </div>
      )}

      {/* CTA — outside and below the AI panel */}
      {aiOption && (
        activeKey === aiKey ? (
          <span className="text-sm text-cta-text">✓ {t('brand.archetype.currentVoice')}</span>
        ) : (
          <button
            type="button"
            disabled={applying}
            onClick={() => handleSelect(aiKey!)}
            className="bg-cta text-text-inverse font-semibold py-3 rounded-lg w-full hover:bg-cta-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {applying ? t('brand.archetype.switching') : t('brand.archetype.useThisVoice')}
          </button>
        )
      )}

      {/* Website alternative — collapsible, collapsed by default */}
      {websiteOption && (
        <div>
          <button
            type="button"
            onClick={() => setShowWebsite(v => !v)}
            className="text-sm text-text-muted hover:text-text-secondary underline cursor-pointer"
          >
            Se alternativ baseret på din hjemmeside
          </button>
          {showWebsite && (
            <div className="mt-3 bg-surface border border-border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  {t('brand.archetype.sources.website.title')}
                </span>
                {activeKey === websiteKey && (
                  <div className="flex items-center gap-1.5 text-sm font-medium text-text-muted">
                    <span className="w-1.5 h-1.5 rounded-full bg-border" />
                    {t('brand.archetype.activeVoice')}
                  </div>
                )}
              </div>
              <OptionBody option={websiteOption} sourceKey="website" />
              {activeKey === websiteKey ? (
                <span className="text-sm text-cta-text">✓ {t('brand.archetype.currentVoice')}</span>
              ) : (
                <button
                  type="button"
                  disabled={applying}
                  onClick={() => handleSelect(websiteKey!)}
                  className="bg-cta text-text-inverse font-semibold py-2.5 rounded-lg w-full hover:bg-cta-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {applying ? t('brand.archetype.switching') : t('brand.archetype.useThisVoice')}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Legacy keys */}
      {legacyKeys.map(key => (
        <OptionCard
          key={key}
          sourceKey={key}
          option={voiceOptions.options[key]}
          isActive={key === activeKey}
          isRecommended={key === voiceOptions.recommended}
          applying={applying}
          onSelect={() => handleSelect(key)}
        />
      ))}

      {applyError && (
        <p className="text-sm text-error-text bg-error-surface border border-error rounded-lg px-4 py-2">
          ⚠️ {applyError}
        </p>
      )}
    </div>
  );
}
