// adjust-text/index.ts
// Pro feature: Adjusts caption length and tone while maintaining brand voice.
// Called from CaptionEditModal when Pro users request length/tone changes.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getHospitalityRegisterBlock } from '../_shared/utils/hospitality-register.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    .select('brand_profile_v5, brand_essence, tone_of_voice, tone_model, voice_constraints, things_to_avoid, signature_phrases, voice_examples, business_character')
    .eq('business_id', businessId)
    .maybeSingle()
  return data || {}
}

// ── extractBrandTone ────────────────────────────────────────────────────
// Normalise tone_of_voice and tone_model into a flat brand tone string + writing rules array.
// V5-first fallback chains for all brand voice fields.
// deno-lint-ignore no-explicit-any
function extractBrandTone(brandVoice: Record<string, any>): { 
  brandTone: string
  writingRules: string[]
  goodExamples: string[]
  preferVocab: string[]
  avoidVocab: string[]
  thingsToAvoid: string
  voiceConstraints: string
  businessCharacter: string
  emojiInstruction: string
} {
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
  let thingsToAvoid = ''
  let voiceConstraints = ''
  let businessCharacter = ''
  let emojiInstruction = '1-2 emojis naturligt placeret'

  // V5 FALLBACK 1: Brand essence
  if (v5Identity?.brand_essence) {
    brandTone = v5Identity.brand_essence.trim().slice(0, 200)
  } else if (brandVoice.brand_essence) {
    const be = brandVoice.brand_essence
    brandTone = typeof be === 'object' && be?.value ? String(be.value).slice(0, 200) : String(be || '').slice(0, 200)
  }

  // V5 FALLBACK 2: Tone rules (writing rules)
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
  const v5EmojiLevel = v5Voice?.emoji_level
  const legacyEmojiLevel = brandVoice.tone_model?.emoji_level || (brandVoice.tone_of_voice as any)?.emoji_frequency
  const emojiLevel = v5EmojiLevel || legacyEmojiLevel || 'moderate'
  emojiInstruction = emojiLevel === 'none' ? 'Brug INGEN emojis'
    : emojiLevel === 'minimal' || emojiLevel === 'low' ? '0-1 emoji maksimum'
    : emojiLevel === 'frequent' || emojiLevel === 'high' ? '2-3 emojis naturligt placeret'
    : '1-2 emojis naturligt placeret'

  // V5 FALLBACK 4: Good examples
  if (v5WritingExamples?.good_examples && Array.isArray(v5WritingExamples.good_examples)) {
    goodExamples = v5WritingExamples.good_examples.filter((s: unknown) => typeof s === 'string').slice(0, 3)
  } else if (brandVoice.tone_model?.good_examples && Array.isArray(brandVoice.tone_model.good_examples)) {
    goodExamples = brandVoice.tone_model.good_examples.filter((s: unknown) => typeof s === 'string').slice(0, 3)
  }

  // Dedup: tone_of_voice.value and tone_model.writing_rules are from same pipeline pass
  if (writingRules.length >= 3 && brandTone) brandTone = ''

  // V5 FALLBACK 5: Prefer vocabulary
  if (v5WritingExamples?.prefer_vocabulary && Array.isArray(v5WritingExamples.prefer_vocabulary)) {
    preferVocab = v5WritingExamples.prefer_vocabulary.filter((s: unknown) => typeof s === 'string').slice(0, 6)
  } else {
    const ve = brandVoice.voice_examples
    if (ve && typeof ve === 'object' && Array.isArray(ve.vocabulary?.prefer)) {
      preferVocab = ve.vocabulary.prefer.filter((s: unknown) => typeof s === 'string').slice(0, 6)
    }
  }

  // V5 FALLBACK 6: Avoid vocabulary
  if (v5WritingExamples?.avoid_vocabulary && Array.isArray(v5WritingExamples.avoid_vocabulary)) {
    avoidVocab = v5WritingExamples.avoid_vocabulary.filter((s: unknown) => typeof s === 'string').slice(0, 6)
  } else {
    const ve = brandVoice.voice_examples
    if (ve && typeof ve === 'object' && Array.isArray(ve.vocabulary?.avoid)) {
      avoidVocab = ve.vocabulary.avoid.filter((s: unknown) => typeof s === 'string').slice(0, 6)
    }
  }

  // V5 FALLBACK 8: Things to avoid (avoid_examples)
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
  if (v5Identity?.business_description) {
    businessCharacter = v5Identity.business_description.trim()
  } else {
    const bc = brandVoice.business_character
    if (bc) {
      businessCharacter = typeof bc === 'string' ? bc.trim()
        : (typeof bc === 'object' && bc.value) ? String(bc.value).trim() : ''
    }
  }

  return { 
    brandTone, 
    writingRules, 
    goodExamples, 
    preferVocab, 
    avoidVocab, 
    thingsToAvoid, 
    voiceConstraints, 
    businessCharacter, 
    emojiInstruction 
  }
}

