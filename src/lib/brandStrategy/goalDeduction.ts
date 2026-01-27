/**
 * Communication Goal Deduction
 * 
 * POOL (locked): drive_visits, increase_bookings, build_local_awareness, fill_off_peak
 * 
 * Exactly ONE goal per business.
 * Goal is deduced from audience + business constraints + location.
 */

import { 
  StrategyDeductionInputs, 
  CommunicationGoal, 
  CommunicationGoalType,
  TargetAudience 
} from './types';

/**
 * Goal selection rules.
 */
interface GoalScoreRules {
  audiences: string[]; // Audiences that fit this goal
  businessTypes: string[]; // Business types that commonly use this goal
  locationBoost: string[]; // Location categories that boost this goal
  hourPatterns: string[]; // Hour patterns that indicate this goal
}

const GOAL_RULES: Record<CommunicationGoalType, GoalScoreRules> = {
  'drive_visits': {
    audiences: ['locals', 'office_workers', 'students'],
    businessTypes: ['cafe', 'coffee_shop'],
    locationBoost: ['residential', 'office', 'city_centre'],
    hourPatterns: ['hasBreakfast', 'hasLunch', 'opensWeekdays']
  },
  
  'increase_bookings': {
    audiences: ['social_groups', 'families', 'tourists'],
    businessTypes: ['restaurant'],
    locationBoost: ['waterfront', 'tourist', 'city_centre'],
    hourPatterns: ['hasDinner', 'opensWeekends']
  },
  
  'build_local_awareness': {
    audiences: ['locals', 'families'],
    businessTypes: ['cafe', 'restaurant', 'bar'],
    locationBoost: ['residential', 'mixed_use'],
    hourPatterns: ['opensWeekdays', 'opensWeekends']
  },
  
  'fill_off_peak': {
    audiences: ['office_workers', 'locals'],
    businessTypes: ['restaurant', 'cafe', 'bar'],
    locationBoost: ['city_centre', 'office'],
    hourPatterns: ['hasBreakfast', 'hasLunch', 'opensWeekdays']
  }
};

/**
 * Calculate goal scores based on audience + business context.
 */
export function calculateGoalScores(
  targetAudience: TargetAudience,
  inputs: StrategyDeductionInputs
): Record<CommunicationGoalType, number> {
  const scores: Record<string, number> = {};
  
  for (const [goal, rules] of Object.entries(GOAL_RULES)) {
    let score = 0;
    
    // 1. Primary audience fit (+30 per matching audience)
    for (const audience of targetAudience.primary) {
      if (rules.audiences.includes(audience)) {
        score += 30;
      }
    }
    
    // 2. Business type fit (+20)
    if (rules.businessTypes.includes(inputs.businessType)) {
      score += 20;
    }
    
    // 3. Location category boost (+15 per matching category with high score)
    for (const locationType of rules.locationBoost) {
      const locationScore = inputs.location.categoryScores[locationType] ?? 0;
      if (locationScore > 50) {
        score += 15;
      }
    }
    
    // 4. Hour patterns (+10 per match)
    for (const hourPattern of rules.hourPatterns) {
      if (inputs.hours[hourPattern as keyof typeof inputs.hours]) {
        score += 10;
      }
    }
    
    scores[goal] = score;
  }
  
  return scores as Record<CommunicationGoalType, number>;
}

/**
 * Select the single best communication goal.
 */
export function selectCommunicationGoal(
  scores: Record<CommunicationGoalType, number>,
  targetAudience: TargetAudience,
  inputs: StrategyDeductionInputs
): CommunicationGoal {
  const sortedGoals = Object.entries(scores)
    .sort(([_, a], [__, b]) => b - a);
  
  const [topGoal, topScore] = sortedGoals[0];
  
  // Generate reasoning
  const reasoning: string[] = [];
  const goal = topGoal as CommunicationGoalType;
  const rules = GOAL_RULES[goal];
  
  // Explain why this goal was chosen
  const matchingAudiences = targetAudience.primary.filter(aud => 
    rules.audiences.includes(aud)
  );
  if (matchingAudiences.length > 0) {
    reasoning.push(`Passer til målgruppe: ${matchingAudiences.join(', ')}`);
  }
  
  if (rules.businessTypes.includes(inputs.businessType)) {
    reasoning.push(`Typisk for ${inputs.businessType}`);
  }
  
  const matchingLocations = rules.locationBoost.filter(loc => 
    (inputs.location.categoryScores[loc] ?? 0) > 50
  );
  if (matchingLocations.length > 0) {
    reasoning.push(`Lokation: ${matchingLocations[0]}`);
  }
  
  // Determine confidence
  let confidence: 'high' | 'medium' | 'low' = 'low';
  
  if (topScore >= 50) {
    confidence = 'high';
  } else if (topScore >= 30) {
    confidence = 'medium';
  }
  
  return {
    goal,
    reasoning,
    confidence
  };
}

/**
 * Deduce communication goal from target audience + business context.
 * 
 * This is the main entry point for goal deduction.
 */
export function deduceCommunicationGoal(
  targetAudience: TargetAudience,
  inputs: StrategyDeductionInputs
): CommunicationGoal {
  const scores = calculateGoalScores(targetAudience, inputs);
  return selectCommunicationGoal(scores, targetAudience, inputs);
}
