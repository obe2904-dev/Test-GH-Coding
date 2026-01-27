/**
 * Prompt B - Brand Profile Generation
 * 
 * User-facing brand profile generation prompt.
 * Takes analysis from Prompt A and produces clean, usable content.
 */

import type { DataSources, LanguageConfig } from '../types.ts'
import { extractStructuredWebsiteData } from '../signal-extractor.ts'
import { buildMenuSummary, buildImagesSummary } from '../data-gatherer.ts'
import { detectWebsitePresence, logWebsitePresence } from '../website-presence.ts'
import { renderLocationPhrase, getLocationGuidance } from './prompt-builder.ts'

/**
 * Default banned words for Danish content.
 * These are generic marketing words that make AI output sound inauthentic.
 * Words may be ALLOWED if the business uses them 2+ times on their website (v4.8.9).
 */
export const DEFAULT_BANNED_WORDS_DA: string[] = [
  'hyggelig',
  'hyggeligt',
  'lækker',
  'lækkert',
  'lækre',
  'indbydende',
  'afslappet',
  'afslappede',
  'autentisk',
  'autentiske',
  'unik',
  'unikke',
  'fantastisk',
  'fantastiske',
  'vidunderlig',
  'vidunderlige',
  'charmerende'
]

/**
 * English equivalent (for future use)
 */
export const DEFAULT_BANNED_WORDS_EN: string[] = [
  'cozy',
  'delicious',
  'amazing',
  'unique',
  'authentic',
  'fantastic',
  'wonderful',
  'charming',
  'inviting'
]

/**
 * Aggregates all text content from website sources for banned word analysis.
 * Combines structured data, raw content, meta descriptions, etc.
 * 
 * v4.8.9 Task 2: Smart Banned Words
 * v4.9.0: Now uses detectWebsitePresence for comprehensive detection
 */
export function aggregateWebsiteText(dataSources: DataSources): string {
  const textParts: string[] = []
  
  // v4.9.0: Use comprehensive website presence detection
  const presence = detectWebsitePresence(dataSources)
  logWebsitePresence(presence, dataSources.business?.name || 'Unknown')
  
  if (!presence.hasWebsite) {
    console.log('⚠️ Smart Banned Words: No website data found for analysis')
    return ''
  }
  
  // v4.8.9 FIX: Use websiteAnalysis (actual key) with fallback to website
  const website = (dataSources as any).websiteAnalysis || (dataSources as any).website
  
  if (website) {
    // v4.8.9 FIX: Use ACTUAL field names from website_analyses table
    if (website.homepage_content) textParts.push(website.homepage_content)
    if (website.about_content) textParts.push(website.about_content)
    if (website.about_block) textParts.push(website.about_block)
    
    // Array fields - handle both array and string formats
    if (website.hero_texts) {
      if (Array.isArray(website.hero_texts)) textParts.push(...website.hero_texts)
      else textParts.push(website.hero_texts)
    }
    if (website.headers) {
      if (Array.isArray(website.headers)) textParts.push(...website.headers)
      else textParts.push(website.headers)
    }
    if (website.cta_texts) {
      if (Array.isArray(website.cta_texts)) textParts.push(...website.cta_texts)
      else textParts.push(website.cta_texts)
    }
    if (website.nav_items) {
      if (Array.isArray(website.nav_items)) textParts.push(...website.nav_items)
      else textParts.push(website.nav_items)
    }
    if (website.keywords) {
      if (Array.isArray(website.keywords)) textParts.push(...website.keywords)
      else textParts.push(website.keywords)
    }
    
    // Pages content
    if (website.pages && Array.isArray(website.pages)) {
      website.pages.forEach((page: any) => {
        if (page.content) textParts.push(page.content)
        if (page.text) textParts.push(page.text)
      })
    }
  }
  
  // Business profile descriptions
  const profile = dataSources.profile as any
  if (profile) {
    if (profile.short_description) textParts.push(profile.short_description)
    if (profile.long_description) textParts.push(profile.long_description)
  }
  
  // Social media bios
  const social = dataSources.social as any
  if (social) {
    if (social.bio) textParts.push(social.bio)
    if (social.description) textParts.push(social.description)
  }
  
  return textParts.filter(Boolean).join(' ')
}

/**
 * Filters banned words based on business website usage.
 * If a banned word appears 2+ times on the business's website,
 * it's considered part of their authentic voice and is ALLOWED.
 * 
 * v4.8.9 Task 2: Smart Banned Words (Hybrid Option C)
 * 
 * @param defaultBannedWords - The default list of banned words
 * @param websiteText - Combined text from all website sources
 * @param businessName - Name of the business (for logging)
 * @returns Object with final banned words and list of allowed words
 */
export function filterBannedWordsByBusinessUsage(
  defaultBannedWords: string[],
  websiteText: string,
  businessName: string
): { finalBannedWords: string[]; allowedWords: { word: string; count: number }[] } {
  const allowedWords: { word: string; count: number }[] = []
  const MINIMUM_OCCURRENCES = 2
  
  // Normalize website text for matching
  const normalizedText = websiteText.toLowerCase()
  
  const finalBannedWords = defaultBannedWords.filter(word => {
    // Create regex for word boundary matching
    const regex = new RegExp(`\\b${word.toLowerCase()}\\b`, 'gi')
    const matches = normalizedText.match(regex)
    const count = matches ? matches.length : 0
    
    if (count >= MINIMUM_OCCURRENCES) {
      allowedWords.push({ word, count })
      return false // Remove from banned list
    }
    return true // Keep in banned list
  })
  
  // Log for debugging
  if (allowedWords.length > 0) {
    console.log(`🔓 Smart Banned Words: Allowed ${allowedWords.length} words for "${businessName}" (used 2+ times):`)
    allowedWords.forEach(({ word, count }) => {
      console.log(`   - "${word}" (${count} occurrences)`)
    })
  }
  
  console.log(`🚫 Final banned words: ${finalBannedWords.length} (from ${defaultBannedWords.length} default)`)
  
  return { finalBannedWords, allowedWords }
}

/**
 * JSON schema for structured outputs.
 * Used with OpenAI's response_format for strict validation.
 */
