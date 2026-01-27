/**
 * Brand Profile Generator - Edge Function
 * 
 * Generates AI-powered brand profiles for businesses.
 * 
 * v4.11.8 - CRITICAL: Fixed content_pillars validation by extracting array values correctly
 * v4.11.7 - DEBUG: Added detailed logging for remaining hard errors
 * v4.11.6 - CRITICAL: Fixed 8 hard errors by preserving proof arrays in parseBrandProfileResponse()
 * v4.11.5 - Fixed: primaryLanguage undefined error (use language.name)
 * v4.7.3 - CRITICAL: tone_model DB constraint violation fix
 * 
 * Changelog:
 * - v4.11.8: Added pickArrayValue() helper to handle content_pillars extraction (fixes last validation error)
 * - v4.11.8: content_pillars now correctly extracts from both direct arrays and {value: array} objects
 * - v4.11.7: Added detailed logging to identify remaining hard error after proof fix
 * - v4.11.5: Fixed ReferenceError: primaryLanguage undefined (use language.name instead)
 * - v4.11.4: Clarified proof rules to quote Danish evidence (not English labels from hooks)
 * - v4.11.3: Updated Prompt B proof rules to forbid content trigger references (prevents translation corruption)
 * - v4.11.3: Enforces verbatim quotes from source data only (no EN→DA re-translation)
 * - v4.11.2: Added content_triggers[].trigger names to proof allowlist (e.g., "Waterfront Dining Experience")
 * - v4.11.1: Expanded buildAllowedProofTokens() to include hook labels and usage occasion IDs (fixes proof grounding over-filtering)
 * - v4.11.1: Added debug logging to verify proof token expansion is active
 * - v4.7.3: Added sanitizeToneModelForDb() to ensure DB-safe tone_model (never 500 on constraint violation)
 * - v4.7.3: Improved error handling for tone_model DB constraints (return 422, not 500)
 * - v4.7.3: Added runtime tests for tone_model sanitizer
 * - v4.7.3: Retry save with tone_model=null if constraint violation occurs
 * - v4.7.2: Fixed tone_model.generated_at hallucination (always override with current timestamp)
 * - v4.7.2: Removed "indbydende" from tone_of_voice fallback (was causing validation errors)
 * - v4.7.2: Added deterministic patch for content_pillars missing notes
 * - v4.7.2: Hardcoded tone_model.version="2.0" and source="website" (never trust AI for metadata)
 * - v4.7.1: Menu data reduced to business type only, timeout 45s→60s (fix Prompt A timeouts)
 * - v4.7: Added source hashing, version_hash tracking, skip regeneration if unchanged
 * - v4.6: Added quality_status computation and storage (green/yellow/red)
 * - v4.5: Added tone_of_voice + content_focus fallbacks, complete field overwrites in repair
 * - v4.4: Increased max_tokens 2000→3500, added explicit size limits (prevent truncation)
 * - v4.3: Filter hooks by language (no English hooks in Danish content)
 * - v4.2: Added country name→ISO code mapping, Danish waterfront phrase to generic locale
 * - v4.1: Fixed locale resolution to use location.city, fixed fallback location phrases
 * - v4.0: Phase 2 - Error Tracking, Multi-Locale, Robust Fallbacks
 * - v2.2: Converted Prompt B to JSON output
 * - v2.3: Added controlled third-party context flag
 * - v2.4: Added must_use_phrases, concrete_anchors, disallowed_generic_words
 * - v2.5: Added hard evidence constraints
 * - v2.6: Reduced Prompt B information overload
 * - v2.11: Model optimization (gpt-4o + temp 0.5)
 * - v3.1: Production hardening (timeout, retry, request ID)
 * - v3.2: Modular refactoring for maintainability
 */

// @ts-ignore - Deno imports work at runtime
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - Deno imports work at runtime
import { createClient } from 'npm:@supabase/supabase-js@2.39.0'

// Deno global type declaration for TypeScript
declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
}

// Import from shared brand-profile module
import {
  // Types
  type LanguageConfig,
  type BrandProfile,
  type DataSources,
  type LocaleConfig,
  
  // Languages
  detectLanguageFromData,
  
  // Error Management
  ErrorCollector,
  ErrorCategory,
  ErrorSeverity,
  
  // Locale System
  resolveLocale,
  getTranslation,
  
  // Fallback System
  buildBrandEssenceFallback,
  buildSignatureShotFallback,
  buildTargetAudienceFallback,
  buildToneOfVoiceFallback,
  buildContentFocusFallback,
  removeBannedWords,
  sanitizeBannedWords,
  
  // OpenAI
  fetchOpenAIWithRetry,
  parseOpenAIJson,
  OpenAIHttpError,
  
  // Data gathering
  gatherDataSources,
  buildMenuSummary,
  buildImagesSummary,
  buildSocialSummary,
  
  // Signal extraction
  extractStructuredWebsiteData,
  ensureMustUsePhrasesFallback,
  
  // Prompts
  buildPromptA,
  buildPromptB,
  buildSystemPromptB,
  BRAND_PROFILE_SCHEMA,
  
  // A1/A2 Split Architecture (v4.11.0)
  buildPromptA1Evidence,
  buildPromptA2Interpretation,
  type PromptA1Evidence,
  type PromptA2Interpretation,
  
  // Validators
  validateBrandProfileOutput,
  validateFinalBrandProfile,
  repairBrandProfile,
  buildAllowedProofTokens,
  buildNormalizedRefs,
  
  // Soft Repairs & Proof Grounding (v4.9.0)
  categorizeErrors,
  applySoftRepairs,
  logRepairResults,
  applyProofGrounding,
  logProofGroundingResults,
  
  // Database
  saveBrandProfile
} from '../_shared/brand-profile/index.ts'

// Tone Model Sanitizer (v4.7.3 - Critical fix for DB constraint violations)
import {
  sanitizeToneModelForDb,
  runToneModelSanitizerTests
} from '../_shared/brand-profile/tone-model.ts'

// Hashing utilities for change detection
import {
  computeSourceHashes,
  computeVersionHash,
  shouldRegenerateProfile,
  saveSourceHashes
} from '../_shared/brand-profile/hashing.ts'

// Validation utilities
import {
  isBadTargetAudienceValue,
  isBadCoreOfferingsValue,
  isBadContentFocusValue,
  isBadCtaStyleValue
} from '../_shared/brand-profile/validation/value-validators.ts'

import {
  DISTINCTIVE_HOOK_SOURCES,
  DISTINCTIVE_HOOK_CONFIDENCE,
  validateDistinctiveHooksContract,
  ensureDistinctiveHooksMinimum,
  computeDifferentiationConfidence,
  buildEvidenceCorpus
} from '../_shared/brand-profile/validation/contract-validators.ts'

// Repair utilities
import {
  buildFallbackTargetAudience,
  buildFallbackCoreOfferings,
  buildFallbackContentFocus,
  buildFallbackCtaStyle,
  buildFallbackSignatureShot,
  buildFallbackBrandEssence
} from '../_shared/brand-profile/repair/fallback-builders.ts'

import {
  applyDeterministicRepairs
} from '../_shared/brand-profile/repair/deterministic-repairs.ts'

import {
  patchContentPillarsNotesToReferenceHooks
} from '../_shared/brand-profile/repair/patchers.ts'

// ============================================================================
// CONFIGURATION
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const AI_MODELS = {
  analysis: 'gpt-4o',
  generation: 'gpt-4o'
}

// Feature Flags (v4.11.0)
const USE_SPLIT_PROMPT_A = Deno.env.get('USE_SPLIT_PROMPT_A') === 'true' // Default: false

// Global error collector for request
let requestErrors: ErrorCollector | null = null

// Generate unique request ID for traceability
function generateRequestId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `bp-${timestamp}-${random}`
}

/**
 * Normalize content_pillars to always return a valid array.
 * Handles: direct array, stringified array, {value: array}, {value: stringified}
 * v4.11.8 - Prevents .map() crashes on malformed content_pillars
 */
