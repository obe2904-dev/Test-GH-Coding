import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Database } from '../types/supabase'

type Business = Database['public']['Tables']['businesses']['Row']
type BusinessProfile = Database['public']['Tables']['business_profile']['Row']
type BusinessLocation = Database['public']['Tables']['business_locations']['Row']
type WebsiteAnalysis = Database['public']['Tables']['website_analyses']['Row']

export interface BusinessData {
  business: Business | null
  profile: BusinessProfile | null
  location: BusinessLocation | null
  latestAnalysis: WebsiteAnalysis | null
  isLoading: boolean
  hasWebsiteAnalysis: boolean
  refresh: () => Promise<void>
}

/**
 * Hook to fetch and manage business data for the current user
 * Returns business info, profile, location, and website analysis status
 */
export function useBusinessData(): BusinessData {
  const [business, setBusiness] = useState<Business | null>(null)
  const [profile, setProfile] = useState<BusinessProfile | null>(null)
  const [location, setLocation] = useState<BusinessLocation | null>(null)
  const [latestAnalysis, setLatestAnalysis] = useState<WebsiteAnalysis | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadBusinessData = async () => {
    try {
      setIsLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setIsLoading(false)
        return
      }

      // Load business
      const { data: businessData } = await supabase
        .from('businesses')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle()

      if (businessData) {
        setBusiness(businessData as Business)

        // Load business profile
        const { data: profileData } = await supabase
          .from('business_profile')
          .select('*')
          .eq('business_id', (businessData as Business).id)
          .maybeSingle()
        
        if (profileData) {
          setProfile(profileData as BusinessProfile)
        }

        // Load primary location
        const { data: locationData } = await supabase
          .from('business_locations')
          .select('*')
          .eq('business_id', (businessData as Business).id)
          .eq('is_primary', true)
          .maybeSingle()
        
        if (locationData) {
          setLocation(locationData as BusinessLocation)
        }

        // Load latest successful website analysis (gracefully handle if table doesn't exist)
        try {
          const { data: analysisData, error: analysisError } = await supabase
            .from('website_analyses')
            .select('*')
            .eq('business_id', (businessData as Business).id)
            .eq('status', 'success')
            .order('last_run_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          
          if (analysisData && !analysisError) {
            setLatestAnalysis(analysisData as WebsiteAnalysis)
          }
        } catch (err) {
          // Silently ignore if website_analyses table doesn't exist yet
          console.debug('Website analysis feature not available yet')
        }
      }
    } catch (error) {
      console.error('Error loading business data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadBusinessData()
  }, [])

  return {
    business,
    profile,
    location,
    latestAnalysis,
    isLoading,
    hasWebsiteAnalysis: latestAnalysis !== null,
    refresh: loadBusinessData,
  }
}
