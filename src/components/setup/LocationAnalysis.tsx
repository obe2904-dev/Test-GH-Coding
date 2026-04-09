'use client';

import { LocationAnalysis } from '@/lib/location/core/types';
import { ConceptFitOutput } from '@/lib/location/conceptFitAnalyzer';
import { getSeasonalRelevanceLabel } from '@/lib/location/seasonality';
import { getLocaleConfig } from '@/lib/location/locales';
import { LocationCategoryIcon } from './LocationCategoryIcon';

interface Props {
  analysis: LocationAnalysis;
  conceptFits?: Record<string, ConceptFitOutput> | null;
  onDeleteCategory?: (categoryId: string) => void;
}

export default function LocationAnalysisDisplay({ analysis, conceptFits, onDeleteCategory }: Props) {
  // Load localized category content
  const localeConfig = getLocaleConfig(analysis.locale);
  
  // Helper to get fit badge
  const getFitBadge = (fitLevel: string) => {
    switch (fitLevel) {
      case 'strong': return { emoji: '✅', label: 'Stærk Match', color: 'bg-green-100 text-green-800 border-green-300' };
      case 'moderate': return { emoji: '🟡', label: 'Moderat Match', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' };
      case 'challenging': return { emoji: '⚠️', label: 'Udfordrende Match', color: 'bg-amber-100 text-amber-800 border-amber-300' };
      default: return { emoji: '❓', label: 'Ukendt', color: 'bg-gray-100 text-gray-800 border-gray-300' };
    }
  };
  
  // Handle empty matches gracefully
  if (!analysis.matches || analysis.matches.length === 0) {
    return (
      <div className="bg-yellow-50 rounded-lg p-6 border border-yellow-200">
        <p className="text-yellow-800">
          Ingen lokationskategorier fundet. Klik på "Analysér Lokation" for at analysere din virksomheds placering.
        </p>
      </div>
    );
  }
  
  const primaryMatch = analysis.matches[0];
  const categoryContent = localeConfig.categories[primaryMatch.categoryId];
  const primaryFit = conceptFits?.[primaryMatch.categoryId];
  
  return (
    <div className="space-y-6">
      {/* Primary Category Display */}
      <div className="bg-gradient-to-r from-blue-50 to-cta-surface rounded-lg p-6 border border-blue-200">
        <div className="flex items-start gap-4">
          <LocationCategoryIcon categoryId={primaryMatch.categoryId} className="w-10 h-10 text-text" />
          <div className="flex-1">
            <div className="flex items-start justify-between mb-2">
              <h2 className="text-2xl font-bold">
                Din virksomhed i {analysis.city} er primært et:
              </h2>
              {onDeleteCategory && (
                <button
                  onClick={() => onDeleteCategory(primaryMatch.categoryId)}
                  className="text-gray-400 hover:text-red-600 transition-colors"
                  title="Slet denne kategori"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <p className="text-xl font-semibold text-blue-900 mb-3">
              {categoryContent.name}
            </p>
            <p className="text-gray-700 mb-4">
              {categoryContent.definition}
            </p>
            

            
            {/* Seasonal Relevance Badge */}
            {primaryFit && (
              <div className="mb-4">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                  primaryFit.seasonal_relevance === 'high' ? 'bg-green-100 text-green-800' :
                  primaryFit.seasonal_relevance === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {getSeasonalRelevanceLabel(primaryFit.seasonal_relevance)}
                </span>
                {primaryFit.is_strategy_driver && (
                  <span className="ml-2 inline-block px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    📍 Strategisk fokus
                  </span>
                )}
              </div>
            )}
            
            {/* Concept Fit for Primary Category */}
            {primaryFit && (
              <div className="mt-4 p-4 rounded-lg border border-gray-200">
                <p className="text-sm mb-2">{primaryFit.ui_summary.one_liner}</p>
                <div className="text-sm font-medium">
                  💡 <span className="text-gray-600">Marketing vinkel:</span> {primaryFit.ui_summary.best_marketing_angle}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cultural Context (if available) */}
      {analysis.culturalContext && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-6">
          <h3 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
            <span>🏛️</span> Kulturel betydning
          </h3>
          <p className="text-amber-800 mb-3">
            {analysis.culturalContext.description}
          </p>
          <div className="flex flex-wrap gap-2">
            {analysis.culturalContext.knownFor.map((item, idx) => (
              <span key={idx} className="px-2 py-1 bg-amber-100 text-amber-900 rounded text-sm">
                {item}
              </span>
            ))}
          </div>
          {analysis.culturalContext.seasonality && (
            <div className="mt-3 text-sm text-amber-700 border-t border-amber-200 pt-3">
              <strong>Sæsonalitet:</strong> {analysis.culturalContext.seasonality}
            </div>
          )}
          {analysis.culturalContext.historicalNote && (
            <div className="mt-2 text-sm text-amber-700 italic">
              {analysis.culturalContext.historicalNote}
            </div>
          )}
        </div>
      )}

      {/* Location Signals */}
      {primaryMatch.signals && primaryMatch.signals.length > 0 && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="font-semibold mb-3">📍 Hvorfor vi kategoriserer sådan:</h3>
          <ul className="space-y-2">
            {primaryMatch.signals.slice(0, 5).map((signal, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">•</span>
                <span className="text-gray-700">
                  {signal.distance && signal.distance > 0
                    ? `${Math.round(signal.distance)}m fra `
                    : ''}
                  {signal.name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* What This Means */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="font-semibold mb-3">💡 Hvad betyder det?</h3>
        <ul className="space-y-2">
          {categoryContent.whyItMatters.map((point, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="text-green-600 mt-1">✓</span>
              <span className="text-gray-700">{point}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Content Strategy */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="font-semibold mb-3">🎯 Din indholdsstrategi vil fokusere på:</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-medium text-gray-600 mb-2">Anbefalede CTAs:</h4>
            <div className="flex flex-wrap gap-2">
              {categoryContent.ctaShifts.map((cta, idx) => (
                <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                  {cta}
                </span>
              ))}
            </div>
          </div>
          {categoryContent.seasonalNotes && (
            <div>
              <h4 className="text-sm font-medium text-gray-600 mb-2">Sæsonnoter:</h4>
              <p className="text-sm text-gray-700">{categoryContent.seasonalNotes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Secondary Categories */}
      {analysis.matches.filter(m => m.score > 40).length > 1 && (
        <div className="mt-6">
          <h3 className="font-semibold text-lg mb-4">
            Din lokation har også disse karakteristika:
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            {analysis.matches
              .filter(m => m.score > 40 && m.categoryId !== primaryMatch.categoryId)
              .slice(0, 3)
              .map((match) => {
                const content = localeConfig.categories[match.categoryId];
                const fit = conceptFits?.[match.categoryId];
                return (
                  <div 
                    key={match.categoryId}
                    className="bg-white border-2 border-gray-200 rounded-lg p-5 relative group"
                  >
                    {onDeleteCategory && (
                      <button
                        onClick={() => onDeleteCategory(match.categoryId)}
                        className="absolute top-3 right-3 text-gray-300 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                        title="Slet denne kategori"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                    <div className="flex items-start gap-3 mb-3">
                      <LocationCategoryIcon categoryId={match.categoryId} className="w-8 h-8 text-text" />
                      <div className="flex-1">
                        <div className="mb-1">
                          <h4 className="font-semibold text-lg">{content.name}</h4>
                        </div>
                        <p className="text-sm text-gray-600">{content.definition}</p>
                      </div>
                    </div>
                    
                    {/* Seasonal Relevance Badge for Secondary */}
                    {fit && (
                      <div className="mb-2 flex items-center gap-2">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                          fit.seasonal_relevance === 'high' ? 'bg-green-100 text-green-800' :
                          fit.seasonal_relevance === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {getSeasonalRelevanceLabel(fit.seasonal_relevance)}
                        </span>
                        {fit.is_strategy_driver && (
                          <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            📍 Strategisk fokus
                          </span>
                        )}
                      </div>
                    )}
                    
                    {/* Concept Fit for Secondary Category */}
                    {fit && (
                      <div className="mb-3 p-3 rounded-lg border border-gray-200">
                        <p className="text-xs mb-1">{fit.ui_summary.one_liner}</p>
                        <div className="text-xs">
                          💡 {fit.ui_summary.best_marketing_angle}
                        </div>
                      </div>
                    )}
                    
                    {/* Key implications */}
                    <div className="bg-gray-50 rounded p-3">
                      <h5 className="text-xs font-medium text-gray-700 mb-2">
                        Nøgle implikationer:
                      </h5>
                      <ul className="space-y-1">
                        {content.whyItMatters.slice(0, 2).map((point, i) => (
                          <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                            <span className="text-blue-500 mt-0.5">→</span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Signals for secondary category */}
                    {match.signals && match.signals.length > 0 && (
                      <div className="mt-2 text-xs text-gray-500 space-y-1">
                        {match.signals.slice(0, 2).map((signal, i) => (
                          <div key={i}>
                            • {signal.distance ? `${Math.round(signal.distance)}m fra ` : ''}{signal.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
