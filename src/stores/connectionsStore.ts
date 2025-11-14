import { create } from 'zustand'

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
}

export const useConnectionsStore = create<ConnectionsState>((set, get) => ({
  connectedAccounts: [],
  enabledPlatforms: ['facebook', 'instagram'], // Default enabled platforms
  connecting: false,

  connectPlatform: async (platform: string) => {
    set({ connecting: true })
    
    try {
      // TODO: Implement OAuth flow
      // For now, simulate connection
      await new Promise(resolve => setTimeout(resolve, 1500))
      
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
        connecting: false
      }))
      
      console.log(`Connected to ${platform}`)
    } catch (error) {
      console.error(`Failed to connect to ${platform}:`, error)
      set({ connecting: false })
    }
  },

  disconnectPlatform: async (platform: string) => {
    set({ connecting: true })
    
    try {
      // TODO: Implement disconnection API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      set(state => ({
        connectedAccounts: state.connectedAccounts.filter(
          account => account.platform !== platform
        ),
        connecting: false
      }))
      
      console.log(`Disconnected from ${platform}`)
    } catch (error) {
      console.error(`Failed to disconnect from ${platform}:`, error)
      set({ connecting: false })
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
  }
}))