#!/usr/bin/env node
/**
 * Manually confirm email for user
 * This updates the auth.users table directly via service role
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { config } from 'https://deno.land/x/dotenv@v3.2.2/mod.ts'

// Load environment
const env = config()

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || Deno.env.get('NEXT_PUBLIC_SUPABASE_URL')
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing environment variables')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  Deno.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const email = 'olebaek@icloud.com'

console.log(`🔧 Confirming email for: ${email}`)

// Update user to confirm email
const { data, error } = await supabase.auth.admin.updateUserById(
  // First we need to get the user ID
  (await supabase.auth.admin.listUsers()).data.users.find(u => u.email === email)?.id,
  {
    email_confirm: true
  }
)

if (error) {
  console.error('❌ Error:', error)
  Deno.exit(1)
}

console.log('✅ Email confirmed successfully!')
console.log('You can now log in with:', email)
