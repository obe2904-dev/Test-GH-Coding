'use client';

import { CategoryMatch } from '@/types/location';
import { LOCATION_CATEGORIES } from '@/lib/location/categories';

interface Props {
  match: CategoryMatch;
  isSecondary?: boolean;
}

export default function LocationCategoryCard({ match, isSecondary }: Props) {
  const category = LOCATION_CATEGORIES[match.categoryId];
  
  const confidenceBadge = {
    low: { text: '⚠️ Lav tillid', color: 'text-yellow-600' },
    medium: { text: '📊 Medium tillid', color: 'text-blue-600' },
    high: { text: '✅ Høj tillid', color: 'text-green-600' }
  }[match.confidence];

  return (
    <div className={`bg-white rounded-lg p-4 border ${isSecondary ? 'border-gray-200' : 'border-blue-300'}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{category.icon}</span>
          <div>
            <h4 className="font-semibold text-lg">{category.name}</h4>
            <p className={`text-sm ${confidenceBadge.color}`}>
              {confidenceBadge.text}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-700">{match.score}</div>
          <div className="text-xs text-gray-500">score</div>
        </div>
      </div>

      {/* Definition */}
      <p className="text-sm text-gray-600 mb-3">
        {category.definition}
      </p>

      {/* Reasoning */}
      {match.reasoning.length > 0 && (
        <div className="mb-3">
          <h5 className="text-xs font-medium text-gray-500 mb-1">Årsager:</h5>
          <ul className="space-y-1">
            {match.reasoning.slice(0, 2).map((reason, idx) => (
              <li key={idx} className="text-sm text-gray-600 flex items-start">
                <span className="text-blue-500 mr-1">•</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Signals (landmarks) */}
      {match.signals.length > 0 && (
        <div>
          <h5 className="text-xs font-medium text-gray-500 mb-1">Nærliggende:</h5>
          <div className="flex flex-wrap gap-1">
            {match.signals.slice(0, 3).map((signal, idx) => (
              <span
                key={idx}
                className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
              >
                {signal.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
