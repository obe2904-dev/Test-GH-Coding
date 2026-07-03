/**
 * Concept Fit Display Component
 * Shows simplified concept-location fit assessment
 * UI: Fit level + one-liner + marketing angle only
 */

import { ConceptFitOutput } from '../../lib/location/conceptFitAnalyzer';

interface ConceptFitDisplayProps {
  conceptFit: ConceptFitOutput;
}

export default function ConceptFitDisplay({ conceptFit }: ConceptFitDisplayProps) {
  const getFitIcon = (level: string) => {
    switch (level) {
      case 'strong': return '✅';
      case 'moderate': return '🟡';
      case 'challenging': return '⚠️';
      default: return '?';
    }
  };

  const getFitLabel = (level: string) => {
    switch (level) {
      case 'strong': return 'Stærk Match';
      case 'moderate': return 'Moderat Match';
      case 'challenging': return 'Udfordrende Match';
      default: return level;
    }
  };

  const getFitColorClasses = (level: string) => {
    switch (level) {
      case 'strong': return 'border-green-200 bg-green-50';
      case 'moderate': return 'border-yellow-200 bg-yellow-50';
      case 'challenging': return 'border-amber-200 bg-amber-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <h3 className="text-sm font-medium text-gray-700">Koncept-Fit Vurdering</h3>

      {/* Main fit card */}
      <div className={`border rounded-lg p-4 ${getFitColorClasses(conceptFit.fit_level)}`}>
        <div className="flex items-start gap-3">
          <span className="text-2xl">{getFitIcon(conceptFit.fit_level)}</span>
          <div className="flex-1">
            <div className="font-semibold text-gray-900 mb-1">
              {getFitLabel(conceptFit.fit_level)}
            </div>
            <p className="text-sm text-gray-700">
              {conceptFit.ui_summary.one_liner}
            </p>
          </div>
        </div>
      </div>

      {/* Marketing angle - simple 1-liner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
        <p className="text-sm text-blue-900">
          <span className="font-medium">Bedste marketingvinkel:</span>{' '}
          <span className="italic">{conceptFit.ui_summary.best_marketing_angle}</span>
        </p>
      </div>
    </div>
  );
}