// ── buildAdjustPrompt ───────────────────────────────────────────────────
// Builds the adjustment prompt for length/tone changes
function buildAdjustPrompt(opts: {
  currentText: string
  lengthAdjust: 'shorter' | 'longer' | null
  toneAdjust: 'looser' | 'more_serious' | null
  language: string
  // brand voice
  brandTone: string
  writingRules: string[]
  goodExamples: string[]
  preferVocab: string[]
  avoidVocab: string[]
  thingsToAvoid: string
  voiceConstraints: string
  businessCharacter: string
  emojiInstruction: string
}): string {
  const { 
    currentText, 
    lengthAdjust, 
    toneAdjust, 
    language,
    brandTone, 
    writingRules, 
    goodExamples, 
    preferVocab, 
    avoidVocab, 
    thingsToAvoid, 
    voiceConstraints, 
    businessCharacter, 
    emojiInstruction 
  } = opts

  const langCode = language.startsWith('da') ? 'da' 
    : language.startsWith('sv') ? 'sv' 
    : language.startsWith('de') ? 'de' 
    : 'en'

  const hasBrandVoice = !!(brandTone || writingRules.length > 0)

  // ── ADJUSTMENT INSTRUCTION ──────────────────────────────────────────────
  let adjustmentInstruction = ''
  
  if (lengthAdjust === 'shorter') {
    adjustmentInstruction += langCode === 'da' 
      ? '\n📐 LÆNGDE-JUSTERNG: Reducer teksten med 20-30%. Fjern sekundære detaljer og støtte-argumenter, men behold kernebudskabet, brandstemmmen og CTA. Emojis bevares.'
      : '\n📐 LENGTH ADJUSTMENT: Reduce text by 20-30%. Remove secondary details and supporting arguments, but keep core message, brand voice and CTA. Preserve emojis.'
  } else if (lengthAdjust === 'longer') {
    adjustmentInstruction += langCode === 'da'
      ? '\n📐 LÆNGDE-JUSTERING: Udvid teksten med 25-40%. Tilføj sensoriske detaljer (farver, teksturer, stemning), storytelling-elementer (tidspunkt på dagen, hvem det er til), og udvid fordele. Undgå at blive omstændelig — bevar Instagram-læsbarhed.'
      : '\n📐 LENGTH ADJUSTMENT: Expand text by 25-40%. Add sensory details (colors, textures, atmosphere), storytelling elements (time of day, who it\'s for), and expand benefits. Avoid becoming verbose — maintain Instagram readability.'
  }

  if (toneAdjust === 'looser') {
    adjustmentInstruction += langCode === 'da'
      ? '\n🎭 TONE-JUSTERING: Gør teksten varmere og mere afslappet. Brug lidt mere uformelle vendinger (stadig respektfuldt), tilføj personlighed. VIGTIGT: Respekter stadig brand voice guardrails — hvis profilen forbyder visse ord eller toner, skal du stadig undgå dem.'
      : '\n🎭 TONE ADJUSTMENT: Make text warmer and more casual. Use slightly more informal phrasing (still respectful), add personality. IMPORTANT: Still respect brand voice guardrails — if profile prohibits certain words or tones, you must still avoid them.'
  } else if (toneAdjust === 'more_serious') {
    adjustmentInstruction += langCode === 'da'
      ? '\n🎭 TONE-JUSTERING: Gør teksten mere professionel og troværdig. Brug mere formel ordforråd, fjern casual udtryk, fokusér på kvalitet og håndværk frem for varme. VIGTIGT: Respekter stadig brand voice — bevar kernetonen mens du forfiner formaliteten.'
      : '\n🎭 TONE ADJUSTMENT: Make text more professional and credible. Use more formal vocabulary, remove casual expressions, focus on quality and craft over warmth. IMPORTANT: Still respect brand voice — preserve core tone while refining formality.'
  }

  // ── BRAND BLOCK ─────────────────────────────────────────────────────────
  let brandBlock = ''
  if (hasBrandVoice) {
    brandBlock = langCode === 'da' 
      ? '\n🎯 BRANDSTEMME (følg denne — stil, ikke fakta):'
      : '\n🎯 BRAND VOICE (follow this — style, not facts):'
    
    if (businessCharacter) brandBlock += `\n${businessCharacter}`
    if (brandTone) brandBlock += `\n${brandTone}`
    if (voiceConstraints) brandBlock += `\n${langCode === 'da' ? 'Princip' : 'Principle'}: ${voiceConstraints}`
    if (writingRules.length) brandBlock += `\n${langCode === 'da' ? 'Skriveregler' : 'Writing rules'}:\n${writingRules.map(r => `- ${r}`).join('\n')}`
    if (goodExamples.length) brandBlock += `\n${langCode === 'da' ? 'Gode eksempler (stil, ikke indhold)' : 'Good examples (style, not content)'}:\n${goodExamples.map(e => `- "${e}"`).join('\n')}`
    if (preferVocab.length) brandBlock += `\n${langCode === 'da' ? 'Foretrukne ord' : 'Preferred vocabulary'}: ${preferVocab.join(', ')}`
    if (avoidVocab.length) brandBlock += `\n${langCode === 'da' ? 'Undgå disse ord' : 'Avoid these words'}: ${avoidVocab.join(', ')}`
    if (thingsToAvoid) brandBlock += `\n${langCode === 'da' ? 'Forbudt tone/fraser' : 'Prohibited tone/phrases'}: ${thingsToAvoid}`
    brandBlock += `\n${langCode === 'da' ? 'Emoji-niveau' : 'Emoji level'}: ${emojiInstruction}`
  }

  // ── REGISTER BLOCK ──────────────────────────────────────────────────────
  const registerBlock = getHospitalityRegisterBlock(langCode)

  // ── CONSTRUCT FULL PROMPT ───────────────────────────────────────────────
  const prompt = langCode === 'da'
    ? `Du er content-specialist for en food & beverage-virksomhed. Din opgave er at justere denne Instagram/Facebook-tekst baseret på brugerens ønsker, mens du bevarer brandstemmens essens.

${registerBlock}

NUVÆRENDE TEKST:
"${currentText}"
${adjustmentInstruction}
${brandBlock}

⛔ KRITISK: 
- Bevar kernebudskabet og faktiske oplysninger
- Respekter ALLE brand voice guardrails (forbudte ord, toner, fraser)
- Bevare emojis og deres naturlige placering (medmindre emoji-niveau er "none")
- Bevar eventuelle CTA'er eller specifikke facts (åbningstider, priser, etc.)
- ALDRIG opfind nye facts eller detaljer

SVAR KUN MED DEN JUSTEREDE TEKST — ingen forklaringer, ingen JSON, ingen ekstra formattering.`
    : `You are a content specialist for a food & beverage business. Your task is to adjust this Instagram/Facebook caption based on user preferences while preserving brand voice essence.

${registerBlock}

CURRENT TEXT:
"${currentText}"
${adjustmentInstruction}
${brandBlock}

⛔ CRITICAL:
- Preserve core message and factual information
- Respect ALL brand voice guardrails (prohibited words, tones, phrases)
- Preserve emojis and their natural placement (unless emoji level is "none")
- Preserve any CTAs or specific facts (hours, prices, etc.)
- NEVER fabricate new facts or details

RESPOND ONLY WITH THE ADJUSTED TEXT — no explanations, no JSON, no extra formatting.`

  return prompt
}

