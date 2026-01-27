// @ts-ignore - Deno import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - Deno ESM import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// @ts-ignore - Deno global
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/**
 * Fetch and extract text from a URL
 * Simple HTML text extraction without JavaScript rendering
 */
async function fetchMenuFromUrl(url: string): Promise<string> {
  console.log(`🌐 Fetching URL: ${url}`)
  
  // Basic URL validation
  try {
    new URL(url)
  } catch {
    throw new Error('Invalid URL format')
  }

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; MenuBot/1.0)',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`)
  }

  const html = await response.text()
  console.log(`📄 Fetched ${html.length} characters of HTML`)

  // Simple text extraction: remove scripts, styles, and HTML tags
  let text = html
    // Remove script and style tags with their content
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // Remove HTML comments
    .replace(/<!--[\s\S]*?-->/g, '')
    // Remove HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Decode common HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim()

  if (!text || text.length < 50) {
    throw new Error('Could not extract meaningful text from URL')
  }

  console.log(`✅ Extracted ${text.length} characters of text`)
  return text
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('📥 Extract menu URL request received')

    // Verify JWT token
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      console.error('❌ Auth error:', authError)
      throw new Error('Unauthorized')
    }

    console.log('✅ Authenticated user:', user.id)

    const { url } = await req.json()

    if (!url || typeof url !== 'string') {
      throw new Error('URL is required')
    }

    // Fetch and extract text
    const extractedText = await fetchMenuFromUrl(url)

    console.log('✅ URL text extraction successful')

    return new Response(
      JSON.stringify({ 
        extractedText,
        url,
        extractedLength: extractedText.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error: any) {
    console.error('❌ Extract menu URL error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to extract text from URL',
        details: error.toString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
