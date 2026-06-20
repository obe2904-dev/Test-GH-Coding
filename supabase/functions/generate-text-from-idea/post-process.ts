// post-process.ts
// Text post-processing: spelling gate, keyword extraction, hashtag generation.

import { buildPlatformHashtagSets, type PlatformHashtagContext } from '../_shared/hashtags/platform-hashtags.ts'

// ── validateSceneFormat ────────────────────────────────────────────────────
// Non-blocking quality check for atmosphere / BTS posts.
// Returns a list of violation strings for logging — never throws, never blocks.
// Mirrors the prompt-level rules 6–8 in buildUnifiedPrompt (prompt-builders.ts).
export function validateSceneFormat(text: string): string[] {
  const violations: string[] = []

  // Rule 6: First line must be ≤ 7 words
  const firstLine = text.split('\n')[0].replace(/#\S+/g, '').trim()
  const wordCount = firstLine.split(/\s+/).filter(Boolean).length
  if (wordCount > 7) {
    violations.push(`Rule6: first line is ${wordCount} words (max 7): "${firstLine}"`)
  }

  // Rule 7: No banned grammatical subject at start of any sentence
  // Pattern: sentence starts with a furniture/interior word + verb
  const bannedSubjectPattern = /(?:^|[.!?]\s+)(lyset|træbord(?:ene|et)?|metalstol(?:ene|en)?|gulvet|vinduet|vinduer|rummet|loftet|væggene|væggen|bordene|bordet|stolene|stolen|indretningen|interiøret)\b/i
  if (bannedSubjectPattern.test(text)) {
    const match = text.match(bannedSubjectPattern)
    violations.push(`Rule7: banned grammatical subject detected: "${match?.[0]?.trim()}"`)
  }

  // Rule 8: Max 3 lines total (non-empty lines)
  const nonEmptyLines = text.split('\n').filter(l => l.trim().length > 0)
  if (nonEmptyLines.length > 4) { // 4 = 3 content lines + 1 CTA
    violations.push(`Rule8: ${nonEmptyLines.length} lines (max 3 content + 1 CTA)`)
  }

  return violations
}

// ── needsSpellingCheck ─────────────────────────────────────────────────────
// Returns true when surface signals suggest the text may contain a correctable
// error. Identical threshold for both AI Ideas and Weekly Plan paths.
export function needsSpellingCheck(text: string, language: string): boolean {
  // Broken/double spacing
  if (/ {2}/.test(text)) return true
  // Space before punctuation ("ord ," / "ord .")
  if (/ [.!?,;](?=\s|$)/.test(text)) return true
  // Repeated punctuation (!!, ??, ,,)
  if (/([!?,;])\1/.test(text)) return true
  // AI-tell hyphen or en-dash connector between sentence parts (" - " / " – ")
  if (/ [\u2013\u2014-] /.test(text)) return true
  // Split compound nouns: Danish/Swedish
  if ((language === 'da' || language === 'sv') &&
    /\b\w{3,}\s+(ret|kort|bord|hus|brød|gryde|suppe|kage|kaffe|aften|middag|menu|vin|øl|mad)\b/i.test(text)) return true
  // Split compound nouns: German
  if (language === 'de' &&
    /\b[A-ZÄÖÜ]\w{2,}\s+(gericht|tisch|karte|haus|brot|kuchen|kaffee|wein|bier|abend)\b/.test(text)) return true
  return false
}

// ── stripMetaInstructions ──────────────────────────────────────────────────
// Remove meta-instruction placeholders that shouldn't appear in final copy.
// Defense-in-depth safeguard against prompt instruction leakage from brand profile
// or AI hallucination. Patterns: (vær specifik: ...), (be specific: ...), [insert X], etc.
export function stripMetaInstructions(text: string): string {
  return text
    // Danish placeholders from brand profile never_say examples
    .replace(/\(vær specifik[^)]*\)/gi, '')
    .replace(/\(vær konkret[^)]*\)/gi, '')
    .replace(/\(fjern ordet\)/gi, '')
    .replace(/\(brug [^)]+\)/gi, '')
    .replace(/\(erstat med [^)]+\)/gi, '')
    
    // English placeholders (multi-language support)
    .replace(/\(be specific[^)]*\)/gi, '')
    .replace(/\(be concrete[^)]*\)/gi, '')
    .replace(/\(remove word\)/gi, '')
    .replace(/\(use [^)]+\)/gi, '')
    .replace(/\(replace with [^)]+\)/gi, '')
    
    // Generic instruction patterns that might leak from prompts
    .replace(/\[insert [^\]]+\]/gi, '')
    .replace(/\[add [^\]]+\]/gi, '')
    .replace(/\[tilføj [^\]]+\]/gi, '')
    .replace(/<specify [^>]+>/gi, '')
    .replace(/<angiv [^>]+>/gi, '')
    
    // Clean up double spaces and trim
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// ── stripIncompleteFragments ───────────────────────────────────────────────
// Remove sentence fragments that end with an open conjunction/preposition.
// Examples: "Vi har åbent. Og 🥑." → "Vi har åbent."
//           "Kom forbi. Men" → "Kom forbi."
// This handles the AI truncation bug where it creates incomplete sentences.
export function stripIncompleteFragments(text: string): string {
  // Pattern: Period/exclamation/question mark, optional whitespace, then conjunction/preposition
  // followed by optional emoji and ending punctuation
  // We want to remove: ". Og 🥑." or ". Men" or "! Eller" etc.
  const pattern = /([.!?])\s+\b(og|eller|men|at|som|til|med|fra|der|de|en|et|i|på|for|af|om|så|når|hvis|selvom|fordi)\b\s*([\p{Emoji_Presentation}\p{Extended_Pictographic}]\s*)?[.!?]?\s*$/iu
  
  let result = text.trim()
  
  // Keep removing incomplete fragments until none remain
  let iterations = 0
  while (pattern.test(result) && iterations < 5) {
    result = result.replace(pattern, '$1').trim()
    iterations++
  }
  
  return result
}

