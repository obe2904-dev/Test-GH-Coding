import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  businessId: string
  websiteUrl: string
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    const { businessId, websiteUrl }: RequestBody = await req.json()

    if (!businessId || !websiteUrl) {
      throw new Error('Missing businessId or websiteUrl')
    }

    // Verify user owns this business
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id, user_id')
      .eq('id', businessId)
      .single()

    if (businessError || !business) {
      throw new Error('Business not found')
    }

    if (business.user_id !== user.id) {
      throw new Error('Not authorized for this business')
    }

    // Check if there's already a pending job
    const { data: existingJob } = await supabase
      .from('website_analysis_jobs')
      .select('id, status')
      .eq('business_id', businessId)
      .in('status', ['queued', 'processing'])
      .maybeSingle()

    if (existingJob) {
      return new Response(
        JSON.stringify({
          jobId: existingJob.id,
          status: existingJob.status,
          message: 'Analysis already in progress'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    // Create new analysis job
    const { data: job, error: jobError } = await supabase
      .from('website_analysis_jobs')
      .insert({
        business_id: businessId,
        website_url: websiteUrl,
        status: 'queued'
      })
      .select()
      .single()

    if (jobError) {
      throw jobError
    }

    console.log(`Website analysis queued: ${job.id} for business ${businessId}`)

    return new Response(
      JSON.stringify({
        jobId: job.id,
        status: 'queued',
        message: 'Website analysis started'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error:', errorMessage)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: errorMessage === 'Unauthorized' ? 401 : 400
      }
    )
  }
})
