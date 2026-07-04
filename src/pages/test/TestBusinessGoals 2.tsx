/**
 * Test page for Business Goals hook
 * Demonstrates CRUD operations with new database schema
 * 
 * ⚠️ DEPRECATED: business_goals table dropped April 2026
 * This file is archived and non-functional
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
// import { useBusinessGoals } from '@/hooks/useBusinessGoals';
// import type { CreateBusinessGoal, GoalType, Priority } from '@/types';
type CreateBusinessGoal = any; // Placeholder for removed type
type GoalType = any;
type Priority = any;

export default function TestBusinessGoals() {
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Stub for deprecated hook
  const goals: any[] = [];
  const loading = false;
  const error = null;
  const createGoal = async (_: any) => ({ success: true } as any);
  const updateGoal = async (_id: any, __data: any) => {};
  const deleteGoal = async (_id: any) => {};
  // const { goals, loading, error, createGoal, updateGoal, deleteGoal } = useBusinessGoals(businessId);

  // Get current business ID
  useEffect(() => {
    const fetchBusiness = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: business } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (business) {
        setBusinessId(business.id);
      }
    };

    fetchBusiness();
  }, []);

  const handleCreateGoal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!businessId) return;

    const formData = new FormData(e.currentTarget);

    const newGoal: CreateBusinessGoal = {
      business_id: businessId,
      goal_type: formData.get('goal_type') as GoalType,
      priority: formData.get('priority') as Priority,
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      target_metric: {
        metric: 'bookings',
        current_value: 10,
        target_value: 30,
        target_date: '2026-03-31',
      },
      time_constraints: {},
      target_audience_segment: {},
      promotional_hook: {},
      status: 'not_started',
      progress_pct: 0,
      notes: null,
    };

    const result = await createGoal(newGoal);
    if (result) {
      setShowCreateForm(false);
      e.currentTarget.reset();
    }
  };

  const handleUpdateProgress = async (goalId: string, newProgress: number) => {
    await updateGoal(goalId, { progress_pct: newProgress });
  };

  const handleChangeStatus = async (goalId: string, newStatus: string) => {
    await updateGoal(goalId, { status: newStatus as any });
  };

  const handleDelete = async (goalId: string) => {
    if (confirm('Are you sure you want to delete this goal?')) {
      await deleteGoal(goalId);
    }
  };

  if (!businessId) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <p className="text-gray-500">No business found. Please complete onboarding first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Business Goals Test Page
          </h1>
          <p className="text-gray-600">
            Testing type-safe CRUD operations with new business_goals schema
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">Error: {error}</p>
          </div>
        )}

        {/* Create Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            {showCreateForm ? 'Cancel' : '+ Create New Goal'}
          </button>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <div className="mb-6 p-6 bg-white rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold mb-4">Create New Goal</h2>
            <form onSubmit={handleCreateGoal} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Goal Type
                </label>
                <select
                  name="goal_type"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="fill_timeslot">Fill Time Slot</option>
                  <option value="promote_offering">Promote Offering</option>
                  <option value="build_awareness">Build Awareness</option>
                  <option value="drive_reservations">Drive Reservations</option>
                  <option value="increase_engagement">Increase Engagement</option>
                  <option value="launch_new_offering">Launch New Offering</option>
                  <option value="seasonal_campaign">Seasonal Campaign</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  name="priority"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="e.g., Fill Wednesday lunch slots"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  required
                  rows={3}
                  placeholder="Describe the goal and strategy..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                Create Goal
              </button>
            </form>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading goals...</p>
          </div>
        )}

        {/* Goals List */}
        {!loading && goals.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
            <p className="text-gray-500">No goals yet. Create one to get started!</p>
          </div>
        )}

        {!loading && goals.length > 0 && (
          <div className="space-y-4">
            {goals.map((goal: any) => (
              <div
                key={goal.id}
                className="p-6 bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition"
              >
                {/* Goal Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          goal.priority === 'critical'
                            ? 'bg-red-100 text-red-700'
                            : goal.priority === 'high'
                            ? 'bg-orange-100 text-orange-700'
                            : goal.priority === 'medium'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {goal.priority.toUpperCase()}
                      </span>
                      <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-700">
                        {goal.goal_type.replace(/_/g, ' ').toUpperCase()}
                      </span>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          goal.status === 'achieved'
                            ? 'bg-green-100 text-green-700'
                            : goal.status === 'in_progress'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {goal.status.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">{goal.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{goal.description}</p>
                  </div>

                  <button
                    onClick={() => handleDelete(goal.id)}
                    className="ml-4 p-2 text-gray-400 hover:text-red-600 transition"
                    title="Delete goal"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">Progress</span>
                    <span className="text-sm font-medium text-gray-900">{goal.progress_pct}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full transition-all"
                      style={{ width: `${goal.progress_pct}%` }}
                    />
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Progress:</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={goal.progress_pct}
                      onChange={(e) => handleUpdateProgress(goal.id, parseInt(e.target.value))}
                      className="w-32"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Status:</label>
                    <select
                      value={goal.status}
                      onChange={(e) => handleChangeStatus(goal.id, e.target.value)}
                      className="text-sm px-2 py-1 border border-gray-300 rounded"
                    >
                      <option value="not_started">Not Started</option>
                      <option value="in_progress">In Progress</option>
                      <option value="achieved">Achieved</option>
                      <option value="paused">Paused</option>
                      <option value="abandoned">Abandoned</option>
                    </select>
                  </div>
                </div>

                {/* Metadata */}
                <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500">
                  <p>ID: {goal.id}</p>
                  <p>Created: {new Date(goal.created_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Debug Info */}
        <div className="mt-8 p-4 bg-gray-800 text-gray-100 rounded-lg font-mono text-xs overflow-auto">
          <p className="font-bold mb-2">Debug Info:</p>
          <p>Business ID: {businessId}</p>
          <p>Goals Count: {goals.length}</p>
          <p>Loading: {loading.toString()}</p>
          <p>Error: {error || 'null'}</p>
        </div>
      </div>
    </div>
  );
}
