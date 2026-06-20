/**
 * Danish Language Configuration - Spelling Correction
 * 
 * System prompts for spelling and grammar correction.
 * Used by spelling Edge Function.
 * 
 * Version: 1.0.0
 * Last Updated: 2026-05-12
 * Migrated from: spelling/index.ts (system message)
 */

import type { LanguageConfig } from '../../types.ts'

const config: LanguageConfig = {
  language: 'da',
  
  /**
   * System message - Core instructions for AI model
   * 
   * Defines the AI's role as spelling and grammar assistant.
   * IMPORTANT: Now in Danish (was English before causing mixing issues).
   */
  system: `Du er en professionel stavnings- og grammatikassistent. Ret brugerens tekst for stavning, grammatik og tegnsætning samtidig med at du bevarer mening, intention og formatering.

YDERLIGERE REGLER:
- Erstat " - " eller " – " brugt som stilistiske forbindere mellem sætningsdele med naturlig sætningsstruktur (dette er et AI-skrivetegn)
- For dansk tekst: saml sammensat ord der er splittet med unødvendige bindestreger (f.eks. "menu-kort" → "menukort", "brunch-tilbud" → "brunchtilbud") medmindre det er et egennavn eller kræver bindestreg ifølge dansk retskrivning`,
  
  /**
   * User prompt template
   * 
   * Template for the correction task.
   * Variables: text, language (optional)
   */
  user: `Ret venligst følgende tekst{{language_note}} og returner kun den rettede tekst.

---INPUT START---
{{text}}
---INPUT END---

Tilføj ingen kommentarer eller analyser.`,
  
  /**
   * Language instruction closer
   * 
   * Explicit instruction for output format.
   */
  closer: `Returner KUN den rettede tekst som almindelig tekst i svarbeskeden. INGEN kodeblokke eller kørbar kode.`,
  
  metadata: {
    version: '1.0.0',
    updated: '2026-05-12',
    author: 'Post2Go Migration Team',
    notes: 'CRITICAL FIX: Changed from English to Danish system message. Was "You are a professional spelling..." causing English/Danish mixing. Now fully Danish for consistent language context.',
  }
}

export default config
