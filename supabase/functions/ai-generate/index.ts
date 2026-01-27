// @ts-ignore - Deno runtime import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getUserIdFromAuth, getUserQuota, incrementQuota } from '../_shared/quota-utils.ts'

// Minimal Deno env typing for tooling
declare const Deno: { env: { get(key: string): string | undefined } }

// Updated: 2026-01-04 - Fixed menu item examples to prevent AI from inventing dishes
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Centralized AI model configuration
const AI_MODELS = {
  ideaGeneration: {
    'free': 'gpt-4o-mini',
    'standardplus': 'gpt-4o',
    'premium': 'gpt-4o',
  }
} as const

function getAIModelForTier(userTier?: string): string {
  return AI_MODELS.ideaGeneration[userTier as keyof typeof AI_MODELS.ideaGeneration] || 'gpt-4o-mini'
}

function extractMenuItemsFromPrompt(prompt: string): string[] {
  const match = prompt.match(
    /(MENU ITEMS|MENUPUNKTER).*?:\s*\n([\s\S]*?)(\n===|\nOUTPUT FORMAT:|\nOUTPUTFORMAT|\nGuidelines:|\nOUTPUT RULES:|\nOUTPUT-REGLER:|$)/i
  )
  if (!match) return []

  const lines = match[2]
    .split('\n')
    .map((s) => s.trim())

  const menuItems: string[] = []
  for (const line of lines) {
    if (!line) continue

    // Stop when the prompt transitions from the menu list into rules or another section.
    if (/^(MENU RULES|REGLER FOR MENUPUNKTER)\b/i.test(line)) break
    if (/^(OPENING HOURS|ÅBNINGSTIDER)\b/i.test(line)) break
    if (/^===\s*/.test(line)) break

    // Ignore placeholders / non-items
    if (/^\(ingen\)$|^ingen$|^\(none\)$|^none$/i.test(line)) continue

    // Strip bullet markers and keep the menu item (don't skip bullets!)
    if (/^[-*]\s+/.test(line)) {
      menuItems.push(line.replace(/^[-*]\s+/, '').trim())
      continue
    }

    menuItems.push(line)
  }

  return menuItems
}

function extractToneAnchorsFromPrompt(prompt: string): string[] {
  const match = prompt.match(
    /===\s*(TONE ANCHORS|TONEANKRE)\s*(\(MANDATORY\)|\(OBLIGATORISK\))?\s*===\s*\n([\s\S]*?)(\n===|\nOUTPUT FORMAT:|\nOUTPUTFORMAT|\nOUTPUT RULES:|\nOUTPUT-REGLER:|$)/i
  )
  if (!match) return []

  return match[3]
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((line) => line.startsWith('- '))
    .map((line) => line.replace(/^-\s+/, '').trim())
    .filter(Boolean)
}

