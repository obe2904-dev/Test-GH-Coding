import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * regenerate-caption: Regenerates a single post caption using the FULL AI prompt system.
 *
 * This function delegates to generate-text-from-idea (which uses buildWeeklyPlanPrompt)
 * rather than the weaker plan-post-prompt system. This ensures regeneration gets:
 *   - UGEPLANKONTEKST weekly frame
 *   - goal_mode directive (drive_footfall / build_brand / retain_loyalty)
 *   - faktaforbud (no hallucinated facts)
 *   - sensory rules and dish description rules
 *   - full brand voice and tone-of-voice profile
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validate user auth via anon client + JWT
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const { post, businessId, strategicContext } = await req.json()
    if (!post || !businessId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: post, businessId' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Build the WeeklyPlanSuggestion payload that generate-text-from-idea expects.
    // Notes on payload shape:
    //   - Frontend sends a lightweight `post` (contentType, subject, platform, format, timing)
    //   - `strategicContext` is a separate top-level field: { cta_intent, post_rationale }
    //   - `post.platformFormat` is NOT present — use flat `post.platform` / `post.format`
    const isMenuPost = ['menu_item', 'product_menu', 'craving_visual'].includes(post.contentType || '')
    const suggestion = {
      id: `regen-${Date.now()}`,
      title: post.subject || post.contentType || 'Indlæg',
      captionBase: '',
      source: 'weekly_plan',
      contentType: post.contentType,
      guestMoment: strategicContext?.post_rationale || undefined,
      timingDay: post.timing?.day || undefined,
      timingTime: post.timing?.time || undefined,
      selectionRationale: strategicContext?.post_rationale || undefined,
      goalMode: strategicContext?.goal_mode || undefined,
      ctaIntent: strategicContext?.cta_intent || undefined,
      platformFormat: post.format || undefined,
      menuItemName: isMenuPost ? post.subject : undefined,
      menuItemDescription: undefined,
    }

    // Call generate-text-from-idea using service role key for the Authorization header.
    // That function creates its own service-role Supabase client and does NOT use the incoming JWT,
    // so the service role key here serves only to satisfy Supabase's edge function auth layer.
    const gtiUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-text-from-idea`
    const gtiResponse = await fetch(gtiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        businessId,
        suggestion,
        platforms: [post.platform || 'instagram'],
        tier: 'smart', // Regeneration always uses the full-quality prompt
      }),
    })

    if (!gtiResponse.ok) {
      const errText = await gtiResponse.text()
      console.error('[regenerate-caption] generate-text-from-idea failed:', gtiResponse.status, errText)
      throw new Error(`Caption generation failed (${gtiResponse.status})`)
    }

    const gtiResult = await gtiResponse.json()

    // Map generate-text-from-idea response → legacy shape expected by PostDetailModal
    // PostDetailModal reads: data.caption.caption  and  data.caption.hashtags
    const platform = post.platform || 'instagram'
    const platformData = gtiResult[platform] || gtiResult.instagram || {}
    const captionText = platformData.text || gtiResult.sharedText || ''
    const hashtags: string[] = platformData.hashtags || []

    return new Response(
      JSON.stringify({
        success: true,
        caption: {
          caption: captionText,
          hashtags,
          tone: 'brand-consistent',
        },
        metadata: {
          model: 'gpt-4o',
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('[regenerate-caption] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
