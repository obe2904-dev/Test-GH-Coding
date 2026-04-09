/**
 * Database persistence layer for website analysis results
 * Saves extracted data to multiple tables: website_analyses, business_profile,
 * business_brand_profile, business_locations, opening_hours, business_operations
 */

import { formatToneAsText } from '../ai-extractors/tone-of-voice-extractor.ts'

export interface PersistenceResult {
  success: boolean
  updated?: boolean
  inserted?: boolean
  lastRunAt?: string
  error?: string
  note?: string
}

export interface SaveWebsiteAnalysisParams {
  businessId: string
  url: string
  analysisResult: any
  bookingUrl?: string | null
  menuExtraction?: any | null
  menuSignal?: any | null
  toneOfVoice?: any | null
  supabase: any
  authHeader?: string | null
}

/**
 * Save complete website analysis to database
 * 
 * Updates 6 tables:
 * 1. website_analyses - Raw analysis result
 * 2. business_profile - Short description, menu structure, booking URL, menu signal
 * 3. business_brand_profile - Tone of voice
 * 4. business_locations - Contact info (phone, email, address)
 * 5. opening_hours - Extracted hours
 * 6. business_operations - Establishment type classification
 */
export async function saveWebsiteAnalysis(
  params: SaveWebsiteAnalysisParams
): Promise<PersistenceResult> {
  const {
    businessId,
    url,
    analysisResult,
    bookingUrl,
    menuExtraction,
    menuSignal,
    toneOfVoice,
    supabase,
    authHeader
  } = params

  const result: PersistenceResult = { success: false }

  try {
    if (authHeader) {
      console.log('🔑 Persisting with provided auth header')
    } else {
      console.log('🔑 Persisting with service/anon key')
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 1. WEBSITE_ANALYSES - Store raw analysis result
    // ═══════════════════════════════════════════════════════════════════════════

    // Merge into existing raw_result to preserve other fields
    let mergedRawResult: Record<string, any> = {
      analysis: { ...analysisResult },
    }

    const { data: existingWA, error: existingWAError } = await supabase
      .from('website_analyses')
      .select('raw_result')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingWAError) {
      console.warn('⚠️ Could not read existing website_analyses.raw_result:', existingWAError.message)
    } else if (existingWA?.raw_result && typeof existingWA.raw_result === 'object') {
      const existingRawResult = existingWA.raw_result as Record<string, any>
      const existingAnalysis = (existingRawResult.analysis && typeof existingRawResult.analysis === 'object')
        ? (existingRawResult.analysis as Record<string, any>)
        : {}

      mergedRawResult = {
        ...existingRawResult,
        analysis: {
          ...existingAnalysis,
          ...analysisResult,
        },
      }
    }

    const runAt = new Date().toISOString()
    const websiteAnalysisUpdate = {
      source_url: url,
      status: 'success',
      last_run_at: runAt,
      raw_result: mergedRawResult,
    }
    result.lastRunAt = runAt

    const { data: updatedRows, error: waUpdateError } = await supabase
      .from('website_analyses')
      .update(websiteAnalysisUpdate)
      .eq('business_id', businessId)
      .select('id')

    if (waUpdateError) {
      console.warn('⚠️ Failed to update website_analyses:', waUpdateError.message)
      result.error = `update_failed: ${waUpdateError.message}`
    } else if (updatedRows && updatedRows.length > 0) {
      console.log('✅ Updated website_analyses')
      result.updated = true
    } else {
      // No existing row, insert new
      const { error: waInsertError } = await supabase
        .from('website_analyses')
        .insert({
          business_id: businessId,
          ...websiteAnalysisUpdate,
        })

      if (waInsertError) {
        console.warn('⚠️ Failed to insert website_analyses:', waInsertError.message)
        result.error = `insert_failed: ${waInsertError.message}`
      } else {
        console.log('✅ Inserted website_analyses')
        result.inserted = true
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. BUSINESS_PROFILE - Short description, menu, booking, menu signal
    // ═══════════════════════════════════════════════════════════════════════════

    const profileData: Record<string, any> = {
      business_id: businessId,
      updated_at: new Date().toISOString()
    }

    if (analysisResult.shortDescription) {
      profileData.short_description = analysisResult.shortDescription
    }

    if (menuExtraction?.menuStructure?.length > 0) {
      profileData.menu_structure = menuExtraction.menuStructure
    }

    if (bookingUrl) {
      profileData.booking_url = bookingUrl
      console.log('🎫 Saving booking URL to profile:', bookingUrl)
    }

    if (menuSignal) {
      profileData.menu_signal = menuSignal
      console.log('🍽️ Saving menu signal to profile (hasMenu:', menuSignal.hasMenu, ')')
    }

    const { error: bpError } = await supabase
      .from('business_profile')
      .upsert(profileData, { onConflict: 'business_id' })

    if (bpError) {
      console.warn('⚠️ Failed to save business_profile:', bpError.message)
    } else {
      console.log('✅ Saved to business_profile')
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. BUSINESS_BRAND_PROFILE - Tone of voice
    // ═══════════════════════════════════════════════════════════════════════════

    if (toneOfVoice && businessId) {
      const toneText = formatToneAsText(toneOfVoice)

      const { data: existingBrand } = await supabase
        .from('business_brand_profile')
        .select('id')
        .eq('business_id', businessId)
        .maybeSingle()

      if (existingBrand) {
        // Update existing
        const { error: toneError } = await supabase
          .from('business_brand_profile')
          .update({ tone_of_voice: toneText })
          .eq('business_id', businessId)

        if (toneError) {
          console.warn('⚠️ Failed to save tone_of_voice:', toneError.message)
        } else {
          console.log('✅ Saved tone_of_voice to business_brand_profile')
        }
      } else {
        // Insert new brand profile
        const { error: toneError } = await supabase
          .from('business_brand_profile')
          .insert({
            business_id: businessId,
            tone_of_voice: toneText
          })

        if (toneError) {
          console.warn('⚠️ Failed to create business_brand_profile:', toneError.message)
        } else {
          console.log('✅ Created business_brand_profile with tone_of_voice')
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 4. BUSINESS_LOCATIONS - Contact info
    // ═══════════════════════════════════════════════════════════════════════════

    if (analysisResult.contact) {
      const contact = analysisResult.contact
      const locationUpdateData: Record<string, any> = {}

      if (contact.phone) locationUpdateData.phone = contact.phone
      if (contact.email) locationUpdateData.email = contact.email

      if (contact.address) {
        if (typeof contact.address === 'string') {
          locationUpdateData.address_line1 = contact.address
        } else {
          if (contact.address.street) locationUpdateData.address_line1 = contact.address.street
          if (contact.address.city) locationUpdateData.city = contact.address.city
          if (contact.address.postalCode) locationUpdateData.postal_code = contact.address.postalCode
          if (contact.address.country) locationUpdateData.country = contact.address.country
        }
      }

      // Only update if we have some contact data
      if (Object.keys(locationUpdateData).length > 0) {
        const { data: existingLoc } = await supabase
          .from('business_locations')
          .select('id')
          .eq('business_id', businessId)
          .eq('is_primary', true)
          .maybeSingle()

        let locError
        if (existingLoc) {
          // Update existing primary location
          const updateResult = await supabase
            .from('business_locations')
            .update(locationUpdateData)
            .eq('business_id', businessId)
            .eq('is_primary', true)
          locError = updateResult.error
        } else {
          // Insert new primary location
          const insertResult = await supabase
            .from('business_locations')
            .insert({
              business_id: businessId,
              is_primary: true,
              country: 'Denmark',
              ...locationUpdateData
            })
          locError = insertResult.error
        }

        if (locError) {
          console.warn('⚠️ Failed to save business_locations:', locError.message)
        } else {
          console.log('✅ Saved to business_locations')
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 5. OPENING_HOURS - Extracted hours
    // ═══════════════════════════════════════════════════════════════════════════

    if (analysisResult.openingHours && Object.keys(analysisResult.openingHours).length > 0) {
      const hoursToInsert = Object.entries(analysisResult.openingHours).map(([day, hours]: [string, any]) => ({
        business_id: businessId,
        weekday: day.toLowerCase(),
        open_time: hours.closed ? null : hours.open,
        close_time: hours.closed ? null : hours.close,
        closed: hours.closed || false,
        kind: 'normal'
      }))

      // Delete existing hours first, then insert new ones
      await supabase.from('opening_hours').delete().eq('business_id', businessId)

      const { error: ohError } = await supabase
        .from('opening_hours')
        .insert(hoursToInsert)

      if (ohError) {
        console.warn('⚠️ Failed to save opening_hours:', ohError.message)
      } else {
        console.log('✅ Saved', hoursToInsert.length, 'opening_hours entries')
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 6. BUSINESS_OPERATIONS - Establishment type (FSE/SBO classification)
    // ═══════════════════════════════════════════════════════════════════════════

    if (analysisResult.establishmentType) {
      console.log('🏢 Saving establishment type:', analysisResult.establishmentType)
      const { error: opsError } = await supabase
        .from('business_operations')
        .upsert({
          business_id: businessId,
          establishment_type: analysisResult.establishmentType,
          updated_at: new Date().toISOString()
        }, { onConflict: 'business_id' })

      if (opsError) {
        console.warn('⚠️ Failed to save establishment_type:', opsError.message)
      } else {
        console.log('✅ Saved establishment_type to business_operations')
      }
    }

    result.success = true
    return result

  } catch (error) {
    console.error('❌ Database persistence failed:', error)
    result.error = error instanceof Error ? error.message : String(error)
    return result
  }
}
