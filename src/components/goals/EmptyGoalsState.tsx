interface EmptyGoalsStateProps {
  onCreateClick: () => void;
}

export function EmptyGoalsState({ onCreateClick }: EmptyGoalsStateProps) {
  return (
    <div className="text-center py-16 px-4">
      {/* Icon */}
      <div className="w-20 h-20 bg-cta-surface rounded-full flex items-center justify-center mx-auto mb-6">
        <span className="text-4xl">🎯</span>
      </div>

      {/* Heading */}
      <h2 className="text-xl font-bold text-slate-800 mb-4">
        Sæt dine forretningsmål
      </h2>

      {/* Description */}
      <p className="text-sm text-gray-600 mb-8 max-w-2xl mx-auto">
        Fortæl AI hvad du vil opnå, så kan den skabe intelligent markedsføring 
        der faktisk driver resultater.
      </p>

      {/* Examples */}
      <div className="bg-gray-50 rounded-lg p-6 mb-8 max-w-2xl mx-auto text-left">
        <h3 className="font-semibold text-gray-900 mb-3">Eksempler på mål:</h3>
        <ul className="space-y-2 text-gray-700">
          <li className="flex items-start">
            <span className="text-blue-500 mr-2 mt-1">•</span>
            <span><strong>Fyld onsdags frokost:</strong> Fra 40% til 70% kapacitet</span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-500 mr-2 mt-1">•</span>
            <span><strong>Promovér signaturret:</strong> Øg salg af &quot;DEN LUKSURIØSE BRUNCH&quot; med 25%</span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-500 mr-2 mt-1">•</span>
            <span><strong>Byg bevidsthed:</strong> 1000+ nye Instagram følgere på 3 måneder</span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-500 mr-2 mt-1">•</span>
            <span><strong>Øg gennemsnitlig regning:</strong> Fra 180 DKK til 220 DKK per person</span>
          </li>
        </ul>
      </div>

      {/* CTA */}
      <button
        onClick={onCreateClick}
        className="px-6 py-2 bg-cta text-white font-semibold rounded-lg hover:bg-cta-hover transition-colors text-sm shadow-md"
      >
        🎯 Opret dit første mål
      </button>
    </div>
  );
}
