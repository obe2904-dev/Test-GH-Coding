import { useState } from 'react';
import type { DayOfWeek, ServicePeriod } from '@/types';

interface CapacityPattern {
  day: DayOfWeek;
  period: ServicePeriod;
  capacity_pct: number;
}

interface CapacityPatternsFormProps {
  busyPeriods: CapacityPattern[];
  slowPeriods: CapacityPattern[];
  onBusyPeriodsChange: (periods: CapacityPattern[]) => void;
  onSlowPeriodsChange: (periods: CapacityPattern[]) => void;
}

const DAYS: { value: DayOfWeek; label: string }[] = [
  { value: 'monday', label: 'Mandag' },
  { value: 'tuesday', label: 'Tirsdag' },
  { value: 'wednesday', label: 'Onsdag' },
  { value: 'thursday', label: 'Torsdag' },
  { value: 'friday', label: 'Fredag' },
  { value: 'saturday', label: 'Lørdag' },
  { value: 'sunday', label: 'Søndag' },
];

const PERIODS: { value: ServicePeriod; label: string }[] = [
  { value: 'breakfast', label: 'Morgenmad' },
  { value: 'brunch', label: 'Brunch' },
  { value: 'lunch', label: 'Frokost' },
  { value: 'afternoon_coffee', label: 'Eftermiddag' },
  { value: 'dinner', label: 'Aftensmad' },
  { value: 'late_night', label: 'Sent' },
];

export function CapacityPatternsForm({
  busyPeriods,
  slowPeriods,
  onBusyPeriodsChange,
  onSlowPeriodsChange
}: CapacityPatternsFormProps) {
  const [showBusyForm, setShowBusyForm] = useState(false);
  const [showSlowForm, setShowSlowForm] = useState(false);

  const handleAddBusy = (day: DayOfWeek, period: ServicePeriod) => {
    const newPeriod: CapacityPattern = {
      day,
      period,
      capacity_pct: 90,
    };
    onBusyPeriodsChange([...busyPeriods, newPeriod]);
    setShowBusyForm(false);
  };

  const handleAddSlow = (day: DayOfWeek, period: ServicePeriod) => {
    const newPeriod: CapacityPattern = {
      day,
      period,
      capacity_pct: 40,
    };
    onSlowPeriodsChange([...slowPeriods, newPeriod]);
    setShowSlowForm(false);
  };

  const handleRemoveBusy = (index: number) => {
    onBusyPeriodsChange(busyPeriods.filter((_, i) => i !== index));
  };

  const handleRemoveSlow = (index: number) => {
    onSlowPeriodsChange(slowPeriods.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Kapacitetsmønstre</h3>
        <p className="text-sm text-gray-600 mb-4">
          Fortæl AI hvornår I typisk er travle vs. rolige. Dette hjælper med at målrette markedsføring.
        </p>
      </div>

      {/* Busy periods */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-900">🔥 Travle perioder</h4>
          <button
            onClick={() => setShowBusyForm(true)}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            + Tilføj
          </button>
        </div>

        {busyPeriods.length === 0 && (
          <p className="text-sm text-gray-500 italic">Ingen travle perioder tilføjet endnu</p>
        )}

        <div className="space-y-2">
          {busyPeriods.map((period, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
              <span className="text-sm text-gray-900">
                {DAYS.find(d => d.value === period.day)?.label} - {PERIODS.find(p => p.value === period.period)?.label}
              </span>
              <button
                onClick={() => handleRemoveBusy(index)}
                className="text-red-600 hover:text-red-700 text-sm"
              >
                Fjern
              </button>
            </div>
          ))}
        </div>

        {showBusyForm && (
          <SimplePatternForm
            onAdd={handleAddBusy}
            onCancel={() => setShowBusyForm(false)}
          />
        )}
      </div>

      {/* Slow periods */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-900">📉 Rolige perioder</h4>
          <button
            onClick={() => setShowSlowForm(true)}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            + Tilføj
          </button>
        </div>

        {slowPeriods.length === 0 && (
          <p className="text-sm text-gray-500 italic">Ingen rolige perioder tilføjet endnu</p>
        )}

        <div className="space-y-2">
          {slowPeriods.map((period, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <span className="text-sm text-gray-900">
                {DAYS.find(d => d.value === period.day)?.label} - {PERIODS.find(p => p.value === period.period)?.label}
              </span>
              <button
                onClick={() => handleRemoveSlow(index)}
                className="text-blue-600 hover:text-blue-700 text-sm"
              >
                Fjern
              </button>
            </div>
          ))}
        </div>

        {showSlowForm && (
          <SimplePatternForm
            onAdd={handleAddSlow}
            onCancel={() => setShowSlowForm(false)}
          />
        )}
      </div>
    </div>
  );
}

// Simple inline form for adding patterns
function SimplePatternForm({ 
  onAdd, 
  onCancel 
}: { 
  onAdd: (day: DayOfWeek, period: ServicePeriod) => void;
  onCancel: () => void;
}) {
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('monday');
  const [selectedPeriod, setSelectedPeriod] = useState<ServicePeriod>('lunch');

  return (
    <div className="mt-3 p-4 bg-gray-100 rounded-lg space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Dag</label>
          <select
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value as DayOfWeek)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            {DAYS.map(day => (
              <option key={day.value} value={day.value}>{day.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Periode</label>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as ServicePeriod)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            {PERIODS.map(period => (
              <option key={period.value} value={period.value}>{period.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onAdd(selectedDay, selectedPeriod)}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Tilføj
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
        >
          Annuller
        </button>
      </div>
    </div>
  );
}
