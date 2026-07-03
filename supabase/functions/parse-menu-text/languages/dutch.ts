/**
 * Dutch Language Configuration for Menu Parsing
 * Template for future Dutch menu support
 */

import { LanguageConfig } from '../types.ts'

export const dutch: LanguageConfig = {
  code: 'nl',
  name: 'Nederlands (Dutch)',

  ocrCorrections: {
    // Dutch compound words
    'gerooktslam': 'gerookt ham',
    'truffelboter': 'truffel boter',

    // Common Dutch OCR errors
    'patat': 'patat',
    'bami': 'bami',
    'nasi': 'nasi',
    'groente': 'groente',

    // French culinary terms
    'croutons': 'crôutons',
    'veloute': 'velouté',
  },

  systemPrompt: `You are an expert in Dutch culinary terminology and food culture. You understand:
- Dutch compound words and meal traditions
- Authentic Dutch ingredient names
- French culinary terms on Dutch menus
- Dutch spelling and typography conventions`,

  correctionInstructions: `CRITICAL CORRECTIONS TO LOOK FOR:

1. **Dutch Compound Words**: Follow Dutch conventions for word separation

2. **French Terms**: Maintain French accents:
   - "crôutons" (not "croutons")
   - "velouté" (not "veloute")

3. **Dutch Food Terms**: Authentic Dutch ingredient and dish names

4. **International Cuisine**: Dutch menus often include Indonesian and other cuisines`,
}
