// Shared list of AI-generated edit actions for analyze-photo and edit-photo.
// These are the actions Gemini may output in a suggestions array.
// Crop actions are intentionally excluded — they are handled client-side only.
export const SUPPORTED_AI_EDIT_ACTIONS = [
  'remove_object',
  'reduce_clutter',
  'reduce_smudge',
  'adjust_temperature_warm',
  'adjust_temperature_cool',
  'fix_exposure',
] as const

export type SupportedAIEditAction = typeof SUPPORTED_AI_EDIT_ACTIONS[number]
