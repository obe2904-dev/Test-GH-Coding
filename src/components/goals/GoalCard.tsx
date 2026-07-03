import { useState } from 'react';

// Temporary type definition (business_goals table was dropped but components still exist)
interface BusinessGoal {
  id: string;
  business_id: string;
  goal_type: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  target_metric: {
    metric: string;
    current_value: number;
    target_value: number;
    target_date?: string;
  };
  time_constraints: {
    target_days?: string[];
    target_periods?: string[];
  };
  progress_pct: number;
  status: string;
}

interface GoalCardProps {
  goal: BusinessGoal;
  onUpdate: (goalId: string, updates: any) => Promise<void>;
  onDelete: (goalId: string) => Promise<void>;
}

const PRIORITY_COLORS = {
  critical: 'bg-red-100 border-red-300 text-red-800',
  high: 'bg-orange-100 border-orange-300 text-orange-800',
  medium: 'bg-yellow-100 border-yellow-300 text-yellow-800',
  low: 'bg-blue-100 border-blue-300 text-blue-800',
};

const STATUS_LABELS = {
  not_started: 'Ikke startet',
  in_progress: 'I gang',
  achieved: 'Opnået',
  paused: 'Pauset',
};

export function GoalCard({ goal, onUpdate, onDelete }: GoalCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [progress, setProgress] = useState(goal.progress_pct);
  const [status, setStatus] = useState(goal.status);

  const handleSaveProgress = async () => {
    await onUpdate(goal.id, { progress_pct: progress, status });
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (confirm('Er du sikker på at du vil slette dette mål?')) {
      await onDelete(goal.id);
    }
  };

  const priorityColor = PRIORITY_COLORS[goal.priority as keyof typeof PRIORITY_COLORS];

  return (
    <div className={`rounded-lg border-2 p-6 ${priorityColor}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wide">
              {goal.priority}
            </span>
            <span className="text-xs">•</span>
            <span className="text-xs">{goal.goal_type.replace('_', ' ')}</span>
          </div>
          <h3 className="text-sm font-bold text-slate-800">{goal.description}</h3>
        </div>
        
        <button
          onClick={handleDelete}
          className="text-gray-400 hover:text-red-600 text-sm"
          title="Slet mål"
        >
          🗑️
        </button>
      </div>

      {/* Target Metric */}
      <div className="bg-white/50 rounded-lg p-4 mb-4">
        <div className="text-sm text-gray-600 mb-1">Målsætning:</div>
        <div className="text-lg font-semibold text-gray-900">
          {goal.target_metric.current_value} → {goal.target_metric.target_value} {goal.target_metric.metric}
        </div>
        {goal.target_metric.target_date && (
          <div className="text-xs text-gray-500 mt-1">
            Deadline: {new Date(goal.target_metric.target_date).toLocaleDateString('da-DK')}
          </div>
        )}
      </div>

      {/* Time Constraints */}
      {goal.time_constraints.target_days && goal.time_constraints.target_days.length > 0 && (
        <div className="mb-4">
          <div className="text-sm text-gray-600 mb-1">Fokus:</div>
          <div className="flex flex-wrap gap-2">
            {goal.time_constraints.target_days.map((day: string) => (
              <span key={day} className="px-2 py-1 bg-white/70 rounded text-xs font-medium">
                {day}
              </span>
            ))}
            {goal.time_constraints.target_periods && goal.time_constraints.target_periods.map((period: string) => (
              <span key={period} className="px-2 py-1 bg-white/70 rounded text-xs font-medium">
                {period}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Fremgang</span>
          <span className="text-sm font-semibold text-gray-900">{progress}%</span>
        </div>
        
        {isEditing ? (
          <div className="space-y-3">
            <input
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={(e) => setProgress(parseInt(e.target.value))}
              className="w-full"
            />
            
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="not_started">Ikke startet</option>
              <option value="in_progress">I gang</option>
              <option value="achieved">Opnået</option>
              <option value="paused">Pauset</option>
            </select>

            <div className="flex gap-2">
              <button
                onClick={handleSaveProgress}
                className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800"
              >
                Gem
              </button>
              <button
                onClick={() => {
                  setProgress(goal.progress_pct);
                  setStatus(goal.status);
                  setIsEditing(false);
                }}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                Annuller
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="w-full bg-white/50 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-gray-900 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-gray-600">
                Status: {STATUS_LABELS[goal.status as keyof typeof STATUS_LABELS]}
              </span>
              <button
                onClick={() => setIsEditing(true)}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                Opdater fremgang
              </button>
            </div>
          </>
        )}
      </div>

      {/* Created date */}
      <div className="text-xs text-gray-500">
        Oprettet: {new Date(goal.created_at).toLocaleDateString('da-DK')}
      </div>
    </div>
  );
}
