import { supabase } from '../lib/supabase'
import { useBusinessStore } from '../stores/businessStore'

/**
 * Helper to get the current user's business
 * 
 * Handles multi-business detection and returns the selected business.
 * If multiple businesses exist and none is selected, returns null
 * (caller should show business selector).
 * 
 * @param userId - The authenticated user's ID
 * @returns The business object or null
 */
export async function getCurrentBusiness(userId: string) {
  const { selectedBusinessId } = useBusinessStore.getState()

  // Query all businesses for this user
  const { data: businesses, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_id', userId)

  if (error) {
    console.error('Failed to load businesses:', error)
    return null
  }

  if (!businesses || businesses.length === 0) {
    return null
  }

  // Single business - return it directly
  if (businesses.length === 1) {
    const { setSelectedBusiness, setAvailableBusinesses } = useBusinessStore.getState()
    setSelectedBusiness(businesses[0].id)
    setAvailableBusinesses(businesses)
    return businesses[0]
  }

  // Multiple businesses - use selected one
  if (selectedBusinessId) {
    const selected = businesses.find((b: any) => b.id === selectedBusinessId)
    if (selected) {
      return selected
    }
  }

  // Multiple businesses but no selection - return null
  // Caller should show business selector
  const { setAvailableBusinesses } = useBusinessStore.getState()
  setAvailableBusinesses(businesses)
  return null
}

/**
 * Hook to get business ID for queries
 * 
 * Returns the selected business ID from the store.
 * Use this in components that need to query business-specific data.
 */
export function useBusinessId(): string | null {
  const selectedBusinessId = useBusinessStore((state) => state.selectedBusinessId)
  return selectedBusinessId
}