function extractPromptLanguageFromPrompt(prompt: string | undefined | null): 'da' | 'en' {
  if (!prompt) return 'en'
  const match = prompt.match(/PROMPT_(?:LANGUAGE|SPROG):\s*(da|en)\b/i)
  if (match?.[1]) {
    return match[1].toLowerCase() as 'da' | 'en'
  }
  return 'en'
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractJsonObjectAfterLabel(prompt: string, labelRegex: RegExp): string | null {
  const match = labelRegex.exec(prompt)
  if (!match) return null

  const startSearch = match.index + match[0].length
  const braceStart = prompt.indexOf('{', startSearch)
  if (braceStart < 0) return null

  let depth = 0
  let inString = false
  let escape = false

  for (let i = braceStart; i < prompt.length; i++) {
    const ch = prompt[i]
    if (escape) {
      escape = false
      continue
    }
    if (ch === '\\') {
      if (inString) escape = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      continue
    }
    if (inString) continue

    if (ch === '{') depth += 1
    if (ch === '}') {
      depth -= 1
      if (depth === 0) {
        return prompt.slice(braceStart, i + 1)
      }
    }
  }

  return null
}

function extractHardConstraintsFromPrompt(prompt: string | undefined | null): string[] {
  if (!prompt) return []
  
  // Try JSON format first
  const jsonStr =
    extractJsonObjectAfterLabel(prompt, /Ting at undgå:\s*/i) ||
    extractJsonObjectAfterLabel(prompt, /Things to avoid:\s*/i) ||
    extractJsonObjectAfterLabel(prompt, /HARD_CONSTRAINTS_JSON\s*===\s*/i)

  if (jsonStr) {
    try {
      const parsed = JSON.parse(jsonStr)
      const language = Array.isArray(parsed?.language_constraints)
        ? parsed.language_constraints
        : Array.isArray(parsed?.hard_constraints)
          ? parsed.hard_constraints
          : []
      return language
        .map((s: any) => String(s || '').trim())
        .filter((s: string) => s.length >= 3)
    } catch {
      // Fall through to bullet list parsing
    }
  }
  
  // Try bullet-list format: === HARD_TERMS_BANNED === \n- word1 \n- word2
  const bulletMatch = prompt.match(
    /===\s*(?:HARD_TERMS_BANNED|BANNED_TERMS)\s*===\s*\n([\s\S]*?)(?:\n===|\n\n[A-Z]|$)/i
  )
  if (bulletMatch) {
    return bulletMatch[1]
      .split('\n')
      .map((s) => s.trim())
      .filter((line) => line.startsWith('- '))
      .map((line) => line.replace(/^-\s+/, '').trim())
      .filter((s) => s.length >= 3)
  }
  
  return []
}

function validateHardConstraints(ideas: any[], hardConstraints: string[]): string[] {
  const errors: string[] = []
  if (!Array.isArray(ideas) || ideas.length === 0) return errors
  if (!hardConstraints || hardConstraints.length === 0) return errors

  for (let i = 0; i < ideas.length; i++) {
    const idea = ideas[i]
    const haystacks = [String(idea?.headline || ''), String(idea?.text || ''), String(idea?.photoSuggestion || '')]
    for (const term of hardConstraints) {
      const re = new RegExp(escapeRegExp(term), 'i')
      if (haystacks.some((h) => re.test(h))) {
        errors.push(`Idea ${i + 1} contains forbidden term from hard constraints: "${term}".`)
        break
      }
    }
  }

  return errors
}

function extractBookingUrlFromPrompt(prompt: string | undefined | null): string {
  if (!prompt) return ''

  // Danish marker used by our prompts
  const dkMatch = prompt.match(/\bBORDRESERVATION\s*:\s*\n([^\n]+)\n?/i)
  const enMatch = prompt.match(/\bBOOKING\s*URL\s*:\s*\n([^\n]+)\n?/i)
  const raw = (dkMatch?.[1] || enMatch?.[1] || '').trim()
  const url = raw.split(/\s+/)[0]
  return /^https?:\/\//i.test(url) ? url : ''
}

function extractCapabilitySignals(prompt: string | undefined | null): Set<string> {
  if (!prompt) return new Set()
  
  const signals = new Set<string>()
  
  // Look for KEYWORDS/SERVICES or similar sections
  const keywordsMatch = prompt.match(
    /===\s*(KEYWORDS?|SERVICES?|NØGLEORD|TJENESTER)\s*===\s*\n([\s\S]*?)(?:\n===|\n\n[A-Z]|$)/i
  )
  
  if (keywordsMatch) {
    const content = keywordsMatch[2].toLowerCase()
    
    // Check for capability indicators
    if (/\bkaffe\b|\bcoffee\b/i.test(content)) signals.add('kaffe')
    if (/\bcocktails?\b|\bdrinks?\b/i.test(content)) signals.add('cocktails')
    if (/\bvin\b|\bwine\b/i.test(content)) signals.add('vin')
    if (/\bøl\b|\bbeer\b/i.test(content)) signals.add('øl')
    if (/\bthe\b|\btea\b/i.test(content)) signals.add('te')
  }
  
  // Also check in business description sections
  const descMatch = prompt.match(
    /===\s*(?:BUSINESS\s+DESCRIPTION|VIRKSOMHEDSBESKRIVELSE)\s*===\s*\n([\s\S]*?)(?:\n===|\n\n[A-Z]|$)/i
  )
  
  if (descMatch) {
    const content = descMatch[1].toLowerCase()
    
    if (/\bkaffe\b|\bcoffee\b|\bcafé\b|\bcafe\b/i.test(content)) signals.add('kaffe')
    if (/\bcocktails?\b|\bdrinks?\b|\bbar\b/i.test(content)) signals.add('cocktails')
    if (/\bvin\b|\bwine\b/i.test(content)) signals.add('vin')
    if (/\bøl\b|\bbeer\b/i.test(content)) signals.add('øl')
  }
  
  return signals
}

function getIdeasSystemPrompt(lang: 'da' | 'en'): string {
  if (lang === 'da') {
    return `Du er en dansk SoMe-copywriter for små virksomheder.

OUTPUT:
- Returnér KUN gyldig JSON. Ingen markdown. Ingen forklaringer.

PRIORITERING:
  1. UFRAVIGELIGE REGLER (hvis de findes)
  2. BRANDPROFIL (højeste prioritet)
  3. DRIFTSREGLER FOR INDHOLD
  4. VIRKSOMHEDSKONTEKST
  5. EKSTRA KONTEKST

MENUPUNKTER:
- Kopiér rettenavne præcis som angivet (tegn-for-tegn).
- Opfind aldrig retter. Oversæt aldrig. Omformuler aldrig.
- I kundevendt tekst: brug kun rettenavnet UDEN eventuel kategori i parentes.

STIL:
- Naturligt dansk (ikke "oversat" US marketing-sprog).
- Undgå klichéer ("Forestil dig...", "Tag en pause...").
- Variér startord på tværs af de 3 ideer.
- Maks. ÉT udråbstegn (!) per idé.
- Konkrete detaljer > generiske tillægsord.`
  }

  return `You are a social media copywriter for small businesses.

OUTPUT:
- Return ONLY valid JSON. No markdown. No explanations.

PRIORITY:
  1. HARD RULES (if present)
  2. BRAND PROFILE (highest priority)
  3. OPERATIONAL CONTENT RULES
  4. BUSINESS CONTEXT
  5. OPTIONAL CONTEXT

MENU ITEMS:
- Copy dish names exactly as provided (character-for-character).
- Never invent dishes. Never translate. Never paraphrase.
- In customer-facing text: use only the dish name WITHOUT any category suffix in parentheses.

STYLE:
- Natural English (avoid marketing clichés).
- Vary openings across the 3 ideas.
- Max ONE exclamation mark (!) per idea.
- Concrete details > generic adjectives.`
}

function validateNoPersonas(ideas: any[]): string[] {
  const errors: string[] = []
  const bannedPersonas = [
    'familier', 'børnefamilier', 'par', 'venner',
    'turister', 'studerende', 'lokale', 'unge', 'seniorer'
  ]

  for (let i = 0; i < ideas.length; i++) {
    const haystack = `${ideas[i]?.headline || ''}\n${ideas[i]?.text || ''}\n${ideas[i]?.photoSuggestion || ''}`
    for (const word of bannedPersonas) {
      // Use word boundaries to match repair pass behavior
      const regex = new RegExp(`\\b${word}\\b`, 'i')
      if (regex.test(haystack)) {
        errors.push(`Idea ${i + 1} contains banned persona/demographic word: "${word}".`)
        break
      }
    }
  }

  return errors
}

function validateMenuDaypartMatch(ideas: any[], menuItems: string[]): string[] {
  const errors: string[] = []
  if (menuItems.length === 0) return errors

  for (let i = 0; i < ideas.length; i++) {
    const idea = ideas[i]
    const menuItemUsed = String(idea?.menuItemUsed || '').trim()
    if (!menuItemUsed) continue // Non-menu idea, skip

    const text = String(idea?.text || '').toLowerCase()
    const bestTime = String(idea?.bestTimeToPost || '').trim()
    
    // Find the actual menu line
    const menuLine = menuItems.find(m => m.includes(menuItemUsed))
    if (!menuLine) continue

    const category = extractMenuCategory(menuLine)
    if (!category) continue // No category = no validation needed

    // CRITICAL: Validate that text keywords don't contradict the menu category
    // This catches cases where AI writes "brunch" text but uses a FROKOST item
    const textContainsMorningWords = /\b(brunch|morgen|morgenmad|breakfast|formiddag|morning)\b/i.test(text)
    const textContainsLunchWords = /\b(frokost|lunch)\b/i.test(text)
    const textContainsDinnerWords = /\b(aften|middag|dinner|evening)\b/i.test(text)
    
    const categoryIsMorning = /MORGENMAD|BREAKFAST|BRUNCH/i.test(category)
    const categoryIsLunch = /FROKOST|LUNCH/i.test(category)
    const categoryIsDinner = /MIDDAG|DINNER|AFTEN|EVENING/i.test(category)
    
    // Rule: Text keywords must not contradict the menu category
    if (textContainsMorningWords && !categoryIsMorning) {
      errors.push(
        `Idea ${i + 1} text/category mismatch: text mentions morning/brunch but "${menuItemUsed}" is from ${category} (not a brunch category)`
      )
    }
    if (textContainsLunchWords && !categoryIsLunch) {
      errors.push(
        `Idea ${i + 1} text/category mismatch: text mentions lunch/frokost but "${menuItemUsed}" is from ${category} (not a lunch category)`
      )
    }
    if (textContainsDinnerWords && !categoryIsDinner) {
      errors.push(
        `Idea ${i + 1} text/category mismatch: text mentions evening/dinner but "${menuItemUsed}" is from ${category} (not a dinner category)`
      )
    }
    
    // Enhanced daypart detection using both text and time
    const detectedDaypart = detectDaypart(text, bestTime)
    if (detectedDaypart === 'unknown') continue // Can't determine daypart, skip validation

    // Validate menu label matches detected daypart
    let labelMatchesDaypart = false
    
    if (detectedDaypart === 'morning') {
      labelMatchesDaypart = /MORGENMAD|BREAKFAST|BRUNCH/i.test(category)
    } else if (detectedDaypart === 'lunch') {
      labelMatchesDaypart = /FROKOST|LUNCH/i.test(category)
    } else if (detectedDaypart === 'evening') {
      labelMatchesDaypart = /MIDDAG|DINNER|AFTEN|EVENING|COCKTAIL|DRINK|BAR/i.test(category)
    }

    if (!labelMatchesDaypart) {
      errors.push(
        `Idea ${i + 1} daypart mismatch: "${menuItemUsed}" (${category}) doesn't match detected ${detectedDaypart} context (text + time: "${bestTime}")`
      )
    }

    // Kids menu items should only appear in family-friendly contexts
    if (isKidsMenuItem(menuLine)) {
      const hasKidsContext = /børn|barn|kid|child|familie/i.test(text)
      if (!hasKidsContext) {
        errors.push(
          `Idea ${i + 1} uses kids menu item "${menuItemUsed}" without family/kids context in text`
        )
      }
    }
  }

  return errors
}

function validateMenuContext(ideas: any[], menuItems: string[]): string[] {
  const errors: string[] = []
  if (menuItems.length === 0) return errors

  for (let i = 0; i < ideas.length; i++) {
    const idea = ideas[i]
    const menuItemUsed = String(idea?.menuItemUsed || '').trim()
    if (!menuItemUsed) continue // Non-menu idea, skip

    // Find the actual menu line
    const menuLine = menuItems.find(m => m.includes(menuItemUsed))
    if (!menuLine) continue

    const category = extractMenuCategory(menuLine)
    if (!category) continue // No category = no context restrictions

    const text = String(idea?.text || '').toLowerCase()
    const bestTime = String(idea?.bestTimeToPost || '').toLowerCase()
    const combinedContext = `${text} ${bestTime}`

    // Define context signals for each daypart/occasion
    const brunchSignals = /brunch|morgenmad|breakfast|formiddag|morning/i
    const lunchSignals = /frokost|lunch|middag.*tid|12|13|14/i
    const dinnerSignals = /aften|dinner|evening|middag(?!.*tid)|18|19|20|21/i
    const lateSignals = /cocktail|drink|bar|nat|late|22|23/i
    const kidsSignals = /børn|barn|kid|child|familie|family/i

    // RULE 1: BRUNCH items cannot be used in dinner/evening/late contexts
    if (/BRUNCH/i.test(category)) {
      if (dinnerSignals.test(combinedContext) || lateSignals.test(combinedContext)) {
        errors.push(
          `Idea ${i + 1} context violation: "${menuItemUsed}" is a BRUNCH item but is presented in dinner/evening/late context`
        )
        continue
      }
    }

    // RULE 2: FROKOST (lunch) items cannot be presented as brunch or late dinner
    if (/FROKOST|LUNCH/i.test(category)) {
      if (brunchSignals.test(combinedContext)) {
        errors.push(
          `Idea ${i + 1} context violation: "${menuItemUsed}" is a FROKOST item but is presented as brunch`
        )
        continue
      }
      if (lateSignals.test(combinedContext)) {
        errors.push(
          `Idea ${i + 1} context violation: "${menuItemUsed}" is a FROKOST item but is presented in late/bar/cocktail context`
        )
        continue
      }
    }

    // RULE 3: MIDDAG/DINNER items cannot be used in morning/brunch contexts
    if (/MIDDAG|DINNER|AFTEN/i.test(category)) {
      if (brunchSignals.test(combinedContext)) {
        errors.push(
          `Idea ${i + 1} context violation: "${menuItemUsed}" is a DINNER item but is presented in morning/brunch context`
        )
        continue
      }
    }

    // RULE 4: KIDS items must have family/kids context
    if (/BØRNE|BARN|KIDS|CHILD/i.test(category)) {
      if (!kidsSignals.test(combinedContext)) {
        errors.push(
          `Idea ${i + 1} context violation: "${menuItemUsed}" is a KIDS menu item but lacks family/kids context in text or timing`
        )
        continue
      }
    }

    // RULE 5: COCKTAIL/DRINK/BAR items should not appear in morning/lunch contexts
    if (/COCKTAIL|DRINK|BAR/i.test(category)) {
      if (brunchSignals.test(combinedContext) || lunchSignals.test(combinedContext)) {
        errors.push(
          `Idea ${i + 1} context violation: "${menuItemUsed}" is a COCKTAIL/BAR item but is presented in morning/lunch context`
        )
        continue
      }
    }
  }

  return errors
}

function validateToneConstraints(ideas: any[]): string[] {
  const errors: string[] = []
  const fomoRegex = /du\s+ikke\s+vil\s+g\w*\s+glip\s+af/i
  const soulWarmingRegex = /varmer\s+(både\s+)?(krop\s+og\s+)?sj(?:æ|ae)len/i

  for (let i = 0; i < ideas.length; i++) {
    const text = String(ideas[i]?.text || '')
    const exclamationCount = (text.match(/!/g) || []).length
    if (exclamationCount > 1) {
      errors.push(`Idea ${i + 1} is too over-the-top: more than 1 exclamation mark.`)
    }
    if (fomoRegex.test(text)) {
      errors.push(`Idea ${i + 1} contains FOMO phrasing ("du ikke vil gå glip af").`)
    }
    if (soulWarmingRegex.test(text)) {
      errors.push(`Idea ${i + 1} is too poetic/over-the-top ("varmer sjælen").`)
    }
  }

  return errors
}

function validateIdeas(ideas: any[], menuItems: string[], toneAnchors: string[], bookingUrl?: string, capabilitySignals?: Set<string>): string[] {
  const errors: string[] = []
  const hasMenu = menuItems.length > 0
  const allowedImpact = new Set(['low', 'medium', 'high'])
  const capabilities = capabilitySignals || new Set<string>()

  // Note: Concrete terms validation removed - was too aggressive.
  // Future: Replace with capability flags (hasCoffeeSignals, hasCocktailsSignals, etc.)
  // from Brand Profile analysis instead of raw menu text matching.

  const normalizeMenuLineToDish = (line: string): string => {
    return String(line || '').replace(/\s*\([^)]+\)\s*$/, '').trim()
  }

  const resolveMenuItemUsed = (usedRaw: string): { ok: boolean; resolved?: string; error?: string } => {
    const used = String(usedRaw || '').trim()
    if (!used) return { ok: false, error: 'empty' }

    // Exact match is always preferred
    if (menuItems.includes(used)) return { ok: true, resolved: used }

    // Allow base dish name (without trailing category suffix) if it maps uniquely.
    const usedBase = normalizeMenuLineToDish(used)
    if (!usedBase) return { ok: false, error: 'empty' }

    const matches = menuItems.filter((m) => normalizeMenuLineToDish(m) === usedBase)
    if (matches.length === 1) return { ok: true, resolved: matches[0] }
    if (matches.length > 1) {
      return {
        ok: false,
        error: `ambiguous (matches multiple menu items: ${matches.join(' | ')})`,
      }
    }
    return { ok: false, error: 'not_found' }
  }

  if (!Array.isArray(ideas) || ideas.length !== 3) {
    errors.push('Must return exactly 3 ideas.')
    return errors
  }

  // Track resolved menu items (normalized to an exact menu line) for uniqueness/"at least one" checks.
  const usedMenuItems: string[] = []
  let nonMenuIdeasCount = 0

  for (let i = 0; i < ideas.length; i++) {
    const idea = ideas[i]
    if (!idea?.headline || !idea?.text || !idea?.photoSuggestion) {
      errors.push(`Idea ${i + 1} missing required fields.`)
      continue
    }

    const text: string = String(idea.text || '')

    const bestTimeToPost = String(idea?.bestTimeToPost ?? '').trim()
    if (!bestTimeToPost) {
      errors.push(`Idea ${i + 1} missing bestTimeToPost.`)
    } else if (bestTimeToPost.length > 80 || bestTimeToPost.includes('\n')) {
      errors.push(`Idea ${i + 1} bestTimeToPost must be a short single-line string.`)
    }

    const impactRaw = String(idea?.impact ?? '').trim()
    const impact = impactRaw.toLowerCase()
    if (!impact) {
      errors.push(`Idea ${i + 1} missing impact.`)
    } else if (!allowedImpact.has(impact)) {
      errors.push(`Idea ${i + 1} impact must be one of: low | medium | high.`)
    }

    if (hasMenu) {
      const usedRaw = (idea.menuItemUsed || '').trim()
      if (!usedRaw) {
        nonMenuIdeasCount += 1

        // Non-menu idea must not mention any concrete menu item name in text.
        // If it does, it should be a menu-based idea with menuItemUsed set.
        for (const menuLine of menuItems) {
          const dishNameOnly = normalizeMenuLineToDish(menuLine)
          if (dishNameOnly && text.includes(dishNameOnly)) {
            errors.push(
              `Idea ${i + 1} is non-menu (menuItemUsed="") but text mentions the menu item "${dishNameOnly}". If you mention it, set menuItemUsed accordingly.`
            )
            break
          }
        }

        // Smart validation: Allow generic category terms if business has capability signals
        // but block specific product names not in menu
        
        const textLower = text.toLowerCase()
        
        // For cafés/restaurants, allow basic beverage terms by default (pragmatic approach)
        // Only block if business explicitly signals otherwise OR uses very specific terms
        const isGenericBeverage = /\b(kaffe|coffee|te|tea|drikke?|drinks?|drikkevarer)\b/i.test(textLower)
        const isSpecificCocktail = /\b(cocktails?|drinks?)\b/i.test(textLower) && !/\bvarm|hot|kold|cold\b/i.test(textLower)
        
        const genericTermsAllowed = [
          { term: /\b(?:en\s+)?kaffe\b|\bkaffen\b|\bcoffee\b/i, capability: 'kaffe', isGeneric: true },
          { term: /\b(?:en\s+)?te\b|\bteen\b|\btea\b/i, capability: 'te', isGeneric: true },
          { term: /\bvin(?:en)?\b|\bwine\b/i, capability: 'vin', isGeneric: false },
          { term: /\bøl(?:len)?\b|\bbeer\b/i, capability: 'øl', isGeneric: false },
          { term: /\bcocktails?\b/i, capability: 'cocktails', isGeneric: false }
        ]
        
        // Specific items that need menu presence (examples - not exhaustive)
        const specificItems = [
          'espresso martini', 'negroni', 'mojito', 'aperol spritz',
          'cappuccino', 'latte', 'americano', 'cortado',
          'chardonnay', 'pinot noir', 'sauvignon blanc',
          'ipa', 'pilsner', 'stout'
        ]
        
        // Check for specific items not in menu
        for (const specificItem of specificItems) {
          if (textLower.includes(specificItem)) {
            // Check if this specific item is in the menu
            const inMenu = menuItems.some(m => m.toLowerCase().includes(specificItem))
            if (!inMenu) {
              errors.push(
                `Idea ${i + 1} is non-menu but mentions specific item "${specificItem}" not in MENU ITEMS. Use generic terms or add to menu.`
              )
              break
            }
          }
        }
        
        // Check generic terms against capabilities
        for (const { term, capability, isGeneric } of genericTermsAllowed) {
          if (term.test(text)) {
            // For generic terms (kaffe/te), allow by default for cafés/restaurants
            // Only require explicit signal for specific terms (cocktails, wine, beer)
            if (isGeneric) {
              // Generic terms allowed by default - skip validation
              continue
            }
            
            // Specific terms require capability signal
            if (!capabilities.has(capability)) {
              errors.push(
                `Idea ${i + 1} is non-menu and mentions "${capability}" but business capability not signaled. Either add to KEYWORDS/SERVICES section or use menu-based idea.`
              )
              break
            }
          }
        }
      } else {
        const resolved = resolveMenuItemUsed(usedRaw)
        if (!resolved.ok || !resolved.resolved) {
          errors.push(`Idea ${i + 1} menuItemUsed not in MENU ITEMS list.`)
          if (resolved.error && resolved.error !== 'not_found') {
            errors.push(`Idea ${i + 1} menuItemUsed is ${resolved.error}.`) 
          }
          continue
        }

        usedMenuItems.push(resolved.resolved)
        // Strip category suffix for text validation: "DISH (CATEGORY)" -> "DISH"
        const dishNameOnly = normalizeMenuLineToDish(resolved.resolved)

        // Some dish names themselves end with a qualifier in parentheses, e.g. "BØRNEMENU (max. 12 år)".
        // Allow the post text to include either the full dish name or the base name without the trailing qualifier.
        const baseDishName = normalizeMenuLineToDish(dishNameOnly)

        const includesFull = dishNameOnly ? text.includes(dishNameOnly) : false
        const includesBase = baseDishName && baseDishName !== dishNameOnly ? text.includes(baseDishName) : false

        if (!includesFull && !includesBase) {
          errors.push(`Idea ${i + 1} text does not include dish name "${dishNameOnly}".`)
        }
      }
    }
  }

  // Booking URL enforcement (only if provided in the prompt)
  if (bookingUrl) {
    const texts = ideas.map((idea) => String(idea?.text || ''))
    const urlRe = new RegExp(`(^|\\n)${escapeRegExp(bookingUrl)}(\\n|$)`)
    const hasBookingUrlOnOwnLine = texts.some((t) => urlRe.test(t))
    if (!hasBookingUrlOnOwnLine) {
      errors.push('Booking URL missing: at least 1 idea must include the booking URL on its own line.')
    }
  }

  if (hasMenu && usedMenuItems.length === 0) {
    errors.push('If MENU ITEMS are provided: at least 1 idea must be menu-based (menuItemUsed must be an exact item from the list).')
  }

  if (hasMenu && usedMenuItems.length > 1) {
    const occurrences = new Map<string, number[]>()
    usedMenuItems.forEach((used, index) => {
      const arr = occurrences.get(used) || []
      arr.push(index + 1)
      occurrences.set(used, arr)
    })

    for (const [used, indices] of occurrences.entries()) {
      if (indices.length > 1) {
        errors.push(`menuItemUsed must be different across all 3 ideas. "${used}" repeated in ideas ${indices.join(' and ')}.`)
      }
    }
  }

  if (toneAnchors.length > 0) {
    const texts = ideas.map((idea) => String(idea?.text || ''))
    const hasAnyAnchor = toneAnchors.some((anchor) => texts.some((t) => t.includes(anchor)))
    if (!hasAnyAnchor) {
      errors.push(`Tone anchors missing: at least one idea must include one of these exact phrases: ${toneAnchors.join(' | ')}`)
    }
  }

  // Guard rails against overly hypey output
  errors.push(...validateToneConstraints(ideas))
  
  // Enforce no demographic/persona words (familier, par, etc.)
  errors.push(...validateNoPersonas(ideas))
  
  // Enforce menu/daypart appropriateness (lunch items at lunch time, etc.)
  errors.push(...validateMenuDaypartMatch(ideas, menuItems))
  
  // Enforce menu label → context appropriateness (BRUNCH not in dinner, KIDS needs family context, etc.)
  errors.push(...validateMenuContext(ideas, menuItems))

  return errors
}

