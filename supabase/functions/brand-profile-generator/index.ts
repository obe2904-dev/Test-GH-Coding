/**
 * Brand Profile Generator - Edge Function
 *
 * Generates AI-powered brand profiles for businesses using two AI prompts:
 * - Prompt A (gpt-4o-mini, 45s budget): internal analysis + evidence extraction
 * - Prompt B (gpt-4o, 50s budget): user-facing brand profile generation
 *
 * @version 4.13.0
 * @see CHANGELOG.md for full version history
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
  type ClassifyBusinessPromptParams,
  type SegmentAudiencePromptParams,
  
  // Languages
  detectLanguageFromData,
  LANGUAGES,
  
  // Error Management
  ErrorCollector,
  ErrorCategory,
  ErrorSeverity,
  
  // Locale System
  resolveLocale,
  getTranslation,
  
  // Fallback System
  buildContentStrategyFallback,
  sanitizeBannedWords,
  
  // OpenAI
  fetchOpenAIWithRetry,
  parseOpenAIJson,
  OpenAIHttpError,
  
  // Data gathering
  gatherDataSources,
  
  // Signal extraction
  ensureMustUsePhrasesFallback,
  
  // Prompts
  buildPromptA,
  buildPromptB,
  buildSystemPromptB,
  buildClassifyBusinessSystemPrompt,
  buildClassifyBusinessUserPrompt,
  buildSegmentAudienceSystemPrompt,
  buildSegmentAudienceUserPrompt,

  // Validators
  validateBrandProfileOutput,
  validateFinalBrandProfile,
  categorizeErrors,

  // Database
  saveBrandProfile,

  // Location intelligence (deterministic)
  buildLocationIntelligence
} from '../_shared/brand-profile/index.ts'
import type { SecondarySignals } from '../_shared/brand-profile/index.ts'
import { filterAudienceLabels } from '../_shared/utils/audience-filter.ts'

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

// Business archetype inference
import { 
  inferBusinessArchetype, 
  getArchetypeDescription 
} from '../_shared/brand-profile/archetype-inference.ts'

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
  buildFallbackBrandEssence,
  buildBusinessCharacterFallback,
  buildVoiceRationaleFallback
} from '../_shared/brand-profile/repair/fallback-builders.ts'

import {
  applyDeterministicRepairs,
  buildContentPillarsFallback
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
  analysis: 'gpt-4o-mini', // Prompt A internal analysis — mini is fast enough (25-40s); gpt-4o was timing out at 35s cut
  generation: 'gpt-4o',   // User-facing brand content — keep full quality
  fixer: 'gpt-4o-mini'    // JSON repair at temp 0.0 — trivially within mini capability
}

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
 * Runs Prompt A - Internal Analysis.
 * Extracts signals and evidence from data sources.
 */
