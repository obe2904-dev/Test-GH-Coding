import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const sql = `
ALTER TABLE business_programme_profiles
ADD COLUMN IF NOT EXISTS menu_results_v2_id uuid REFERENCES menu_results_v2(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_business_programme_profiles_menu_results_v2_id 
ON business_programme_profiles(menu_results_v2_id);
`

console.log('Executing SQL...')
console.log(sql)

const { data, error } = await supabase.rpc('exec_sql', { query: sql })

if (error) {
  console.error('Error:', error)
  process.exit(1)
}

console.log('✅ Column added successfully!')
console.log('Data:', data)
