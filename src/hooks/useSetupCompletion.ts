import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export type CompletionState = 'none' | 'partial' | 'complete'

interface SetupCompletionStatus {
  profile: boolean
  profileState: CompletionState
  menu: boolean
  menuState: CompletionState
  menuProcessing: boolean
  location: boolean
  locationState: CompletionState
  locationProcessing: boolean
  brandProfile: boolean
  brandState: CompletionState
  brandProcessing: boolean
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
    menuProcessing: false,
    location: false,
    locationState: 'none',
    locationProcessing: false,
    brandProfile: false,
    brandState: 'none',
    brandProcessing: false,
    loading: true
  })

  useEffect(() => {
    if (!user) {
      setStatus({ 
        profile: false, 
        profileState: 'none', 
        menu: false, 
        menuState: 'none',
        menuProcessing: false,
        location: false, 
        locationState: 'none',
        locationProcessing: false,
        brandProfile: false, 
        brandState: 'none',
        brandProcessing: false,
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
          menuProcessing: false,
          location: false, 
          locationState: 'none',
          locationProcessing: false,
          brandProfile: false, 
          brandState: 'none',
          brandProcessing: false,
          loading: false 
        })
        return
      }

      console.log('[useSetupCompletion] Checking completion for business:', business.id)

      // Check each completion status
      const [menuResultsAll, menuResultsDone, menuProcessing, brandProfile, locationIntelligence, businessProfile, businessLocation, openingHours] = await Promise.all([
        // Menu: Get ALL menu results to check total count
        supabase
          .from('menu_results_v2')
          .select('id, status, time_start, time_end')
          .eq('business_id', business.id),
        
        // Menu: Get all done extractions (we'll filter for timing in JS)
        supabase
          .from('menu_results_v2')
          .select('id, time_start, time_end')
          .eq('business_id', business.id)
          .eq('status', 'done'),
        
        // Menu: Check if currently processing
        supabase
          .from('menu_results_v2')
          .select('id')
          .eq('business_id', business.id)
          .in('status', ['queued', 'processing']),
        
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

      // Menu completion state - check ALL menu results WITH timing
      const totalMenus = menuResultsAll.data?.length || 0
      
      // Debug: Log all done menus and their timing
      console.log('[useSetupCompletion] All done menus:', menuResultsDone.data?.map(m => ({
        id: m.id,
        time_start: m.time_start,
        time_end: m.time_end,
        hasTiming: !!(m.time_start && m.time_end)
      })))
      
      // Filter done menus to only count those with actual timing assigned (matching UI logic)
      const doneMenusWithTiming = menuResultsDone.data?.filter(m => 
        m.time_start && m.time_end
      ) || []
      const doneMenus = doneMenusWithTiming.length
      const processingMenus = menuProcessing.data?.length || 0
      
      const menuHasData = totalMenus > 0
      const menuAllDone = totalMenus > 0 && doneMenus === totalMenus && processingMenus === 0
      const menuSomeDone = doneMenus > 0 && doneMenus < totalMenus
      const menuState: CompletionState = menuAllDone ? 'complete' : (menuHasData ? 'partial' : 'none')
      const menuIsProcessing = processingMenus > 0

      // Location completion state - check for actual data fields that get populated
      const locationData = locationIntelligence.data as {
        neighborhood?: string | null
        area_type?: string | null
        neighborhood_character?: string | null
        category_scores?: Record<string, number> | null
        location_type_matches?: Record<string, unknown> | null
      } | null
      
      const hasCategoryScores = locationData?.category_scores && 
        typeof locationData.category_scores === 'object' && 
        Object.keys(locationData.category_scores).length > 0
        
      const hasLocationTypes = locationData?.location_type_matches &&
        typeof locationData.location_type_matches === 'object' &&
        Object.keys(locationData.location_type_matches).length > 0
      
      const locationChecks = [
        hasText(locationData?.neighborhood_character), // Area Character text
        hasText(locationData?.area_type), // Area type
        hasCategoryScores, // Location Types percentages
        hasLocationTypes // Location type analysis
      ]
      const locationComplete = locationChecks.filter(Boolean).length >= 2 // At least 2 key fields (neighborhood_character + category_scores is enough)
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
        menu: { 
          totalMenus, 
          doneMenus, // with timing assigned
          doneMenusWithoutFilter: menuResultsDone.data?.length || 0,
          processingMenus, 
          menuAllDone,
          menuState,
          menuIsProcessing 
        },
        location: { 
          neighborhood_character: hasText(locationData?.neighborhood_character),
          area_type: hasText(locationData?.area_type),
          category_scores: hasCategoryScores,
          location_type_matches: hasLocationTypes,
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
        menu: menuAllDone,
        menuState,
        menuProcessing: menuIsProcessing,
        location: locationState !== 'none',
        locationState,
        locationProcessing: false, // TODO: Add location processing detection if needed
        brandProfile: brandState !== 'none',
        brandState,
        brandProcessing: false, // TODO: Add brand processing detection if needed
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
