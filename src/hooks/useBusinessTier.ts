import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useTierStore, type Tier } from '../stores/tierStore'

/**
 * Hook to fetch and sync the user's tier from `profiles.plan`
 */
export function useBusinessTier() {
  const { setTier } = useTierStore()

  const normalizePlan = (plan: string | null | undefined): Tier | null => {
    if (!plan) return null

    const normalized = plan.toLowerCase()
    if (normalized === 'free' || normalized === 'standardplus') {
      return normalized
    }

    if (normalized === 'pro' || normalized === 'premium') {
      return 'premium'
    }

    return null
  }

  useEffect(() => {
    let mounted = true

    const fetchBusinessTier = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || !mounted) return

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('plan')
          .eq('id', user.id)
          .maybeSingle() as { data: { plan: string } | null; error: any }

        if (profileError) {
          console.error('Error fetching profile plan:', profileError)
          console.error('Business error details:', {
            message: profileError.message,
            details: profileError.details,
            hint: profileError.hint,
            code: profileError.code
          })
          return
        }

        if (mounted) {
          const tier = normalizePlan(profile?.plan)
          if (tier) {
            setTier(tier)
            localStorage.setItem('business:tier', tier)
            return
          }
        }

        // Default to free if no plan is stored yet
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
