#!/usr/bin/env node
/**
 * Apply rollback-per-platform-drafts migration
 * 
 * This fixes the "multiple rows returned" error by ensuring drafts
 * have platform=NULL during Create/Design steps.
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const migrationPath = join(__dirname, '../supabase/migrations/20260622000000_rollback_per_platform_drafts.sql')
const migrationSQL = readFileSync(migrationPath, 'utf-8')

console.log('📦 Rolling back per-platform draft constraints...\n')
console.log('⚠️  Note: This migration must be run manually in Supabase Dashboard\n')
console.log('Steps:')
console.log('1. Open: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/sql/new')
console.log('2. Copy the SQL below and paste it into the SQL editor')
console.log('3. Click "RUN"\n')
console.log('='.repeat(80))
console.log(migrationSQL)
console.log('='.repeat(80))
console.log('\nOr run this command if you have psql access:')
console.log('cat supabase/migrations/20260622000000_rollback_per_platform_drafts.sql | psql [CONNECTION_STRING]\n')