function stripTrailingParenSuffix(value: string): string {
  return String(value || '').replace(/\s*\([^)]+\)\s*$/, '').trim()
}

function extractMenuCategory(menuLine: string): string | null {
  const match = /\(([^)]+)\)\s*$/.exec(menuLine)
  if (!match) return null
  return match[1].trim().toUpperCase()
}

function isDaypartMenuItem(menuLine: string, daypart: 'morning' | 'lunch' | 'dinner' | 'late'): boolean {
  const cat = extractMenuCategory(menuLine)
  if (!cat) return true // No category = works anytime
  
  const morningCats = ['MORGENMAD', 'BREAKFAST', 'BRUNCH']
  const lunchCats = ['FROKOST', 'LUNCH']
  const dinnerCats = ['MIDDAG', 'DINNER', 'AFTEN', 'EVENING']
  const lateCats = ['COCKTAILS', 'DRINKS', 'BAR']
  
  if (daypart === 'morning') return morningCats.some(c => cat.includes(c))
  if (daypart === 'lunch') return lunchCats.some(c => cat.includes(c))
  if (daypart === 'dinner') return dinnerCats.some(c => cat.includes(c))
  if (daypart === 'late') return lateCats.some(c => cat.includes(c))
  return true
}

function isKidsMenuItem(menuLine: string): boolean {
  const cat = extractMenuCategory(menuLine)
  if (!cat) return false
  return /BØRNE|BARN|KIDS|CHILD/i.test(cat)
}

