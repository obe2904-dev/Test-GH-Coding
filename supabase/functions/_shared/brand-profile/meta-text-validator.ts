/**
 * Meta-text patterns and banned-word consistency validators.
 * Extracted from validators.ts (v4.14.0).
 */

import type { DataSources } from './types.ts'
import { detectWebsitePresence } from './website-presence.ts'

// Meta-text patterns that should NEVER appear in user-facing fields
// These are allowed ONLY in clarifications_needed or internal_notes
export const META_TEXT_PATTERNS = [
  '(mangler tydelig evidens',
  'mangler tydelig evidens',
  'foreslået retning',
  'uklart om',
  'Uklart om',
  'insufficient evidence',
  'suggested direction',
  'unclear about',
  'needs verification',
  'verificer',
  'afklar',
  'TODO',
  '[TBD]',
  '[?]',
]

// Internal tokens that should never appear in user-facing content
export const INTERNAL_TOKENS = [
  'MANDATORY',
  'HARD CONSTRAINTS',
  'SOM TOMMELFINGERREGEL',
  '[INTERNT',
  'MÅLTIDSANKRE',
  'OPLEVELSES-/SERVICEANKER',
  'CRITICAL',
  '(3 required)',
  '(2 required)',
  'required)'
]

/**
 * Check if generated sections contain words that are listed in things_to_avoid.language_constraints
 * 
 * v4.8.8 Task 1: Ensure banned word consistency
 * v4.8.9 Task 2: Smart Banned Words - respect business's authentic vocabulary
 * If a word is in language_constraints, it should NOT appear anywhere else in the output
 * UNLESS the word appears 3+ times on the business's website (then it's allowed)
 * 
 * @param sections - Brand profile sections to validate
 * @param dataSources - Optional data sources for smart banned word filtering
 * @returns Array of validation errors (field + word pairs)
 */
export function checkBannedWordsConsistency(sections: any, dataSources?: DataSources): string[] {
  const errors: string[] = []
  
  // Extract banned words from things_to_avoid.language_constraints
  const thingsToAvoid = sections?.things_to_avoid
  let languageConstraints = thingsToAvoid?.value?.language_constraints || thingsToAvoid?.language_constraints || []
  
  if (!Array.isArray(languageConstraints) || languageConstraints.length === 0) {
    return errors
  }
  
  let bannedWords = languageConstraints
    .filter(Boolean)
    .map((w: any) => String(w).trim())
    .filter((w: string) => w.length > 0)
  
  if (bannedWords.length === 0) {
    return errors
  }
  
  // v4.8.9 Task 2: If dataSources provided, filter out words used 3+ times on website
  // This handles edge case where AI might have included an allowed word in things_to_avoid
  if (dataSources) {
    // Import functions from prompt-b (they're exported)
    // We need to dynamically import since TypeScript modules are static
    // For now, we'll replicate the logic here (simpler for Deno edge function)
    const websiteText = aggregateWebsiteTextForValidator(dataSources)
    const allowedWordsSet = new Set<string>()
    
    // Check each banned word for 3+ occurrences
    bannedWords.forEach(word => {
      const regex = new RegExp(`\\b${word.toLowerCase()}\\b`, 'gi')
      const matches = websiteText.toLowerCase().match(regex)
      const count = matches ? matches.length : 0
      
      if (count >= 3) {
        allowedWordsSet.add(word.toLowerCase())
        console.log(`🔓 Validator: Allowing "${word}" (${count} occurrences on website)`)
      }
    })
    
    // Filter out allowed words
    if (allowedWordsSet.size > 0) {
      bannedWords = bannedWords.filter(w => !allowedWordsSet.has(w.toLowerCase()))
      console.log(`🔧 Validator: Checking ${bannedWords.length} banned words (${allowedWordsSet.size} allowed)`)
    }
  }
  
  // Fields to check (extract value from object or use string directly)
  const fieldsToCheck = [
    { name: 'brand_essence', value: sections?.brand_essence?.value || sections?.brand_essence },
    { name: 'core_offerings', value: sections?.core_offerings?.value || sections?.core_offerings },
    { name: 'target_audience', value: sections?.target_audience?.value || sections?.target_audience },
    { name: 'tone_of_voice', value: sections?.tone_of_voice?.value || sections?.tone_of_voice },
    { name: 'content_focus', value: sections?.content_focus?.value || sections?.content_focus },
    { name: 'communication_goal', value: sections?.communication_goal?.value || sections?.communication_goal },
    { name: 'cta_style', value: sections?.cta_style?.value || sections?.cta_style },
    { name: 'signature_shot', value: sections?.image_preferences?.signature_shot }
  ]
  
  // Check each field for banned words
  for (const field of fieldsToCheck) {
    if (!field.value || typeof field.value !== 'string') continue
    
    for (const bannedWord of bannedWords) {
      // Escape special regex characters in the banned word
      const escapedWord = bannedWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(`\\b${escapedWord}\\b`, 'gi')
      
      if (regex.test(field.value)) {
        errors.push(
          `🚫 BANNED WORD INCONSISTENCY: Field "${field.name}" contains banned word "${bannedWord}" which is listed in things_to_avoid.language_constraints`
        )
      }
    }
  }
  
  return errors
}

