import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

// Staging Supabase credentials (safe to hardcode - anon key is public)
const STAGING_URL = 'https://oadwluspjlsnxhgakral.supabase.co'
const STAGING_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hZHdsdXNwamxzbnhoZ2FrcmFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMDEyMzIsImV4cCI6MjA5ODU3NzIzMn0.qYMwF75KJ7jSLonN8JdMODKWA6WI393dJwG8-YBauoQ'

// Use env vars if available, fallback to staging for preview deployments
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || STAGING_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || STAGING_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Copy .env.example to .env and add your credentials.')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