function inferDaypartFromTime(bestTimeToPost: string): 'morning' | 'lunch' | 'dinner' | 'late' | null {
  const lower = bestTimeToPost.toLowerCase()
  if (/\b([0-6]|7|8|9|10|11)[:.-]|morgen|morning|brunch/i.test(lower)) return 'morning'
  if (/\b(11|12|13|14|15)[:.-]|frokost|lunch|middag\s+tid/i.test(lower)) return 'lunch'
  if (/\b(17|18|19|20|21)[:.-]|aften|dinner|evening/i.test(lower)) return 'dinner'
  if (/\b(21|22|23|0)[:.-]|nat|late|cocktail/i.test(lower)) return 'late'
  return null
}

type Daypart = 'morning' | 'lunch' | 'evening' | 'unknown'

function detectDaypart(text: string, bestTimeToPost: string): Daypart {
  const combinedContext = `${text} ${bestTimeToPost}`.toLowerCase()
  
  // Time-based detection (primary signal)
  const timeMatch = bestTimeToPost.match(/\b(\d{1,2})[:.-]\d{2}/i)
  if (timeMatch) {
    const hour = parseInt(timeMatch[1], 10)
    if (hour >= 7 && hour <= 10) return 'morning'
    if (hour >= 11 && hour <= 15) return 'lunch'
    if (hour >= 17 && hour <= 22) return 'evening'
  }
  
  // Text-based detection (secondary signal)
  const morningSignals = /\b(morgen|morgenmad|breakfast|brunch|formiddag|morning)\b/i
  const lunchSignals = /\b(frokost|lunch|middag.*tid)\b/i
  const eveningSignals = /\b(aften|middag(?!.*tid)|dinner|evening|cocktail|drink|bar)\b/i
  
  if (morningSignals.test(combinedContext)) return 'morning'
  if (lunchSignals.test(combinedContext)) return 'lunch'
  if (eveningSignals.test(combinedContext)) return 'evening'
  
  return 'unknown'
}

