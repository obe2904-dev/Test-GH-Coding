// resolve-context.ts
// Handles all DB fetches and data normalization needed before prompt building.
// Exports two async functions consumed by the orchestrator in index.ts.

import type { Suggestion } from './types.ts'

// ── extractFirstSentence ────────────────────────────────────────────────
// Extract the first CONCRETE sentence from caption_base without AI.
// Skips all-caps headline fragments (strategic headers, not copy material).
function extractFirstSentence(text: string): string {
  if (!text) return ''
  const sentences = text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 10)
  for (const sentence of sentences) {
    const letters = sentence.match(/[a-zA-ZæøåÆØÅ]/g) || []
    const uppers = sentence.match(/[A-ZÆØÅ]/g) || []
    const upperRatio = letters.length > 0 ? uppers.length / letters.length : 0
    if (upperRatio < 0.35 && sentence.length > 15) {
      return sentence.replace(/^[.!?,;\s]+/, '').slice(0, 180).trim()
    }
  }
  const match = text.match(/[^.!?]{10,}[.!?]/)
  return match ? match[0].trim() : text.slice(0, 120).trim()
}

// ── sanitizeMenuDesc ────────────────────────────────────────────────────
// Strip add-on / upsell references so the AI cannot "see" other dishes.
// Patterns: "Tilkøb: X", "kan tilkøbes X", "+ X", parenthetical add-ons.
// Also strips marketing summary sentences (website copy describing the menu concept
// rather than the dish). These contain full-sentence verbs like "tilbyder", "giver
// mulighed", "henvender" etc. When passed to text generation they produce misleading
// words — most critically "tilbud" which Danish readers read as a price deal.
const sanitizeMenuDesc = (raw: string): string => {
  // First: strip sentence-by-sentence, removing marketing summary sentences.
  // A marketing sentence is >60 chars and contains concept verbs, not ingredient language.
  const marketingVerbPattern = /tilbyder|giver mulighed|henvender|inkluderer|sk\u00e6reddersyet|oplevelse|imødekommer|pr\u00e6ferencer|alternativer|v\u00e6lge mellem/i
  const cleaned = raw
    .split(/(?<=[.!?])\s+/)
    .filter(s => !(s.length > 60 && marketingVerbPattern.test(s)))
    .join(' ')
    .trim()
  return (cleaned || raw)  // never return empty if original had content — let other filters decide
    .replace(/\(?\+\s*[^).\n]{3,50}\)?/gi, '')               // (+ confiteret gris) or + confiteret gris
    .replace(/[.,]?\s*[Tt]ilk(?:ø|oe)b(?:es)?:?[^.\n]*/g, '') // Tilkøb: X / tilkøbes X
    .replace(/[.,]?\s*[Kk]an\s+tilk(?:ø|oe)bes[^.\n]*/g, '') // kan tilkøbes X
    .replace(/\s+eller\s+[A-ZÆØÅ][^.\n]{3,50}\.?$/g, '')      // " eller Confiteret gris" at sentence end
    // Strip standalone "tilbud" / "tilbuddet" / "tilbyder" when used as concept framing —
    // these are menu-selection language, not dish content, and "tilbud" will be read as
    // a price deal by social media readers.
    .replace(/\b[Bb]runch-?tilbud(?:det|s)?\b/g, 'brunchmenuen')
    .replace(/\b[Mm]enu-?tilbud(?:det|s)?\b/g, 'menuen')
    .replace(/\b[Tt]ilbud(?:det|s)?\s+giver/gi, 'menuen giver')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// ── BusinessContext ─────────────────────────────────────────────────────
// All business/brand/hours data resolved before content or prompt building.
export interface BusinessContext {
  businessName: string
  vertical: string
  city: string
  language: string
  // brand voice
  brandTone: string
  brandWritingRules: string[]
  brandGoodExamples: string[]
  brandAvoidExamples: string[]
  brandPreferVocab: string[]
  brandAvoidVocab: string[]
  locationVocabulary: string[]
  brandSignaturePhrases: string[]
  contentAnchors: string[]
  thingsToAvoid: string
  // NEW (June 12, 2026): Voice guardrails from voice_guardrails column
  forbidden_phrases: string[]            // Critical voice violations (never use these phrases)
  technical_terms: string[]              // Database/technical terms to avoid
  weather_cliches: string[]              // Weather clichés to replace with commercial mechanisms
  avoid_patterns?: {                     // Pattern-based guardrails (v5.1.3: split structure)
    brochure_language?: string[]
    superlatives?: string[]
    generic_marketing?: string[]
    generation_constraints?: {           // NEW v5.1.3: Prompt-level only (never strip!)
      compound_sentences?: string[]
    }
  }
  seasonal_notes: string[]
  voiceConstraints: string
  emojiInstruction: string
  typicalClosings: string[]
  bookingLink: string | null
  todayOpenTime: string
  todayCloseTime: string
  kitchenCloseTime: string
  reservationRequired: boolean
  acceptsWalkIns: boolean
  hasTableService: boolean
  hasTakeaway: boolean
  hasDelivery: boolean
  hasOutdoorSeating: boolean
  hasParking: boolean
  keyOfferings: string
  menuDescription: string
  userAboutText: string
  // brand identity & register anchor
  voiceRationale: string
  venueIdentity: string
  businessCharacter: string
  venueCharacter: string
  venueScene: string
  businessIdentityPersona: string        // Full persona with strategic segments (paid only)
  identityKeywords: string[]
  // NEW v5.5: Tone DNA fields from brand_profile_v5
  humorLevel: string                     // v5: voice.humor_style ('playful', 'dry', 'serious', etc.)
  formalityLevel: string                 // v5: voice.formality_level ('casual', 'semi-formal', 'formal')
  tone_dna?: any                         // v5.5: voice.tone_dna (full strategic tone structure)
  localLocationReference: string | null  // NEW (June 14, 2026): operator-set location phrase from business_location_intelligence
  locationIntelligenceNarrative?: string | null  // NEW (Fix 4): layer_0_intelligence.geographic_context.narrative for atmosphere posts
}

// ── ContentContext ──────────────────────────────────────────────────────
// Resolved content inputs: hook, INDHOLD block, dish lookup, filtered sig phrases.
export interface ContentContext {
  hook: string
  menuItemName: string
  menuItemDescription: string
  contentType: string
  isMenuPost: boolean
  resolvedGoalMode: string | undefined
  captionFirstLineUsedAsHook: boolean
  contentBlock: string
  brandSignaturePhrases: string[]  // context-filtered subset of BusinessContext.brandSignaturePhrases
}

