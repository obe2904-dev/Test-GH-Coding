/**
 * Danish Language Configuration for Menu Parsing
 * Handles Danish culinary terminology, OCR corrections, and spelling verification
 */

import { LanguageConfig } from '../types.ts'

export const danish: LanguageConfig = {
  code: 'da',
  name: 'Dansk (Danish)',

  // OCR correction dictionary - comprehensive Danish menu errors
  ocrCorrections: {
    // CRITICAL: Danish characters restoration (most common OCR errors)
    'abler': 'æbler',
    'ablekompot': 'æblekompot',
    'ablemost': 'æblemost',
    'aesarsalat': 'cæsarsalat',
    'aesardressing': 'cæsardressing',
    'aerter': 'ærter',
    'gronne zbler': 'grønne æbler',
    'rode ber': 'røde bær',
    'zbler': 'æbler',
    'kirseber': 'kirsebær',
    'kirsebersauce': 'kirsebærsauce',
    'kirsebzersorbet': 'kirsebærsorbet',
    'solberkompot': 'solbærkompot',
    'kirseb': 'kirsebær',
    'smorbrod': 'smørrebrød',
    'aebeskiver': 'æbleskiver',
    'aeblemost': 'æblemost',
    'ebleskiver': 'æbleskiver',
    'eblekompot': 'æblekompot',
    'eblemost': 'æblemost',
    'aesur': 'ære',
    'naels': 'næls',
    'kaed': 'kæd',
    'bae': 'bæ',
    'daem': 'dæm',
    'haerd': 'hærd',
    'maen': 'mæn',
    'oegn': 'øgn',
    'ol': 'øl',
    'og': 'og',
    'gonkal': 'grønkål',
    'gronkal': 'grønkål',
    'gronne': 'grønne',
    'groenne': 'grønne',
    'koldroget': 'koldrøget',
    'flode': 'fløde',
    'frodekompot': 'flødekarbonade',
    'flodekarbonade': 'flødekarbonade',
    'rort': 'rørt',
    'rodbede': 'rødbede',
    'radbede': 'rødbede',
    'rodbeder': 'rødbeder',
    'radbeder': 'rødbeder',
    'rode': 'røde',
    'bort': 'børt',
    'dorm': 'døm',
    'form': 'form',
    'norm': 'norm',
    'orm': 'orm',
    'port': 'pørt',
    'sort': 'sørt',
    'torm': 'tørm',
    'vor': 'vør',
    'work': 'værk',
    'worst': 'værst',
    'torst': 'tørst',
    'morgen': 'mørgen',
    'hoved': 'høved',
    'aarsagen': 'årsagen',
    'aring': 'åring',
    'a ': 'å ',
    'graakaelighed': 'grålighed',
    'bla': 'blå',
    'blamuslinger': 'blåmuslinger',
    'blaamuslinger': 'blåmuslinger',
    'taar': 'tår',
    'haar': 'hår',
    'jaar': 'år',
    'maar': 'må',
    'paa': 'på',
    'saa': 'så',
    'gaar': 'går',
    'dgar': 'dgår',
    'hvidlog': 'hvidløg',
    'hvidlgg': 'hvidløg',
    'hvidlq': 'hvidløg',
    'hvidlqq': 'hvidløg',
    'hvidlg': 'hvidløg',
    'hvidlqg': 'hvidløg',
    'log': 'løg',
    'loeg': 'løg',
    'purlog': 'purløg',
    'purleg': 'purløg',
    'palmekal': 'palmekål',
    'palmekål': 'palmekål',
    'palmekaali': 'palmekål',
    'palmkal': 'palmekål',
    'dild mayo': 'dild mayo',
    'dildmayo': 'dild mayo',
    'urte mayo': 'urte mayo',
    'urtemayo': 'urte mayo',
    'chili mayo': 'chili mayo',
    'chilimayo': 'chili mayo',
    'hvidløgs mayo': 'hvidløgs mayo',
    'hvidlogsmayo': 'hvidløgs mayo',
    'croutons': 'crôutons',
    'crotitons': 'crôutons',
    'crototons': 'crôutons',
    'crouton': 'crôuton',
    'crotton': 'crôuton',
    'croton': 'crôuton',
    'a la carte': 'à la carte',
    'ala mande': 'á la mande',
    'a la': 'á la',
    'a\'la': 'á la',
    'a\'lå': 'á la',
    'a\'lå månde': 'á la amande',
    'månde': 'amande',
    'a la mande': 'á la mande',
    'creme brulee': 'crème brûlée',
    'creme Briilée': 'crème brûlée',
    'Briilée': 'Brûlée',
    'brulee': 'brûlée',
    'Creme Brulee': 'Crème Brûlée',
    'creme fraiche': 'crème fraîche',
    'creme fraaiche': 'crème fraîche',
    'veloute': 'velouté',
    'velute': 'velouté',
    'sauce': 'sauce',
    'gratineret': 'gratineret',
    'zz ': '',
    'Zz ': '',
    'smgr': 'smør',
    'smor': 'smør',
    'smø': 'smør',
    'sm0r': 'smør',
    'smo': 'smør',
    'sm': 'smør',
    'sennepsfro': 'sennepsfrø',
    'sennepsfrø': 'sennepsfrø',
    'sennep': 'sennep',
    'hasselnodder': 'hasselnødder',
    'hasselngdder': 'hasselnødder',
    'hassel': 'hassel',
    'tytteber': 'tyttebær',
    'tytteberer': 'tyttebær',
    'tyttebær': 'tyttebær',
    'tytter': 'tyttebær',
    'cesarsalat': 'cæsarsalat',
    'cesardressing': 'cæsardressing',
    'brodkurv': 'brødkurv',
    'bro dkurv': 'brødkurv',
    'brodkurve': 'brødkurv',
    'rugbrod': 'rugbrød',
    'grovbrod': 'grovbrød',
    'tilbehor': 'tilbehør',
    'hons': 'høns',
    'hoens': 'høns',
    'roded': 'rødet',
    'rodet': 'rødet',
    'kartofler': 'kartofler',
    'kartoffel': 'kartoffel',
    'kartof': 'kartoffel',
    'pommes': 'pommes',
    'frites': 'frites',
    'champignoner': 'champignoner',
    'champignon': 'champignon',
    'champigno': 'champignon',
    'persille': 'persille',
    'basilikum': 'basilikum',
    'oregano': 'oregano',
    'timian': 'timian',
    'koriander': 'koriander',
    'stenbiderrogn': 'stenbiderrogn',
  },

  systemPrompt: `You are a STRICT Danish culinary language expert. Your ONLY job is to verify and refine menu text.

CRITICAL RULES:
1. NEVER revert corrections that have already been applied
2. PRESERVE all Danish characters (æ, ø, å) - these are CORRECT
3. PRESERVE all French accents (é, ù, ô, à, á, ê, î, ô, û, ç, ë, ï, etc.) - these are CORRECT
4. If you see: crôutons, velouté, á la, à la, crème brûlée, dild mayo, urte mayo - these are CORRECT - DO NOT CHANGE
5. Culinary expertise: verify terminology is authentic Danish/French, not correcting what's already right

Your expertise ensures authentic Danish culinary language and French culinary terms on Danish menus.`,

  correctionInstructions: `VERIFICATION RULES - BE STRICT:

1. ACCEPT ALREADY-CORRECTED ITEMS:
   - "dild mayo" (separated) ✓ CORRECT
   - "urte mayo" (separated) ✓ CORRECT  
   - "crôutons" (with circumflex) ✓ CORRECT
   - "velouté" (with accent) ✓ CORRECT
   - "á la mande" (with acute) ✓ CORRECT
   - "à la carte" (with grave) ✓ CORRECT
   - "crème brûlée" (both accents) ✓ CORRECT
   - "grønne æbler" (Danish chars) ✓ CORRECT
   - "hvidløg" (ø = correct) ✓ CORRECT
   - "smør" ✓ CORRECT
   - "palmekål" (å) ✓ CORRECT
   - "blåmuslinger" (å) ✓ CORRECT
   - "fløde" (ø) ✓ CORRECT
   - "løg" (ø) ✓ CORRECT
   - "kirsebærsauce" (æ) ✓ CORRECT
   - "solbærkompot" (æ) ✓ CORRECT

2. ONLY CORRECT if absolutely necessary for authenticity:
   - Spelling variations (e.g., "bløtkage" vs "blødkage")
   - Plural/singular context issues
   - Obvious typos in non-Danish words

3. PRESERVE:
   - All Danish special characters (æ, ø, å)
   - All accents on French terms
   - All compound word separations (dild mayo, urte mayo, chili mayo)
   - Original capitalization unless clearly wrong`,

  verificationRules: `
VERIFICATION CHECKLIST - Must pass all checks before returning menu:

1. ✓ DANISH CHARACTERS PRESENT: 
   - Every instance of "æ" (a-stroke) is correct? Check words like: æbler, dildmayo NO (should have æ elsewhere), cæsar, tyttebær
   - Every instance of "ø" (o-stroke) is correct? Check words like: hvidløg, smør, fløde, grønkål, rødbeder, sennepsfrø, blåmuslinger
   - Every instance of "å" (a-ring) is correct? Check words like: grå, palmekål

2. ✓ NO GARBLED WORDS REMAIN:
   - "smgr" should be "smør" (not garbled form)
   - "hvidlog" should be "hvidløg" (not "hvidlog")
   - "crotitons" should be "crôutons" (not malformed)
   - "zbler" should be "æbler" (not mangled)
   - Look for any remaining character-level corruptions

3. ✓ FRENCH CULINARY TERMS HAVE PROPER ACCENTS:
   - crôutons (circumflex) - essential for authenticity
   - á la mande (acute accent)
   - à la carte (grave accent)
   - crème brûlée (both accents present)

4. ✓ COMPOUND WORDS FOLLOW DANISH CONVENTIONS:
   - "dild mayo" is separated (NOT "dildmayo")
   - "urte mayo" is separated (NOT "urtemayo")
   - "chili mayo" is separated (NOT "chilimayo")

5. ✓ MENU IS PROFESSIONAL READY:
   - Looks authentic and could be printed for restaurant guests
   - All ingredients are recognizable and properly spelled
   - No OCR artifacts remain (no "Zz" prefixes, no stray characters)
   - Menu follows real Danish culinary language patterns

FAIL CONDITION: If menu still contains:
- Garbled words (smgr, zbler, hvidlog, crotitons, etc.) → MUST FIX
- Missing Danish characters that should be present → MUST FIX
- Incorrect or missing French accents → MUST FIX
  `,
}