function ensureBookingUrlOnOwnLine(ideas: any[], bookingUrl?: string): any[] {
  if (!bookingUrl) return ideas
  if (!Array.isArray(ideas) || ideas.length === 0) return ideas

  const urlRe = new RegExp(`(^|\\n)${escapeRegExp(bookingUrl)}(\\n|$)`)
  const hasAlready = ideas.some((idea) => urlRe.test(String(idea?.text || '')))
  if (hasAlready) return ideas

  const patched = ideas.map((i) => ({ ...i }))
  const targetIndex = 0
  const existingText = String(patched[targetIndex]?.text || '').trimEnd()

  // Remove emoji - will be brand-driven in future based on emoji_usage setting
  patched[targetIndex] = {
    ...patched[targetIndex],
    text: `${existingText}\n\nBook bord her:\n${bookingUrl}`.trim(),
  }

  return patched
}
function repairInvalidMenuItemUsed(ideas: any[], menuItems: string[]): any[] {
  if (menuItems.length === 0) return ideas

  const normalizeMenuLineToDish = (line: string): string => {
    return String(line || '').replace(/\s*\([^)]+\)\s*$/, '').trim()
  }

  const repaired = ideas.map((idea) => ({ ...idea }))
  let changesMade = false

  for (let i = 0; i < repaired.length; i++) {
    const idea = repaired[i]
    const menuItemUsed = String(idea?.menuItemUsed || '').trim()
    if (!menuItemUsed) continue // Non-menu idea, skip

    const text = String(idea?.text || '').toLowerCase()

    // Check if exact match exists
    if (menuItems.includes(menuItemUsed)) {
      // Verify text includes this dish name
      const dishName = normalizeMenuLineToDish(menuItemUsed).toLowerCase()
      if (!text.includes(dishName)) {
        console.warn(`⚠️ Text doesn't mention "${dishName}" (from menuItemUsed "${menuItemUsed}"), converting to non-menu idea`)
        repaired[i].menuItemUsed = ''
        changesMade = true
      }
      continue
    }

    // Check if base name (without category) matches uniquely
    const usedBase = normalizeMenuLineToDish(menuItemUsed)
    const matches = menuItems.filter((m) => normalizeMenuLineToDish(m) === usedBase)
    if (matches.length === 1) {
      // Verify text includes this dish name before correcting
      const dishName = normalizeMenuLineToDish(matches[0]).toLowerCase()
      if (text.includes(dishName)) {
        repaired[i].menuItemUsed = matches[0]
        changesMade = true
        console.log(`🔧 Auto-corrected menuItemUsed: "${menuItemUsed}" → "${matches[0]}"`)
      } else {
        console.warn(`⚠️ Text doesn't mention "${dishName}", converting to non-menu idea`)
        repaired[i].menuItemUsed = ''
        changesMade = true
      }
      continue
    }

    // Try fuzzy matching: find menu item that contains the used value
    const fuzzyMatches = menuItems.filter((m) => {
      const dishName = normalizeMenuLineToDish(m).toLowerCase()
      return dishName.includes(menuItemUsed.toLowerCase())
    })

    if (fuzzyMatches.length === 1) {
      // Verify text includes this dish name
      const dishName = normalizeMenuLineToDish(fuzzyMatches[0]).toLowerCase()
      if (text.includes(dishName)) {
        repaired[i].menuItemUsed = fuzzyMatches[0]
        changesMade = true
        console.log(`🔧 Fuzzy-matched menuItemUsed: "${menuItemUsed}" → "${fuzzyMatches[0]}"`)
      } else {
        console.warn(`⚠️ Text doesn't mention "${dishName}", converting to non-menu idea`)
        repaired[i].menuItemUsed = ''
        changesMade = true
      }
      continue
    }

    // Try reverse: menu item name contained in the used value
    const reverseMatches = menuItems.filter((m) => {
      const dishName = normalizeMenuLineToDish(m).toLowerCase()
      return menuItemUsed.toLowerCase().includes(dishName)
    })

    if (reverseMatches.length === 1) {
      // Verify text includes this dish name
      const dishName = normalizeMenuLineToDish(reverseMatches[0]).toLowerCase()
      if (text.includes(dishName)) {
        repaired[i].menuItemUsed = reverseMatches[0]
        changesMade = true
        console.log(`🔧 Reverse-matched menuItemUsed: "${menuItemUsed}" → "${reverseMatches[0]}"`)
      } else {
        console.warn(`⚠️ Text doesn't mention "${dishName}", converting to non-menu idea`)
        repaired[i].menuItemUsed = ''
        changesMade = true
      }
      continue
    }

    // Last resort: clear invalid menuItemUsed and convert to non-menu idea
    console.warn(`⚠️ Could not match menuItemUsed "${menuItemUsed}" to any menu item, converting to non-menu idea`)
    repaired[i].menuItemUsed = ''
    changesMade = true
  }

  return changesMade ? repaired : ideas
}

function repairPersonaViolations(ideas: any[]): any[] {
  const bannedPersonas = [
    'familier', 'børnefamilier', 'par', 'venner',
    'turister', 'studerende', 'lokale', 'unge', 'seniorer',
    'families', 'couples', 'friends', 'tourists', 'students', 'locals'
  ]

  const repaired = ideas.map((idea) => ({ ...idea }))
  let changesMade = false

  for (let i = 0; i < repaired.length; i++) {
    const idea = repaired[i]
    let text = String(idea?.text || '')
    let headline = String(idea?.headline || '')
    let photoSuggestion = String(idea?.photoSuggestion || '')

    // Remove persona words with word boundaries to avoid partial matches
    for (const word of bannedPersonas) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi')
      const textBefore = text
      const headlineBefore = headline
      const photoSuggestionBefore = photoSuggestion

      text = text.replace(regex, '')
      headline = headline.replace(regex, '')
      photoSuggestion = photoSuggestion.replace(regex, '')

      if (text !== textBefore || headline !== headlineBefore || photoSuggestion !== photoSuggestionBefore) {
        changesMade = true
        console.log(`🔧 Removed banned persona word "${word}" from idea ${i + 1}`)
      }
    }

    // Clean up extra spaces from removal
    text = text.replace(/\s{2,}/g, ' ').replace(/\s+([.,!?])/g, '$1').trim()
    headline = headline.replace(/\s{2,}/g, ' ').trim()
    photoSuggestion = photoSuggestion.replace(/\s{2,}/g, ' ').trim()

    repaired[i].text = text
    repaired[i].headline = headline
    repaired[i].photoSuggestion = photoSuggestion
  }

  return changesMade ? repaired : ideas
}

