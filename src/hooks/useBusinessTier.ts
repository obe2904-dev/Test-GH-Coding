import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { useTierStore, type Tier } from '../stores/tierStore'

/**
 * Hook to fetch and sync the user's tier from `profiles.plan`
 */
export function useBusinessTier() {
  const setTier = useTierStore((state) => state.setTier)
  const setTierStatus = useTierStore((state) => state.setTierStatus)
  const user = useAuthStore((state) => state.user)
  const authLoading = useAuthStore((state) => state.loading)

  const normalizePlan = (plan: string | null | undefined): Tier | null => {
    if (!plan) return null

    const normalized = plan.trim().toLowerCase()
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
        if (!mounted) return

        if (authLoading) {
          setTierStatus('loading')
          return
        }

        if (!user) {
          setTier('free')
          setTierStatus('ready')
          return
        }

        setTierStatus('loading')

        // The cache is scoped to the authenticated user. It is only a display
        // optimisation while the database remains the source of truth.
        const cacheKey = `business:tier:${user.id}`
        const cachedTier = normalizePlan(localStorage.getItem(cacheKey))

        const resolveTierFromDatabase = async (): Promise<Tier | null> => {
          console.log('🔍 Resolving tier for user:', user.id)
          
          const { data: ownedBusiness, error: ownedBusinessError } = await supabase
            .from('businesses')
            .select('id, plan')
            .eq('owner_id', user.id)
            .maybeSingle()

          if (ownedBusinessError) {
            console.warn('❌ Error fetching business plan for owner:', ownedBusinessError)
          } else if (ownedBusiness) {
            console.log('📊 Found owned business:', ownedBusiness.id, 'plan:', ownedBusiness.plan)
            const tier = normalizePlan((ownedBusiness as any)?.plan)
            if (tier) {
              console.log('✅ Resolved tier from owned business:', tier)
              return tier
            }
          } else {
            console.log('ℹ️ No owned business found')
          }

          const { data: teamMember, error: teamMemberError } = await supabase
            .from('business_team_members')
            .select('business_id')
            .eq('user_id', user.id)
            .not('accepted_at', 'is', null)
            .maybeSingle()

          if (teamMemberError) {
            console.warn('❌ Error checking business team membership:', teamMemberError)
          } else if (teamMember?.business_id) {
            console.log('👥 Found team membership for business:', teamMember.business_id)
            const { data: teamBusiness, error: teamBusinessError } = await supabase
              .from('businesses')
              .select('id, plan')
              .eq('id', teamMember.business_id)
              .maybeSingle()

            if (teamBusinessError) {
              console.warn('❌ Error fetching team business plan:', teamBusinessError)
            } else if (teamBusiness) {
              console.log('📊 Team business plan:', teamBusiness.plan)
              const tier = normalizePlan((teamBusiness as any)?.plan)
              if (tier) {
                console.log('✅ Resolved tier from team business:', tier)
                return tier
              }
            }
          }

          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('plan')
            .eq('id', user.id)
            .maybeSingle()

          if (profileError) {
            console.warn('❌ Error fetching profile plan:', profileError)
          } else if (profile) {
            console.log('👤 Profile plan:', profile.plan)
            const tier = normalizePlan((profile as any)?.plan)
            if (tier) {
              console.log('✅ Resolved tier from profile:', tier)
              return tier
            }
          }

          try {
            const { data: tierResponse, error: tierError } = await supabase.functions
              .invoke('get-my-tier') as {
                data: { plan?: string; profileFound?: boolean } | null
                error: any
              }

            if (!tierError) {
              return normalizePlan(tierResponse?.plan)
            }

            console.error('Error fetching authenticated profile plan:', tierError)
          } catch (invokeError) {
            console.error('Error invoking get-my-tier:', invokeError)
          }

          return null
        }

        const resolvedTier = await resolveTierFromDatabase()

        if (mounted) {
          if (resolvedTier) {
            console.log('✅ Final resolved tier:', resolvedTier, '(was cached as:', cachedTier, ')')
            setTier(resolvedTier)
            localStorage.setItem(cacheKey, resolvedTier)
            setTierStatus('ready')
            return
          }

          if (cachedTier) {
            console.log('⚠️ Using cached tier (no DB result):', cachedTier)
            setTier(cachedTier)
            setTierStatus('ready')
            return
          }

          // Default to free only when every authoritative lookup failed.
          console.log('⚠️ Defaulting to free tier (no DB result, no cache)')
          setTier('free')
          localStorage.setItem(cacheKey, 'free')
          setTierStatus('ready')
        }
      } catch (error) {
        console.error('Error in useBusinessTier:', error)
        // Preserve the last verified/cached tier on transient failures. The
        // server remains authoritative for paid feature access.
        if (mounted) {
          setTierStatus('error')
        }
      }
    }

    fetchBusinessTier()

    return () => {
      mounted = false
    }
  }, [authLoading, user?.id, setTier, setTierStatus])
}
