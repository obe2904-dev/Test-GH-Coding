import { supabase } from './supabase'

// Test Supabase connection on page load
export async function testSupabaseConnection() {
  console.log('🔍 Testing Supabase connection...')

  try {
    // Test database connection
    const { error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1)

    if (error) {
      console.error('❌ Supabase Error:', error.message)
      
      if (error.message.includes('relation "public.profiles" does not exist')) {
        console.warn('⚠️  Database table "profiles" does not exist yet.')
        console.log('Please run the migration from: supabase/migrations/001_initial_schema.sql')
      }
      return { connected: false, error: error.message }
    }

    console.log('✅ Supabase connection successful!')
    return { connected: true, error: null }

  } catch (err: any) {
    console.error('❌ Connection failed:', err.message)
    return { connected: false, error: err.message }
  }
}

// Auto-test on import (only in development)
if (import.meta.env.DEV) {
  testSupabaseConnection()
}
