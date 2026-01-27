/**
 * Scheduler Service
 * Suggests optimal posting times based on goal and operations
 */

export class Scheduler {
  /**
   * Suggest posting time based on goal and operations
   */
  suggestPostingTime(goal: any, operations: any): Date {
    const now = new Date();

    // If goal has target days/periods, schedule accordingly
    if (goal?.time_constraints?.target_days && goal.time_constraints.target_days.length > 0) {
      const targetDay = goal.time_constraints.target_days[0];
      const daysAhead = this.getDaysUntilTargetDay(targetDay);
      
      // Post 1 day before target day at 10am
      const postDate = new Date(now);
      postDate.setDate(postDate.getDate() + daysAhead - 1);
      postDate.setHours(10, 0, 0, 0);
      
      return postDate;
    }

    // If targeting slow periods, post day before at 4pm
    if (operations?.typical_slow_periods && operations.typical_slow_periods.length > 0) {
      const slowPeriod = operations.typical_slow_periods[0];
      const daysAhead = this.getDaysUntilTargetDay(slowPeriod.day);
      
      const postDate = new Date(now);
      postDate.setDate(postDate.getDate() + daysAhead - 1);
      postDate.setHours(16, 0, 0, 0);
      
      return postDate;
    }

    // Default: next day at 10am
    const postDate = new Date(now);
    postDate.setDate(postDate.getDate() + 1);
    postDate.setHours(10, 0, 0, 0);
    
    return postDate;
  }

  /**
   * Get days until target day
   */
  private getDaysUntilTargetDay(targetDay: string): number {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = new Date().getDay();
    const target = days.indexOf(targetDay.toLowerCase());
    
    if (target === -1) return 1; // Default 1 day if invalid
    
    let daysAhead = target - today;
    if (daysAhead <= 0) daysAhead += 7; // Next week if already passed
    
    return daysAhead;
  }
}
