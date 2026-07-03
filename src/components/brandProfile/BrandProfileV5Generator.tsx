import { useBrandProfileV5Generation } from '@/hooks/useBrandProfileV5Generation';
import { BrandSectionIcon } from './BrandSectionIcon';
import { GenerationProgress } from './GenerationProgress';

interface BrandProfileV5GeneratorProps {
  businessId: string;
  onSuccess: () => void | Promise<void>;
  mode?: 'generate' | 'regenerate';
}

export function BrandProfileV5Generator({
  businessId,
  onSuccess,
  mode = 'generate',
}: BrandProfileV5GeneratorProps) {
  // const { t } = useTranslation(); // Unused for now
  const { generating, error, generate } = useBrandProfileV5Generation();

  const handleGenerate = async () => {
    const result = await generate(businessId, true);
    if (result) {
      onSuccess();
    }
  };

  if (generating) {
    return (
      <GenerationProgress
        message="Generating V5 Brand Profile (Layers 1-4)... This may take 20-30 seconds"
      />
    );
  }

  const isRegenerateMode = mode === 'regenerate';

  return (
    <div className="max-w-2xl mx-auto text-center py-12 px-4">
      {/* Icon */}
      <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <BrandSectionIcon id="sparkles" className="w-10 h-10 text-blue-600" />
      </div>

      {/* Heading */}
      <h2 className="text-3xl font-bold text-blue-900 mb-4">
        {isRegenerateMode ? '🔄 Regenerate V5 Profile' : '🆕 Generate V5 Brand Profile'}
      </h2>

      {/* Description */}
      <p className="text-lg text-gray-700 mb-8">
        {isRegenerateMode
          ? 'Regenerate all V5 data with the latest business information.'
          : 'Generate a new programme-aware brand profile using AI.'}
      </p>

      {/* What's included */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8 text-left">
        <h3 className="font-semibold text-blue-900 mb-3">What V5 generates:</h3>
        <ul className="space-y-2 text-gray-700 text-sm">
          <li className="flex items-start">
            <span className="text-blue-600 mr-2 mt-1 font-bold">L1</span>
            <span>
              <strong>Programme Detection:</strong> Automatically identifies your operating
              programmes (brunch, lunch, dinner, bar) from opening hours and menu
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-600 mr-2 mt-1 font-bold">L2</span>
            <span>
              <strong>Commercial Orientation:</strong> Per-programme strategy (goal split,
              decision timing, content type affinity) using gpt-4o-mini
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-600 mr-2 mt-1 font-bold">L3</span>
            <span>
              <strong>Identity Profile:</strong> Business-level brand essence, positioning,
              core values, and differentiation using gpt-4o
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-600 mr-2 mt-1 font-bold">L4</span>
            <span>
              <strong>Audience Segments:</strong> Per-programme audience profiles with
              timing windows and content angles using gpt-4o-mini
            </span>
          </li>
        </ul>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-4 mb-6">
          <p className="text-red-800 text-sm">
            <strong>Error:</strong> {error}
          </p>
        </div>
      )}

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={generating}
        className="px-8 py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-lg shadow-lg hover:shadow-xl"
      >
        {generating
          ? 'Generating...'
          : isRegenerateMode
          ? '🔄 Regenerate V5 Profile'
          : '🆕 Generate V5 Profile'}
      </button>

      {/* Time estimate */}
      <p className="text-sm text-gray-500 mt-4">
        ⏱️ Estimated time: 20-30 seconds
      </p>

      {/* Info note */}
      {isRegenerateMode && (
        <div className="mt-6 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded p-3">
          <p className="font-semibold mb-1">💡 What gets regenerated:</p>
          <p>
            All 4 layers will be regenerated from scratch using your current business data
            (menu, opening hours, location). Existing V5 data will be replaced.
          </p>
        </div>
      )}
    </div>
  );
}
