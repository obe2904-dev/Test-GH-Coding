/**
 * Prompt Builders - Re-exports
 */

export { buildPromptA } from './prompt-a.ts'
export { buildPromptB, buildSystemPromptB, BRAND_PROFILE_SCHEMA } from './prompt-b.ts'

// A1/A2 Split Architecture (v4.11.0)
export { buildPromptA1Evidence, type PromptA1Evidence } from './prompt-a1-evidence.ts'
export { buildPromptA2Interpretation, type PromptA2Interpretation } from './prompt-a2-interpretation.ts'
