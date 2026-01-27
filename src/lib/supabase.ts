import { createClient } from '@supabase/supabase-js'
import type { PostgrestQueryBuilder } from '@supabase/postgrest-js'
import type { Database } from '../types/database'

type DatabaseWithRelationships = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables'> & {
    Tables: {
      [K in keyof Database['public']['Tables']]: Database['public']['Tables'][K] & { Relationships: any[] }
    }
  }
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Copy .env.example to .env and add your credentials.')
}

export const supabase = createClient<DatabaseWithRelationships>(supabaseUrl, supabaseAnonKey)

export const profilesTable = () =>
  supabase.from('profiles') as unknown as PostgrestQueryBuilder<
    any,
    any,
    DatabaseWithRelationships['public']['Tables']['profiles'],
    'profiles'
  >

