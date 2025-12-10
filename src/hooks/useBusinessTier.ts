import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useTierStore, type Tier } from '../stores/tierStore'

/**
 * Hook to fetch and sync the user's business tier from the database
 * Tier is stored at business level, not user level
 * Team members inherit their business's tier
 */
export function useBusinessTier() {
  const { setTier } = useTierStore()

  useEffect(() => {
    let mounted = true

    const fetchBusinessTier = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || !mounted) return

        // Get user's business (as owner)
        const { data: business, error: businessError } = await supabase
          .from('businesses')
          .select('plan')
          .eq('owner_id', user.id)
          .maybeSingle() as { data: { plan: string } | null; error: any }

        if (businessError) {
          console.error('Error fetching business:', businessError)
          console.error('Business error details:', {
            message: businessError.message,
            details: businessError.details,
            hint: businessError.hint,
            code: businessError.code
          })
          return
        }

        // If user owns a business, use that tier
        if (business?.plan && mounted) {
          const tier = business.plan.toLowerCase() as Tier
          if (['free', 'standardplus', 'premium'].includes(tier)) {
            setTier(tier)
            localStorage.setItem('business:tier', tier)
            return
          }
        }

        // If not owner, check if they're a team member
        const { data: membership, error: memberError } = await supabase
          .from('business_team_members')
          .select('business_id, accepted_at')
          .eq('user_id', user.id)
          .not('accepted_at', 'is', null)
          .maybeSingle() as { data: { business_id: string; accepted_at: string } | null; error: any }

        if (memberError) {
          console.error('Error fetching team membership:', memberError)
          return
        }

        // If team member, get the business's tier
        if (membership?.business_id && mounted) {
          const { data: teamBusiness, error: teamBusinessError } = await supabase
            .from('businesses')
            .select('plan')
            .eq('id', membership.business_id)
            .single() as { data: { plan: string } | null; error: any }

          if (teamBusinessError) {
            console.error('Error fetching team business:', teamBusinessError)
            return
          }

          if (teamBusiness?.plan && mounted) {
            const tier = teamBusiness.plan.toLowerCase() as Tier
            if (['free', 'standardplus', 'premium'].includes(tier)) {
              setTier(tier)
              localStorage.setItem('business:tier', tier)
              return
            }
          }
        }

        // Default to free if no business found
        if (mounted) {
          setTier('free')
          localStorage.setItem('business:tier', 'free')
        }
      } catch (error) {
        console.error('Error in useBusinessTier:', error)
        // Fallback to free tier on error
        if (mounted) {
          setTier('free')
        }
      }
    }

    fetchBusinessTier()

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user && mounted) {
        fetchBusinessTier()
      } else if (!session && mounted) {
        setTier('free')
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [setTier])
}
