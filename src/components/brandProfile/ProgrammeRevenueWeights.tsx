import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface ProgrammeRevenueWeightsProps {
  businessId: string;
  programmes: string[];  // List of programmes from audience_framework.timeSlots
  initialWeights?: Record<string, number> | null;
  onWeightsChanged?: () => void;
}

/**
 * Programme Revenue Weights Component
 * 
 * Allows businesses to set revenue importance per programme using sliders.
 * Used by Weekly Plan rotation logic to prioritize higher-revenue service periods.
 * 
 * Example: Fine dining restaurant wants 40% Aftensmad, 35% Frokost, 20% Brunch, 5% Cocktails
 */
export function ProgrammeRevenueWeights({
  businessId,
  programmes,
  initialWeights,
  onWeightsChanged
}: ProgrammeRevenueWeightsProps) {
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Initialize weights from initial values or defaults
  useEffect(() => {
    const defaultWeight = 50; // Middle value (1-100 scale)
    const initialState: Record<string, number> = {};
    
    for (const prog of programmes) {
      initialState[prog] = initialWeights?.[prog] ?? defaultWeight;
    }
    
    setWeights(initialState);
  }, [programmes, initialWeights]);

  // Save weights to database
  const handleSave = async () => {
    if (!businessId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('business_brand_profile')
        .update({ programme_revenue_weights: weights })
        .eq('business_id', businessId);

      if (error) throw error;

      console.log('[ProgrammeRevenueWeights] Saved:', weights);
      onWeightsChanged?.();
    } catch (err) {
      console.error('[ProgrammeRevenueWeights] Save error:', err);
      alert('Kunne ikke gemme vægtning');
    } finally {
      setSaving(false);
    }
  };

  // Handle slider change
  const handleWeightChange = (programme: string, value: number) => {
    setWeights(prev => ({ ...prev, [programme]: value }));
  };

  // Get label for slider value (1-5 scale for UX, 0-100 internally)
  const getWeightLabel = (value: number): string => {
    if (value < 20) return 'Meget lav';
    if (value < 40) return 'Lav';
    if (value < 60) return 'Mellem';
    if (value < 80) return 'Høj';
    return 'Meget høj';
  };

  // Get icon for programme type
  const getProgrammeIcon = (prog: string): string => {
    const p = prog.toLowerCase();
    if (/brunch|morgenmad|breakfast|morgenkaffe/.test(p)) return '🌅';
    if (/frokost|lunch/.test(p)) return '🍽️';
    if (/kaffe|kage|cake|eftermiddag/.test(p)) return '☕';
    if (/aften|middag|dinner/.test(p)) return '🌆';
    if (/cocktail|bar|drink|nat/.test(p)) return '🌙';
    return '⏰';
  };

  // Calculate total (for percentage display)
  const total = Object.values(weights).reduce((sum, val) => sum + val, 0);

  if (programmes.length < 2) {
    // Single-programme venue doesn't need revenue weighting
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-sm font-semibold text-text">Omsætningsvægtning</h3>
            <p className="text-xs text-text-secondary">
              Angiv hvor vigtig hver del er for din omsætning (påvirker indholdsfordeling)
            </p>
          </div>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-info hover:text-info-dark transition-colors"
          >
            {showAdvanced ? 'Skjul detaljer' : 'Vis detaljer'}
          </button>
        </div>

        {/* Advanced explanation */}
        {showAdvanced && (
          <div className="mb-3 p-3 bg-info-surface border border-info rounded-lg text-xs text-info-text">
            <p className="font-semibold mb-1">Hvordan fungerer det?</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Ugeplanen prioriterer programmer med højere vægtning</li>
              <li>Påvirker indholdsfordeling over 4 uger (ikke daglige forslag)</li>
              <li>Kombineres med nyhed og frekvens (max 20 point ud af 100)</li>
              <li>Standard: Alle programmer lige vigtige</li>
            </ul>
          </div>
        )}
      </div>

      {/* Sliders */}
      <div className="space-y-3">
        {programmes.map(prog => {
          const weight = weights[prog] ?? 50;
          const percentage = total > 0 ? Math.round((weight / total) * 100) : 0;
          
          return (
            <div key={prog} className="space-y-1.5">
              {/* Programme header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">{getProgrammeIcon(prog)}</span>
                  <span className="text-sm font-medium text-text">{prog}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-secondary">{getWeightLabel(weight)}</span>
                  <span className="text-xs font-semibold text-info min-w-[40px] text-right">
                    {percentage}%
                  </span>
                </div>
              </div>

              {/* Slider */}
              <input
                type="range"
                min="0"
                max="100"
                step="10"
                value={weight}
                onChange={(e) => handleWeightChange(prog, parseInt(e.target.value))}
                className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-info"
                style={{
                  background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${weight}%, #e5e7eb ${weight}%, #e5e7eb 100%)`
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Save button */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-cta text-white text-sm font-medium rounded-lg hover:bg-cta-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Gemmer...' : 'Gem vægtning'}
        </button>
      </div>

      {/* Helper text */}
      <p className="text-[10px] text-text-secondary italic">
        💡 Tip: Giv høj vægt til programmer med højeste indtjening (fx aftensmad for fine dining)
      </p>
    </div>
  );
}
