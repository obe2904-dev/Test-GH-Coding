import { useState } from 'react';

// Types for business goals (table was dropped April 2026)
type GoalType = 'fill_timeslot' | 'promote_offering' | 'build_awareness' | 'drive_reservations';
type Priority = 'critical' | 'high' | 'medium' | 'low';
type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
type ServicePeriod = 'breakfast' | 'lunch' | 'dinner' | 'late_night';

interface CreateBusinessGoal {
  business_id: string;
  goal_type: GoalType;
  priority: Priority;
  description: string;
  target_metric: {
    metric: string;
    current_value: number;
    target_value: number;
    target_date?: string;
  };
  time_constraints?: {
    target_days?: DayOfWeek[];
    target_periods?: ServicePeriod[];
  };
}

interface GoalCreationFormProps {
  businessId: string;
  onSubmit: (goal: CreateBusinessGoal) => Promise<void>;
  onCancel: () => void;
}

const GOAL_TYPES: { value: GoalType; label: string; description: string }[] = [
  { value: 'fill_timeslot', label: 'Fyld tidsrum', description: 'Øg bookinger i rolige perioder' },
  { value: 'promote_offering', label: 'Promovér tilbud', description: 'Øg salg af specifik ret/produkt' },
  { value: 'build_awareness', label: 'Byg bevidsthed', description: 'Øg følgere, reach, engagement' },
  { value: 'drive_reservations', label: 'Øg reservationer', description: 'Flere bordreservationer' },
];

const PRIORITIES: { value: Priority; label: string; emoji: string }[] = [
  { value: 'critical', label: 'Kritisk', emoji: '🔴' },
  { value: 'high', label: 'Høj', emoji: '🟠' },
  { value: 'medium', label: 'Medium', emoji: '🟡' },
  { value: 'low', label: 'Lav', emoji: '🔵' },
];

const DAYS: { value: DayOfWeek; label: string }[] = [
  { value: 'monday', label: 'Man' },
  { value: 'tuesday', label: 'Tir' },
  { value: 'wednesday', label: 'Ons' },
  { value: 'thursday', label: 'Tor' },
  { value: 'friday', label: 'Fre' },
  { value: 'saturday', label: 'Lør' },
  { value: 'sunday', label: 'Søn' },
];

const PERIODS: { value: ServicePeriod; label: string }[] = [
  { value: 'breakfast', label: 'Morgenmad' },
  { value: 'brunch', label: 'Brunch' },
  { value: 'lunch', label: 'Frokost' },
  { value: 'dinner', label: 'Aftensmad' },
];

export function GoalCreationForm({ businessId, onSubmit, onCancel }: GoalCreationFormProps) {
  const [goalType, setGoalType] = useState<GoalType>('fill_timeslot');
  const [priority, setPriority] = useState<Priority>('high');
  const [description, setDescription] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [metric, setMetric] = useState('bookings');
  const [targetDate, setTargetDate] = useState('');
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>([]);
  const [selectedPeriods, setSelectedPeriods] = useState<ServicePeriod[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const toggleDay = (day: DayOfWeek) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const togglePeriod = (period: ServicePeriod) => {
    setSelectedPeriods(prev =>
      prev.includes(period) ? prev.filter(p => p !== period) : [...prev, period]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!description || !currentValue || !targetValue) {
      alert('Udfyld venligst alle påkrævede felter');
      return;
    }

    setSubmitting(true);

    try {
      const newGoal: CreateBusinessGoal = {
        business_id: businessId,
        goal_type: goalType,
        priority,
        title: description.substring(0, 100), // Use first 100 chars as title
        description,
        target_metric: {
          metric: metric as any,
          current_value: parseFloat(currentValue),
          target_value: parseFloat(targetValue),
          target_date: targetDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Default 90 days
        },
        time_constraints: {
          target_days: selectedDays.length > 0 ? selectedDays : undefined,
          target_periods: selectedPeriods.length > 0 ? selectedPeriods : undefined,
        },
        target_audience_segment: {},
        promotional_hook: {},
        status: 'not_started',
        progress_pct: 0,
        notes: null,
      };

      await onSubmit(newGoal);
    } catch (error) {
      console.error('Failed to create goal:', error);
      alert('Kunne ikke oprette mål. Prøv igen.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Opret nyt mål</h2>
        <p className="text-gray-600">Definer hvad du vil opnå</p>
      </div>

      {/* Goal Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Type af mål
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {GOAL_TYPES.map(type => (
            <button
              key={type.value}
              type="button"
              onClick={() => setGoalType(type.value)}
              className={`p-4 rounded-lg border-2 text-left transition-colors ${
                goalType === type.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-medium text-gray-900">{type.label}</div>
              <div className="text-sm text-gray-600 mt-1">{type.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Priority */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Prioritet
        </label>
        <div className="flex gap-2">
          {PRIORITIES.map(p => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPriority(p.value)}
              className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
                priority === p.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-2xl mb-1">{p.emoji}</div>
              <div className="text-sm font-medium">{p.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
          Beskriv målet *
        </label>
        <input
          id="description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="f.eks. Øg onsdags frokost fra 40% til 70% kapacitet"
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Target Metric */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="current-value" className="block text-sm font-medium text-gray-700 mb-2">
            Nuværende værdi *
          </label>
          <input
            id="current-value"
            type="number"
            value={currentValue}
            onChange={(e) => setCurrentValue(e.target.value)}
            placeholder="18"
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="target-value" className="block text-sm font-medium text-gray-700 mb-2">
            Målværdi *
          </label>
          <input
            id="target-value"
            type="number"
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
            placeholder="32"
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="metric" className="block text-sm font-medium text-gray-700 mb-2">
            Målenhed
          </label>
          <select
            id="metric"
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="bookings">Bookinger</option>
            <option value="revenue">Omsætning (DKK)</option>
            <option value="engagement">Engagement</option>
            <option value="awareness">Bevidsthed</option>
          </select>
        </div>
      </div>

      {/* Target Date */}
      <div>
        <label htmlFor="target-date" className="block text-sm font-medium text-gray-700 mb-2">
          Deadline (valgfri)
        </label>
        <input
          id="target-date"
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Time Constraints */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Fokus dage (valgfri)
        </label>
        <div className="flex flex-wrap gap-2">
          {DAYS.map(day => (
            <button
              key={day.value}
              type="button"
              onClick={() => toggleDay(day.value)}
              className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                selectedDays.includes(day.value)
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {day.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Fokus perioder (valgfri)
        </label>
        <div className="flex flex-wrap gap-2">
          {PERIODS.map(period => (
            <button
              key={period.value}
              type="button"
              onClick={() => togglePeriod(period.value)}
              className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                selectedPeriods.includes(period.value)
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4 pt-4 border-t border-gray-200">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Opretter...' : 'Opret mål'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
        >
          Annuller
        </button>
      </div>
    </form>
  );
}
