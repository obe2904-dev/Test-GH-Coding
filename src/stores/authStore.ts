import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, metadata?: Record<string, unknown>) => Promise<void>
  signInWithProvider: (provider: 'google' | 'azure') => Promise<void>
  signOut: () => Promise<void>
  deleteAccount: () => Promise<void>
  initialize: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  initialize: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    set({ user: session?.user ?? null, loading: false })

    // Listen for auth changes
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ user: session?.user ?? null })
    })
  },

  signIn: async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      throw error
    }
    // The auth state change listener will handle setting the user
  },

  signUp: async (email: string, password: string, metadata?: Record<string, unknown>) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: metadata ? { data: metadata } : undefined,
    })
    if (error) throw error
  },

  signInWithProvider: async (provider) => {
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/onboarding` : undefined
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
      },
    })

    if (error) throw error
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    set({ user: null })
  },

  deleteAccount: async () => {
    // Get the current session to pass the auth token
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      throw new Error('Not authenticated')
    }

    // Call the Edge Function to delete the account
    const { data, error } = await supabase.functions.invoke('delete-account', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    })
    
    if (error) {
      console.error('Error deleting account:', error)
      throw new Error('Failed to delete account. Please try again or contact support.')
    }

    if (data?.error) {
      console.error('Error from function:', data.error)
      throw new Error(data.error)
    }
    
    // Sign out after deletion
    await supabase.auth.signOut()
    set({ user: null })
  },
}))
