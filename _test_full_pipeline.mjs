#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://oadwluspjlsnxhgakral.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hZHdsdXNwamxzbnhoZ2FrcmFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE1OTcxOTQsImV4cCI6MjA0NzE3MzE5NH0.lkIEqTrmnvPPztKAHx2HJGOjW3n1PoW6s1LNkiF71WY',
  {
    auth: {
      persistSession: false,
    }
  }
);

// Sign in as test user
const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
  email: 'ole.baek@gmail.com',
  password: 'Ole.Baek.2023'
});

if (authError) {
  console.error('❌ Auth error:', authError);
  process.exit(1);
}

console.log('✅ Authenticated as:', authData.user.email);

// Trigger analysis with force_refresh
const { data, error } = await supabase.functions.invoke('analyze-and-distribute-website', {
  body: {
    url: 'https://cafefaust.dk',
    force_refresh: true
  }
});

if (error) {
  console.error('❌ Analysis error:', error);
  process.exit(1);
}

console.log('✅ Analysis result:', JSON.stringify(data, null, 2));