// ── fetchBusinessContext ────────────────────────────────────────────────
// Fetches business info, brand voice (paid only), opening hours (paid only),
// and booking link (all tiers). Returns a flat BusinessContext record.
export async function fetchBusinessContext(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  businessId: string,
  isPaid: boolean
): Promise<BusinessContext> {
  // 1. Business name + location (parallel)
  const [businessResult, locationResult, locationIntelResult] = await Promise.all([
    supabase.from('businesses').select('name, vertical').eq('id', businessId).single(),
    supabase.from('business_locations').select('city, country').eq('business_id', businessId).eq('is_primary', true).single(),
    supabase.from('business_location_intelligence').select('local_location_reference').eq('business_id', businessId).maybeSingle()
  ])

  const businessName = businessResult.data?.name || 'din virksomhed'
  const vertical = businessResult.data?.vertical || 'cafe'
  const city = locationResult.data?.city || ''
  const country = locationResult.data?.country || 'Denmark'
  const language = country === 'Denmark' ? 'da'
    : country === 'Sweden' ? 'sv'
    : country === 'Germany' ? 'de'
    : 'da'

  // defaults
  let brandTone = ''
  let brandWritingRules: string[] = []
  let brandGoodExamples: string[] = []
  let brandAvoidExamples: string[] = []
  let brandPreferVocab: string[] = []
  let brandAvoidVocab: string[] = []
  let locationVocabulary: string[] = []
  let brandSignaturePhrases: string[] = []
  let contentAnchors: string[] = []
  let thingsToAvoid = ''
  let voiceConstraints = ''
  let emojiInstruction = '1-2 emojis naturligt placeret'
  let typicalClosings: string[] = []
  let bookingLink: string | null = null
  let todayOpenTime = ''
  let todayCloseTime = ''
  let kitchenCloseTime = ''
  let reservationRequired = false
  let acceptsWalkIns = true
  let hasTableService = false
  let hasTakeaway = false
  let hasDelivery = false
  let hasOutdoorSeating = false
  let hasParking = false
  let keyOfferings = ''
  let menuDescription = ''
  let userAboutText = ''
  let voiceRationale = ''
  let venueIdentity = ''
  let businessCharacter = ''
  let venueCharacter = ''
  let venueScene = ''
  let businessIdentityPersona = ''        // Full persona with strategic segments (paid only)
  let identityKeywords: string[] = []
  let geoNarrative: string | null = null
  // NEW (June 12, 2026): Voice guardrails from voice_guardrails column
  let forbidden_phrases: string[] = []
  let technical_terms: string[] = []
  let weather_cliches: string[] = []
  let avoid_patterns: { brochure_language?: string[], superlatives?: string[], generic_marketing?: string[] } | undefined = undefined
  let seasonal_notes: string[] = []
  // NEW v5.5: Tone DNA fields from brand_profile_v5
  let humorLevel = ''
  let formalityLevel = ''
  let tone_dna: any = null
  // NEW (June 14, 2026): operator-set location phrase (source of truth for location references)
  const localLocationReference: string | null = locationIntelResult?.data?.local_location_reference ?? null
  if (localLocationReference) {
    console.log('📍 local_location_reference loaded:', localLocationReference)
  }

  if (isPaid) {
    // 2. Brand voice
    const { data: brandProfile } = await supabase
      .from('business_brand_profile')
      .select('brand_essence, tone_of_voice, tone_model, content_strategy, things_to_avoid, voice_constraints, voice_examples, booking_link, voice_rationale, recognizable_interior_identity, business_identity_persona, identity_keywords, voice_guardrails, brand_profile_v5')
      .eq('business_id', businessId)
      .single()

    const brandProfileV5 = (brandProfile as any)?.brand_profile_v5 as any | undefined

    if (brandProfile) {
      bookingLink = (brandProfile as any).booking_link ?? null
    }

    if (brandProfile?.tone_of_voice) {
      const tov = brandProfile.tone_of_voice as any
      if (typeof tov === 'object' && tov !== null) {
        if (typeof tov.value === 'string' && tov.value.trim().length > 10) {
          // ✅ v5 format: tone_of_voice.value contains 5 writing rules as plain text
          brandTone = tov.value.trim()
        } else {
          // v2 legacy format: {primary_tone, attributes, formality_level}
          // NOTE: primary_keywords is intentionally excluded — it may contain product/identity
          // words (dish names, location markers) not style adjectives.
          const parts: string[] = []
          if (tov.primary_tone) parts.push(tov.primary_tone)
          if (Array.isArray(tov.attributes) && tov.attributes.length > 0) parts.push(tov.attributes.join(', '))
          if (tov.formality_level) parts.push(`formalitet: ${tov.formality_level}`)
          brandTone = parts.join(' · ') || ''
        }
      } else if (typeof tov === 'string') {
        brandTone = tov
      }
    }
    if (!brandTone && brandProfile?.brand_essence) {
      // Fallback: extract .value from v5 object, or use string directly
      const be = brandProfile.brand_essence as any
      brandTone = typeof be === 'object' && be?.value
        ? String(be.value).slice(0, 200)
        : extractFirstSentence(String(be || ''))
    }

    // v5: tone_model — writing rules, examples, emoji level
    if (brandProfile?.tone_model) {
      const tm = brandProfile.tone_model as any
      if (typeof tm === 'object' && tm !== null) {
        if (Array.isArray(tm.writing_rules)) brandWritingRules = tm.writing_rules.filter((s: any) => typeof s === 'string').slice(0, 5)
        if (Array.isArray(tm.good_examples)) brandGoodExamples = tm.good_examples.filter((s: any) => typeof s === 'string').slice(0, 3)
        if (Array.isArray(tm.avoid_examples)) brandAvoidExamples = tm.avoid_examples.filter((s: any) => typeof s === 'string').slice(0, 3)
        if (Array.isArray(tm.content_anchors)) contentAnchors = tm.content_anchors.filter((s: any) => typeof s === 'string').slice(0, 10)
        // content_strategy.anchors (from Pipeline B signal analysis) is authoritative — overrides legacy tone_model.content_anchors
        const cs = (brandProfile as any)?.content_strategy
        if (cs) {
          const csObj = typeof cs === 'string' ? (() => { try { return JSON.parse(cs) } catch { return null } })() : cs
          if (Array.isArray(csObj?.anchors) && csObj.anchors.length > 0) {
            contentAnchors = csObj.anchors.filter((s: any) => typeof s === 'string').slice(0, 3)
          }
        }
        // Emoji frequency from tone_model (v5) beats legacy tov.emoji_frequency
        const emojiLevel = tm.emoji_level || (brandProfile.tone_of_voice as any)?.emoji_frequency || 'moderate'
        emojiInstruction = emojiLevel === 'none' ? 'Brug INGEN emojis'
          : emojiLevel === 'minimal' || emojiLevel === 'low' ? '0-1 emoji maksimum'
          : emojiLevel === 'frequent' || emojiLevel === 'high' ? '2-3 emojis naturligt placeret'
          : '1-2 emojis naturligt placeret' // moderate (default)
      }
    } else {
      // v2 fallback emoji from tone_of_voice.emoji_frequency
      const emojiFreq = (brandProfile?.tone_of_voice as any)?.emoji_frequency || 'moderate'
      emojiInstruction = emojiFreq === 'none' ? 'Brug INGEN emojis'
        : emojiFreq === 'low' ? '0-1 emoji maksimum'
        : emojiFreq === 'high' ? '2-3 emojis naturligt placeret'
        : '1-2 emojis naturligt placeret'
    }

    if (brandProfile?.things_to_avoid) {
      const ta = brandProfile.things_to_avoid as any
      if (typeof ta === 'object' && ta !== null) {
        const parts: string[] = []
        if (Array.isArray(ta.language_constraints)) parts.push(...ta.language_constraints)
        if (Array.isArray(ta.banned_phrases)) parts.push(...ta.banned_phrases)
        if (Array.isArray(ta.tone_constraints)) parts.push(...ta.tone_constraints)
        thingsToAvoid = parts.join(', ') || ''
      } else {
        thingsToAvoid = String(ta)
      }
    }
    if (brandProfile?.voice_constraints) {
      // v5: {value: "...", proof: [...]} — extract .value only, never stringify whole object
      const vc = brandProfile.voice_constraints as any
      voiceConstraints = typeof vc === 'string' ? vc
        : (typeof vc === 'object' && typeof vc?.value === 'string') ? vc.value
        : ''
    }
    if (brandProfile?.voice_examples) {
      // v5: voice_examples.vocabulary.prefer — words the brand naturally uses
      // v5: voice_examples.vocabulary.avoid — words that don't fit this brand
      const ve = brandProfile.voice_examples as any
      if (Array.isArray(ve?.vocabulary?.prefer)) {
        brandPreferVocab = ve.vocabulary.prefer.filter((s: any) => typeof s === 'string').slice(0, 8)
      }
      if (Array.isArray(ve?.vocabulary?.avoid)) {
        brandAvoidVocab = ve.vocabulary.avoid.filter((s: any) => typeof s === 'string').slice(0, 8)
      }
    }
    // v5: voice_rationale — "Hvorfor denne anbefaling?" — register constraint for atmosphere posts
    if (brandProfile?.voice_rationale) {
      voiceRationale = typeof (brandProfile as any).voice_rationale === 'string' ? (brandProfile as any).voice_rationale.trim() : ''
    }
    // v5: recognizable_interior_identity — factual venue/interior description from photo analysis
    if ((brandProfile as any)?.recognizable_interior_identity) {
      const rii = (brandProfile as any).recognizable_interior_identity as any
      venueIdentity = typeof rii === 'string' ? rii.trim()
        : (typeof rii === 'object' && typeof rii?.value === 'string') ? rii.value.trim()
        : ''
    }
    // v5.5: business_identity_persona — full persona with strategic segments
    // Paid tiers use the Brand Profile V5 persona as the primary prompt input.
    const v5BusinessIdentityPersona = brandProfileV5
      ?.layer_0_intelligence
      ?.business_identity
      ?.system_persona

    if (typeof v5BusinessIdentityPersona === 'string' && v5BusinessIdentityPersona.trim().length > 0) {
      businessIdentityPersona = v5BusinessIdentityPersona.trim()
      console.log('✅ V5 business_identity.system_persona loaded')
    } else if (typeof (brandProfile as any)?.business_identity_persona === 'string') {
      businessIdentityPersona = String((brandProfile as any).business_identity_persona).trim()
    }
    // v5: identity_keywords — 3-5 identity chips (what the business IS)
    if ((brandProfile as any)?.identity_keywords) {
      const ik = (brandProfile as any).identity_keywords as any
      if (Array.isArray(ik)) {
        identityKeywords = ik.filter((s: any) => typeof s === 'string').slice(0, 5)
      } else if (typeof ik === 'object' && ik !== null) {
        const arr = ik.keywords || ik.values || ik.items
        if (Array.isArray(arr)) identityKeywords = arr.filter((s: any) => typeof s === 'string').slice(0, 5)
      }
    }

    // NEW (June 12, 2026): voice_guardrails — extract guardrails from flattened column
    if ((brandProfile as any)?.voice_guardrails) {
      const vg = (brandProfile as any).voice_guardrails as any
      
      // Extract array fields
      if (Array.isArray(vg.forbidden_phrases)) {
        forbidden_phrases = vg.forbidden_phrases.filter((s: any) => typeof s === 'string')
      }
      if (Array.isArray(vg.technical_terms)) {
        technical_terms = vg.technical_terms.filter((s: any) => typeof s === 'string')
      }
      if (Array.isArray(vg.weather_cliches)) {
        weather_cliches = vg.weather_cliches.filter((s: any) => typeof s === 'string')
      }
      
      // Extract nested avoid_patterns object (v5.1.3: use strip_from_output only)
      // CRITICAL: Do NOT extract generation_constraints (those contain common words like "når")
      if (vg.avoid_patterns && typeof vg.avoid_patterns === 'object') {
        const stripPatterns = (vg.avoid_patterns as any).strip_from_output || vg.avoid_patterns
        const genConstraints = (vg.avoid_patterns as any).generation_constraints
        
        avoid_patterns = {
          brochure_language: Array.isArray(stripPatterns.brochure_language) 
            ? stripPatterns.brochure_language.filter((s: any) => typeof s === 'string') 
            : undefined,
          superlatives: Array.isArray(stripPatterns.superlatives)
            ? stripPatterns.superlatives.filter((s: any) => typeof s === 'string')
            : undefined,
          generic_marketing: Array.isArray(stripPatterns.generic_marketing)
            ? stripPatterns.generic_marketing.filter((s: any) => typeof s === 'string')
            : undefined,
          // NEW v5.1.3: Extract generation constraints for prompt use (never for stripping!)
          generation_constraints: genConstraints ? {
            compound_sentences: Array.isArray(genConstraints.compound_sentences)
              ? genConstraints.compound_sentences.filter((s: any) => typeof s === 'string')
              : undefined
          } : undefined
        }
      }
      
      // ENHANCED: Merge never_say into thingsToAvoid
      if (Array.isArray(vg.never_say) && vg.never_say.length > 0) {
        const neverSayWords = vg.never_say.map((rule: string) => {
          // Extract banned word before → symbol
          const parts = rule.split('→').map((p: string) => p.trim())
          return parts[0]
        }).filter((s: string) => s.length > 0)
        
        // Combine with legacy thingsToAvoid
        const legacyThings = thingsToAvoid ? thingsToAvoid.split(', ').filter(s => s.trim().length > 0) : []
        const combined = [...legacyThings, ...neverSayWords]
        thingsToAvoid = combined.join(', ')
      }
      
      // Extract seasonal_notes and filter for current month
      // Format: ["oktober-marts: undgå terrasse-fokus", "december: julespecial tilladt"]
      if (Array.isArray(vg.seasonal_notes) && vg.seasonal_notes.length > 0) {
        const currentMonth = new Date().getMonth() + 1 // 1-12
        const monthNames = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december']
        const currentMonthName = monthNames[currentMonth - 1]
        
        for (const note of vg.seasonal_notes) {
          if (typeof note !== 'string') continue
          const noteLower = note.toLowerCase()
          
          // Check if note contains current month name
          if (noteLower.includes(currentMonthName)) {
            seasonal_notes.push(note)
            continue
          }
          
          // Check for month ranges (e.g., "oktober-marts")
          const rangeMatch = noteLower.match(/(\w+)-(\w+):/)
          if (rangeMatch) {
            const startMonth = monthNames.indexOf(rangeMatch[1]) + 1
            const endMonth = monthNames.indexOf(rangeMatch[2]) + 1
            
            if (startMonth > 0 && endMonth > 0) {
              // Handle year-wrapping ranges (e.g., oktober-marts spans across new year)
              const inRange = startMonth <= endMonth
                ? (currentMonth >= startMonth && currentMonth <= endMonth)
                : (currentMonth >= startMonth || currentMonth <= endMonth)
              
              if (inRange) {
                seasonal_notes.push(note)
              }
            }
          }
        }
      }
      
      console.log('🛡️ Voice guardrails loaded:', {
        forbidden_phrases: forbidden_phrases.length,
        technical_terms: technical_terms.length,
        weather_cliches: weather_cliches.length,
        avoid_patterns: avoid_patterns ? Object.keys(avoid_patterns).length : 0,
        never_say_merged: vg.never_say?.length || 0,
        seasonal_notes_active: seasonal_notes.length
      })
    }

    // NEW v5.5: Extract tone_dna from brand_profile_v5 (authoritative V5.5 source)
    // This replaces legacy flat columns (tone_of_voice, tone_model) with strategic synthesis
    
    if ((brandProfile as any)?.brand_profile_v5?.voice) {
      const v5Voice = brandProfileV5.voice
      
      // Extract humor and formality from V5 voice level (always present)
      humorLevel = v5Voice.humor_style || 'moderate'
      formalityLevel = v5Voice.formality_level || 'semi-formal'
      
      console.log('✅ V5 voice fields extracted:', {
        humor_style: humorLevel,
        formality_level: formalityLevel
      })
      
      // Extract tone_dna if available (V5.5 strategic synthesis)
      if (v5Voice.tone_dna && typeof v5Voice.tone_dna === 'object') {
        tone_dna = v5Voice.tone_dna
        
        // Use tone_positioning as authoritative brandTone (Danish, direct instruction)
        // FIXED: tone_positioning is nested under recommended_tone
        if (tone_dna.recommended_tone?.tone_positioning && typeof tone_dna.recommended_tone.tone_positioning === 'string') {
          brandTone = tone_dna.recommended_tone.tone_positioning.trim()
          console.log('✅ V5.5 tone_positioning extracted:', brandTone)
        }
        
        // Merge structural rules (tone_rules) + strategic rules (tone_do_list)
        const v5ToneRules = Array.isArray(v5Voice.tone_rules) 
          ? v5Voice.tone_rules.filter((s: any) => typeof s === 'string')
          : []
        const toneDNARules = Array.isArray(tone_dna.tone_do_list)
          ? tone_dna.tone_do_list.filter((s: any) => typeof s === 'string')
          : []
        
        // V5.5 rules override legacy tone_model.writing_rules
        if (v5ToneRules.length > 0 || toneDNARules.length > 0) {
          brandWritingRules = [...v5ToneRules, ...toneDNARules]
          console.log('✅ V5.5 brandWritingRules merged:', {
            tone_rules: v5ToneRules.length,
            tone_do_list: toneDNARules.length,
            total: brandWritingRules.length
          })
        }
        
        // V5.5 location vocabulary — extract as FACTUAL location references (separate from style vocab)
        if (tone_dna.location_driver) {
          const naturalVocab = Array.isArray(tone_dna.location_driver.natural_vocabulary)
            ? tone_dna.location_driver.natural_vocabulary.filter((s: any) => typeof s === 'string')
            : []
          const avoidVocab = Array.isArray(tone_dna.location_driver.avoid_vocabulary)
            ? tone_dna.location_driver.avoid_vocabulary.filter((s: any) => typeof s === 'string')
            : []
          
          if (naturalVocab.length > 0) {
            // Store as separate locationVocabulary (factual framing in prompt)
            locationVocabulary = naturalVocab.slice(0, 5)
            console.log('✅ V5.5 location natural_vocabulary extracted:', locationVocabulary)
          }          // Enforce local_location_reference as the first entry — it is the operator's
          // own words for the location and overrides any AI-generated vocabulary.
          if (localLocationReference) {
            locationVocabulary = [
              localLocationReference,
              ...locationVocabulary.filter(v => v !== localLocationReference)
            ].slice(0, 5)
            console.log('\u2705 local_location_reference enforced as first locationVocabulary entry:', localLocationReference)
          }          if (avoidVocab.length > 0) {
            // Prepend location avoids to existing brandAvoidVocab
            brandAvoidVocab = [...avoidVocab, ...brandAvoidVocab].slice(0, 8)
            console.log('✅ V5.5 location avoid_vocabulary merged:', avoidVocab)
          }
        }
        
        console.log('✅ V5.5 tone_dna loaded:', {
          has_strategic_summary: !!tone_dna.strategic_summary,
          tone_do_list: toneDNARules.length,
          tone_dont_list: tone_dna.tone_dont_list?.length || 0,
          has_location_driver: !!tone_dna.location_driver,
          has_culinary_character: !!tone_dna.culinary_character
        })
      } else {
        console.log('⚠️ V5.5 tone_dna not found - using legacy tone_model')
      }

      // NEW (Fix 4): Extract geographic_context.narrative for atmosphere/location posts
      // This provides Danish-language guidance about what tone and references to use
      // for this specific location type (e.g., riverfront vs. urban vs. beachside)
      geoNarrative = brandProfileV5
        ?.layer_0_intelligence
        ?.geographic_context
        ?.narrative
        || null
      
      if (geoNarrative) {
        console.log('✅ Geographic narrative extracted:', geoNarrative.substring(0, 100))
      }

      // V5.5: Override brandGoodExamples with writing_examples.good_examples (full posts generated
      // by tone DNA pipeline) — overrides legacy tone_model.good_examples (fragments/short phrases)
      const v5WritingExamples = brandProfileV5?.writing_examples
      if (Array.isArray(v5WritingExamples?.good_examples) && v5WritingExamples.good_examples.length > 0) {
        const v5GoodExamples = v5WritingExamples.good_examples
          .filter((s: any) => typeof s === 'string' && s.trim().length > 20)
        if (v5GoodExamples.length > 0) {
          brandGoodExamples = v5GoodExamples.slice(0, 5)
          console.log('✅ V5 writing_examples.good_examples override:', brandGoodExamples.length, 'examples (first 60 chars):', brandGoodExamples[0]?.slice(0, 60))
        }
      }

      if (identityKeywords.length === 0) {
        const v5CategoryKeywords = brandProfileV5?.identity?.category_keywords
        if (Array.isArray(v5CategoryKeywords)) {
          identityKeywords = v5CategoryKeywords.filter((s: any) => typeof s === 'string').slice(0, 5)
          if (identityKeywords.length > 0) {
            console.log('✅ V5 identity.category_keywords loaded:', identityKeywords)
          }
        }
      }

      if (locationVocabulary.length === 0) {
        const v5LocationReference = brandProfileV5?.identity?.location_identity?.full_reference
        if (typeof v5LocationReference === 'string' && v5LocationReference.trim().length > 0) {
          locationVocabulary = [v5LocationReference.trim()]
          console.log('✅ V5 identity.location_identity.full_reference loaded:', v5LocationReference)
        }
      }
    } else {
      console.log('⚠️ brand_profile_v5 not found - using legacy flat columns')
    }

    // F1: v5 dedup — tone_of_voice.value and tone_model.writing_rules are produced by the
    // same pipeline pass and contain the same 5 rules in two formats (prose vs bullets).
    // Keep only the structured bullet form to avoid sending identical guidance twice.
    if (brandWritingRules.length >= 3 && brandTone) brandTone = ''
    // Fallback: if tone_dna had no location vocabulary but we have a factual reference, use it alone.
    if (locationVocabulary.length === 0 && localLocationReference) {
      locationVocabulary = [localLocationReference]
      console.log('📍 local_location_reference set as locationVocabulary (no tone_dna vocab):', localLocationReference)
    }
    console.log('💮 Brand tone (v5):', brandTone.substring(0, 80), '| writingRules:', brandWritingRules.length, '| examples:', brandGoodExamples.length, '| emoji:', emojiInstruction, '| closings:', typicalClosings.length, '| signaturePhrases:', brandSignaturePhrases.length, '| contentAnchors:', contentAnchors.length, '| voiceRationale:', voiceRationale.length > 0, '| persona:', businessIdentityPersona.length > 0)

    // 3. Opening hours (paid only — factual time constraint)
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const todayName = dayNames[new Date().getDay()]
    const { data: hoursRows } = await supabase
      .from('opening_hours')
      .select('open_time, close_time, closed')
      .eq('business_id', businessId)
      .eq('kind', 'normal')
      .eq('weekday', todayName)
      .limit(1)
    const todayHours = hoursRows?.[0]
    if (todayHours && !todayHours.closed) {
      todayOpenTime = todayHours.open_time || ''
      console.log('⏰ Opening hours:', todayOpenTime)
    }
  } else {
    // Free tier: resolve factual profile, menu, hours, and operations directly.
    const todayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date().getDay()]
    const [profileResult, operationsResult, hoursResult, brandResult] = await Promise.all([
      supabase
        .from('business_profile')
        .select('key_offerings, menu_description, user_about_text')
        .eq('business_id', businessId)
        .single(),
      supabase
        .from('business_operations')
        .select('reservation_required, accepts_walk_ins, has_table_service, has_takeaway, has_delivery, has_outdoor_seating, has_parking, kitchen_close_time')
        .eq('business_id', businessId)
        .maybeSingle(),
      supabase
        .from('opening_hours')
        .select('open_time, close_time, closed')
        .eq('business_id', businessId)
        .eq('kind', 'normal')
        .eq('weekday', todayName)
        .limit(1),
      supabase
        .from('business_brand_profile')
        .select('booking_link, menu_signal')
        .eq('business_id', businessId)
        .single(),
    ])

    const profileRow = profileResult.data as any
    const operationsRow = operationsResult.data as any
    const todayHours = hoursResult.data?.[0]
    const brandRow = brandResult.data as any

    bookingLink = brandRow?.booking_link ?? null

    if (typeof profileRow?.key_offerings === 'string' && profileRow.key_offerings.trim()) {
      keyOfferings = profileRow.key_offerings.trim()
      const offeringLines = keyOfferings
        .split(/\r?\n/)
        .map((value: string) => value.trim())
        .filter((value: string) => value.length > 0)
      contentAnchors = [...contentAnchors, ...offeringLines]
        .filter((value, index, array) => array.findIndex(item => item.toLowerCase() === value.toLowerCase()) === index)
        .slice(0, 10)
      console.log('📋 Free-tier key_offerings loaded:', offeringLines.length)
    }

    if (typeof profileRow?.menu_description === 'string' && profileRow.menu_description.trim()) {
      menuDescription = profileRow.menu_description.trim()
    }

    if (typeof profileRow?.user_about_text === 'string' && profileRow.user_about_text.trim()) {
      userAboutText = profileRow.user_about_text.trim()
    }

    businessCharacter = menuDescription || userAboutText || ''
    venueIdentity = userAboutText || menuDescription || ''
    venueCharacter = menuDescription || keyOfferings || ''
    venueScene = userAboutText || menuDescription || ''

    reservationRequired = operationsRow?.reservation_required ?? false
    acceptsWalkIns = operationsRow?.accepts_walk_ins ?? true
    hasTableService = operationsRow?.has_table_service ?? false
    hasTakeaway = operationsRow?.has_takeaway ?? false
    hasDelivery = operationsRow?.has_delivery ?? false
    hasOutdoorSeating = operationsRow?.has_outdoor_seating ?? false
    hasParking = operationsRow?.has_parking ?? false
    kitchenCloseTime = operationsRow?.kitchen_close_time ?? ''

    if (todayHours && !todayHours.closed) {
      todayOpenTime = todayHours.open_time || ''
      todayCloseTime = todayHours.close_time || ''
      console.log('⏰ Free-tier opening hours:', todayOpenTime, todayCloseTime)
    }

    const menuSignal = brandRow?.menu_signal
    if (menuSignal && typeof menuSignal === 'object') {
      const freeAnchors: string[] = []
      const addAnchor = (value: unknown) => {
        if (typeof value !== 'string') return
        const anchor = value.trim()
        if (!anchor) return
        const exists = freeAnchors.some(existing => existing.toLowerCase() === anchor.toLowerCase())
        if (!exists) freeAnchors.push(anchor)
      }

      if (typeof menuSignal.placeSynopsis === 'string' && menuSignal.placeSynopsis.trim()) {
        addAnchor(menuSignal.placeSynopsis)
      }
      if (Array.isArray(menuSignal.menuCategories)) {
        menuSignal.menuCategories.slice(0, 5).forEach(addAnchor)
      }
      if (Array.isArray(menuSignal.programmes) && freeAnchors.length < 5) {
        menuSignal.programmes.slice(0, 5).forEach((programme: any) => {
          addAnchor(programme?.role)
          addAnchor(programme?.timeContext)
        })
      }
      if (Array.isArray(menuSignal.signatureItems) && freeAnchors.length < 5) {
        menuSignal.signatureItems.slice(0, 5).forEach(addAnchor)
      }

      if (freeAnchors.length > 0) {
        contentAnchors = [...contentAnchors, ...freeAnchors]
          .filter((value, index, array) => array.findIndex(item => item.toLowerCase() === value.toLowerCase()) === index)
          .slice(0, 10)
        console.log('🍽️ Free-tier menu anchors loaded:', freeAnchors)
      }
    }
  }

  return {
    businessName, vertical, city, language,
    brandTone, brandWritingRules, brandGoodExamples, brandAvoidExamples,
    brandPreferVocab, brandAvoidVocab, locationVocabulary, brandSignaturePhrases, contentAnchors,
    thingsToAvoid, forbidden_phrases, technical_terms, weather_cliches, avoid_patterns, seasonal_notes,
    voiceConstraints, emojiInstruction,
    typicalClosings, bookingLink, todayOpenTime, todayCloseTime, kitchenCloseTime,
    reservationRequired, acceptsWalkIns, hasTableService, hasTakeaway, hasDelivery, hasOutdoorSeating, hasParking,
    keyOfferings, menuDescription, userAboutText,
    voiceRationale, venueIdentity, businessIdentityPersona, identityKeywords,
    businessCharacter, venueCharacter, venueScene,
    humorLevel, formalityLevel, tone_dna,
    localLocationReference,
    locationIntelligenceNarrative: geoNarrative || null,
  }
}

