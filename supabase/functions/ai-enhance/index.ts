// ai-enhance/index.ts
// Enhances a user-written Skriv Selv caption using brand voice, menu data, and location intelligence.
// For paid tiers: fetches brand profile, detects menu items, resolves location context server-side.
// For free tier: uses the businessProfile payload passed by the client (generic improvement only).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { silentCorrect } from '../_shared/utils/silent-correct.ts'
import { getHospitalityRegisterBlock } from '../_shared/utils/hospitality-register.ts'
import { buildPlatformHashtagSets } from '../_shared/hashtags/platform-hashtags.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── sanitizeMenuDesc ────────────────────────────────────────────────────
// Strip upsell/add-on references and marketing summary sentences from menu descriptions.
function sanitizeMenuDesc(raw: string): string {
  if (!raw) return ''
  const marketingVerbPattern = /tilbyder|giver mulighed|henvender|inkluderer|skræddersyet|oplevelse|imødekommer|præferencer|alternativer|vælge mellem/i
  const cleaned = raw
    .split(/(?<=[.!?])\s+/)
    .filter(s => !(s.length > 60 && marketingVerbPattern.test(s)))
    .join(' ')
    .trim()
  return (cleaned || raw)
    .replace(/\(?\+\s*[^).\n]{3,50}\)?/gi, '')
    .replace(/[.,]?\s*[Tt]ilk(?:ø|oe)b(?:es)?:?[^.\n]*/g, '')
    .replace(/[.,]?\s*[Kk]an\s+tilk(?:ø|oe)bes[^.\n]*/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// ── detectMenuItemInText ────────────────────────────────────────────────
// Scan user text for tokens that match item names in menu_items_normalized.
// Returns the best match (name + description) or null.
async function detectMenuItemInText(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  businessId: string,
  text: string
): Promise<{ name: string; description: string } | null> {
  // Extract meaningful tokens (4+ chars, not stopwords)
  const stopwords = new Set(['have', 'been', 'that', 'this', 'with', 'from', 'your', 'eller', 'både', 'ikke', 'også', 'bare', 'noget', 'over', 'under', 'inden', 'efter', 'inden', 'vores', 'virkelig', 'rigtig'])
  const tokens = text
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4 && !stopwords.has(w.toLowerCase()))
    .slice(0, 30) // cap to first 30 tokens for performance

  for (const token of tokens) {
    const { data: match } = await supabase
      .from('menu_items_normalized')
      .select('item_name, item_description')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .ilike('item_name', `%${token}%`)
      .limit(1)
      .maybeSingle()

    if (match?.item_name) {
      console.log('🍽️ Detected menu item in user text:', match.item_name)
      return {
        name: match.item_name,
        description: sanitizeMenuDesc(match.item_description || ''),
      }
    }
  }
  return null
}

// ── fetchBrandVoice ─────────────────────────────────────────────────────
// Fetches brand voice data from business_brand_profile and normalises it.
async function fetchBrandVoice(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  businessId: string
// deno-lint-ignore no-explicit-any
): Promise<Record<string, any>> {
  const { data } = await supabase
    .from('business_brand_profile')
    .select('brand_profile_v5, brand_essence, tone_of_voice, tone_model, voice_constraints, things_to_avoid, signature_phrases, voice_examples, voice_rationale, recognizable_interior_identity, business_character, identity_keywords, content_strategy, typical_closings')
    .eq('business_id', businessId)
    .maybeSingle()
  return data || {}
}

// ── fetchLocationIntelligence ───────────────────────────────────────────
// Fetches location intelligence for contextual hooks.
async function fetchLocationIntelligence(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  businessId: string
// deno-lint-ignore no-explicit-any
): Promise<Record<string, any> | null> {
  const { data } = await supabase
    .from('business_location_intelligence')
    .select('neighborhood, neighborhood_character, area_type, location_marketing_hooks, landmarks_nearby')
    .eq('business_id', businessId)
    .maybeSingle()
  return data || null
}

