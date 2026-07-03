// Quick fix script to rename suggested_post_time to suggested_time in posts table
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://kvqdkohdpvmdylqgujpn.supabase.co'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseKey) {
  console.error('❌ Missing Supabase key. Set VITE_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function fixSuggestedTimeColumn() {
  console.log('🔧 Checking posts table schema...')
  
  const sql = `
    DO $$
    BEGIN
      -- Check if suggested_post_time exists and rename it
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'posts' 
        AND column_name = 'suggested_post_time'
      ) THEN
        ALTER TABLE public.posts RENAME COLUMN suggested_post_time TO suggested_time;
        RAISE NOTICE 'Renamed suggested_post_time to suggested_time';
      END IF;

      -- Check if suggested_time exists, if not add it
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'posts' 
        AND column_name = 'suggested_time'
      ) THEN
        ALTER TABLE public.posts ADD COLUMN suggested_time TEXT;
        RAISE NOTICE 'Added suggested_time column';
      END IF;
    END $$;
  `
  
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql })
  
  if (error) {
    console.error('❌ Error:', error)
    return false
  }
  
  console.log('✅ Column fix applied successfully!')
  console.log('   Posts table now has suggested_time column')
  return true
}

fixSuggestedTimeColumn()
  .then(success => process.exit(success ? 0 : 1))
  .catch(err => {
    console.error('❌ Script failed:', err)
    process.exit(1)
  })
