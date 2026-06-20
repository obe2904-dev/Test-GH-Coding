/**
 * Historical Content Analysis
 * 
 * Analyzes last 3 weeks of posted content to:
 * - Prevent repetition of same content types per programme
 * - Balance goal mode distribution over time
 * - Track menu item usage to avoid staleness
 * - Provide variety guidance to Phase 2a
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { V5BrandProfile, V5Programme } from '../../brand-profile/types-v5.ts';

export interface ProgrammeContentHistory {
  programme_name: string;
  programme_type: string;
  
  // Content category frequency (last 3 weeks)
  content_categories: Record<string, number>;  // {"atmosphere": 2, "menu_item": 1}
  
  // Goal mode frequency (last 3 weeks)
  goal_modes: Record<string, number>;  // {"brand": 2, "drive": 1}
  
  // Specific menu items featured
  menu_items: string[];
  
  // Total posts for this programme
  total_posts: number;
}

export interface HistoricalContext {
  weeks_analyzed: number;
  total_posts_analyzed: number;
  
  // Per-programme patterns
  programme_patterns: Record<string, ProgrammeContentHistory>;
  
  // Overuse warnings (>2 uses in 3 weeks for same programme+category)
  overuse_warnings: string[];  // ["Aftensmad+atmosphere", "Brunch+brand"]
  
  // Underuse opportunities (0 uses despite programme having >2 posts)
  underuse_opportunities: string[];  // ["Frokost+loyalty", "Bar+behind_scenes"]
  
  // Recent menu items (for dish rotation)
  recent_dishes: string[];
}

/**
 * Fetch and analyze last N weeks of content
 */
export async function analyzeHistoricalContent(
  client: SupabaseClient,
  businessId: string,
  currentWeekStart: string,
  weeksToAnalyze: number = 3
): Promise<HistoricalContext | null> {
  try {
    // Calculate date range (go back N weeks from current week)
    const currentDate = new Date(currentWeekStart);
    const startDate = new Date(currentDate);
    startDate.setDate(currentDate.getDate() - (weeksToAnalyze * 7));
    
    console.log(`[Historical Analysis] Analyzing ${weeksToAnalyze} weeks from ${startDate.toISOString().split('T')[0]} to ${currentWeekStart}`);
    
    // Fetch historical strategies
    const { data: strategies, error } = await client
      .from('weekly_strategies')
      .select('post_ideas, week_start, week_number')
      .eq('business_id', businessId)
      .gte('week_start', startDate.toISOString().split('T')[0])
      .lt('week_start', currentWeekStart)
      .order('week_start', { ascending: false });
    
    if (error) {
      console.error('[Historical Analysis] Error fetching strategies:', error);
      return null;
    }
    
    if (!strategies || strategies.length === 0) {
      console.log('[Historical Analysis] No historical data found');
      return null;
    }
    
    console.log(`[Historical Analysis] Found ${strategies.length} weeks of data`);
    
    // Initialize tracking
    const programmePatterns: Record<string, ProgrammeContentHistory> = {};
    const recentDishes: string[] = [];
    let totalPostsAnalyzed = 0;
    
    // Process each week's posts
    for (const strategy of strategies) {
      const postIdeas = strategy.post_ideas || [];
      
      for (const post of postIdeas) {
        totalPostsAnalyzed++;
        
        // Extract programme association
        // Posts may have: programme_name, programme_type, or derive from timing
        const programmeName = post.programme_name || 
                             post.content_direction?.match(/programme[:\s]+([^,]+)/i)?.[1] ||
                             'General';
        const programmeType = post.programme_type || 'general';
        
        // Initialize programme tracking if needed
        if (!programmePatterns[programmeName]) {
          programmePatterns[programmeName] = {
            programme_name: programmeName,
            programme_type: programmeType,
            content_categories: {},
            goal_modes: {},
            menu_items: [],
            total_posts: 0
          };
        }
        
        const pattern = programmePatterns[programmeName];
        pattern.total_posts++;
        
        // Track content category
        const contentCategory = post.content_category || post.content_type || 'unknown';
        pattern.content_categories[contentCategory] = (pattern.content_categories[contentCategory] || 0) + 1;
        
        // Track goal mode
        const goalMode = post.goal_mode || 'unknown';
        pattern.goal_modes[goalMode] = (pattern.goal_modes[goalMode] || 0) + 1;
        
        // Track menu items (if it's a product/menu post)
        if (post.menu_item_name || post.dish_name) {
          const dish = post.menu_item_name || post.dish_name;
          pattern.menu_items.push(dish);
          recentDishes.push(dish);
        }
      }
    }
    
    // Generate warnings and opportunities
    const overuseWarnings: string[] = [];
    const underuseOpportunities: string[] = [];
    
    for (const [programmeName, pattern] of Object.entries(programmePatterns)) {
      // Overuse: same category used >2 times in 3 weeks
      for (const [category, count] of Object.entries(pattern.content_categories)) {
        if (count > 2) {
          overuseWarnings.push(`${programmeName}+${category} (${count}x in ${strategies.length} weeks)`);
        }
      }
      
      // Underuse: programme has >2 posts but never used certain categories
      if (pattern.total_posts >= 2) {
        const commonCategories = ['atmosphere', 'behind_scenes', 'loyalty_content', 'seasonal_content'];
        for (const category of commonCategories) {
          if (!pattern.content_categories[category]) {
            underuseOpportunities.push(`${programmeName}+${category}`);
          }
        }
      }
    }
    
    const result: HistoricalContext = {
      weeks_analyzed: strategies.length,
      total_posts_analyzed: totalPostsAnalyzed,
      programme_patterns: programmePatterns,
      overuse_warnings: overuseWarnings,
      underuse_opportunities: underuseOpportunities.slice(0, 5),  // Limit to top 5
      recent_dishes: recentDishes
    };
    
    console.log('[Historical Analysis] Summary:', {
      weeks: result.weeks_analyzed,
      posts: result.total_posts_analyzed,
      programmes: Object.keys(programmePatterns).length,
      overuse: overuseWarnings.length,
      underuse: underuseOpportunities.length
    });
    
    return result;
    
  } catch (err) {
    console.error('[Historical Analysis] Unexpected error:', err);
    return null;
  }
}