// ── extractBrandTone ────────────────────────────────────────────────────
// Normalise tone_of_voice and tone_model into a flat brand tone string + writing rules array.
// V5-first fallback chains for all brand voice fields.
// deno-lint-ignore no-explicit-any
function extractBrandTone(brandVoice: Record<string, any>): { brandTone: string; writingRules: string[]; goodExamples: string[]; preferVocab: string[]; avoidVocab: string[]; sigPhrases: string[]; thingsToAvoid: string; voiceConstraints: string; venueIdentity: string; businessCharacter: string; emojiInstruction: string; typicalClosings: string[] } {
  // Extract V5 profile sections
  const v5 = brandVoice.brand_profile_v5
  const v5Identity = v5?.identity
  const v5Voice = v5?.voice
  const v5WritingExamples = v5?.writing_examples
  const v5Guardrails = v5?.guardrails

  let brandTone = ''
  let writingRules: string[] = []
  let goodExamples: string[] = []
  let preferVocab: string[] = []
  let avoidVocab: string[] = []
  let sigPhrases: string[] = []
  let thingsToAvoid = ''
  let voiceConstraints = ''
  let venueIdentity = ''
  let businessCharacter = ''
  let emojiInstruction = '1-2 emojis naturligt placeret'
  let typicalClosings: string[] = []

  // V5 FALLBACK 1: Brand essence
  // V5-first: use v5Identity.brand_essence, fallback to legacy brand_essence
  if (v5Identity?.brand_essence) {
    brandTone = v5Identity.brand_essence.trim().slice(0, 200)
  } else if (brandVoice.brand_essence) {
    const be = brandVoice.brand_essence
    brandTone = typeof be === 'object' && be?.value ? String(be.value).slice(0, 200) : String(be || '').slice(0, 200)
  }

  // V5 FALLBACK 2: Tone rules (writing rules)
  // V5-first: use v5Voice.tone_rules, fallback to tone_model.writing_rules or tone_of_voice
  if (v5Voice?.tone_rules && Array.isArray(v5Voice.tone_rules)) {
    writingRules = v5Voice.tone_rules.filter((s: unknown) => typeof s === 'string').slice(0, 5)
  } else {
    const tov = brandVoice.tone_of_voice
    if (tov && !brandTone) {
      if (typeof tov === 'object' && typeof tov.value === 'string' && tov.value.trim().length > 10) {
        brandTone = tov.value.trim()
      } else if (typeof tov === 'object') {
        const parts: string[] = []
        if (tov.primary_tone) parts.push(tov.primary_tone)
        if (Array.isArray(tov.attributes)) parts.push(tov.attributes.join(', '))
        if (tov.formality_level) parts.push(`formalitet: ${tov.formality_level}`)
        brandTone = parts.join(' · ')
      } else if (typeof tov === 'string') {
        brandTone = tov
      }
    }

    const tm = brandVoice.tone_model
    if (typeof tm === 'object' && tm !== null) {
      if (Array.isArray(tm.writing_rules)) writingRules = tm.writing_rules.filter((s: unknown) => typeof s === 'string').slice(0, 5)
    }
  }

  // V5 FALLBACK 3: Emoji level
  // V5-first: use v5Voice.emoji_level, fallback to tone_model.emoji_level or tone_of_voice.emoji_frequency
  const v5EmojiLevel = v5Voice?.emoji_level
  const legacyEmojiLevel = brandVoice.tone_model?.emoji_level || (brandVoice.tone_of_voice as any)?.emoji_frequency
  const emojiLevel = v5EmojiLevel || legacyEmojiLevel || 'moderate'
  emojiInstruction = emojiLevel === 'none' ? 'Brug INGEN emojis'
    : emojiLevel === 'minimal' || emojiLevel === 'low' ? '0-1 emoji maksimum'
    : emojiLevel === 'frequent' || emojiLevel === 'high' ? '2-3 emojis naturligt placeret'
    : '1-2 emojis naturligt placeret'

  // V5 FALLBACK 4: Good examples
  // V5-first: use v5WritingExamples.good_examples, fallback to tone_model.good_examples
  if (v5WritingExamples?.good_examples && Array.isArray(v5WritingExamples.good_examples)) {
    goodExamples = v5WritingExamples.good_examples.filter((s: unknown) => typeof s === 'string').slice(0, 3)
  } else if (brandVoice.tone_model?.good_examples && Array.isArray(brandVoice.tone_model.good_examples)) {
    goodExamples = brandVoice.tone_model.good_examples.filter((s: unknown) => typeof s === 'string').slice(0, 3)
  }

  // Dedup: tone_of_voice.value and tone_model.writing_rules are from same pipeline pass
  if (writingRules.length >= 3 && brandTone) brandTone = ''

  // V5 FALLBACK 5: Prefer vocabulary
  // V5-first: use v5WritingExamples.prefer_vocabulary, fallback to voice_examples.vocabulary.prefer
  if (v5WritingExamples?.prefer_vocabulary && Array.isArray(v5WritingExamples.prefer_vocabulary)) {
    preferVocab = v5WritingExamples.prefer_vocabulary.filter((s: unknown) => typeof s === 'string').slice(0, 6)
  } else {
    const ve = brandVoice.voice_examples
    if (ve && typeof ve === 'object' && Array.isArray(ve.vocabulary?.prefer)) {
      preferVocab = ve.vocabulary.prefer.filter((s: unknown) => typeof s === 'string').slice(0, 6)
    }
  }

  // V5 FALLBACK 6: Avoid vocabulary
  // V5-first: use v5WritingExamples.avoid_vocabulary, fallback to voice_examples.vocabulary.avoid
  if (v5WritingExamples?.avoid_vocabulary && Array.isArray(v5WritingExamples.avoid_vocabulary)) {
    avoidVocab = v5WritingExamples.avoid_vocabulary.filter((s: unknown) => typeof s === 'string').slice(0, 6)
  } else {
    const ve = brandVoice.voice_examples
    if (ve && typeof ve === 'object' && Array.isArray(ve.vocabulary?.avoid)) {
      avoidVocab = ve.vocabulary.avoid.filter((s: unknown) => typeof s === 'string').slice(0, 6)
    }
  }

  // V5 FALLBACK 7: Signature phrases
  // V5-first: use v5WritingExamples.signature_phrases, fallback to legacy signature_phrases
  if (v5WritingExamples?.signature_phrases && Array.isArray(v5WritingExamples.signature_phrases)) {
    sigPhrases = v5WritingExamples.signature_phrases.filter((s: unknown) => typeof s === 'string').slice(0, 4)
  } else if (Array.isArray(brandVoice.signature_phrases)) {
    sigPhrases = brandVoice.signature_phrases.filter((s: unknown) => typeof s === 'string').slice(0, 4)
  }

  // V5 FALLBACK 8: Things to avoid (avoid_examples)
  // V5-first: use v5Voice.avoid_examples, fallback to legacy things_to_avoid
  if (v5Voice?.avoid_examples && Array.isArray(v5Voice.avoid_examples)) {
    thingsToAvoid = v5Voice.avoid_examples.join(', ')
  } else {
    const ta = brandVoice.things_to_avoid
    if (ta) {
      if (typeof ta === 'object') {
        const parts: string[] = []
        if (Array.isArray(ta.language_constraints)) parts.push(...ta.language_constraints)
        if (Array.isArray(ta.banned_phrases)) parts.push(...ta.banned_phrases)
        if (Array.isArray(ta.tone_constraints)) parts.push(...ta.tone_constraints)
        thingsToAvoid = parts.join(', ')
      } else {
        thingsToAvoid = String(ta)
      }
    }
  }

  // V5 FALLBACK 9: Voice constraints (register_guidance)
  // V5-first: use v5Voice.register_guidance, fallback to legacy voice_constraints
  if (v5Voice?.register_guidance) {
    voiceConstraints = v5Voice.register_guidance
  } else {
    const vc = brandVoice.voice_constraints
    if (vc) {
      voiceConstraints = typeof vc === 'string' ? vc
        : (typeof vc === 'object' && typeof vc.value === 'string') ? vc.value : ''
    }
  }

  // V5 FALLBACK 10: Business character (business_description)
  // V5-first: use v5Identity.business_description, fallback to legacy business_character
  if (v5Identity?.business_description) {
    businessCharacter = v5Identity.business_description.trim()
  } else {
    const bc = brandVoice.business_character
    if (bc) {
      businessCharacter = typeof bc === 'string' ? bc.trim()
        : (typeof bc === 'object' && bc.value) ? String(bc.value).trim() : ''
    }
  }

  // V5 FALLBACK 10b: Water term prohibition (NEW - V5.1 structured location_identity)
  // V5-first: use v5Identity.location_identity.water_proximity, fallback to legacy regex parsing
  if (v5Identity?.location_identity?.water_proximity) {
    const waterTerm = v5Identity.location_identity.water_proximity;
    writingRules = [...writingRules, `Brug ALDRIG 'vandet' om dette steds placering — brug altid det præcise ord '${waterTerm}'`];
  } else if (businessCharacter) {
    // Legacy fallback: parse businessCharacter for water terms
    const daWaterMatch = businessCharacter.match(/\\bved\\s+(åen|bugten|havet|søen|fjorden|kanalen|havnen|stranden|kysten|vigen)\\b/i)
    const svWaterMatch = businessCharacter.match(/\\bvid\\s+(ån|havet|sjön|viken|kanalen|hamnen|stranden|kusten|fjorden)\\b/i)
    const deWaterMatch = businessCharacter.match(/\\bam\\s+(Fluss|Meer|See|Kanal|Hafen|Strand|Bach|Fjord)\\b/i)
    const waterMatch = daWaterMatch || svWaterMatch || deWaterMatch
    if (waterMatch) {
      const waterTerm = waterMatch[1].toLowerCase();
      writingRules = [...writingRules, `Brug ALDRIG 'vandet' om dette steds placering — brug altid det præcise ord '${waterTerm}'`];
    }
  }

  // V5 FALLBACK 11: Venue identity (recognizable_interior_identity)
  // This is venue context, not brand voice - intentionally kept as legacy-only
  // (not part of V5 brand profile, comes from venue analysis)
  const rii = brandVoice.recognizable_interior_identity
  if (rii) {
    venueIdentity = typeof rii === 'string' ? rii.trim()
      : (typeof rii === 'object' && typeof rii.value === 'string') ? rii.value.trim() : ''
  }

  // V5 FALLBACK 12: Typical closings (brand-specific CTAs)
  // V5-first: use v5WritingExamples.typical_closings, fallback to legacy typical_closings
  if (Array.isArray(v5WritingExamples?.typical_closings)) {
    typicalClosings = v5WritingExamples.typical_closings.filter((s: unknown) => typeof s === 'string').slice(0, 5)
  } else if (Array.isArray(brandVoice.typical_closings)) {
    typicalClosings = brandVoice.typical_closings.filter((s: unknown) => typeof s === 'string').slice(0, 5)
  }

  return { brandTone, writingRules, goodExamples, preferVocab, avoidVocab, sigPhrases, thingsToAvoid, voiceConstraints, venueIdentity, businessCharacter, emojiInstruction, typicalClosings }
}

