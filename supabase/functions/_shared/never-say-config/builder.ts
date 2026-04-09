/**
 * NEVER_SAY LIST BUILDER
 * Combines universal lists + country-specific + business-type + location filtering
 * 
 * This rule-based approach ensures consistency across all businesses
 * without wasting API tokens on universal truths.
 */

import { UNIVERSAL_NEVER_SAY } from './universal.ts'
import { DENMARK_NEVER_SAY } from './denmark.ts'
import { FSE_NEVER_SAY, FSE_CONDITIONAL_NEVER_SAY } from './business-types/fse.ts'
import { SBO_NEVER_SAY } from './business-types/sbo.ts'
import { QSR_NEVER_SAY } from './business-types/qsr.ts'
import { MFV_NEVER_SAY } from './business-types/mfv.ts'
import { MFD_NEVER_SAY } from './business-types/mfd.ts'

export interface BusinessContext {
  country: string
  businessType: 'FSE' | 'SBO' | 'MFV' | 'MFD' | 'QSR'
  city: string
  priceLevel?: 'budget' | 'moderate' | 'upscale' | 'fine_dining'
  voiceStyle?: string
  toneAttributes?: string[]
}

/**
 * Build a comprehensive never_say list based on business context
 * 
 * @param context Business context (country, type, city, etc.)
 * @returns Array of 40-60 forbidden words, all relevant
 */
export function buildNeverSayList(context: BusinessContext): string[] {
  const neverSay: string[] = []
  
  // 1. UNIVERSAL (always apply to all businesses)
  neverSay.push(...UNIVERSAL_NEVER_SAY)
  
  // 2. COUNTRY-SPECIFIC
  const country = context.country.toLowerCase()
  if (country === 'denmark' || country === 'danmark') {
    neverSay.push(...DENMARK_NEVER_SAY)
  }
  // Add other countries as you expand (Sweden, Norway, etc.)
  
  // 3. BUSINESS TYPE SPECIFIC
  switch (context.businessType) {
    case 'FSE':
      neverSay.push(...FSE_NEVER_SAY)
      
      // Conditional based on price level
      if (context.priceLevel === 'budget' || context.priceLevel === 'moderate') {
        neverSay.push(...FSE_CONDITIONAL_NEVER_SAY.budget_moderate)
      } else if (context.priceLevel === 'upscale' || context.priceLevel === 'fine_dining') {
        neverSay.push(...FSE_CONDITIONAL_NEVER_SAY.upscale)
      }
      break
      
    case 'SBO':
      neverSay.push(...SBO_NEVER_SAY)
      break
      
    case 'QSR':
      neverSay.push(...QSR_NEVER_SAY)
      break
      
    case 'MFV':
      neverSay.push(...MFV_NEVER_SAY)
      break
      
    case 'MFD':
      neverSay.push(...MFD_NEVER_SAY)
      break
  }
  
  // 4. LOCATION-BASED FILTERING (prevent wrong city references)
  const DANISH_CITIES = [
    'København', 'Aarhus', 'Odense', 'Aalborg', 'Esbjerg',
    'Randers', 'Kolding', 'Horsens', 'Vejle', 'Roskilde',
    'Herning', 'Silkeborg', 'Næstved', 'Fredericia', 'Viborg'
  ]
  
  for (const cityName of DANISH_CITIES) {
    if (context.city !== cityName) {
      neverSay.push(cityName)
      
      // Add common variations
      if (cityName === 'København') {
        neverSay.push('Copenhagen', 'CPH', 'KBH')
      }
      if (cityName === 'Aarhus') {
        neverSay.push('Århus') // Old spelling
      }
    }
  }
  
  // 5. VOICE STYLE BASED
  const voiceStyleLower = context.voiceStyle?.toLowerCase() || ''
  const toneAttributesLower = context.toneAttributes?.map(a => a.toLowerCase()) || []
  
  // If very casual, avoid overly formal words
  if (voiceStyleLower.includes('casual') || 
      voiceStyleLower.includes('afslappet') ||
      toneAttributesLower.includes('casual') ||
      toneAttributesLower.includes('afslappet')) {
    neverSay.push(
      'vi præsenterer',
      'vi byder velkommen til',
      'vores udvalg omfatter',
      'det er os en glæde',
      'vi har fornøjelsen'
    )
  }
  
  // If very formal, avoid slang
  if (voiceStyleLower.includes('formal') || 
      voiceStyleLower.includes('formel') ||
      toneAttributesLower.includes('professional') ||
      toneAttributesLower.includes('professionel')) {
    neverSay.push(
      'fed',
      'sej',
      'cool',
      'awesome',
      'nice'
    )
  }
  
  // 6. Remove duplicates, sort alphabetically for consistency
  return [...new Set(neverSay)].sort()
}

/**
 * Get a human-readable summary of why certain words are forbidden
 * Useful for debugging or explaining to users
 */
export function explainNeverSay(word: string, context: BusinessContext): string {
  if (UNIVERSAL_NEVER_SAY.includes(word)) {
    return 'Universal marketing speak - unprofessional for all businesses'
  }
  
  if (DENMARK_NEVER_SAY.includes(word)) {
    return 'Should use Danish equivalent instead'
  }
  
  if (context.businessType === 'FSE' && FSE_NEVER_SAY.includes(word)) {
    return 'Wrong positioning for full-service restaurants'
  }
  
  if (context.businessType === 'QSR' && QSR_NEVER_SAY.includes(word)) {
    return 'Wrong positioning for quick service'
  }
  
  // Check if it's a city name
  const DANISH_CITIES = ['København', 'Aarhus', 'Odense', 'Aalborg']
  if (DANISH_CITIES.includes(word) && word !== context.city) {
    return `Wrong city reference (business is in ${context.city})`
  }
  
  return 'Contextually inappropriate for this business'
}
