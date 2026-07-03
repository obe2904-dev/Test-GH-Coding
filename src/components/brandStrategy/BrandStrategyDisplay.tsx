/**
 * Brand Strategy Display Component
 * 
 * Shows the auto-generated brand strategy with explainability.
 * Danish-first UI with simple, non-technical copy.
 */

import { useState } from 'react';
import { BrandStrategy } from '../../lib/brandStrategy/types';

interface BrandStrategyDisplayProps {
  strategy: BrandStrategy;
  onApprove?: () => void;
  onRegenerate?: () => void;
}

// Danish translations for offerings
const OFFERING_LABELS: Record<string, string> = {
  'specialty_coffee': 'Specialkaffe',
  'weekend_brunch': 'Weekendbrunch',
  'weekday_lunch': 'Frokost (hverdage)',
  'casual_dinner': 'Afslappet aftensmad',
  'natural_wine_focus': 'Naturvin',
  'cocktails_social': 'Cocktails & sociale drinks',
  'craft_beer_bar': 'Håndværksøl',
  'late_night_bar': 'Late-night bar',
  'quick_takeaway': 'Takeaway & hurtig service',
  'comfort_food': 'Comfort food',
  'healthy_casual': 'Sundt & let'
};

// Danish translations for audiences
const AUDIENCE_LABELS: Record<string, string> = {
  'locals': 'Lokale',
  'families': 'Familier',
  'office_workers': 'Kontorfolk',
  'students': 'Studerende',
  'social_groups': 'Vennegrupper',
  'tourists': 'Turister'
};

// Danish translations for goals
const GOAL_LABELS: Record<string, string> = {
  'drive_visits': 'Flere besøg',
  'increase_bookings': 'Flere reservationer',
  'build_local_awareness': 'Øg lokalt kendskab',
  'fill_off_peak': 'Fylde stille timer'
};

const GOAL_DESCRIPTIONS: Record<string, string> = {
  'drive_visits': 'Få flere gæster til at komme forbi spontant',
  'increase_bookings': 'Få flere til at reservere bord på forhånd',
  'build_local_awareness': 'Gøre flere lokale opmærksomme på jeres sted',
  'fill_off_peak': 'Fylde op i jeres roligere timer'
};

// Confidence badges
const CONFIDENCE_BADGES = {
  'high': { label: 'Høj sikkerhed', color: 'bg-green-100 text-green-800' },
  'medium': { label: 'Mellem sikkerhed', color: 'bg-yellow-100 text-yellow-800' },
  'low': { label: 'Lav sikkerhed', color: 'bg-gray-100 text-gray-800' }
};