export const BRAND_PROFILE_SCHEMA = {
  type: "object",
  properties: {
    brand_essence: {
      type: "object",
      properties: {
        value: {
          type: "string",
          description: "ONE sentence with: venue type + location + offerings + EXACTLY ONE non-menu behavioral hook. MUST include location context (ved åen/i centrum/på gågaden/ved stationen/i kvarteret). Hook must be flow/duration/transition/behavioral (NOT menu items, NOT location alone). BANNED WORDS: 'lækker', 'hyggelig', 'afslappet', 'autentisk', 'unik', 'charmerende'. Example: 'Café ved åen hvor brunch og frokost kan nydes i roligt tempo og glide naturligt over i aftenen.' Hook = 'roligt tempo + glide naturligt over i aftenen' (behavioral flow).",
          maxLength: 500,
          pattern: ".*(ved åen|ved stationen|på gågaden|i centrum|i kvarteret|ved [A-ZÆØÅ][a-zæøå]+|i turistområdet).*"
        },
        proof: {
          type: "array",
          items: { type: "string", maxLength: 220 },
          minItems: 1,
          maxItems: 3,
          description: "1-3 bullets proving which Prompt A hooks/phrases were used (reference by hook # or exact text)"
        }
      },
      required: ["value", "proof"],
      additionalProperties: false
    },
    tone_of_voice: {
      type: "object",
      properties: {
        value: {
          type: "string",
          description: "RULE-BASED writing system (not descriptive prose). 3-5 style rules as bullets, 2-3 concrete examples. MUST be machine-operable. BANNED WORDS in examples: 'lækker', 'hyggelig', 'afslappet', 'autentisk', 'unik'. Use observable, descriptive language instead. Format: Rules as bullets, then 'Eksempel:' lines, then optional 'Undgå:' line.",
          maxLength: 700
        },
        proof: {
          type: "array",
          items: { type: "string", maxLength: 220 },
          minItems: 1,
          maxItems: 3
        }
      },
      required: ["value", "proof"],
      additionalProperties: false
    },
    tone_model: {
      type: "object",
      properties: {
        primary_keywords: {
          type: "array",
          items: { type: "string", maxLength: 30 },
          minItems: 2,
          maxItems: 6,
          description: "2-6 core tone adjectives for validation (e.g., 'hyggelig', 'varm', 'professionel'). These are used by AI generation system for keyword-based tone checking. IMPORTANT: Keep between 2-6 to avoid prompt bloat."
        },
        writing_rules: {
          type: "array",
          items: { type: "string", maxLength: 150 },
          minItems: 3,
          maxItems: 8,
          description: "3-8 actionable writing rules extracted from tone_of_voice (e.g., 'Brug korte sætninger (max 15 ord)', 'Ingen overdrivelser eller hype-sprog'). IMPORTANT: Keep between 3-8 to avoid prompt bloat."
        },
        good_examples: {
          type: "array",
          items: { type: "string", maxLength: 150 },
          minItems: 2,
          maxItems: 6,
          description: "2-6 example phrases that capture the brand tone perfectly (e.g., 'Kom ind fra kulden', 'Kaffen venter på dig'). IMPORTANT: Keep between 2-6 to avoid prompt bloat."
        },
        avoid_examples: {
          type: "array",
          items: { type: "string", maxLength: 150 },
          minItems: 2,
          maxItems: 6,
          description: "2-6 example phrases to avoid with brief reason (e.g., 'Fantastisk lækker kaffe! (for hyped)', 'Du vil ikke tro... (clickbait)'). IMPORTANT: Keep between 2-6 to avoid prompt bloat."
        },
        formality: {
          type: "string",
          enum: ["formal", "informal", "mixed"],
          description: "Formality level: formal (De/Sie), informal (du), or mixed (context-dependent)."
        },
        emoji_level: {
          type: "string",
          enum: ["none", "minimal", "moderate", "frequent"],
          description: "Emoji usage: none (0), minimal (1), moderate (1-2), frequent (3+)."
        },
        version: {
          type: "string",
          enum: ["2.0"],
          description: "Schema version for tone_model. Always use '2.0' for this version of the schema."
        },
        language: {
          type: "string",
          minLength: 2,
          maxLength: 5,
          description: "ISO 639-1 language code (e.g., 'da' for Danish, 'en' for English, 'de' for German). CRITICAL for multi-language support. Detect from website content language."
        },
        generated_at: {
          type: "string",
          description: "ISO 8601 timestamp when this tone_model was generated (e.g., '2026-01-08T14:30:00Z'). Use current UTC timestamp."
        },
        source: {
          type: "string",
          enum: ["website", "manual", "hybrid"],
          description: "Data source: 'website' if extracted from website analysis, 'manual' if user-provided, 'hybrid' if combination."
        },
        confidence: {
          type: "string",
          enum: ["high", "medium", "low"],
          description: "Confidence level of tone extraction: 'high' if website has clear tone/content (5+ pages), 'medium' if some content (2-4 pages), 'low' if minimal content (1 page or unclear)."
        },
        notes: {
          type: "string",
          maxLength: 500,
          description: "Optional debug notes explaining extraction decisions, issues encountered, or confidence reasoning (e.g., 'Limited content available', 'Inconsistent tone across pages')."
        }
      },
      required: ["primary_keywords", "writing_rules", "good_examples", "avoid_examples", "formality", "emoji_level", "version", "language", "generated_at", "source", "confidence"],
      additionalProperties: false
    },
    target_audience: {
      type: "object",
      properties: {
        value: {
          type: "string",
          description: "USAGE OCCASIONS ONLY (behavior-centric temporal format). Write 2-4 usage occasions using 'Når gæster...' temporal phrasing. Each clause = SITUATION + TIME + CONTEXT. ALLOWED: Behavioral/contextual phrases ('børn kan spise med', 'mellem møder', 'før/efter arbejde', 'med god tid', 'i eget tempo'). STRICT BAN ON DEMOGRAPHIC PERSONAS: 'familier', 'børnefamilier', 'par', 'venner', 'turister', 'studerende', 'lokale', 'unge', 'Gæster der søger...'. DISTINCTION: 'børn kan spise med' (constraint ✅) vs 'familier' (persona ❌). Pattern: 'Når gæster [behavior + context], når [situation + time], samt når [transition]'. Example: 'Når gæster samles om længere brunch ved åen, når børn kan spise med uden bøvl, samt når aftenen glider fra middag til cocktails.' Minimum 2 occasions.",
          maxLength: 500
        },
        proof: {
          type: "array",
          items: { type: "string", maxLength: 220 },
          minItems: 1,
          maxItems: 3
        }
      },
      required: ["value", "proof"],
      additionalProperties: false
    },
    core_offerings: {
      type: "object",
      properties: {
        value: {
          type: "string",
          description: "Bulleted list: 3 meal anchors + 2 experience/service anchors",
          maxLength: 800
        },
        proof: {
          type: "array",
          items: { type: "string", maxLength: 220 },
          minItems: 1,
          maxItems: 3
        }
      },
      required: ["value", "proof"],
      additionalProperties: false
    },
    content_focus: {
      type: "object",
      properties: {
        value: {
          type: "string",
          description: "Content themes paragraph or bullets",
          maxLength: 600
        },
        proof: {
          type: "array",
          items: { type: "string", maxLength: 220 },
          minItems: 1,
          maxItems: 3
        }
      },
      required: ["value", "proof"],
      additionalProperties: false
    },
    content_pillars: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      description: "3-6 content pillars and whether they are allowed/encouraged for this venue",
      items: {
        type: "object",
        properties: {
          pillar: {
            type: "string",
            enum: ["Crave-worthy", "BTS", "Social proof", "Vibe", "Engagement", "Offers"],
            description: "Content pillar name"
          },
          allowed: {
            type: "boolean",
            description: "Allowed for this venue (safe + evidence-consistent)"
          },
          encouraged: {
            type: "boolean",
            description: "Encouraged for this venue (high-fit based on hooks/phrasing)"
          },
          notes: {
            type: "string",
            maxLength: 220,
            description: "One short reason tied to evidence (mention hook/phrase)"
          }
        },
        required: ["pillar", "allowed", "encouraged", "notes"],
        additionalProperties: false
      }
    },
    image_preferences: {
      type: "object",
      properties: {
        dos: {
          type: "array",
          items: { type: "string", maxLength: 200 },
          minItems: 3,
          maxItems: 3,
          description: "3 visual best practices"
        },
        donts: {
          type: "array",
          items: { type: "string", maxLength: 200 },
          minItems: 3,
          maxItems: 3,
          description: "3 visual anti-patterns"
        },
        signature_shot: {
          type: "string",
          maxLength: 300,
          description: "One iconic shot description. MUST include location context (ved åen/ved vinduet/på gågaden/i kvarteret/ved bordet ved åen).",
          pattern: ".*(ved åen|ved vinduet|ved bordet ved åen|på gågaden|med gågade|i kvarteret|i centrum|ved [A-ZÆØÅ][a-zæøå]+|med ikonisk udsigt).*"
        }
      },
      required: ["dos", "donts", "signature_shot"],
      additionalProperties: false
    },
    things_to_avoid: {
      type: "object",
      properties: {
        language_constraints: {
          type: "array",
          items: { type: "string", maxLength: 200 },
          minItems: 2,
          maxItems: 8,
          description: "Language/tone bans: specific words/phrases or hype patterns to avoid"
        },
        factual_constraints: {
          type: "array",
          items: { type: "string", maxLength: 220 },
          minItems: 2,
          maxItems: 8,
          description: "Factual guardrails: do NOT invent events/offers/music/discounts/opening hours/etc unless explicitly evidenced"
        }
      },
      required: ["language_constraints", "factual_constraints"],
      additionalProperties: false
    },
    cta_style: {
      type: "object",
      properties: {
        value: {
          type: "string",
          description: "How to invite action, use actual CTA verbs from website",
          maxLength: 500
        },
        proof: {
          type: "array",
          items: { type: "string", maxLength: 220 },
          minItems: 1,
          maxItems: 3
        }
      },
      required: ["value", "proof"],
      additionalProperties: false
    },
    communication_goal: {
      type: "object",
      properties: {
        value: {
          type: "string",
          description: "Desired outcome - positioning or performance goal",
          maxLength: 400
        },
        proof: {
          type: "array",
          items: { type: "string", maxLength: 220 },
          minItems: 1,
          maxItems: 3
        }
      },
      required: ["value", "proof"],
      additionalProperties: false
    },
    recognizable_interior_identity: {
      type: "object",
      properties: {
        value: {
          type: "string",
          description: "CONDITIONAL: Only populate if explicit visual evidence exists (interior photos, labeled images, on-site visuals). Include: murals, wall art, iconic figures/themes, distinctive interior elements guests immediately notice. Leave EMPTY if no verified evidence. Do NOT infer or use local knowledge.",
          maxLength: 600
        },
        proof: {
          type: "array",
          items: { type: "string", maxLength: 220 },
          minItems: 0,
          maxItems: 5,
          description: "Visual evidence sources: image labels, photo descriptions, explicit interior mentions"
        },
        has_verified_evidence: {
          type: "boolean",
          description: "Set to true ONLY if interior photos or explicit visual descriptions exist in the data. False or omit if uncertain."
        }
      },
      required: ["has_verified_evidence"],
      additionalProperties: false
    },
    internal_notes: {
      type: "array",
      items: { type: "string", maxLength: 300 },
      description: "Internal clarifications or observations"
    },
    clarifications_needed: {
      type: "array",
      items: { type: "string", maxLength: 200 },
      description: "Data gaps that need verification"
    },
    social_style: {
      type: "object",
      properties: {
        emoji_usage: {
          type: "string",
          enum: ["none", "minimal", "moderate", "expressive"],
          description: "Emoji strategy: none=formal/serious, minimal=1-2 (optimal for most), moderate=3-5 (casual), expressive=5+ (youth only)"
        },
        emoji_examples: {
          type: "array",
          items: { type: "string" },
          minItems: 3,
          maxItems: 6,
          description: "3-6 high-performing, on-brand emojis. Prefer: 🔥🚀🎯⬇️❤️⚠️✨✅ and industry-specific ones"
        },
        hashtag_strategy: {
          type: "object",
          properties: {
            branded: {
              type: "array",
              items: { type: "string" },
              description: "Business-specific hashtags (#BusinessName, #Slogan)"
            },
            category: {
              type: "array",
              items: { type: "string" },
              description: "Industry/category hashtags (#brunch, #cafe, #aarhus)"
            },
            local: {
              type: "array",
              items: { type: "string" },
              description: "Location-based hashtags (#cityname, #neighborhood)"
            }
          },
          required: ["branded", "category", "local"],
          additionalProperties: false
        }
      },
      required: ["emoji_usage", "emoji_examples", "hashtag_strategy"],
      additionalProperties: false
    },
    voice_examples: {
      type: "object",
      properties: {
        do_say: {
          type: "array",
          items: { type: "string", maxLength: 150 },
          minItems: 3,
          maxItems: 5,
          description: "3-5 example phrases/sentences this brand WOULD use (match their voice, location, personality)"
        },
        dont_say: {
          type: "array",
          items: { type: "string", maxLength: 150 },
          minItems: 3,
          maxItems: 5,
          description: "3-5 example phrases this brand would NEVER use (wrong tone, too generic, wrong personality)"
        },
        vocabulary: {
          type: "object",
          properties: {
            prefer: {
              type: "array",
              items: { type: "string" },
              minItems: 5,
              maxItems: 10,
              description: "Words that fit this brand's voice (e.g., 'gæster' vs 'kunder', 'hjemmelavet' vs 'premium')"
            },
            avoid: {
              type: "array",
              items: { type: "string" },
              minItems: 5,
              maxItems: 10,
              description: "Words that don't fit this brand (too formal, too casual, wrong vibe)"
            }
          },
          required: ["prefer", "avoid"],
          additionalProperties: false
        }
      },
      required: ["do_say", "dont_say", "vocabulary"],
      additionalProperties: false
    }
  },
  required: [
    "brand_essence",
    "tone_of_voice",
    "tone_model",
    "target_audience",
    "core_offerings",
    "content_focus",
    "content_pillars",
    "image_preferences",
    "things_to_avoid",
    "cta_style",
    "communication_goal",
    "recognizable_interior_identity",
    "social_style",
    "voice_examples",
    "internal_notes",
    "clarifications_needed"
  ],
  additionalProperties: false
}

