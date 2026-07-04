// prompt-example-selector.ts
// Smart example selection to reduce phrase contamination and improve learning
// Selects context-relevant examples and rotates them to prevent AI from copying

interface Example {
  text: string
  content_type?: string
  programme?: string
  why_it_works?: string[]
  why_it_fails?: string[]
  tone_elements_demonstrated?: string[]
  failure_mode?: string
}

interface SelectionCriteria {
  contentType: string
  programme?: string
  menuCategory?: string
  maxCount: number
}

/**
 * Select most relevant examples based on content type, programme, and context
 * Uses prioritized matching + randomization to prevent copying
 */
export function selectRelevantExamples(
  allExamples: Example[],
  criteria: SelectionCriteria
): Example[] {
  if (!allExamples || allExamples.length === 0) {
    return []
  }

  const { contentType, programme, maxCount } = criteria
  
  // Priority buckets
  const exactMatch: Example[] = []      // content_type + programme match
  const contentMatch: Example[] = []    // content_type match only
  const anyExample: Example[] = []      // any example
  
  // Categorize examples by match quality
  allExamples.forEach(ex => {
    if (ex.content_type === contentType && ex.programme === programme) {
      exactMatch.push(ex)
    } else if (ex.content_type === contentType) {
      contentMatch.push(ex)
    } else {
      anyExample.push(ex)
    }
  })
  
  // Build final selection with priority order
  let selected: Example[] = []
  
  // Priority 1: Exact matches (shuffled)
  if (exactMatch.length > 0) {
    selected = [...shuffleArray(exactMatch)]
  }
  
  // Priority 2: Content type matches (shuffled)
  if (selected.length < maxCount && contentMatch.length > 0) {
    selected = [...selected, ...shuffleArray(contentMatch)]
  }
  
  // Priority 3: Any examples (shuffled)
  if (selected.length < maxCount && anyExample.length > 0) {
    selected = [...selected, ...shuffleArray(anyExample)]
  }
  
  // Return up to maxCount examples
  const result = selected.slice(0, maxCount)
  
  console.log(`[ExampleSelector] Selected ${result.length} examples for ${contentType}:`)
  console.log(`  Exact matches: ${exactMatch.length}, Content matches: ${contentMatch.length}, Other: ${anyExample.length}`)
  
  return result
}

/**
 * Fisher-Yates shuffle to randomize example order
 * Prevents AI from always seeing same examples in same order
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * Truncate examples to fit within token budget
 * Prioritizes keeping reasoning over text length
 */
export function truncateExamplesIfNeeded(
  examples: Example[],
  maxTokenBudget: number
): Example[] {
  // Rough estimation: ~4 chars per token
  const estimateTokens = (text: string): number => Math.ceil(text.length / 4)
  
  let currentTokens = 0
  const truncated: Example[] = []
  
  for (const ex of examples) {
    // Estimate token cost of this example
    const textTokens = estimateTokens(ex.text || '')
    const reasoningTokens = ex.why_it_works 
      ? estimateTokens(ex.why_it_works.join('; '))
      : ex.why_it_fails
        ? estimateTokens(ex.why_it_fails.join('; '))
        : 0
    
    const exampleTokens = textTokens + reasoningTokens + 20 // +20 for formatting
    
    if (currentTokens + exampleTokens > maxTokenBudget) {
      console.log(`[ExampleSelector] Token budget reached (${currentTokens}/${maxTokenBudget}) - truncated to ${truncated.length} examples`)
      break
    }
    
    truncated.push(ex)
    currentTokens += exampleTokens
  }
  
  return truncated
}

/**
 * Balance good vs avoid examples to prevent bias
 * Maintains 2:1 ratio (more good examples than avoid)
 */
export function balanceExamples(
  goodExamples: Example[],
  avoidExamples: Example[],
  maxTotalCount: number = 5
): { good: Example[]; avoid: Example[] } {
  const targetGoodCount = Math.ceil(maxTotalCount * 0.6) // 60% good
  const targetAvoidCount = Math.floor(maxTotalCount * 0.4) // 40% avoid
  
  return {
    good: goodExamples.slice(0, targetGoodCount),
    avoid: avoidExamples.slice(0, targetAvoidCount)
  }
}
