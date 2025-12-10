import { createClient } from '@supabase/supabase-js'
import type { PostgrestQueryBuilder } from '@supabase/postgrest-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Copy .env.example to .env and add your credentials.')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

export const profilesTable = () =>
  supabase.from('profiles') as unknown as PostgrestQueryBuilder<
    any,
    any,
    Database['public']['Tables']['profiles'],
    'profiles'
  >