// ── callOpenAI ──────────────────────────────────────────────────────────
// Calls OpenAI GPT-4o-mini for text adjustment
async function callOpenAI(prompt: string): Promise<string> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  if (!openaiKey) throw new Error('Missing OPENAI_API_KEY')

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 1000,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('[adjust-text] OpenAI error:', error)
    throw new Error('OpenAI API request failed')
  }

  const data = await response.json()
  const text = data.choices?.[0]?.message?.content?.trim()
  
  if (!text) throw new Error('No text returned from OpenAI')
  
  return text
}

// ── MAIN HANDLER ────────────────────────────────────────────────────────
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { businessId, currentText, lengthAdjust, toneAdjust, tier } = await req.json()

    // Validate inputs
    if (!businessId || !currentText) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: businessId, currentText' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!lengthAdjust && !toneAdjust) {
      return new Response(
        JSON.stringify({ error: 'No adjustments requested' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Pro tier check (optional - could allow Smart tier with reduced features)
    const isPro = tier === 'premium' || tier === 'standardplus'
    if (!isPro) {
      return new Response(
        JSON.stringify({ error: 'This feature requires Pro tier' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[adjust-text] Adjusting for business ${businessId}, length=${lengthAdjust}, tone=${toneAdjust}`)

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch business profile for language detection
    const { data: businessProfile } = await supabase
      .from('business_profiles')
      .select('country')
      .eq('id', businessId)
      .maybeSingle()

    const language = businessProfile?.country === 'Denmark' ? 'da'
      : businessProfile?.country === 'Sweden' ? 'sv'
      : businessProfile?.country === 'Germany' ? 'de'
      : 'en'

    // Fetch brand voice
    const brandVoice = await fetchBrandVoice(supabase, businessId)
    const {
      brandTone,
      writingRules,
      goodExamples,
      preferVocab,
      avoidVocab,
      thingsToAvoid,
      voiceConstraints,
      businessCharacter,
      emojiInstruction,
    } = extractBrandTone(brandVoice)

    // Build adjustment prompt
    const prompt = buildAdjustPrompt({
      currentText,
      lengthAdjust,
      toneAdjust,
      language,
      brandTone,
      writingRules,
      goodExamples,
      preferVocab,
      avoidVocab,
      thingsToAvoid,
      voiceConstraints,
      businessCharacter,
      emojiInstruction,
    })

    // Call OpenAI
    const adjustedText = await callOpenAI(prompt)

    console.log('[adjust-text] Success, adjusted text length:', adjustedText.length)

    return new Response(
      JSON.stringify({ text: adjustedText }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[adjust-text] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