async function runInternalAnalysis(
  dataSources: DataSources,
  language: LanguageConfig,
  allowThirdParty: boolean,
  requestId: string,
  extraUserInstruction: string = ''
): Promise<any> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')!

  console.log(`[${requestId}] 🔍 Running Prompt A...`)
  const prompt =
    await buildPromptA(dataSources, language, allowThirdParty) +
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
      'Prompt A (Internal Analysis) - JSON fixer',
      // ✅ FIX: Cap to 1 retry × 25s — fixer must be fast or skipped
      { timeout: 25000, maxRetries: 1, retryDelayMs: 500, retryStatusCodes: [429, 500, 502, 503, 504] }
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
      max_tokens: 1800,  // Capped at 1800: gpt-4o-mini @70tok/s = ~26s, safe for large-data businesses. 3000 was timing out (>55s) on businesses with large websites/menus.
      response_format: { type: 'json_object' },
    },
    requestId,
    'Prompt A (Internal Analysis)',
    { timeout: 30000, maxRetries: 0, retryDelayMs: 0, retryStatusCodes: [] } // Budget: A(30)+B(50)+Voice(46)=126s << 150s wall-clock. No retry: a second 30s attempt would kill the budget.
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
  const { prompt, anchorCount: voiceAnchorCount, isPathB: voiceIsPathB } = buildPromptB(dataSources, analysis, language, locale)
  const apiKey = Deno.env.get('OPENAI_API_KEY')!

  const fixInvalidJsonToSections = async (raw: string, reason: string): Promise<any> => {
    const fixer = await fetchOpenAIWithRetry(
      apiKey,
      {
        model: AI_MODELS.analysis, // gpt-4o-mini for JSON repair (fast, cheap)
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
  
  // Build system message (now async due to language file loading)
  const systemMessage = await buildSystemPromptB(language)
  
  const data = await fetchOpenAIWithRetry(
    apiKey,
    {
      model: AI_MODELS.generation,
      messages: [
        { role: 'system', content: systemMessage },
        {
          role: 'user',
          content: `${prompt}\n\n---\nJSON SAFETY (MANDATORY):\n- In JSON string fields, avoid raw double quotes (") inside values. If you need to reference a phrase, write it without surrounding double quotes.\n- Never add trailing text after the closing brace.`
        }
      ],
      temperature: 0.25,
      max_tokens: 2500,  // Capped at 2500: gpt-4o @70tok/s = ~35s, well under 50s timeout. 3500 was hitting the timeout on full-text responses.
      response_format: { type: 'json_object' }
    },
    requestId,
    'Prompt B (Brand Profile Generation)',
    { timeout: 50000, maxRetries: 1, retryDelayMs: 500, retryStatusCodes: [429, 500, 502, 503, 504] } // 50s×1=max; gpt-4o @2500tok typically 30-35s
  )

  const content = data.choices[0]?.message?.content

  if (!content) {
    throw new Error('No response from AI')
  }

  // Parse and validate
  // v4.12.4: Removed JSON-fixer + JSON-retry chain (3 extra untimed AI calls = 30-130s extra → wall-clock kill).
  // gpt-4o with response_format:json_object very rarely produces invalid JSON. If it does, use {} and let
  // the deterministic fallbacks downstream populate all required fields.
  let sections: any
  try {
    sections = parseOpenAIJson<any>(content)
    // v4.12.1: Log critical fields from AI output for debugging
    console.log(`[${requestId}] 🔍 AI returned voice_rationale:`, sections.voice_rationale ? `YES (${sections.voice_rationale.length} chars)` : 'NO')
    console.log(`[${requestId}] 🔍 AI returned business_character:`, sections.business_character ? `YES (${sections.business_character.length} chars)` : 'NO')
  } catch (e) {
    const errMsg = (e as Error)?.message || String(e)
    console.warn(`[${requestId}] ⚠️ Prompt B returned invalid JSON (${errMsg}). Falling back to deterministic defaults.`)
    sections = {}
  }
  
  // Normalize: ensure all fields with a `.value` property have a string value.
  // gpt-4o occasionally generates structured objects for fields that should be strings.
  // This guard converts them to JSON strings so downstream repairs don't crash.
  const STRING_VALUE_FIELDS = [
    'brand_essence', 'tone_of_voice', 'target_audience', 'core_offerings',
    'content_focus', 'cta_style', 'communication_goal', 'competitive_positioning'
  ]
  for (const field of STRING_VALUE_FIELDS) {
    const f = (sections as any)?.[field]
    if (f && typeof f === 'object' && 'value' in f && typeof f.value !== 'string') {
      console.log(`[${requestId}] ⚠️ ${field}.value is non-string (${typeof f.value}), coercing to string`)
      f.value = typeof f.value === 'object' ? JSON.stringify(f.value) : String(f.value ?? '')
    }
  }
  
  // v4.13.0: Single deterministic pass — collapsed from 7-layer repair stack.
  // AI repair was removed in v4.12.4. Soft repairs + proof grounding added latency without
  // measurable quality gain. All paths are now deterministic: no extra AI calls, no nested
  // re-validations, single validate → fallbacks → sanitize → log.

  // Step 1: deterministic structural repairs (normalizes field shapes, fills required keys)
  console.log(`[${requestId}] 🔧 Applying deterministic repairs...`)
  sections = applyDeterministicRepairs(sections, dataSources, analysis, language.code, locale)

  // Step 2: ensure content_pillars has all 6 well-formed items (always applied)
  {
    const rawPillars = (sections as any)?.content_pillars
    let pillars = normalizeContentPillars(rawPillars ?? [])
    if (pillars.length < 6) {
      console.log(`[${requestId}] 🔧 content_pillars has ${pillars.length} items — rebuilding deterministically from venue signals`)
      const _loc = dataSources?.location || {}
      const _areaType = _loc?.enrichment?.micro?.area_type
      const _ph = _areaType === 'waterfront' ? (locale.preferredPhrasing?.['location_waterfront'] || 'ved vandet')
        : _areaType === 'transit_hub' ? (locale.preferredPhrasing?.['location_transit'] || 'ved stationen')
        : _areaType === 'shopping_street' ? (locale.preferredPhrasing?.['location_shopping'] || 'på gågaden')
        : ''
      const _city = _loc?.enrichment?.macro?.city || dataSources?.business?.city || 'byen'
      const _locationHook = _ph ? `${_ph} i ${_city}` : _city
      pillars = buildContentPillarsFallback(dataSources, analysis, _locationHook)
      console.log(`[${requestId}] ✅ content_pillars rebuilt: ${pillars.filter((p: any) => p.encouraged).map((p: any) => p.pillar).join(', ')} encouraged`)
    }
    (sections as any).content_pillars = pillars
  }

  // Step 3: validate once, then apply all field-specific deterministic fallbacks in one pass
  const validationErrors = validateBrandProfileOutput(sections, analysis, dataSources)
  if (validationErrors.length > 0) {
    console.log(`[${requestId}] 🔧 Validation issues (${validationErrors.length}) — applying deterministic fallbacks`)

    if (validationErrors.some(e => String(e).includes('image_preferences.signature_shot'))) {
      sections = { ...(sections || {}), image_preferences: { ...((sections as any)?.image_preferences || {}), signature_shot: buildFallbackSignatureShot(dataSources, analysis, language) } }
    }
    // Trigger brand_essence fallback for structural errors (missing location/offering) OR quality errors (operational language, missing emotional positioning)
    if (validationErrors.some(e => {
      const err = String(e)
      return err.includes('brand_essence must include a location cue') ||
             err.includes('brand_essence must include an offering cue') ||
             err.includes('brand_essence must include a venue type cue') ||
             err.includes('Forbidden pattern detected') ||
             err.includes('brand_essence lacks emotional positioning') ||
             err.includes('brand_essence lacks sensory grounding') ||
             err.includes('Unverified claim')
    })) {
      console.log(`[${requestId}] 🎭 brand_essence quality validation failed — using deterministic fallback for emotional positioning`)
      sections = { ...(sections || {}), brand_essence: { ...(sections as any)?.brand_essence, value: buildFallbackBrandEssence(dataSources, analysis, language), proof: Array.isArray((sections as any)?.brand_essence?.proof) ? (sections as any).brand_essence.proof : ['#1'] } }
    }
    if (validationErrors.some(e => String(e).includes('content_pillars') && String(e).includes('notes must reference'))) {
      sections = patchContentPillarsNotesToReferenceHooks(sections)
    }
    if ((sections as any)?.content_pillars) {
      (sections as any).content_pillars = normalizeContentPillars((sections as any).content_pillars)
    }
    if (validationErrors.some(e => String(e).includes('target_audience'))) {
      const fallback = buildFallbackTargetAudience(dataSources, analysis, language)
      sections = { ...(sections || {}), __fallback_target_audience: true, target_audience: { ...((sections as any)?.target_audience || {}), value: fallback.value, proof: fallback.proof } }
    }
    if (validationErrors.some(e => String(e).includes('core_offerings'))) {
      const fallback = buildFallbackCoreOfferings(dataSources, analysis, language)
      sections = { ...(sections || {}), __fallback_core_offerings: true, core_offerings: { ...((sections as any)?.core_offerings || {}), value: fallback.value, proof: fallback.proof } }
    }
    if (validationErrors.some(e => String(e).includes('content_focus'))) {
      const fallback = buildFallbackContentFocus(dataSources, analysis, language)
      sections = { ...(sections || {}), __fallback_content_focus: true, content_focus: { ...((sections as any)?.content_focus || {}), value: fallback.value, proof: fallback.proof } }
    }
    if (validationErrors.some(e => String(e).includes('cta_style'))) {
      const fallback = buildFallbackCtaStyle(dataSources, analysis, language)
      sections = { ...(sections || {}), __fallback_cta_style: true, cta_style: { ...((sections as any)?.cta_style || {}), value: fallback.value, proof: fallback.proof } }
    }

    // Step 4: sanitize banned words (fast, deterministic)
    sections = sanitizeBannedWords(sections)

    // Step 5: log residual issues — never throw
    const residualErrors = validateBrandProfileOutput(sections, analysis, dataSources)
    if (residualErrors.length === 0) {
      console.log(`[${requestId}] ✅ All validation issues resolved`)
    } else {
      const structural = residualErrors.filter(e => { const s = String(e); return s.includes('must include location cue') || s.includes('must include action cue') || s.includes('must include CTA phrase') || s.includes('contains disallowed generic word') || (s.includes('missing') && !s.includes('distinctive hook')) })
      const warnings = residualErrors.filter(e => { const s = String(e); return s.includes('distinctive hook') || s.includes('proof does not reference') })
      if (structural.length > 0) console.warn(`[${requestId}] ⚠️ Residual structural issues (non-fatal):`, structural.slice(0, 12))
      if (warnings.length > 0 && !ignoreConfidenceCheck) console.warn(`[${requestId}] ⚠️ Differentiation warnings:`, warnings.slice(0, 12))
    }
  }

  // Absolute safety: content-based guards that validation may not catch
  try {
    const taRaw = (sections as any)?.target_audience
    const taValue = typeof taRaw === 'string' ? taRaw : (taRaw && typeof taRaw === 'object' ? String((taRaw as any).value || '') : '')
    if (isBadTargetAudienceValue(taValue)) {
      const fallback = buildFallbackTargetAudience(dataSources, analysis, language)
      sections = { ...(sections || {}), __fallback_target_audience: true, target_audience: { ...((sections as any)?.target_audience || {}), value: fallback.value, proof: fallback.proof } }
    }
  } catch { /* ignore */ }

  try {
    const coRaw = (sections as any)?.core_offerings
    const coValue = typeof coRaw === 'string' ? coRaw : (coRaw && typeof coRaw === 'object' ? String((coRaw as any).value || '') : '')
    if (isBadCoreOfferingsValue(coValue)) {
      const fallback = buildFallbackCoreOfferings(dataSources, analysis, language)
      sections = { ...(sections || {}), __fallback_core_offerings: true, core_offerings: { ...((sections as any)?.core_offerings || {}), value: fallback.value, proof: fallback.proof } }
    }
  } catch { /* ignore */ }

  try {
    const cfRaw = (sections as any)?.content_focus
    const cfValue = typeof cfRaw === 'string' ? cfRaw : (cfRaw && typeof cfRaw === 'object' ? String((cfRaw as any).value || '') : '')
    if (isBadContentFocusValue(cfValue)) {
      const fallback = buildFallbackContentFocus(dataSources, analysis, language)
      sections = { ...(sections || {}), __fallback_content_focus: true, content_focus: { ...((sections as any)?.content_focus || {}), value: fallback.value, proof: fallback.proof } }
    }
  } catch { /* ignore */ }

  try {
    const ctaRaw = (sections as any)?.cta_style
    const ctaValue = typeof ctaRaw === 'string' ? ctaRaw : (ctaRaw && typeof ctaRaw === 'object' ? String((ctaRaw as any).value || '') : '')
    if (isBadCtaStyleValue(ctaValue)) {
      const fallback = buildFallbackCtaStyle(dataSources, analysis, language)
      sections = { ...(sections || {}), __fallback_cta_style: true, cta_style: { ...((sections as any)?.cta_style || {}), value: fallback.value, proof: fallback.proof } }
    }
  } catch { /* ignore */ }

  // Path B post-processing: trim tone_of_voice bullet count to confirmed anchor count.
  // Prevents AI padding past the signals that were actually injected.
  // Section headers (STEMME-MEKANIK:, STEMME-IDENTITET:) and Eksempel: lines are always kept.
  // Cap is 4–6 to accommodate the two-section format (2-3 mechanics + 2-3 posture rules).
  if (voiceIsPathB) {
    try {
      const tovField = (sections as any)?.tone_of_voice
      const rawTov = typeof tovField === 'string' ? tovField : (tovField?.value ?? '')
      if (rawTov && typeof rawTov === 'string') {
        const lines = rawTov.split('\n')
        const bulletLines = lines.filter((l: string) => l.startsWith('- '))
        const maxBullets = voiceAnchorCount >= 1
          ? Math.min(Math.max(voiceAnchorCount, 4), 6) // floor 4 (2 mechanics + 2 posture), cap 6 (3+3)
          : 4 // no anchors → enforce two-section minimum of 4 bullets
        if (bulletLines.length > maxBullets) {
          // Filter line-by-line: count bullets, but always keep section headers and Eksempel: lines.
          let bulletCount = 0
          const trimmedLines = lines.filter((l: string) => {
            if (l.startsWith('- ')) { bulletCount++; return bulletCount <= maxBullets }
            return true // keep section headers (STEMME-*:), Eksempel:, blank lines, everything else
          })
          const trimmedTov = trimmedLines.join('\n').trim()
          console.log(`[${requestId}] ✂️ Path B tone_of_voice trimmed: ${bulletLines.length} bullets → ${maxBullets} (${voiceAnchorCount} anchors)`)
          if (typeof tovField === 'string') {
            ;(sections as any).tone_of_voice = trimmedTov
          } else {
            ;(sections as any).tone_of_voice = { ...(tovField || {}), value: trimmedTov }
          }
        }
      }
    } catch { /* trim is cosmetic — never block the profile */ }
  }

  // Specificity gate — soft-warn if brand_essence_elaboration is too abstract.
  // This field is injected into the weekly plan AI on every Phase 1 run (PERSONALITY ANCHOR
  // block). If it consists entirely of abstract warmth words, it pollutes every strategy prompt.
  // This is a warn-only gate: it never blocks generation, but provides signal for future enforcement.
  try {
    const ABSTRACT_MARKERS = ['varme', 'fællesskab', 'samvær', 'hygge', 'trivsel', 'velvære', 'atmosfære', 'stemning', 'glæde', 'oplevelse']
    const checkAbstractDrift = (rawField: any, fieldName: string) => {
      const text = typeof rawField === 'string' ? rawField : (rawField?.value ?? '')
      if (!text || typeof text !== 'string' || text.length < 10) return
      const words = text.toLowerCase().split(/\s+/)
      const abstractCount = ABSTRACT_MARKERS.filter(m => words.some(w => w.startsWith(m))).length
      if (abstractCount >= 2 && words.length <= 15) {
        console.warn(`[${requestId}] ⚠️ Abstract drift in ${fieldName} (${abstractCount} abstract markers / ${words.length} words): "${text.slice(0, 100)}"`)
      }
    }
    checkAbstractDrift((sections as any)?.brand_essence_elaboration, 'brand_essence_elaboration')
  } catch { /* cosmetic — never block profile */ }

  return parseBrandProfileResponse(sections, analysis, dataSources, language)
}

/**
 * Parses Prompt B JSON response into BrandProfile structure.
 */
function parseBrandProfileResponse(sections: any, analysis: any, dataSources: DataSources, language: LanguageConfig): BrandProfile {
  const evidence = analysis.evidence || {}

  const pickValue = (field: string): string => {
    const v = sections?.[field]
    let rawValue: string
    if (typeof v === 'string') rawValue = v
    else if (v && typeof v === 'object' && typeof (v as any).value === 'string') rawValue = (v as any).value
    else return 'N/A'
    // Normalize tone_of_voice inline bullets to newline-separated format.
    // Safety net for any residual linearisation not caught upstream.
    // (sanitizeBannedWords preserves \n since v4.13.x — this path rarely fires.)
    if (field === 'tone_of_voice' && !rawValue.includes('\n') && rawValue.includes('- ')) {
      let tov = rawValue
      // Move keyword sections onto their own lines first
      tov = tov.replace(/ (Eksempel: )/g, '\n$1')
      tov = tov.replace(/ (Undgå: )/g, '\n$1')
      // Split bullet items in the leading style-bullet segment
      const firstNl = tov.indexOf('\n')
      const bulletSeg = firstNl >= 0 ? tov.slice(0, firstNl) : tov
      const rest = firstNl >= 0 ? tov.slice(firstNl) : ''
      const parts = bulletSeg.split(' - ')
      const normalised = parts.map((p, i) => (i === 0 ? p : '- ' + p)).join('\n')
      return (normalised + rest).trim()
    }
    return rawValue
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
      raw: (JSON.stringify(v) ?? 'undefined').slice(0, 200)
    })
    if (Array.isArray(v)) return v
    if (v && typeof v === 'object' && Array.isArray((v as any).value)) return (v as any).value
    return []
  }
  
  const targetAudienceIsFallback = Boolean((sections as any)?.__fallback_target_audience)
  const targetAudienceValue = pickValue('target_audience')

  const coreOfferingsIsFallback = Boolean((sections as any)?.__fallback_core_offerings)
  const coreOfferingsValue = pickValue('core_offerings')

  const contentFocusIsFallback = Boolean((sections as any)?.__fallback_content_focus)
  const contentFocusValue = pickValue('content_focus')

  const ctaStyleIsFallback = Boolean((sections as any)?.__fallback_cta_style)
  const ctaStyleValue = pickValue('cta_style')

  return {
    brand_essence: {
      value: pickValue('brand_essence'),
      proof: pickProof('brand_essence')
    },
    tone_of_voice: {
      value: pickValue('tone_of_voice'),
      proof: pickProof('tone_of_voice')
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
      proof: pickProof('things_to_avoid')
    },
    target_audience: {
      value: targetAudienceValue,
      proof: targetAudienceIsFallback ? ['Inferred from business type and menu'] : pickProof('target_audience')
    },
    core_offerings: {
      value: coreOfferingsValue,
      proof: coreOfferingsIsFallback ? ['Menu items', 'Business type'] : pickProof('core_offerings')
    },
    content_focus: {
      value: contentFocusValue,
      proof: contentFocusIsFallback ? ['Menu', 'Physical space', 'Business type'] : pickProof('content_focus')
    },
    content_pillars: {
      value: pickArrayValue('content_pillars'),
      proof: pickProof('content_pillars')
    },
    cta_style: {
      value: ctaStyleValue,
      proof: ctaStyleIsFallback ? ['Website CTA', 'Business type'] : pickProof('cta_style')
    },
    communication_goal: {
      value: pickValue('communication_goal'),
      proof: pickProof('communication_goal')
    },
    image_preferences: {
      value: sections.image_preferences?.dos && sections.image_preferences?.donts
        ? { dos: sections.image_preferences.dos, donts: sections.image_preferences.donts, signature_shot: sections.image_preferences.signature_shot || '' }
        : { dos: [], donts: [], signature_shot: '' },
      proof: pickProof('image_preferences')
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
      proof: pickProof('social_style')
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
      proof: pickProof('voice_examples')
    },
    recognizable_interior_identity: {
      value: typeof sections.recognizable_interior_identity === 'string' ? sections.recognizable_interior_identity : '',
      proof: pickProof('recognizable_interior_identity')
    },

    // Plain-text business descriptor — drives WeekContext.business_character for strategy prompts
    // WP3: If Prompt B produced a valid new value, use it. Otherwise fall back to deterministic builder.
    ...(() => {
      const newValue = sections.business_character ? pickValue('business_character') : ''
      const existingSeed = dataSources.existingBusinessCharacter || ''
      
      // Quality gate: only re-inject existingSeed if it is substantive enough to be useful.
      const seedPassesQualityGate = existingSeed.length >= 50
      
      // Priority: AI output > existing seed > deterministic fallback
      let bestValue = ''
      if (newValue.length >= 30) {
        bestValue = newValue
      } else if (seedPassesQualityGate) {
        console.warn('⚠️ WP3: Prompt B business_character too short — preserving existing:', existingSeed.slice(0, 60))
        bestValue = existingSeed
      } else {
        // v4.12.1: Generate deterministic fallback from source data when AI fails
        console.warn('⚠️ WP3: Generating business_character from deterministic fallback (AI returned empty/short)')
        bestValue = buildBusinessCharacterFallback(dataSources, analysis, language)
      }
      
      return { business_character: bestValue }
    })(),

    // V2 Brand Profile fields (Marts 2026)
    ...(sections.brand_essence_elaboration && {
      brand_essence_elaboration: {
        value: pickValue('brand_essence_elaboration'),
        proof: pickProof('brand_essence_elaboration')
      }
    }),
    ...(sections.identity_keywords && {
      identity_keywords: {
        value: pickArrayValue('identity_keywords') as string[],
        proof: []
      }
    }),
    ...(sections.voice_constraints && {
      voice_constraints: {
        value: pickValue('voice_constraints'),
        proof: pickProof('voice_constraints')
      }
    }),

    // Plain-text voice rationale — explains how Voice rules were derived (stored for transparency)
    // v4.12.1: Unconditional with deterministic fallback to ensure field is always populated
    ...(() => {
      const newValue = typeof sections.voice_rationale === 'string' ? sections.voice_rationale.trim() : ''
      const existingSeed = dataSources.existingVoiceRationale || ''
      
      // Quality gate: only re-inject existingSeed if substantive
      const seedPassesQualityGate = existingSeed.length >= 100
      
      // Priority: AI output > existing seed > deterministic fallback
      let bestValue = ''
      if (newValue.length >= 80) {
        bestValue = newValue
      } else if (seedPassesQualityGate) {
        console.warn('⚠️ WP3: Prompt B voice_rationale too short — preserving existing:', existingSeed.slice(0, 60))
        bestValue = existingSeed
      } else {
        console.warn('⚠️ WP3: Generating voice_rationale from deterministic fallback (AI returned empty/short)')
        bestValue = buildVoiceRationaleFallback(dataSources, analysis, language)
      }
      
      return { voice_rationale: bestValue }
    })(),

    // Audience framework REMOVED (Sprint 1 - Complexity Reduction)
    // Consolidation: audience_segments (Stage B5) is kept (has timing_windows + content_angles).
    // audience_framework was abstract multi-dimensional representation, unused in content generation.
    // Both solved the same problem — picked the one with actionable data.
    // ...(sections.audience_framework ? { audience_framework: sections.audience_framework } : {}),

    // Voice system — context-adaptive voice guidance (programme-specific, time-based variations)
    ...(sections.voice_system ? { voice_system: sections.voice_system } : {}),

    // Content strategy — drives Phase 1 slot assignment (goal_mode + content_category per post)
    ...((() => {
      const cs = sections.content_strategy;
      console.log('[bp] content_strategy parsed:', cs ? JSON.stringify(cs).slice(0, 120) : 'MISSING — Prompt B did not include it');
      
      // If AI didn't generate content_strategy, use deterministic fallback
      if (!cs) {
        const fallbackCtx = {
          dataSources,
          analysis,
          locale,
          errors: errorCollector
        };
        const fallbackResult = buildContentStrategyFallback(fallbackCtx);
        console.log('[bp] content_strategy fallback applied:', JSON.stringify(fallbackResult.value).slice(0, 150));
        return { content_strategy: fallbackResult.value };
      }
      
      // Deterministic normalizer: GPT-4o occasionally returns a string instead of an array for
      // footfall_signals, brand_anchors, loyalty_hooks. Split on comma/semicolon to recover array.
      const toArray = (v: any): string[] => {
        if (Array.isArray(v)) return v.filter((x: any) => typeof x === 'string');
        if (typeof v === 'string' && v.trim()) return v.split(/[,;]\s*/).map((s: string) => s.trim()).filter(Boolean);
        return [];
      };
      // content_category_weights: strip any extra keys not in schema (e.g. "community")
      const VALID_CCW_KEYS = ['product_menu', 'craving_visual', 'behind_scenes', 'team_people'];
      const rawCCW = cs.content_category_weights ?? {};
      const filteredCCW: Record<string, number> = {};
      let ccwSum = 0;
      for (const k of VALID_CCW_KEYS) {
        filteredCCW[k] = typeof rawCCW[k] === 'number' ? rawCCW[k] : 0;
        ccwSum += filteredCCW[k];
      }
      // Re-normalise to 100 if sum is off (e.g. because community was stripped)
      if (ccwSum > 0 && ccwSum !== 100) {
        const factor = 100 / ccwSum;
        for (const k of VALID_CCW_KEYS) filteredCCW[k] = Math.round(filteredCCW[k] * factor);
        // Fix rounding error on first key
        const diff = 100 - VALID_CCW_KEYS.reduce((s, k) => s + filteredCCW[k], 0);
        filteredCCW[VALID_CCW_KEYS[0]] += diff;
      }
      const normalised = {
        ...cs,
        footfall_signals: toArray(cs.footfall_signals),
        brand_anchors:    toArray(cs.brand_anchors),
        loyalty_hooks:    toArray(cs.loyalty_hooks),
        content_category_weights: filteredCCW,
      };
      return { content_strategy: normalised };
    })())
  }
}

