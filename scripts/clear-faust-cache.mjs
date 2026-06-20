// Clear Café Faust cache for week 22
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

function parseDotEnv(contents) {
  const out = {}
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const normalized = line.startsWith('export ') ? line.slice('export '.length).trim() : line
    const eq = normalized.indexOf('=')
    if (eq === -1) continue
    const key = normalized.slice(0, eq).trim()
    let value = normalized.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (key) out[key] = value
  }
  return out
}

function loadEnvFromFiles() {
  const cwd = process.cwd()
  for (const filename of ['.env.local', '.env']) {
    const fullPath = path.join(cwd, filename)
    if (!fs.existsSync(fullPath)) continue
    try {
      const parsed = parseDotEnv(fs.readFileSync(fullPath, 'utf8'))
      for (const [k, v] of Object.entries(parsed)) {
        if (!(k in process.env)) process.env[k] = v
      }
    } catch (e) {
      console.error(`Failed to parse ${filename}:`, e.message)
    }
  }
}

loadEnvFromFiles()

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

const businessId = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'  // Café Faust
const weekNumber = 22

console.log(`🗑️  Clearing cache for Café Faust week ${weekNumber}`)

const { data, error } = await supabase
  .from('weekly_strategies')
  .delete()
  .eq('business_id', businessId)
  .eq('week_number', weekNumber)

if (error) {
  console.error('❌ Error:', error.message)
  process.exit(1)
}

console.log('✅ Cache cleared')
console.log('Deleted rows:', data)
