/**
 * Content Type System - Phase A: Types and Constants
 * 
 * Defines the 4-type taxonomy for content allocation:
 * - PRODUCT: Menu highlights, ingredients, preparation
 * - EXPERIENCE: Atmosphere, setting, behind-the-scenes  
 * - OCCASION: Calendar events, urgency, booking prompts
 * - RETENTION: Insider knowledge, rituals, loyalty
 */

// Content type enum
export type ContentType = 'PRODUCT' | 'EXPERIENCE' | 'OCCASION' | 'RETENTION';

// Goal modes from business_programme_profiles.baseline_goal_split
export type GoalMode = 'footfall' | 'brand' | 'retention';

/**
 * Normalize Phase 1 goal_mode values to contentTypeSystem GoalMode enum
 * Phase 1 uses: drive_footfall, enhance_brand, build_brand, increase_loyalty, retain_loyalty
 * Allocator uses: footfall, brand, retention
 */
export function normalizeGoalMode(rawGoalMode: string): GoalMode {
  const normalized = rawGoalMode.toLowerCase();
  if (normalized.includes('footfall')) return 'footfall';
  if (normalized.includes('brand')) return 'brand';
  if (normalized.includes('loyalty') || normalized.includes('retention')) return 'retention';
  
  console.warn(`[normalizeGoalMode] Unknown goal mode "${rawGoalMode}", defaulting to footfall`);
  return 'footfall';
}

// Type eligibility mapping: which goal modes favor which content types
export const TYPE_GOAL_ELIGIBILITY: Record<ContentType, GoalMode[]> = {
  PRODUCT: ['footfall'],
  EXPERIENCE: ['brand', 'retention'],
  OCCASION: ['footfall', 'brand'],
  RETENTION: ['retention'],
};

// Default target mix (business-level)
export const DEFAULT_TYPE_MIX: TypeMix = {
  product: 0.35,
  experience: 0.30,
  occasion: 0.25,
  retention: 0.10,
};

// Type metadata for AI generation
export const TYPE_METADATA: Record<ContentType, {
  label: string;
  description: string;
  examplePrompts: string[];
}> = {
  PRODUCT: {
    label: 'Product/Menu',
    description: 'Focus on specific dishes, drinks, ingredients, or preparation methods',
    examplePrompts: [
      'Describe this dish compellingly',
      'Highlight the key ingredients',
      'What makes this special?',
    ],
  },
  EXPERIENCE: {
    label: 'Experience/Atmosphere',
    description: 'Focus on setting, place, atmosphere, or the people/process behind the food',
    examplePrompts: [
      'Describe the setting and atmosphere',
      'Show the behind-the-scenes process',
      'What\'s the story of the place?',
    ],
  },
  OCCASION: {
    label: 'Occasion/Event',
    description: 'Focus on calendar events, booking urgency, or time-sensitive opportunities',
    examplePrompts: [
      'Connect to the cultural significance',
      'Create booking urgency',
      'Highlight the perfect timing',
    ],
  },
  RETENTION: {
    label: 'Retention/Insider',
    description: 'Focus on insider knowledge, regular rituals, or loyalty elements',
    examplePrompts: [
      'Share insider knowledge',
      'Celebrate the regulars',
      'Show what makes this special for those who know',
    ],
  },
};

// Programme profile with type system fields
export interface ProgrammeProfile {
  id: string;
  business_id: string;
  programme_type: string;
  programme_name: string;
  time_windows: string[];
  operating_days: string[];
  baseline_goal_split: {
    drive_footfall?: number;
    strengthen_brand?: number;
    retain_regulars?: number;
  };
  decision_timing: string;
  accepts_reservations: boolean;
  is_active: boolean;
}

// Type mix configuration
export interface TypeMix {
  product: number;
  experience: number;
  occasion: number;
  retention: number;
}

// Type staleness tracking (for drift correction)
export interface TypeStaleness {
  type: ContentType;
  lastUsed: string | null; // ISO date of last post with this type
  daysSince: number | null; // Days since last use (null if never used)
  priority: number; // 0-1 score, higher = more stale
}