// ============================================================================
// GENERATION LOCK HELPERS
// ============================================================================

/**
 * Acquire a generation lock for a business.
 * Returns success=false if lock already exists and is < 10 minutes old.
 */
function isTableMissingError(error: any): boolean {
  const msg: string = error?.message ?? ''
  const details: string = error?.details ?? ''
  return (
    error?.code === '42P01' ||
    msg.includes('does not exist') ||
    msg.includes('relation') ||
    msg.includes('schema cache') ||           // PostgREST: "Could not find the table ... in the schema cache"
    msg.includes('Could not find the table') || // PostgREST alternative phrasing
    details.includes('does not exist')
  )
}

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
    const { data: existingLock, error: selectError } = await supabase
      .from('brand_profile_generation_locks')
      .select('request_id, started_at')
      .eq('business_id', businessId)
      .single()

    // If lock table doesn't exist yet (migration not run), skip locking entirely
    if (selectError && isTableMissingError(selectError)) {
      console.warn(`[${requestId}] ⚠️ Lock table missing — skipping lock check, proceeding`)
      return { success: true }
    }
    
    if (existingLock) {
      const startedAt = new Date(existingLock.started_at)
      const ageMinutes = (Date.now() - startedAt.getTime()) / 1000 / 60
      
      // If lock is older than 3 minutes, consider it stale and remove it
      // (edge fn max runtime is ~130s, so anything >3 min is definitively stale)
      if (ageMinutes > 3) {  // ✅ Was 10 — edge fn max is ~130s so 3min is safely stale
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
    const { error: insertError } = await supabase
      .from('brand_profile_generation_locks')
      .insert({
        business_id: businessId,
        request_id: requestId,
        started_at: new Date().toISOString()
      })
    
    if (insertError) {
      // If table doesn't exist, treat as no lock (migration not yet run) — proceed
      if (isTableMissingError(insertError)) {
        console.warn(`[${requestId}] ⚠️ Lock table missing on insert — skipping lock check, proceeding`)
        return { success: true }
      }
      // Likely a race condition - another request acquired the lock first
      console.error(`[${requestId}] ❌ Failed to acquire lock:`, insertError.message)
      return {
        success: false,
        reason: 'Lock acquired by concurrent request',
        existingRequestId: 'unknown'
      }
    }
    
    return { success: true }
  } catch (err) {
    // If any unexpected exception — fail open (allow generation) rather than blocking forever
    console.error(`[${requestId}] ❌ Error acquiring lock (failing open):`, err)
    return { success: true }
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
// STAGE B0 — BUSINESS MODEL CLASSIFICATION
// ============================================================================

/**
 * Stage B0 — Business Model Classification (gpt-4o-mini, ~5s, non-blocking).
 * Runs BEFORE Prompt A. Classifies the structural shape of the business using
 * minimal signals directly from dataSources — no menu data, no full profile.
 * Output is passed to segmentAudience() so B5 can skip TRIN 1 (~30% prompt reduction).
 */
async function classifyBusinessModel(
  apiKey: string,
  dataSources: DataSources,
  requestId: string
): Promise<{ business_model_type: string; primary_copy_hook: string; audience_breadth: string; classification_rationale: string } | null> {
  const operations = dataSources.operations as any
  const locationIntelRow = dataSources.locationIntelligenceRow as any

  const establishmentType: string = operations?.establishment_type ?? (dataSources.business as any)?.vertical ?? ''
  const dayArcProgrammes: string[] = (dataSources.menuSignalProgrammes as any[] | null)
    ?.filter((p: any) => p?.brand_weight !== 'operational')
    ?.map((p: any) => p?.label_da ?? p?.label ?? '')
    ?.filter(Boolean) ?? []
  const areaType: string = locationIntelRow?.area_type ?? ''
  const touristFactor: string = locationIntelRow?.tourist_context ?? false ? 'year_round or seasonal' : 'none'

  // Build prompts using extracted builders
  const systemPrompt = buildClassifyBusinessSystemPrompt()
  
  const promptParams: ClassifyBusinessPromptParams = {
    establishmentType,
    dayArcProgrammes,
    areaType,
    touristFactor
  }
  
  const userPrompt = buildClassifyBusinessUserPrompt(promptParams)

  try {
    const response = await fetchOpenAIWithRetry(
      apiKey,
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: 'json_object' }
      },
      requestId,
      'Stage B0 (Business Model Classification)',
      { timeout: 10000, maxRetries: 1, retryDelayMs: 1000, retryStatusCodes: [429, 500, 502, 503, 504] }
    )

    const raw = response.choices[0]?.message?.content
    if (!raw) throw new Error('Stage B0: no response')
    const parsed = JSON.parse(raw)
    
    console.log(`[${requestId}] ✅ Stage B0: ${parsed.business_model_type} (${parsed.audience_breadth})`)
    return parsed
  } catch (err: any) {
    console.warn(`[${requestId}] ⚠️ Stage B0 failed:`, err?.message ?? err)
    return null
  }
}