// ── resolveContentContext ───────────────────────────────────────────────
// Resolves hook, contentBlock, menu item lookup, and context-aware signature
// phrase filtering. Takes the raw brandSignaturePhrases from BusinessContext
// and returns a filtered subset alongside all other content inputs.
export async function resolveContentContext(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  businessId: string,
  suggestion: Suggestion,
  source: string,
  rawBrandSignaturePhrases: string[],
  isPaid: boolean
): Promise<ContentContext> {
  // Hook — for Weekly Plan non-menu posts, captionFirstLine gives a richer scene opener
  // for SCENE:/STEMNING: in contentBlock than the bare title.
  const isMenuPostForHook = suggestion.contentType === 'menu_item'
    || suggestion.contentType === 'product_menu'
    || suggestion.contentType === 'craving_visual'
  const captionFirstLineUsedAsHook = source === 'weekly_plan'
    && !isMenuPostForHook
    && !!suggestion.captionFirstLine
  const hook = captionFirstLineUsedAsHook
    ? suggestion.captionFirstLine!
    : (suggestion.title || '')

  let menuItemName = suggestion.menuItemName || ''
  let rawMenuItemDescription = suggestion.menuItemDescription || ''
  let menuItemCategory = ''  // Category for meal course context (FORRETTER, HOVEDRETTER, etc.)
  // captionBase duplicates menuItemDescription for menu posts on the AI Ideas path;
  // use it as a fallback so description survives even if only one field arrived.
  if (!rawMenuItemDescription && isMenuPostForHook) {
    rawMenuItemDescription = suggestion.captionBase || ''
  }

  // ── ID-BASED LOOKUP (Primary Method) ────────────────────────────────────────
  // When menu_item_id is available, use direct UUID lookup to avoid ALL name-matching
  // fragility (truncated names, ALL CAPS, wrong dish matches, etc.)
  if (suggestion.menuItemId && isMenuPostForHook) {
    console.log('🔑 ID-based lookup for menu item:', suggestion.menuItemId)
    const { data: menuItemById, error } = await supabase
      .from('menu_items_normalized')
      .select('item_name, item_description, category_name')
      .eq('id', suggestion.menuItemId)
      .eq('is_active', true)  // Only lookup active menu items
      .single()
    
    if (menuItemById && !error) {
      // Always use the full name from DB (fixes truncated names like "AVOCADO" → "AVOCADO SANDWICH")
      menuItemName = menuItemById.item_name
      menuItemCategory = menuItemById.category_name || ''
      // Only use DB description if we don't already have a curated brief
      if (!rawMenuItemDescription || rawMenuItemDescription.length < 30) {
        rawMenuItemDescription = menuItemById.item_description || ''
      }
      console.log('✅ ID lookup success:', {
        itemName: menuItemById.item_name,
        category: menuItemById.category_name,
        descriptionPreview: (menuItemById.item_description || '').slice(0, 80)
      })
    } else {
      console.warn('⚠️ ID lookup failed for:', suggestion.menuItemId, error?.message || 'Not found')
      // Fall through to name-based lookup below
    }
  }

  // ── NAME-BASED LOOKUP (Fallback for legacy suggestions without menu_item_id) ─
  // Look up per-dish description from menu_items_normalized.
  // Weekly Plan is expected to receive a clean description via mapIdeaToEnrichedSlot,
  // but falls through here as a safety net when the name extraction in that function
  // fails (e.g. Phase 2b titles like "Steak Sandwich, med mør ribeye...").
  // The inner hasCuratedBrief and resolvedMenuItemName guards make this safe to run
  // for all sources: if data is already present the inner blocks are skipped.
  if (isMenuPostForHook) {
    // If the saved description looks like a Gemini-curated ingredient brief (≥30 chars,
    // comma-separated, no newlines), trust it and skip the DB description re-fetch.
    // A sparse entry like "Sæsonal specialitet" (19 chars) will NOT match and will fall
    // through to the normal lookup cascade.
    const hasCuratedBrief = rawMenuItemDescription.length >= 30
      && !rawMenuItemDescription.includes('\n')
      && rawMenuItemDescription.split(',').length >= 2
    if (hasCuratedBrief) {
      console.log('✅ Using curated dish_text_brief — skipping description re-fetch:', rawMenuItemDescription.slice(0, 60))
    }

    // If no explicit menuItemName was passed (common from AI Ideas path where the dish
    // name is embedded in the suggestion title), try to extract it by matching title
    // tokens against menu_items_normalized.
    let resolvedMenuItemName = menuItemName
    if (!resolvedMenuItemName && isMenuPostForHook) {
      const tokens = hook.split(/\s+/).filter(w => w.length >= 4)
      for (const token of tokens) {
        const { data: tokenMatch } = await supabase
          .from('menu_items_normalized')
          .select('item_name, item_description, category_name')
          .eq('business_id', businessId)
          .eq('is_active', true)
          .ilike('item_name', `%${token}%`)
          .limit(1)
          .maybeSingle()
        if (tokenMatch?.item_name) {
          resolvedMenuItemName = tokenMatch.item_name
          menuItemCategory = tokenMatch.category_name || ''
          // Only use the DB description from the token match if we don't have a curated brief
          if (!hasCuratedBrief) rawMenuItemDescription = tokenMatch.item_description || ''
          console.log('🍽️ Extracted dish from title token:', resolvedMenuItemName)
          break
        }
      }
    }
    // Look up description from DB only when no curated brief arrived with the suggestion
    if (resolvedMenuItemName && !hasCuratedBrief) {
      // Only do a dedicated description lookup if we haven't already set it from the token match
      if (!rawMenuItemDescription) {
        const { data: normalizedItem } = await supabase
          .from('menu_items_normalized')
          .select('item_description')
          .eq('business_id', businessId)
          .eq('is_active', true)
          .ilike('item_name', `%${resolvedMenuItemName}%`)
          .limit(1)
          .maybeSingle()
        const normalizedDesc = (normalizedItem?.item_description || '').trim()
        if (normalizedDesc.length >= 10) {
          const isListFormat = normalizedDesc.includes('\n') || normalizedDesc.split(',').length >= 5
          if (!isListFormat) rawMenuItemDescription = normalizedDesc
        }
      }
      // Final fallback: search directly in menu_results_v2.structured_data for the item description.
      // This catches cases where menu-sync hasn’t run or item_description wasn’t populated.
      if (!rawMenuItemDescription) {
        const { data: menuResults } = await supabase
          .from('menu_results_v2')
          .select('structured_data')
          .eq('business_id', businessId)
          .limit(5)
        if (menuResults) {
          const nameLower = resolvedMenuItemName.toLowerCase()
          outer: for (const row of menuResults) {
            const cats = row.structured_data?.categories || []
            for (const cat of cats) {
              for (const item of (cat.items || [])) {
                if (item.name && item.name.toLowerCase().includes(nameLower.slice(0, 6))) {
                  const desc = (item.description || '').trim()
                  if (desc.length >= 10) {
                    rawMenuItemDescription = desc
                    console.log('🍽️ Found description in menu_results_v2:', desc.slice(0, 60))
                    break outer
                  }
                }
              }
            }
          }
        }
      }
    }
    // Promote the resolved name back so the rest of the function sees it
    if (resolvedMenuItemName && !menuItemName) {
      menuItemName = resolvedMenuItemName
    }
  }

  const menuItemDescription = sanitizeMenuDesc(rawMenuItemDescription)
  const contentType = suggestion.contentType || 'atmosphere'
  const isMenuPost = contentType === 'menu_item' || contentType === 'product_menu' || contentType === 'craving_visual'

  // Derive a default goalMode for AI Ideer when none is explicitly set.
  // menu_item/product posts → drive_footfall; all other types → build_brand.
  // Weekly Plan always provides an explicit goalMode from Phase 2b.
  const resolvedGoalMode: string | undefined = suggestion.goalMode
    || (source === 'ai_ideas' ? (isMenuPost ? 'drive_footfall' : 'build_brand') : undefined)

  // Build content block — branches on contentType + whether a specific menu item is named.
  // captionBase is strategic context for the human reader, NOT copy material — excluded.
  let contentBlock = ''
  if (menuItemName) {
    // Use only base name (before any parenthetical offer description) for the RET: prefix
    const menuItemLabel = menuItemName.replace(/\s*\(.*$/, '').trim() || menuItemName
    const categoryPart = menuItemCategory ? ` [${menuItemCategory}]` : ''
    const descPart = menuItemDescription ? `\n${menuItemDescription}` : ''
    if (contentType === 'behind_scenes') {
      contentBlock = `SCENE: ${hook}\nRET DER FORBEREDES: ${menuItemLabel}${categoryPart}${descPart}`
    } else if (contentType === 'atmosphere' || contentType === 'retain_loyalty') {
      contentBlock = `STEMNING: ${hook}\nRET DER NÆVNES: ${menuItemLabel}${categoryPart}${descPart}`
    } else {
      // product_menu / menu_item / craving_visual
      contentBlock = `RET: ${menuItemLabel}${categoryPart}${descPart}`
    }
    // Inject LEJLIGHED/VISUEL RETNING for named menu items on the AI Ideas path
    if (source === 'ai_ideas') {
      // PHASE 2 Week 2: Use occasion_context if available (dedicated creative brief)
      if (suggestion.occasionContext && suggestion.occasionContext.trim().length >= 15) {
        contentBlock += `\nLEJLIGHED: ${suggestion.occasionContext.trim()}`
      }
      // Fallback: Extract from why_explanation (legacy path)
      else if (suggestion.whyExplanation) {
        const firstSentence = suggestion.whyExplanation.split(/\.\s+/)[0].replace(/\.$/, '').trim()
        const LOCATION_MOOD_KW = ['ved åen', 'hos os', 'i byen', 'ved vandet', 'ved søen', 'ved stranden', 'ved kanalen', 'ved havnen']
        const isLocationMood = LOCATION_MOOD_KW.some(kw => firstSentence.toLowerCase().includes(kw))
        if (firstSentence.length >= 20 && firstSentence.length <= 200 && !isLocationMood) {
          contentBlock += `\nLEJLIGHED: ${firstSentence}`
        }
      }
      // FIX: Photo instructions removed from caption context (see line ~809 for detailed comment)
    }
  } else {
    if (contentType === 'behind_scenes') {
      contentBlock = `SCENE: ${hook}`
    } else if (isMenuPost) {
      // menu post without a named item — use legacy menu list fallback below
      contentBlock = `RET: ${hook}`
    } else {
      contentBlock = `STEMNING: ${hook}`
    }
    // For AI Ideas: inject occasion_context or first sentence of whyExplanation as occasion/context.
    // Non-menu posts use KONTEKST (scene/occasion angle).
    // Menu posts use LEJLIGHED (timing hint for why this dish now).
    if (source === 'ai_ideas') {
      // PHASE 2 Week 2: Use occasion_context if available (dedicated creative brief)
      if (suggestion.occasionContext && suggestion.occasionContext.trim().length >= 15) {
        const label = isMenuPost ? 'LEJLIGHED' : 'KONTEKST'
        contentBlock += `\n${label}: ${suggestion.occasionContext.trim()}`
      }
      // Fallback: Extract from why_explanation (legacy path)
      else if (suggestion.whyExplanation) {
        const firstSentence = suggestion.whyExplanation.split(/\.\s+/)[0].replace(/\.$/, '').trim()
        // Strip sentences that are purely location-mood ("pause ved åen", "hos os", etc.) —
        // these add no commercial argument and echo verbatim into the generated text.
        const LOCATION_MOOD_KW = ['ved åen', 'hos os', 'i byen', 'ved vandet', 'ved søen', 'ved stranden', 'ved kanalen', 'ved havnen']
        const isLocationMood = LOCATION_MOOD_KW.some(kw => firstSentence.toLowerCase().includes(kw))
        if (firstSentence.length >= 20 && firstSentence.length <= 200 && !isLocationMood) {
          const label = isMenuPost ? 'LEJLIGHED' : 'KONTEKST'
          contentBlock += `\n${label}: ${firstSentence}`
        }
      }
      // FIX: Do NOT inject photo instructions into caption generation context
      // Photo instructions are metadata for the photography step, not content for the AI to paraphrase into the caption
      // Previously this caused Gemini to write: "📸 Husk at fange øjeblikket med kameraet..."
      // Photo guidance is already stored separately in photo_idea/media_suggestion field
    }
  }

  // Legacy menu list fallback: only for menu posts that have no named item
  if (isPaid && isMenuPost && !menuItemName) {
    const { data: profile } = await supabase
      .from('business_profile')
      .select('website_analysis_data')
      .eq('business_id', businessId)
      .single()
    const items: string[] = []
    const offerings = profile?.website_analysis_data?.offerings
    if (offerings?.menuStructure) {
      for (const cat of offerings.menuStructure) {
        for (const item of (cat.items || [])) {
          items.push(item.name)
          if (items.length >= 5) break
        }
        if (items.length >= 5) break
      }
    }
    if (items.length > 0) {
      contentBlock += `\nRETTER FRA MENUEN:\n${items.join('\n')}\n⚠️ Brug KUN retter fra listen — opfind ikke nye.`
    }
  }

  // Context-aware signature phrase filtering — remove phrases that directly contradict
  // the idea's intent. Example: outdoor seating phrases must not appear in indoor-warmth posts.
  const OUTDOOR_PHRASE_KW = ['udeservering', 'terrasse', 'udendørs', 'havedining', 'udeafdeling', 'outdoor', 'udetjeneste', 'rooftop', 'havemiljø']
  const INDOOR_WARMTH_KW  = ['varme', 'varm', 'indenfor', 'ly fra', 'tag over', 'søg ly', 'lunt ', 'lunten', 'indendørs', 'komfort indenfor', 'come inside', 'step inside', 'træd ind']
  const hookLower = hook.toLowerCase()
  const isIndoorWarmthContext = INDOOR_WARMTH_KW.some(kw => hookLower.includes(kw))
  let brandSignaturePhrases = rawBrandSignaturePhrases
  if (isIndoorWarmthContext) {
    const before = brandSignaturePhrases.length
    brandSignaturePhrases = brandSignaturePhrases.filter(
      p => !OUTDOOR_PHRASE_KW.some(kw => p.toLowerCase().includes(kw))
    )
    if (brandSignaturePhrases.length < before) {
      console.log('🔦 Filtered', before - brandSignaturePhrases.length, 'outdoor signature phrase(s) — indoor warmth hook:', hook)
    }
  }

  return {
    hook, menuItemName, menuItemDescription, contentType, isMenuPost,
    resolvedGoalMode, captionFirstLineUsedAsHook, contentBlock, brandSignaturePhrases,
  }
}