/**
 * Helper function to aggregate website text for validator
 * (duplicates logic from prompt-b.ts to avoid circular dependencies)
 * 
 * v4.9.0: Now uses detectWebsitePresence for comprehensive detection
 */
function aggregateWebsiteTextForValidator(dataSources: DataSources): string {
  const textParts: string[] = []
  
  // v4.9.0: Use comprehensive website presence detection
  const presence = detectWebsitePresence(dataSources)
  logWebsitePresence(presence, 'Validator')
  
  if (!presence.hasWebsite) {
    console.log('⚠️ Validator: No website data found for banned word analysis')
    return ''
  }
  
  // v4.8.9 FIX: Use websiteAnalysis (actual key) with fallback to website
  const website = (dataSources as any).websiteAnalysis || (dataSources as any).website
  
  if (website) {
    // v4.8.9 FIX: Use ACTUAL field names from website_analyses table
    if (website.homepage_content) textParts.push(website.homepage_content)
    if (website.about_content) textParts.push(website.about_content)
    if (website.about_block) textParts.push(website.about_block)
    
    // Array fields - handle both array and string formats
    if (website.hero_texts) {
      if (Array.isArray(website.hero_texts)) textParts.push(...website.hero_texts)
      else textParts.push(website.hero_texts)
    }
    if (website.headers) {
      if (Array.isArray(website.headers)) textParts.push(...website.headers)
      else textParts.push(website.headers)
    }
    if (website.cta_texts) {
      if (Array.isArray(website.cta_texts)) textParts.push(...website.cta_texts)
      else textParts.push(website.cta_texts)
    }
    if (website.nav_items) {
      if (Array.isArray(website.nav_items)) textParts.push(...website.nav_items)
      else textParts.push(website.nav_items)
    }
    if (website.keywords) {
      if (Array.isArray(website.keywords)) textParts.push(...website.keywords)
      else textParts.push(website.keywords)
    }
    if (website.pages && Array.isArray(website.pages)) {
      website.pages.forEach((page: any) => {
        if (page.content) textParts.push(page.content)
        if (page.text) textParts.push(page.text)
      })
    }
  }
  
  const profile = dataSources.profile as any
  if (profile) {
    if (profile.short_description) textParts.push(profile.short_description)
    if (profile.long_description) textParts.push(profile.long_description)
  }
  
  const social = dataSources.social as any
  if (social) {
    if (social.bio) textParts.push(social.bio)
    if (social.description) textParts.push(social.description)
  }
  
  return textParts.filter(Boolean).join(' ')
}

/**
 * Validates Prompt B output for issues.
 * Checks for disallowed generic words, internal tokens, and meta-text.
 * 
 * @param sections - Parsed JSON sections from Prompt B
 * @param analysis - Prompt A analysis (for disallowed words)
 * @returns Array of error messages (empty if valid)
 */
