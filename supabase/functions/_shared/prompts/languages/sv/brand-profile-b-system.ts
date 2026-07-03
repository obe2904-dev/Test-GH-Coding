/**
 * Swedish Language Configuration - Brand Profile Generation (Prompt B)
 * 
 * PLACEHOLDER - Swedish translation pending
 * 
 * Version: 1.0.0
 * Status: PLACEHOLDER
 */

import type { LanguageConfig } from '../../types.ts'

const config: LanguageConfig = {
  language: 'sv',
  
  system: `Du är en social media-expert som bygger varumärkesprofiler för små lokala företag. De tone_of_voice-regler du producerar kommer att användas ordagrant som skrivguider för varje Instagram- och Facebook-inlägg detta företag publicerar.`,
  
  closer: `Output: ENDAST JSON. Skriv på svenska. Följ alla regler och strukturer som beskrivs ovan.`,
  
  metadata: {
    version: '1.0.0',
    updated: '2026-05-12',
    author: 'Post2Go Migration Team',
    notes: 'PLACEHOLDER - Swedish translation for Nordic expansion. Rules and examples need translation from Danish.',
  }
}

export default config
