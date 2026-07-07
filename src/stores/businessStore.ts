import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Business {
  id: string
  name: string
  owner_id: string
  created_at?: string | null
}

interface BusinessStoreState {
  selectedBusinessId: string | null
  availableBusinesses: Business[]
  setSelectedBusiness: (businessId: string) => void
  setAvailableBusinesses: (businesses: Business[]) => void
  clearSelection: () => void
}

/**
 * Business selection store
 * 
 * Handles cases where a user has multiple businesses (detected by AI or manual setup).
 * For now, only one business per account is officially supported, but this allows
 * users to choose which business to work with if multiple are detected.
 * 
 * Future: Enterprise tier will fully support multiple businesses per account.
 */
export const useBusinessStore = create<BusinessStoreState>()(
  persist(
    (set) => ({
      selectedBusinessId: null,
      availableBusinesses: [],
      
      setSelectedBusiness: (businessId: string) => {
        set({ selectedBusinessId: businessId })
      },
      
      setAvailableBusinesses: (businesses: Business[]) => {
        set({ availableBusinesses: businesses })
      },
      
      clearSelection: () => {
        set({ selectedBusinessId: null, availableBusinesses: [] })
      }
    }),
    {
      name: 'business-selection-storage',
      // Only persist the selected business ID, not the full business list
      partialize: (state) => ({ selectedBusinessId: state.selectedBusinessId })
    }
  )
)
