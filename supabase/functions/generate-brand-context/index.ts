// @ts-ignore - Deno import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - Deno global
declare const Deno: any

/**
 * Generate Brand Context Edge Function
 * 
 * Creates a comprehensive AI brand context document for a business.
 * This context is used to enhance all AI-generated content (posts, captions, etc.)
 * 
 * Input: Business profile data (name, type, menu, location, etc.)
 * Output: Structured brand context prompt with tone, audience, guidelines
 * 
 * Cost: ~$0.10-0.15 per generation (GPT-4o)
 * Frequency: One-time or when profile significantly changes
 */

interface BusinessProfileData {
  businessName: string
  businessType: string | null
  businessSector: string | null
  description: string | null
  menuStructure: MenuCategory[] | null
  location: {
    address?: string
    city?: string
    country?: string
  }
  openingHours: Array<{
    weekday: string
    open_time: string
    close_time: string
  }> | null
  websiteUrl: string | null
}

interface MenuCategory {
  name: string
  timeRange: string | null
  items: string[]
}

interface BrandContextResponse {
  brandContext: string
  error?: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: any) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('❌ Missing authorization header')
      return new Response(
        JSON.stringify({ error: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    console.log('📥 Received brand context generation request')

    const { profileData } = body as { profileData: BusinessProfileData }

    if (!profileData?.businessName) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: businessName' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get OpenAI API key from environment
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      console.error('❌ Missing OPENAI_API_KEY')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('🤖 Generating brand context for:', profileData.businessName)

    const brandContext = await generateBrandContext(profileData, openaiApiKey)

    return new Response(
      JSON.stringify({ brandContext }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function generateBrandContext(
  profile: BusinessProfileData,
  openaiApiKey: string
): Promise<string> {
  // Build context from available data
  const contextParts: string[] = []

  // Business basics
  contextParts.push(`Business Name: ${profile.businessName}`)
  
  if (profile.businessType) {
    contextParts.push(`Business Type: ${profile.businessType}`)
  }
  
  if (profile.businessSector) {
    contextParts.push(`Business Sector: ${profile.businessSector}`)
  }

  // Description
  if (profile.description) {
    contextParts.push(`\nBusiness Description:\n${profile.description}`)
  }

  // Location context
  if (profile.location.city || profile.location.address) {
    contextParts.push('\nLocation:')
    if (profile.location.address) contextParts.push(`Address: ${profile.location.address}`)
    if (profile.location.city) contextParts.push(`City: ${profile.location.city}`)
    if (profile.location.country) contextParts.push(`Country: ${profile.location.country}`)
  }

  // Opening hours
  if (profile.openingHours && profile.openingHours.length > 0) {
    contextParts.push('\nOpening Hours:')
    profile.openingHours.forEach(day => {
      contextParts.push(`${day.weekday}: ${day.open_time} - ${day.close_time}`)
    })
  }

  // Menu structure
  if (profile.menuStructure && profile.menuStructure.length > 0) {
    contextParts.push('\nMenu Categories:')
    profile.menuStructure.forEach(category => {
      const timeInfo = category.timeRange ? ` (${category.timeRange})` : ''
      contextParts.push(`- ${category.name}${timeInfo}: ${category.items.slice(0, 5).join(', ')}${category.items.length > 5 ? ', ...' : ''}`)
    })
  }

  // Website
  if (profile.websiteUrl) {
    contextParts.push(`\nWebsite: ${profile.websiteUrl}`)
  }

  const businessContext = contextParts.join('\n')

  // Generate comprehensive brand context using GPT-4o
  const prompt = `You are an expert brand strategist and social media consultant. 

Based on the following business information, create a comprehensive AI Brand Context document that will be used to guide all social media content creation for this business.

IMPORTANT: Write the entire response in Danish language.

The brand context should include these 10 sections:
1. Brand Essence (core identity in 1-2 sentences)
2. Tone of Voice (specific, actionable guidelines)
3. Target Audience (detailed description)
4. Menu/Service Highlights (key offerings to feature)
5. Content Focus (what to emphasize in posts)
6. Image Preferences (visual style guidance)
7. Things to Avoid (anti-patterns, wrong tone)
8. Location Context (if relevant)
9. Opening Hours Summary
10. Overall Goal (what makes content recognizable as this brand)

Business Information:
${businessContext}

Format the output as a clear, structured document using markdown headings:
### 1. Brand Essence
### 2. Tone of Voice
### 3. Target Audience
(and so on...)

Start with:
"📌 AI Brand Context: [Business Name]"

Be specific and actionable. Avoid generic advice. The tone should match the business type:
- Casual cafés: Warm, conversational, local
- Fine dining: Sophisticated, descriptive, elevated
- Beauty salons: Personal, caring, transformative
- Wellness: Calm, supportive, mindful

Remember: Write everything in Danish. Make it feel authentic to THIS specific business, not a template.`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert brand strategist who creates comprehensive, actionable brand guidelines for small businesses. You write clear, specific guidance in Danish that enhances AI-generated social media content. Always respond in Danish language.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7, // Slightly creative but consistent
        max_tokens: 2000 // Comprehensive document
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ OpenAI API error:', response.status, errorText)
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    const brandContext = data.choices[0].message.content.trim()

    console.log('✅ Brand context generated:', brandContext.length, 'characters')
    
    return brandContext

  } catch (error) {
    console.error('❌ Failed to generate brand context:', error)
    throw error
  }
}