/**
 * Format historical context for AI prompt (Phase 2a)
 */
export function formatHistoricalContextForPrompt(context: HistoricalContext | null): string {
  if (!context || context.total_posts_analyzed === 0) {
    return '';
  }
  
  const blocks: string[] = [
    `HISTORISK KONTEKST (sidste ${context.weeks_analyzed} uger, ${context.total_posts_analyzed} opslag):`
  ];
  
  // Programme patterns summary
  const programmeNames = Object.keys(context.programme_patterns);
  if (programmeNames.length > 0) {
    blocks.push('\nProgramme-fordeling:');
    for (const name of programmeNames) {
      const pattern = context.programme_patterns[name];
      const topCategories = Object.entries(pattern.content_categories)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([cat, count]) => `${cat}(${count})`)
        .join(', ');
      
      blocks.push(`  • ${name}: ${pattern.total_posts} opslag - ${topCategories}`);
    }
  }
  
  // Overuse warnings
  if (context.overuse_warnings.length > 0) {
    blocks.push('\n⚠️ UNDGÅ GENTAGELSE (brugt for ofte):');
    context.overuse_warnings.slice(0, 6).forEach(warning => {
      blocks.push(`  - ${warning}`);
    });
  }
  
  // Underuse opportunities
  if (context.underuse_opportunities.length > 0) {
    blocks.push('\n✨ FRISKE MULIGHEDER (endnu ikke brugt):');
    context.underuse_opportunities.forEach(opp => {
      blocks.push(`  - ${opp}`);
    });
  }
  
  // Recent dishes
  if (context.recent_dishes.length > 0) {
    const uniqueDishes = [...new Set(context.recent_dishes)].slice(0, 8);
    blocks.push(`\n🍽️ Senest viste retter: ${uniqueDishes.join(', ')}`);
    blocks.push('   → Vælg ANDRE retter denne uge for variation');
  }
  
  return blocks.join('\n');
}

/**
 * Validate if proposed content respects historical patterns
 */
export function validateContentVariation(
  context: HistoricalContext | null,
  programmeName: string,
  contentCategory: string,
  menuItemName?: string
): { allowed: boolean; reason?: string } {
  if (!context) {
    return { allowed: true };
  }
  
  const pattern = context.programme_patterns[programmeName];
  if (!pattern) {
    return { allowed: true };  // New programme, no history
  }
  
  // Check content category repetition
  const categoryCount = pattern.content_categories[contentCategory] || 0;
  if (categoryCount >= 3) {
    return {
      allowed: false,
      reason: `${programmeName}+${contentCategory} already used ${categoryCount} times in last ${context.weeks_analyzed} weeks`
    };
  }
  
  // Check menu item repetition
  if (menuItemName && pattern.menu_items.includes(menuItemName)) {
    return {
      allowed: false,
      reason: `Menu item "${menuItemName}" already featured for ${programmeName} recently`
    };
  }
  
  return { allowed: true };
}

/**
 * Get variation score (0-1) for content diversity
 * Higher = more varied content mix
 */
export function calculateVariationScore(context: HistoricalContext | null): number {
  if (!context || context.total_posts_analyzed === 0) {
    return 1.0;  // No history = perfect score
  }
  
  let totalVariationPoints = 0;
  let totalProgrammes = 0;
  
  for (const pattern of Object.values(context.programme_patterns)) {
    if (pattern.total_posts < 2) continue;  // Need at least 2 posts to measure variation
    
    totalProgrammes++;
    
    // Count unique categories used
    const uniqueCategories = Object.keys(pattern.content_categories).length;
    
    // Ideal: at least 3 different categories for varied content
    const categoryVariation = Math.min(uniqueCategories / 3, 1.0);
    
    // Check for over-concentration (any category >50% of posts)
    const maxCategoryCount = Math.max(...Object.values(pattern.content_categories));
    const concentrationPenalty = maxCategoryCount > (pattern.total_posts * 0.5) ? 0.5 : 0;
    
    totalVariationPoints += (categoryVariation - concentrationPenalty);
  }
  
  return totalProgrammes > 0 ? Math.max(0, totalVariationPoints / totalProgrammes) : 1.0;
}
