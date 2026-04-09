/**
 * Brand word lists and smart banned-word helpers.
 * Extracted from prompt-b.ts (v4.14.0).
 */

import type { DataSources, LanguageConfig } from '../types.ts'
import { detectWebsitePresence } from '../website-presence.ts'

/**
 * Default banned words for Danish content.
 * These are generic marketing words that make AI output sound inauthentic.
 * Words may be ALLOWED if the business uses them 2+ times on their website (v4.8.9).
 */
export const DEFAULT_BANNED_WORDS_DA: string[] = [
  'hyggelig',
  'hyggeligt',
  'lækker',
  'lækkert',
  'lækre',
  'indbydende',
  'afslappet',
  'afslappede',
  'autentisk',
  'autentiske',
  'unik',
  'unikke',
  'fantastisk',
  'fantastiske',
  'vidunderlig',
  'vidunderlige',
  'charmerende'
]

/**
 * English equivalent (for future use)
 */
export const DEFAULT_BANNED_WORDS_EN: string[] = [
  'cozy',
  'delicious',
  'amazing',
  'unique',
  'authentic',
  'fantastic',
  'wonderful',
  'charming',
  'inviting'
]

/**
 * Aggregates all text content from website sources for banned word analysis.
 * Combines structured data, raw content, meta descriptions, etc.
 * 
 * v4.8.9 Task 2: Smart Banned Words
 * v4.9.0: Now uses detectWebsitePresence for comprehensive detection
 */
export function aggregateWebsiteText(dataSources: DataSources): string {
  const textParts: string[] = []
  
  // v4.9.0: Use comprehensive website presence detection
  const presence = detectWebsitePresence(dataSources)
  
  if (!presence.hasWebsite) {
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
    
    // Pages content
    if (website.pages && Array.isArray(website.pages)) {
      website.pages.forEach((page: any) => {
        if (page.content) textParts.push(page.content)
        if (page.text) textParts.push(page.text)
      })
    }
  }
  
  // Business profile descriptions
  const profile = dataSources.profile as any
  if (profile) {
    if (profile.short_description) textParts.push(profile.short_description)
    if (profile.long_description) textParts.push(profile.long_description)
  }
  
  // Social media bios — socialAccounts is an array of { platform, handle, profile_url }
  // bio/description fields are not currently fetched by the data-gatherer query,
  // so this produces no output until the query is extended. Using the correct key
  // prevents the silent undefined lookup on the wrong property name.
  const socialAccounts = dataSources.socialAccounts as any[]
  if (Array.isArray(socialAccounts)) {
    for (const acct of socialAccounts) {
      if (acct?.bio) textParts.push(acct.bio)
      if (acct?.description) textParts.push(acct.description)
    }
  }
  
  return textParts.filter(Boolean).join(' ')
}

/**
 * Filters banned words based on business website usage.
 * If a banned word appears 2+ times on the business's website,
 * it's considered part of their authentic voice and is ALLOWED.
 * 
 * v4.8.9 Task 2: Smart Banned Words (Hybrid Option C)
 * 
 * @param defaultBannedWords - The default list of banned words
 * @param websiteText - Combined text from all website sources
 * @param businessName - Name of the business (for logging)
 * @returns Object with final banned words and list of allowed words
 */
export function filterBannedWordsByBusinessUsage(
  defaultBannedWords: string[],
  websiteText: string,
  businessName: string
): { finalBannedWords: string[]; allowedWords: { word: string; count: number }[] } {
  const allowedWords: { word: string; count: number }[] = []
  const MINIMUM_OCCURRENCES = 2
  
  // Normalize website text for matching
  const normalizedText = websiteText.toLowerCase()
  
  const finalBannedWords = defaultBannedWords.filter(word => {
    // Create regex for word boundary matching
    const regex = new RegExp(`\\b${word.toLowerCase()}\\b`, 'gi')
    const matches = normalizedText.match(regex)
    const count = matches ? matches.length : 0
    
    if (count >= MINIMUM_OCCURRENCES) {
      allowedWords.push({ word, count })
      return false // Remove from banned list
    }
    return true // Keep in banned list
  })
  
  if (allowedWords.length > 0) {
    console.log(`🔓 Smart Banned Words [${businessName}]: ${allowedWords.length} allowed, ${finalBannedWords.length} banned`)
  }
  
  return { finalBannedWords, allowedWords }
}

/**
 * Computes the set of conditionally-forbidden words that are allowed for this
 * specific business (used 2+ times on their website).
 * Used by server-side validation guard to avoid false positives.
 */
export function computeAllowedSet(
  dataSources: DataSources,
  language: LanguageConfig
): Set<string> {
  // businesses table uses 'name', not 'business_name'
  const businessName = dataSources.business?.name || 'Unknown'
  const websiteText = aggregateWebsiteText(dataSources)
  const defaultBannedWords = language.code === 'da' ? DEFAULT_BANNED_WORDS_DA : DEFAULT_BANNED_WORDS_EN
  const { allowedWords } = filterBannedWordsByBusinessUsage(defaultBannedWords, websiteText, businessName)
  return new Set(allowedWords.map(w => w.word.toLowerCase()))
}


