import { GoalCard } from './GoalCard';

// Temporary type definition (business_goals table was dropped but components still exist)
interface BusinessGoal {
  id: string;
  business_id: string;
  goal_type: string;
  description: string;
  priority: string;
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
  created_at: string;
}

interface GoalsListProps {
  goals: BusinessGoal[];
  onUpdate: (goalId: string, updates: any) => Promise<void>;
  onDelete: (goalId: string) => Promise<void>;
}

export function GoalsList({ goals, onUpdate, onDelete }: GoalsListProps) {
  // Sort by priority and created date
  const sortedGoals = [...goals].sort((a, b) => {
    const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    const priorityDiff = (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4);
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
