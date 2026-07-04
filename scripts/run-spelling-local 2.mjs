#!/usr/bin/env node
/*
  Local Node tester for the spelling logic (uses OPENAI_API_KEY from .env)

  Usage:
    node scripts/run-spelling-local.mjs "Text to correct"

  It implements the same language detection heuristic and calls OpenAI's chat completions
  endpoint with the same parameters as the Supabase Edge Function.
*/

import fs from 'fs'
import path from 'path'

const argv = process.argv.slice(2)
const defaultText = 'Dette er en test med teh og  dobbel  mellemrum.'
const text = argv.length ? argv.join(' ') : defaultText

// load .env if present
const envPath = path.resolve(process.cwd(), '.env')
if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, 'utf8')
  env.split(/\n/).forEach((line) => {
    const m = line.match(/^([^=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim()
  })
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
if (!OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is not set in your environment (.env).')
  process.exit(2)
}

function detectLanguage(s) {
  if (!s || typeof s !== 'string') return 'en'
  const sample = s.toLowerCase()
  if (/[æøåÆØÅ]/.test(sample)) return 'da'
  const danishWords = [' og ', ' det ', ' en ', ' der ', ' på ', ' til ', ' med ', ' ikke ', ' er ']
  let score = 0
  for (const w of danishWords) if (sample.includes(w)) score++
  if (score >= 2) return 'da'
  return 'en'
}

const language = detectLanguage(text)

const system = `You are a professional spelling and grammar assistant. Correct the user's text for spelling, grammar and punctuation while preserving meaning, intent and formatting. Do NOT return any code blocks or runnable code. Return ONLY the corrected text as plain text in the response message.`

const userPrompt = `Please correct the following text (language: ${language}) and return only the corrected text.\n\n---INPUT START---\n${text}\n---INPUT END---\n\nDo not add commentary or analysis.`

async function run() {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'o4-mini',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userPrompt }
        ],
        temperature: 1.0,
        max_completion_tokens: 1200
      })
    })

    const body = await res.text()
    if (!res.ok) {
      console.error('OpenAI request failed', res.status, body)
      process.exit(3)
    }

    let data
    try { data = JSON.parse(body) } catch (e) { console.error('Failed to parse OpenAI JSON:', e); process.exit(4) }

    const content = data?.choices?.[0]?.message?.content
    if (!content) {
      console.error('OpenAI returned unexpected response:', JSON.stringify(data, null, 2))
      process.exit(5)
    }

    console.log('Detected language:', language)
    console.log('Corrected text:')
    console.log(content.trim())
  } catch (err) {
    console.error('Request failed:', err)
    process.exit(6)
  }
}

run()