/**
 * Builds the ultra-short system prompt for Prompt B.
 * Core rules only - heavy data goes in user prompt.
 * 
 * @param language - Language configuration
 * @returns System prompt string
 */
export function buildSystemPromptB(language: LanguageConfig): string {
  return `You write Brand Profiles for small local businesses. Output: JSON only.

🚨 LOCATION CONTEXT (HIGHEST PRIORITY) 🚨
If the prompt provides location enrichment data with area_type (waterfront, transit_hub, etc.), you MUST include the specific location phrase in:
1. brand_essence.value (start the sentence with it, e.g., "Café i Aarhus ved åen hvor...")
2. signature_shot (include the area phrase, e.g., "ved åen", "ved stationen")
→ Copy the exact phrases from the prompt. Don't paraphrase. Validation checks for these specific words.

STYLE:
- Write in natural ${language.name}
- Use the business's OWN words from the data provided
- Be specific where evidence exists, neutral where it doesn't
- Sound like a helpful colleague, not a marketing agency

STRUCTURE (3+2 rule for core_offerings):
- 3 meal anchors (brunch, frokost, middag, etc.)
- 2 experience/service anchors (terrasse, takeaway, etc.)

TARGET AUDIENCE (behavior-centric, TEMPORAL FORMAT):
- Use "Når gæster..." temporal phrasing to describe WHEN and HOW guests use the venue
- Each clause = SITUATION + TIME + CONTEXT (observable behavior only)
- ALLOWED: Temporal behavioral moments and contextual constraints
  ✅ "Når gæster samles om længere brunch ved bordet"
  ✅ "Når børn kan spise med uden bøvl" (behavioral constraint, NOT persona)
  ✅ "Når man søger hurtig frokost mellem møder" (temporal context)
  ✅ "Når aftenen glider fra middag til cocktails" (temporal flow)
  ✅ "med god tid", "i eget tempo", "før/efter arbejde" (duration/time context)
- STRICT BAN - DEMOGRAPHIC PERSONAS (these words MUST NOT appear):
  ❌ "familier", "børnefamilier", "par", "venner"
  ❌ "turister", "studerende", "lokale", "unge"
  ❌ "Gæster der søger...", "Folk som...", "Kunder der..." (persona-seeking framing)
  ❌ ANY demographic labels or persona framing
- DISTINCTION: "børn kan spise med" = behavioral constraint ✅ vs "familier med børn" = demographic persona ❌
- BUILD FROM: usage_occasions[] provided in prompt data
- Pattern: "Når gæster [behavior + context], når [situation + time], samt når [transition]"
- Minimum 2-4 occasions per venue
- VALIDATE: No demographic personas present in output

CONDITIONAL FIELDS:
- recognizable_interior_identity: ONLY populate if explicit visual evidence exists (interior photos with labels, distinctive decor descriptions)
  * Set has_verified_evidence=true ONLY if interior photos exist in uploaded images
  * Set has_verified_evidence=false if no photos or uncertain
  * Leave value="" if has_verified_evidence=false
  * Examples (if evidenced): murals, wall art, iconic figures, distinctive decor guests notice
  * Do NOT infer from location or business type alone

BANNED WORDS (never use - empty marketing):
hyggelig, lækker, indbydende, autentisk, unik, udsøgt, afslappet/afslappede, perfekt spot, kulinariske oplevelser, ideelt sted, gastronomisk, charmerende, fantastisk, cozy, delicious, welcoming, authentic, unique, amazing

INSTEAD OF BANNED WORDS, USE SPECIFIC ALTERNATIVES:
- NOT "afslappet/afslappede" → USE "roligt tempo", "uhøjtidelig", "uformel", "i eget tempo"
- NOT "hyggelig" → USE specific details (candlelight, wood interior, intimate tables)
- NOT "lækker" → USE actual descriptors (sprød, cremet, syrlig, etc.)

GAPS:
- User-facing fields = always clean text
- Uncertainties go to clarifications_needed[] only
- Never write "(mangler evidens)" or "uklart om" in main fields`
}

/**
 * Builds the user prompt for Prompt B (Brand Profile Generation).
 * 
 * This is a data-heavy prompt with minimal rules (rules are in system prompt).
 * Focuses on providing concrete phrases and anchors for the AI to use.
 * 
 * @param dataSources - All gathered data sources
 * @param analysis - Prompt A analysis result
 * @param language - Language configuration
 * @returns The formatted prompt string
 */
