// generate-text-from-idea/index.ts
// VERSION: v5.1.7
// 
// v5.1.7 (2026-07-04): Fix hashtag generation - text-conditional categories + word boundary fixes
//   - FIX 07: Category hashtags (#Cafe, #Bar, etc.) ONLY appear if mentioned in POST TEXT
//   - Prevents inference from business type (cafe business → #Cafe even on burger posts)
//   - Added word boundaries to campaign regex (fixes "til" matching "tilbud" → false #CoffeeDeal)
//   - Modified: _shared/hashtags/platform-hashtags.ts inferVenueCategory, inferCampaignTag
//   - Updated Free tier prompt: "Du er marketingchef" (standard persona) + paid tier's non-inference rules
//   - Modified: prompt-components.ts buildEnhancedSystemInstruction Free tier block
// 
// v5.1.6 (2026-06-14): Fix sentence truncation in silentCorrect + comprehensive dash removal
//   - Added explicit guard: subordinate clauses (når/da/mens/selvom/fordi/eftersom) are NOT incomplete
//   - Prevents truncation like "Vi har åbent, og du er velkommen, når du er klar" → "Vi har åbent, og."
//   - Modified: silent-correct.ts Rule #5 with CRITICAL note
//   - Added catch-all: stripAIDashes now removes ALL standalone hyphens surrounded by spaces (" - ")
// 
// v5.1.5 (2026-06-14): Deprecated business_character field (architectural cleanup)
// v5.1.4 (2026-06-14): Fixed examples priority (enhanced_social_examples → good_examples)
// v5.1.3 (2026-06-13): Split avoid_patterns into strip_from_output vs generation_constraints
// 
// Thin orchestrator: resolves context → selects CTA → builds prompt → generates → post-processes.
// Business logic lives in the co-located modules imported below.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { silentCorrect } from '../_shared/utils/silent-correct.ts'
import { fetchBusinessContext, resolveContentContext } from './resolve-context.ts'
import { selectCTA } from './select-cta.ts'
import { buildWeeklyPlanContext, buildPrompt } from './prompt-builders.ts'
import { callOpenAI } from './generate-text.ts'
import { needsSpellingCheck, stripBannedClosers, stripAIDashes, stripEmojiViolations, stripIncompleteFragments, stripMetaInstructions, extractTopicKeyword, generateHashtags, validateSceneFormat } from './post-process.ts'
import { validateAgainstVoice } from '../_shared/validation/validate-voice.ts'
import { applyTargetedVoiceFixes } from './post-process-voice-fixes.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function normalizeSuggestionInput(rawSuggestion: any): any {
  if (!rawSuggestion || typeof rawSuggestion !== 'object') return rawSuggestion

  return {
    ...rawSuggestion,
    source: rawSuggestion.source === 'weekly_plan' ? 'weekly_plan' : 'ai_ideas',
    contentType: rawSuggestion.contentType
      || rawSuggestion.content_type
      || rawSuggestion.idea_type
      || rawSuggestion.postType?.category
      || rawSuggestion.post_type
      || undefined,
    menuItemId: rawSuggestion.menuItemId
      || rawSuggestion.menu_item_id
      || rawSuggestion.contentSubject?.menuItemId
      || undefined,
    menuItemName: rawSuggestion.menuItemName
      || rawSuggestion.menu_item_name
      || rawSuggestion.contentSubject?.menuItemName
      || undefined,
    menuItemDescription: rawSuggestion.menuItemDescription
      || rawSuggestion.menu_item_description
      || rawSuggestion.captionBase
      || rawSuggestion.caption_base
      || undefined,
    captionBase: rawSuggestion.captionBase || rawSuggestion.caption_base || undefined,
    ctaIntent: rawSuggestion.ctaIntent || rawSuggestion.cta_intent || undefined,
    photoIdea: rawSuggestion.photoIdea || rawSuggestion.photo_idea || undefined,
    whyExplanation: rawSuggestion.whyExplanation || rawSuggestion.why_explanation || undefined,
    occasionContext: rawSuggestion.occasionContext || rawSuggestion.occasion_context || undefined,
    timingDay: rawSuggestion.timingDay || rawSuggestion.timing_day || undefined,
    timingTime: rawSuggestion.timingTime || rawSuggestion.timing_time || undefined,
    timingRationale: rawSuggestion.timingRationale || rawSuggestion.timing_rationale || undefined,
    visualSubject: rawSuggestion.visualSubject || rawSuggestion.visual_subject || undefined,
    visualAngle: rawSuggestion.visualAngle || rawSuggestion.visual_angle || undefined,
    visualSetting: rawSuggestion.visualSetting || rawSuggestion.visual_setting || undefined,
    platformFormat: rawSuggestion.platformFormat || rawSuggestion.platform_format || undefined,
    selectionRationale: rawSuggestion.selectionRationale || rawSuggestion.selection_rationale || undefined,
    captionFirstLine: rawSuggestion.captionFirstLine || rawSuggestion.caption_first_line || undefined,
    holidayContext: rawSuggestion.holidayContext || rawSuggestion.holiday_context || undefined,
    guestMoment: rawSuggestion.guestMoment || rawSuggestion.guest_moment || undefined,
    strategyBrief: rawSuggestion.strategyBrief || rawSuggestion.strategy_brief || undefined,
    mediaDirection: rawSuggestion.mediaDirection || rawSuggestion.media_direction || undefined,
    sceneSpec: rawSuggestion.sceneSpec || rawSuggestion.scene_spec || undefined,
    slotId: rawSuggestion.slotId || rawSuggestion.slot_id || undefined,
    strategicIntent: rawSuggestion.strategicIntent || rawSuggestion.strategic_intent || undefined,
    slotReasoning: rawSuggestion.slotReasoning || rawSuggestion.slot_reasoning || undefined,
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🚀 Function invoked, parsing request...')
    const { businessId, suggestion: rawSuggestion, platforms = ['facebook'], tier = 'free' } = await req.json()
    const suggestion = normalizeSuggestionInput(rawSuggestion)
    console.log('✅ Request parsed:', { businessId, suggestionId: suggestion?.id, tier })
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
    console.log('📊 Fetching business context...')
    const biz = await fetchBusinessContext(supabase, businessId, isPaid, suggestion.timingDay)
    console.log('✅ Business context fetched')

    // 3. Content context — hook, contentBlock, dish lookup, signature phrase filtering
    console.log('📝 Resolving content context...')
    const content = await resolveContentContext(supabase, businessId, suggestion, source, biz.brandSignaturePhrases, isPaid, {
      locationVocabulary: biz.locationVocabulary,
      locationIntelligenceNarrative: biz.locationIntelligenceNarrative,
      venueScene: biz.venueScene,
      venueIdentity: biz.venueIdentity,
      tone_dna: biz.tone_dna
    })
    console.log('✅ Content context resolved')

    // 4. CTA selection (with booking pattern awareness + content type + brand CTA library)
    const { selectedCta, ctaStyle, ctaIntent } = selectCTA({
      typicalClosings: biz.typicalClosings,
      language: biz.language,
      suggestionCtaIntent: suggestion.ctaIntent,
      resolvedGoalMode: content.resolvedGoalMode,
      isMenuPost: content.isMenuPost,
      bookingLink: biz.bookingLink,
      suggestionId: suggestion.id,
      reservationRequired: biz.reservationRequired,
      acceptsWalkIns: biz.acceptsWalkIns,
      contentType: content.contentType,
      ctaLibrary: biz.ctaLibrary,        // NEW v5.6: Brand-specific CTA library
      ctaPreferences: biz.ctaPreferences, // NEW v5.6: CTA preferences
    })

    // 4b. Fetch V5 profile for tone DNA and examples (paid tier only)
    // NEW (June 12, 2026): Consolidated fetch - business_identity_persona now comes from BusinessContext
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured')

    // ═══ EXTRACT V5.5 ENHANCED EXAMPLES (if available) ═══
    // NOTE: tone_dna now comes from BusinessContext (resolve-context.ts) to avoid duplicate fetch
    let enhancedSocialExamples = null
    let enhancedAvoidExamples = null
    let brandProfileV5 = null
    
    if (isPaid) {
      const { data: profileData } = await supabase
        .from('business_brand_profile')
        .select('brand_profile_v5, enhanced_social_examples, enhanced_avoid_examples, social_writing_examples')
        .eq('business_id', businessId)
        .single()
      
      brandProfileV5 = profileData?.brand_profile_v5 || null
      
      // Priority: enhanced_social_examples (top-level) → nested in v5 voice → writing_examples.good_examples → social_writing_examples (fragments, last resort)
      enhancedSocialExamples = profileData?.enhanced_social_examples || 
                               brandProfileV5?.voice?.enhanced_social_examples || 
                               brandProfileV5?.writing_examples?.good_examples ||
                               profileData?.social_writing_examples ||
                               null
      
      enhancedAvoidExamples = profileData?.enhanced_avoid_examples || 
                              brandProfileV5?.voice?.enhanced_avoid_examples || 
                              null
      
      // Filter out empty examples
      if (Array.isArray(enhancedSocialExamples)) {
        enhancedSocialExamples = enhancedSocialExamples.filter((example: any) => 
          (typeof example === 'string' && example.trim().length > 0) ||
          (typeof example === 'object' && example.text && example.text.trim().length > 0)
        )
      }
    }

    const isWeeklyPlan = source === 'weekly_plan'
    const weeklyPlanContext = isWeeklyPlan ? buildWeeklyPlanContext(suggestion, content.captionFirstLineUsedAsHook) : ''
    
    // Extract tone_dna sub-fields for explicit prompt injection
    const toneDNA = biz.tone_dna || null
    const toneDNASummary = toneDNA?.strategic_summary || null
    const toneDoList = toneDNA?.tone_do_list || null
    const toneDontList = toneDNA?.tone_dont_list || null
    const locationNaturalVocab = toneDNA?.location_driver?.natural_vocabulary || null
    const locationAvoidVocab = toneDNA?.location_driver?.avoid_vocabulary || null
    const humorCharacter = toneDNA?.humor_character || null
    
    // Extract humor_style from brand_profile_v5.voice (separate from tone_dna)
    const humorStyle = brandProfileV5?.voice?.humor_style || null
    
    let prompt = buildPrompt({
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
      locationVocabulary: biz.locationVocabulary,
      brandSignaturePhrases: content.brandSignaturePhrases,
      contentAnchors: biz.contentAnchors,
      thingsToAvoid: biz.thingsToAvoid,
      forbidden_phrases: biz.forbidden_phrases,
      technical_terms: biz.technical_terms,
      weather_cliches: biz.weather_cliches,
      avoid_patterns: biz.avoid_patterns,
      seasonal_notes: biz.seasonal_notes,
      voiceConstraints: biz.voiceConstraints,
      emojiInstruction: biz.emojiInstruction,
      todayOpenTime: biz.todayOpenTime,
      // For menu/food posts: use kitchen close time when available and earlier than venue close.
      // For BTS posts with food context: also use kitchen time (food prep happens in kitchen).
      // For BTS posts about bar/service (no food): use venue time (bartenders work until venue close).
      todayCloseTime: (
        (['menu_item', 'product_menu', 'craving_visual'].includes(content.contentType || '') && biz.kitchenCloseTime)
          ? biz.kitchenCloseTime
          : (content.contentType === 'behind_scenes' && content.menuItemName && biz.kitchenCloseTime)
            ? biz.kitchenCloseTime  // BTS about food prep → kitchen hours
            : biz.todayCloseTime     // BTS about bar/service or atmosphere → venue hours
      ),
      hasOutdoorSeating: biz.hasOutdoorSeating,
      selectedCta,
      businessName: biz.businessName,
      city: biz.city,
      locationText: biz.locationText,
      language: biz.language,
      isPaid,
      weeklyPlanContext,
      isWeeklyPlan,
      ctaStyle,
      goalMode: content.resolvedGoalMode,
      bookingLink: biz.bookingLink,
      voiceRationale: biz.voiceRationale,
      venueIdentity: biz.venueIdentity,
      venueCharacter: biz.venueCharacter,
      venueScene: biz.venueScene,
      keyOfferings: biz.keyOfferings,  // Free tier: menu names from Profile
      identityKeywords: biz.identityKeywords,
      vertical: biz.vertical,
      effectiveVertical: biz.effectiveVertical,
      humorLevel: biz.humorLevel,
      formalityLevel: biz.formalityLevel,
      targetAudience: biz.targetAudience,
      communicationGoal: biz.communicationGoal,
      emotionalPromise: biz.emotionalPromise,
      contentExclusions: biz.contentExclusions,
      typicalOpenings: biz.typicalOpenings,
      locationIntelligenceMotivations: biz.locationIntelligenceMotivations,
      priceLevel: biz.priceLevel,
      doSayExamples: biz.doSayExamples,
      brandContext: biz.brandContext,
      activeSegmentName: biz.activeSegmentName,
      activeSegmentMotivation: biz.activeSegmentMotivation,
      activeSegmentAngle: biz.activeSegmentAngle,
      hospitalityDensityText: biz.hospitalityDensityText,
      seasonalContextSignal: biz.seasonalContextSignal,
      businessModelType: biz.businessModelType,
      primaryCopyHook: biz.primaryCopyHook,
      audienceBreadth: biz.audienceBreadth,
      // V5.5: Tone DNA strategic approach (from BusinessContext now)
      tone_dna: biz.tone_dna,
      tone_dna_summary: toneDNASummary,
      tone_do_list: toneDoList,
      tone_dont_list: toneDontList,
      location_natural_vocab: locationNaturalVocab,
      location_avoid_vocab: locationAvoidVocab,
      humor_style: humorStyle,
      humor_character: humorCharacter,
      locationIntelligenceNarrative: biz.locationIntelligenceNarrative,  // Fix 4: geo narrative for atmosphere posts
      business_identity_persona: biz.marketingManagerBrief || biz.businessIdentityPersona,  // V5.3: Prioritize marketing_manager_brief (synthesized) over business_identity_persona
      enhanced_social_examples: enhancedSocialExamples,
      enhanced_avoid_examples: enhancedAvoidExamples,
      // Factual anchoring: location and concept fields
      neighborhoodCharacter: biz.neighborhoodCharacter ?? null,
      neighborhood: biz.neighborhood ?? null,
      areaType: biz.areaType ?? null,
      localLocationReference: biz.localLocationReference ?? null,
      locationMarketingHooks: biz.locationMarketingHooks ?? null,
      signatureThemes: biz.signatureThemes ?? null,
    })

    console.log('📝 Prompt built, calling', model, '...')

    // DEBUG: Log full prompt to Supabase function logs so you can trace "why did AI produce this output?"
    // To read: Supabase Dashboard → Edge Functions → generate-text-from-idea → Logs
    const debugPromptLogging = Deno.env.get('DEBUG_PROMPT_LOGGING') === 'true'
    if (debugPromptLogging) {
      console.log('═══ PROMPT ═══\n', prompt)
    }

    // 6. Construct voice validation data from BusinessContext (no duplicate fetch)
    // NEW (June 12, 2026): Voice guardrails now come from BusinessContext.forbidden_phrases/technical_terms/etc
    // Only fetch brand_profile_v5 separately (not available in BusinessContext)
    let voiceGuardrails = null
    let brandProfileV5ForValidation = null
    
    if (isPaid) {
      // Construct guardrails object from BusinessContext fields (eliminates duplicate query)
      voiceGuardrails = {
        never_say: [],  // Already merged into biz.thingsToAvoid during BusinessContext resolution
        forbidden_phrases: biz.forbidden_phrases || [],
        technical_terms: biz.technical_terms || [],
        weather_cliches: biz.weather_cliches || [],
        avoid_patterns: biz.avoid_patterns || {}
      }
      
      // Only fetch brand_profile_v5 for validation (not duplicated in BusinessContext)
      const { data: validationData } = await supabase
        .from('business_brand_profile')
        .select('brand_profile_v5')
        .eq('business_id', businessId)
        .single()
      
      brandProfileV5ForValidation = validationData?.brand_profile_v5 || null
      
      console.log('🛡️ Voice validation ready:', {
        guardrails_source: 'BusinessContext',
        forbidden_phrases: voiceGuardrails.forbidden_phrases.length,
        technical_terms: voiceGuardrails.technical_terms.length,
        weather_cliches: voiceGuardrails.weather_cliches.length,
        v5_profile_available: !!brandProfileV5ForValidation
      })
    }

    // 7. Generate text with voice validation and retry
    let rawText = ''
    let aiKeyword = ''
    let voiceValidationAttempts = 0
    const maxValidationAttempts = 2
    
    while (voiceValidationAttempts < maxValidationAttempts) {
      voiceValidationAttempts++
      console.log(`🎯 Generation attempt ${voiceValidationAttempts}/${maxValidationAttempts}`)
      
      // Generate text
      const temperature = isPaid ? 0.7 : 0.0  // Free: 0.0 (deterministic facts-only), Paid: 0.7 (creative)
      const result = await callOpenAI(model, prompt, OPENAI_API_KEY, biz.language, undefined, temperature)
      rawText = result.cleanText
      aiKeyword = result.aiKeyword
      
      // If paid tier and V5 profile available, validate against voice rules
      // NEW (June 12, 2026): Use flattened voice_guardrails for 10x faster validation
      if (isPaid && (voiceGuardrails || brandProfileV5ForValidation)) {
        // Construct validation object - use flattened guardrails if available
        const validationProfile = voiceGuardrails 
          ? { guardrails: voiceGuardrails, voice: brandProfileV5ForValidation?.voice }
          : brandProfileV5ForValidation
        
        const validation = validateAgainstVoice(rawText, validationProfile as any)
        console.log(`🔍 Voice validation score: ${(validation.score * 100).toFixed(0)}%`)
        
        // Only critical violations trigger remediation
        const criticalViolations = validation.violations.filter(v => v.severity === 'critical')
        
        if (criticalViolations.length > 0 && voiceValidationAttempts < maxValidationAttempts) {
          console.warn(`⚠️ Voice violations detected (${criticalViolations.length} critical):`)
          criticalViolations.forEach(v => {
            console.warn(`  - [${v.type}] ${v.text}${v.suggestion ? ` → ${v.suggestion}` : ''}`)
            console.warn(`    Rule: ${v.rule}`)
          })
          
          // ═══ TRY TARGETED FIXES FIRST (much faster than regeneration) ═══
          console.log('🔧 Attempting targeted fixes...')
          const fixProfile = voiceGuardrails 
            ? { guardrails: voiceGuardrails, voice: brandProfileV5ForValidation?.voice }
            : brandProfileV5ForValidation
          const fixResult = applyTargetedVoiceFixes(rawText, criticalViolations, fixProfile as any)
          
          if (fixResult.fixesApplied.length > 0) {
            console.log(`✅ Applied ${fixResult.fixesApplied.length} targeted fixes:`)
            fixResult.fixesApplied.forEach(fix => console.log(`   ${fix}`))
            
            // Update text with fixes
            rawText = fixResult.text
            
            // Re-validate after fixes
            const revalidationProfile = voiceGuardrails 
              ? { guardrails: voiceGuardrails, voice: brandProfileV5ForValidation?.voice }
              : brandProfileV5ForValidation
            const revalidation = validateAgainstVoice(rawText, revalidationProfile as any)
            const stillCritical = revalidation.violations.filter(v => v.severity === 'critical')
            
            if (stillCritical.length === 0) {
              console.log('✅ All violations fixed via post-processing - no regeneration needed')
              break // Exit validation loop - fixes worked!
            } else {
              console.warn(`⚠️ ${stillCritical.length} critical violations remain after fixes`)
            }
          }
          
          // ═══ TARGETED FIXES INSUFFICIENT - REGENERATE ═══
          if (fixResult.unfixable.length > 0) {
            console.log(`🔄 ${fixResult.unfixable.length} violations require regeneration...`)
            
            // Add enforcement note to the prompt for retry
            const violationSummary = criticalViolations
              .map(v => v.suggestion ? `"${v.text}" → "${v.suggestion}"` : `"${v.text}"`)
              .join(', ')
            prompt += `\n\n⚠️ KRITISK: Teksten MÅ IKKE indeholde: ${violationSummary}\nDisse ord/fraser er STRENGT FORBUDT og vil resultere i afvist tekst.`
            
            // Continue to next iteration
            continue
          }
        }
        
        // Log warnings but don't retry
        const warnings = validation.violations.filter(v => v.severity === 'warning')
        if (warnings.length > 0) {
          console.warn(`⚠️ Voice warnings (${warnings.length} non-critical):`)
          warnings.forEach(v => console.warn(`  - [${v.type}] ${v.text}`))
        }
        
        console.log(`✅ Voice validation passed (score: ${(validation.score * 100).toFixed(0)}%, ${criticalViolations.length} critical, ${warnings.length} warnings)`)
      }
      
      // Validation passed or not applicable, break out of loop
      break
    }

    // 6b. Strip banned closers (training-data patterns that resist prompt-level bans)
    let cleanText = stripBannedClosers(rawText)

    // 6c. Strip AI-tell dashes (em-dash/en-dash used as stylistic connectors)
    cleanText = stripAIDashes(cleanText)
    // Step 6c-b: FIX 05 — Enforce universal emoji rules (count + position)
    cleanText = stripEmojiViolations(cleanText)

    // 6d. Strip incomplete sentence fragments (e.g. "Vi har åbent. Og 🥑." → "Vi har åbent.")
    cleanText = stripIncompleteFragments(cleanText)

    // 6e. Strip meta-instruction placeholders (defensive safeguard against prompt leakage)
    cleanText = stripMetaInstructions(cleanText)

    // 6f. Format validation for scene/mood posts (non-blocking — logs only)
    const isSceneMoodPost = ['atmosphere', 'behind_scenes', 'team_people'].includes(content.contentType)
    if (isSceneMoodPost) {
      const formatViolations = validateSceneFormat(cleanText)
      if (formatViolations.length > 0) {
        console.warn('⚠️ Scene format violations:', formatViolations)
      } else {
        console.log('✅ Scene format check passed')
      }
    }

    // 7. Conditional spelling correction
    if (needsSpellingCheck(cleanText, biz.language)) {
      const corrected = await silentCorrect(cleanText, biz.language, biz.brandTone, OPENAI_API_KEY)
      if (corrected !== cleanText) {
        console.log('✏️ Spelling corrected:', corrected.substring(0, 100))
        cleanText = corrected
      }
    } else {
      console.log('✏️ Spelling check skipped — no error signals detected')
    }

    // 7b. Ensure post body ends with terminal punctuation
    if (cleanText.length > 0 && !'.!?"'.includes(cleanText[cleanText.length - 1])) {
      cleanText = cleanText + '.'
    }

    // 8. Hashtags
    const extractedKeyword = extractTopicKeyword(content.contentBlock, content.menuItemName, aiKeyword)
    const hashtags = generateHashtags(biz.city, content.contentType, extractedKeyword, biz.businessName, {
      vertical: biz.vertical,
      text: cleanText,
      detectedDishName: content.menuItemName || undefined,
      detectedDishDescription: content.menuItemDescription || undefined,
      aiPlaceSynopsis: biz.aiPlaceSynopsis || undefined,      // FIX 04: Stable venue classification signal
      menuDescription: biz.menuDescription || undefined,      // FIX 04: Stable venue classification signal
    }, locationNaturalVocab)  // FIX 03-B: Pass location vocabulary for location-specific hashtags

    // 9. Response
    // FIX GAP A: Check for 'booking' not 'visit' (vocabulary normalized in select-cta.ts)
    const isBookingIntent = ctaIntent === 'booking' && !!biz.bookingLink
    const hasCTA = selectedCta !== null
    
    const response = {
      sharedText: cleanText,
      facebook: {
        text: cleanText,
        hashtags: hashtags.facebook,
        ...(hasCTA ? {
          cta: {
            text: selectedCta,
            type: isBookingIntent ? 'booking' : 'soft',
            ...(isBookingIntent ? { url: biz.bookingLink } : {})
          }
        } : {})
      },
      instagram: {
        text: cleanText,
        hashtags: hashtags.instagram,
        ...(hasCTA ? { cta: { text: selectedCta, type: 'soft' } } : {})
      },
      ...(content.warnings?.length > 0 ? { warnings: content.warnings } : {}),
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

    // Record text generation in usage tracking (for daily suggestions only)
    if (source === 'ai_ideas' && suggestion.id) {
      try {
        const { error: trackingError } = await supabase
          .rpc('record_text_generation', { p_suggestion_id: suggestion.id })
        if (trackingError) {
          console.warn('⚠️ Failed to record text generation:', trackingError)
        } else {
          console.log('📊 Recorded text generation for suggestion:', suggestion.id)
        }
      } catch (err) {
        console.warn('⚠️ Text generation tracking error:', err)
      }
    }

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
