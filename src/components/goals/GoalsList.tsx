import { GoalCard } from './GoalCard';
import type { BusinessGoal } from '@/types';

interface GoalsListProps {
  goals: BusinessGoal[];
  onUpdate: (goalId: string, updates: any) => Promise<void>;
  onDelete: (goalId: string) => Promise<void>;
}

export function GoalsList({ goals, onUpdate, onDelete }: GoalsListProps) {
  // Sort by priority and created date
  const sortedGoals = [...goals].sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {sortedGoals.map(goal => (
        <GoalCard
          key={goal.id}
          goal={goal}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