export function buildPromptB(
  dataSources: DataSources,
  analysis: any,
  language: LanguageConfig,
  locale: any
): string {
  const { business, location, profile, menu, images, websiteAnalysis, socialAccounts } = dataSources

  // === v4.8.9 Task 2: Smart Banned Words ===
  const businessName = business?.business_name || business?.name || 'Unknown'
  const websiteText = aggregateWebsiteText(dataSources)
  
  console.log(`📝 Website text aggregated: ${websiteText.length} characters`)
  
  const defaultBannedWords = language.code === 'da' ? DEFAULT_BANNED_WORDS_DA : DEFAULT_BANNED_WORDS_EN
  
  const { finalBannedWords, allowedWords } = filterBannedWordsByBusinessUsage(
    defaultBannedWords,
    websiteText,
    businessName
  )
  
  // Store context for logging
  const smartBannedWordsContext = {
    defaultCount: defaultBannedWords.length,
    finalCount: finalBannedWords.length,
    allowedWords: allowedWords.map(w => w.word),
    allowedDetails: allowedWords
  }
  
  console.log(`🔧 Smart Banned Words Context:`, JSON.stringify(smartBannedWordsContext, null, 2))
  // === END v4.8.9 Task 2 ===

  // Build rich menu details (top 12 items with descriptions)
  const menuDetails = buildMenuSummary(menu, 12)

  // Build image scene descriptions from AI labels
  const imageScenes = images.length > 0
    ? images.slice(0, 5).map(img => {
        const labels = img.ai_labels ? Object.values(img.ai_labels).flat().slice(0, 5).join(', ') : 'no labels'
        const tags = img.category_tags ? img.category_tags.join(', ') : ''
        return `- ${img.type}${img.is_hero ? ' (HERO)' : ''}: ${labels}${tags ? ` [${tags}]` : ''}`
      }).join('\n')
    : 'No images uploaded'

  // Extract structured website data
  const structuredWebsite = extractStructuredWebsiteData(websiteAnalysis)

  // Extract data from Prompt A analysis
  const evidence = analysis.evidence || {}
  const signals = analysis.signals || {}

  // Distinctive hooks (Prompt A) to prevent genericness
  const listWithEvidence = (items: any[], labelKey: string, title: string): string => {
    if (!Array.isArray(items) || items.length === 0) return `${title}: None found`
    return `${title}:\n` + items.slice(0, 8).map((it, idx) => {
      const label = String(it?.[labelKey] || '').trim() || '(missing)'
      const ev = String(it?.evidence || '').trim()
      const src = String(it?.source || '').trim()
      return `#${idx + 1} ${label}${ev ? ` — "${ev}"` : ''}${src ? ` [${src}]` : ''}`
    }).join('\n')
  }

  const distinctiveHooksSection = [
    listWithEvidence(analysis.distinctive_hooks || [], 'hook', 'DISTINCTIVE HOOKS (non-menu)'),
    listWithEvidence(analysis.physical_space_cues || [], 'cue', 'PHYSICAL SPACE CUES'),
    listWithEvidence(analysis.rituals_and_moments || [], 'moment', 'RITUALS & MOMENTS'),
    listWithEvidence(analysis.local_identity_cues || [], 'cue', 'LOCAL IDENTITY CUES'),
    listWithEvidence(analysis.copy_patterns || [], 'pattern', 'COPY PATTERNS (exact phrasing)')
  ].join('\n\n')

  // Build dynamic proof tokens from business data (v4.8.3)
  const menuAnchors = analysis?.signals?.core_offerings?.must_use_phrases || []
  const topMenuItems = (menu || [])
    .filter(item => item.name && item.name.length > 3)
    .slice(0, 6)
    .map(item => item.name.toUpperCase())
  
  const dynamicMenuProofTokens = [
    ...menuAnchors.map((anchor: string) => String(anchor).toUpperCase()),
    ...topMenuItems
  ].filter(Boolean)

  // Deduplicate menu proof tokens
  const uniqueMenuTokens = Array.from(new Set(dynamicMenuProofTokens))

  // Build highlighted quotes from Prompt A
  const highlightedQuotes: string[] = []
  
  if (evidence.brand_essence?.supporting_quote) {
    highlightedQuotes.push(`[Brand Essence] "${evidence.brand_essence.supporting_quote}"`)
  }
  if (evidence.tone_of_voice?.example_phrases?.length > 0) {
    const phrases = evidence.tone_of_voice.example_phrases.slice(0, 3).map((p: string) => `"${p}"`).join(', ')
    highlightedQuotes.push(`[Tone Examples] ${phrases}`)
  }
  if (evidence.target_audience?.usage_occasions?.length > 0) {
    highlightedQuotes.push(`[Usage Occasions] ${evidence.target_audience.usage_occasions.join(', ')}`)
  }
  if (evidence.core_offerings?.website_additional_items_found?.length > 0) {
    const items = evidence.core_offerings.website_additional_items_found.slice(0, 3).join(', ')
    highlightedQuotes.push(`[Additional Offerings Found] ${items}`)
  }
  if (evidence.image_preferences?.visual_patterns?.length > 0) {
    highlightedQuotes.push(`[Visual Style] ${evidence.image_preferences.visual_patterns.join(', ')}`)
  }
  if (evidence.things_to_avoid?.explicit_donts?.length > 0) {
    highlightedQuotes.push(`[Explicit Constraints] ${evidence.things_to_avoid.explicit_donts.join(', ')}`)
  }
  if (evidence.cta_style?.action_verbs_found?.length > 0) {
    highlightedQuotes.push(`[CTA Verbs] ${evidence.cta_style.action_verbs_found.slice(0, 3).join(', ')}`)
  }

  // Extract must-use phrases from signals
  const mustUsePhrases: Record<string, string[]> = {}
  const concreteAnchors: Record<string, string[]> = {}
  const disallowedWords: Record<string, string[]> = {}
  
  Object.keys(signals).forEach((key: string) => {
    const signal = signals[key]
    if (signal?.must_use_phrases?.length > 0) {
      mustUsePhrases[key] = signal.must_use_phrases
    }
    if (signal?.concrete_anchors?.length > 0) {
      concreteAnchors[key] = signal.concrete_anchors
    }
    if (signal?.disallowed_generic_words?.length > 0) {
      disallowedWords[key] = signal.disallowed_generic_words
    }
  })
  
  const mustUseSection = Object.keys(mustUsePhrases).length > 0
    ? Object.entries(mustUsePhrases)
        .map(([key, phrases]) => `${key}: ${phrases.map(p => `"${p}"`).join(', ')}`)
        .join('\n')
    : 'No mandatory phrases identified'
  
  const concreteAnchorsSection = Object.keys(concreteAnchors).length > 0
    ? Object.entries(concreteAnchors)
        .map(([key, anchors]) => `${key}: ${anchors.join(', ')}`)
        .join('\n')
    : 'No concrete anchors identified'
  
  const disallowedSection = Object.keys(disallowedWords).length > 0
    ? Object.entries(disallowedWords)
        .map(([key, words]) => `${key}: AVOID ${words.join(', ')} (insufficient evidence)`)
        .join('\n')
    : 'No generic words to avoid (evidence is strong)'

  // Extract example sentences from website
  const exampleSentences: string[] = []
  if (evidence.tone_of_voice?.example_phrases?.length > 0) {
    exampleSentences.push(...evidence.tone_of_voice.example_phrases.slice(0, 3))
  }
  if (structuredWebsite.valuePhrases?.length > 0) {
    exampleSentences.push(...structuredWebsite.valuePhrases.slice(0, 2))
  }
  const exampleSentencesSection = exampleSentences.length > 0
    ? exampleSentences.map(s => `"${s}"`).join('\n')
    : 'None found'

  // Render canonical locale-specific location phrase via prompt-builder (hybrid tokens + phrases)
  const langCode = language.code || 'da-DK'
  const cityName = location?.enrichment?.macro?.city || business?.city || 'Unknown'
  const areaType = location?.enrichment?.micro?.area_type
  const nearbySignal = location?.enrichment?.micro?.nearby_signals?.[0]
  const locationPhrase = renderLocationPhrase(areaType, langCode, nearbySignal)
  
  // Get venue type - prefer business_profile.business_category (user-provided), fallback to vertical
  const rawVenueType = profile?.business_category || business?.vertical || 'Café'
  const venueTypeMap: Record<string, string> = {
    'hospitality': 'Café',
    'food_service': 'Restaurant',
    'cafe': 'Café',
    'restaurant': 'Restaurant',
    'bar': 'Bar',
    'bistro': 'Bistro'
  }
  const venueType = venueTypeMap[rawVenueType.toLowerCase()] || rawVenueType
  
  // Language-specific preposition for canonical location hook
  const cityPreposition = langCode === 'da' ? 'i' : langCode === 'de' ? 'in' : 'in'
  
  // Canonical location hook (standardized format for validation)
  const canonicalLocationHook = locationPhrase ? `${locationPhrase} ${cityPreposition} ${cityName}` : ''

  // Build dynamic proof tokens using existing variables
  const primaryCta = (() => {
    // Try structured website CTAs first
    if (structuredWebsite?.ctaTexts?.length > 0) {
      const bookingCta = structuredWebsite.ctaTexts.find((cta: string) => 
        /book|reserv|bord/i.test(cta)
      )
      if (bookingCta) return bookingCta.toUpperCase()
    }
    // Fallback to locale
    return locale?.preferredPhrasing?.['cta_book'] || 'BOOK DIT BORD'
  })()

  // Build allowed proof tokens from existing variables
  const ALLOWED_PROOF_TOKENS = [
    canonicalLocationHook,
    primaryCta,
    ...uniqueMenuTokens, // Already built earlier in the function
    locationPhrase || 'ved åen',
    cityName
  ]
    .filter(Boolean)
    .map(t => String(t))
    .filter((t, idx, arr) => arr.indexOf(t) === idx) // Deduplicate

  // Debug logging
  console.log('🔍 Location phrase DEBUG:', {
    hasEnrichment: !!location?.enrichment,
    areaType: location?.enrichment?.micro?.area_type,
    locationPhrase,
    cityName,
    rawVenueType,
    venueType,
    canonicalLocationHook,
    profileCategory: profile?.business_category,
    businessVertical: business?.vertical
  })

  console.log('🔧 ALLOWED_PROOF_TOKENS:', ALLOWED_PROOF_TOKENS.slice(0, 8))

  // v4.10.0 Phase 1: Build constraint-first instruction for brand_essence
  const brandEssenceConstraint = `
🎯 BRAND ESSENCE - FILL THESE EXACT SLOTS:

MANDATORY COMPONENTS (you MUST use ALL of these):
1. [VENUE TYPE]: ${venueType}
2. [LOCATION HOOK]: ${canonicalLocationHook}
3. [OFFERINGS]: Choose 1-2 from menu: ${uniqueMenuTokens.slice(0, 3).join(', ')}
4. [BEHAVIORAL HOOK]: ${analysis?.rituals_and_moments?.[0]?.moment || 'i roligt tempo'} (NOT a menu item, NOT location)

REQUIRED FORMAT:
"[VENUE TYPE] [LOCATION HOOK] hvor [OFFERINGS] [BEHAVIORAL HOOK]."

EXAMPLE (using YOUR business data):
"${venueType} ${canonicalLocationHook} hvor ${uniqueMenuTokens[0] || 'brunch'} kan nydes i roligt tempo."

⚠️ VALIDATION RULES:
- MUST include exact location hook: "${canonicalLocationHook}"
- MUST reference at least ONE menu item: ${uniqueMenuTokens.slice(0, 3).join(' OR ')}
- MUST include behavioral/flow hook (time, duration, transition)
- NO banned words: ${finalBannedWords.slice(0, 5).join(', ')}

✅ VALID: "${venueType} ${canonicalLocationHook} hvor ${uniqueMenuTokens[0] || 'brunch'} kan nydes i roligt tempo."
❌ INVALID: "Restaurant with great food" (missing location, generic)
❌ INVALID: "Café hvor man kan spise" (missing location hook)
`

  // Pure data prompt - rules are in system prompt
  return `🚨🚨🚨 CRITICAL INSTRUCTION - READ FIRST 🚨🚨🚨

🌍 LANGUAGE REQUIREMENT:
CRITICAL: ALL output must be in Danish. No English words except brand names.
This includes all fields: brand_essence, core_offerings, target_audience, signature_shot, social_media, etc.

${brandEssenceConstraint}

${language.code === 'da' ? `📝 DANISH GRAMMAR RULES (MANDATORY):
Ensure grammatically correct Danish in all output. Common mistakes to avoid:

❌ DON'T: "Når samles om..." (missing subject)
✅ DO: "Når man samles om..." or "Når folk samles om..."

❌ DON'T: "Hvor kan nyde..." (missing subject)
✅ DO: "Hvor man kan nyde..." or "Hvor gæster kan nyde..."

❌ DON'T: "Her serveres der lækker mad" (passive voice + banned word)
✅ DO: "Her serveres brunch og kaffe" (specific offerings)

❌ DON'T: "Hvor er perfekt til..." (grammar error)
✅ DO: "Som er perfekt til..." or "Der er perfekt til..."

Always include proper subjects (man/gæster/folk) in subordinate clauses.
Avoid incomplete sentences and passive constructions without subjects.

` : ''}REQUIRED TOKENS FOR brand_essence.value (copy verbatim in ONE sentence):
- venue_type: "${venueType}" (MANDATORY)
- location_cue: "${canonicalLocationHook || cityName}" (MANDATORY)
- offering_cue: Use 1-2 SPECIFIC offerings from menu (MANDATORY)
  ✅ CORRECT: "brunch", "frokost", "cocktails", "kaffe", "pariserbøf", "æggekage"
  ❌ NEVER use: "menu categories", "menukategorier", "mad", "mad og drikke" (too generic)
  💡 TIP: Extract from TOP MENU ITEMS section below or use meal-time anchors
- behavioral_hook: choose EXACTLY ONE (MANDATORY) from ["roligt tempo", "glide naturligt over i aftenen", "lange ophold", "fra dag til aften"]
- distinctive_hook: ENCOURAGED but not required - use if it flows naturally

💡 TIP: If you can naturally incorporate distinctive location elements without forcing it, do so.
But prioritize natural flow over verbatim matching.

✅ CORRECT EXAMPLE: "${venueType} ${canonicalLocationHook ? `${canonicalLocationHook}` : `i ${cityName}`} hvor brunch og cocktails kan nydes i roligt tempo."

❌ WRONG EXAMPLES:
- "Café ved åen med menu categories i roligt tempo" (generic placeholder)
- "Café ved åen med lækker mad" (banned word "lækker")
- "Restaurant med fokus på kvalitet" (no location, no behavioral hook)

REQUIRED FOR signature_shot: "${locationPhrase || cityName}" + action (people sitting/eating/talking) + lighting (aftenlys/morgenlys/naturligt lys)

${Object.keys(disallowedWords).length > 0 ? `
🚨 BANNED WORDS (DO NOT USE ANYWHERE IN YOUR OUTPUT):
${Object.entries(disallowedWords).map(([field, words]) => `- ${field}: ${words.join(', ')}`).join('\n')}
These words lack evidence. Using them will cause validation errors.
` : ''}

🚫 GENERIC MARKETING WORDS (${finalBannedWords.length} banned):
${finalBannedWords.join(', ')}
These are empty marketing words. Use specific, observable alternatives instead.

${allowedWords.length > 0 ? `
✅ EXCEPTION - Words allowed for THIS business (they use them authentically):
${allowedWords.map(({ word, count }) => `- "${word}" (${count}x on website)`).join('\n')}
You MAY use these allowed words naturally, but prefer specific alternatives when possible.
` : ''}

${ALLOWED_PROOF_TOKENS.length > 0 ? `
ALLOWED PROOF REFERENCES (use ONLY in proof bullets, NOT in value fields):
${ALLOWED_PROOF_TOKENS.slice(0, 10).map((token, idx) => `${idx + 1}. "${token}"`).join('\n')}

⚠️ CRITICAL USAGE RULES:
- These tokens are for PROOF ATTRIBUTION ONLY (proof bullets)
- In value fields: Use natural lowercase and flow (e.g., "pariserbøf ved åen" not "PARISERBØF ved åen")
- Primary CTA: Use "${primaryCta}" in proof when referencing booking CTA
- Menu items: Reference naturally in value (e.g., "nyd pariserbøf"), uppercase in proof
- Location: "${canonicalLocationHook || cityName}" must appear in brand_essence and signature_shot

CORRECT USAGE:
value: "Café i Aarhus ved åen hvor pariserbøf kan nydes i roligt tempo"
proof: ["Based on location hook 'ved åen i Aarhus' and menu anchor 'PARISERBØF'"]

WRONG USAGE:
value: "Café hvor PARISERBØF kan nydes"  ❌ (uppercase in value, missing location)
proof: ["Based on the waterfront location"]  ❌ (doesn't use allowed tokens)

Every proof bullet MUST contain at least one of the numbered tokens above (verbatim).
` : '⚠️ No proof tokens available - use descriptive evidence in proof bullets'}

⚠️ CRITICAL: These tokens are for proof attribution ONLY.
- In proof bullets: Use these exact strings (uppercase for menu items, natural case for location)
- In value fields: Use natural lowercase and flow (e.g., "pariserbøf" not "PARISERBØF")
Every proof bullet MUST contain at least one of these strings verbatim.

---

Generate a Brand Profile for: ${business?.name || 'Unknown'} (${venueType}) in ${cityName}

---

🚨 LOCATION CONTEXT - COPY THESE PHRASES EXACTLY 🚨

${location?.enrichment ? `
✅ ENRICHED LOCATION DATA (deterministic computation - THESE ARE FACTS, NOT SUGGESTIONS):
→ City: ${location.enrichment.macro.city} (${location.enrichment.macro.city_tier})
→ Country: ${location.enrichment.macro.country}
→ Area type: ${location.enrichment.micro.area_type}
→ Nearby signals: ${location.enrichment.micro.nearby_signals.join(', ')}
→ Confidence: ${location.enrichment.micro.confidence}

🔴 MANDATORY LOCATION PHRASES - YOU MUST COPY THESE VERBATIM (DO NOT PARAPHRASE): 🔴
${location.enrichment.micro.area_type === 'waterfront' ? `
1️⃣ brand_essence.value MUST START WITH: "Café i ${location.enrichment.macro.city} ved åen hvor..."
2️⃣ image_preferences.signature_shot MUST INCLUDE: "ved åen" or "ved bordet ved åen"
3️⃣ image_preferences.dos[0] MUST REFERENCE: "ved åen" or "åen" (waterfront context)

EXAMPLE (COPY THIS STRUCTURE):
brand_essence: "Café i ${location.enrichment.macro.city} ved åen hvor brunch og frokost kan nydes i roligt tempo og glide naturligt over i aftenen."
signature_shot: "Gæster ved bordet ved åen i gyldent aftenlys med flere retter og glas på bordet"
dos[0]: "Billeder ved åen med morgen/aftenlys"
` : ''}${location.enrichment.micro.area_type === 'transit_hub' ? `
1️⃣ brand_essence.value MUST START WITH: "Café i ${location.enrichment.macro.city} ved stationen hvor..."
2️⃣ image_preferences.signature_shot MUST INCLUDE: "ved vinduet" or "med pendlere"
3️⃣ image_preferences.dos[0] MUST REFERENCE: "ved stationen" or "morgenlys ved vinduet"
` : ''}${location.enrichment.micro.area_type === 'shopping_street' ? `
1️⃣ brand_essence.value MUST START WITH: "Café i ${location.enrichment.macro.city} på gågaden hvor..."
2️⃣ image_preferences.signature_shot MUST INCLUDE: "med gågade-liv" or "på gågaden"
3️⃣ image_preferences.dos[0] MUST REFERENCE: "gågade" or "gågade-aktivitet"
` : ''}${location.enrichment.micro.area_type === 'tourist_area' ? `
1️⃣ brand_essence.value MUST START WITH: "Café i ${location.enrichment.macro.city} ${location.enrichment.micro.nearby_signals[0] ? `ved ${location.enrichment.micro.nearby_signals[0]}` : 'i turistområdet'} hvor..."
2️⃣ image_preferences.signature_shot MUST INCLUDE: landmark reference or "ikonisk udsigt"
3️⃣ image_preferences.dos[0] MUST REFERENCE: landmark name or "turistappeal"
` : ''}${location.enrichment.micro.area_type === 'residential' ? `
1️⃣ brand_essence.value MUST START WITH: "Café i ${location.enrichment.macro.city} i kvarteret hvor..."
2️⃣ image_preferences.signature_shot MUST INCLUDE: "i kvarteret" or "lokale gæster"
3️⃣ image_preferences.dos[0] MUST REFERENCE: "kvarterspræg" or "lokalt liv"
` : ''}${location.enrichment.micro.area_type === 'business_district' ? `
1️⃣ brand_essence.value MUST START WITH: "Café i ${location.enrichment.macro.city} i centrum hvor..."
2️⃣ image_preferences.signature_shot MUST INCLUDE: "i city-atmosfære" or "i centrum"
3️⃣ image_preferences.dos[0] MUST REFERENCE: "business-lunch" or "centrum-liv"
` : ''}

⚠️ VALIDATION WILL FAIL IF YOU DON'T COPY THESE PHRASES EXACTLY ⚠️
` : ''}${analysis.geo_context && !location?.enrichment ? `
⚠️ GEO CONTEXT (AI-extracted - use if no enrichment above):
- City: ${analysis.geo_context.city}
${analysis.geo_context.area_hint ? `- Area: ${analysis.geo_context.area_hint}` : ''}
${analysis.geo_context.evidence?.length > 0 ? `- Evidence: ${analysis.geo_context.evidence.map((e: any) => `"${e.quote}" [${e.source}]`).join('; ')}` : ''}` : ''}${!location?.enrichment && !analysis.geo_context ? '❌ No location context available - use city name only' : ''}

---

USAGE OCCASIONS (from Prompt A internal analysis):
${analysis.usage_occasions && analysis.usage_occasions.length > 0 
  ? analysis.usage_occasions.map((occ: any, idx: number) => 
      `${idx + 1}. [${occ.id}] ${occ.name}
   When: ${occ.when}
   Situation: ${occ.situation}
   Behavior: ${occ.behavior}
   Job-to-be-done: ${occ.job_to_be_done}
   Evidence: ${occ.evidence?.map((e: any) => `"${e.quote}" [${e.source}]`).join('; ') || 'none'}
   Confidence: ${occ.confidence}`
    ).join('\n\n')
  : 'No usage occasions identified'}

CONTENT TRIGGERS (from Prompt A internal analysis):
${analysis.content_triggers && analysis.content_triggers.length > 0
  ? analysis.content_triggers.map((trigger: any, idx: number) =>
      `${idx + 1}. ${trigger.trigger}
   Based on occasions: ${trigger.based_on_usage_occasion_ids?.join(', ') || 'none'}
   What to show: ${trigger.what_to_show?.join(', ') || 'none'}
   Copy angles: ${trigger.copy_angles?.join(', ') || 'none'}
   Evidence: ${trigger.evidence?.map((e: any) => `"${e.quote}" [${e.source}]`).join('; ') || 'none'}`
    ).join('\n\n')
  : 'No content triggers identified'}

---

**USE THESE PHRASES** (the business's own words - incorporate directly):
${mustUseSection}

**CONCRETE ANCHORS** (specific details to include):
${concreteAnchorsSection}

---

${distinctiveHooksSection}

**TOP MENU ITEMS**:
${menuDetails}

**CTA TEXTS FROM WEBSITE**:
${structuredWebsite.ctaTexts.slice(0, 8).join(', ') || 'None found'}

**EXAMPLE SENTENCES FROM WEBSITE** (copy their style):
${exampleSentencesSection}

**WEBSITE HEADERS**:
${structuredWebsite.headers.slice(0, 6).join(' | ') || 'None'}

**MENU CATEGORIES MENTIONED**:
${structuredWebsite.menuCategoriesMentioned.join(', ') || 'None'}

---

**IMAGE VISUAL PATTERNS**:
${imageScenes}

**AVOID THESE GENERIC WORDS** (no evidence for them):
${disallowedSection}

---

**ANTI-GENERIC GATE (MANDATORY)**:
- For the following fields, output an object with: { value: string, proof: [1-3 bullets] }
- proof bullets MUST use EXACT QUOTES from source data (never translate or paraphrase)
- If you cannot produce proof, put the uncertainty in clarifications_needed and still keep the value conservative.

**PROOF CITATION RULES (LANGUAGE-SAFE):**
✅ Valid proof references (quote the original language text, NOT the English label):
  - "Hook #1: ved åen i Aarhus" (quote the evidence, not "Dining by the river")
  - "Hook #2: roligt tempo" (quote the evidence, not "Long transitions")
  - "Menu: PARISERBØF" (from TOP MENU ITEMS)
  - "CTA: BOOK DIT BORD" (from CTA TEXTS FROM WEBSITE)
  - "Header: Café Faust ved Åen" (from WEBSITE HEADERS)
  - "Occasion: brunch-to-work" (occasion ID)

❌ FORBIDDEN in proof (causes translation corruption):
  - Never cite English labels (e.g., NOT "Dining by the river")
  - Never reference "content trigger" names
  - Never translate back from English to ${language.name}
  - Never paraphrase - quote verbatim from source data

Fields requiring proof objects:
- brand_essence
- tone_of_voice
- target_audience
- core_offerings
- content_focus
- cta_style
- communication_goal

---

FIELD-SPECIFIC STRUCTURE RULES (MANDATORY):

1) brand_essence.value

🚨🚨🚨 CRITICAL: START YOUR SENTENCE WITH THIS EXACT TEXT 🚨🚨🚨
${location?.enrichment ? `"${venueType} i ${location.enrichment.macro.city} ${location.enrichment.micro.area_type === 'waterfront' ? 'ved åen' : location.enrichment.micro.area_type === 'transit_hub' ? 'ved stationen' : location.enrichment.micro.area_type === 'shopping_street' ? 'på gågaden' : location.enrichment.micro.area_type === 'tourist_area' ? (location.enrichment.micro.nearby_signals[0] ? `ved ${location.enrichment.micro.nearby_signals[0]}` : 'i turistområdet') : location.enrichment.micro.area_type === 'residential' ? 'i kvarteret' : 'i centrum'} hvor..."` : `"${venueType} i ${business?.city || 'city'} hvor..."`}
🚨🚨🚨 COPY THIS EXACTLY - DO NOT CHANGE A SINGLE WORD 🚨🚨🚨

- Must be ONE sentence and must include ALL of:
  - venue type (e.g., café/restaurant/bar/bistro) ← ALREADY IN THE START TEXT ABOVE
  - location cue (city + area) ← ALREADY IN THE START TEXT ABOVE  
  - offering cue (e.g., brunch/frokost/aften, cocktails, kaffe, etc.)
  - exactly ONE behavioral hook: FLOW / DURATION / TRANSITION / TEMPO
  - Hook examples: "roligt tempo", "glide naturligt over i aftenen", "lange ophold", "fra dag til aften"
  - NOT allowed as hook: menu items, location alone, or subjective words
- BANNED WORDS: "lækker", "hyggelig", "afslappet", "autentisk", "unik", "charmerende", "fantastisk"

${location?.enrichment ? `✅ CORRECT EXAMPLE: "Café i ${location.enrichment.macro.city} ved åen hvor brunch og cocktails kan nydes i roligt tempo, og hvor dagen glider naturligt over i aftenen."` : '✅ CORRECT EXAMPLE: "Café ved åen hvor brunch og cocktails kan nydes i roligt tempo, og hvor dagen glider naturligt over i aftenen."'}

❌ WRONG EXAMPLES:
- "Café ved åen med lækker mad og hyggelig stemning" (banned words)
- "Café hvor menu categories kan nydes" (generic placeholder)
- "Restaurant med fokus på kvalitet" (no location, no behavioral hook)

2) tone_of_voice.value
- RULE-BASED writing system (not descriptive prose)
- Must be machine-operable: rules → examples → constraints
- Structure:
  - 3–5 style bullets ("- ") describing HOW to write (not what it sounds like)
  - 2–3 example lines starting with "Eksempel: " showing actual phrases
  - Optional 1–2 lines starting with "Undgå: " showing specific bad examples

🚨 BANNED WORDS - NEVER WRITE THESE ANYWHERE: 🚨
${finalBannedWords.join(', ')}

${allowedWords.length > 0 ? `
✅ EXCEPTION - These words ARE ALLOWED for this business (they use them authentically):
${allowedWords.map(({ word }) => word).join(', ')}
` : ''}

- Use observable, descriptive language: "roligt tempo", "i eget tempo", "god tid"
- Example rule: "Direkte og uformel uden marketing-sprog"
- Example phrase format: "Eksempel: Brunch ved åen med god tid ved bordet"
- Bad example format: "Undgå: 'Den bedste brunch i byen'" (specific superlative, not generic instruction)
- Include CTA verbs from website if present
- MUST include 2-3 lines starting with "Eksempel: " (not "Example" or "Eks:")

2.5) tone_model (STRUCTURED TONE VALIDATION - NEW FIELD v2.0)
Generate a structured machine-readable tone model for downstream AI validation:

{
  primary_keywords: [2-6 core adjectives],  // e.g., ["rolig", "jordnær", "uformel"]
  writing_rules: [3-8 actionable rules],     // e.g., ["Brug korte sætninger max 15 ord", "Ingen hype-sprog"]
  good_examples: [2-6 fitting phrases],      // e.g., ["Nyd brunch i eget tempo", "Kom forbi til kaffe"]
  avoid_examples: [2-6 bad phrases + reason], // e.g., ["Fantastisk oplevelse! (for hyped)", "Du vil ikke tro... (clickbait)"]
  formality: "formal|informal|mixed",        // formal=De, informal=du, mixed=context
  emoji_level: "none|minimal|moderate|frequent", // none=0, minimal=1, moderate=1-2, frequent=3+
  version: "2.0",                            // ALWAYS "2.0"
  language: "${language.code}",              // ISO 639-1 code (da/en/sv/etc)
  generated_at: "<ISO 8601 timestamp>",     // UTC timestamp when generated
  source: "website|manual|hybrid",           // website=from data, manual=user-provided, hybrid=both
  confidence: "high|medium|low",             // high=strong evidence, medium=inferred, low=weak
  notes: "<optional debug info>"             // Optional: why confidence is what it is
}

DERIVATION RULES:
1. Extract primary_keywords from tone_of_voice (adjectives describing the style)
2. Extract writing_rules from tone_of_voice bullet rules (make them actionable)
3. Extract good_examples from "Eksempel:" lines in tone_of_voice
4. Extract avoid_examples from "Undgå:" lines OR create contrasting bad examples
5. Set formality based on evidence.tone_of_voice.formality_level OR infer from examples
6. Set emoji_level based on social_style.emoji_usage (map: expressive→frequent, moderate→moderate, minimal→minimal, none→none)
7. Set source="website" (always for automated generation)
8. Set confidence based on evidence strength:
   - high: ≥5 example phrases in evidence.tone_of_voice + has_consistent_language=true
   - medium: 2-4 examples OR has_consistent_language=true
   - low: <2 examples AND no consistency signal
9. Set notes to explain confidence (e.g., "5 example phrases found, consistent language detected")
10. Use current UTC timestamp for generated_at

VALIDATION:
- Arrays MUST meet min/max bounds (keywords 2-6, rules 3-8, good 2-6, avoid 2-6)
- All metadata fields required (version, language, generated_at, source, confidence)
- notes is optional but recommended for transparency

EXAMPLE tone_model:
{
  "primary_keywords": ["rolig", "jordnær", "uformel", "varm"],
  "writing_rules": [
    "Brug korte sætninger (max 15 ord)",
    "Ingen hype-sprog eller overdrivelser",
    "Inkluder konkrete detaljer (retter, stemning, tid)",
    "Brug du-form og direkte tiltale"
  ],
  "good_examples": [
    "Nyd brunch i eget tempo ved åen",
    "Kom forbi til kaffe og kage",
    "BOOK DIT BORD til aften"
  ],
  "avoid_examples": [
    "Fantastisk lækker brunch! (for hyped og bannede ord)",
    "Du vil ikke tro hvor godt det smager (clickbait)",
    "Den bedste café i byen (overdrivelse uden bevis)"
  ],
  "formality": "informal",
  "emoji_level": "minimal",
  "version": "2.0",
  "language": "da",
  "generated_at": "2026-01-09T10:30:00Z",
  "source": "website",
  "confidence": "high",
  "notes": "5 example phrases found in website text, consistent informal tone across all pages"
}

3) image_preferences.signature_shot

🚨🚨🚨 MANDATORY LOCATION PHRASE - MUST INCLUDE EXACTLY: 🚨🚨🚨
${location?.enrichment ? `"${location.enrichment.micro.area_type === 'waterfront' ? 'ved åen' : location.enrichment.micro.area_type === 'transit_hub' ? 'ved vinduet' : location.enrichment.micro.area_type === 'shopping_street' ? 'med gågade-liv' : location.enrichment.micro.area_type === 'tourist_area' ? 'med ikonisk udsigt' : location.enrichment.micro.area_type === 'residential' ? 'i kvarteret' : 'i city-atmosfære'}"` : `"ved åen" (or similar location phrase)`}
🚨🚨🚨 WRITE THIS PHRASE IN YOUR SIGNATURE SHOT 🚨🚨🚨

- Must describe an OBSERVABLE scene including ALL of:
  - scene (what is happening) - use verbs and nouns
  - lighting (e.g., morning light, golden hour, candlelight)
  - people/objects (at least one) - describe what's visible
  - location cue ← USE THE MANDATORY PHRASE ABOVE
- BANNED WORDS: "lækker", "hyggelig", "afslappet", "charmerende", "fantastisk"
- Use descriptive, observable language
${location?.enrichment && location.enrichment.micro.area_type === 'waterfront' ? `- CORRECT EXAMPLE: "Gæster der bliver siddende ved bordet ved åen i gyldent aftenlys, med flere retter og glas på bordet"` : '- Example: "Gæster der bliver siddende ved bordet ved åen i gyldent aftenlys, med flere retter og glas på bordet"'}
- Example (wrong): "Lækker mad og hyggelig oplevelse ved åen" (subjective, banned words)

4) target_audience.value
- TEMPORAL BEHAVIORAL FORMAT: Each clause = SITUATION + TIME + CONTEXT
- BUILD FROM: Select 2-4 usage_occasions from USAGE OCCASIONS section above
- REWRITE: Transform into natural Danish temporal phrases starting with "Når gæster..."

ALLOWED ELEMENTS:
  ✅ "Når gæster..." temporal framing (grammatical necessity, not persona)
  ✅ "børn kan spise med" (behavioral constraint, NOT persona "familier")
  ✅ "mellem møder", "før/efter arbejde" (temporal/time-of-day context)
  ✅ "med god tid ved bordet", "i eget tempo" (duration/tempo)
  ✅ "når aftenen glider..." (temporal flow)
  ✅ "hvor der er plads til..." (spatial constraint)

STRICT BAN - DEMOGRAPHIC PERSONAS:
  ❌ "familier", "børnefamilier", "par", "venner"
  ❌ "turister", "studerende", "lokale", "unge"
  ❌ "Gæster der søger...", "Folk som...", "Kunder der..." (persona-seeking framing)
  ❌ ANY demographic labels or persona framing

DISTINCTION:
  - "børn kan spise med" = behavioral constraint ✅
  - "familier med børn" = demographic persona ❌
  - "mellem møder" = temporal context ✅
  - "forretningsmænd" = demographic persona ❌

Pattern: "Når gæster [behavior + context], når [situation + time], samt når [transition]"

EXAMPLE (Café Faust):
  Input: ["weekend-brunch-with-kids", "work-lunch", "dinner-to-drinks"]
  Output: "Når gæster samles om længere brunch ved åen, når børn kan spise med uden bøvl, samt når aftenen glider fra middag til cocktails"
  
EXAMPLE (City Café):
  Input: ["work-lunch", "coffee-work", "after-work"]
  Output: "Når man søger hurtig frokost mellem møder, når der er god tid til kaffe og arbejde, samt efter arbejde ved baren"

VALIDATION: Read output aloud - if you hear a demographic label (familier, par, studerende), rewrite it
target_audience.proof MUST reference usage_occasion IDs

5) core_offerings.value
- Must be derived from MENU / CONCRETE ANCHORS / USE THESE PHRASES.
- Prefer a simple bullet list (lines starting with "- ") of 3–6 concrete offerings or categories.
- Not allowed: instructional placeholders (e.g., "Jeres…", "Jeres primære produkter eller services", "Perfekt til…", "Hvem…", ellipses "…/...").

6) content_focus.value
- USAGE-DRIVEN (map directly to usage_occasions and content_triggers)
- Must be 3–5 bullets describing what to post about
- Required coverage:
  1) Mad & servering: Observable dishes/service ("Retter der deles og bliver stående på bordet")
  2) Stemning & flow: Time/transition moments ("Overgangen fra dag til aften ved åen")
  3) Øjeblikke: Duration/behavior ("Lange ophold, samtaler, flere bestillinger over tid")
  Optional 4) BTS / preparation / space details
- NOT allowed: Menu-only focus ("Fokus på brunch og frokost")
- DERIVE FROM: content_triggers[] "what_to_show" and "copy_angles"
- Example: "Retter der deles og bliver stående på bordet, overgangen fra dag til aften ved åen, samt lange ophold med flere bestillinger"

7) cta_style.value
- Must define BOTH:
  - Primary CTA (booking / bordreservation)
  - Secondary soft CTAs (2–3 options like: se menu, kig forbi, del oplevelsen, følg med)
- Not allowed: only a single booking CTA (e.g., only "BOOK DIT BORD").

**AI IDEAS GENERATION RULES** (for downstream post suggestions):
- AI post ideas MUST read from:
  1) usage_occasions[] (Layer 1 - behavioral richness)
  2) content_triggers[] (Layer 2 - what to show + copy angles)
  3) tone_of_voice rules (not descriptive prose)
- DO NOT rely primarily on Brand Profile prose alone
- Brand Profile = compressed label for UI
- Internal layers = thinking for AI suggestions
- This separation ensures richer, more accurate post ideas

**OUTPUT**: Return JSON with these fields:
- brand_essence { value, proof }
- tone_of_voice { value, proof }
- tone_model { primary_keywords, writing_rules, good_examples, avoid_examples, formality, emoji_level, version, language, generated_at, source, confidence, notes }
- target_audience { value, proof }
- core_offerings { value, proof }
- content_focus { value, proof }
- content_pillars: [3-6 items] (choose from: Crave-worthy, BTS, Social proof, Vibe, Engagement, Offers)
  - Each item: { pillar, allowed, encouraged, notes }
  - allowed=true only if you can execute it using first-party inputs (menu/images/website/social).
  - encouraged=true only when it clearly fits the venue's Distinctive Hooks / Physical Space Cues.
  - 🚨 CRITICAL: If encouraged=true, notes MUST reference a hook by number (e.g., "#1", "#2") OR exact hook text
    Example: "Encouraged because of #1 (Brunch ved åen)"
    Example: "Fits the 'ved åen' location cue from hook #2"
    DON'T write generic notes like "Good fit" or "Matches brand" - REFERENCE SPECIFIC HOOKS!
- image_preferences { dos: [3], donts: [3], signature_shot }
- things_to_avoid { language_constraints: [2-8], factual_constraints: [2-8] }
- cta_style { value, proof } (use the CTA verbs above)
- communication_goal { value, proof } (1-2 sentences)
- social_style { emoji_usage: "none|minimal|moderate|expressive", emoji_examples: [3-6 fitting emojis], hashtag_strategy: { branded: [], category: [], local: [] } }
- voice_examples { do_say: [3-5 phrases], dont_say: [3-5 phrases], vocabulary: { prefer: [5-10 words], avoid: [5-10 words] } }
- internal_notes: []
- clarifications_needed: [] (put any gaps here, not in main fields)

**IMAGE PREFERENCES RULES (IMPORTANT)**:

**DOS** (3 visual best practices):
- Be SPECIFIC to this business's distinctive elements (location, space, style)
- Example: "Billeder ved åen med morgen/aftenlys", "Fokus på brunch-opsætninger og gæster"
- Base on actual evidence from uploaded images or website

**DON'TS** (3 visual anti-patterns - BE STRATEGIC, NOT OVERLY RESTRICTIVE):
- ONLY ban what genuinely conflicts with their brand or evidence
- DO allow legitimate content types: menu close-ups, BTS (behind-the-scene), solo product shots, prep work
- DO allow variation: indoor-only shots, ingredient close-ups, staff portraits, empty venue shots
- Focus DON'Ts on: 
  * Generic stock-photo feel
  * Wrong location context (if they have distinctive location)
  * Tone mismatch (e.g., "overdrevent polerede billeder" for casual places)
- AVOID overly restrictive rules like "Billeder uden gæster" or "Indendørs uden [location]"
- Example GOOD DON'Ts: "Generiske madbilleder uden personlighed", "Mørke billeder uden naturligt lys", "Stockfoto-æstetik"
- Example BAD DON'Ts: "Billeder uden gæster", "Solo produktbilleder", "Indendørs shots" (these are LEGITIMATE content types)

**SIGNATURE SHOT** (1 iconic description):
- Describe the MOST distinctive shot type for this venue
- Include: scene, lighting, people/objects, location cue
- Be specific but not overly prescriptive

**THINGS TO AVOID RULES (IMPORTANT)**:
- language_constraints: List ACTUAL banned words/phrases (not concepts)
  Examples: "hyggelig", "lækker", "indbydende", "afslappet/afslappede", "Den bedste...", "Den lækreste...", "Unik oplevelse"
  Alternative phrasing: "roligt tempo" (not "afslappet"), actual descriptors (not "lækker"), concrete details (not "hyggelig")
- factual_constraints: What the AI must NOT invent
  Examples: "Opfind ikke events (kun hvis det står på sitet)", "Opfind ikke live musik", "Opfind ikke tilbud/rabatter"
- NEVER block place-based detail (streets/entrance/interior/night-life context) unless legally required
  Not allowed: "Undgå at nævne specifikke lokationer", "undgå steder udenfor...", "don't mention streets"

**SOCIAL STYLE**:
- emoji_usage: Choose "none|minimal|moderate|expressive" based on brand formality
  * none: Legal, finance, grief, formal B2B
  * minimal (1-2): Most businesses (OPTIMAL - best engagement)
  * moderate (3-5): Casual brands
  * expressive (5+): Youth/entertainment only
- emoji_examples: Select 3-6 emojis that fit brand personality + industry
  * High-performers: 🔥🚀🎯❤️✨✅ (proven engagement)
  * Industry match: café/restaurant (☕🥐🍽️), bar (🍸🍻), fitness (💪🏃‍♀️)
  * Place at END of sentences (best performance)
- hashtag_strategy:
  * branded: #BusinessName, #Slogan
  * category: #brunch, #café, #restaurant
  * local: #${business?.city || 'city'}, #neighborhood

**VOICE EXAMPLES**:
- do_say: Write 3-5 phrases THIS brand would actually use (adapt to location + personality)
  * Hipster urban → "Drop by for a flat white ☕", "New roast just dropped"
  * Traditional → "Kom forbi til kaffe og kage", "Søndagsbrunch med udsigt"
  * Premium → "Reservér bord til en aften i køkkenet", "Sæsonens menu er klar"
- dont_say: Write 3-5 phrases that would feel WRONG for this brand
  * Match formality level (avoid tone mismatches)
- vocabulary: Choose words that fit their voice (gæster/kunder, hjemmelavet/premium)

Write in ${language.name}.`
}