function repairMenuDaypartMismatches(ideas: any[], menuItems: string[]): any[] {
  if (menuItems.length === 0) return ideas

  const repaired = ideas.map((idea) => ({ ...idea }))
  let changesMade = false

  for (let i = 0; i < repaired.length; i++) {
    const idea = repaired[i]
    const menuItemUsed = String(idea?.menuItemUsed || '').trim()
    if (!menuItemUsed) continue

    const bestTime = String(idea?.bestTimeToPost || '').trim()
    const daypart = inferDaypartFromTime(bestTime)
    if (!daypart) continue

    const menuLine = menuItems.find(m => m.includes(menuItemUsed))
    if (!menuLine) continue

    // If daypart mismatch, try to fix by adjusting bestTimeToPost
    if (!isDaypartMenuItem(menuLine, daypart)) {
      const cat = extractMenuCategory(menuLine)
      if (!cat) continue

      // Suggest better time based on category
      let suggestedTime = bestTime
      if (/MORGENMAD|BREAKFAST|BRUNCH/i.test(cat)) {
        suggestedTime = bestTime.replace(/\d{1,2}[:.]\d{2}[-–]\d{1,2}[:.]\d{2}/, '10:00–12:00')
      } else if (/FROKOST|LUNCH/i.test(cat)) {
        suggestedTime = bestTime.replace(/\d{1,2}[:.]\d{2}[-–]\d{1,2}[:.]\d{2}/, '12:00–14:00')
      } else if (/MIDDAG|DINNER|AFTEN/i.test(cat)) {
        suggestedTime = bestTime.replace(/\d{1,2}[:.]\d{2}[-–]\d{1,2}[:.]\d{2}/, '18:00–20:00')
      } else if (/COCKTAIL|DRINK|BAR/i.test(cat)) {
        suggestedTime = bestTime.replace(/\d{1,2}[:.]\d{2}[-–]\d{1,2}[:.]\d{2}/, '20:00–22:00')
      }

      if (suggestedTime !== bestTime) {
        repaired[i].bestTimeToPost = suggestedTime
        changesMade = true
        console.log(`🔧 Repaired daypart mismatch: "${menuItemUsed}" (${cat}) → ${suggestedTime}`)
      }
    }
  }

  return changesMade ? repaired : ideas
}
serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 🔐 SERVER-SIDE AUTHENTICATION & QUOTA CHECK
    const authHeader = req.headers.get('authorization')
    const userId = getUserIdFromAuth(authHeader)
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - valid token required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check daily quota
    const dailyQuota = await getUserQuota(userId, 'aiGenerations', 'daily')
    if (!dailyQuota.allowed) {
      const isNoBusiness = dailyQuota.reason?.toLowerCase().includes('no business')
      const status = isNoBusiness ? 404 : 429

      return new Response(
        JSON.stringify({ 
          error: isNoBusiness ? 'Business not found' : 'Daily quota exceeded',
          tier: dailyQuota.tier,
          current: dailyQuota.current,
          limit: dailyQuota.limit,
          message: dailyQuota.reason
        }),
        { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check monthly quota
    const monthlyQuota = await getUserQuota(userId, 'aiGenerations', 'monthly')
    if (!monthlyQuota.allowed) {
      return new Response(
        JSON.stringify({ 
          error: 'Monthly quota exceeded',
          tier: monthlyQuota.tier,
          current: monthlyQuota.current,
          limit: monthlyQuota.limit,
          message: monthlyQuota.reason
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get request data
    const requestBody = await req.json()
    const { 
      // New AI Ideas mode (prompt-based)
      prompt,
      mode,
      count = 3,
      // Legacy mode (topic-based)
      topic, 
      businessType, 
      platforms,
      includeEmojis = true,
      includeHashtags = true,
      includeCTA = true,
      tone = 'objective',
      length = 'medium',
      userTier = dailyQuota.tier // Use tier from database, not client
    } = requestBody

    // Determine which mode we're in
    // Robustness: if a non-empty prompt is provided, default to AI Ideas mode
    // (some clients/scripts may omit "mode" during development).
    const hasPrompt = typeof prompt === 'string' && prompt.trim().length > 0
    const isAiIdeasMode = hasPrompt && (mode === 'ai-ideas' || mode === 'aiIdeas' || mode === 'ai_ideas' || mode == null)

    // Validate input based on mode
    if (isAiIdeasMode) {
      if (!hasPrompt) {
        return new Response(
          JSON.stringify({ error: 'Missing required field: prompt' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else {
      if (!topic || !businessType || !platforms) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: topic, businessType, platforms' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Get AI model based on tier
    const aiModel = getAIModelForTier(userTier)
    console.log('🤖 Using AI model:', aiModel, '(tier:', userTier || 'free', ')', 'mode:', isAiIdeasMode ? 'ai-ideas' : 'legacy')

    let openaiMessages: any[]
    let menuItems: string[] = []
    let toneAnchors: string[] = []
    let bookingUrl: string = ''

    if (isAiIdeasMode) {
      const promptLang = extractPromptLanguageFromPrompt(prompt)
      
      // Extract data for validation and analysis
      menuItems = extractMenuItemsFromPrompt(prompt)
      toneAnchors = extractToneAnchorsFromPrompt(prompt)
      bookingUrl = extractBookingUrlFromPrompt(prompt)
      
      console.log('📋 Extracted menu items from prompt:', menuItems.length, 'items')
      if (menuItems.length > 0) {
        console.log('📋 First 5 menu items:', menuItems.slice(0, 5))
      } else {
        console.warn('⚠️ No menu items found in prompt - AI will generate generic ideas')
      }
      if (toneAnchors.length > 0) {
        console.log('🗣️ Extracted tone anchors from prompt:', toneAnchors.length)
        console.log('🗣️ Tone anchors:', toneAnchors)
      }
      if (bookingUrl) {
        console.log('🔗 Extracted booking URL from prompt')
      }
      
      // Analyze menu categories to guide AI generation strategy
      let menuCategoryGuidance = ''
      if (menuItems.length > 0) {
        const categories = {
          morning: menuItems.filter(item => /MORGENMAD|BREAKFAST|BRUNCH/i.test(item)).length,
          lunch: menuItems.filter(item => /FROKOST|LUNCH/i.test(item)).length,
          dinner: menuItems.filter(item => /MIDDAG|DINNER|AFTEN|EVENING/i.test(item)).length,
          cocktail: menuItems.filter(item => /COCKTAIL|BAR|DRINKS/i.test(item)).length,
          kids: menuItems.filter(item => /BØRNE|BARN|KIDS|CHILD/i.test(item)).length
        }
        
        console.log('📊 Menu category distribution:', categories)
        
        // Generate guidance based on what's actually available
        const available: string[] = []
        if (categories.morning > 0) available.push('breakfast/brunch')
        if (categories.lunch > 0) available.push('lunch')
        if (categories.dinner > 0) available.push('dinner/evening')
        if (categories.cocktail > 0) available.push('cocktails/bar')
        if (categories.kids > 0) available.push('kids menu')
        
        if (available.length > 0) {
          menuCategoryGuidance = `\n\nIMPORTANT MENU CONSTRAINT: Available menu categories are: ${available.join(', ')}. Write content and timing appropriate for these categories ONLY. Do NOT mention unavailable meal times.`
        }
        
        // Specific guidance when only one category exists (critical for avoiding mismatches)
        if (categories.lunch > 0 && categories.dinner === 0 && categories.morning === 0) {
          menuCategoryGuidance += '\nMenu is LUNCH-ONLY (FROKOST). Use lunch-time language (frokost, middag, lunchtime) and times 11:00-15:00. NEVER use evening/dinner/aften language.'
        } else if (categories.dinner > 0 && categories.lunch === 0 && categories.morning === 0) {
          menuCategoryGuidance += '\nMenu is DINNER-ONLY. Use evening language (aften, middag, dinner time) and times 17:00-22:00.'
        } else if (categories.morning > 0 && categories.lunch === 0 && categories.dinner === 0) {
          menuCategoryGuidance += '\nMenu is BREAKFAST/BRUNCH-ONLY. Use morning language (morgenmad, brunch, morning time) and times 07:00-11:00.'
        }
      }
      
      // AI Ideas mode: Use the pre-built prompt from frontend with menu guidance
      openaiMessages = [
        {
          role: 'system',
          content: getIdeasSystemPrompt(promptLang) + menuCategoryGuidance
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    } else {
      // Legacy mode: Build prompt from topic/businessType
      console.log('Generating content for:', { topic, businessType, platforms, includeEmojis, includeHashtags, includeCTA })

      // Build platform-specific instructions
      const platformInstructions = platforms.map((platform: string) => {
        if (platform === 'instagram') {
          return `- Instagram: 50-125 characters, ${includeEmojis ? '5-8 emojis' : 'no emojis'}, ${includeHashtags ? '10-15 hashtags' : 'no hashtags'}`
        } else if (platform === 'facebook') {
          return `- Facebook: 150-250 characters, ${includeEmojis ? '2-3 emojis' : 'no emojis'}, ${includeHashtags ? '2-3 hashtags' : 'no hashtags'}`
        }
        return ''
      }).join('\n')

      // Tone mapping
      const toneDescriptions: Record<string, string> = {
        'objective': 'Objective, neutral, and informative',
        'warm': 'Warm, welcoming, and friendly',
        'passionate': 'Passionate, enthusiastic, and energetic'
      }

      openaiMessages = [
        {
          role: 'system',
          content: `You are a professional social media copywriter for Danish small businesses. You write in a ${toneDescriptions[tone] || toneDescriptions['objective']} tone. You create engaging posts optimized for each platform.`
        },
        {
          role: 'user',
          content: `Create ONE social media post about: ${topic}

Business type: ${businessType}
Target platforms: ${platforms.join(', ')}
Tone: ${toneDescriptions[tone] || toneDescriptions['objective']}

Platform-specific requirements:
${platformInstructions}

Additional requirements:
- Write in Danish
${includeEmojis ? '- Include emojis as specified per platform' : '- DO NOT include any emojis'}
${includeHashtags ? '- Add hashtags as specified per platform' : '- DO NOT include any hashtags'}
${includeCTA ? '- Include a clear call-to-action' : '- No call-to-action needed'}

IMPORTANT: Create separate optimized versions for each platform.

Return ONLY valid JSON in this exact format:
{
  "variations": [
    {
      "id": 1,
      "platform": "facebook",
      "headline": "Engaging headline",
      "text": "Full post text optimized for Facebook (150-250 chars)",
      "hashtags": "${includeHashtags ? '#hashtag1 #hashtag2' : ''}",
      "cta": "${includeCTA ? 'Clear call to action' : ''}",
      "tone": "${tone}"
    },
    {
      "id": 2,
      "platform": "instagram", 
      "headline": "Catchy headline",
      "text": "Shorter post text for Instagram (50-125 chars)",
      "hashtags": "${includeHashtags ? '#hashtag1 #hashtag2 ... (10-15 hashtags)' : ''}",
      "cta": "${includeCTA ? 'Clear call to action' : ''}",
      "tone": "${tone}"
    }
  ]
}

Only include variations for the selected platforms: ${platforms.join(', ')}`
        }
      ]
    }

    const aiIdeasResponseFormat = {
      type: 'json_schema',
      json_schema: {
        name: 'ai_ideas_response',
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['ideas'],
          properties: {
            ideas: {
              type: 'array',
              minItems: 3,
              maxItems: 3,
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['id', 'title', 'headline', 'text', 'photoSuggestion', 'menuItemUsed', 'occasionUsed', 'bestTimeToPost', 'impact'],
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' },
                  headline: { type: 'string' },
                  text: { type: 'string' },
                  photoSuggestion: { type: 'string' },
                  menuItemUsed: { type: 'string' },
                  occasionUsed: { type: 'string' },
                  bestTimeToPost: { type: 'string' },
                  impact: { type: 'string', enum: ['low', 'medium', 'high'] }
                }
              }
            }
          }
        },
        strict: true
      }
    }

    const responseFormat = isAiIdeasMode ? aiIdeasResponseFormat : { type: 'json_object' }

    let lastErrors: string[] = []
    let lastIdeas: any[] | null = null

    for (let attempt = 1; attempt <= 2; attempt++) {
      const messages = JSON.parse(JSON.stringify(openaiMessages))

      if (attempt === 2 && lastErrors.length > 0) {
        const menuListForRetry = menuItems.length > 0
          ? `\n\nMENU ITEMS (copy exactly from this list, one per line):\n${menuItems.slice(0, 30).map((m) => `- ${m}`).join('\n')}`
          : ''

        messages.push({
          role: 'user',
          content: `Previous output violated these rules: ${lastErrors.join(' | ')}. Fix ONLY the violating parts. Keep the same JSON shape.

Required for each idea: bestTimeToPost (short, single-line) and impact (low|medium|high).

If MENU ITEMS are provided:
- You MUST produce at least 1 menu-based idea: menuItemUsed MUST be a non-empty string for at least one idea.
- menuItemUsed MUST match the MENU ITEMS list (exact line), OR you may use the dish name without the trailing "(CATEGORY)" suffix only if it maps uniquely to exactly one menu item.
- The post text MUST include the dish name (without category suffix, e.g. "DISH (CATEGORY)" -> include "DISH" in text).
- Do NOT leave menuItemUsed empty in all 3 ideas.
${menuListForRetry}

If TONE ANCHORS are provided: ensure at least one idea includes one of the exact phrases.

If a BOOKING URL is provided in the prompt: at least 1 idea must include that URL on its own line.

Return ONLY valid JSON.`
        })
      }

      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: aiModel,
          messages,
          temperature: isAiIdeasMode ? 0.3 : 0.8,
          max_tokens: isAiIdeasMode ? 1200 : 2000,
          response_format: responseFormat
        })
      })

      if (!openaiResponse.ok) {
        const error = await openaiResponse.text()
        console.error('OpenAI API error:', error)
        return new Response(
          JSON.stringify({ error: 'OpenAI API request failed' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const data = await openaiResponse.json()
      const content = data.choices[0].message.content

      console.log('OpenAI response received, content:', content.substring(0, 500))

      // Parse the response
      const parsedContent = JSON.parse(content)
      console.log('Parsed content keys:', Object.keys(parsedContent))

      // AI Ideas validation
      if (isAiIdeasMode) {
        let ideas: any[]

        if (Array.isArray(parsedContent)) {
          ideas = parsedContent
        } else if (parsedContent.ideas && Array.isArray(parsedContent.ideas)) {
          ideas = parsedContent.ideas
        } else {
          // Single idea wrapped in object
          ideas = [parsedContent]
        }

        lastIdeas = ideas
        // Deterministic repairs before validation
        ideas = ensureBookingUrlOnOwnLine(ideas, bookingUrl)
        ideas = repairInvalidMenuItemUsed(ideas, menuItems)
        ideas = repairPersonaViolations(ideas)
        ideas = repairMenuDaypartMismatches(ideas, menuItems)
        lastIdeas = ideas

        const hardConstraints = extractHardConstraintsFromPrompt(prompt)
        const capabilitySignals = extractCapabilitySignals(prompt)
        const errors = validateIdeas(ideas, menuItems, toneAnchors, bookingUrl, capabilitySignals)
        errors.push(...validateHardConstraints(ideas, hardConstraints))
        if (errors.length === 0) {
          // ✅ INCREMENT USAGE AFTER SUCCESSFUL GENERATION
          await incrementQuota(userId, 'aiGenerations')
          console.log(`✅ AI generation complete for user ${userId} (tier: ${userTier})`)

          console.log(`Returning ${ideas.length} ideas, first idea keys:`, ideas[0] ? Object.keys(ideas[0]) : 'none')
          return new Response(
            JSON.stringify({ ideas }),
            { 
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          )
        }

        lastErrors = errors
        console.warn('Validation failed, attempt', attempt, 'errors:', errors)
        continue
      }

      // Legacy mode: return on first successful parse
      // ✅ INCREMENT USAGE AFTER SUCCESSFUL GENERATION
      await incrementQuota(userId, 'aiGenerations')
      console.log(`✅ AI generation complete for user ${userId} (tier: ${userTier})`)

      return new Response(
        JSON.stringify(parsedContent),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // --- Targeted repair pass (best-effort) ---
    // Some models still choose to output all ideas as non-menu (menuItemUsed="") even with clear instructions.
    // When that happens, do one more pass that edits the last JSON as little as possible.
    if (isAiIdeasMode && lastIdeas && lastErrors.length > 0) {
      const needsMenuBasedIdea = lastErrors.some((e) => e.includes('at least 1 idea must be menu-based'))
      const needsExclamationFix = lastErrors.some((e) => e.includes('exclamation mark'))
      const needsBookingUrlFix = lastErrors.some((e) => e.includes('Booking URL missing'))
      const needsHardConstraintFix = lastErrors.some((e) => e.includes('forbidden term'))
      const hardConstraints = extractHardConstraintsFromPrompt(prompt)

      if (needsMenuBasedIdea || needsExclamationFix || needsBookingUrlFix || needsHardConstraintFix) {
        // Intelligently select forced menu item based on category
        // CRITICAL: If lastIdeas contains text/category mismatches, don't force incompatible items
        let forcedMenuItem = ''
        let forcedMenuCategory = ''
        
        if (needsMenuBasedIdea && menuItems.length > 0) {
          // Analyze existing ideas to detect context preference
          let hasEveningText = false
          let hasMorningText = false
          let hasLunchText = false
          
          if (lastIdeas && lastIdeas.length > 0) {
            for (const idea of lastIdeas) {
              const text = String(idea?.text || '').toLowerCase()
              if (/\b(aften|middag|dinner|evening)\b/i.test(text)) hasEveningText = true
              if (/\b(brunch|morgen|morgenmad|breakfast|formiddag|morning)\b/i.test(text)) hasMorningText = true
              if (/\b(frokost|lunch)\b/i.test(text)) hasLunchText = true
            }
          }
          
          // Smart selection: Match available menu categories to detected text context
          // Priority: Match context > Prefer lunch > Fallback to any
          
          // If AI wants evening content but only lunch items exist → SKIP forcing, let it be non-menu
          if (hasEveningText && !hasMorningText && !hasLunchText) {
            const dinnerItems = menuItems.filter(item => {
              const cat = extractMenuCategory(item)
              return cat && /MIDDAG|DINNER|AFTEN|EVENING|COCKTAIL|DRINK|BAR/i.test(cat)
            })
            
            if (dinnerItems.length === 0) {
              // No dinner items available - don't force incompatible lunch items
              console.warn('⚠️ AI wants evening content but only lunch menu exists - skipping forced menu item')
              forcedMenuItem = '' // Skip forcing
            } else {
              forcedMenuItem = dinnerItems[0]
              forcedMenuCategory = 'dinner'
            }
          } else if (hasMorningText && !hasEveningText && !hasLunchText) {
            // AI wants morning content - prefer brunch items
            const brunchItems = menuItems.filter(item => {
              const cat = extractMenuCategory(item)
              return cat && /BRUNCH|MORGENMAD|BREAKFAST/i.test(cat)
            })
            
            if (brunchItems.length === 0) {
              console.warn('⚠️ AI wants morning content but no brunch items exist - skipping forced menu item')
              forcedMenuItem = ''
            } else {
              forcedMenuItem = brunchItems[0]
              forcedMenuCategory = 'brunch'
            }
          } else {
            // Default: Prefer FROKOST/LUNCH items (safe default for most contexts)
            const lunchItems = menuItems.filter(item => {
              const cat = extractMenuCategory(item)
              return cat && /FROKOST|LUNCH/i.test(cat)
            })
            
            if (lunchItems.length > 0) {
              forcedMenuItem = lunchItems[0]
              forcedMenuCategory = 'lunch'
            } else {
              // Fallback: Use first available item
              forcedMenuItem = menuItems[0]
              const cat = extractMenuCategory(forcedMenuItem)
              if (cat && /MIDDAG|DINNER|AFTEN/i.test(cat)) {
                forcedMenuCategory = 'dinner'
              } else if (cat && /BRUNCH|MORGENMAD/i.test(cat)) {
                forcedMenuCategory = 'brunch'
              } else if (cat && /COCKTAIL|DRINK|BAR/i.test(cat)) {
                forcedMenuCategory = 'evening'
              } else {
                forcedMenuCategory = 'generic'
              }
            }
          }
        }
        
        const forcedDishName = forcedMenuItem ? stripTrailingParenSuffix(forcedMenuItem) : ''
        const promptLang = extractPromptLanguageFromPrompt(prompt)

        // Build context-aware instructions based on forced item's category
        let forcedMenuFixLines = ''
        if (needsMenuBasedIdea && forcedMenuItem) {
          forcedMenuFixLines = `- Idea 1 MUST be menu-based: set ideas[0].menuItemUsed to exactly this string: "${forcedMenuItem}".
- Ensure ideas[0].text includes the dish name "${forcedDishName}" (WITHOUT any trailing category like "(BRUNCH)").`
          
          // Add daypart-specific text adjustment instructions
          if (forcedMenuCategory === 'brunch') {
            forcedMenuFixLines += `
- BRUNCH item forced: Adjust ideas[0].text to match morning/brunch context:
  * Include words like "brunch", "morgen", "formiddag", or "morgenmad"
  * Remove evening words like "aften", "cocktail", "middag" if present
  * Adjust ideas[0].bestTimeToPost to morning/brunch time (e.g., "Lørdag 10:00–12:00")`
          } else if (forcedMenuCategory === 'lunch') {
            forcedMenuFixLines += `
- FROKOST item forced: Adjust ideas[0].text to match lunch context:
  * Include words like "frokost", "lunch", "middag" (daytime)
  * Remove morning words like "start din dag", "brunch", "morgen" if present
  * Remove evening words like "aften", "dinner", "evening" if present
  * Adjust ideas[0].bestTimeToPost to lunch time (e.g., "Torsdag 12:00–14:00")`
          } else if (forcedMenuCategory === 'dinner') {
            forcedMenuFixLines += `
- DINNER item forced: Adjust ideas[0].text to match evening context:
  * Include words like "aften", "aftensmad", "middag", "dinner"
  * Remove morning/lunch words if present
  * Adjust ideas[0].bestTimeToPost to dinner time (e.g., "Fredag 18:00–20:00")`
          }
        } else if (needsMenuBasedIdea && !forcedMenuItem) {
          // No compatible menu item found - instruct AI to write generic content
          forcedMenuFixLines = `- IMPORTANT: Available menu items don't match your text context (e.g., you wrote evening text but only lunch items exist).
- Convert ALL ideas to non-menu ideas: set menuItemUsed="" for all ideas.
- Write generic content about the experience/atmosphere WITHOUT mentioning specific dishes.
- Focus on: location, ambiance, service, overall dining experience.`
        }

        const hardConstraintLines = hardConstraints.length > 0
          ? `- HARD CONSTRAINTS: Remove these exact forbidden terms wherever they appear: ${hardConstraints.map((t) => `"${t}"`).join(' | ')}`
          : ''

        const repairMessages = [
          {
            role: 'system',
            content: getIdeasSystemPrompt(promptLang)
          },
          {
            role: 'user',
            content: `You will be given JSON that failed validation. Edit it with minimal changes so it passes.

FAILED JSON:
${JSON.stringify({ ideas: lastIdeas }, null, 2)}

REQUIRED FIXES:
${forcedMenuFixLines}
- For EVERY idea: max ONE exclamation mark (!) in the text.
- For any NON-MENU idea (menuItemUsed=""): do NOT mention concrete dishes/drinks/products (e.g., kaffe/kakao) unless the exact term appears in MENU ITEMS. Prefer generic wording like "varm drik", "brunch", "frokost", "middag".
${hardConstraintLines}
${bookingUrl ? `- At least 1 idea MUST include this booking URL on its own line:\n${bookingUrl}` : ''}

Do NOT invent dishes. Do NOT change the JSON shape.
Return ONLY valid JSON: { "ideas": [ ... ] }`
          }
        ]

        const repairResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: aiModel,
            messages: repairMessages,
            temperature: 0.2,
            max_tokens: 1200,
            response_format: aiIdeasResponseFormat,
          })
        })

        if (repairResponse.ok) {
          const repairData = await repairResponse.json()
          const repairContent = repairData.choices?.[0]?.message?.content
          if (repairContent) {
            const repairedParsed = JSON.parse(repairContent)
            let repairedIdeas = Array.isArray(repairedParsed?.ideas) ? repairedParsed.ideas : lastIdeas
            repairedIdeas = ensureBookingUrlOnOwnLine(repairedIdeas, bookingUrl)

            const capabilitySignals = extractCapabilitySignals(prompt)
            const repairedErrors = validateIdeas(repairedIdeas, menuItems, toneAnchors, bookingUrl, capabilitySignals)
            repairedErrors.push(...validateHardConstraints(repairedIdeas, hardConstraints))
            if (repairedErrors.length === 0) {
              await incrementQuota(userId, 'aiGenerations')
              console.log(`✅ AI generation repaired for user ${userId} (tier: ${userTier})`)
              return new Response(
                JSON.stringify({ ideas: repairedIdeas }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              )
            }

            lastErrors = repairedErrors
            lastIdeas = repairedIdeas
          }
        }
      }
    }

    // Strict enforcement: No soft fallback - reject if validation fails
    console.error('❌ Strict validation failed after 2 attempts:', lastErrors)
    return new Response(
      JSON.stringify({ error: 'AI output did not meet validation rules', details: lastErrors }),
      { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in ai-generate function:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
