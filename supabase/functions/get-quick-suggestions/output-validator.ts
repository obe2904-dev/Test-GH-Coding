/**
 * Output Validator (Phase 2 Simplified)
 *
 * Minimal validation for Gemini suggestion objects.
 * Trusts Gemini 2.5 Flash quality — no repair attempts.
 *
 * Responsibilities:
 *  - Validate required fields are present
 *  - Log warnings for missing fields
 *  - Return suggestions as-is (validation only, no modifications)
 *
 * REMOVED (Phase 2 simplification):
 *  - Anchor repair (trust AI to use confirmed facts)
 *  - Ingredient hallucination guard (Gemini 2.5 Flash is reliable)
 *  - Weather tone guard (prompt handles this)
 *  - Promotional copy sanitization (prompt prevents this)
 *  - Kitchen-close guard (prompt handles timing)
 */

import type { SlotTiming } from './operational-timeline.ts'

export type RawSuggestion = {
  title?: string
  menu_item_name?: string
  dish_text_brief?: string
  why_explanation?: string
  occasion_context?: string
  concrete_anchor?: string
  content_type?: string
  slot?: string
  photo_idea?: string
  [key: string]: unknown
}

// ── Simple Validation (Phase 2) ───────────────────────────────────────────────

/**
 * Validate that required fields are present in suggestions.
 * No repair attempts — trust Gemini 2.5 Flash quality.
 * 
 * Required fields:
 * - title
 * - content_type
 * - slot
 * 
 * For menu_item content_type:
 * - menu_item_name
 * - dish_text_brief
 */
export function simpleValidate(
  suggestions: RawSuggestion[],
  businessName: string,
): RawSuggestion[] {
  for (let i = 0; i < suggestions.length; i++) {
    const s = suggestions[i]
    const slotLabel = `Slot ${i + 1}`

    // Basic field validation
    if (!s.title) {
      console.warn(`⚠️ [${slotLabel}] Missing required field: title`)
    }
    if (!s.content_type) {
      console.warn(`⚠️ [${slotLabel}] Missing required field: content_type`)
    }
    if (!s.slot) {
      console.warn(`⚠️ [${slotLabel}] Missing required field: slot`)
    }

    // Menu item specific validation
    if (s.content_type === 'menu_item') {
      if (!s.menu_item_name) {
        console.warn(`⚠️ [${slotLabel}] menu_item content missing menu_item_name`)
      }
      if (!s.dish_text_brief) {
        console.warn(`⚠️ [${slotLabel}] menu_item content missing dish_text_brief`)
      }
    }

    // Log suggestion summary
    console.log(`✅ [${slotLabel}] ${s.content_type} - "${s.title}"`)
  }

  return suggestions
}

// ── Backward Compatibility Exports ────────────────────────────────────────────

/**
 * Legacy export for index.ts compatibility.
 * Redirects to simpleValidate with reduced parameters.
 */
export function validateAndRepair(
  suggestions: RawSuggestion[],
  slotTimings: SlotTiming[],
  confirmedFacts: string[],
  businessName: string,
  outdoorSuitable: boolean,
  hasOutdoorSeating: boolean,
  menuDescriptionMap: Map<string, string> = new Map(),
): RawSuggestion[] {
  return simpleValidate(suggestions, businessName)
}

/**
 * Legacy export for backward compatibility.
 */
export function repairSuggestions(
  suggestions: RawSuggestion[],
  confirmedFacts: string[],
  businessName = '',
  slotTimings: SlotTiming[] = [],
  outdoorSuitable = false,
  hasOutdoorSeating = false,
): RawSuggestion[] {
  return simpleValidate(suggestions, businessName)
}