// ── buildEnhancePrompt ──────────────────────────────────────────────────
// Builds the enhancement prompt. Instructs the model to rewrite the user's draft
// in the brand voice while preserving intent, adding dish detail if detected,
// and weaving in location context if applicable.
function buildEnhancePrompt(opts: {
  originalText: string
  headline: string
  businessName: string
  locationText: string
  language: string
  isPaid: boolean
  // brand voice (paid only)
  brandTone: string
  writingRules: string[]
  goodExamples: string[]
  preferVocab: string[]
  avoidVocab: string[]
  sigPhrases: string[]
  thingsToAvoid: string
  voiceConstraints: string
  venueIdentity: string
  businessCharacter: string
  emojiInstruction: string
  typicalClosings: string[]
  // menu (optional)
  detectedDishName: string
  detectedDishDescription: string
  // location (optional)
  neighborhood: string
  neighborhoodCharacter: string
  locationHooks: string[]
  // output options
  includeHashtags: boolean
  includeEmojis: boolean
  platforms: string[]
  clarificationContext: string | null
}): string {
  const { originalText, headline, businessName, locationText, language, isPaid,
    brandTone, writingRules, goodExamples, preferVocab, avoidVocab, sigPhrases,
    thingsToAvoid, voiceConstraints, venueIdentity, businessCharacter, emojiInstruction, typicalClosings,
    detectedDishName, detectedDishDescription, neighborhood, neighborhoodCharacter, locationHooks,
    includeHashtags, platforms, clarificationContext } = opts

  const hasBrandVoice = !!(brandTone || writingRules.length > 0)
  const hasDish = !!detectedDishName
  const hasLocation = !!neighborhood || locationHooks.length > 0

  // ── BRAND BLOCK ─────────────────────────────────────────────────────
  let brandBlock = ''
  if (isPaid && hasBrandVoice) {
    brandBlock = '\nBRANDSTEMME (følg denne — stil, ikke fakta):'
    if (businessCharacter) brandBlock += `\nHvad dette sted er: ${businessCharacter}`
    if (brandTone) brandBlock += `\n${brandTone}`
    if (voiceConstraints) brandBlock += `\nPrincip: ${voiceConstraints}`
    if (writingRules.length) brandBlock += `\nSkriveregler:\n${writingRules.map(r => `- ${r}`).join('\n')}`
    if (goodExamples.length) brandBlock += `\nGode eksempler (stil, ikke indhold):\n${goodExamples.map(e => `- "${e}"`).join('\n')}`
    if (preferVocab.length) brandBlock += `\nForetrukket ordforråd: ${preferVocab.join(', ')}`
    if (avoidVocab.length) brandBlock += `\n🚫 Undgå ordforråd: ${avoidVocab.join(', ')}`
    if (sigPhrases.length) brandBlock += `\nBrandets fraser — brug KUN hvis det passer naturligt: ${sigPhrases.join(' · ')}`
    if (thingsToAvoid) brandBlock += `\n🚫 Undgå altid: ${thingsToAvoid}`
    if (venueIdentity) brandBlock += `\nInteriørmærker (faktuel venue-beskrivelse): ${venueIdentity}`
    if (typicalClosings.length) brandBlock += `\nBrand-specifikke call-to-actions (brug KUN hvis de passer naturligt til teksten): ${typicalClosings.join(' · ')}`
    brandBlock += '\n'
  }

  // ── DISH BLOCK ──────────────────────────────────────────────────────
  let dishBlock = ''
  if (hasDish) {
    dishBlock = `\nRET DER NÆVNES I TEKSTEN: ${detectedDishName}`
    if (detectedDishDescription) dishBlock += `\n${detectedDishDescription}`
    dishBlock += '\n⚠️ Brug KUN de ingredienser og egenskaber der fremgår herover — opfind ingen nye.\n'
  }

  // ── LOCATION BLOCK ──────────────────────────────────────────────────
  let locationBlock = ''
  if (isPaid && hasLocation) {
    const parts: string[] = []
    if (neighborhood) parts.push(`Kvarter: ${neighborhood}`)
    if (neighborhoodCharacter) parts.push(`Karakter: ${neighborhoodCharacter}`)
    if (locationHooks.length) {
      const topHooks = locationHooks.slice(0, 2).join(' · ')
      parts.push(`Stedsvinkler (brug KUN hvis relevant for teksten): ${topHooks}`)
    }
    if (parts.length) locationBlock = `\nLOKATIONSKONTEKST:\n${parts.join('\n')}\n`
  }

  // ── CLARIFICATION ───────────────────────────────────────────────────
  const clarificationBlock = clarificationContext
    ? `\nEKSTRA KONTEKST FRA BRUGEREN: ${clarificationContext}\n`
    : ''

  // ── FAKTAFORBUD ─────────────────────────────────────────────────────
  const faktaforbud = `\n🚫 FAKTAFORBUD
- Bevar KUN de faktuelle oplysninger der er i brugerens tekst — tilføj ingen steder, åbningstider, retter eller fakta der ikke allerede er der
- Opfind IKKE stedsspecifikke detaljer (udsigt, attraktioner, vand, vejr) der ikke er nævnt
- Brugerens tekst er din eneste faktuelle kilde — brand stemme og dish-detaljer er stil-input, ikke nye fakta
`

  const qualityNote = isPaid ? 'Teksten skal føles poleret og personlig — ikke generisk.\n' : ''

  // ── FULL PROMPT ─────────────────────────────────────────────────────
  return `OPGAVE
Du er en erfaren social media-redaktør der forbedrer en virksomheds opslag.
Virksomhed: ${businessName}${locationText ? ` ${locationText}` : ''}

${getHospitalityRegisterBlock(language)}

ORIGINALTEXT (brugerens udkast):
"""
${headline ? `Overskrift: ${headline}\n` : ''}${originalText}
"""
${brandBlock}${dishBlock}${locationBlock}${clarificationBlock}${faktaforbud}
INSTRUKTIONER
1. Bevar den overordnede intention og de konkrete fakta fra originalteksten
2. Omskriv i ${isPaid ? 'brandets stemme (jf. BRANDSTEMME ovenfor)' : 'en naturlig, engagerende tone for en dansk virksomhed'}
3. ${hasDish ? 'Nævn mindst ét konkret element fra RET-blokken ovenfor (en ingrediens, tilberedning eller tekstur — f.eks. "frisk parmesan", "sprøde croutoner", "kylling") — brug det præcise ord fra listen, opfind intet' : 'Gør teksten mere levende og konkret'}
4. Fjern generiske sætninger og AI-klichéer ("lækker oplevelse", "kom og nyd", "tag med os", "lækker", "hyggelig")
5. Slut med en naturlig call-to-action der passer til indholdet
6. Længde: 280-420 tegn inkl. emojis
7. ${emojiInstruction}
${qualityNote}
OUTPUT — returner KUN dette JSON på én linje (ingen markdown, ingen forklaring):
{"text":"<forbedret tekst>","headline":"<overskrift eller tom streng>"}
}`
}

