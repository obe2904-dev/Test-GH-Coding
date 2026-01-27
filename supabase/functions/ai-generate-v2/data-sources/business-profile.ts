// Fetch business profile from Supabase
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { BusinessProfile } from '../types.ts'

export async function fetchBusinessProfile(
  userId: string,
  businessId?: string
): Promise<BusinessProfile | null> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log(`📊 Fetching business profile for user: ${userId}`)

    // Query businesses table with joined related data
    let query = supabase
      .from('businesses')
      .select(`
        id,
        name,
        vertical,
        website_url,
        primary_language,
        business_profile (
          short_description,
          long_description,
          price_level,
          target_audience
        ),
        business_brand_profile (
          tone_keywords,
          tone_model,
          voice_style,
          values,
          certifications,
          do_not_say
        ),
        business_locations (
          city,
          country,
          is_primary
        )
      `)
      .eq('owner_id', userId)

    if (businessId) {
      query = query.eq('id', businessId)
    }

    const { data, error } = await query.maybeSingle()

    if (error) {
      console.error('❌ Error fetching business profile:', error)
      return null
    }

    if (!data) {
      console.warn('⚠️ No business profile found')
      return null
    }

    // Flatten nested structure to match BusinessProfile interface
    const business = data as any
    const profile = business.business_profile || {}
    const brandProfile = business.business_brand_profile || {}
    const primaryLocation = business.business_locations?.find((loc: any) => loc.is_primary) || 
                           business.business_locations?.[0] || {}

    console.log(`✅ Business profile loaded: ${business.name}`)

    // Extract tone keywords from tone_model (preferred) or fallback to legacy tone_keywords
    const toneKeywords = brandProfile.tone_model?.primary_keywords || 
                        brandProfile.tone_keywords || 
                        []

    return {
      id: business.id,
      user_id: userId,
      business_name: business.name,
      primary_language: business.primary_language || 'da',
      country: primaryLocation.country || 'Denmark',
      city: primaryLocation.city || '',
      brand_voice: {
        tone: toneKeywords,
        essence: brandProfile.voice_style || '',
        style_notes: brandProfile.values?.join(', ') || ''
      },
      business_offerings: profile.short_description || '',
      content_pillars: brandProfile.values || [],
      booking_url: business.website_url || '',
      forbidden_terms: brandProfile.do_not_say?.words || [],
      required_tone_anchors: []
    }

  } catch (error) {
    console.error('❌ Exception fetching business profile:', error)
    return null
  }
}

export function formatBusinessProfileForPrompt(profile: BusinessProfile): string {
  const sections: string[] = []

  sections.push(`=== BUSINESS INFORMATION ===`)
  sections.push(`Business Name: ${profile.business_name}`)
  sections.push(`Language: ${profile.primary_language}`)
  if (profile.city) sections.push(`Location: ${profile.city}${profile.country ? ', ' + profile.country : ''}`)

  if (profile.brand_voice) {
    sections.push(`\n=== BRAND VOICE ===`)
    if (profile.brand_voice.essence) {
      sections.push(`Essence: ${profile.brand_voice.essence}`)
    }
    // Note: Tone and style defined in BRAND POLICY section below
    if (profile.brand_voice.tone && profile.brand_voice.tone.length > 0) {
      sections.push(`(See tone requirements in BRAND POLICY below)`)
    }
  }

  if (profile.business_offerings) {
    sections.push(`\n=== OFFERINGS ===`)
    sections.push(profile.business_offerings)
  }

  if (profile.content_pillars && profile.content_pillars.length > 0) {
    sections.push(`\n=== CONTENT PILLARS ===`)
    sections.push(profile.content_pillars.join('\n'))
  }

  if (profile.required_tone_anchors && profile.required_tone_anchors.length > 0) {
    sections.push(`\n=== REQUIRED PHRASES ===`)
    sections.push(`Must include at least one: ${profile.required_tone_anchors.join(', ')}`)
  }

  if (profile.forbidden_terms && profile.forbidden_terms.length > 0) {
    sections.push(`\n=== FORBIDDEN TERMS ===`)
    sections.push(`Never use: ${profile.forbidden_terms.join(', ')}`)
  }

  if (profile.booking_url) {
    sections.push(`\n=== BOOKING ===`)
    sections.push(`URL: ${profile.booking_url}`)
  }

  return sections.join('\n')
}
