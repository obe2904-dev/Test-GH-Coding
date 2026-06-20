#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

// Fetch logs from Supabase Edge Function
import 'jsr:@std/dotenv/load'

const projectRef = 'kvqdkohdpvmdylqgujpn'
const functionName = 'get-quick-suggestions'

console.log('📜 Fetching logs for', functionName, '...\n')

// Use supabase CLI to fetch logs
const command = new Deno.Command('supabase', {
  args: ['functions', 'logs', functionName, '--project-ref', projectRef, '--limit', '50'],
  stdout: 'piped',
  stderr: 'piped'
})

const { stdout, stderr } = await command.output()

const output = new TextDecoder().decode(stdout)
const errors = new TextDecoder().decode(stderr)

if (errors) {
  console.error('Errors:', errors)
}

// Filter for our debug logs
const lines = output.split('\n')
for (const line of lines) {
  if (line.includes('🔍') || line.includes('Period:') || line.includes('✅ Added') || line.includes('📅 Programs')) {
    console.log(line)
  }
}
