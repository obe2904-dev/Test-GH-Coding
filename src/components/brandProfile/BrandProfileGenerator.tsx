import React from 'react';
import { useBrandProfileGeneration } from '@/hooks/useBrandProfileGeneration';
import { GenerationProgress } from './GenerationProgress';

interface BrandProfileGeneratorProps {
  businessId: string;
  onSuccess: () => void;
}

export function BrandProfileGenerator({ businessId, onSuccess }: BrandProfileGeneratorProps) {
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
      <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <span className="text-4xl">✨</span>
      </div>

      {/* Heading */}
      <h2 className="text-3xl font-bold text-gray-900 mb-4">
        Generer din Brandprofil
      </h2>

      {/* Description */}
      <p className="text-lg text-gray-600 mb-8">
        Vores AI analyserer din forretning, menu og lokation for at skabe en 
        autentisk brandprofil der matcher din identitet.
      </p>

      {/* What's included */}
      <div className="bg-gray-50 rounded-lg p-6 mb-8 text-left">
        <h3 className="font-semibold text-gray-900 mb-3">Din profil inkluderer:</h3>
        <ul className="space-y-2 text-gray-700">
          <li className="flex items-start">
            <span className="text-green-500 mr-2 mt-1">✓</span>
            <span><strong>Brand Essence:</strong> Din unikke identitet på ét sætning</span>
          </li>
          <li className="flex items-start">
            <span className="text-green-500 mr-2 mt-1">✓</span>
            <span><strong>Tone of Voice:</strong> Hvordan du kommunikerer</span>
          </li>
          <li className="flex items-start">
            <span className="text-green-500 mr-2 mt-1">✓</span>
            <span><strong>Content Hooks:</strong> Specifikke vinkler til dine opslag</span>
          </li>
          <li className="flex items-start">
            <span className="text-green-500 mr-2 mt-1">✓</span>
            <span><strong>Forbudte Ord:</strong> Ord der lyder generiske eller uægte</span>
          </li>
          <li className="flex items-start">
            <span className="text-green-500 mr-2 mt-1">✓</span>
            <span><strong>Målgruppe:</strong> Hvem du taler til</span>
          </li>
          <li className="flex items-start">
            <span className="text-green-500 mr-2 mt-1">✓</span>
            <span><strong>Konkurrence-positionering:</strong> Hvad gør dig unik</span>
          </li>
        </ul>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800 text-sm">
            <strong>Fejl:</strong> {error}
          </p>
        </div>
      )}

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={generating}
        className="px-8 py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-lg shadow-lg hover:shadow-xl"
      >
        {generating ? 'Genererer...' : '✨ Generer Brandprofil'}
      </button>

      {/* Time estimate */}
      <p className="text-sm text-gray-500 mt-4">
        Tager ca. 15-25 sekunder
      </p>
    </div>
  );
}
