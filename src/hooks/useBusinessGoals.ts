/**
 * Custom hook for managing Business Goals
 * Demonstrates type-safe CRUD operations with new schema
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { BusinessGoal, CreateBusinessGoal } from '@/types';

interface UseBusinessGoalsReturn {
  goals: BusinessGoal[];
  loading: boolean;
  error: string | null;
  createGoal: (goal: CreateBusinessGoal) => Promise<BusinessGoal | null>;
  updateGoal: (id: string, updates: Partial<BusinessGoal>) => Promise<boolean>;
  deleteGoal: (id: string) => Promise<boolean>;
  refetch: () => Promise<void>;
}

export function useBusinessGoals(businessId: string | null): UseBusinessGoalsReturn {
  const [goals, setGoals] = useState<BusinessGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch goals
  const fetchGoals = async () => {
    if (!businessId) {
      setGoals([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await (supabase as any)
        .from('business_goals')
        .select('*')
        .eq('business_id', businessId)
        .order('priority', { ascending: true })
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setGoals(data as unknown as BusinessGoal[]);
    } catch (err) {
      console.error('Error fetching goals:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch goals');
    } finally {
      setLoading(false);
    }
  };

  // Create new goal
  const createGoal = async (goal: CreateBusinessGoal): Promise<BusinessGoal | null> => {
    try {
      setError(null);

      const { data, error: createError } = await (supabase as any)
        .from('business_goals')
        .insert(goal)
        .select()
        .single();

      if (createError) throw createError;

      const newGoal = data as unknown as BusinessGoal;
      setGoals(prev => [newGoal, ...prev]);
      
      return newGoal;
    } catch (err) {
      console.error('Error creating goal:', err);
      setError(err instanceof Error ? err.message : 'Failed to create goal');
      return null;
    }
  };

  // Update goal
  const updateGoal = async (id: string, updates: Partial<BusinessGoal>): Promise<boolean> => {
    try {
      setError(null);

      const { error: updateError } = await (supabase as any)
        .from('business_goals')
        .update(updates)
        .eq('id', id);

      if (updateError) throw updateError;

      // Update local state
      setGoals(prev => 
        prev.map(goal => 
          goal.id === id ? { ...goal, ...updates } : goal
        )
      );

      return true;
    } catch (err) {
      console.error('Error updating goal:', err);
      setError(err instanceof Error ? err.message : 'Failed to update goal');
      return false;
    }
  };

  // Delete goal
  const deleteGoal = async (id: string): Promise<boolean> => {
    try {
      setError(null);

      const { error: deleteError } = await (supabase as any)
        .from('business_goals')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      // Update local state
      setGoals(prev => prev.filter(goal => goal.id !== id));

      return true;
    } catch (err) {
      console.error('Error deleting goal:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete goal');
      return false;
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchGoals();
  }, [businessId]);

  return {
    goals,
    loading,
    error,
    createGoal,
    updateGoal,
    deleteGoal,
    refetch: fetchGoals,
  };
}
