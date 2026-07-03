#!/usr/bin/env node
/**
 * Regenerate Brand Profile V5.3
 * Triggers brand profile regeneration with force flag
 */

const SUPABASE_URL = 'https://kvqdkohdpvmdylqgujpn.supabase.co'
const BUSINESS_ID = '561f8fe8-41cb-4191-87e4-5cabf9bcdd79'

// Get access token from .env.local file
import { readFileSync } from 'fs'
import { existsSync } from 'fs'

let ACCESS_TOKEN = null
const envFiles = ['.env.local', '.env']

for (const envFile of envFiles) {
  if (existsSync(envFile)) {
    const envContent = readFileSync(envFile, 'utf-8')
    const accessTokenMatch = envContent.match(/ACCESS_TOKEN=(.+)/)
    if (accessTokenMatch) {
      ACCESS_TOKEN = accessTokenMatch[1].trim()
      break
    }
  }
}

if (!ACCESS_TOKEN) {
  console.error('❌ ACCESS_TOKEN not found in .env file')
  process.exit(1)
}

console.log('🔄 Triggering brand profile regeneration (V5.3)...')
console.log(`   Business ID: ${BUSINESS_ID}`)
console.log(`   Supabase URL: ${SUPABASE_URL}`)
console.log('')

const response = await fetch(`${SUPABASE_URL}/functions/v1/brand-profile-generator-v5`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${ACCESS_TOKEN}`
  },
  body: JSON.stringify({
    businessId: BUSINESS_ID,
    forceRegenerate: true
  })
})

if (!response.ok) {
  const error = await response.text()
  console.error('❌ Regeneration failed:', response.status, error)
  process.exit(1)
}

const result = await response.json()

console.log('✅ Regeneration completed!')
console.log(`   Version: ${result.version || 'unknown'}`)
console.log(`   Duration: ${result.generation_metadata?.duration_ms || 0}ms`)
console.log('')
console.log('📊 Generated content:')
console.log(`   • Marketing Manager Brief: ${result.marketing_manager_brief ? 'YES' : 'NO'}`)
console.log(`   • USPs Extracted: ${result.usps ? 'YES' : 'NO'}`)
console.log(`   • Programmes: ${result.programmes?.length || 0}`)
console.log('')

if (result.marketing_manager_brief) {
  console.log('📝 Marketing Manager Brief Preview:')
  console.log(result.marketing_manager_brief.substring(0, 300) + '...')
  console.log('')
}

console.log('✅ You can now run the verification SQL queries!')
