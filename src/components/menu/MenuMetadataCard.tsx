import { useTranslation } from 'react-i18next';
import { useMenuMetadata } from '@/hooks/useBusinessKnowledge';
import { useMenuMetadataAnalyzer } from '@/hooks/useMenuMetadataAnalyzer';

interface MenuMetadataCardProps {
  businessId: string;
}

export function MenuMetadataCard({ businessId }: MenuMetadataCardProps) {
  const { t } = useTranslation('menu');
  const { data: metadata, loading, refetch } = useMenuMetadata(businessId);
  const { analyzing, error: analyzeError, analyze } = useMenuMetadataAnalyzer();

  const handleAnalyze = async () => {
    const success = await analyze(businessId);
    if (success) {
      await refetch();
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <p className="text-gray-500">{t('metadata.loading')}</p>
      </div>
    );
  }

  // If no metadata yet
  if (!metadata || !metadata.food_philosophy) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">🍽️ {t('metadata.title')}</h3>
            <p className="text-sm text-gray-600 mt-1">{t('metadata.subtitle')}</p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-blue-800">{t('metadata.noData')}</p>
        </div>

        {analyzeError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-800">{analyzeError}</p>
          </div>
        )}

        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="w-full px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {analyzing ? t('metadata.analyzing') : `✨ ${t('metadata.analyzeButton')}`}
        </button>
      </div>
    );
  }

  // Display analyzed metadata
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">🍽️ {t('metadata.title')}</h3>
          <p className="text-xs text-gray-500 mt-1">
            {t('metadata.lastUpdated')}: {metadata.last_analyzed_at 
              ? new Date(metadata.last_analyzed_at).toLocaleDateString('da-DK')
              : t('metadata.never')}
          </p>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="text-sm text-blue-600 hover:text-blue-700 disabled:text-gray-400"
        >
          {analyzing ? '⏳' : '🔄'} {analyzing ? t('metadata.analyzing') : t('metadata.reanalyze')}
        </button>
      </div>

      {/* Food Philosophy (in original language!) */}
      {metadata.food_philosophy && (
        <div className="mb-4 pb-4 border-b border-gray-200">
          <span className="text-sm font-medium text-gray-700">{t('metadata.foodPhilosophy')}:</span>
          <p className="text-gray-900 mt-1">{metadata.food_philosophy}</p>
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <span className="text-sm font-medium text-gray-700">{t('metadata.totalItems')}:</span>
          <p className="text-2xl font-bold text-gray-900">{metadata.total_items_count || 0}</p>
        </div>
        <div>
          <span className="text-sm font-medium text-gray-700">{t('metadata.signatureItems')}:</span>
          <p className="text-2xl font-bold text-gray-900">{metadata.signature_items_count || 0}</p>
        </div>
      </div>

      {/* Features */}
      <div className="space-y-3">
        {metadata.organic_certified && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-green-600">✓</span>
            <span className="text-gray-900">{t('metadata.organicCertified')}</span>
          </div>
        )}

        {metadata.local_ingredients_pct > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-green-600">🌱</span>
            <span className="text-gray-900">
              {t('metadata.localIngredients', { percent: metadata.local_ingredients_pct })}
            </span>
          </div>
        )}

        {metadata.has_specialty_coffee && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-amber-600">☕</span>
            <span className="text-gray-900">
              {t('metadata.specialtyCoffee')}{metadata.coffee_roaster ? `: ${metadata.coffee_roaster}` : ''}
            </span>
          </div>
        )}

        {metadata.has_wine_list && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-purple-600">🍷</span>
            <span className="text-gray-900">{t('metadata.wineList')}</span>
          </div>
        )}

        {metadata.has_full_bar && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-orange-600">🍸</span>
            <span className="text-gray-900">{t('metadata.fullBar')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
