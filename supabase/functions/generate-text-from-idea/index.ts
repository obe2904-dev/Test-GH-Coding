// generate-text-from-idea/index.ts
// Thin orchestrator: resolves context → selects CTA → builds prompt → generates → post-processes.
// Business logic lives in the co-located modules imported below.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { silentCorrect } from '../_shared/utils/silent-correct.ts'
import { fetchBusinessContext, resolveContentContext } from './resolve-context.ts'
import { selectCTA } from './select-cta.ts'
import { buildWeeklyPlanContext, buildPrompt } from './prompt-builders.ts'
import { callOpenAI } from './generate-text.ts'
import { needsSpellingCheck, extractTopicKeyword, generateHashtags } from './post-process.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { businessId, suggestion, platforms = ['facebook'], tier = 'free' } = await req.json()
    const source: 'ai_ideas' | 'weekly_plan' = suggestion.source || 'ai_ideas'
    console.log('🎯 generate-text-from-idea called:', { businessId, title: suggestion.title, platforms, tier, source })

    if (!businessId || !suggestion) {
      return new Response(
        JSON.stringify({ error: 'businessId and suggestion required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const isPaid = tier !== 'free'
    const model = isPaid ? 'gpt-4o' : 'gpt-4o-mini'
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 1–2. Business context + brand voice + opening hours
    const biz = await fetchBusinessContext(supabase, businessId, isPaid)

    // 3. Content context — hook, contentBlock, dish lookup, signature phrase filtering
    const content = await resolveContentContext(supabase, businessId, suggestion, source, biz.brandSignaturePhrases)

    // 4. CTA selection
    const { selectedCta, ctaStyle, ctaIntent } = selectCTA({
      typicalClosings: biz.typicalClosings,
      language: biz.language,
      suggestionCtaIntent: suggestion.ctaIntent,
      resolvedGoalMode: content.resolvedGoalMode,
      isMenuPost: content.isMenuPost,
      bookingLink: biz.bookingLink,
      suggestionId: suggestion.id,
    })

    // 5. Build prompt
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured')

    const isWeeklyPlan = source === 'weekly_plan'
    const weeklyPlanContext = isWeeklyPlan ? buildWeeklyPlanContext(suggestion, content.captionFirstLineUsedAsHook) : ''
    const prompt = buildPrompt({
      hook: content.hook,
      contentBlock: content.contentBlock,
      menuItemName: content.menuItemName,
      menuItemDescription: content.menuItemDescription,
      contentType: content.contentType,
      brandTone: biz.brandTone,
      brandWritingRules: biz.brandWritingRules,
      brandGoodExamples: biz.brandGoodExamples,
      brandAvoidExamples: biz.brandAvoidExamples,
      brandPreferVocab: biz.brandPreferVocab,
      brandAvoidVocab: biz.brandAvoidVocab,
      brandSignaturePhrases: content.brandSignaturePhrases,
      contentAnchors: biz.contentAnchors,
      thingsToAvoid: biz.thingsToAvoid,
      voiceConstraints: biz.voiceConstraints,
      emojiInstruction: biz.emojiInstruction,
      todayOpenTime: biz.todayOpenTime,
      selectedCta,
      businessName: biz.businessName,
      city: biz.city,
      language: biz.language,
      isPaid,
      weeklyPlanContext,
      isWeeklyPlan,
      ctaStyle,
      goalMode: content.resolvedGoalMode,
      voiceRationale: biz.voiceRationale,
      venueIdentity: biz.venueIdentity,
      businessCharacter: biz.businessCharacter,
      identityKeywords: biz.identityKeywords,
    })

    console.log('📝 Prompt built, calling', model, '...')

    // 6. Generate text
    const { cleanText: rawText, aiKeyword } = await callOpenAI(model, prompt, OPENAI_API_KEY)

    // 7. Conditional spelling correction
    let cleanText = rawText
    if (needsSpellingCheck(cleanText, biz.language)) {
      const corrected = await silentCorrect(cleanText, biz.language, biz.brandTone, OPENAI_API_KEY)
      if (corrected !== cleanText) {
        console.log('✏️ Spelling corrected:', corrected.substring(0, 100))
        cleanText = corrected
      }
    } else {
      console.log('✏️ Spelling check skipped — no error signals detected')
    }

    // 8. Hashtags
    const extractedKeyword = extractTopicKeyword(content.contentBlock, content.menuItemName, aiKeyword)
    const hashtags = generateHashtags(biz.city, content.contentType, extractedKeyword, biz.businessName)

    // 9. Response
    const isBookingIntent = ctaIntent === 'visit' && !!biz.bookingLink
    const response = {
      sharedText: cleanText,
      facebook: {
        text: cleanText,
        hashtags: hashtags.facebook,
        cta: {
          text: selectedCta,
          type: isBookingIntent ? 'booking' : 'soft',
          ...(isBookingIntent ? { url: biz.bookingLink } : {})
        }
      },
      instagram: {
        text: cleanText,
        hashtags: hashtags.instagram,
        cta: { text: selectedCta, type: 'soft' }
      }
    }

    console.log('✅ Generation complete:', {
      model, tier,
      textLength: cleanText.length,
      brandToneUsed: !!biz.brandTone,
      brandWritingRulesUsed: biz.brandWritingRules.length,
      brandExamplesUsed: biz.brandGoodExamples.length,
      voiceConstraintsUsed: !!biz.voiceConstraints,
      thingsToAvoidUsed: !!biz.thingsToAvoid,
      openingHoursUsed: !!biz.todayOpenTime,
      menuItemUsed: !!content.menuItemName,
      contentType: content.contentType,
      emojiInstruction: biz.emojiInstruction,
      brandClosingsUsed: biz.typicalClosings.length > 0
    })

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Text generation failed', details: error.toString() }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
