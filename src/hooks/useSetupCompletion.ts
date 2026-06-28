import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export type CompletionState = 'none' | 'partial' | 'complete'

interface SetupCompletionStatus {
  profile: boolean
  profileState: CompletionState
  menu: boolean
  menuState: CompletionState
  location: boolean
  locationState: CompletionState
  brandProfile: boolean
  brandState: CompletionState
  loading: boolean
}

const hasText = (value: string | null | undefined) => !!value?.trim()

const hasAnyOpeningHours = (
  openingHours: Array<{ open_time: string | null; close_time: string | null }> | null | undefined
) => (openingHours ?? []).some((day) => hasText(day.open_time) && hasText(day.close_time))

export function useSetupCompletion() {
  const user = useAuthStore((state) => state.user)
  const [status, setStatus] = useState<SetupCompletionStatus>({
    profile: false,
    profileState: 'none',
    menu: false,
    menuState: 'none',
    location: false,
    locationState: 'none',
    brandProfile: false,
    brandState: 'none',
    loading: true
  })

  useEffect(() => {
    if (!user) {
      setStatus({ 
        profile: false, 
        profileState: 'none', 
        menu: false, 
        menuState: 'none',
        location: false, 
        locationState: 'none',
        brandProfile: false, 
        brandState: 'none',
        loading: false 
      })
      return
    }

    const checkCompletion = async () => {
      // Get user's business ID
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('id, name')
        .eq('owner_id', user.id)
        .single()

      if (businessError) {
        console.error('[useSetupCompletion] Error fetching business:', businessError)
      }

      if (!business) {
        console.log('[useSetupCompletion] No business found for user:', user.id)
        setStatus({ 
          profile: false, 
          profileState: 'none', 
          menu: false, 
          menuState: 'none',
          location: false, 
          locationState: 'none',
          brandProfile: false, 
          brandState: 'none',
          loading: false 
        })
        return
      }

      console.log('[useSetupCompletion] Checking completion for business:', business.id)

      // Check each completion status
      const [menuResults, brandProfile, locationIntelligence, businessProfile, businessLocation, openingHours] = await Promise.all([
        // Menu: Has successful extraction
        supabase
          .from('menu_results_v2')
          .select('id')
          .eq('business_id', business.id)
          .eq('status', 'done')
          .limit(1)
          .maybeSingle(),
        
        // Brand Profile: Check for V5 JSONB column (single source of truth)
        // Legacy flat columns may be deprecated or nulled
        supabase
          .from('business_brand_profile')
          .select('brand_profile_v5, business_identity_persona, marketing_manager_brief')
          .eq('business_id', business.id)
          .limit(1)
          .maybeSingle(),
        
        // Location: Check for actual data fields
        supabase
          .from('business_location_intelligence')
          .select('neighborhood, area_type, neighborhood_character, who_analysis, when_analysis, why_analysis')
          .eq('business_id', business.id)
          .limit(1)
          .maybeSingle(),

        // Profile fields used by the dashboard profile page
        supabase
          .from('business_profile')
          .select('long_description, user_about_text, key_offerings')
          .eq('business_id', business.id)
          .maybeSingle(),

        supabase
          .from('business_locations')
          .select('address_line1, postal_code, city, country')
          .eq('business_id', business.id)
          .eq('is_primary', true)
          .maybeSingle(),

        supabase
          .from('opening_hours')
          .select('open_time, close_time')
          .eq('business_id', business.id)
          .eq('kind', 'normal')
          .not('open_time', 'is', null)
          .not('close_time', 'is', null)
      ])

      const businessNameFilled = hasText((business as { name?: string | null }).name)
      const locationFieldsFilled = hasText((businessLocation.data as { address_line1?: string | null } | null)?.address_line1)
        && hasText((businessLocation.data as { postal_code?: string | null } | null)?.postal_code)
        && hasText((businessLocation.data as { city?: string | null } | null)?.city)
        && hasText((businessLocation.data as { country?: string | null } | null)?.country)
      const aboutTextFilled = hasText((businessProfile.data as { user_about_text?: string | null; long_description?: string | null } | null)?.user_about_text)
        || hasText((businessProfile.data as { user_about_text?: string | null; long_description?: string | null } | null)?.long_description)
      const keyOfferingsFilled = hasText((businessProfile.data as { key_offerings?: string | null } | null)?.key_offerings)
      const openingHoursFilled = hasAnyOpeningHours(openingHours.data as Array<{ open_time: string | null; close_time: string | null }> | null)
      const profileChecks = [businessNameFilled, locationFieldsFilled, aboutTextFilled, keyOfferingsFilled, openingHoursFilled]
      const profileComplete = profileChecks.every(Boolean)
      const profileAnyFilled = profileChecks.some(Boolean)
      const profileState: CompletionState = profileComplete ? 'complete' : profileAnyFilled ? 'partial' : 'none'

      // Menu completion state
      const menuHasData = !!menuResults.data
      const menuState: CompletionState = menuHasData ? 'complete' : 'none'

      // Location completion state - check for actual data fields
      const locationData = locationIntelligence.data as {
        neighborhood?: string | null
        area_type?: string | null
        neighborhood_character?: string | null
        who_analysis?: unknown
        when_analysis?: unknown
        why_analysis?: unknown
      } | null
      const locationChecks = [
        hasText(locationData?.neighborhood),
        hasText(locationData?.area_type),
        hasText(locationData?.neighborhood_character),
        !!locationData?.who_analysis,
        !!locationData?.when_analysis,
        !!locationData?.why_analysis
      ]
      const locationComplete = locationChecks.filter(Boolean).length >= 3 // At least 3 key fields
      const locationAnyFilled = locationChecks.some(Boolean)
      const locationState: CompletionState = locationComplete ? 'complete' : locationAnyFilled ? 'partial' : 'none'

      // Brand completion state - check for V5 JSONB data structure
      const brandData = brandProfile.data as {
        brand_profile_v5?: {
          voice?: { tone_rules?: string[]; personality_traits?: string[] }
          layer_1_programmes?: unknown[]
          marketing_manager_brief?: string
        } | null
        business_identity_persona?: string | null
        marketing_manager_brief?: string | null
      } | null
      
      const v5Profile = brandData?.brand_profile_v5
      const brandChecks = [
        !!v5Profile?.voice?.tone_rules && v5Profile.voice.tone_rules.length > 0,
        !!v5Profile?.voice?.personality_traits && v5Profile.voice.personality_traits.length > 0,
        !!v5Profile?.layer_1_programmes && v5Profile.layer_1_programmes.length > 0,
        hasText(brandData?.business_identity_persona),
        hasText(brandData?.marketing_manager_brief),
        hasText(v5Profile?.marketing_manager_brief)
      ]
      const brandComplete = brandChecks.filter(Boolean).length >= 3 // At least 3 key V5 fields
      const brandAnyFilled = brandChecks.some(Boolean)
      const brandState: CompletionState = brandComplete ? 'complete' : brandAnyFilled ? 'partial' : 'none'

      console.log('[useSetupCompletion] Query results:', {
        profile: {
          businessNameFilled,
          locationFieldsFilled,
          aboutTextFilled,
          keyOfferingsFilled,
          openingHoursFilled,
          profileState
        },
        menu: { hasData: menuHasData, menuState },
        location: { 
          data: locationIntelligence.data, 
          locationState,
          checks: locationChecks 
        },
        brand: { 
          data: brandProfile.data, 
          brandState,
          checks: brandChecks 
        },
        profileData: { data: businessProfile.data },
        locationData: { data: businessLocation.data },
        openingHours: { count: openingHours.data?.length ?? 0 }
      })

      setStatus({
        profile: profileComplete,
        profileState,
        menu: menuHasData,
        menuState,
        location: locationState !== 'none',
        locationState,
        brandProfile: brandState !== 'none',
        brandState,
        loading: false
      })
    }

    checkCompletion()

    // Refresh when user navigates (optional - updates when returning to sidebar)
    const interval = setInterval(checkCompletion, 30000) // Check every 30s
    return () => clearInterval(interval)
  }, [user])

  return status
}