// ── callOpenAI ──────────────────────────────────────────────────────────
async function callOpenAI(model: string, prompt: string, apiKey: string): Promise<{ text: string; headline: string; hashtags: string[]; hashtagGroups: Record<string, string[]> }> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.72,
      max_tokens: 700,
    })
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenAI error ${response.status}: ${err}`)
  }

  const data = await response.json()
  const raw = data.choices?.[0]?.message?.content?.trim() || ''

  try {
    // Strip optional markdown fences
    const jsonStr = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(jsonStr)
    return {
      text: parsed.text || '',
      headline: parsed.headline || '',
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
      hashtagGroups: parsed.hashtag_groups || {},
    }
  } catch {
    // Fallback: if JSON parse fails, return the raw content as text
    console.warn('[ai-enhance] JSON parse failed, using raw text')
    return { text: raw, headline: '', hashtags: [], hashtagGroups: {} }
  }
}

// ── serve ────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured')

    const body = await req.json()
    const {
      text,
      headline = '',
      platforms = ['facebook'],
      includeEmojis = true,
      includeHashtags = false,
      userTier = 'free',
      language = 'da',
      businessId = null,
      // Legacy client-side businessProfile (used as fallback for businessName/city)
      businessProfile = null,
      hasPhoto = false,
      clarificationContext = null,
      skipClarification = false,
    } = body

    if (!text || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'text is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const isPaid = userTier === 'smart' || userTier === 'pro'
    const model = isPaid ? 'gpt-4o' : 'gpt-4o-mini'

    // ── RESOLVE BUSINESS IDENTITY ──────────────────────────────────────
    let businessName = businessProfile?.business_name || 'din virksomhed'
    let city = businessProfile?.city || ''
    let businessVertical = businessProfile?.business_vertical || businessProfile?.business_category || ''
    let localLocationReference: string | null = null

    if (businessId) {
      const [bizResult, locResult] = await Promise.all([
        supabase.from('businesses').select('name, vertical, local_location_reference').eq('id', businessId).maybeSingle(),
        supabase.from('business_locations').select('city').eq('business_id', businessId).eq('is_primary', true).maybeSingle()
      ])
      if (bizResult.data?.name) businessName = bizResult.data.name
      if (bizResult.data?.vertical) businessVertical = bizResult.data.vertical
      if (locResult.data?.city) city = locResult.data.city
      localLocationReference = bizResult.data?.local_location_reference || null
    }

    // Compute location text: use authentic local reference if available, fallback to city
    const locationText = localLocationReference || (city ? `i ${city}` : '')

    // ── PAID TIER: FETCH ENRICHMENT DATA ──────────────────────────────
    let brandTone = ''
    let writingRules: string[] = []
    let goodExamples: string[] = []
    let preferVocab: string[] = []
    let avoidVocab: string[] = []
    let sigPhrases: string[] = []
    let thingsToAvoid = ''
    let voiceConstraints = ''
    let venueIdentity = ''
    let businessCharacter = ''
    let emojiInstruction = includeEmojis ? '1-2 emojis naturligt placeret' : 'Brug INGEN emojis'
    let typicalClosings: string[] = []
    let detectedDishName = ''
    let detectedDishDescription = ''
    let neighborhood = ''
    let neighborhoodCharacter = ''
    let locationHooks: string[] = []

    if (isPaid && businessId) {
      const [brandVoiceData, locationData] = await Promise.all([
        fetchBrandVoice(supabase, businessId),
        fetchLocationIntelligence(supabase, businessId),
      ])

      // Brand voice
      const extracted = extractBrandTone(brandVoiceData)
      brandTone = extracted.brandTone
      writingRules = extracted.writingRules
      goodExamples = extracted.goodExamples
      preferVocab = extracted.preferVocab
      avoidVocab = extracted.avoidVocab
      sigPhrases = extracted.sigPhrases
      thingsToAvoid = extracted.thingsToAvoid
      voiceConstraints = extracted.voiceConstraints
      venueIdentity = extracted.venueIdentity
      businessCharacter = extracted.businessCharacter
      emojiInstruction = extracted.emojiInstruction
      typicalClosings = extracted.typicalClosings
      if (!includeEmojis) emojiInstruction = 'Brug INGEN emojis'

      // Menu item detection
      const dishMatch = await detectMenuItemInText(supabase, businessId, text)
      if (dishMatch) {
        detectedDishName = dishMatch.name
        detectedDishDescription = dishMatch.description
      }

      // Location intelligence
      if (locationData) {
        neighborhood = locationData.neighborhood || ''
        neighborhoodCharacter = locationData.neighborhood_character || ''
        const hooks: string[] = []
        if (Array.isArray(locationData.location_marketing_hooks)) {
          locationData.location_marketing_hooks
            .filter((h: { show_on_location_page?: boolean; text?: string }) => h.show_on_location_page && h.text)
            .slice(0, 3)
            .forEach((h: { text: string }) => hooks.push(h.text))
        }
        locationHooks = hooks
      }
    }

    console.log('🎯 ai-enhance called:', {
      tier: userTier, model, businessId: !!businessId,
      hasBrandVoice: !!(brandTone || writingRules.length),
      detectedDish: detectedDishName || 'none',
      hasLocationIntel: !!neighborhood,
      localLocationReference: localLocationReference || 'none',
      locationText: locationText || 'none',
      textLength: text.length,
    })

    // ── CLARIFICATION FLOW ─────────────────────────────────────────────
    // For very short texts on paid tiers, ask for more context if no clarification yet
    const wordCount = text.trim().split(/\s+/).length
    if (!skipClarification && !clarificationContext && wordCount <= 3 && isPaid) {
      return new Response(
        JSON.stringify({
          needs_clarification: true,
          question: language === 'da'
            ? 'Hvad handler opslaget om? Fortæl lidt mere, så jeg kan forbedre det bedre.'
            : language === 'sv'
            ? 'Vad handlar inlägget om? Berätta lite mer så kan jag förbättra det bättre.'
            : 'What is the post about? Tell me a bit more so I can improve it better.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── BUILD PROMPT ───────────────────────────────────────────────────
    const prompt = buildEnhancePrompt({
      originalText: text,
      headline,
      businessName,
      locationText,
      language,
      isPaid,
      brandTone,
      writingRules,
      goodExamples,
      preferVocab,
      avoidVocab,
      sigPhrases,
      thingsToAvoid,
      voiceConstraints,
      venueIdentity,
      businessCharacter,
      emojiInstruction,
      typicalClosings,
      detectedDishName,
      detectedDishDescription,
      neighborhood,
      neighborhoodCharacter,
      locationHooks,
      includeHashtags,
      includeEmojis,
      platforms,
      clarificationContext,
    })

    // ── GENERATE ───────────────────────────────────────────────────────
    const { text: enhancedText, headline: enhancedHeadline } = await callOpenAI(model, prompt, OPENAI_API_KEY)

    if (!enhancedText) {
      throw new Error('No text returned from OpenAI')
    }

    // ── SPELLING CORRECTION (paid only) ───────────────────────────────
    let finalText = enhancedText
    if (isPaid) {
      const { needsSpellingCheck } = await import('../generate-text-from-idea/post-process.ts')
      if (needsSpellingCheck(finalText, language)) {
        const corrected = await silentCorrect(finalText, language, brandTone || '', OPENAI_API_KEY)
        if (corrected !== finalText) {
          console.log('✏️ Spelling corrected')
          finalText = corrected
        }
      }
    }

    const hashtagSets = includeHashtags
      ? buildPlatformHashtagSets({
          city,
          businessName,
          businessCharacter,
          vertical: businessVertical,
          contentType: detectedDishName ? 'menu_item' : 'atmosphere',
          text: finalText,
          detectedDishName,
          detectedDishDescription,
        })
      : { facebook: [], instagram: [] }

    const combinedHashtags = Array.from(new Set([...hashtagSets.facebook, ...hashtagSets.instagram]))

    // ── PHOTO IDEA (optional, paid only) ──────────────────────────────
    let photoIdea = ''
    if (isPaid && !hasPhoto) {
      // Generate a quick photo suggestion inline (single sentence)
      const photoPrompt = `Suggest ONE brief mobile phone photo idea (max 12 words, in ${language === 'da' ? 'Danish' : language === 'sv' ? 'Swedish' : 'German'}) that would complement this social media post:\n"${finalText}"\n\nRespond with ONLY the photo suggestion, nothing else.`
      try {
        const photoRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: photoPrompt }],
            temperature: 0.7,
            max_tokens: 60,
          })
        })
        if (photoRes.ok) {
          const photoData = await photoRes.json()
          photoIdea = photoData.choices?.[0]?.message?.content?.trim() || ''
        }
      } catch {
        // Photo idea is optional — ignore errors
      }
    }

    const result: Record<string, unknown> = {
      text: finalText,
      headline: enhancedHeadline,
      hashtags: combinedHashtags,
      facebookHashtags: hashtagSets.facebook,
      instagramHashtags: hashtagSets.instagram,
      hashtag_groups: {
        facebook: hashtagSets.facebook,
        instagram: hashtagSets.instagram,
      },
    }
    if (photoIdea) result.photoIdea = photoIdea

    console.log('✅ ai-enhance complete:', {
      model, tier: userTier,
      textLength: finalText.length,
      hashtagCount: combinedHashtags.length,
      facebookHashtagCount: hashtagSets.facebook.length,
      instagramHashtagCount: hashtagSets.instagram.length,
      menuDetected: !!detectedDishName,
      locationUsed: !!neighborhood || !!localLocationReference,
      localLocationReferenceUsed: !!localLocationReference,
    })

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ ai-enhance error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Enhancement failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
