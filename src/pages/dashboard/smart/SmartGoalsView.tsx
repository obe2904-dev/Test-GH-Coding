import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/useAuthStore';
import { useBusinessGoals } from '@/hooks/useBusinessKnowledge';
import { UpgradePrompt } from '@/components/tier/UpgradePrompt';

export function SmartGoalsView() {
  const { t } = useTranslation(['goals', 'tier']);
  const { business } = useAuthStore();
  const { data: goals, loading } = useBusinessGoals(business?.id || '');

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // Show top 3 priority goals only
  const topGoals = goals.slice(0, 3);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dine Mål</h1>
        <p className="text-gray-600">
          AI fokuserer på dine top 3 prioriterede mål
        </p>
      </div>

      {/* Top 3 Goals (Read-only) */}
      {topGoals.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <p className="text-gray-600">Du har ingen mål endnu. Opgrader til Pro for at oprette mål.</p>
        </div>
      ) : (
        <div className="space-y-4 mb-8">
          {topGoals.map((goal, index) => (
            <div key={goal.id} className="bg-white rounded-lg border-2 border-gray-200 p-6">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-sm text-gray-500 mb-1">
                    Mål {index + 1} • {goal.priority}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">{goal.description}</h3>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="text-sm text-gray-600 mb-1">Fremgang:</div>
                <div className="flex items-center gap-4">
                  <div className="flex-1 bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${goal.progress_pct}%` }}
                    />
                  </div>
                  <div className="text-lg font-bold text-gray-900">{goal.progress_pct}%</div>
                </div>
              </div>

              <div className="text-sm text-gray-600">
                <strong>Mål:</strong> {goal.target_metric.current_value} → {goal.target_metric.target_value} {goal.target_metric.metric}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upgrade prompt if more than 3 goals or wants to edit */}
      {(goals.length > 3 || goals.length > 0) && (
        <UpgradePrompt compact />
      )}
    </div>
  );
}