// ── stripBannedClosers ────────────────────────────────────────────────────
// Remove recurring end-of-copy closers that often survive prompt rules.
export function stripBannedClosers(text: string): string {
  return text
    .replace(/\b(?:læs mere|mere info|book bord|bestil nu|kom forbi)\b\.?\s*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// ── stripAIDashes ─────────────────────────────────────────────────────────
// Remove AI-style standalone dash connectors between words or clauses.
export function stripAIDashes(text: string): string {
  return text
    .replace(/\s*[–—]\s+/g, '. ')
    .replace(/\s+-\s+/g, '. ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// ── extractTopicKeyword ────────────────────────────────────────────────────
// Derive topic keyword from structured inputs — no word-list scanning, language-agnostic.
// Priority: menuItemName → contentBlock RET: prefix → AI-returned keyword
export function extractTopicKeyword(contentBlock: string, menuItemName?: string, aiKeyword?: string): string | undefined {
  // Tier 1: explicit menu item name — highest accuracy, always use when present
  if (menuItemName && menuItemName.trim().length > 0) {
    // Strip parenthetical offer descriptions (e.g. "Brunchtilbud (1 valgfri brunch...)") → "Brunchtilbud"
    const namePart = menuItemName.trim().replace(/\s*\(.*$/, '').trim()
    const base = namePart.length > 2 ? namePart : menuItemName.trim()
    const cleaned = base
      .replace(/[^a-zA-ZæøåÆØÅéèêàùüöä0-9\s]/g, '')
      .replace(/\s+/g, '')
      .slice(0, 25)
    if (cleaned.length > 2) return cleaned.toLowerCase().charAt(0).toUpperCase() + cleaned.toLowerCase().slice(1)
  }
  // Tier 2: parse the RET: prefix from contentBlock (menu post without a named item)
  if (!contentBlock || typeof contentBlock !== 'string') return aiKeyword // Guard against undefined/invalid contentBlock
  const retMatch = contentBlock.match(/^RET:\s*(.+?)(?:\n|$)/i)
  if (retMatch) {
    const label = retMatch[1].trim()
    const token = label.replace(/\s+/g, '').replace(/[^a-zA-ZæøåÆØÅéèêàùüöä0-9]/g, '').slice(0, 25)
    if (token.length > 2) return token.charAt(0).toUpperCase() + token.slice(1)
  }
  // Tier 3: AI-returned keyword (covers STEMNING:/SCENE: posts in all languages)
  if (aiKeyword && aiKeyword.trim().length > 1) {
    const k = aiKeyword.trim()
    return k.charAt(0).toUpperCase() + k.slice(1)
  }
  return undefined
}

// ── getContentDomain ───────────────────────────────────────────────────────
// Classify a resolved keyword into a content domain for geo-niche tag selection.
function getContentDomain(keyword: string): 'coffee' | 'drinks' | 'food' | 'bakery' | 'neutral' {
  const k = keyword.toLowerCase()
  const matches = (signals: string[]) => signals.some(w => k.includes(w) || w.includes(k))
  if (matches(['kaffe', 'latte', 'cappuccino', 'espresso', 'cortado', 'americano', 'filterkaf'])) return 'coffee'
  if (matches(['øl', 'vin', 'cocktail', 'negroni', 'drinks', 'aperol', 'gin', 'whisky', 'bar', 'shot', 'spiritus'])) return 'drinks'
  // æggekage and similar compound savory dishes must resolve before the 'kage' bakery signal
  if (matches(['bøf', 'brunch', 'frokost', 'aftensmad', 'morgenmad', 'burger', 'pizza', 'salat', 'sandwich', 'tapas', 'suppe', 'steak', 'kylling', 'laks', 'sushi', 'pasta', 'æggekage', 'smørrebrød', 'flæskesteg', 'rugbrød'])) return 'food'
  // Bakery signals: check for whole-word 'kage' only (not as compound suffix like 'æggekage')
  if (k === 'kage' || matches(['croissant', 'kanelsnegl', 'wienerbrød', 'bolle', 'bageri', 'vaffel']) || /\bkage\b/.test(k)) return 'bakery'
  return 'neutral'
}

// ── generateHashtags ───────────────────────────────────────────────────────
export function generateHashtags(
  city: string,
  contentType: string,
  extractedKeyword?: string,
  businessName?: string,
  context: Partial<PlatformHashtagContext> = {}
): { facebook: string[], instagram: string[] } {
  return buildPlatformHashtagSets({
    city,
    businessName,
    contentType,
    extractedKeyword,
    vertical: context.vertical,
    businessCharacter: context.businessCharacter,
    text: context.text,
    detectedDishName: context.detectedDishName,
    detectedDishDescription: context.detectedDishDescription,
  })
}