function normalizeContentPillars(input: any): any[] {
  let v = input

  if (v && typeof v === "object" && !Array.isArray(v) && "value" in v) v = (v as any).value

  if (typeof v === "string") {
    const s = v.trim()
    if (s.startsWith("[")) {
      try { v = JSON.parse(s) } catch { v = [] }
    } else v = []
  }

  if (!Array.isArray(v)) v = []

  return v.map((p: any) => ({
    pillar: p?.pillar,
    allowed: !!p?.allowed,
    encouraged: !!p?.encouraged,
    notes: (typeof p?.notes === "string" && p.notes.trim().length > 0)
      ? p.notes.trim()
      : "Neutral default: passer til venue-type og dokumenterede hooks"
  }))
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Merge A1 + A2 outputs into legacy Prompt A analysis format.
 * Maps new A2 structure back to existing fields expected by Prompt B.
 * 
 * v4.11.0 - A1/A2 Split Architecture
 */
function mergeA1A2ToLegacyAnalysis(
  a1: PromptA1Evidence,
  a2: PromptA2Interpretation,
  dataSources: DataSources
): any {
  // Build geo_context from A1 location facts
  const geoContext = a1.facts.location.city ? {
    city: a1.facts.location.city,
    area_hint: a1.facts.location.area_type,
    evidence: a1.facts.location.quotes.map(q => ({
      quote: q.quote,
      source: q.source
    }))
  } : undefined

  // Map distinctive_hooks from A2 to legacy format
  const distinctiveHooks = a2.distinctive_hooks.map(h => ({
    hook: h.hook,
    evidence: h.evidence_refs.join('; '),
    source: 'A1_evidence',
    confidence: h.confidence
  }))

  // Map rituals_and_moments from A2 to legacy format
  const ritualsAndMoments = a2.rituals_and_moments.map(r => ({
    moment: r.moment,
    evidence: r.evidence_refs.join('; '),
    confidence: r.confidence
  }))

  // Map usage_occasions from A2 (already in correct format)
  const usageOccasions = a2.usage_occasions.map(occ => ({
    id: occ.id,
    name: occ.name,
    when: occ.when,
    situation: occ.situation,
    behavior: occ.behavior,
    job_to_be_done: occ.job_to_be_done,
    evidence: occ.evidence_refs.map(ref => ({
      quote: ref,
      source: 'A1_evidence'
    })),
    confidence: occ.confidence
  }))

  // Map content_triggers from A2 (already in correct format)
  const contentTriggers = a2.content_triggers.map(t => ({
    trigger: t.trigger,
    based_on_usage_occasion_ids: t.based_on_usage_occasion_ids,
    what_to_show: t.what_to_show,
    copy_angles: t.copy_angles,
    evidence: t.evidence_refs.map(ref => ({
      quote: ref,
      source: 'A1_evidence'
    })),
    confidence: t.confidence
  }))

  // Build legacy signals object from A1 evidence
  const signals = {
    core_offerings: {
      must_use_phrases: a1.facts.menu.meal_anchors || [],
      items: a1.facts.menu.items || []
    },
    website_ctas: a1.facts.website.ctas || [],
    hero_texts: a1.facts.website.hero_texts || []
  }

  // Return merged legacy analysis object
  return {
    business_id: a1.business_id,
    generated_at: a1.generated_at,
    analysis_version: a2.analysis_version,
    
    // Core analysis fields expected by Prompt B
    distinctive_hooks: distinctiveHooks,
    rituals_and_moments: ritualsAndMoments,
    usage_occasions: usageOccasions,
    content_triggers: contentTriggers,
    geo_context: geoContext,
    
    // Voice context (map A2 to legacy format)
    voice_context: {
      location_profile: a2.voice_context.location_profile,
      business_personality: a2.voice_context.business_personality,
      language_mix: a2.voice_context.language_mix,
      energy_level: a2.voice_context.energy_level,
      reasoning: a2.voice_context.reasoning
    },
    
    // Signals (for must_use_phrases extraction)
    signals,
    
    // A1 evidence (store for debugging/traceability)
    _a1_evidence: a1,
    _a2_interpretation: a2
  }
}

/**
 * Runs Prompt A - Internal Analysis.
 * Extracts signals and evidence from data sources.
 * 
 * v4.11.0: Supports both legacy (single Prompt A) and split (A1→A2) modes.
 * Mode controlled by USE_SPLIT_PROMPT_A feature flag.
 */
async function runInternalAnalysis(
  dataSources: DataSources,
  language: LanguageConfig,
  allowThirdParty: boolean,
  requestId: string,
  extraUserInstruction: string = ''
): Promise<any> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')!

  // v4.11.0: Split Prompt A into A1 (evidence) → A2 (interpretation)
  if (USE_SPLIT_PROMPT_A) {
    console.log(`[${requestId}] 🔬 Running A1 (evidence extraction)...`)
    
    // Step 1: Run A1 - Evidence Extraction
    const promptA1 = buildPromptA1Evidence(dataSources, language, allowThirdParty)
    const a1Response = await fetchOpenAIWithRetry(
      apiKey,
      {
        model: AI_MODELS.analysis,
        messages: [
          { role: 'system', content: language.systemPromptA },
          { role: 'user', content: promptA1 }
        ],
        temperature: 0.2,  // Lower temp for fact extraction
        max_tokens: 3000,
        response_format: { type: 'json_object' }
      },
      requestId,
      'Prompt A1 (Evidence Extraction)'
    )

    const a1Content = a1Response.choices[0]?.message?.content
    if (!a1Content) {
      throw new Error('No response from AI (Prompt A1)')
    }

    let a1Evidence: PromptA1Evidence
    try {
      a1Evidence = parseOpenAIJson<PromptA1Evidence>(a1Content)
      console.log(`[${requestId}] ✅ A1 evidence extracted:`, {
        location: a1Evidence.facts.location.city,
        menu_items: a1Evidence.facts.menu.items.length,
        ctas: a1Evidence.facts.website.ctas.length,
        quotes_total: 
          a1Evidence.facts.location.quotes.length +
          a1Evidence.facts.menu.quotes.length +
          a1Evidence.facts.website.quotes.length +
          a1Evidence.facts.social.quotes.length +
          a1Evidence.facts.images.quotes.length
      })
    } catch (e) {
      const errMsg = (e as Error)?.message || String(e)
      console.log(`[${requestId}] ⚠️ A1 returned invalid JSON: ${errMsg}`)
      throw new Error(`Prompt A1 JSON parse failed: ${errMsg}`)
    }

    // Step 2: Run A2 - Interpretation
    console.log(`[${requestId}] 🧠 Running A2 (interpretation)...`)
    const promptA2 = buildPromptA2Interpretation(a1Evidence, dataSources, language, allowThirdParty)
    const a2Response = await fetchOpenAIWithRetry(
      apiKey,
      {
        model: AI_MODELS.analysis,
        messages: [
          { role: 'system', content: language.systemPromptA },
          { role: 'user', content: promptA2 }
        ],
        temperature: 0.3,  // Higher temp for interpretation
        max_tokens: 3500,
        response_format: { type: 'json_object' }
      },
      requestId,
      'Prompt A2 (Interpretation)'
    )

    const a2Content = a2Response.choices[0]?.message?.content
    if (!a2Content) {
      throw new Error('No response from AI (Prompt A2)')
    }

    let a2Interpretation: PromptA2Interpretation
    try {
      a2Interpretation = parseOpenAIJson<PromptA2Interpretation>(a2Content)
      console.log(`[${requestId}] ✅ A2 interpretation complete:`, {
        distinctive_hooks: a2Interpretation.distinctive_hooks.length,
        rituals_and_moments: a2Interpretation.rituals_and_moments.length,
        usage_occasions: a2Interpretation.usage_occasions.length,
        content_triggers: a2Interpretation.content_triggers.length,
        voice_profile: a2Interpretation.voice_context.location_profile
      })
    } catch (e) {
      const errMsg = (e as Error)?.message || String(e)
      console.log(`[${requestId}] ⚠️ A2 returned invalid JSON: ${errMsg}`)
      throw new Error(`Prompt A2 JSON parse failed: ${errMsg}`)
    }

    // Step 3: Merge A1 + A2 into legacy analysis format
    console.log(`[${requestId}] 🔀 Merging A1+A2 into legacy format...`)
    const mergedAnalysis = mergeA1A2ToLegacyAnalysis(a1Evidence, a2Interpretation, dataSources)
    return mergedAnalysis
  }

  // Legacy mode: Single Prompt A
  console.log(`[${requestId}] 🔍 Running legacy Prompt A...`)
  const prompt =
    buildPromptA(dataSources, language, allowThirdParty) +
    (extraUserInstruction ? `\n\n---\nREPAIR / STRICTNESS OVERRIDE:\n${extraUserInstruction}\n` : '') +
    `\n\n---\nJSON SAFETY (MANDATORY):\n- Output ONLY a single JSON object.\n- In JSON string fields, avoid raw double quotes (") inside values. If you need to reference a phrase, write it without surrounding double quotes.\n- Never add trailing text after the closing brace.`

  const fixInvalidJsonToAnalysis = async (raw: string, reason: string): Promise<any> => {
    const fixer = await fetchOpenAIWithRetry(
      apiKey,
      {
        model: AI_MODELS.analysis,
        messages: [
          {
            role: 'system',
            content:
              'You are a JSON repair tool. Output ONLY valid JSON (no markdown, no commentary).\n' +
              'Rules:\n- Do NOT invent new facts. Preserve the intended content as much as possible.\n- Ensure strings are valid JSON (escape quotes properly).\n- Output must match the Prompt A internal analysis schema keys.'
          },
          {
            role: 'user',
            content: `Convert the following INVALID JSON-ish response into VALID JSON for Prompt A (Internal Analysis).\n\nReason: ${reason}\n\nINVALID RESPONSE (verbatim):\n${raw}`
          }
        ],
        temperature: 0.0,
        max_tokens: 2200,
        response_format: { type: 'json_object' }
      },
      requestId,
      'Prompt A (Internal Analysis) - JSON fixer'
    )

    const fixedContent = fixer.choices[0]?.message?.content
    if (!fixedContent) throw new Error('No response from AI (Prompt A JSON fixer)')
    return parseOpenAIJson<any>(fixedContent)
  }
  
  const data = await fetchOpenAIWithRetry(
    apiKey,
    {
      model: AI_MODELS.analysis,
      messages: [
        { role: 'system', content: language.systemPromptA },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 3500,  // Increased from 2000 to prevent truncation of large JSON
      response_format: { type: 'json_object' },
    },
    requestId,
    'Prompt A (Internal Analysis)'
  )

  const content = data.choices[0]?.message?.content

  if (!content) {
    throw new Error('No response from AI')
  }

  try {
    return parseOpenAIJson(content)
  } catch (e) {
    const errMsg = (e as Error)?.message || String(e)
    console.log(`[${requestId}] ⚠️ Prompt A returned invalid JSON, attempting JSON fixer...`)
    try {
      return await fixInvalidJsonToAnalysis(content, errMsg)
    } catch (fixErr) {
      const fixMsg = (fixErr as Error)?.message || String(fixErr)
      throw new Error(`Prompt A JSON fix failed: ${fixMsg}`)
    }
  }
}

/**
 * Runs Prompt B - Brand Profile Generation.
 * Generates user-facing brand profile from analysis.
 */
async function generateBrandProfile(
  dataSources: DataSources,
  analysis: any,
  language: LanguageConfig,
  locale: LocaleConfig,
  requestId: string,
  ignoreConfidenceCheck = false
): Promise<BrandProfile> {
  const prompt = buildPromptB(dataSources, analysis, language, locale)
  const apiKey = Deno.env.get('OPENAI_API_KEY')!

  const fixInvalidJsonToSections = async (raw: string, reason: string): Promise<any> => {
    const fixer = await fetchOpenAIWithRetry(
      apiKey,
      {
        model: AI_MODELS.generation,
        messages: [
          {
            role: 'system',
            content: `You are a JSON repair tool. Output ONLY valid JSON (no markdown, no commentary).\n\nRules:\n- Do NOT invent new facts. Preserve the user's intended content as much as possible.\n- Ensure strings are valid JSON (escape quotes properly).\n- Output must match the required Brand Profile schema keys.`
          },
          {
            role: 'user',
            content: `Convert the following INVALID JSON-ish response into VALID JSON that matches the Brand Profile schema.\n\nIf you cannot preserve a detail without inventing, move uncertainty into clarifications_needed[] and keep user-facing fields conservative.\n\nReason: ${reason}\n\nINVALID RESPONSE (verbatim):\n${raw}`
          }
        ],
        temperature: 0.0,
        max_tokens: 3200,
        response_format: { type: 'json_object' }
      },
      requestId,
      'Prompt B (Brand Profile Generation) - JSON fixer'
    )

    const fixedContent = fixer.choices[0]?.message?.content
    if (!fixedContent) throw new Error('No response from AI (JSON fixer)')
    return parseOpenAIJson<any>(fixedContent)
  }
  
  const data = await fetchOpenAIWithRetry(
    apiKey,
    {
      model: AI_MODELS.generation,
      messages: [
        { role: 'system', content: buildSystemPromptB(language) },
        {
          role: 'user',
          content: `${prompt}\n\n---\nJSON SAFETY (MANDATORY):\n- In JSON string fields, avoid raw double quotes (") inside values. If you need to reference a phrase, write it without surrounding double quotes.\n- Never add trailing text after the closing brace.`
        }
      ],
      temperature: 0.25,
      max_tokens: 3000,
      response_format: { type: 'json_object' }
    },
    requestId,
    'Prompt B (Brand Profile Generation)'
  )

  const content = data.choices[0]?.message?.content

  if (!content) {
    throw new Error('No response from AI')
  }

  // Parse and validate
  let sections: any
  try {
    sections = parseOpenAIJson<any>(content)
  } catch (e) {
    const errMsg = (e as Error)?.message || String(e)
    console.log(`[${requestId}] ⚠️ Prompt B returned invalid JSON, attempting JSON fixer...`)
    try {
      sections = await fixInvalidJsonToSections(content, errMsg)
    } catch (fixErr) {
      console.log(`[${requestId}] ⚠️ JSON fixer failed, retrying Prompt B once with stricter JSON instruction...`)

      const retry = await fetchOpenAIWithRetry(
        apiKey,
        {
          model: AI_MODELS.generation,
          messages: [
            { role: 'system', content: buildSystemPromptB(language) },
            {
              role: 'user',
              content: `${prompt}\n\n---\nIMPORTANT: Your previous response was invalid JSON and could not be parsed. Return ONLY valid JSON matching the required schema. Do not include markdown, comments, or trailing text. Ensure all strings are properly escaped. Avoid raw double quotes inside any string values.`
            }
          ],
          temperature: 0.1,
          max_tokens: 3000,
          response_format: { type: 'json_object' }
        },
        requestId,
        'Prompt B (Brand Profile Generation) - JSON retry'
      )

      const retryContent = retry.choices[0]?.message?.content
      if (!retryContent) {
        throw new Error(`No response from AI (Prompt B JSON retry): ${errMsg}`)
      }

      try {
        sections = parseOpenAIJson<any>(retryContent)
      } catch {
        // Last resort: attempt fixer on retry output
        try {
          sections = await fixInvalidJsonToSections(retryContent, `Retry JSON still invalid: ${errMsg}`)
        } catch (finalFixErr) {
          const finalFixMsg = (finalFixErr as Error)?.message || String(finalFixErr)
          throw new Error(`Prompt B JSON fix failed after retry: ${finalFixMsg}`)
        }
      }
    }
  }
  
  // Apply deterministic post-processing repairs (Fix #3)
  console.log(`[${requestId}] 🔧 Applying deterministic repairs...`)
  sections = applyDeterministicRepairs(sections, dataSources, analysis, language.code, locale)
  
  // v4.11.8: Ensure content_pillars has minimum 3 items BEFORE validation
  if (Array.isArray((sections as any)?.content_pillars)) {
    let pillars = normalizeContentPillars((sections as any).content_pillars)
    if (pillars.length < 3) {
      console.log(`[${requestId}] 🔧 Padding content_pillars from ${pillars.length} to 3 items`)
      while (pillars.length < 3) {
        const genericPillars = ['Atmosphere', 'Experience', 'Quality', 'Community', 'Innovation']
        const nextPillar = genericPillars[pillars.length] || `Content Theme ${pillars.length + 1}`
        pillars.push({
          pillar: nextPillar,
          allowed: true,
          encouraged: false,
          notes: `Inferred to meet minimum pillars requirement`
        })
      }
    }
    (sections as any).content_pillars = pillars
  } else if ((sections as any)?.content_pillars) {
    // Not an array but exists - normalize it
    console.log(`[${requestId}] 🔧 Normalizing non-array content_pillars`)
    let pillars = normalizeContentPillars((sections as any).content_pillars)
    if (pillars.length < 3) {
      while (pillars.length < 3) {
        const genericPillars = ['Atmosphere', 'Experience', 'Quality', 'Community', 'Innovation']
        const nextPillar = genericPillars[pillars.length] || `Content Theme ${pillars.length + 1}`
        pillars.push({
          pillar: nextPillar,
          allowed: true,
          encouraged: false,
          notes: `Inferred to meet minimum pillars requirement`
        })
      }
    }
    (sections as any).content_pillars = pillars
  }
  
  const validationErrors = validateBrandProfileOutput(sections, analysis, dataSources)
  if (validationErrors.length > 0) {
    console.log(`[${requestId}] ❌ Validation errors:`, validationErrors)
    
    // v4.9.0 Phase 1, Task B: Separate hard vs soft errors
    const { hardErrors, softErrors } = categorizeErrors(validationErrors)
    console.log(`[${requestId}] 📊 Error breakdown: ${hardErrors.length} hard, ${softErrors.length} soft`)
    
    // Apply soft repairs first (deterministic, fast)
    if (softErrors.length > 0) {
      const repairResult = applySoftRepairs(sections, softErrors)
      logRepairResults(repairResult)
      
      if (repairResult.repaired) {
        sections = sections // Profile mutated in place by applySoftRepairs
        console.log(`[${requestId}] ✅ Soft repairs applied, re-validating...`)
        
        // v4.9.0 Phase 2 Task D: Apply proof grounding after soft repairs
        const allowedTokens = buildAllowedProofTokens(analysis, dataSources)
        const normalizedRefs = buildNormalizedRefs(analysis)
        const proofGroundingResult = applyProofGrounding(sections, allowedTokens, normalizedRefs)
        logProofGroundingResults(proofGroundingResult, requestId)
        
        // Re-validate after soft repairs + proof grounding
        const afterSoftRepairErrors = validateBrandProfileOutput(sections, analysis, dataSources)
        const { hardErrors: remainingHard, softErrors: remainingSoft } = categorizeErrors(afterSoftRepairErrors)
        
        console.log(`[${requestId}] 📊 After soft repairs: ${remainingHard.length} hard, ${remainingSoft.length} soft remaining`)
        
        // Only proceed to AI repair if hard errors remain
        if (remainingHard.length === 0 && remainingSoft.length === 0) {
          console.log(`[${requestId}] ✅ All errors resolved via soft repairs, skipping AI repair`)
        } else if (remainingHard.length > 0) {
          console.log(`[${requestId}] ⚠️  Hard errors remain, triggering AI repair...`)
          console.log(`[${requestId}] 📄 AI output BEFORE AI repair:`, JSON.stringify(sections, null, 2))
          const apiKey = Deno.env.get('OPENAI_API_KEY')
          sections = await repairBrandProfile(sections, remainingHard, language, apiKey, fetch, true, analysis, dataSources)
        }
      }
    }
    
    // If there were hard errors from the start, trigger AI repair
    if (hardErrors.length > 0 && softErrors.length === 0) {
      console.log(`[${requestId}] 🔴 Hard errors detected, triggering AI repair...`)
      console.log(`[${requestId}] 📄 AI output BEFORE AI repair:`, JSON.stringify(sections, null, 2))
      const apiKey = Deno.env.get('OPENAI_API_KEY')
      sections = await repairBrandProfile(sections, hardErrors, language, apiKey, fetch, true, analysis, dataSources)
    }

    const postRepairErrors = validateBrandProfileOutput(sections, analysis, dataSources)
    if (postRepairErrors.length > 0) {
      // Safety net: apply targeted deterministic fallbacks for the most common failure modes,
      // then revalidate once. This prevents the whole run from 500ing on fixable formatting.
      const needSig = postRepairErrors.some(e => String(e).includes('image_preferences.signature_shot'))
      const needEssenceLocation = postRepairErrors.some(e => String(e).includes('brand_essence must include a location cue'))
      const needPillarHookRef = postRepairErrors.some(e => String(e).includes('content_pillars') && String(e).includes('notes must reference'))
      const needTargetAudience = postRepairErrors.some(e => String(e).includes('target_audience'))
      const needCoreOfferings = postRepairErrors.some(e => String(e).includes('core_offerings'))
      const needContentFocus = postRepairErrors.some(e => String(e).includes('content_focus'))
      const needCtaStyle = postRepairErrors.some(e => String(e).includes('cta_style'))

      if (needSig) {
        sections = {
          ...(sections || {}),
          image_preferences: {
            ...((sections as any)?.image_preferences || {}),
            signature_shot: buildFallbackSignatureShot(dataSources, analysis, language)
          }
        }
      }
      if (needEssenceLocation) {
        sections = {
          ...(sections || {}),
          brand_essence: {
            ...(sections as any)?.brand_essence,
            value: buildFallbackBrandEssence(dataSources, analysis, language),
            proof: Array.isArray((sections as any)?.brand_essence?.proof) ? (sections as any).brand_essence.proof : ['#1']
          }
        }
      }
      if (needPillarHookRef) {
        sections = patchContentPillarsNotesToReferenceHooks(sections)
      }
      // v4.11.8: Normalize content_pillars safely (prevents .map() crash)
      if ((sections as any)?.content_pillars) {
        const normalized = normalizeContentPillars((sections as any).content_pillars)
        (sections as any).content_pillars = normalized
      }
      if (needTargetAudience) {
        const fallback = buildFallbackTargetAudience(dataSources, analysis, language)
        sections = {
          ...(sections || {}),
          __fallback_target_audience: true,
          target_audience: {
            ...((sections as any)?.target_audience || {}),
            value: fallback.value,
            proof: fallback.proof
          }
        }
      }
      if (needCoreOfferings) {
        const fallback = buildFallbackCoreOfferings(dataSources, analysis, language)
        sections = {
          ...(sections || {}),
          __fallback_core_offerings: true,
          core_offerings: {
            ...((sections as any)?.core_offerings || {}),
            value: fallback.value,
            proof: fallback.proof
          }
        }
      }
      if (needContentFocus) {
        const fallback = buildFallbackContentFocus(dataSources, analysis, language)
        sections = {
          ...(sections || {}),
          __fallback_content_focus: true,
          content_focus: {
            ...((sections as any)?.content_focus || {}),
            value: fallback.value,
            proof: fallback.proof
          }
        }
      }
      if (needCtaStyle) {
        const fallback = buildFallbackCtaStyle(dataSources, analysis, language)
        sections = {
          ...(sections || {}),
          __fallback_cta_style: true,
          cta_style: {
            ...((sections as any)?.cta_style || {}),
            value: fallback.value,
            proof: fallback.proof
          }
        }
      }

      const afterFallbackErrors = validateBrandProfileOutput(sections, analysis, dataSources)
      if (afterFallbackErrors.length === 0) {
        console.log(`[${requestId}] ✅ Applied deterministic fallbacks and passed validation`)
      } else {
        // v4.8.8 Task 1: Last resort - sanitize banned words before checking errors
        const hasBannedWordErrors = afterFallbackErrors.some(e => String(e).includes('🚫 BANNED WORD INCONSISTENCY'))
        if (hasBannedWordErrors) {
          console.log(`[${requestId}] 🧹 Banned word violations detected after repair. Applying sanitization...`)
          sections = sanitizeBannedWords(sections)
          
          // Revalidate after sanitization
          const afterSanitizationErrors = validateBrandProfileOutput(sections, analysis, dataSources)
          
          // If sanitization fixed all errors, we're done
          if (afterSanitizationErrors.length === 0) {
            console.log(`[${requestId}] ✅ Sanitization successful - all errors resolved`)
          } else {
            // Update error list to reflect post-sanitization state
            afterFallbackErrors.length = 0
            afterFallbackErrors.push(...afterSanitizationErrors)
          }
        }
        
        // Only proceed with error categorization if there are still errors
        if (afterFallbackErrors.length > 0) {
          // Separate differentiation warnings (can be ignored) from structural errors (cannot)
        const differentiationWarnings = afterFallbackErrors.filter(err => {
          const errStr = String(err)
          return errStr.includes('distinctive hook') || 
                 errStr.includes('proof does not reference')
        })
        
        const structuralErrors = afterFallbackErrors.filter(err => {
          const errStr = String(err)
          return errStr.includes('must include location cue') ||
                 errStr.includes('must include action cue') ||
                 errStr.includes('must include CTA phrase') ||
                 errStr.includes('contains disallowed generic word') ||
                 (errStr.includes('missing') && !errStr.includes('distinctive hook'))
        })
        
        // v4.9.0 Phase 1 Task F: Never throw - log warnings instead
        if (structuralErrors.length > 0) {
          console.warn(`[${requestId}] ⚠️ Structural validation warnings (non-fatal):`, structuralErrors.slice(0, 12))
        }
        
        if (!ignoreConfidenceCheck && differentiationWarnings.length > 0) {
          console.warn(`[${requestId}] ⚠️ Differentiation warnings:`, differentiationWarnings.slice(0, 12))
        } else if (differentiationWarnings.length > 0) {
          console.log(`[${requestId}] ⚠️ Differentiation warnings ignored (flag set):`, differentiationWarnings)
        }
        }  // End of if (afterFallbackErrors.length > 0) from v4.8.8
      }
    }
  }

  // Absolute safety: never allow question/prompt or empty target audience to reach user.
  try {
    const taRaw = (sections as any)?.target_audience
    const taValue = typeof taRaw === 'string' ? taRaw : (taRaw && typeof taRaw === 'object' ? String((taRaw as any).value || '') : '')
    if (isBadTargetAudienceValue(taValue)) {
      const fallback = buildFallbackTargetAudience(dataSources, analysis, language)
      sections = {
        ...(sections || {}),
        __fallback_target_audience: true,
        target_audience: {
          ...((sections as any)?.target_audience || {}),
          value: fallback.value,
          proof: fallback.proof
        }
      }
    }
  } catch {
    // ignore
  }

  // Absolute safety: never allow instructional placeholders in core_offerings.
  try {
    const coRaw = (sections as any)?.core_offerings
    const coValue = typeof coRaw === 'string' ? coRaw : (coRaw && typeof coRaw === 'object' ? String((coRaw as any).value || '') : '')
    if (isBadCoreOfferingsValue(coValue)) {
      const fallback = buildFallbackCoreOfferings(dataSources, analysis, language)
      sections = {
        ...(sections || {}),
        __fallback_core_offerings: true,
        core_offerings: {
          ...((sections as any)?.core_offerings || {}),
          value: fallback.value,
          proof: fallback.proof
        }
      }
    }
  } catch {
    // ignore
  }

  // Absolute safety: ensure content_focus isn't menu-only / too narrow.
  try {
    const cfRaw = (sections as any)?.content_focus
    const cfValue = typeof cfRaw === 'string' ? cfRaw : (cfRaw && typeof cfRaw === 'object' ? String((cfRaw as any).value || '') : '')
    if (isBadContentFocusValue(cfValue)) {
      const fallback = buildFallbackContentFocus(dataSources, analysis, language)
      sections = {
        ...(sections || {}),
        __fallback_content_focus: true,
        content_focus: {
          ...((sections as any)?.content_focus || {}),
          value: fallback.value,
          proof: fallback.proof
        }
      }
    }
  } catch {
    // ignore
  }

  // Absolute safety: ensure CTA Style is not booking-only.
  try {
    const ctaRaw = (sections as any)?.cta_style
    const ctaValue = typeof ctaRaw === 'string' ? ctaRaw : (ctaRaw && typeof ctaRaw === 'object' ? String((ctaRaw as any).value || '') : '')
    if (isBadCtaStyleValue(ctaValue)) {
      const fallback = buildFallbackCtaStyle(dataSources, analysis, language)
      sections = {
        ...(sections || {}),
        __fallback_cta_style: true,
        cta_style: {
          ...((sections as any)?.cta_style || {}),
          value: fallback.value,
          proof: fallback.proof
        }
      }
    }
  } catch {
    // ignore
  }
  
  return parseBrandProfileResponse(sections, analysis, dataSources)
}

/**
 * Parses Prompt B JSON response into BrandProfile structure.
 */
function parseBrandProfileResponse(sections: any, analysis: any, dataSources: DataSources): BrandProfile {
  const evidence = analysis.evidence || {}

  const pickValue = (field: string): string => {
    const v = sections?.[field]
    if (typeof v === 'string') return v
    if (v && typeof v === 'object' && typeof (v as any).value === 'string') return (v as any).value
    return 'N/A'
  }
  
  // v4.11.6: Extract proof arrays to preserve them in brandProfile (fixes 8 hard errors)
  // v4.11.7: Force rebuild for debug logging deployment
  const pickProof = (field: string): string[] => {
    const v = sections?.[field]
    if (v && typeof v === 'object' && Array.isArray((v as any).proof)) {
      return (v as any).proof
    }
    return []
  }
  
  // v4.11.8: Extract array values (e.g., content_pillars) - handles both direct arrays and {value: array} objects
  const pickArrayValue = (field: string): any[] => {
    const v = sections?.[field]
    console.log(`[DEBUG] pickArrayValue("${field}"):`, {
      exists: v !== undefined,
      type: typeof v,
      isArray: Array.isArray(v),
      hasValueProp: v && typeof v === 'object' && 'value' in v,
      valueIsArray: v && typeof v === 'object' && Array.isArray((v as any).value),
      raw: JSON.stringify(v).slice(0, 200)
    })
    if (Array.isArray(v)) return v
    if (v && typeof v === 'object' && Array.isArray((v as any).value)) return (v as any).value
    return []
  }
  
  // Compute confidence scores from evidence flags
  const computeConfidence = (varName: string, ev: any): { score: number; level: 'high' | 'inferred' | 'medium' | 'low' } => {
    let score = 0.0
    
    switch (varName) {
      case 'brand_essence':
        if (ev.has_mission_statement) score += 0.4
        if (ev.has_about_page) score += 0.2
        if (ev.has_explicit_positioning) score += 0.3
        if (ev.brand_keywords_found?.length >= 3) score += 0.1
        break
      case 'tone_of_voice':
        if (ev.has_consistent_language) score += 0.4
        if (ev.formality_level && ev.formality_level !== 'unknown') score += 0.2
        if (ev.example_phrases?.length >= 5) score += 0.2
        break
      case 'target_audience':
        if (ev.has_explicit_audience_statement) score += 0.4
        if (ev.has_kids_menu) score += 0.2
        if (ev.has_group_offerings) score += 0.2
        if (ev.price_level_known) score += 0.1
        break
      case 'core_offerings':
        if (ev.menu_items_count > 5) score += 0.3
        if (ev.has_specialties_mentioned) score += 0.2
        if (ev.website_additional_items_found?.length > 0) score += 0.2
        if (ev.categories_identified?.length > 0) score += 0.1
        break
      case 'content_focus':
        if (ev.has_website_themes) score += 0.5
        if (ev.recurring_topics?.length >= 3) score += 0.3
        break
      case 'image_preferences':
        if (ev.images_uploaded_count >= 3) score += 0.3
        if (ev.hero_images_count >= 1) score += 0.2
        if (ev.visual_patterns?.length >= 3) score += 0.2
        break
      case 'things_to_avoid':
        if (ev.has_explicit_constraints) score += 0.5
        if (ev.explicit_donts?.length >= 2) score += 0.3
        break
      case 'cta_style':
        if (ev.has_cta_examples) score += 0.3
        if (ev.action_verbs_found?.length >= 3) score += 0.2
        if (ev.booking_prompts_found) score += 0.2
        break
      case 'communication_goal':
        if (ev.has_explicit_goal) score += 0.5
        if (ev.inferred_from_business_type) score += 0.3
        break
      case 'social_style':
        // Usually inferred from tone/CTA patterns
        if (evidence.tone_of_voice?.has_consistent_language) score += 0.3
        if ((evidence.tone_of_voice?.example_phrases || []).length >= 3) score += 0.2
        if (evidence.cta_style?.has_cta_examples) score += 0.2
        break
      case 'voice_examples':
        // Derived from must-use phrases and tone signals
        if ((evidence.tone_of_voice?.example_phrases || []).length >= 3) score += 0.3
        if ((evidence.brand_essence?.brand_keywords_found || []).length >= 3) score += 0.2
        if (evidence.tone_of_voice?.has_consistent_language) score += 0.2
        break
    }
    
    score = Math.min(score, 1.0)
    const level = score >= 0.70 ? 'high' : score >= 0.50 ? 'inferred' : score >= 0.40 ? 'medium' : 'low'
    return { score, level }
  }

  const conf = {
    brand_essence: computeConfidence('brand_essence', evidence.brand_essence || {}),
    tone_of_voice: computeConfidence('tone_of_voice', evidence.tone_of_voice || {}),
    target_audience: computeConfidence('target_audience', evidence.target_audience || {}),
    core_offerings: computeConfidence('core_offerings', evidence.core_offerings || {}),
    content_focus: computeConfidence('content_focus', evidence.content_focus || {}),
    image_preferences: computeConfidence('image_preferences', evidence.image_preferences || {}),
    things_to_avoid: computeConfidence('things_to_avoid', evidence.things_to_avoid || {}),
    cta_style: computeConfidence('cta_style', evidence.cta_style || {}),
    communication_goal: computeConfidence('communication_goal', evidence.communication_goal || {}),
    social_style: computeConfidence('social_style', evidence.social_style || {}),
    voice_examples: computeConfidence('voice_examples', evidence.voice_examples || {}),
    recognizable_interior_identity: computeConfidence('recognizable_interior_identity', evidence.recognizable_interior_identity || {})
  }

  const targetAudienceIsFallback = Boolean((sections as any)?.__fallback_target_audience)
  const targetAudienceValue = pickValue('target_audience')
  const targetAudienceConfidence = targetAudienceIsFallback
    ? { score: 0.25, level: 'low' as const }
    : conf.target_audience
  const targetAudienceSignals = targetAudienceIsFallback
    ? ['inferred_from_business_type', 'menu', 'location']
    : (evidence.target_audience?.sources || [])

  const coreOfferingsIsFallback = Boolean((sections as any)?.__fallback_core_offerings)
  const coreOfferingsValue = pickValue('core_offerings')
  const coreOfferingsConfidence = coreOfferingsIsFallback
    ? { score: 0.30, level: 'low' as const }
    : conf.core_offerings
  const coreOfferingsSignals = coreOfferingsIsFallback
    ? ['menu', 'website', 'inferred_from_business_type']
    : (evidence.core_offerings?.sources || [])

  const contentFocusIsFallback = Boolean((sections as any)?.__fallback_content_focus)
  const contentFocusValue = pickValue('content_focus')
  const contentFocusConfidence = contentFocusIsFallback
    ? { score: 0.35, level: 'low' as const }
    : conf.content_focus
  const contentFocusSignals = contentFocusIsFallback
    ? ['menu', 'images', 'physical_space', 'inferred_from_business_type']
    : (evidence.content_focus?.sources || [])

  const ctaStyleIsFallback = Boolean((sections as any)?.__fallback_cta_style)
  const ctaStyleValue = pickValue('cta_style')
  const ctaStyleConfidence = ctaStyleIsFallback
    ? { score: 0.35, level: 'low' as const }
    : conf.cta_style
  const ctaStyleSignals = ctaStyleIsFallback
    ? ['website_cta', 'inferred_from_business_type']
    : (evidence.cta_style?.sources || [])

  return {
    brand_essence: {
      value: pickValue('brand_essence'),
      proof: pickProof('brand_essence'),
      confidence_score: conf.brand_essence.score,
      confidence_level: conf.brand_essence.level,
      signals_used: evidence.brand_essence?.sources || []
    },
    tone_of_voice: {
      value: pickValue('tone_of_voice'),
      proof: pickProof('tone_of_voice'),
      confidence_score: conf.tone_of_voice.score,
      confidence_level: conf.tone_of_voice.level,
      signals_used: evidence.tone_of_voice?.sources || []
    },
    // tone_model - raw from AI (sanitized before save)
    tone_model: sections.tone_model ?? null,
    things_to_avoid: {
      value: (() => {
        const v: any = sections.things_to_avoid
        if (!v || typeof v !== 'object') return { language_constraints: [], factual_constraints: [] }
        const language_constraints = Array.isArray(v.language_constraints)
          ? v.language_constraints
          : Array.isArray(v.hard_constraints)
            ? v.hard_constraints
            : []
        const factual_constraints = Array.isArray(v.factual_constraints)
          ? v.factual_constraints
          : Array.isArray(v.soft_suggestions)
            ? v.soft_suggestions
            : []
        return { language_constraints, factual_constraints }
      })(),
      proof: pickProof('things_to_avoid'),
      confidence_score: conf.things_to_avoid.score,
      confidence_level: conf.things_to_avoid.level,
      signals_used: evidence.things_to_avoid?.sources || []
    },
    target_audience: {
      value: targetAudienceValue,
      proof: targetAudienceIsFallback ? ['Inferred from business type and menu'] : pickProof('target_audience'),
      confidence_score: targetAudienceConfidence.score,
      confidence_level: targetAudienceConfidence.level,
      signals_used: targetAudienceSignals
    },
    core_offerings: {
      value: coreOfferingsValue,
      proof: coreOfferingsIsFallback ? ['Menu items', 'Business type'] : pickProof('core_offerings'),
      confidence_score: coreOfferingsConfidence.score,
      confidence_level: coreOfferingsConfidence.level,
      signals_used: coreOfferingsSignals
    },
    content_focus: {
      value: contentFocusValue,
      proof: contentFocusIsFallback ? ['Menu', 'Physical space', 'Business type'] : pickProof('content_focus'),
      confidence_score: contentFocusConfidence.score,
      confidence_level: contentFocusConfidence.level,
      signals_used: contentFocusSignals
    },
    content_pillars: {
      value: pickArrayValue('content_pillars'),
      proof: pickProof('content_pillars'),
      confidence_score: conf.content_focus.score,
      confidence_level: conf.content_focus.level,
      signals_used: evidence.content_focus?.sources || []
    },
    cta_style: {
      value: ctaStyleValue,
      proof: ctaStyleIsFallback ? ['Website CTA', 'Business type'] : pickProof('cta_style'),
      confidence_score: ctaStyleConfidence.score,
      confidence_level: ctaStyleConfidence.level,
      signals_used: ctaStyleSignals
    },
    communication_goal: {
      value: pickValue('communication_goal'),
      proof: pickProof('communication_goal'),
      confidence_score: conf.communication_goal.score,
      confidence_level: conf.communication_goal.level,
      signals_used: evidence.communication_goal?.sources || []
    },
    image_preferences: {
      value: sections.image_preferences?.dos && sections.image_preferences?.donts
        ? { dos: sections.image_preferences.dos, donts: sections.image_preferences.donts, signature_shot: sections.image_preferences.signature_shot || '' }
        : { dos: [], donts: [], signature_shot: '' },
      proof: pickProof('image_preferences'),
      confidence_score: conf.image_preferences.score,
      confidence_level: conf.image_preferences.level,
      signals_used: evidence.image_preferences?.sources || []
    },
    social_style: {
      value: sections.social_style?.emoji_usage && sections.social_style?.emoji_examples && sections.social_style?.hashtag_strategy
        ? {
          emoji_usage: sections.social_style.emoji_usage,
          emoji_examples: sections.social_style.emoji_examples,
          hashtag_strategy: {
            branded: sections.social_style.hashtag_strategy?.branded || [],
            category: sections.social_style.hashtag_strategy?.category || [],
            local: sections.social_style.hashtag_strategy?.local || []
          }
        }
        : { emoji_usage: 'minimal', emoji_examples: [], hashtag_strategy: { branded: [], category: [], local: [] } },
      proof: pickProof('social_style'),
      confidence_score: conf.social_style.score,
      confidence_level: conf.social_style.level,
      signals_used: evidence.social_style?.sources || []
    },
    voice_examples: {
      value: sections.voice_examples?.do_say && sections.voice_examples?.dont_say && sections.voice_examples?.vocabulary
        ? {
          do_say: sections.voice_examples.do_say,
          dont_say: sections.voice_examples.dont_say,
          vocabulary: {
            prefer: sections.voice_examples.vocabulary?.prefer || [],
            avoid: sections.voice_examples.vocabulary?.avoid || []
          }
        }
        : { do_say: [], dont_say: [], vocabulary: { prefer: [], avoid: [] } },
      proof: pickProof('voice_examples'),
      confidence_score: conf.voice_examples.score,
      confidence_level: conf.voice_examples.level,
      signals_used: evidence.voice_examples?.sources || []
    },
    recognizable_interior_identity: {
      value: typeof sections.recognizable_interior_identity === 'string' ? sections.recognizable_interior_identity : '',
      proof: pickProof('recognizable_interior_identity'),
      confidence_score: conf.recognizable_interior_identity?.score || 0.5,
      confidence_level: conf.recognizable_interior_identity?.level || 'medium' as const,
      signals_used: evidence.recognizable_interior_identity?.sources || []
    }
  }
}

// ============================================================================
// GENERATION LOCK HELPERS
// ============================================================================

/**
 * Acquire a generation lock for a business.
 * Returns success=false if lock already exists and is < 10 minutes old.
 */
async function acquireGenerationLock(
  supabase: any,
  businessId: string,
  requestId: string
): Promise<{
  success: boolean
  reason?: string
  existingRequestId?: string
  lockAgeMinutes?: number
}> {
  try {
    // Check for existing lock
    const { data: existingLock } = await supabase
      .from('brand_profile_generation_locks')
      .select('request_id, started_at')
      .eq('business_id', businessId)
      .single()
    
    if (existingLock) {
      const startedAt = new Date(existingLock.started_at)
      const ageMinutes = (Date.now() - startedAt.getTime()) / 1000 / 60
      
      // If lock is older than 10 minutes, consider it stale and remove it
      if (ageMinutes > 10) {
        console.log(`[${requestId}] ⚠️ Found stale lock (${ageMinutes.toFixed(1)} min old), removing...`)
        await supabase
          .from('brand_profile_generation_locks')
          .delete()
          .eq('business_id', businessId)
        
        // Continue to acquire new lock below
      } else {
        return {
          success: false,
          reason: 'Generation already in progress',
          existingRequestId: existingLock.request_id,
          lockAgeMinutes: ageMinutes
        }
      }
    }
    
    // Attempt to insert lock (will fail if race condition occurs)
    const { error } = await supabase
      .from('brand_profile_generation_locks')
      .insert({
        business_id: businessId,
        request_id: requestId,
        started_at: new Date().toISOString()
      })
    
    if (error) {
      // Likely a race condition - another request acquired the lock first
      console.error(`[${requestId}] ❌ Failed to acquire lock:`, error.message)
      return {
        success: false,
        reason: 'Lock acquired by concurrent request',
        existingRequestId: 'unknown'
      }
    }
    
    return { success: true }
  } catch (error) {
    console.error(`[${requestId}] ❌ Error acquiring lock:`, error)
    return {
      success: false,
      reason: 'Failed to acquire lock due to database error'
    }
  }
}

/**
 * Release a generation lock for a business.
 */
async function releaseGenerationLock(
  supabase: any,
  businessId: string,
  requestId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('brand_profile_generation_locks')
      .delete()
      .eq('business_id', businessId)
      .eq('request_id', requestId)
    
    if (error) {
      console.error(`[${requestId}] ⚠️ Failed to release lock:`, error.message)
    } else {
      console.log(`[${requestId}] ✅ Generation lock released`)
    }
  } catch (error) {
    console.error(`[${requestId}] ❌ Error releasing lock:`, error)
  }
}

