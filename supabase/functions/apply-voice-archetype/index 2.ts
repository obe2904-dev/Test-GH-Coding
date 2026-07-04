/**
 * Apply Voice Archetype
 * 
 * Switches the active voice archetype for a business.
 * Reads the stored voice_options (from last brand-profile generation),
 * copies the chosen archetype's tone data to the live brand profile fields,
 * and updates voice_archetype to the new key.
 * 
 * NO new AI call — all data is already stored in voice_options.
 * 
 * POST { businessId: string, archetype: string }
 * → { success: true, archetype: string }
 */

// @ts-ignore
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore
import { createClient } from 'npm:@supabase/supabase-js@2.39.0'

declare const Deno: { env: { get(k: string): string | undefined } }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    const { businessId, archetype } = body

    if (!businessId || !archetype) {
      return new Response(
        JSON.stringify({ error: 'businessId and archetype are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── 1. Fetch stored voice_options ──────────────────────────────────────
    const { data: row, error: fetchError } = await supabase
      .from('business_brand_profile')
      .select('voice_options, voice_archetype')
      .eq('business_id', businessId)
      .maybeSingle()

    if (fetchError) {
      console.error('[apply-voice-archetype] DB fetch error:', fetchError.message)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch voice options', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const voiceOptions = row?.voice_options as any
    if (!voiceOptions?.options?.[archetype]) {
      return new Response(
        JSON.stringify({ error: `Voice option '${archetype}' not found in stored voice_options. Valid keys: ${Object.keys(voiceOptions?.options ?? {}).join(', ')}. Regenerate the brand profile if needed.` }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const option = voiceOptions.options[archetype] as any

    // ── 2. Reconstruct tone_of_voice.value from archetype data ─────────────
    // Build in the standard STEMME-MEKANIK / STEMME-IDENTITET format so the
    // caption generator receives the same structured text it expects.
    const writingRules: string[] = option.tone_model?.writing_rules ?? []
    const goodExamples: string[] = option.tone_model?.good_examples ?? []
    const examplePosts: string[] = option.example_posts ?? []

    // Use first 3 writing rules for STEMME-MEKANIK
    const mekanikLines = writingRules.slice(0, 3).map((r: string) => `- ${r}`)
    // Use remaining + any voice_constraints for STEMME-IDENTITET
    const identitetLines = writingRules.slice(3).map((r: string) => `- ${r}`)
    if (option.voice_constraints) identitetLines.push(`- ${option.voice_constraints}`)

    // Use good_examples or first example_post as Eksempel lines
    const eksempelSources = goodExamples.length > 0 ? goodExamples.slice(0, 2) : examplePosts.slice(0, 2)
    const eksempelLines = eksempelSources.map((ex: string) => `Eksempel: "${ex}"`)

    const newToneOfVoiceValue = [
      'STEMME-MEKANIK:',
      ...mekanikLines,
      ...(identitetLines.length > 0 ? ['STEMME-IDENTITET:', ...identitetLines] : []),
      ...eksempelLines
    ].join('\n')

    // ── 3. Prepare new live field values ──────────────────────────────────
    const newToneModel = option.tone_model
      ? {
          ...option.tone_model,
          version: '2.0' as const,
          language: 'da',
          generated_at: new Date().toISOString(),
          source: 'website' as const,
        }
      : null

    const newThingsToAvoid = option.things_to_avoid ?? null
    const newVoiceConstraints = option.voice_constraints ?? null

    // typical_openings: prefer example_posts (bespoke social examples); fall back to good_examples
    const newTypicalOpenings = examplePosts.length > 0 ? examplePosts.slice(0, 3) : goodExamples.slice(0, 3)

    // voice_rationale: copy from the selected option so it reflects the active choice
    const newVoiceRationale: string | null = option.voice_rationale ?? null

    // content_strategy: copy anchors from the selected option so caption generator and
    // weekly strategy can use the guest-moment phrases (Brunch ved åen etc.)
    const newContentStrategy = option.content_strategy ?? null

    // ── 4. Write to DB ─────────────────────────────────────────────────────
    const updatePayload: any = {
      voice_archetype: archetype,
      tone_of_voice: newToneOfVoiceValue,
      tone_model: newToneModel,
      typical_openings: newTypicalOpenings,
      updated_at: new Date().toISOString(),
    }

    if (newVoiceRationale !== null) {
      updatePayload.voice_rationale = newVoiceRationale
    }

    if (newThingsToAvoid !== null) {
      updatePayload.things_to_avoid = JSON.stringify(newThingsToAvoid)
      updatePayload.things_to_avoid_jsonb = newThingsToAvoid
    }

    if (newVoiceConstraints !== null) {
      updatePayload.voice_constraints = newVoiceConstraints
    }

    if (newContentStrategy !== null) {
      updatePayload.content_strategy = newContentStrategy
    }

    const { error: updateError } = await supabase
      .from('business_brand_profile')
      .update(updatePayload)
      .eq('business_id', businessId)

    if (updateError) {
      console.error('[apply-voice-archetype] DB update error:', updateError.message)
      return new Response(
        JSON.stringify({ error: 'Failed to update brand profile', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[apply-voice-archetype] ✅ Applied archetype '${archetype}' for business ${businessId}`)

    return new Response(
      JSON.stringify({
        success: true,
        archetype,
        previous_archetype: row?.voice_archetype ?? null,
        label: option.label ?? archetype,
        tagline: option.tagline ?? '',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    console.error('[apply-voice-archetype] Unexpected error:', err?.message ?? err)
    return new Response(
      JSON.stringify({ error: err?.message ?? 'Unexpected error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