// Type drift calculation (actual vs target)
export interface TypeDrift {
  type: ContentType;
  target: number; // Target percentage (0.0-1.0)
  actual: number; // Actual percentage in last N posts
  drift: number; // actual - target (negative = under, positive = over)
  correction: number; // Suggested priority adjustment
}

// Post with type assignment
export interface TypedPost {
  content_type: ContentType;
  type_rationale: string; // Why this type was chosen
  // ... other post fields
}

/**
 * Helper: Get eligible content types for a given goal mode
 */
export function getEligibleTypesForGoal(goalMode: GoalMode): ContentType[] {
  return (Object.entries(TYPE_GOAL_ELIGIBILITY) as [ContentType, GoalMode[]][])
    .filter(([_, eligibleModes]) => eligibleModes.includes(goalMode))
    .map(([type]) => type);
}

/**
 * Helper: Get eligible content types weighted by a programme's full goal_split
 * 
 * @param goalSplit - Programme goal split with drive_footfall, strengthen_brand, retain_regulars (0-100 scale)
 * @returns Array of { type, weight } sorted by weight descending, excluding zero-weight types
 */
export function getEligibleTypesForProgramme(
  goalSplit: { drive_footfall?: number; strengthen_brand?: number; retain_regulars?: number }
): Array<{ type: ContentType; weight: number }> {
  // Normalize from 0-100 scale to 0-1
  const footfall = (goalSplit.drive_footfall || 0) / 100;
  const brand = (goalSplit.strengthen_brand || 0) / 100;
  const retention = (goalSplit.retain_regulars || 0) / 100;

  const typeWeights: Array<{ type: ContentType; weight: number }> = [
    { type: 'PRODUCT',   weight: footfall },           // product posts drive immediate visits
    { type: 'EXPERIENCE', weight: brand + retention },  // atmosphere serves brand & loyalty
    { type: 'OCCASION',  weight: footfall + brand },    // event urgency serves footfall & brand
    { type: 'RETENTION', weight: retention },           // insider/loyalty content
  ];

  return typeWeights
    .filter(t => t.weight > 0)
    .sort((a, b) => b.weight - a.weight);
}

/**
 * Helper: Get dominant goal mode from baseline_goal_split
 */
export function getDominantGoalMode(goalSplit: ProgrammeProfile['baseline_goal_split']): GoalMode {
  const footfall = goalSplit.drive_footfall || 0;
  const brand = goalSplit.strengthen_brand || 0;
  const retention = goalSplit.retain_regulars || 0;
  
  if (footfall >= brand && footfall >= retention) return 'footfall';
  if (brand >= retention) return 'brand';
  return 'retention';
}

/**
 * Helper: Normalize type mix to ensure it sums to 1.0
 */
export function normalizeTypeMix(mix: Partial<TypeMix>): TypeMix {
  const total = (mix.product || 0) + (mix.experience || 0) + (mix.occasion || 0) + (mix.retention || 0);
  
  if (total === 0) {
    return { ...DEFAULT_TYPE_MIX };
  }
  
  return {
    product: (mix.product || 0) / total,
    experience: (mix.experience || 0) / total,
    occasion: (mix.occasion || 0) / total,
    retention: (mix.retention || 0) / total,
  };
}

/**
 * Helper: Validate that type mix sums to 1.0 (within tolerance)
 */
export function validateTypeMix(mix: TypeMix): boolean {
  const sum = mix.product + mix.experience + mix.occasion + mix.retention;
  return Math.abs(sum - 1.0) < 0.01; // Allow 1% tolerance
}

/**
 * PHASE C: Allocate content types to post ideas
 * 
 * This function assigns a content_type to each post idea based on:
 * 1. Programme goal_split (uses ALL goals weighted by percentage, not just dominant)
 * 2. Target type distribution (business-level 35/30/25/10 split)
 * 3. Staleness priority (favor types not used recently)
 * 4. Drift correction (balance actual vs target distribution)
 * 
 * @param postIdeas - Array of post ideas from strategy generation
 * @param programmeGoalSplits - Map of programme_type to full goal_split object
 * @param targetMix - Target type distribution from business_brand_profile
 * @param staleness - Type staleness data (from Phase B tracking)
 * @param drift - Type drift data (from Phase B tracking)
 * @returns Post ideas with content_type and type_rationale added
 */
