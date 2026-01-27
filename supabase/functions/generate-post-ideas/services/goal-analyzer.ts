/**
 * Goal Analyzer Service
 * Analyzes goals and prioritizes them for post generation
 */

interface Goal {
  id: string;
  description: string;
  priority: string;
  target_metric: any;
  time_constraints: any;
  status: string;
  goal_type?: string;
}

export class GoalAnalyzer {
  /**
   * Get top priority goal for post generation
   */
  getTopGoal(goals: Goal[]): Goal | null {
    if (goals.length === 0) return null;

    // Sort by priority
    const priorityOrder: Record<string, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    const sorted = [...goals].sort((a, b) => {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    return sorted[0];
  }

  /**
   * Determine content focus based on goal
   */
  getContentFocus(goal: Goal): string {
    const desc = goal.description.toLowerCase();
    const type = goal.goal_type || '';

    if (desc.includes('frokost') || desc.includes('lunch')) {
      return 'lunch_promotion';
    }
    if (desc.includes('morgenmad') || desc.includes('breakfast')) {
      return 'breakfast_promotion';
    }
    if (desc.includes('aftensmad') || desc.includes('dinner')) {
      return 'dinner_promotion';
    }
    if (type === 'fill_timeslot') {
      return 'capacity_filling';
    }
    if (type === 'promote_offering') {
      return 'menu_highlight';
    }
    if (type === 'build_awareness') {
      return 'brand_building';
    }

    return 'general_promotion';
  }

  /**
   * Get posting urgency based on goal deadline
   */
  getUrgency(goal: Goal): 'immediate' | 'soon' | 'ongoing' {
    if (!goal.target_metric?.target_date) return 'ongoing';

    const deadline = new Date(goal.target_metric.target_date);
    const now = new Date();
    const daysUntil = Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntil <= 7) return 'immediate';
    if (daysUntil <= 30) return 'soon';
    return 'ongoing';
  }
}
