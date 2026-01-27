// Export validators
export { 
  validateSuggestions,          // Legacy function (for backwards compatibility)
  validateSuggestionsWithMetadata  // New function with graceful degradation
} from './content-validator.ts'
export { generateFallbackIdea } from './fallback-generator.ts'