export function allocateContentTypes(
  postIdeas: any[],
  programmeGoalSplits: Record<string, any>,
  targetMix: TypeMix = { ...DEFAULT_TYPE_MIX },
  staleness: TypeStaleness[] = [],
  drift: TypeDrift[] = []
): any[] {
  // Build priority scores per type
  const typePriorities: Record<ContentType, number> = {
    PRODUCT: 1.0,
    EXPERIENCE: 1.0,
    OCCASION: 1.0,
    RETENTION: 1.0,
  };
  
  // Apply staleness boost (0.0 to +1.0)
  staleness.forEach(s => {
    typePriorities[s.type] += s.priority;
  });
  
  // Apply drift correction (0.0x to 2.0x multiplier)
  drift.forEach(d => {
    typePriorities[d.type] *= d.correction;
  });
  
  // Track allocations to maintain distribution
  const typeAllocations: Record<ContentType, number> = {
    PRODUCT: 0,
    EXPERIENCE: 0,
    OCCASION: 0,
    RETENTION: 0,
  };
  
  // Allocate types to each post
  const typedPosts = postIdeas.map((post, index) => {
    // Get programme type and its goal split
    const programmeType = post.programme_type || post.programme || 'unknown';
    const goalSplit = programmeGoalSplits[programmeType];
    
    if (!goalSplit) {
      console.warn(`[allocateContentTypes] No goal_split for programme ${programmeType}, using fallback`);
      // Fallback: use post's own goal_mode if available
      const rawGoalMode = post.goal_mode || 'footfall';
      const goalMode = normalizeGoalMode(rawGoalMode);
      const eligibleTypesData = getEligibleTypesForProgramme({ 
        drive_footfall: goalMode === 'footfall' ? 100 : 0,  // Use 0-100 scale like DB
        strengthen_brand: goalMode === 'brand' ? 100 : 0,
        retain_regulars: goalMode === 'retention' ? 100 : 0,
      });
      
      if (eligibleTypesData.length === 0) {
        typeAllocations.PRODUCT++;
        return {
          ...post,
          content_type: 'PRODUCT',
          type_rationale: `Fallback to PRODUCT (programme: ${programmeType})`,
        };
      }
      
      // Calculate current distribution progress
      const totalAllocated = Object.values(typeAllocations).reduce((sum, count) => sum + count, 0);
      const remainingPosts = postIdeas.length - totalAllocated;
      
      // Score eligible types
      const eligibleTypes = eligibleTypesData.map(t => t.type);
      const typeScores = eligibleTypes.map(type => {
        const typeKey = type.toLowerCase() as keyof TypeMix;
        const targetPct = targetMix[typeKey];
        const currentCount = typeAllocations[type];
        const currentPct = totalAllocated > 0 ? currentCount / totalAllocated : 0;
        
        let score = typePriorities[type];
        const gap = targetPct - currentPct;
        score += gap * 10;
        
        if (remainingPosts > 0) {
          const needed = Math.max(0, targetPct * postIdeas.length - currentCount);
          const urgency = needed / remainingPosts;
          score += urgency * 5;
        }
        
        return { type, score };
      });
      
      typeScores.sort((a, b) => b.score - a.score);
      const selectedType = typeScores[0].type;
      typeAllocations[selectedType]++;
      
      return {
        ...post,
        content_type: selectedType,
        type_rationale: `${selectedType} (fallback, programme: ${programmeType}, goal: ${goalMode})`,
      };
    }
    
    // Main path: use programme's full goal_split for weighted type eligibility
    const eligibleTypesData = getEligibleTypesForProgramme(goalSplit);
    
    if (eligibleTypesData.length === 0) {
      typeAllocations.PRODUCT++;
      return {
        ...post,
        content_type: 'PRODUCT',
        type_rationale: `Fallback to PRODUCT (no eligible types for ${programmeType})`,
      };
    }
    
    // Calculate current distribution progress
    const totalAllocated = Object.values(typeAllocations).reduce((sum, count) => sum + count, 0);
    const remainingPosts = postIdeas.length - totalAllocated;
    
    // Score each eligible type
    const eligibleTypes = eligibleTypesData.map(t => t.type);
    const typeScores = eligibleTypes.map(type => {
      const typeKey = type.toLowerCase() as keyof TypeMix;
      const targetPct = targetMix[typeKey];
      const currentCount = typeAllocations[type];
      const currentPct = totalAllocated > 0 ? currentCount / totalAllocated : 0;
      
      // Priority factors:
      // 1. Base priority (staleness + drift)
      let score = typePriorities[type];
      
      // 2. Programme goal weight - boost types that align with this programme's goals
      const programmeWeight = eligibleTypesData.find(t => t.type === type)?.weight || 0;
      score *= (1 + programmeWeight); // Types with higher goal alignment get boosted
      
      // 3. Distribution gap (boost if under target, reduce if over)
      const gap = targetPct - currentPct;
      score += gap * 10; // Scale gap impact
      
      // 4. Remaining posts (ensure we can still hit targets)
      if (remainingPosts > 0) {
        const needed = Math.max(0, targetPct * postIdeas.length - currentCount);
        const urgency = needed / remainingPosts;
        score += urgency * 5;
      }
      
      return { type, score };
    });
    
    // Select highest-scoring eligible type
    typeScores.sort((a, b) => b.score - a.score);
    const selectedType = typeScores[0].type;
    typeAllocations[selectedType]++;
    
    // Build rationale showing programme context
    const typeKey = selectedType.toLowerCase() as keyof TypeMix;
    const targetPct = (targetMix[typeKey] * 100).toFixed(0);
    const currentCount = typeAllocations[selectedType] - 1;
    const totalBefore = totalAllocated;
    const currentPct = totalBefore > 0 ? ((currentCount / totalBefore) * 100).toFixed(0) : '0';
    
    // Extract goal percentages for rationale (goal_split values already in 0-100 scale)
    const footfallPct = Math.round(goalSplit.drive_footfall || 0);
    const brandPct = Math.round(goalSplit.strengthen_brand || 0);
    const retentionPct = Math.round(goalSplit.retain_regulars || 0);
    const goalDesc = [
      footfallPct > 0 ? `${footfallPct}% footfall` : null,
      brandPct > 0 ? `${brandPct}% brand` : null,
      retentionPct > 0 ? `${retentionPct}% retention` : null,
    ].filter(Boolean).join(', ');
    
    const rationale = `${selectedType} (${programmeType}: ${goalDesc}, target: ${targetPct}%, current: ${currentPct}%, priority: ${typeScores[0].score.toFixed(2)})`;
    
    return {
      ...post,
      content_type: selectedType.toLowerCase(),  // ✅ FIX: Lowercase for database constraint
      type_rationale: rationale,
    };
  });
  
  // Log final distribution
  const finalDistribution = Object.entries(typeAllocations)
    .map(([type, count]) => `${type}: ${count}/${postIdeas.length} (${((count / postIdeas.length) * 100).toFixed(1)}%)`)
    .join(', ');
  
  console.log(`[allocateContentTypes] Final distribution: ${finalDistribution}`);
  
  return typedPosts;
}

/**
 * Map 4-type system to content_category for Phase 2 generation
 * 
 * PRODUCT → product_menu (dish/drink focus)
 * EXPERIENCE → craving_visual (atmosphere) or behind_scenes (people/process)
 * OCCASION → product_menu with urgency flag (event-driven dish post)
 * RETENTION → behind_scenes or team_people (loyalty focus)
 */
export function mapTypeToContentCategory(type: ContentType, goalMode: GoalMode): string {
  switch (type) {
    case 'PRODUCT':
      return 'product_menu';
    
    case 'EXPERIENCE':
      // Brand-heavy programmes → behind_scenes (people/process)
      // Other programmes → craving_visual (atmosphere/place)
      return goalMode === 'brand' ? 'behind_scenes' : 'craving_visual';
    
    case 'OCCASION':
      // Urgency/event posts still show product but with time pressure
      return 'product_menu';
    
    case 'RETENTION':
      // Insider knowledge, loyalty rituals
      return goalMode === 'retention' ? 'team_people' : 'behind_scenes';
    
    default:
      return 'product_menu';
  }
}
