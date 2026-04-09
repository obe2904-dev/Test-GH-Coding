import { create } from 'zustand'
import { supabase } from '../lib/supabase'

interface ConnectedAccount {
  id: string
  platform: 'facebook' | 'instagram' | 'linkedin' | 'twitter'
  accountName: string
  isActive: boolean
  isEnabled: boolean
  connectedAt: string
}

interface ConnectionsState {
  connectedAccounts: ConnectedAccount[]
  enabledPlatforms: string[]
  platformsLoaded: boolean
  connecting: boolean
  connectPlatform: (platform: string) => Promise<void>
  disconnectPlatform: (platform: string) => Promise<void>
  togglePlatformEnabled: (platform: string, enabled: boolean) => void
  isConnected: (platform: string) => boolean
  isEnabled: (platform: string) => boolean
  loadPlatformsFromDatabase: () => Promise<void>
}

export const useConnectionsStore = create<ConnectionsState>((set, get) => ({
  connectedAccounts: [],
  enabledPlatforms: [], // No default platforms - user must select in Business Profile
  platformsLoaded: false,
  connecting: false,

  connectPlatform: async (platform: string) => {
    // Add to enabledPlatforms only - not connectedAccounts
    // connectedAccounts should only be populated after actual OAuth is complete
    // This ensures ManualPostModal (copy-paste popup) appears when publishing
    set(state => ({
      enabledPlatforms: [...state.enabledPlatforms.filter(p => p !== platform), platform],
      connecting: true
    }))
    
    try {
      // Save to database
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const currentPlatforms = get().enabledPlatforms
        console.log('💾 Saving platforms to database:', currentPlatforms, 'for user:', user.id)
        
        // Use direct supabase call with proper update
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ selected_platforms: currentPlatforms })
          .eq('id', user.id)
        
        if (updateError) {
          console.error('❌ Error saving platforms:', updateError)
          throw updateError
        } else {
          console.log('✅ Platforms saved successfully:', currentPlatforms)
        }
      }
      
      set({ connecting: false })
      console.log(`Platform ${platform} enabled (OAuth not yet implemented)`)
    } catch (error) {
      console.error(`Failed to enable ${platform}:`, error)
      // Rollback on error
      set(state => ({
        enabledPlatforms: state.enabledPlatforms.filter(p => p !== platform),
        connecting: false
      }))
    }
  },

  disconnectPlatform: async (platform: string) => {
    const platformsBefore = get().enabledPlatforms
    
    // Remove from enabledPlatforms only
    set(state => ({
      enabledPlatforms: state.enabledPlatforms.filter(p => p !== platform),
      connecting: true
    }))
    
    try {
      // Save to database
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const currentPlatforms = get().enabledPlatforms
        console.log('💾 Removing platform from database:', currentPlatforms, 'for user:', user.id)
        
        // Use direct supabase call with proper update
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ selected_platforms: currentPlatforms })
          .eq('id', user.id)
        
        if (updateError) {
          console.error('❌ Error updating platforms:', updateError)
          throw updateError
        } else {
          console.log('✅ Platforms removed successfully:', currentPlatforms)
        }
      }
      
      set({ connecting: false })
      console.log(`Platform ${platform} disabled`)
    } catch (error) {
      console.error(`Failed to disable ${platform}:`, error)
      // Rollback on error
      set(() => ({
        enabledPlatforms: platformsBefore,
        connecting: false
      }))
    }
  },

  togglePlatformEnabled: (platform: string, enabled: boolean) => {
    set(state => {
      const enabledPlatforms = enabled 
        ? [...state.enabledPlatforms.filter(p => p !== platform), platform]
        : state.enabledPlatforms.filter(p => p !== platform)
      
      // If disabling a connected platform, disconnect it
      const connectedAccounts = !enabled 
        ? state.connectedAccounts.filter(account => account.platform !== platform)
        : state.connectedAccounts
      
      return {
        enabledPlatforms,
        connectedAccounts
      }
    })
  },

  isConnected: (platform: string) => {
    const { connectedAccounts } = get()
    return connectedAccounts.some(
      account => account.platform === platform && account.isActive
    )
  },

  isEnabled: (platform: string) => {
    const { enabledPlatforms } = get()
    return enabledPlatforms.includes(platform)
  },

  loadPlatformsFromDatabase: async () => {
    if (get().platformsLoaded) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.log('🔄 loadPlatformsFromDatabase: No user logged in')
        return
      }

      // console.log('🔄 loadPlatformsFromDatabase: Loading for user:', user.id)

      // Use direct supabase call
      const { data, error } = await supabase
        .from('profiles')
        .select('selected_platforms')
        .eq('id', user.id)
        .maybeSingle()

      // console.log('🔄 loadPlatformsFromDatabase: Raw response:', { data, error })

      if (error) {
        console.error('❌ Error loading platforms (column may not exist yet):', error.message)
        // Fail silently if column doesn't exist yet
        return
      }

      // Handle JSONB - it comes back as an array already
      const rawPlatforms = data?.selected_platforms
      const savedPlatforms: string[] = Array.isArray(rawPlatforms) ? rawPlatforms : []
      // console.log('🔄 loadPlatformsFromDatabase: Parsed platforms:', savedPlatforms)

      if (savedPlatforms.length > 0) {
        // Only set enabledPlatforms - platforms are NOT connected until OAuth is complete
        // The social_accounts table tracks actual OAuth connections via is_connected field
        // Since OAuth is not yet implemented, no platforms should show as connected
        // This ensures ManualPostModal (copy-paste popup) appears when publishing
        set({ 
          enabledPlatforms: savedPlatforms,
          connectedAccounts: [], // Clear - no OAuth connections exist yet
          platformsLoaded: true
        })
        console.log('✅ loadPlatformsFromDatabase: Set enabledPlatforms to:', JSON.stringify(savedPlatforms))
      } else {
        set({ platformsLoaded: true })
        console.log('⚠️ loadPlatformsFromDatabase: No platforms saved in database')
      }
    } catch (error) {
      console.error('❌ Error loading platforms from database:', error)
    }
  }
}))