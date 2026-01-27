import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useBusinessGoals } from '@/hooks/useBusinessGoals';
import { GoalsList } from '@/components/goals/GoalsList';
import { GoalCreationForm } from '@/components/goals/GoalCreationForm';
import { EmptyGoalsState } from '@/components/goals/EmptyGoalsState';

export function GoalsPage() {
  const { user } = useAuthStore();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loadingBusiness, setLoadingBusiness] = useState(true);

  // Fetch business ID from database
  useEffect(() => {
    const fetchBusinessId = async () => {
      if (!user?.id) return;

      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          import.meta.env.VITE_SUPABASE_URL,
          import.meta.env.VITE_SUPABASE_ANON_KEY
        );

        const { data, error } = await supabase
          .from('businesses')
          .select('id')
          .eq('owner_id', user.id)
          .single();

        if (error) throw error;
        setBusinessId(data?.id || null);
      } catch (err) {
        console.error('Failed to fetch business:', err);
      } finally {
        setLoadingBusiness(false);
      }
    };

    fetchBusinessId();
  }, [user?.id]);

  const { data: goals, loading, error, create, update, remove } = useBusinessGoals(businessId);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const handleCreateGoal = async (goalData: any) => {
    await create(goalData);
    setShowCreateForm(false);
  };

  // Loading state
  if (loadingBusiness || loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-900 mb-2">Fejl</h2>
          <p className="text-red-700">{error.message}</p>
        </div>
      </div>
    );
  }

  if (!businessId) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-yellow-900 mb-2">Ingen forretning fundet</h2>
          <p className="text-yellow-700">Du skal oprette en forretning først.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      {!showCreateForm && goals && goals.length > 0 && (
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-slate-800 mb-2">Forretningsmål</h1>
            <p className="text-sm text-gray-600">
              {goals.length} aktive mål • AI bruger disse til at drive intelligent markedsføring
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-md text-sm"
          >
            + Nyt mål
          </button>
        </div>
      )}

      {/* Content */}
      {showCreateForm ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <GoalCreationForm
            businessId={businessId}
            onSubmit={handleCreateGoal}
            onCancel={() => setShowCreateForm(false)}
          />
        </div>
      ) : !goals || goals.length === 0 ? (
        <EmptyGoalsState onCreateClick={() => setShowCreateForm(true)} />
      ) : (
        <GoalsList
          goals={goals}
          onUpdate={update}
          onDelete={remove}
        />
      )}
    </div>
  );
}
