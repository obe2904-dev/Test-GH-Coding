/**
 * Prompt Utilities
 * 
 * Core utilities for loading, compiling, and validating multilingual prompts.
 */

import type {
  Language,
  LanguageConfig,
  PromptVariables,
  CompiledPrompt,
  PromptTemplate,
  MultilingualPrompt,
  PromptLoadResult,
} from '../types.ts'

/**
 * Compiles a prompt template by replacing variables
 * 
 * @example
 * compileTemplate("Skriv om {{topic}}", { topic: "kaffe" })
 * // Returns: "Skriv om kaffe"
 */
export function compileTemplate(
  template: string,
  variables: PromptVariables
): string {
  let compiled = template
  
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    const replacement = Array.isArray(value) 
      ? value.join(', ') 
      : String(value)
    
    compiled = compiled.replace(placeholder, replacement)
  }
  
  // Check for unresolved placeholders
  const unresolved = compiled.match(/\{\{[^}]+\}\}/g)
  if (unresolved) {
    console.warn('Unresolved placeholders:', unresolved)
  }
  
  return compiled
}

/**
 * Builds a complete prompt ready for AI model
 */
export function buildPrompt(
  config: LanguageConfig,
  variables?: PromptVariables
): CompiledPrompt {
  const userPrompt = config.user 
    ? compileTemplate(config.user, variables || {})
    : ''
  
  return {
    system: config.system + '\n\n' + config.closer,
    user: userPrompt,
    language: config.language,
    promptId: config.metadata?.version || 'unknown',
  }
}

/**
 * Selects the appropriate language variant
 */
export function selectLanguage(
  multilingual: MultilingualPrompt,
  preferredLanguage?: Language
): LanguageConfig {
  const language = preferredLanguage || multilingual.defaultLanguage
  
  return multilingual[language]
}

/**
 * Validates that all required variables are present
 */
export function validateVariables(
  template: PromptTemplate,
  variables: PromptVariables
): { valid: boolean; missing: string[] } {
  const missing: string[] = []
  
  for (const required of template.requiredVariables) {
    if (!(required in variables)) {
      missing.push(required)
    }
  }
  
  return {
    valid: missing.length === 0,
    missing,
  }
}

/**
 * Merges optional variables with provided variables
 */
export function mergeVariables(
  template: PromptTemplate,
  variables: PromptVariables
): PromptVariables {
  return {
    ...(template.optionalVariables || {}),
    ...variables,
  }
}

/**
 * Creates a language-aware prompt builder
 */
export function createPromptBuilder(
  multilingual: MultilingualPrompt
) {
  return {
    /**
     * Build prompt for specific language
     */
    build(language: Language, variables?: PromptVariables): CompiledPrompt {
      const config = multilingual[language]
      return buildPrompt(config, variables)
    },
    
    /**
     * Get system message only
     */
    getSystem(language: Language): string {
      const config = multilingual[language]
      return config.system + '\n\n' + config.closer
    },
    
    /**
     * Get user message template
     */
    getUserTemplate(language: Language): string {
      const config = multilingual[language]
      return config.user || ''
    },
    
    /**
     * Check if language is supported
     */
    supports(language: Language): boolean {
      return language in multilingual
    },
  }
}

/**
 * Loads a language config from a module
 * 
 * @example
 * const config = await loadLanguageConfig('da', 'content-generation')
 */
export async function loadLanguageConfig(
  language: Language,
  promptId: string
): Promise<PromptLoadResult> {
  const filePath = `../languages/${language}/${promptId}.ts`
  
  try {
    console.log(`📂 Loading prompt: ${language}/${promptId}.ts`)
    const module = await import(filePath)
    
    if (!module.default) {
      console.error(`❌ No default export in ${filePath}`)
      return {
        success: false,
        error: `No default export in ${language}/${promptId}.ts`,
      }
    }
    
    console.log(`✅ Successfully loaded ${language}/${promptId}.ts`)
    return {
      success: true,
      prompt: module.default,
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error(`❌ Failed to load ${filePath}:`, {
      error: errorMsg,
      type: error instanceof Error ? error.constructor.name : typeof error,
      stack: error instanceof Error ? error.stack?.substring(0, 200) : undefined
    })
    
    return {
      success: false,
      error: errorMsg,
    }
  }
}

/**
 * Loads all language variants for a prompt
 */
export async function loadMultilingualPrompt(
  promptId: string,
  defaultLanguage: Language = 'da'
): Promise<MultilingualPrompt | null> {
  const languages: Language[] = ['da', 'en', 'sv']
  const configs: Partial<Record<Language, LanguageConfig>> = {}
  
  for (const lang of languages) {
    const result = await loadLanguageConfig(lang, promptId)
    if (result.success && result.prompt) {
      configs[lang] = result.prompt
    }
  }
  
  // Require at least the default language
  if (!configs[defaultLanguage]) {
    console.error(`Failed to load default language ${defaultLanguage} for ${promptId}`)
    return null
  }
  
  return {
    id: promptId,
    da: configs.da!,
    en: configs.en || configs.da!, // Fallback to Danish
    sv: configs.sv || configs.da!, // Fallback to Danish
    defaultLanguage,
  }
}

/**
 * Extracts variables from a template string
 */
export function extractVariables(template: string): string[] {
  const matches = template.match(/\{\{([^}]+)\}\}/g)
  if (!matches) return []
  
  return matches.map(match => 
    match.replace(/\{\{|\}\}/g, '').trim()
  )
}

/**
 * Validates prompt structure
 */
export function validatePromptConfig(config: LanguageConfig): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []
  
  if (!config.system || config.system.trim().length === 0) {
    errors.push('System prompt is required')
  }
  
  if (!config.closer || config.closer.trim().length === 0) {
    errors.push('Language closer is required')
  }
  
  if (!['da', 'en', 'sv'].includes(config.language)) {
    errors.push(`Invalid language: ${config.language}`)
  }
  
  // Check that system prompt matches declared language
  const systemLower = config.system.toLowerCase()
  if (config.language === 'da' && !systemLower.includes('skriv') && !systemLower.includes('dansk')) {
    errors.push('Danish system prompt should contain Danish keywords')
  }
  
  if (config.language === 'en' && systemLower.includes('skriv')) {
    errors.push('English system prompt contains Danish keywords')
  }
  
  return {
    valid: errors.length === 0,
    errors,
  }
}