// ============================================================================
// STAGE B5 — AUDIENCE SEGMENT INTELLIGENCE
// ============================================================================

/**
 * Stage B5 — Audience Segment Intelligence (gpt-4o, non-blocking, non-fatal).
 * Generates 3-6 named segments with timing windows + content angles + metadata.
 * Saved to audience_segments JSONB column — consumed by get-quick-suggestions + owner UI.
 */
async function segmentAudience(
  apiKey: string,
  brandProfile: any,
  secondarySignals: any,
  locationIntelligence: any | null,
  dataSources: DataSources,
  ownerDocument: any | null,
  languageCode: string,
  requestId: string,
  b0Classification?: { business_model_type: string; primary_copy_hook: string; audience_breadth: string; classification_rationale: string } | null
): Promise<any | null> {
  const operations = dataSources.operations as any
  const locationIntelRow = dataSources.locationIntelligenceRow as any
  const priceRange = secondarySignals.priceRange

  // ── Extract context variables ────────────────────────────────────────────
  const touristContext = locationIntelligence?.tourist_context ?? false
  const locationMotivations: string[] = locationIntelligence?.matched_motivations ?? []
  const businessCharacter: string = typeof brandProfile?.business_character === 'object'
    ? (brandProfile.business_character?.value ?? '')
    : (brandProfile?.business_character ?? '')
  const identityKeywords: string[] = Array.isArray(brandProfile?.identity_keywords?.value)
    ? brandProfile.identity_keywords.value
    : (Array.isArray(brandProfile?.identity_keywords) ? brandProfile.identity_keywords : [])
  const city: string = (dataSources.location as any)?.enrichment?.macro?.city ?? (dataSources.business as any)?.city ?? ''
  const neighborhood: string = locationIntelRow?.neighborhood ?? ''
  const areaType: string = locationIntelRow?.area_type ?? locationIntelligence?.primary_type ?? ''
  const establishmentType: string = operations?.establishment_type ?? ''
  const hasOutdoor: boolean = operations?.has_outdoor_seating ?? false
  const hasTakeaway: boolean = operations?.has_takeaway ?? false
  const reservationRequired: boolean = secondarySignals.acceptsReservations === true
  const proximityAnchor: string = locationIntelligence?.marketing_focus ?? locationMotivations[0] ?? ''

  // Price label
  const priceLevelLabel = (() => {
    if (priceRange.max === null && priceRange.min === null) return 'ukendt prisniveau'
    const top = priceRange.max ?? priceRange.min ?? 0
    if (top >= 300) return `premium (${priceRange.min ?? '?'}–${priceRange.max ?? '?'} kr)`
    if (top >= 150) return `mid-range (${priceRange.min ?? '?'}–${priceRange.max ?? '?'} kr)`
    return `budget-friendly (${priceRange.min ?? '?'}–${priceRange.max ?? '?'} kr)`
  })()

  // Menu anchors — AI summaries preferred (full helicopter view per service period)
  const menuAnchors = (() => {
    const summaries = dataSources.menuSummaries
    if (Array.isArray(summaries) && summaries.length > 0) {
      return summaries.slice(0, 5)
        .map((m: any) => {
          const header = `${m.title}`
          return `${header}\n${String(m.summary ?? '').slice(0, 400)}`
        })
        .join('\n\n')
    }
    return secondarySignals.categoryLabels.slice(0, 6).join(', ') || ''
  })()

  // Owner USPs — owner's own words, highest-quality signal
  const whatMakesUsDifferent = (ownerDocument?.usps ?? []).slice(0, 3).join('; ')
  const ownerDocSummary = [ownerDocument?.brand_feel, ownerDocument?.tone_sentence]
    .filter(Boolean).join(' — ').slice(0, 250)

  // Google Maps review signals
  const googleMapsSummary = (() => {
    const thirdParty = dataSources.thirdPartyEvidence as any
    const reviews = thirdParty?.googleMaps?.reviews
    if (!Array.isArray(reviews) || reviews.length === 0) return ''
    return reviews.slice(0, 3)
      .map((r: any) => r?.summary ?? r?.text ?? '')
      .filter(Boolean)
      .join(' | ')
      .slice(0, 400)
  })()

  // Language mapping for output instruction
  const langLabels: Record<string, string> = {
    da: 'dansk', sv: 'svensk', de: 'tysk', nb: 'norsk', fi: 'finsk', en: 'engelsk'
  }
  const outputLanguageLabel = langLabels[languageCode] ?? 'dansk'

  // Build prompts using extracted builders
  const systemPrompt = buildSegmentAudienceSystemPrompt(outputLanguageLabel)
  
  const promptParams: SegmentAudiencePromptParams = {
    businessCharacter,
    identityKeywords,
    city,
    neighborhood,
    areaType,
    establishmentType,
    touristContext,
    locationMotivations,
    proximityAnchor,
    menuAnchors,
    hasOutdoor,
    hasTakeaway,
    reservationRequired,
    priceLevelLabel,
    priceRange,
    whatMakesUsDifferent,
    ownerDocSummary,
    googleMapsSummary,
    secondarySignals,
    b0Classification,
    languageCode
  }
  
  const userPrompt = buildSegmentAudienceUserPrompt(promptParams)

  try {
    const response = await fetchOpenAIWithRetry(
      apiKey,
      {
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,  // structural output: lower temp = stable segment count/labels across re-runs
        max_tokens: b0Classification ? 2400 : 3200,  // B0 pre-classification reduces output by ~30%
        response_format: { type: 'json_object' }
      },
      requestId,
      'Stage B5 (Audience Segment Intelligence)',
      { timeout: 55000, maxRetries: 1, retryDelayMs: 1000, retryStatusCodes: [429, 500, 502, 503, 504] }
    )

    const raw = response.choices[0]?.message?.content
    if (!raw) throw new Error('Stage B5: no response')
    
    const parsed = JSON.parse(raw)
    const hasClassification = parsed.business_model_type || parsed.primary_copy_hook || parsed.audience_breadth
    
    if (!Array.isArray(parsed.segments) || parsed.segments.length === 0) {
      console.warn(`[${requestId}] ⚠️ Stage B5: no segments array in response`)
      if (!hasClassification) {
        console.warn(`[${requestId}] ⚠️ Stage B5: no segments and no classification in response`)
        return null
      }
    }

    // Keep only structurally valid segments
    const valid = parsed.segments.filter((s: any) =>
      (typeof s.label === 'string' || typeof s.name === 'string') &&
      typeof s.priority === 'string' &&
      Array.isArray(s.timing) &&
      typeof s.motivation === 'string' &&
      Array.isArray(s.content_angles)
    )
    if (valid.length === 0 && !hasClassification) return null

    // Normalize Danish day names → English so matchActiveSegment works in all consumers
    const DA_TO_EN_DAY: Record<string, string> = {
      'søndag': 'sunday', 'mandag': 'monday', 'tirsdag': 'tuesday',
      'onsdag': 'wednesday', 'torsdag': 'thursday', 'fredag': 'friday', 'lørdag': 'saturday'
    }
    
    // Ensure each segment has both `label` (new) and `name` (backwards-compat alias)
    const enriched = valid.map((s: any) => ({
      ...s,
      label: s.label ?? s.name ?? 'Ukendt segment',
      name: s.label ?? s.name ?? 'Ukendt segment',
      timing: Array.isArray(s.timing)
        ? s.timing.map((t: any) => ({ ...t, day: DA_TO_EN_DAY[String(t.day ?? '').toLowerCase()] ?? String(t.day ?? '').toLowerCase() }))
        : s.timing,
    }))

    // Wrap segments in top-level metadata object (includes new classification fields)
    // Use B0 pre-classification as fallback when B5 did not produce its own values
    const result = {
      business_model_type: parsed.business_model_type ?? b0Classification?.business_model_type ?? null,
      primary_copy_hook: parsed.primary_copy_hook ?? b0Classification?.primary_copy_hook ?? null,
      audience_breadth: parsed.audience_breadth ?? b0Classification?.audience_breadth ?? null,
      segments_rationale: parsed.segments_rationale ?? null,
      primary_mindset: parsed.primary_mindset ?? null,
      primary_segment_id: parsed.primary_segment_id ?? null,
      content_rotation_note: null,
      tourist_factor: parsed.tourist_factor ?? null,
      deduced_from: Array.isArray(parsed.deduced_from) ? parsed.deduced_from : [],
      segments: enriched,
    }

    console.log(`[${requestId}] ✅ Stage B5: ${enriched.length} segments (${enriched.map((s: any) => s.label).join(', ')})`)
    return result
  } catch (err: any) {
    console.warn(`[${requestId}] ⚠️ Stage B5 AI call failed:`, err?.message ?? err)
    return null
  }
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

  // Parse body ONCE outside try/catch so businessId is always accessible (e.g. in catch for lock release)
  let businessId: string | null = null
  let requestBody: any = {}
  try {
    requestBody = await req.json()
    businessId = requestBody.businessId ?? null
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body', requestId }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const { 
      forceRegenerate = false,
      allowThirdParty = false,
      ignoreConfidenceCheck = false,  // DEPRECATED: use ignoreDifferentiationGate
      ignoreDifferentiationGate = false,  // NEW: only ignores "not enough hooks" warnings
      debug_mode = null  // 'prompt_a_only' | 'prompt_b_skip_save' | null
    } = requestBody

    if (!businessId) {
      return new Response(
        JSON.stringify({ error: 'businessId is required', requestId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize language early with fallback to prevent undefined reference errors
    let language: LanguageConfig = LANGUAGES.da

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log(`[${requestId}] 🎯 Starting brand profile generation for business:`, businessId)
    console.log(`[${requestId}] 🔧 v4.12.4: Removed JSON-fixer chain + AI repair + oversized menu. Budget: A(35)+B(50)=85s worst-case`)
    
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
    let dataSources
    try {
      dataSources = await gatherDataSources(supabaseClient, businessId, allowThirdParty)
      console.log(`[${requestId}] ✅ Data sources gathered successfully`)
    } catch (gatherError) {
      console.error(`[${requestId}] ❌ Error in gatherDataSources:`, gatherError)
      throw gatherError
    }

    // Step 1.5: Compute source hashes and check if regeneration needed
    console.log(`[${requestId}] 🔐 Computing content hashes...`)
    let sourceHashes, versionHash
    try {
      sourceHashes = await computeSourceHashes(dataSources)
      console.log(`[${requestId}] ✅ Source hashes computed`)
      versionHash = await computeVersionHash(sourceHashes)
      console.log(`[${requestId}] ✅ Version hash computed`)
    } catch (hashError) {
      console.error(`[${requestId}] ❌ Error in hashing:`, hashError)
      throw hashError
    }
    
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
              tone_model: existingProfile.tone_model ?? null,
              content_focus: existingProfile.content_focus,
              target_audience: existingProfile.target_audience,
              content_pillars: existingProfile.content_pillars_jsonb || existingProfile.content_pillars,
              content_pillars_jsonb: existingProfile.content_pillars_jsonb || existingProfile.content_pillars,
              social_style: existingProfile.social_style,
              things_to_avoid: existingProfile.things_to_avoid_jsonb || existingProfile.things_to_avoid,
              things_to_avoid_jsonb: existingProfile.things_to_avoid_jsonb,
              core_offerings: existingProfile.core_offerings,
              core_offerings_jsonb: existingProfile.core_offerings_jsonb,
              cta_style: existingProfile.cta_style,
              communication_goal: existingProfile.communication_goal,
              voice_examples: existingProfile.voice_examples,
              content_strategy: existingProfile.content_strategy ?? null,
              image_preferences: existingProfile.image_preferences_jsonb || existingProfile.image_preferences,
              image_preferences_jsonb: existingProfile.image_preferences_jsonb,
              location_intelligence: existingProfile.location_intelligence ?? null,
              quality_status: existingProfile.quality_status ?? null,
              version_hash: versionHash ?? null,
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
    try {
      language = detectLanguageFromData(dataSources)
      console.log(`[${requestId}] 🌍 Language detected successfully: ${language.name} (${language.code})`)
    } catch (langError) {
      console.error(`[${requestId}] ❌ Language detection failed:`, langError)
      // Keep fallback Danish
      console.log(`[${requestId}] ⚠️ Using fallback language: ${language.name}`)
    }
    
    // Verify language was initialized  
    if (!language) {
      console.error(`[${requestId}] ❌ Language still not initialized, forcing Danish fallback`)
      language = LANGUAGES.da
    }
    
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

    // Step 1.75: Stage B0 — fast business model pre-classification (gpt-4o-mini, ~5s)
    // Runs before Prompt A with minimal data so B5 can skip TRIN 1 (~30% prompt reduction)
    console.log(`[${requestId}] 🏷️ Stage B0: pre-classifying business model...`)
    let b0Classification: { business_model_type: string; primary_copy_hook: string; audience_breadth: string; classification_rationale: string } | null = null
    try {
      b0Classification = await classifyBusinessModel(
        Deno.env.get('OPENAI_API_KEY')!,
        dataSources,
        requestId
      )
    } catch (b0Err) {
      console.warn(`[${requestId}] ⚠️ Stage B0 exception (non-fatal):`, String(b0Err))
    }

    // Step 2: Run Prompt A
    // Non-fatal: if Prompt A times out or fails, we continue with empty analysis.
    // Deterministic repairs and fallbacks in Prompt B generate a valid profile regardless.
    console.log(`[${requestId}] 🔍 Running internal analysis...`)
    let analysis: any = {}
    let promptAFailed = false
    try {
      analysis = await runInternalAnalysis(dataSources, language, allowThirdParty, requestId)
    } catch (promptAErr) {
      promptAFailed = true
      console.warn(`[${requestId}] ⚠️ Prompt A failed (non-fatal — continuing with empty analysis):`, String(promptAErr))
    }

    // Step 2: Debug early-return — Prompt A only
    if (debug_mode === 'prompt_a_only') {
      const totalDuration = Date.now() - requestStartTime
      console.log(`[${requestId}] 🧪 debug_mode=prompt_a_only — returning Prompt A result after ${totalDuration}ms`)
      await releaseGenerationLock(supabaseClient, businessId, requestId).catch(() => {})
      return new Response(
        JSON.stringify({ debug_mode, durationMs: totalDuration, analysis }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 2.5: Ensure must_use_phrases
    analysis = ensureMustUsePhrasesFallback(analysis, dataSources)

    // Step 2.55: Enforce distinctive_hooks minimum (>=2) or mark risk
    analysis = ensureDistinctiveHooksMinimum(analysis)

    // Log generic anchor risk (helps detect Prompt B genericness)
    if (analysis?.evidence?.generic_anchor_risk) {
      console.log(`[${requestId}] ⚠️ generic_anchor_risk=true (must_use_phrases are generic)`)
    }

    // Step 2.6: Validate Distinctive Hooks contract (log-only, no repair retry)
    // Repair retry removed v4.12.2: second runInternalAnalysis (55s) + Prompt B (50s) = 160s > 150s wall-clock limit.
    // Worst-case with repair: 55s (A) + 55s (repair) + 50s (B) = 160s → Supabase kills at 150s.
    // The contract is structurally enforced by ensureDistinctiveHooksMinimum() above.
    const shouldSkipContractValidation = ignoreDifferentiationGate || ignoreConfidenceCheck
    if (!shouldSkipContractValidation) {
      const hookErrors = validateDistinctiveHooksContract(analysis, dataSources)
      if (hookErrors.length > 0) {
        console.warn(`[${requestId}] ⚠️ Distinctive Hooks contract violations (continuing — no repair to stay inside 150s): ${hookErrors.slice(0, 6).join(' | ')}`)
      }
    } else {
      console.log(`[${requestId}] ⚠️ Skipping Distinctive Hooks contract validation (ignoreDifferentiationGate=true)`)
    }

    // Step 2.7: Operational confidence gate
    // If we do not have at least 2 evidence-backed distinctive hooks, we should not
    // generate (or save) a brand profile. Instead we return guidance for the user.
    // UNLESS ignoreDifferentiationGate is explicitly set to true
    const differentiation = computeDifferentiationConfidence(analysis)
    // Skip the gate when Prompt A failed (empty analysis would always trigger it, blocking generation)
    const shouldSkipDifferentiationGate = promptAFailed || ignoreDifferentiationGate || ignoreConfidenceCheck  // backwards compat
    if (!shouldSkipDifferentiationGate && (Boolean(analysis?.evidence?.distinctive_hooks_missing) || differentiation.hooksCount < 1)) {
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
            menu_source: dataSources.menuSource || 'none',
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
      // v4.12.1: Surface validation errors to user (especially voice_rationale, business_character requirements)
      finalValidation.errors.forEach(err => {
        const isHardError = err.includes('🚫 HARD ERROR')
        requestErrors.add(
          ErrorCategory.VALIDATION_STRUCTURAL,
          isHardError ? ErrorSeverity.CRITICAL : ErrorSeverity.HIGH,
          err,
          'validation'
        )
      })
    }

    // SANITY CHECK: verify the exact values being written to DB match what prompts produced
    console.log('✅ SAVE_CHECK brand_essence.value =', (brandProfile as any)?.brand_essence?.value)
    console.log('✅ SAVE_CHECK tone_of_voice.value =', (brandProfile as any)?.tone_of_voice?.value)

    // Step 4: Compute quality status and save to database
    const qualityStatus = requestErrors.getQualityStatus()
    const errorSummary = requestErrors.getSummary()
    
    // Step 4.5: Sanitize tone_model before save (v4.7.3 - Critical DB safety fix)
    // Ensures tone_model is either null or fully normalized to pass DB constraint
    console.log(`[${requestId}] 🧹 Sanitizing tone_model for DB...`)
    const rawToneModel = brandProfile.tone_model
    // Log raw AI output BEFORE sanitization so we can diagnose failures
    console.log(`[${requestId}] 🔍 RAW_TONE_MODEL from AI:`, JSON.stringify(rawToneModel, null, 2))
    let sanitizedToneModel = sanitizeToneModelForDb(rawToneModel, language.code)
    if (!sanitizedToneModel) {
      console.warn(`[${requestId}] ⚠️ tone_model sanitization failed — will save as null. Check RAW_TONE_MODEL log above.`)
    }

    brandProfile.tone_model = sanitizedToneModel as any  // ToneModelV2 | null - type widening needed
    
    console.log(`[${requestId}] 💾 Saving brand profile...`)
    console.log(`[${requestId}] 📊 Quality Status: ${qualityStatus} (${errorSummary})`)
    console.log(`[${requestId}] 🔐 Version Hash: ${versionHash}`)
    console.log(`[${requestId}] 🔍 tone_model about to save:`, JSON.stringify(brandProfile.tone_model, null, 2))

    // Compute deterministic location intelligence (zero latency, zero tokens)
    // Prefer business_location_intelligence row (has full category_scores) over
    // business_locations row (which only has lightweight enrichment.micro.area_type)
    const locationIntelligence = buildLocationIntelligence(dataSources.locationIntelligenceRow ?? dataSources.location)
    if (locationIntelligence) {
      console.log(`[${requestId}] 📍 location_intelligence: primary=${locationIntelligence.primary_type}, motivations=[${locationIntelligence.matched_motivations.join(', ')}], tourist=${locationIntelligence.tourist_context}`)
    }

    // Generate voice archetype options (non-blocking, non-fatal)
    // Produces two bespoke voice options for the owner to choose from.
    // Recommended archetype is applied as active; alternative stored in voice_options.
    console.log(`[${requestId}] 🎙️ Generating voice archetype options...`)
    const businessName = dataSources.business?.name ?? 'Forretning'
    const businessTypeForVoice = brandProfile.business_character ?? (dataSources.business?.business_type_ai ?? '')
    const locationForVoice = (
      dataSources.location?.enrichment?.micro?.area_description ||
      dataSources.location?.enrichment?.macro?.city ||
      dataSources.business?.city ||
      ''
    )
    const menuItemsForVoice: string[] = (
      (dataSources.menuItems as any[])?.slice(0, 10).map((m: any) => m?.name ?? m?.item_name ?? '').filter(Boolean) ?? []
    )
    // Pull the actual homepage text for Pipeline A (website-faithful voice analysis)
    const websiteAnalysis = dataSources.websiteAnalysis as any
    const websiteTextForVoice: string = (
      websiteAnalysis?.homepage_content ??
      websiteAnalysis?.raw_result?.homepage_text ??
      [
        ...(websiteAnalysis?.hero_texts ?? []),
        ...(websiteAnalysis?.headers ?? []),
        ...(websiteAnalysis?.cta_texts ?? [])
      ].filter(Boolean).join(' ') ??
      ''
    )

    // Build secondary signals for Pipeline B calibration
    const menuItemsRaw = (dataSources.menuItems as any[]) ?? []
    const prices = menuItemsRaw
      .map((m: any) => m?.price)
      .filter((p: any) => p != null && !isNaN(Number(p)))
      .map(Number)

    // Section D fallback chain: about/tagline first, then CTA texts → business_character → empty
    // Prefer first-person owner voice over navigation labels
    const aboutFragments = [
      websiteAnalysis?.about_us,
      websiteAnalysis?.tagline,
      websiteAnalysis?.description,
      ...(Array.isArray(websiteAnalysis?.subpage_texts) ? websiteAnalysis.subpage_texts : [])
    ].filter((t: any) => typeof t === 'string' && t.trim().length > 20)
     .slice(0, 3) as string[]

    const ctaAndHeaderFragments = [
      ...(Array.isArray(websiteAnalysis?.cta_texts) ? websiteAnalysis.cta_texts : []),
      ...(Array.isArray(websiteAnalysis?.headers) ? websiteAnalysis.headers : [])
    ].filter((t: any) => typeof t === 'string' && t.trim().length > 8).slice(0, 3) as string[]

    const secondaryTextFragments: string[] = aboutFragments.length > 0
      ? aboutFragments
      : ctaAndHeaderFragments.length > 0
        ? ctaAndHeaderFragments
        : dataSources.existingBusinessCharacter
          ? [dataSources.existingBusinessCharacter.substring(0, 200)]
          : []

    // Detect reservations from booking CTAs or booking URLs in websiteAnalysis
    const bookingPattern = /\b(book|reserv|bordreserv|bestil\s+bord|reserve(r)?\s+bord)\b/i
    const ctaTexts: string[] = Array.isArray(websiteAnalysis?.cta_texts) ? websiteAnalysis.cta_texts : []
    const hasBookingCta = ctaTexts.some((t: string) => bookingPattern.test(t))
    const hasBookingUrl = typeof websiteAnalysis?.booking_url === 'string' && websiteAnalysis.booking_url.length > 0
    const acceptsReservations: boolean | null = (hasBookingCta || hasBookingUrl) ? true : null

    // Opening hours hint from structured opening_hours rows
    const openingHoursRows = dataSources.openingHoursRows ?? []
    const openingHoursHint: string = (() => {
      if (openingHoursRows.length === 0) return ''
      const dayMap: Record<string, string> = {
        monday: 'Ma', tuesday: 'Ti', wednesday: 'On', thursday: 'To',
        friday: 'Fr', saturday: 'Lø', sunday: 'Sø',
        '0': 'Sø', '1': 'Ma', '2': 'Ti', '3': 'On', '4': 'To', '5': 'Fr', '6': 'Lø'
      }
      const rows = openingHoursRows.map((r: any) => {
        const d = dayMap[String(r.weekday).toLowerCase()] ?? r.weekday
        const o = String(r.open_time ?? '').substring(0, 5)
        const c = String(r.close_time ?? '').substring(0, 5)
        return `${d} ${o}-${c}`
      })
      // Compact: if all days same hours, show range
      const unique = [...new Set(rows.map((r: string) => r.split(' ')[1]))]
      if (unique.length === 1 && openingHoursRows.length >= 7) return `Alle dage ${unique[0]}`
      return rows.slice(0, 5).join(', ') + (rows.length > 5 ? '...' : '')
    })()

    // Hybrid venue detection — done in TypeScript from concrete signals before AI Call 1
    // Avoids asking the model to assess category when we already have the data
    const hybridTypeHint: string = (() => {
      const baseType = (businessTypeForVoice ?? '').toLowerCase()
      const programmes = (dataSources.menuSignalProgrammes as any[] | null)
        ?.map((p: any) => (p?.role ?? p?.name ?? '').toLowerCase()) ?? []
      const catLabels = [...new Set(
        ((dataSources.menuItems as any[]) ?? []).map((m: any) => (m?.category ?? '').toLowerCase()).filter(Boolean)
      )] as string[]

      // Detect day dimension: morning/brunch/lunch programmes or relevant menu categories
      const hasDayDimension = programmes.some(p => /brunch|morgen|frokost|lunch|kaffe|dag/i.test(p))
        || catLabels.some(c => /brunch|frokost|morgen|morgenmad|kaffe|smørrebrød|sandwich/i.test(c))

      // Detect night/bar dimension: evening/cocktail/bar programmes, late hours, bar menu categories
      const hasNightDimension = programmes.some(p => /aften|cocktail|bar|nat|sen/i.test(p))
        || catLabels.some(c => /cocktail|bar|drinks|spiritus|vin|øl|natmad/i.test(c))
        || (() => {
          // Close time after 22:30 signals late-night component
          const rows = dataSources.openingHoursRows ?? [] as any[]
          return (rows as any[]).some((r: any) => {
            const close = String(r?.close_time ?? '').substring(0, 5)
            if (!close || !close.includes(':')) return false
            const [h] = close.split(':').map(Number)
            return h >= 23 || h <= 4 // midnight or later (incl. wrapping past midnight)
          })
        })()

      // Only flag as hybrid if there are two genuinely distinct operational dimensions
      if (!hasDayDimension || !hasNightDimension) return ''

      // Build a human-readable compound label
      const dayLabel = baseType.includes('café') || baseType.includes('cafe') ? 'café'
        : baseType.includes('bakeri') || baseType.includes('bageri') ? 'bageri'
        : baseType.includes('restaurant') ? 'restaurant'
        : 'dagscafé'
      const nightLabel = programmes.some(p => /cocktail/i.test(p)) || catLabels.some(c => /cocktail/i.test(c))
        ? 'cocktailbar'
        : programmes.some(p => /vinbar|vin/i.test(p)) || catLabels.some(c => /vinbar/i.test(c))
          ? 'vinbar'
          : 'bar/aftenssted'

      return `${dayLabel} + ${nightLabel} (dag + sen aftendrift)`
    })()
    if (hybridTypeHint) {
      console.log(`[${requestId}] 🔀 Hybrid venue detected: ${hybridTypeHint}`)
    }

    // Naming style classification — done in TypeScript to avoid asking AI to infer what we can compute
    const namingStyleHint: string = (() => {
      const names = menuItemsRaw.slice(0, 15).map((m: any) => m?.name ?? '').filter(Boolean) as string[]
      if (names.length === 0) return 'ikke tilgængeligt'
      const avgWords = names.reduce((s: number, n: string) => s + n.split(/\s+/).length, 0) / names.length
      const englishCount = names.filter((n: string) => /\b(the|with|and|of|fresh|classic|house|special|style)\b/i.test(n)).length
      const hasAdjectives = names.filter((n: string) => /\b(frisk|røget|grillet|sprød|hjemmelavet|classic|crispy|creamy)\b/i.test(n)).length > 1
      const style = englishCount > names.length * 0.3 ? 'engelske termer' : 'rent dansk'
      const length = avgWords < 2 ? 'kortfattet' : avgWords < 3.5 ? 'mellemlænge' : 'beskrivende'
      const adjNote = hasAdjectives ? ' med adjektiver' : ' uden adjektiver'
      return `${length} + ${style}${adjNote}`
    })()

    // Day-arc: programme names from menu_signal (e.g. ["Brunch", "Frokost", "Aften", "Cocktails"])
    const dayArcProgrammes: string[] = (dataSources.menuSignalProgrammes as any[] | null)
      ?.map((p: any) => p?.role ?? p?.name ?? '').filter(Boolean) ?? []

    // Audience profile — score-gated + price-validated via shared audience-filter utility.
    // Single source of truth: same logic as prompt-b.ts and the Location UI.
    const categoryScoresRaw: Record<string, number> =
      (dataSources.locationIntelligenceRow as any)?.category_scores ?? {}
    const { audienceProfileString: audienceProfile } = filterAudienceLabels(
      categoryScoresRaw,
      prices.length ? Math.max(...prices) : null
    )

    const secondarySignals: SecondarySignals = {
      priceRange: {
        min: prices.length ? Math.min(...prices) : null,
        max: prices.length ? Math.max(...prices) : null
      },
      hasKidsMenu: menuItemsRaw.some((m: any) =>
        typeof (m?.category ?? '') === 'string' && (m.category ?? '').toLowerCase().includes('børn') ||
        typeof (m?.name ?? '') === 'string' && (m.name ?? '').toLowerCase().includes('børn')
      ),
      categoryLabels: [...new Set(
        menuItemsRaw.map((m: any) => m?.category).filter((c: any) => typeof c === 'string' && c.trim().length > 0)
      )].slice(0, 8) as string[],
      menuNamingSample: menuItemsRaw.slice(0, 12)
        .map((m: any) => m?.name ?? m?.item_name ?? '')
        .filter(Boolean) as string[],
      namingStyleHint,
      secondaryTextFragments,
      websiteRegisterHint: (() => {
        const wc = websiteTextForVoice.trim().split(/\s+/).filter(Boolean).length
        if (wc < 30) return 'minimal — hjemsiden bruger primært billeder og korte labels'
        if (wc < 200) return 'kortfattet og funktionel — få sætninger, faktabaseret'
        return 'moderat detaljeret — har beskrivende tekst'
      })(),
      dayArcProgrammes,
      audienceProfile,
      openingHoursHint,
      acceptsReservations,
      hybridTypeHint,
      locationIntelligence: locationIntelligence ?? null
    }

    // Inject content_anchors into tone_model — deterministic, not AI-generated.
    // Derived from dayArcProgrammes (brunch/frokost/aften/cocktails etc.) +
    // menu category labels, so the owner sees WHAT they actually sell, not just
    // differentiator adjectives from primary_keywords.
    if (brandProfile.tone_model) {
      const contentAnchors: string[] = [
        ...secondarySignals.dayArcProgrammes,
        ...secondarySignals.categoryLabels.slice(0, 5)
      ]
        .filter(Boolean)
        .reduce<string[]>((acc, s) => {
          const norm = s.trim()
          if (norm && !acc.some(x => x.toLowerCase() === norm.toLowerCase())) acc.push(norm)
          return acc
        }, [])
        .slice(0, 10)
      ;(brandProfile.tone_model as any).content_anchors = contentAnchors
      console.log(`[${requestId}] 📌 content_anchors injected:`, contentAnchors.join(', '))
    }

    // ── INFER BUSINESS ARCHETYPE ─────────────────────────────────────────────
    // Auto-detect business archetype from operational characteristics.
    // This provides a validated, persistent classification that prevents 
    // week-to-week inconsistency in content strategy.
    // ──────────────────────────────────────────────────────────────────────────
    
    const businessArchetype = (() => {
      // Extract service periods from dayArcProgrammes
      const servicePeriods = secondarySignals.dayArcProgrammes
        .filter(Boolean)
        .map((p: string) => {
          const pLower = p.toLowerCase()
          if (/brunch/i.test(pLower)) return 'brunch'
          if (/frokost|lunch/i.test(pLower)) return 'lunch'
          if (/middag|dinner|aften/i.test(pLower)) return 'dinner'
          if (/morgen|breakfast/i.test(pLower)) return 'morning'
          return null
        })
        .filter(Boolean) as string[]
      
      // Detect late-night closing (after 1am)
      const openingHoursRows = dataSources.openingHoursRows ?? []
      const lateNightClosing = openingHoursRows.some((r: any) => {
        const close = String(r?.close_time ?? '').substring(0, 5)
        if (!close || !close.includes(':')) return false
        const [h, m] = close.split(':').map(Number)
        return h >= 1 && h < 6 // Between 1am and 6am = late-night
      })
      
      // Compute earliest/latest hours for opening_hours field
      const openingHours = (() => {
        if (openingHoursRows.length === 0) return undefined
        const opens = openingHoursRows
          .map((r: any) => String(r?.open_time ?? '').substring(0, 5))
          .filter(t => t && t.includes(':'))
        const closes = openingHoursRows
          .map((r: any) => String(r?.close_time ?? '').substring(0, 5))
          .filter(t => t && t.includes(':'))
        
        return {
          earliest_open: opens.length > 0 
            ? opens.reduce((a, b) => a < b ? a : b) 
            : undefined,
          latest_close: closes.length > 0 
            ? closes.reduce((a, b) => a > b ? a : b) 
            : undefined
        }
      })()
      
      // Get business_character from brandProfile
      const businessCharacter: string = typeof brandProfile?.business_character === 'object'
        ? (brandProfile.business_character?.value ?? '')
        : (brandProfile?.business_character ?? '')
      
      // Infer archetype
      const archetype = inferBusinessArchetype({
        service_periods: servicePeriods,
        late_night_closing: lateNightClosing,
        business_character: businessCharacter,
        opening_hours: openingHours
      })
      
      console.log(`[${requestId}] 🏛️ Business archetype inferred: ${archetype} (${getArchetypeDescription(archetype)})`)
      console.log(`[${requestId}] 🔍 Archetype inputs:`, {
        service_periods: servicePeriods,
        late_night_closing: lateNightClosing,
        opening_hours: openingHours
      })
      
      return archetype
    })()
    
    // Add archetype to brandProfile for database save
    ;(brandProfile as any).business_archetype = businessArchetype

    // ── STAGE B1 REMOVED (Sprint 1 - Complexity Reduction) ──────────────────
    // Voice archetype generation removed: ~15s saved, 2 columns removed.
    // Owner gets ONE voice (opinionated, not optional). If unsatisfied, they
    // regenerate or manually edit. No choice paralysis.
    // ──────────────────────────────────────────────────────────────────────────


    try {
      await saveBrandProfile(
        supabaseClient,
        businessId,
        brandProfile,
        qualityStatus,
        requestErrors.toJSON().errors,  // Extract errors array from toJSON() result
        versionHash,  // Add version hash
        locationIntelligence,  // Deterministic location intelligence
        null,  // voice_options removed (Sprint 1)
        null,  // voice_archetype removed (Sprint 1)
        b0Classification  // Stage B0 classification (business model type, copy hook, audience breadth)
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
          versionHash,
          locationIntelligence,
          voiceOptions,
          voiceArchetype,
          b0Classification  // Stage B0 classification
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

    // Stage B5 — Audience Segment Intelligence (non-blocking, non-fatal)
    // Generates 3-6 named segments with timing windows + content angles + metadata.
    // Saved to audience_segments JSONB column — consumed by get-quick-suggestions + owner UI.
    console.log(`[${requestId}] 🧩 Stage B5: starting audience segment synthesis...`)
    try {
      const audienceSegments = await segmentAudience(
        Deno.env.get('OPENAI_API_KEY')!,
        brandProfile,
        secondarySignals,
        locationIntelligence,
        dataSources,
        null,  // ownerDocument not yet implemented
        language.code,
        requestId,
        b0Classification
      )
      
      // Sanitize banned words in B5 audience segments before save.
      // B5 runs after sanitizeBannedWords on the main profile, so it needs its own pass.
      if (audienceSegments) {
        const SEGMENT_BANNED = [
          'hyggelig', 'hyggeligt', 'hyggelige', 'lækker', 'lækkert', 'lækre',
          'omgivelser', 'autentisk', 'autentiske', 'unik', 'unikke', 'fantastisk'
        ]
        let sanitizedSegments = JSON.stringify(audienceSegments)
        SEGMENT_BANNED.forEach((word) => {
          const regex = new RegExp(`\\b${word}\\b`, 'gi')
          sanitizedSegments = sanitizedSegments.replace(regex, '')
        })
        const finalSegments = JSON.parse(sanitizedSegments)
        
        const { error: b5Err } = await supabaseClient
          .from('business_brand_profile')
          .update({ audience_segments: finalSegments })
          .eq('business_id', businessId)
        
        if (b5Err) {
          console.warn(`[${requestId}] ⚠️ Stage B5 save failed (non-fatal):`, b5Err.message)
        } else {
          console.log(`[${requestId}] ✅ Stage B5: saved ${finalSegments.segments?.length ?? 0} segments to audience_segments column`)
        }
      } else {
        console.log(`[${requestId}] ℹ️ Stage B5: no segments produced (insufficient data or AI failure)`)
      }
    } catch (b5Err) {
      console.warn(`[${requestId}] ⚠️ Stage B5 exception (non-fatal):`, String(b5Err))
    }

    // Stage CS (Commercial Strategy) — AI-Powered Commercial Strategy Analysis (non-blocking, non-fatal)
    // Analyzes business characteristics, menu, location, and operational capabilities
    // to recommend optimal commercial content strategy (baseline mode + trigger configuration).
    // Saved to commercial_baseline_mode, trigger_configuration, commercial_strategy_reasoning columns.
    console.log(`[${requestId}] 💰 Stage CS: starting commercial strategy analysis...`)
    try {
      const { analyzeCommercialStrategy } = await import('../_shared/brand-profile/commercial-strategy-analyzer.ts')
      
      const commercialStrategy = await analyzeCommercialStrategy(
        supabaseClient,
        businessId,
        Deno.env.get('OPENAI_API_KEY')!
      )
      
      const { error: csErr } = await supabaseClient
        .from('business_brand_profile')
        .update({
          commercial_baseline_mode: commercialStrategy.commercial_baseline_mode,
          trigger_configuration: commercialStrategy.trigger_configuration,
          commercial_strategy_reasoning: commercialStrategy.summary_text,
          trigger_updated_by: 'ai',
          trigger_updated_at: new Date().toISOString()
        })
        .eq('business_id', businessId)
      
      if (csErr) {
        console.warn(`[${requestId}] ⚠️ Stage CS save failed (non-fatal):`, csErr.message)
      } else {
        console.log(`[${requestId}] ✅ Stage CS: saved commercial strategy (mode=${commercialStrategy.commercial_baseline_mode}, confidence=${commercialStrategy.confidence_score})`)
        console.log(`[${requestId}] 💡 Stage CS: ${commercialStrategy.summary_text}`)
      }
    } catch (csErr) {
      console.warn(`[${requestId}] ⚠️ Stage CS exception (non-fatal):`, String(csErr))
    }

    // Stage PS — Posting Strategy + Busy Pattern (non-blocking, non-fatal)
    // AI determines optimal weekly day distribution based on booking model, revenue moments, and business type.
    // Also assesses typical busy/quiet patterns specific to this business.
    // Saved to posting_strategy + busy_pattern columns in business_brand_profile.
    console.log(`[${requestId}] 📅 Stage PS: generating posting strategy and busy pattern...`)
    try {
      const psOperations = dataSources.operations as any
      const psLocationIntel = dataSources.locationIntelligenceRow as any
      const psRevenueDrivers = brandProfile as any  // revenue_drivers not in brandProfile directly
      
      const bookingModelType = psOperations?.reservation_required === true && !psOperations?.accepts_walk_ins
        ? 'booking_only'
        : !psOperations?.reservation_required && psOperations?.accepts_walk_ins === true
          ? 'walk_in'
          : 'hybrid'

      const psBusinessName = (dataSources.business as any)?.name ?? ''
      const psEstablishmentType = psOperations?.establishment_type ?? (dataSources.business as any)?.vertical ?? 'restaurant'
      const psCityName = (dataSources.location as any)?.enrichment?.macro?.city ?? (dataSources.business as any)?.city ?? ''
      const psAreaType = psLocationIntel?.area_type ?? ''
      const psNeighborhood = psLocationIntel?.neighborhood ?? ''
      const psBusinessChar = typeof brandProfile.business_character === 'string'
        ? brandProfile.business_character.slice(0, 200)
        : ((brandProfile.business_character as any)?.value ?? '').slice(0, 200)

      const psPrompt = `You are a hospitality social media strategy expert. Based on the business profile below, generate the optimal weekly posting strategy and typical busy/quiet pattern.

BUSINESS:
- Name: ${psBusinessName}
- Type: ${psEstablishmentType}
- City: ${psCityName}${psNeighborhood ? `, ${psNeighborhood}` : ''}${psAreaType ? ` (${psAreaType})` : ''}
- Booking model: ${bookingModelType === 'booking_only' ? 'Reservation required (no walk-ins)' : bookingModelType === 'walk_in' ? 'Walk-in only' : 'Hybrid (accepts both reservations and walk-ins)'}
- Character: ${psBusinessChar}

RULES:
- Use 3-letter English day abbreviations: Mon, Tue, Wed, Thu, Fri, Sat, Sun
- Timing format: "Day-Day HH:MM" or "Day HH:MM" (24-hour)
- booking_only: front-load to Sun-Tue (planners need days to decide). walk_in: back-load to Thu-Sat (impulse capture). hybrid: Thu-Fri conversion window + Mon brand builder.
- busy/quiet pattern must reflect THIS specific business type and location — not generic hospitality.

Respond ONLY with JSON (no markdown):
{
  "posting_strategy": {
    "booking_model_type": "${bookingModelType}",
    "slot_windows": {
      "footfall_primary": "Day-Day HH:MM",
      "footfall_secondary": "Day-Day HH:MM",
      "brand_builder": "Day HH:MM",
      "loyalty": "Day-Day HH:MM"
    },
    "cta_emphasis": "walk_in",
    "rationale": "2-3 sentences explaining why these windows fit this specific business"
  },
  "busy_pattern": {
    "weekly_pattern": {
      "busiest_days": ["Fri", "Sat"],
      "quietest_days": ["Mon", "Tue"]
    },
    "seasonal_peaks": ["Jun", "Jul", "Aug"],
    "seasonal_valleys": ["Jan", "Feb"],
    "monthly_pattern": "first_weekend_busiest",
    "holiday_impact": "high",
    "rationale": "2-3 sentences explaining this specific business's busy/quiet patterns"
  }
}`

      const psResponse = await fetchOpenAIWithRetry(
        Deno.env.get('OPENAI_API_KEY')!,
        {
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a social media strategy expert for hospitality businesses. Output ONLY valid JSON with no markdown.' },
            { role: 'user', content: psPrompt }
          ],
          temperature: 0.2,
          max_tokens: 600,
          response_format: { type: 'json_object' }
        },
        requestId,
        'Stage PS (Posting Strategy)',
        { timeout: 15000, maxRetries: 1, retryDelayMs: 1000, retryStatusCodes: [429, 500, 502, 503, 504] }
      )

      const psRaw = psResponse.choices[0]?.message?.content
      if (!psRaw) throw new Error('Stage PS: no response')
      const psParsed = JSON.parse(psRaw)

      // Build content_strategy from posting_strategy + busy_pattern
      // This provides the baseline content distribution that strategy-modulator.ts expects
      const ps = psParsed.posting_strategy
      const bp = psParsed.busy_pattern
      
      // Derive goal_blend from business_programme_profiles (if available)
      // This is a BASELINE that the weekly modulator can deviate from based on context.
      // Over time, posts should trend toward this mix, but individual weeks can vary.
      let goal_blend = { drive_footfall: 50, build_brand: 30, retain_loyalty: 20 }  // default fallback
      let goal_blend_source = 'default'
      
      try {
        const { data: programmes } = await supabaseClient
          .from('business_programme_profiles')
          .select('programme_type, baseline_goal_split')
          .eq('business_id', businessId)
        
        if (programmes && programmes.length > 0) {
          // Aggregate baseline_goal_split from all programmes
          const agg = programmes.reduce((acc, p) => {
            const split = p.baseline_goal_split || {}
            acc.drive_footfall += split.drive_footfall || 0
            acc.strengthen_brand += split.strengthen_brand || 0  // V5 field name
            acc.retain_regulars += split.retain_regulars || 0    // V5 field name
            return acc
          }, { drive_footfall: 0, strengthen_brand: 0, retain_regulars: 0 })
          
          const total = agg.drive_footfall + agg.strengthen_brand + agg.retain_regulars
          
          if (total > 0) {
            // Normalize to 100% and rename to weekly plan taxonomy
            const normalized_total = agg.drive_footfall + agg.strengthen_brand + agg.retain_regulars
            goal_blend = {
              drive_footfall: Math.round((agg.drive_footfall / normalized_total) * 100),
              build_brand: Math.round((agg.strengthen_brand / normalized_total) * 100),      // RENAME from strengthen_brand
              retain_loyalty: Math.round((agg.retain_regulars / normalized_total) * 100)     // RENAME from retain_regulars
            }
            goal_blend_source = `${programmes.length} programmes`
            console.log(`[${requestId}] Stage PS: goal_blend from programmes: ${JSON.stringify(goal_blend)} (${programmes.map(p => p.programme_type).join(', ')})`)
          } else {
            console.warn(`[${requestId}] Stage PS: programmes exist but baseline_goal_split totals 0 — using booking_model fallback`)
          }
        }
      } catch (progErr) {
        console.warn(`[${requestId}] Stage PS: failed to query programmes (non-fatal):`, String(progErr))
      }
      
      // Fallback to booking_model_type template if no programmes or query failed
      if (goal_blend_source === 'default') {
        if (ps?.booking_model_type === 'booking_only') {
          // Booking-only: customers already decided → focus on brand + loyalty
          goal_blend = { drive_footfall: 30, build_brand: 45, retain_loyalty: 25 }
          goal_blend_source = 'booking_only template'
        } else if (ps?.booking_model_type === 'walk_in') {
          // Walk-in: need to capture impulse → focus on footfall
          goal_blend = { drive_footfall: 55, build_brand: 25, retain_loyalty: 20 }
          goal_blend_source = 'walk_in template'
        } else {
          goal_blend_source = 'hybrid template'
        }
        console.log(`[${requestId}] Stage PS: No valid programmes — using ${goal_blend_source}`)
      }

      // Derive content_category_weights from establishment type
      const isBarOriented = psEstablishmentType.toLowerCase().includes('bar') || psEstablishmentType.toLowerCase().includes('cocktail')
      const content_category_weights = isBarOriented
        ? { product_menu: 30, craving_visual: 35, behind_scenes: 20, team_people: 15 }  // Visual-heavy for bars
        : { product_menu: 35, craving_visual: 25, behind_scenes: 25, team_people: 15 }  // Balanced for restaurants

      const content_strategy = {
        goal_blend,
        posting_windows: ps?.slot_windows ?? null,
        booking_model_type: ps?.booking_model_type ?? 'hybrid',
        cta_emphasis: ps?.cta_emphasis ?? 'walk_in',
        content_category_weights,
        weekly_focus: {
          busiest_days: bp?.weekly_pattern?.busiest_days ?? ['Fri', 'Sat'],
          quietest_days: bp?.weekly_pattern?.quietest_days ?? ['Mon', 'Tue'],
          monthly_pattern: bp?.monthly_pattern ?? 'even'
        }
      }

      const { error: psErr } = await supabaseClient
        .from('business_brand_profile')
        .update({
          posting_strategy: ps ?? null,
          busy_pattern: bp ?? null,
          content_strategy: content_strategy  // ADD: write content_strategy alongside posting_strategy
        })
        .eq('business_id', businessId)

      if (psErr) {
        console.warn(`[${requestId}] ⚠️ Stage PS save failed (non-fatal — columns may not exist yet):`, psErr.message)
      } else {
        const bmt = ps?.booking_model_type ?? 'unknown'
        const footfall = ps?.slot_windows?.footfall_primary ?? '?'
        console.log(`[${requestId}] ✅ Stage PS: saved posting_strategy (${bmt}, footfall=${footfall}) + busy_pattern + content_strategy`)
        console.log(`[${requestId}] 📊 content_strategy baseline: ${JSON.stringify(goal_blend)} (source: ${goal_blend_source})`)
        console.log(`[${requestId}] 📊 content_category_weights: ${JSON.stringify(content_category_weights)}`)
        console.log(`[${requestId}] 💡 This is a baseline — weekly modulator can adjust based on context (weather, events, drift)`)
      }
    } catch (psErr) {
      console.warn(`[${requestId}] ⚠️ Stage PS exception (non-fatal):`, String(psErr))
    }

    // Stage RD — Revenue Drivers Analysis (non-blocking, non-fatal)
    // AI-powered revenue moment extraction from programmes or business description.
    // Analyzes service types, decision windows, and optimal posting timing.
    // Saved to revenue_drivers JSONB column — consumed by get-weekly-strategy BusinessRulesEngine.
    console.log(`[${requestId}] 🎯 Stage RD: analyzing revenue drivers...`)
    try {
      const rdResponse = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/analyze-revenue-drivers`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
          },
          body: JSON.stringify({
            business_id: businessId,
            force_refresh: true  // Always regenerate when brand profile is regenerated
          })
        }
      )
      
      if (!rdResponse.ok) {
        const rdErrorText = await rdResponse.text()
        console.warn(`[${requestId}] ⚠️ Stage RD: HTTP ${rdResponse.status} - ${rdErrorText}`)
      } else {
        const rdData = await rdResponse.json()
        
        if (rdData.success) {
          const rdMethod = rdData.analysis_method || 'unknown'
          const rdPrimary = rdData.revenue_drivers?.primary_revenue_moment?.service_type || 'none'
          const rdSecondaryCount = rdData.revenue_drivers?.secondary_revenue_moments?.length || 0
          const rdPreferredDays = rdData.revenue_drivers?.preferred_day_pattern?.join(', ') || 'none'
          
          console.log(`[${requestId}] ✅ Stage RD: revenue drivers analyzed via ${rdMethod}`)
          console.log(`[${requestId}] 🎯 Stage RD: primary=${rdPrimary}, secondary=${rdSecondaryCount}, preferred_days=[${rdPreferredDays}]`)
        } else {
          console.warn(`[${requestId}] ⚠️ Stage RD: analysis failed - ${rdData.error || 'unknown error'}`)
        }
      }
    } catch (rdErr) {
      console.warn(`[${requestId}] ⚠️ Stage RD exception (non-fatal):`, String(rdErr))
    }

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
    
    // Compute response qualityStatus from final validation results (not internal error tracking)
    // green = no validation issues; yellow = soft issues only; red = hard errors
    const responseQualityStatus: 'green' | 'yellow' | 'red' =
      finalHardErrors.length > 0 ? 'red'
      : finalSoftErrors.length === 0 ? 'green'
      : 'yellow'
    
    const responseEnvelope = {
      ok: finalHardErrors.length === 0,
      qualityStatus: responseQualityStatus,
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
          menu_source: dataSources.menuSource || 'none',
          ui_prompt_da:
            (Boolean(analysis?.evidence?.distinctive_hooks_missing) || differentiation.hooksCount < 2)
              ? 'Tilføj 1–2 ting der gør jer unikke (fx kunst på væggen, ikon ved indgangen, udsigt, bar/cocktails, events). Så bliver jeres Brand Profil markant mere præcis.'
              : null
        },
        brandProfile: {
          brand_essence: brandProfile.brand_essence.value,
          tone_of_voice: brandProfile.tone_of_voice.value,
          tone_model: brandProfile.tone_model ?? null,
          things_to_avoid: brandProfile.things_to_avoid.value,
          things_to_avoid_jsonb: brandProfile.things_to_avoid.value,
          target_audience: brandProfile.target_audience.value,
          core_offerings: brandProfile.core_offerings.value,
          core_offerings_jsonb: brandProfile.core_offerings.value,  // Full derivation happens in DB save layer
          content_focus: brandProfile.content_focus.value,
          content_pillars: brandProfile.content_pillars.value,
          content_pillars_jsonb: brandProfile.content_pillars.value,
          cta_style: brandProfile.cta_style.value,
          communication_goal: brandProfile.communication_goal.value,
          image_preferences: brandProfile.image_preferences.value,
          image_preferences_jsonb: brandProfile.image_preferences.value,
          social_style: brandProfile.social_style.value,
          voice_examples: brandProfile.voice_examples.value,
          content_strategy: (brandProfile as any).content_strategy ?? null,
          location_intelligence: locationIntelligence ?? null,  // Deterministic — not AI-generated
          quality_status: qualityStatus ?? null,
          version_hash: versionHash ?? null,
          // V2 Brand Profile fields (Marts 2026)
          brand_essence_elaboration: brandProfile.brand_essence_elaboration?.value ?? null,
          identity_keywords: brandProfile.identity_keywords?.value ?? null,
          voice_constraints: brandProfile.voice_constraints?.value ?? null,
          voice_rationale: (brandProfile as any).voice_rationale ?? null,
          business_character: brandProfile.business_character ?? null,  // v4.12.1: Plain-text business descriptor
          // voice_options: REMOVED (Sprint 1 - Complexity Reduction)
          // voice_archetype: REMOVED (Sprint 1 - Complexity Reduction)
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
    
    // Special handling for ReferenceError to help debug "language is not defined"
    if (err.name === 'ReferenceError') {
      console.error(`[${requestId}] ❌ ReferenceError after ${totalDuration}ms:`, err.message)
      console.error(`[${requestId}] 📚 Full stack trace:`, err.stack)
      console.error(`[${requestId}] 📍 Error occurred at ~${totalDuration}ms - likely before language initialization`)
    } else {
      console.error(`[${requestId}] ❌ Error after ${totalDuration}ms:`, err.message)
      console.error(`[${requestId}] 📚 Error stack:`, err.stack)
    }
    console.error(`[${requestId}] 📍 Error name:`, err.name)
    console.error(`[${requestId}] 📍 Error details:`, JSON.stringify(err, null, 2))
    
    // Release lock on error (businessId is in scope because body was parsed before the main try)
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
