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
  brandSignaturePhrases: string[]
  contentAnchors: string[]
  thingsToAvoid: string
  voiceConstraints: string
  emojiInstruction: string
  typicalClosings: string[]
  bookingLink: string | null
  todayOpenTime: string
  // brand identity & register anchor
  voiceRationale: string
  venueIdentity: string
  businessCharacter: string
  identityKeywords: string[]
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
  const [businessResult, locationResult] = await Promise.all([
    supabase.from('businesses').select('name, vertical').eq('id', businessId).single(),
    supabase.from('business_locations').select('city, country').eq('business_id', businessId).eq('is_primary', true).single()
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
  let brandSignaturePhrases: string[] = []
  let contentAnchors: string[] = []
  let thingsToAvoid = ''
  let voiceConstraints = ''
  let emojiInstruction = '1-2 emojis naturligt placeret'
  let typicalClosings: string[] = []
  let bookingLink: string | null = null
  let todayOpenTime = ''
  let voiceRationale = ''
  let venueIdentity = ''
  let businessCharacter = ''
  let identityKeywords: string[] = []

  if (isPaid) {
    // 2. Brand voice
    const { data: brandProfile } = await supabase
      .from('business_brand_profile')
      .select('brand_essence, tone_of_voice, tone_model, content_strategy, things_to_avoid, voice_constraints, typical_closings, voice_examples, signature_phrases, booking_link, voice_rationale, recognizable_interior_identity, business_character, identity_keywords')
      .eq('business_id', businessId)
      .single()

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
    if (brandProfile?.typical_closings) {
      const tc = brandProfile.typical_closings as any
      const stripEmoji = (s: string) => s.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim()
      if (Array.isArray(tc)) {
        typicalClosings = tc.filter((s: any) => typeof s === 'string').map(stripEmoji)
      } else if (typeof tc === 'object' && tc !== null && Array.isArray(tc.closings)) {
        typicalClosings = tc.closings.filter((s: any) => typeof s === 'string').map(stripEmoji)
      }
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
    // v5: signature_phrases — brand-specific phrases to weave in naturally
    const sp = (brandProfile as any)?.signature_phrases
    if (Array.isArray(sp)) brandSignaturePhrases = sp.filter((s: any) => typeof s === 'string').slice(0, 6)
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
    // v5: business_character — AI plain-text description of what the business is
    if ((brandProfile as any)?.business_character) {
      const bc = (brandProfile as any).business_character as any
      businessCharacter = typeof bc === 'string' ? bc.trim()
        : (typeof bc === 'object' && bc?.value) ? String(bc.value).trim() : ''
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
    // F1: v5 dedup — tone_of_voice.value and tone_model.writing_rules are produced by the
    // same pipeline pass and contain the same 5 rules in two formats (prose vs bullets).
    // Keep only the structured bullet form to avoid sending identical guidance twice.
    if (brandWritingRules.length >= 3 && brandTone) brandTone = ''
    console.log('💎 Brand tone (v5):', brandTone.substring(0, 80), '| writingRules:', brandWritingRules.length, '| examples:', brandGoodExamples.length, '| emoji:', emojiInstruction, '| closings:', typicalClosings.length, '| signaturePhrases:', brandSignaturePhrases.length, '| contentAnchors:', contentAnchors.length, '| voiceRationale:', voiceRationale.length > 0, '| businessCharacter:', businessCharacter.length > 0)

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
    // Free tier: still resolve booking_link so we can gate the booking CTA correctly.
    const { data: freeBooking } = await supabase
      .from('business_brand_profile')
      .select('booking_link')
      .eq('business_id', businessId)
      .single()
    bookingLink = (freeBooking as any)?.booking_link ?? null
  }

  return {
    businessName, vertical, city, language,
    brandTone, brandWritingRules, brandGoodExamples, brandAvoidExamples,
    brandPreferVocab, brandAvoidVocab, brandSignaturePhrases, contentAnchors,
    thingsToAvoid, voiceConstraints, emojiInstruction,
    typicalClosings, bookingLink, todayOpenTime,
    voiceRationale, venueIdentity, businessCharacter, identityKeywords,
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
  rawBrandSignaturePhrases: string[]
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
  // captionBase duplicates menuItemDescription for menu posts on the AI Ideas path;
  // use it as a fallback so description survives even if only one field arrived.
  if (!rawMenuItemDescription && isMenuPostForHook) {
    rawMenuItemDescription = suggestion.captionBase || ''
  }

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
          .select('item_name, item_description')
          .eq('business_id', businessId)
          .ilike('item_name', `%${token}%`)
          .limit(1)
          .maybeSingle()
        if (tokenMatch?.item_name) {
          resolvedMenuItemName = tokenMatch.item_name
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
    const descPart = menuItemDescription ? `\n${menuItemDescription}` : ''
    if (contentType === 'behind_scenes') {
      contentBlock = `SCENE: ${hook}\nRET DER FORBEREDES: ${menuItemLabel}${descPart}`
    } else if (contentType === 'atmosphere' || contentType === 'retain_loyalty') {
      contentBlock = `STEMNING: ${hook}\nRET DER NÆVNES: ${menuItemLabel}${descPart}`
    } else {
      // product_menu / menu_item / craving_visual
      contentBlock = `RET: ${menuItemLabel}${descPart}`
    }
    // Inject LEJLIGHED/VISUEL RETNING for named menu items on the AI Ideas path too
    if (source === 'ai_ideas' && suggestion.whyExplanation) {
      const firstSentence = suggestion.whyExplanation.split(/\.\s+/)[0].replace(/\.$/, '').trim()
      const LOCATION_MOOD_KW = ['ved åen', 'hos os', 'i byen', 'ved vandet', 'ved søen', 'ved stranden', 'ved kanalen', 'ved havnen']
      const isLocationMood = LOCATION_MOOD_KW.some(kw => firstSentence.toLowerCase().includes(kw))
      if (firstSentence.length >= 20 && firstSentence.length <= 200 && !isLocationMood) {
        contentBlock += `\nLEJLIGHED: ${firstSentence}`
      }
      if (suggestion.photoIdea) {
        contentBlock += `\nVISUEL RETNING: ${suggestion.photoIdea}`
      }
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
    // For AI Ideas: inject first sentence of whyExplanation as occasion/context.
    // Non-menu posts use KONTEKST (scene/occasion angle).
    // Menu posts use LEJLIGHED (timing hint for why this dish now).
    if (source === 'ai_ideas' && suggestion.whyExplanation) {
      const firstSentence = suggestion.whyExplanation.split(/\.\s+/)[0].replace(/\.$/, '').trim()
      // Strip sentences that are purely location-mood ("pause ved åen", "hos os", etc.) —
      // these add no commercial argument and echo verbatim into the generated text.
      const LOCATION_MOOD_KW = ['ved åen', 'hos os', 'i byen', 'ved vandet', 'ved søen', 'ved stranden', 'ved kanalen', 'ved havnen']
      const isLocationMood = LOCATION_MOOD_KW.some(kw => firstSentence.toLowerCase().includes(kw))
      if (firstSentence.length >= 20 && firstSentence.length <= 200 && !isLocationMood) {
        const label = isMenuPost ? 'LEJLIGHED' : 'KONTEKST'
        contentBlock += `\n${label}: ${firstSentence}`
      }
      // Inject media/visual direction so the copy aligns with what the user will photograph
      if (suggestion.photoIdea) {
        contentBlock += `\nVISUEL RETNING: ${suggestion.photoIdea}`
      }
    }
  }

  // Legacy menu list fallback: only for menu posts that have no named item
  if (isMenuPost && !menuItemName) {
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
