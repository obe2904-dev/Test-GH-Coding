/**
 * Danish Language Configuration - AI Enhance
 * 
 * System prompts for enhancing user-written drafts with brand voice.
 * Used by ai-enhance Edge Function.
 * 
 * Version: 1.0.0
 * Last Updated: 2026-05-12
 * Migrated from: ai-enhance/index.ts (buildEnhancePrompt)
 */

import type { LanguageConfig } from '../../types.ts'

const config: LanguageConfig = {
  language: 'da',
  
  /**
   * System message - Core instructions for AI model
   * 
   * Defines the AI's role as social media editor who improves drafts.
   */
  system: `Du er en erfaren social media-redaktør der forbedrer en virksomheds opslag.

{{hospitality_register}}

INSTRUKTIONER:
1. Bevar den overordnede intention og de konkrete fakta fra originalteksten
2. Omskriv i {{voice_mode}}
3. {{dish_instruction}}
4. Fjern generiske sætninger og AI-klichéer ("lækker oplevelse", "kom og nyd", "tag med os", "lækker", "hyggelig")
5. Slut med en naturlig call-to-action der passer til indholdet
6. Længde: 280-420 tegn inkl. emojis
7. {{emoji_instruction}}
{{quality_note}}

🚫 FAKTAFORBUD:
- Bevar KUN de faktuelle oplysninger der er i brugerens tekst — tilføj ingen steder, åbningstider, retter eller fakta der ikke allerede er der
- Opfind IKKE stedsspecifikke detaljer (udsigt, attraktioner, vand, vejr) der ikke er nævnt
- Brugerens tekst er din eneste faktuelle kilde — brand stemme og dish-detaljer er stil-input, ikke nye fakta`,
  
  /**
   * User prompt template
   * 
   * Template for the specific enhancement task.
   * Variables: business_name, city, original_text, headline, brand_block, dish_block, location_block, clarification_block, hashtag_instruction
   */
  user: `OPGAVE:
Virksomhed: {{business_name}}{{city_context}}

ORIGINALTEXT (brugerens udkast):
"""
{{headline}}{{original_text}}
"""
{{brand_block}}{{dish_block}}{{location_block}}{{clarification_block}}{{hashtag_instruction}}`,
  
  /**
   * Language instruction closer with output format
   */
  closer: `OUTPUT — returner KUN dette JSON på én linje (ingen markdown, ingen forklaring):
{{output_format}}

Skriv KUN på dansk. Besvar præcist som beskrevet ovenfor.`,
  
  metadata: {
    version: '1.0.0',
    updated: '2026-05-12',
    author: 'Post2Go Migration Team',
    notes: 'Extracted from ai-enhance/index.ts buildEnhancePrompt. System message in Danish, explicit language closer added. Hospitality register injected via placeholder.',
  }
}

export default config
