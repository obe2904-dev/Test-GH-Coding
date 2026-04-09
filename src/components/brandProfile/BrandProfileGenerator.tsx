import { useTranslation } from 'react-i18next';
import { useBrandProfileGeneration } from '@/hooks/useBrandProfileGeneration';
import { BrandSectionIcon } from './BrandSectionIcon';
import { GenerationProgress } from './GenerationProgress';

interface BrandProfileGeneratorProps {
  businessId: string;
  onSuccess: () => void;
}

export function BrandProfileGenerator({ businessId, onSuccess }: BrandProfileGeneratorProps) {
  const { t } = useTranslation();
  const { generating, error, generate } = useBrandProfileGeneration();

  const handleGenerate = async () => {
    const result = await generate(businessId);
    if (result) {
      onSuccess();
    }
  };

  if (generating) {
    return <GenerationProgress />;
  }

  return (
    <div className="max-w-2xl mx-auto text-center py-12 px-4">
      {/* Icon */}
      <div className="w-20 h-20 bg-info-surface rounded-full flex items-center justify-center mx-auto mb-6">
        <BrandSectionIcon id="sparkles" className="w-10 h-10 text-text" />
      </div>

      {/* Heading */}
      <h2 className="text-3xl font-bold text-brand mb-4">
        {t('brand.generator.title')}
      </h2>

      {/* Description */}
      <p className="text-lg text-text-secondary mb-8">
        {t('brand.generator.description')}
      </p>

      {/* What's included */}
      <div className="bg-surface-alt rounded-lg p-6 mb-8 text-left">
        <h3 className="font-semibold text-brand mb-3">{t('brand.generator.includes')}</h3>
        <ul className="space-y-2 text-text-secondary">
          <li className="flex items-start">
            <span className="text-success mr-2 mt-1">✓</span>
            <span><strong>Brand Essence:</strong> {t('brand.generator.item.essence')}</span>
          </li>
          <li className="flex items-start">
            <span className="text-success mr-2 mt-1">✓</span>
            <span><strong>Tone of Voice:</strong> {t('brand.generator.item.tone')}</span>
          </li>
          <li className="flex items-start">
            <span className="text-success mr-2 mt-1">✓</span>
            <span><strong>Content Hooks:</strong> {t('brand.generator.item.hooks')}</span>
          </li>
          <li className="flex items-start">
            <span className="text-success mr-2 mt-1">✓</span>
            <span><strong>Forbudte Ord:</strong> {t('brand.generator.item.banned')}</span>
          </li>
          <li className="flex items-start">
            <span className="text-success mr-2 mt-1">✓</span>
            <span><strong>Målgruppe:</strong> {t('brand.generator.item.audience')}</span>
          </li>
          <li className="flex items-start">
            <span className="text-success mr-2 mt-1">✓</span>
            <span><strong>Konkurrence-positionering:</strong> {t('brand.generator.item.positioning')}</span>
          </li>
        </ul>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-error-surface border border-error rounded-lg p-4 mb-6">
          <p className="text-error-text text-sm">
            <strong>{t('brand.generator.error')}</strong> {error}
          </p>
        </div>
      )}

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={generating}
        className="px-8 py-4 bg-cta text-text-inverse font-semibold rounded-lg hover:bg-cta-hover disabled:bg-surface-alt disabled:cursor-not-allowed transition-colors text-lg shadow-lg hover:shadow-xl"
      >
        {generating ? t('brand.generator.generating') : t('brand.generator.button')}
      </button>

      {/* Time estimate */}
      <p className="text-sm text-text-muted mt-4">
        {t('brand.generator.timeEstimate')}
      </p>
    </div>
  );
}