// ============================================================================
// STARTUP TESTS (v4.7.3)
// ============================================================================

// Run tone model sanitizer tests on function startup
console.log('🧪 Running tone model sanitizer tests...')
try {
  runToneModelSanitizerTests()
  console.log('✅ All tone model sanitizer tests passed')
} catch (error) {
  console.error('❌ Tone model sanitizer tests failed:', error)
  // Continue anyway - tests are informational
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const requestId = generateRequestId()
  const requestStartTime = Date.now()
  
  try {
    const { 
      businessId, 
      forceRegenerate = false, 
      allowThirdParty = false, 
      ignoreConfidenceCheck = false,  // DEPRECATED: use ignoreDifferentiationGate
      ignoreDifferentiationGate = false  // NEW: only ignores "not enough hooks" warnings
    } = await req.json()

    if (!businessId) {
      return new Response(
        JSON.stringify({ error: 'businessId is required', requestId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log(`[${requestId}] 🎯 Starting brand profile generation for business:`, businessId)
    console.log(`[${requestId}] 🔧 v4.11.8: Added normalizeContentPillars() helper to prevent crashes`)
    
    // Step 0: Acquire generation lock (single-flight guarantee)
    console.log(`[${requestId}] 🔒 Attempting to acquire generation lock...`)
    const lockAcquired = await acquireGenerationLock(supabaseClient, businessId, requestId)
    
    if (!lockAcquired.success) {
      const lockAge = lockAcquired.lockAgeMinutes || 0
      console.log(`[${requestId}] ⚠️ Lock acquisition failed: ${lockAcquired.reason}`)
      
      return new Response(
        JSON.stringify({
          error: 'Generation already in progress',
          reason: lockAcquired.reason,
          requestId,
          existingRequestId: lockAcquired.existingRequestId,
          lockAgeMinutes: lockAge,
          details: lockAge > 5 
            ? 'Generation has been running for over 5 minutes. It may be stuck. Contact support if this persists.'
            : 'Another generation request is currently processing. Please wait.'
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log(`[${requestId}] ✅ Generation lock acquired`)
    
    // Initialize error collector
    requestErrors = new ErrorCollector(businessId, requestId)
    // Make it available globally for deterministic repairs
    ;(globalThis as any).requestErrors = requestErrors

    // Verify API key
    if (!Deno.env.get('OPENAI_API_KEY')) {
      requestErrors.add(
        ErrorCategory.SYSTEM_CONFIG,
        ErrorSeverity.CRITICAL,
        'OPENAI_API_KEY is not configured',
        'data_gathering'
      )
      throw new Error('OPENAI_API_KEY is not configured')
    }

    // Check if profile already exists (unless force regenerate)
    if (!forceRegenerate) {
      const { data: existing } = await supabaseClient
        .from('business_brand_profile')
        .select('brand_essence, tone_of_voice')
        .eq('business_id', businessId)
        .single()

      if (existing?.brand_essence || existing?.tone_of_voice) {
        console.log(`[${requestId}] ⚠️ Brand profile already exists, skipping`)
        
        // Release lock before returning
        await releaseGenerationLock(supabaseClient, businessId, requestId)
        
        return new Response(
          JSON.stringify({ message: 'Brand profile already exists', existing: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Step 1: Gather data sources
    console.log(`[${requestId}] 📊 Gathering data sources...`)
    const dataSources = await gatherDataSources(supabaseClient, businessId, allowThirdParty)

    // Step 1.5: Compute source hashes and check if regeneration needed
    console.log(`[${requestId}] 🔐 Computing content hashes...`)
    const sourceHashes = await computeSourceHashes(dataSources)
    const versionHash = await computeVersionHash(sourceHashes)
    
    // Skip version hash check if force regenerate
    console.log(`[${requestId}] 🔍 Checking if regeneration needed...`)
    const regenerationCheck = forceRegenerate 
      ? { shouldRegenerate: true, reason: 'Force regenerate flag set', changedSources: [] }
      : await shouldRegenerateProfile(
          supabaseClient,
          businessId,
          sourceHashes,
          versionHash
        )
    
    if (!regenerationCheck.shouldRegenerate) {
      console.log(`[${requestId}] ✅ Brand Profile unchanged (version_hash match), skipping regeneration`)
      console.log(`[${requestId}] 📊 Version hash: ${versionHash}`)
      
      // Return existing profile
      const { data: existingProfile, error: fetchError } = await supabaseClient
        .from('business_brand_profile')
        .select('*')
        .eq('business_id', businessId)
        .single()
      
      if (existingProfile) {
        const totalDuration = Date.now() - requestStartTime
        
        // Release lock before returning cached result
        await releaseGenerationLock(supabaseClient, businessId, requestId)
        
        return new Response(
          JSON.stringify({
            success: true,
            requestId,
            durationMs: totalDuration,
            regenerated: false,
            reason: regenerationCheck.reason,
            versionHash,
            qualityStatus: existingProfile.quality_status || 'green',
            locale: {
              code: existingProfile.locale_code || 'da-DK',
              language: existingProfile.primary_language || 'da'
            },
            brandProfile: {
              brand_essence: existingProfile.brand_essence,
              tone_of_voice: existingProfile.tone_of_voice,
              content_focus: existingProfile.content_focus,
              target_audience: existingProfile.target_audience,
              content_pillars: existingProfile.content_pillars_jsonb || existingProfile.content_pillars,
              social_style: existingProfile.social_style_jsonb || existingProfile.social_style,
              things_to_avoid: existingProfile.things_to_avoid_jsonb || existingProfile.things_to_avoid,
              voice_examples: existingProfile.voice_examples_jsonb || existingProfile.voice_examples,
              voice_context: existingProfile.voice_context_jsonb || existingProfile.voice_context,
              image_preferences: existingProfile.image_preferences_jsonb || existingProfile.image_preferences
            }
          }),
          { status: 200, headers: corsHeaders }
        )
      }
      
      // No existing profile found despite hash match - fall through to regeneration
      console.log(`[${requestId}] ⚠️ Hash match but no existing profile found, regenerating anyway`)
    } else {
      console.log(`[${requestId}] 🔄 Regeneration needed: ${regenerationCheck.reason}`)
      if (regenerationCheck.changedSources.length > 0) {
        console.log(`[${requestId}] 📝 Changed sources:`, regenerationCheck.changedSources)
      }
    }

    // Detect language
    const language = detectLanguageFromData(dataSources)
    
    // Resolve locale (city-level granularity)
    // Extract city from location (either direct field or enrichment data)
    const cityName = dataSources.location?.city || dataSources.location?.enrichment?.macro?.city
    const countryCode = dataSources.location?.country || dataSources.business?.country
    
    const locale = resolveLocale(
      countryCode,
      cityName,
      language.code
    )
    console.log(`[${requestId}] 🌍 Locale resolved:`, {
      code: locale.code,
      name: locale.name,
      city: locale.city,
      language: locale.language,
      fallback: locale.fallbackLocale,
      detectedCity: cityName,
      detectedCountry: countryCode,
      rawCountry: dataSources.location?.country,
      normalized: countryCode !== dataSources.location?.country
    })
    
    // Validate data quality
    if (!dataSources.business) {
      requestErrors.add(
        ErrorCategory.DATA_MISSING,
        ErrorSeverity.CRITICAL,
        'Business data not found',
        'data_gathering',
        { businessId }
      )
      throw new Error('Business data not found')
    }
    
    if (!dataSources.menu || dataSources.menu.length === 0) {
      requestErrors.add(
        ErrorCategory.DATA_INSUFFICIENT,
        ErrorSeverity.HIGH,
        'No menu data available',
        'data_gathering',
        { businessId }
      )
    }
    console.log(`[${requestId}] 🌍 Detected language: ${language.name}`)

    // Step 2: Run Prompt A
    console.log(`[${requestId}] 🔍 Running internal analysis...`)
    let analysis = await runInternalAnalysis(dataSources, language, allowThirdParty, requestId)

    // Step 2.5: Ensure must_use_phrases
    analysis = ensureMustUsePhrasesFallback(analysis, dataSources)

    // Step 2.55: Enforce distinctive_hooks minimum (>=2) or mark risk
    analysis = ensureDistinctiveHooksMinimum(analysis)

    // Log generic anchor risk (helps detect Prompt B genericness)
    if (analysis?.evidence?.generic_anchor_risk) {
      console.log(`[${requestId}] ⚠️ generic_anchor_risk=true (must_use_phrases are generic)`)
    }

    // Step 2.6: Enforce Distinctive Hooks contract (with one repair attempt)
    // Skip validation if ignoreDifferentiationGate is set
    const shouldSkipContractValidation = ignoreDifferentiationGate || ignoreConfidenceCheck
    if (!shouldSkipContractValidation) {
      let hookErrors = validateDistinctiveHooksContract(analysis, dataSources)
      if (hookErrors.length > 0) {
        console.log(`[${requestId}] ⚠️ Prompt A missing Distinctive Hooks contract; attempting repair`, hookErrors)

        const extra = [
          'Your previous JSON failed the Distinctive Hooks contract.',
          'Fix ONLY by ensuring these top-level arrays exist: distinctive_hooks, physical_space_cues, rituals_and_moments, local_identity_cues, copy_patterns.',
          'Each item MUST be an object with the required keys (hook/cue/moment/pattern + evidence + source + confidence).',
          'Evidence MUST be an exact snippet from the provided input data (do not paraphrase; do not invent).',
          'If you cannot find evidence for a category, return an empty array [].',
          `Validation errors: ${hookErrors.slice(0, 12).join(' | ')}`
        ].join('\n')

        analysis = await runInternalAnalysis(dataSources, language, allowThirdParty, requestId, extra)
        analysis = ensureMustUsePhrasesFallback(analysis, dataSources)
        hookErrors = validateDistinctiveHooksContract(analysis, dataSources)

        if (hookErrors.length > 0) {
          throw new Error(`Prompt A Distinctive Hooks contract failed after repair: ${hookErrors.slice(0, 12).join(' | ')}`)
        }
      }
    } else {
      console.log(`[${requestId}] ⚠️ Skipping Distinctive Hooks contract validation (ignoreDifferentiationGate=true)`)
    }

    // Step 2.7: Operational confidence gate
    // If we do not have at least 2 evidence-backed distinctive hooks, we should not
    // generate (or save) a brand profile. Instead we return guidance for the user.
    // UNLESS ignoreDifferentiationGate is explicitly set to true
    const differentiation = computeDifferentiationConfidence(analysis)
    const shouldSkipDifferentiationGate = ignoreDifferentiationGate || ignoreConfidenceCheck  // backwards compat
    if (!shouldSkipDifferentiationGate && (Boolean(analysis?.evidence?.distinctive_hooks_missing) || differentiation.hooksCount < 2)) {
      const totalDuration = Date.now() - requestStartTime
      console.log(`[${requestId}] ⚠️ Skipping Prompt B (insufficient differentiators). Complete in ${totalDuration}ms`)
      
      // Release lock before returning
      await releaseGenerationLock(supabaseClient, businessId, requestId)

      return new Response(
        JSON.stringify({
          success: true,
          skippedGeneration: true,
          reason: 'distinctive_hooks_missing',
          requestId,
          durationMs: totalDuration,
          analysisEvidence: {
            generic_anchor_risk: Boolean(analysis?.evidence?.generic_anchor_risk),
            distinctive_hooks_count: differentiation.hooksCount,
            distinctive_hooks_missing: true,
            differentiation_confidence_score: differentiation.score,
            differentiation_confidence_level: differentiation.level,
            ui_prompt_da:
              'Tilføj 1–2 ting der gør jer unikke (fx kunst på væggen, ikon ved indgangen, udsigt, bar/cocktails, events). Så bliver jeres Brand Profil markant mere præcis.'
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 3: Run Prompt B
    console.log(`[${requestId}] ✨ Generating brand profile...`)
    const shouldSkipDifferentiationGateCompat = ignoreDifferentiationGate || ignoreConfidenceCheck
    let brandProfile = await generateBrandProfile(dataSources, analysis, language, locale, requestId, shouldSkipDifferentiationGateCompat)

    // Step 3.5: Final validation
    const finalValidation = validateFinalBrandProfile(brandProfile)
    if (!finalValidation.valid) {
      brandProfile = finalValidation.cleaned
    }

    // Step 4: Compute quality status and save to database
    const qualityStatus = requestErrors.getQualityStatus()
    const errorSummary = requestErrors.getSummary()
    
    // Step 4.5: Sanitize tone_model before save (v4.7.3 - Critical DB safety fix)
    // Ensures tone_model is either null or fully normalized to pass DB constraint
    console.log(`[${requestId}] 🧹 Sanitizing tone_model for DB...`)
    const rawToneModel = brandProfile.tone_model
    const sanitizedToneModel = sanitizeToneModelForDb(rawToneModel, language.code)
    brandProfile.tone_model = sanitizedToneModel as any  // ToneModelV2 | null - type widening needed
    
    console.log(`[${requestId}] 💾 Saving brand profile...`)
    console.log(`[${requestId}] 📊 Quality Status: ${qualityStatus} (${errorSummary})`)
    console.log(`[${requestId}] 🔐 Version Hash: ${versionHash}`)
    console.log(`[${requestId}] 🔍 tone_model about to save:`, JSON.stringify(brandProfile.tone_model, null, 2))
    
    try {
      await saveBrandProfile(
        supabaseClient,
        businessId,
        brandProfile,
        qualityStatus,
        requestErrors.toJSON().errors,  // Extract errors array from toJSON() result
        versionHash  // Add version hash
      )
    } catch (saveError: any) {
      // Detect DB constraint violations for tone_model
      const errorMsg = String(saveError?.message || '')
      const isToneModelConstraint = errorMsg.includes('tone_model_valid_structure_v2')
      
      if (isToneModelConstraint) {
        console.error(`[${requestId}] ❌ DB rejected tone_model structure:`, errorMsg)
        console.error(`[${requestId}] 🔍 Attempted tone_model:`, JSON.stringify(brandProfile.tone_model, null, 2))
        
        // Retry with tone_model as null
        console.log(`[${requestId}] 🔄 Retrying save with tone_model=null...`)
        brandProfile.tone_model = null as any  // Type widening needed for retry
        
        await saveBrandProfile(
          supabaseClient,
          businessId,
          brandProfile,
          qualityStatus,
          requestErrors.toJSON().errors,
          versionHash
        )
        
        // Add error to collection
        requestErrors.add(
          ErrorCategory.VALIDATION_STRUCTURAL,
          ErrorSeverity.HIGH,
          'tone_model failed DB constraint; saved as null',
          'persistence',
          { originalError: errorMsg }
        )
      } else {
        // Re-throw other save errors
        throw saveError
      }
    }
    
    // Save source hashes for future change detection
    console.log(`[${requestId}] 💾 Saving source hashes...`)
    await saveSourceHashes(
      supabaseClient,
      businessId,
      sourceHashes,
      versionHash
    )

    const totalDuration = Date.now() - requestStartTime
    console.log(`[${requestId}] ✅ Complete in ${totalDuration}ms`)
    
    // Release generation lock
    console.log(`[${requestId}] 🔓 Releasing generation lock...`)
    await releaseGenerationLock(supabaseClient, businessId, requestId)

    // v4.10.0 Phase 1: Build response envelope with quality metrics
    const finalValidationErrors = validateBrandProfileOutput(brandProfile, analysis, dataSources)
    const { hardErrors: finalHardErrors, softErrors: finalSoftErrors } = categorizeErrors(finalValidationErrors)
    const repairCount = requestErrors.toJSON().errors.filter((e: any) => 
      e.message.includes('repair') || e.message.includes('fallback')
    ).length
    
    const responseEnvelope = {
      ok: finalHardErrors.length === 0,
      qualityStatus: qualityStatus as 'perfect' | 'acceptable' | 'failed',
      repairCount,
      hardErrors: finalHardErrors,
      softErrors: finalSoftErrors,
      warnings: requestErrors.toJSON().errors.filter((e: any) => e.severity === 'low' || e.severity === 'medium').map((e: any) => e.message),
      profile: finalHardErrors.length === 0 ? brandProfile : null
    }
    
    console.log(`[${requestId}] 📊 Response Envelope: ok=${responseEnvelope.ok}, quality=${responseEnvelope.qualityStatus}, repairs=${responseEnvelope.repairCount}, hardErrors=${responseEnvelope.hardErrors.length}, softErrors=${responseEnvelope.softErrors.length}`)
    
    // v4.11.7: Debug remaining hard errors
    if (finalHardErrors.length > 0) {
      console.log(`[${requestId}] 🔴 Hard errors in final brandProfile validation:`)
      finalHardErrors.forEach((err, idx) => {
        console.log(`[${requestId}]    ${idx + 1}. ${err}`)
      })
    }

    // (We already gated above; here it's only used for response metadata)

    return new Response(
      JSON.stringify({
        success: responseEnvelope.ok,
        requestId,
        durationMs: totalDuration,
        regenerated: true,
        versionHash,
        qualityStatus: responseEnvelope.qualityStatus,
        repairCount: responseEnvelope.repairCount,
        hardErrors: responseEnvelope.hardErrors,
        softErrors: responseEnvelope.softErrors,
        warnings: responseEnvelope.warnings,
        locale: {
          code: locale.code,
          name: locale.name,
          language: locale.language,
          city: locale.city
        },
        errors: requestErrors.toJSON(),
        analysisEvidence: {
          generic_anchor_risk: Boolean(analysis?.evidence?.generic_anchor_risk),
          distinctive_hooks_count: differentiation.hooksCount,
          distinctive_hooks_missing: Boolean(analysis?.evidence?.distinctive_hooks_missing) || differentiation.hooksCount < 2,
          differentiation_confidence_score: differentiation.score,
          differentiation_confidence_level: differentiation.level,
          ui_prompt_da:
            (Boolean(analysis?.evidence?.distinctive_hooks_missing) || differentiation.hooksCount < 2)
              ? 'Tilføj 1–2 ting der gør jer unikke (fx kunst på væggen, ikon ved indgangen, udsigt, bar/cocktails, events). Så bliver jeres Brand Profil markant mere præcis.'
              : null
        },
        brandProfile: {
          brand_essence: brandProfile.brand_essence.value,
          tone_of_voice: brandProfile.tone_of_voice.value,
          things_to_avoid: brandProfile.things_to_avoid.value,
          target_audience: brandProfile.target_audience.value,
          core_offerings: brandProfile.core_offerings.value,
          content_focus: brandProfile.content_focus.value,
          content_pillars: brandProfile.content_pillars.value,
          cta_style: brandProfile.cta_style.value,
          communication_goal: brandProfile.communication_goal.value,
          image_preferences: brandProfile.image_preferences.value,
          social_style: brandProfile.social_style.value,
          voice_examples: brandProfile.voice_examples.value,
        },
        confidence: {
          brand_essence: brandProfile.brand_essence.confidence_level,
          tone_of_voice: brandProfile.tone_of_voice.confidence_level,
          things_to_avoid: brandProfile.things_to_avoid.confidence_level,
          target_audience: brandProfile.target_audience.confidence_level,
          core_offerings: brandProfile.core_offerings.confidence_level,
          content_focus: brandProfile.content_focus.confidence_level,
          content_pillars: brandProfile.content_pillars.confidence_level,
          cta_style: brandProfile.cta_style.confidence_level,
          communication_goal: brandProfile.communication_goal.confidence_level,
          image_preferences: brandProfile.image_preferences.confidence_level,
          social_style: brandProfile.social_style.confidence_level,
          voice_examples: brandProfile.voice_examples.confidence_level,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const err = error as Error
    const totalDuration = Date.now() - requestStartTime
    console.error(`[${requestId}] ❌ Error after ${totalDuration}ms:`, err.message)
    console.error(`[${requestId}] 📚 Error stack:`, err.stack)
    
    // Release lock on error
    const { businessId } = await req.json().catch(() => ({ businessId: null }))
    if (businessId) {
      await releaseGenerationLock(
        createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        ),
        businessId,
        requestId
      )
    }

    const msg = String(err?.message || '')
    
    // v4.9.0 Phase 1 Task F: Validation errors should never cause 422/500
    // Log them but continue - profile should always save
    const isValidationError = msg.startsWith('Repair failed validation:') || 
                              msg.includes('failed validation') ||
                              msg.includes('Structural validation') ||
                              msg.includes('Differentiation warnings')
    
    if (isValidationError) {
      console.warn(`[${requestId}] ⚠️ Non-fatal validation error (continuing):`, msg)
      // Continue to return 500 for actual critical errors below
    }
    
    // Handle OpenAI rate limiting (429) - return proper HTTP 429, not 500
    if (err instanceof OpenAIHttpError && err.status === 429) {
      console.error(`[${requestId}] 🔴 OpenAI rate limit exceeded (429)`)
      const retryAfterSeconds = err.retryAfterMs ? Math.ceil(err.retryAfterMs / 1000) : 5
      
      const responseHeaders = {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfterSeconds)
      }
      
      return new Response(
        JSON.stringify({
          error: 'Rate limited by OpenAI',
          requestId,
          durationMs: totalDuration,
          retryAfterMs: err.retryAfterMs || 5000,
          details: 'OpenAI API rate limit exceeded. Please retry after the specified delay.'
        }),
        { status: 429, headers: responseHeaders }
      )
    }
    
    // Detect tone_model DB constraint violations (v4.7.3)
    const isToneModelConstraint = msg.includes('tone_model_valid_structure_v2')
    if (isToneModelConstraint) {
      console.error(`[${requestId}] 🔴 DB constraint violation: tone_model structure invalid`)
      return new Response(
        JSON.stringify({
          error: 'Database rejected tone_model structure',
          requestId,
          durationMs: totalDuration,
          details: 'tone_model failed validation; sanitizer could not normalize it. Profile saved with tone_model=null.'
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate brand profile',
        requestId,
        durationMs: totalDuration,
        details: err.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
