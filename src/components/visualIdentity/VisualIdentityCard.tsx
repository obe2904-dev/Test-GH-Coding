import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVisualIdentity } from '@/hooks/useBusinessKnowledge';
import { useVisualIdentityAnalyzer } from '@/hooks/useVisualIdentityAnalyzer';
import { PhotoUploader } from './PhotoUploader';
import { ColorPalette } from './ColorPalette';

interface VisualIdentityCardProps {
  businessId: string;
}

export function VisualIdentityCard({ businessId }: VisualIdentityCardProps) {
  const { t } = useTranslation('visual');
  const { data: identity, loading, refetch } = useVisualIdentity(businessId);
  const { analyzing, error: analyzeError, analyze } = useVisualIdentityAnalyzer();
  const [uploadedPaths, setUploadedPaths] = useState<string[]>([]);

  const handleAnalyze = async () => {
    if (uploadedPaths.length === 0) {
      alert(t('identity.errorNoPhotos'));
      return;
    }

    const success = await analyze(businessId, uploadedPaths);
    if (success) {
      await refetch();
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <p className="text-gray-500">{t('identity.loading')}</p>
      </div>
    );
  }

  // If no identity yet
  if (!identity || !identity.photography_style || !identity.photography_style.overall_aesthetic || identity.photography_style.overall_aesthetic === 'Not analyzed') {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">🎨 {t('identity.title')}</h3>
            <p className="text-sm text-gray-600 mt-1">{t('identity.subtitle')}</p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">{t('identity.noPhotos')}</p>
        </div>

        {/* Photo uploader */}
        <PhotoUploader 
          businessId={businessId} 
          onUploadComplete={setUploadedPaths}
        />

        {analyzeError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-4">
            <p className="text-sm text-red-800">{analyzeError}</p>
          </div>
        )}

        {uploadedPaths.length > 0 && (
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="w-full mt-4 px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {analyzing ? t('identity.analyzing') : `✨ ${t('identity.analyzeButton')}`}
          </button>
        )}
      </div>
    );
  }

  // Display analyzed identity
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">🎨 {t('identity.title')}</h3>
          <p className="text-xs text-gray-500 mt-1">
            {t('identity.lastUpdated')}: {identity.created_at 
              ? new Date(identity.created_at).toLocaleDateString('da-DK')
              : t('identity.never')}
          </p>
        </div>
        <button
          onClick={() => {
            // Show uploader again for re-analysis
            setUploadedPaths([]);
          }}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          🔄 {t('identity.reanalyze')}
        </button>
      </div>

      {/* Photography Style */}
      <div className="space-y-4 mb-6">
        <div>
          <span className="text-sm font-medium text-gray-700">{t('identity.aesthetic')}:</span>
          <p className="text-gray-900 mt-1">{identity.photography_style.overall_aesthetic}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <span className="text-sm font-medium text-gray-700">{t('identity.lighting')}:</span>
            <p className="text-sm text-gray-900 mt-1">{identity.photography_style.lighting_preference}</p>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-700">{t('identity.composition')}:</span>
            <p className="text-sm text-gray-900 mt-1">{identity.photography_style.composition_style}</p>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-700">{t('identity.colorGrading')}:</span>
            <p className="text-sm text-gray-900 mt-1">{identity.photography_style.color_grading}</p>
          </div>
        </div>
      </div>

      {/* Color Palette */}
      {identity.primary_colors && identity.primary_colors.length > 0 && (
        <div className="mb-6">
          <span className="text-sm font-medium text-gray-700 mb-3 block">{t('identity.dominantColors')}:</span>
          <ColorPalette colors={identity.primary_colors} />
        </div>
      )}

      {/* Recognizable Elements */}
      {identity.recognizable_interior_identity && (
        <div className="mb-4">
          <span className="text-sm font-medium text-gray-700">{t('identity.interiorIdentity')}:</span>
          <p className="text-gray-900 mt-1">{identity.recognizable_interior_identity}</p>
        </div>
      )}

      {/* Visual Elements */}
      {identity.signature_visual_elements && identity.signature_visual_elements.length > 0 && (
        <div>
          <span className="text-sm font-medium text-gray-700 mb-2 block">{t('identity.visualElements')}:</span>
          <div className="flex flex-wrap gap-2">
            {identity.signature_visual_elements.map((element, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-purple-50 text-purple-700 text-sm rounded-full"
              >
                {element}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
