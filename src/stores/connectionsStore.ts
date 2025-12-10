import { create } from 'zustand'
import { supabase, profilesTable } from '../lib/supabase'
import type { Database } from '../types/database'

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
  connecting: false,

  connectPlatform: async (platform: string) => {
    // Immediately add to state for instant UI feedback
    const newAccount: ConnectedAccount = {
      id: `${platform}_${Date.now()}`,
      platform: platform as any,
      accountName: `My ${platform} Account`,
      isActive: true,
      isEnabled: true,
      connectedAt: new Date().toISOString()
    }
    
    set(state => ({
      connectedAccounts: [...state.connectedAccounts, newAccount],
      enabledPlatforms: [...state.enabledPlatforms, platform],
      connecting: true
    }))
    
    try {
      // Save to database
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const currentPlatforms = get().enabledPlatforms
        console.log('💾 Saving platforms to database:', currentPlatforms)
        const profileUpdate = {
          selected_platforms: currentPlatforms
        } satisfies Database['public']['Tables']['profiles']['Update']
        const { error: updateError } = await profilesTable()
          .update(profileUpdate)
          .eq('id', user.id)
        
        if (updateError) {
          console.error('❌ Error saving platforms:', updateError)
          throw updateError
        } else {
          console.log('✅ Platforms saved successfully')
        }
      }
      
      // TODO: Implement OAuth flow
      // For now, simulate connection
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      set({ connecting: false })
      console.log(`Connected to ${platform}`)
    } catch (error) {
      console.error(`Failed to connect to ${platform}:`, error)
      // Rollback on error
      set(state => ({
        connectedAccounts: state.connectedAccounts.filter(acc => acc.id !== newAccount.id),
        enabledPlatforms: state.enabledPlatforms.filter(p => p !== platform),
        connecting: false
      }))
    }
  },

  disconnectPlatform: async (platform: string) => {
    // Store the accounts before removing for potential rollback
    const accountsToRemove = get().connectedAccounts.filter(
      account => account.platform === platform
    )
    const platformsBefore = get().enabledPlatforms
    
    // Immediately remove from state for instant UI feedback
    set(state => ({
      connectedAccounts: state.connectedAccounts.filter(
        account => account.platform !== platform
      ),
      enabledPlatforms: state.enabledPlatforms.filter(p => p !== platform),
      connecting: true
    }))
    
    try {
      // Save to database
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const currentPlatforms = get().enabledPlatforms
        console.log('💾 Removing platform from database:', currentPlatforms)
        const profileUpdate = {
          selected_platforms: currentPlatforms
        } satisfies Database['public']['Tables']['profiles']['Update']
        const { error: updateError } = await profilesTable()
          .update(profileUpdate)
          .eq('id', user.id)
        
        if (updateError) {
          console.error('❌ Error updating platforms:', updateError)
          throw updateError
        } else {
          console.log('✅ Platforms updated successfully')
        }
      }
      
      // TODO: Implement disconnection API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      set({ connecting: false })
      console.log(`Disconnected from ${platform}`)
    } catch (error) {
      console.error(`Failed to disconnect from ${platform}:`, error)
      // Rollback on error
      set(state => ({
        connectedAccounts: [...state.connectedAccounts, ...accountsToRemove],
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
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return
      }

      const { data, error } = await profilesTable()
        .select('selected_platforms')
        .eq('id', user.id)
        .maybeSingle<Pick<Database['public']['Tables']['profiles']['Row'], 'selected_platforms'>>()

      if (error) {
        console.error('❌ Error loading platforms (column may not exist yet):', error.message)
        // Fail silently if column doesn't exist yet
        return
      }

      const savedPlatforms = data?.selected_platforms ?? []

      if (savedPlatforms.length > 0) {
        // Create connected accounts for each saved platform
        const connectedAccounts: ConnectedAccount[] = savedPlatforms.map((platform) => ({
          id: `${platform}_loaded`,
          platform: platform as any,
          accountName: `My ${platform} Account`,
          isActive: true,
          isEnabled: true,
          connectedAt: new Date().toISOString()
        }))
        
        set({ 
          enabledPlatforms: savedPlatforms,
          connectedAccounts: connectedAccounts
        })
      }
    } catch (error) {
      console.error('❌ Error loading platforms from database:', error)
    }
  }
}))