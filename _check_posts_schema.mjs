/**
 * Script to check and fix the posts table schema for suggested_time column
 * Run with: node _check_posts_schema.mjs
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://kvqdkohdpvmdylqgujpn.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const key = supabaseServiceKey || supabaseAnonKey

console.log('🔧 Supabase URL:', supabaseUrl)
console.log('🔑 Using key:', key ? key.substring(0, 20) + '...' : 'NONE')

if (!key) {
  console.error('\n❌ Missing Supabase key')
  console.error('   Set SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY as environment variable')
  console.error('   Example: VITE_SUPABASE_ANON_KEY=your_key node _check_posts_schema.mjs')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, key)

async function checkPostsTable() {
  console.log('🔍 Checking posts table schema...\n')
  
  // Try to query the table to see if it exists and what columns it has
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .limit(1)
  
  if (error) {
    if (error.message.includes('relation "posts" does not exist')) {
      console.log('❌ Posts table does not exist')
      console.log('   You need to run migration: 20260620150000_recreate_posts_table_fresh.sql')
    } else if (error.message.includes('suggested_post_time')) {
      console.log('❌ Column name mismatch detected')
      console.log('   Database is looking for: suggested_post_time')
      console.log('   But code is sending: suggested_post_time')
      console.log('   Run the SQL fix in Supabase dashboard (see below)')
    } else {
      console.log('❌ Error querying posts table:')
      console.log('  ', error.message)
      console.log('   Code:', error.code)
      console.log('   Details:', error.details)
    }
    return
  }
  
  if (data && data.length > 0) {
    console.log('✅ Posts table exists')
    console.log('   Sample row columns:', Object.keys(data[0]).join(', '))
    
    if ('suggested_time' in data[0]) {
      console.log('✅ Column "suggested_time" exists - all good!')
    } else if ('suggested_post_time' in data[0]) {
      console.log('⚠️  Column "suggested_post_time" exists but should be "suggested_time"')
      console.log('   Run the SQL fix below')
    } else {
      console.log('⚠️  Neither suggested_time nor suggested_post_time column found')
      console.log('   Run the SQL fix below')
    }
  } else {
    console.log('✅ Posts table exists but is empty')
    console.log('   Checking via information_schema...')
    
    const { data: colData, error: colError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'posts')
      .in('column_name', ['suggested_time', 'suggested_post_time'])
    
    if (colError) {
      console.log('   Could not query schema:', colError.message)
    } else if (colData) {
      console.log('   Found columns:', colData.map(c => c.column_name).join(', '))
    }
  }
  
  console.log('\n📋 SQL FIX TO RUN IN SUPABASE DASHBOARD:')
  console.log('============================================================')
  console.log(`
-- Run this in the Supabase SQL Editor:
ALTER TABLE public.posts 
  RENAME COLUMN suggested_post_time TO suggested_time;

-- Or if the column doesn't exist at all:
ALTER TABLE public.posts 
  ADD COLUMN suggested_time TEXT;
  
-- Then verify:
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'posts' 
AND column_name LIKE '%suggested%';
`)
  console.log('============================================================')
}

checkPostsTable()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Script error:', err)
    process.exit(1)
  })
