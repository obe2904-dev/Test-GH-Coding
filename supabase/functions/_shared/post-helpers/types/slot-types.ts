/**
 * Shared types for slot templates and content strategy
 * Used by both phase1.ts and business-rules-engine.ts
 */

export type GoalMode = 'drive_footfall' | 'build_brand' | 'retain_loyalty';
export type ContentCategory = 'product_menu' | 'craving_visual' | 'behind_scenes' | 'team_people';

export interface SlotTemplate {
  slot_id: 'A' | 'B' | 'C' | 'D';
  goal_mode: GoalMode;
  content_category: ContentCategory;
  timing_window: string;
}
