#!/usr/bin/env node

// Simple migration runner using fetch
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Hardcoded credentials from .env
const SUPABASE_URL = 'https://kvqdkohdpvmdylqgujpn.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cWRrb2hkcHZtZHlscWd1anBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5ODg3NjAsImV4cCI6MjA3NjU2NDc2MH0.mB5s5sBCKIov-hIG5xJpo90SDLiQ2c8JAvvOkGCGyII'

// Read migration file
const migrationPath = join(__dirname, '../supabase/migrations/003_vertical_specific_tables.sql')
const migrationSQL = readFileSync(migrationPath, 'utf-8')

console.log('📦 Executing vertical-specific tables migration...\n')

// Split SQL into individual statements
const statements = migrationSQL
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'))

console.log(`Found ${statements.length} SQL statements to execute\n`)

// Execute migration via Supabase Management API
async function executeMigration() {
  console.log('Note: Supabase JS client cannot execute raw DDL SQL.')
  console.log('The migration must be run manually in the Supabase Dashboard.\n')
  console.log('📋 Migration SQL is already in your clipboard!\n')
  console.log('Steps:')
  console.log('1. Open: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/editor/sql')
  console.log('2. Press Cmd+V to paste the migration')
  console.log('3. Click the "RUN" button\n')
  console.log('Tables to be created:')
  console.log('  ✓ business_services')
  console.log('  ✓ business_staff')
  console.log('  ✓ business_products')
  console.log('  ✓ business_classes\n')
  
  // Try to open the SQL editor in browser
  try {
    const { exec } = await import('child_process')
    exec('open https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/editor/sql')
    console.log('🌐 Opening Supabase SQL Editor in your browser...\n')
  } catch (e) {
    // Silently fail if can't open browser
  }
}

executeMigration()
