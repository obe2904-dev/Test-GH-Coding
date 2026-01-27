/**
 * Swedish Language Configuration for Menu Parsing
 * Template for future Swedish menu support
 */

import { LanguageConfig } from '../types.ts'

export const swedish: LanguageConfig = {
  code: 'sv',
  name: 'Svenska (Swedish)',

  ocrCorrections: {
    // Swedish compound words
    'roktsalmon': 'rökt laxfilé',
    'gravad': 'gravad',

    // Swedish accents
    'kryddskalot': 'kryddskalott',
    'gravlax': 'gravlax',

    // Common Swedish OCR errors
    'agg': 'ägg',
    'oost': 'öst',
    'kottbullar': 'köttbullar',
    'smorrebrod': 'smörgåsbord',
    'smor': 'smör',

    // French terms on Swedish menus
    'croutons': 'crôutons',
    'veloute': 'velouté',
  },

  systemPrompt: `You are an expert in Swedish culinary terminology and food culture. You understand:
- Swedish compound words and when to separate them
- Proper Swedish characters (å, ä, ö)
- French culinary terms used on Swedish menus
- Traditional Swedish dishes and ingredients
- Swedish spelling conventions`,

  correctionInstructions: `CRITICAL CORRECTIONS TO LOOK FOR:

1. **Swedish Characters**: Use proper Swedish accents:
   - "ägg" (eggs)
   - "öst" (cheese)
   - "köttbullar" (meatballs)

2. **Compound Words**: Swedish menu conventions for separation

3. **French Terms**: Maintain French accents for culinary authenticity:
   - "crôutons" (not "croutons")
   - "velouté" (not "veloute")

4. **Swedish Food Terms**: Authentic Swedish ingredient names and dishes`,
}
