import { useEffect, useState, useRef } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { supabase } from '../lib/supabase'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuthStore()
  const location = useLocation()
  const [checkingOnboarding, setCheckingOnboarding] = useState(true)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const checkInProgress = useRef(false)

  useEffect(() => {
    async function checkOnboardingStatus() {
      // Prevent multiple simultaneous checks
      if (checkInProgress.current) {
        console.log('⏭️ ProtectedRoute: Check already in progress, skipping')
        return
      }

      checkInProgress.current = true

      console.log('🔍 ProtectedRoute: Checking onboarding status', { 
        user: user?.id, 
        path: location.pathname 
      })

      if (!user) {
        console.log('⚠️ ProtectedRoute: No user, skipping onboarding check')
        setCheckingOnboarding(false)
        checkInProgress.current = false
        return
      }

      const localCompletionKey = `onboarding:completed:${user.id}`
      const hasLocalCompletion =
        typeof window !== 'undefined' && localStorage.getItem(localCompletionKey) === 'true'
      
      // Don't check if navigation is in progress
      const isNavigating = typeof window !== 'undefined' && localStorage.getItem('onboarding:navigating') === 'true'
      if (isNavigating) {
        console.log('🚀 ProtectedRoute: Navigation in progress, skipping check')
        setCheckingOnboarding(false)
        setNeedsOnboarding(false)
        checkInProgress.current = false
        return
      }

      // Don't check if already on onboarding page
      if (location.pathname === '/onboarding') {
        console.log('✅ ProtectedRoute: Already on onboarding page, allowing access')
        setCheckingOnboarding(false)
        setNeedsOnboarding(false)
        checkInProgress.current = false
        return
      }

      // If localStorage says completed, trust it and skip database check
      if (hasLocalCompletion) {
        console.log('✅ ProtectedRoute: LocalStorage confirms onboarding complete, skipping DB check')
        setCheckingOnboarding(false)
        setNeedsOnboarding(false)
        checkInProgress.current = false
        return
      }

      try {
        console.log('📡 ProtectedRoute: Fetching onboarding status from database...')
        
        // Add timeout to prevent infinite loading in Safari
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Database query timeout')), 5000)
        )
        
        const queryPromise = supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('id', user.id)
          .maybeSingle()
        
        const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any

        if (error) {
          console.error('❌ ProtectedRoute: Error checking onboarding status:', error)
          // If error, allow access (fail open)
          setCheckingOnboarding(false)
          setNeedsOnboarding(false)
          checkInProgress.current = false
          return
        }

        if (data?.onboarding_completed === true && typeof window !== 'undefined') {
          localStorage.setItem(localCompletionKey, 'true')
        }

        const isOnboardingComplete =
          data?.onboarding_completed === true || hasLocalCompletion

        console.log('📥 ProtectedRoute: Onboarding status:', {
          data,
          hasData: !!data,
          onboardingCompleted: data?.onboarding_completed,
          type: typeof data?.onboarding_completed,
          isStrictlyTrue: data?.onboarding_completed === true,
          hasLocalCompletion,
          usedLocalCompletion: !data || data.onboarding_completed !== true ? hasLocalCompletion : false,
          currentPath: location.pathname
        })

        // If no profile exists yet, or onboarding not completed, redirect to onboarding
        // BUT NOT if we're already on the onboarding page (defensive check)
        if (location.pathname !== '/onboarding' && !isOnboardingComplete) {
          console.log('🔄 ProtectedRoute: User needs onboarding, will redirect')
          setNeedsOnboarding(true)
        } else {
          console.log('✅ ProtectedRoute: Onboarding completed')
          setNeedsOnboarding(false)
        }
      } catch (error) {
        console.error('❌ ProtectedRoute: Unexpected error:', error)
        // If error, allow access (fail open)
        setNeedsOnboarding(false)
      } finally {
        setCheckingOnboarding(false)
        checkInProgress.current = false
      }
    }

    // Reset state when user or path changes
    setCheckingOnboarding(true)
    setNeedsOnboarding(false)
    checkInProgress.current = false
    
    checkOnboardingStatus()
  }, [user, location.pathname])

  // Show loading state while checking auth and onboarding
  if (loading || checkingOnboarding) {
    console.log('🔄 ProtectedRoute: Showing loading spinner', { loading, checkingOnboarding })
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 border-4 border-[#0F2E32] border-t-[#88F2D7] rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-700 font-medium">Loading...</p>
        </div>
      </div>
    )
  }

  // Redirect to login if not authenticated
  if (!user) {
    console.log('🔄 ProtectedRoute: No user, redirecting to login')
    return <Navigate to="/login" replace />
  }

  // Redirect to onboarding if not completed
  if (needsOnboarding && location.pathname !== '/onboarding') {
    console.log('🔄 ProtectedRoute: Needs onboarding, redirecting')
    return <Navigate to="/onboarding" replace />
  }

  console.log('✅ ProtectedRoute: Rendering children', { path: location.pathname })
  return <>{children}</>
}
