/**
 * Content-Timing Validation Integration Example
 * 
 * This file demonstrates how to integrate the validation layer into the Weekly Plan
 * generation process to prevent drinks-on-Sunday and other content-timing bugs.
 * 
 * Integration points:
 * 1. After Phase 2 generates posts
 * 2. Before saving to database
 * 3. Auto-fix critical violations
 * 4. Log warnings for manual review
 */

import { validatePostSchedule, validateWeeklyPlan } from '../post-helpers/content-timing-validator.ts';
import type { PostSchedule, BusinessContext, ValidationResult } from '../post-helpers/content-timing-validator.ts';

/**
 * INTEGRATION EXAMPLE 1: Validate single post before save
 */
export async function validateAndSavePost(
  post: any,
  business: any,
  programme: any
): Promise<{ valid: boolean; savedPost?: any; violations?: any[] }> {
  // Build validation context
  const schedule: PostSchedule = {
    day_of_week: getDayOfWeek(post.promoted_moment_datetime),
    time: getTime(post.promoted_moment_datetime),
    programme_name: programme.name,
    programme_description: programme.description,
    programme_category: programme.category,
    title: post.title,
    rationale: post.rationale,
    goal_mode: post.goal_mode,
    content_category: post.content_category
  };
  
  const businessContext: BusinessContext = {
    archetype: business.archetype || 'casual_dining',
    country_code: business.country_code || 'DK',
    programmes: [] // Add if needed
  };
  
  // Validate
  const result: ValidationResult = validatePostSchedule(schedule, businessContext);
  
  // Handle validation result
  if (result.valid) {
    // Post is valid - save as-is
    console.log('[Validation] ✅ Post passed validation');
    return { valid: true, savedPost: await savePost(post) };
  }
  
  // Check for critical violations
  const criticalViolations = result.violations.filter(v => v.severity === 'critical');
  
  if (criticalViolations.length > 0 && result.auto_fix_suggestion) {
    // Auto-fix critical violations
    console.warn('[Validation] ⚠️ Critical violations detected - applying auto-fix');
    console.warn('Violations:', criticalViolations.map(v => v.message));
    
    // Apply auto-fix
    const fixedPost = {
      ...post,
      promoted_moment_datetime: buildDateTime(
        result.auto_fix_suggestion.day_of_week,
        result.auto_fix_suggestion.time
      )
    };
    
    // Save with validation metadata
    const savedPost = await savePost({
      ...fixedPost,
      validation_result: {
        valid: false,
        violations: result.violations,
        auto_fix_applied: true,
        original_schedule: {
          day: schedule.day_of_week,
          time: schedule.time
        },
        fixed_schedule: {
          day: result.auto_fix_suggestion.day_of_week,
          time: result.auto_fix_suggestion.time
        }
      }
    });
    
    return { valid: false, savedPost, violations: result.violations };
  }
  
  // Critical violations without auto-fix - log and save anyway with warning
  console.error('[Validation] ❌ Critical violations without auto-fix available');
  console.error('Violations:', criticalViolations.map(v => v.message));
  
  const savedPost = await savePost({
    ...post,
    validation_result: {
      valid: false,
      violations: result.violations,
      auto_fix_applied: false
    }
  });
  
  return { valid: false, savedPost, violations: result.violations };
}

/**
 * INTEGRATION EXAMPLE 2: Validate entire weekly plan
 */
export async function validateWeeklyPlanBeforeSave(
  posts: any[],
  business: any,
  programmes: any[]
): Promise<{ validCount: number; invalidCount: number; autoFixedCount: number }> {
  
  const businessContext: BusinessContext = {
    archetype: business.archetype || 'casual_dining',
    country_code: business.country_code || 'DK',
    programmes: programmes
  };
  
  // Build schedules for all posts
  const schedules: PostSchedule[] = posts.map(post => {
    const programme = programmes.find(p => p.id === post.programme_id);
    
    return {
      day_of_week: getDayOfWeek(post.promoted_moment_datetime),
      time: getTime(post.promoted_moment_datetime),
      programme_name: programme?.name || 'Unknown',
      programme_description: programme?.description,
      programme_category: programme?.category,
      title: post.title,
      rationale: post.rationale,
      goal_mode: post.goal_mode,
      content_category: post.content_category
    };
  });
  
  // Validate all posts
  const results = validateWeeklyPlan(schedules, businessContext);
  
  // Process results
  let validCount = 0;
  let invalidCount = 0;
  let autoFixedCount = 0;
  
  for (let i = 0; i < posts.length; i++) {
    const result = results[i];
    const post = posts[i];
    
    if (result.valid) {
      validCount++;
      continue;
    }
    
    invalidCount++;
    
    // Check for auto-fix
    const criticalViolations = result.violations.filter(v => v.severity === 'critical');
    
    if (criticalViolations.length > 0 && result.auto_fix_suggestion) {
      // Apply auto-fix
      autoFixedCount++;
      
      post.promoted_moment_datetime = buildDateTime(
        result.auto_fix_suggestion.day_of_week,
        result.auto_fix_suggestion.time
      );
      
      post.validation_result = {
        valid: false,
        violations: result.violations,
        auto_fix_applied: true,
        original_schedule: {
          day: schedules[i].day_of_week,
          time: schedules[i].time
        },
        fixed_schedule: {
          day: result.auto_fix_suggestion.day_of_week,
          time: result.auto_fix_suggestion.time
        }
      };
      
      console.log(
        `[Validation] Auto-fixed post ${i + 1}: ` +
        `${schedules[i].day_of_week} ${schedules[i].time} → ` +
        `${result.auto_fix_suggestion.day_of_week} ${result.auto_fix_suggestion.time}`
      );
    } else {
      // No auto-fix available
      post.validation_result = {
        valid: false,
        violations: result.violations,
        auto_fix_applied: false
      };
      
      console.warn(
        `[Validation] Violations in post ${i + 1}:`,
        result.violations.map(v => v.message)
      );
    }
  }
  
  console.log(
    `[Validation] Summary: ${validCount} valid, ${invalidCount} invalid, ${autoFixedCount} auto-fixed`
  );
  
  return { validCount, invalidCount, autoFixedCount };
}

