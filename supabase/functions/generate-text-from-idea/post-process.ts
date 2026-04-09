// post-process.ts
// Text post-processing: spelling gate, keyword extraction, hashtag generation.

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
    if (cleaned.length > 2) return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
  }
  // Tier 2: parse the RET: prefix from contentBlock (menu post without a named item)
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
  if (matches(['bøf', 'brunch', 'frokost', 'aftensmad', 'morgenmad', 'burger', 'pizza', 'salat', 'sandwich', 'tapas', 'suppe', 'steak', 'kylling', 'laks', 'sushi', 'pasta'])) return 'food'
  if (matches(['kage', 'croissant', 'brød', 'kanelsnegl', 'wienerbrød', 'bolle', 'bageri', 'vaffel'])) return 'bakery'
  return 'neutral'
}

// ── generateHashtags ───────────────────────────────────────────────────────
export function generateHashtags(
  city: string,
  contentType: string,
  extractedKeyword?: string,
  businessName?: string
): { facebook: string[], instagram: string[] } {
  const isMenuPost = contentType === 'menu_item' || contentType === 'product_menu' || contentType === 'craving_visual'
  const cityTag = city.replace(/[\s\-]+/g, '')
  const brandTag = businessName?.replace(/[\s\-&\/]+/g, '') || ''

  // FACEBOOK: city + topic keyword (1-2 tags)
  const facebook = [cityTag, extractedKeyword].filter(Boolean) as string[]

  // INSTAGRAM: 3-5 hashtags, content-signal driven
  const domain = extractedKeyword ? getContentDomain(extractedKeyword) : 'neutral'

  const cityDomainTags: Record<string, Record<string, [string, string | undefined]>> = {
    Aarhus: {
      coffee:  ['AarhusC',        'KaffeAarhus'],
      drinks:  ['AarhusBar',      'DrinkAarhus'],
      food:    ['SpisIAarhus',    'AarhusMad'],
      bakery:  ['BageriAarhus',   'HjemmebagAarhus'],
      neutral: ['AarhusC',        undefined],
    },
    København: {
      coffee:  ['KøbenhavnC',      'KaffeKøbenhavn'],
      drinks:  ['KBHBar',          'DrinkKøbenhavn'],
      food:    ['SpisIKøbenhavn',  'KøbenhavnMad'],
      bakery:  ['BageriKøbenhavn', 'HjemmebagKBH'],
      neutral: ['KøbenhavnC',      'KBH'],
    },
    Odense: {
      coffee:  ['OdenseC',        'KaffeOdense'],
      drinks:  ['OdenseBar',      'DrinkOdense'],
      food:    ['SpisIOdense',    'OdenseMad'],
      bakery:  ['BageriOdense',   'HjemmebagOdense'],
      neutral: ['OdenseC',        undefined],
    },
    Aalborg: {
      coffee:  ['AalborgC',       'KaffeAalborg'],
      drinks:  ['AalborgBar',     'DrinkAalborg'],
      food:    ['SpisIAalborg',   'AalborgMad'],
      bakery:  ['BageriAalborg',  'HjemmebagAalborg'],
      neutral: ['AalborgC',       undefined],
    },
  }

  const [primaryLocal, secondaryLocal] = cityDomainTags[city]?.[domain] ?? [cityTag, undefined]
  const instagram: string[] = [primaryLocal]

  if (isMenuPost) {
    if (extractedKeyword) instagram.push(extractedKeyword)
    if (secondaryLocal) instagram.push(secondaryLocal)
  } else {
    const vibeTags: Record<string, string> = {
      behind_scenes: 'BagKulisserne',
      seasonal:      'NyPåMenuen',
      atmosphere:    'Stemning',
    }
    instagram.push(vibeTags[contentType] ?? 'Stemning')
    if (secondaryLocal) instagram.push(secondaryLocal)
  }

  if (brandTag) instagram.push(brandTag)

  return {
    facebook,
    instagram: instagram.filter(Boolean).slice(0, 5)
  }
}