export function BrandStrategyDisplay({ strategy, onApprove, onRegenerate }: BrandStrategyDisplayProps) {

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [showAllOfferings, setShowAllOfferings] = useState(false);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Din brandprofil er klar
        </h2>
        <p className="text-sm text-gray-600">
          Vi har analyseret dit menukort, åbningstider og lokation for at finde den rette strategi for din virksomhed.
        </p>
      </div>

      {/* Core Offerings (Layer 1) */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Hvad I er kendt for
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              De 3 ting der definerer jeres identitet
            </p>
          </div>
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${CONFIDENCE_BADGES[strategy.core_offerings.confidence].color}`}>
            {CONFIDENCE_BADGES[strategy.core_offerings.confidence].label}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {strategy.core_offerings.offerings.map((offering, idx) => (
            <span
              key={idx}
              className="px-4 py-2 bg-blue-100 text-blue-800 rounded-lg font-medium"
            >
              {OFFERING_LABELS[offering] || offering}
            </span>
          ))}
        </div>

        <div className="flex gap-4 mb-2">
          <button
            onClick={() => toggleSection('offerings')}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
          >
            <span>Hvorfor disse?</span>
            <svg
              className={`w-4 h-4 transition-transform ${expandedSections['offerings'] ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            onClick={() => setShowAllOfferings(v => !v)}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
          >
            <span>{showAllOfferings ? 'Skjul alle kandidater' : 'Vis alle kandidater og scoringer'}</span>
            <svg
              className={`w-4 h-4 transition-transform ${showAllOfferings ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {expandedSections['offerings'] && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <ul className="space-y-2 text-sm text-gray-700">
              {strategy.core_offerings.reasoning.map((reason, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-blue-600 mt-1">•</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* All candidates and scores */}
        {showAllOfferings && strategy.core_offerings.offeringsFull && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold mb-2 text-gray-800">Alle kandidater og scoringer</h4>
            <table className="w-full text-xs mb-2">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="pr-2">Kandidat</th>
                  <th className="pr-2">Tilgængelighed</th>
                  <th className="pr-2">Identitet</th>
                  <th className="pr-2">Samlet</th>
                  <th className="pr-2">Valgt?</th>
                </tr>
              </thead>
              <tbody>
                {strategy.core_offerings.offeringsFull.map((c) => (
                  <tr key={c.id} className={c.eligible ? 'font-semibold text-blue-900' : 'text-gray-700'}>
                    <td className="pr-2">{OFFERING_LABELS[c.id] || c.id}</td>
                    <td className="pr-2">{c.availabilityScore}</td>
                    <td className="pr-2">{c.identityScore}</td>
                    <td className="pr-2">{c.combinedScore}</td>
                    <td className="pr-2">{c.eligible ? '✓' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-xs text-gray-600">
              <strong>Forklaring:</strong> Tilgængelighed = hvor meget det udbydes, Identitet = hvor meget det er i fokus, Samlet = vægtet sum. Kun kandidater med både høj tilgængelighed og identitet vælges.
            </div>
          </div>
        )}
      </div>

      {/* Target Audience (Layer 2) */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Hvem I henvender jer til
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Jeres primære målgrupper
            </p>
          </div>
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${CONFIDENCE_BADGES[strategy.target_audience.confidence].color}`}>
            {CONFIDENCE_BADGES[strategy.target_audience.confidence].label}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {strategy.target_audience.primary.map((audience, idx) => (
            <span
              key={idx}
              className="px-4 py-2 bg-purple-100 text-purple-800 rounded-lg font-medium"
            >
              {AUDIENCE_LABELS[audience] || audience}
            </span>
          ))}
        </div>

        {strategy.target_audience.seasonal.length > 0 && (
          <div className="mb-4 p-3 bg-orange-50 rounded-lg">
            <p className="text-sm font-medium text-orange-900 mb-2">Sæsonvariationer:</p>
            {strategy.target_audience.seasonal.map((seasonal, idx) => (
              <div key={idx} className="text-sm text-orange-800">
                <span className="font-medium capitalize">{seasonal.season}:</span> {seasonal.additional_audiences.map(aud => AUDIENCE_LABELS[aud]).join(', ')}
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => toggleSection('audience')}
          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
        >
          <span>Hvorfor disse målgrupper?</span>
          <svg
            className={`w-4 h-4 transition-transform ${expandedSections['audience'] ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {expandedSections['audience'] && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <ul className="space-y-2 text-sm text-gray-700">
              {strategy.target_audience.reasoning.map((reason, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-purple-600 mt-1">•</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Communication Goal (Layer 3) */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Jeres kommunikationsmål
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Hvad I arbejder hen imod med jeres sociale medier
            </p>
          </div>
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${CONFIDENCE_BADGES[strategy.communication_goal.confidence].color}`}>
            {CONFIDENCE_BADGES[strategy.communication_goal.confidence].label}
          </span>
        </div>

        <div className="p-4 bg-green-50 rounded-lg mb-4">
          <div className="text-lg font-semibold text-green-900 mb-1">
            {GOAL_LABELS[strategy.communication_goal.goal]}
          </div>
          <div className="text-sm text-green-800">
            {GOAL_DESCRIPTIONS[strategy.communication_goal.goal]}
          </div>
        </div>

        <button
          onClick={() => toggleSection('goal')}
          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
        >
          <span>Hvorfor dette mål?</span>
          <svg
            className={`w-4 h-4 transition-transform ${expandedSections['goal'] ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {expandedSections['goal'] && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <ul className="space-y-2 text-sm text-gray-700">
              {strategy.communication_goal.reasoning.map((reason, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-green-600 mt-1">•</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Generer igen
          </button>
        )}
        {onApprove && (
          <button
            onClick={onApprove}
            className="flex-1 px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
          >
            Godkend og gem
          </button>
        )}
      </div>

      {/* Metadata footer */}
      <div className="text-xs text-gray-500 text-center">
        Genereret {new Date(strategy.generated_at).toLocaleDateString('da-DK', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}
      </div>
    </div>
  );
}