/**
 * INTEGRATION EXAMPLE 3: Real-time validation during generation
 * Use this in Phase 2 to validate as posts are generated
 */
export function validateDuringGeneration(
  postDraft: any,
  business: any,
  programme: any
): { proceed: boolean; suggestedFix?: any } {
  
  const schedule: PostSchedule = {
    day_of_week: getDayOfWeek(postDraft.promoted_moment_datetime),
    time: getTime(postDraft.promoted_moment_datetime),
    programme_name: programme.name,
    programme_description: programme.description,
    programme_category: programme.category,
    title: postDraft.title,
    rationale: postDraft.rationale,
    goal_mode: postDraft.goal_mode,
    content_category: postDraft.content_category
  };
  
  const businessContext: BusinessContext = {
    archetype: business.archetype || 'casual_dining',
    country_code: business.country_code || 'DK'
  };
  
  const result = validatePostSchedule(schedule, businessContext);
  
  // If critical violations, return suggested fix
  const criticalViolations = result.violations.filter(v => v.severity === 'critical');
  
  if (criticalViolations.length > 0) {
    console.warn(
      `[Validation] Critical violations during generation:`,
      criticalViolations.map(v => v.message)
    );
    
    if (result.auto_fix_suggestion) {
      return {
        proceed: false,
        suggestedFix: {
          day_of_week: result.auto_fix_suggestion.day_of_week,
          time: result.auto_fix_suggestion.time,
          reason: criticalViolations[0].message
        }
      };
    }
  }
  
  return { proceed: result.valid };
}

// Helper functions

function getDayOfWeek(datetime: string): string {
  const date = new Date(datetime);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
}

function getTime(datetime: string): string {
  const date = new Date(datetime);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

function buildDateTime(dayOfWeek: string, time: string): string {
  // Build ISO datetime from day of week and time
  // This is a simplified example - real implementation would need week context
  const now = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const targetDow = days.indexOf(dayOfWeek);
  
  // Find next occurrence of target day
  const currentDow = now.getDay();
  let daysAhead = targetDow - currentDow;
  if (daysAhead < 0) daysAhead += 7;
  
  const targetDate = new Date(now);
  targetDate.setDate(now.getDate() + daysAhead);
  
  const [hours, minutes] = time.split(':').map(Number);
  targetDate.setHours(hours, minutes, 0, 0);
  
  return targetDate.toISOString();
}

async function savePost(post: any): Promise<any> {
  // Placeholder - real implementation would save to database
  console.log('[Save] Saving post:', post.title);
  return post;
}

/**
 * USAGE IN WEEKLY PLAN GENERATION
 * 
 * Add this to get-weekly-strategy/index.ts after Phase 2 completes:
 * 
 * ```typescript
 * // After Phase 2 generates posts
 * const validationSummary = await validateWeeklyPlanBeforeSave(
 *   generatedPosts,
 *   business,
 *   programmes
 * );
 * 
 * // Log validation summary
 * console.log('[Weekly Plan] Validation:', validationSummary);
 * 
 * // If too many failures, regenerate
 * if (validationSummary.invalidCount > validationSummary.validCount) {
 *   console.error('[Weekly Plan] Too many validation failures - regenerating');
 *   // Trigger regeneration with stricter constraints
 * }
 * ```
 * 
 * PREVENTING DRINKS-ON-SUNDAY BUG:
 * 
 * The validation layer will catch:
 * - Drinks content before 14:00 → Auto-fix to 14:00-18:00
 * - Drinks content on Sunday/Monday → Auto-fix to Thursday/Friday
 * - Evening content at 09:00 → Auto-fix to 14:00+
 * - Brunch on weekdays → Auto-fix to Saturday/Sunday
 * - Rationale-execution mismatches → Flag for review
 * 
 * Example:
 * 
 * INPUT:  Cafe Faust "Signature Cocktails" Sunday 09:00
 * DETECT: evening_content_time violation (drinks < 14:00)
 *         programme_archetype_compliance violation (drinks on Sunday)
 * OUTPUT: Auto-fix to Friday 17:00
 * 
 * MONITORING & REPORTING:
 * 
 * Query validation failures:
 * ```sql
 * SELECT 
 *   b.name,
 *   p.title,
 *   p.promoted_moment,
 *   p.validation_result->'violations' as violations
 * FROM posts p
 * JOIN businesses b ON p.business_id = b.id
 * WHERE (p.validation_result->>'valid')::boolean = false
 * ORDER BY p.created_at DESC
 * LIMIT 100;
 * ```
 * 
 * Aggregate validation metrics:
 * ```sql
 * SELECT 
 *   COUNT(*) as total_posts,
 *   SUM(CASE WHEN (validation_result->>'valid')::boolean = true THEN 1 ELSE 0 END) as valid_posts,
 *   SUM(CASE WHEN (validation_result->>'auto_fix_applied')::boolean = true THEN 1 ELSE 0 END) as auto_fixed_posts,
 *   ROUND(100.0 * SUM(CASE WHEN (validation_result->>'valid')::boolean = true THEN 1 ELSE 0 END) / COUNT(*), 2) as validation_rate
 * FROM posts
 * WHERE created_at >= NOW() - INTERVAL '7 days';
 * ```
 */
