import type { PriceLevel } from '@/types';

interface PricingFormProps {
  priceLevel: PriceLevel | null;
  averageCheck: number | null;
  onPriceLevelChange: (level: PriceLevel) => void;
  onAverageCheckChange: (amount: number | null) => void;
}

const PRICE_LEVELS: { value: PriceLevel; label: string; description: string }[] = [
  { value: 'budget', label: 'Budget', description: 'Under 100 DKK per person' },
  { value: 'moderate', label: 'Moderat', description: '100-200 DKK per person' },
  { value: 'upscale', label: 'Upscale', description: '200-400 DKK per person' },
  { value: 'fine_dining', label: 'Fine Dining', description: 'Over 400 DKK per person' },
];

export function PricingForm({ 
  priceLevel, 
  averageCheck,
  onPriceLevelChange,
  onAverageCheckChange
}: PricingFormProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Prisniveau</h3>

      {/* Price level selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Prisniveau
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PRICE_LEVELS.map(level => (
            <button
              key={level.value}
              onClick={() => onPriceLevelChange(level.value)}
              className={`p-4 rounded-lg border-2 text-left transition-colors ${
                priceLevel === level.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-medium text-gray-900">{level.label}</div>
              <div className="text-sm text-gray-600 mt-1">{level.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Average check */}
      <div>
        <label htmlFor="average-check" className="block text-sm font-medium text-gray-700 mb-2">
          Gennemsnitlig regning per person (DKK)
        </label>
        <input
          id="average-check"
          type="number"
          min="0"
          value={averageCheck || ''}
          onChange={(e) => onAverageCheckChange(
            e.target.value ? parseInt(e.target.value) : null
          )}
          placeholder="f.eks. 250"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p className="text-xs text-gray-500 mt-1">
          Inkluder mad og drikke. Dette hjælper AI med at forstå dit marked.
        </p>
      </div>
    </div>
  );
}
