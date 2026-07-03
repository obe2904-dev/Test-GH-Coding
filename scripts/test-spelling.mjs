#!/usr/bin/env node
/*
  Simple test script to call the Supabase Edge Function `spelling`.

  Usage:
    node scripts/test-spelling.mjs "Text to correct"

  Make sure `.env` contains `VITE_SUPABASE_FUNCTION_SPELLING` and (optionally) `VITE_SUPABASE_ANON_KEY`.
*/

import fs from 'fs'
import path from 'path'

const argv = process.argv.slice(2)
if (argv.length === 0) {
  console.error('Usage: node scripts/test-spelling.mjs "Text to correct"')
  process.exit(1)
}

// load .env if present
const envPath = path.resolve(process.cwd(), '.env')
if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, 'utf8')
  env.split(/\n/).forEach((line) => {
    const m = line.match(/^([^=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim()
  })
}

const endpoint = process.env.VITE_SUPABASE_FUNCTION_SPELLING
if (!endpoint) {
  console.error('VITE_SUPABASE_FUNCTION_SPELLING is not set in environment (.env).')
  process.exit(2)
}

const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

const text = argv.join(' ')

async function run() {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(anon ? { apikey: anon, Authorization: `Bearer ${anon}` } : {})
      },
      body: JSON.stringify({ text, language: 'auto' })
    })

    const body = await res.text()
    console.log('HTTP', res.status)
    try {
      console.log('Response:', JSON.parse(body))
    } catch {
      console.log('Response (raw):', body)
    }
  } catch (err) {
    console.error('Request failed:', err)
  }
}

run()
