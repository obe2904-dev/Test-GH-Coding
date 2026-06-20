import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

interface SetupCompletionStatus {
  profile: boolean
  menu: boolean
  location: boolean
  brandProfile: boolean
  loading: boolean
}

export function useSetupCompletion() {
  const user = useAuthStore((state) => state.user)
  const [status, setStatus] = useState<SetupCompletionStatus>({
    profile: false,
    menu: false,
    location: false,
    brandProfile: false,
    loading: true
  })

  useEffect(() => {
    if (!user) {
      setStatus({ profile: false, menu: false, location: false, brandProfile: false, loading: false })
      return
    }

    const checkCompletion = async () => {
      // Get user's business ID
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('id, website_url')
        .eq('owner_id', user.id)
        .single()

      if (businessError) {
        console.error('[useSetupCompletion] Error fetching business:', businessError)
      }

      if (!business) {
        console.log('[useSetupCompletion] No business found for user:', user.id)
        setStatus({ profile: false, menu: false, location: false, brandProfile: false, loading: false })
        return
      }

      console.log('[useSetupCompletion] Checking completion for business:', business.id)

      // Check each completion status
      const [menuResults, brandProfile, locationIntelligence] = await Promise.all([
        // Menu: Has successful extraction
        supabase
          .from('menu_results_v2')
          .select('id')
          .eq('business_id', business.id)
          .eq('status', 'done')
          .limit(1)
          .maybeSingle(),
        
        // Brand Profile: AI generated (stored in business_brand_profile table)
        supabase
          .from('business_brand_profile')
          .select('brand_profile_v5')
          .eq('business_id', business.id)
          .not('brand_profile_v5', 'is', null)
          .limit(1)
          .maybeSingle(),
        
        // Location: Check if location intelligence analysis has been run
        supabase
          .from('business_location_intelligence')
          .select('last_updated_by_ai')
          .eq('business_id', business.id)
          .not('last_updated_by_ai', 'is', null)
          .limit(1)
          .maybeSingle()
      ])

      // Profile: Check website_analyses with service role (RLS bypass) or direct count
      // Since website_analyses has no RLS policies, we need to use a different approach
      const { count: profileCount } = await supabase
        .from('website_analyses')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', business.id)
        .eq('status', 'success')

      console.log('[useSetupCompletion] Query results:', {
        profile: { count: profileCount },
        menu: { data: menuResults.data, error: menuResults.error },
        brandProfile: { data: brandProfile.data, error: brandProfile.error },
        location: { data: locationIntelligence.data, error: locationIntelligence.error }
      })

      setStatus({
        profile: (profileCount ?? 0) > 0,
        menu: !!menuResults.data,
        location: !!locationIntelligence.data,
        brandProfile: !!brandProfile.data,
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
