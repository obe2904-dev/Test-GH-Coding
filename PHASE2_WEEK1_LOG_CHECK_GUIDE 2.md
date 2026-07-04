# Phase 2 Week 1: Log Verification Guide

## Check Supabase Logs

**URL:** https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/functions/get-weekly-strategy/logs

## What to Look For

### Expected Log Output (✅ Working)
```
[Phase2c DEBUG] Brand voice structure: {
  has_bv: true,
  has_v5: true,
  has_guardrails: true,
  v5_keys: ['voice', 'version', 'guardrails', 'generated_at', ...],
  guardrails_keys: ['never_say', 'length_limits', 'avoid_patterns', 'forbidden_phrases', ...],
  forbidden_count: 31,
  technical_count: 12,
  weather_count: 10
}
```

### Problem Scenarios

#### Scenario A: brand_profile_v5 missing
```
[Phase2c DEBUG] Brand voice structure: {
  has_bv: true,
  has_v5: false,  ← PROBLEM
  has_guardrails: false,
  v5_keys: 'NO V5',
  forbidden_count: 0
}
```
**Fix:** Check get-weekly-strategy/index.ts line 1116 - brand_profile_v5 not being passed

#### Scenario B: guardrails missing
```
[Phase2c DEBUG] Brand voice structure: {
  has_bv: true,
  has_v5: true,
  has_guardrails: false,  ← PROBLEM
  v5_keys: ['voice', 'version', 'generated_at'],  ← No 'guardrails' key
  guardrails_keys: 'NO GUARDRAILS',
  forbidden_count: 0
}
```
**Fix:** Check database - brand_profile_v5.guardrails field missing

#### Scenario C: forbidden_phrases array empty
```
[Phase2c DEBUG] Brand voice structure: {
  has_bv: true,
  has_v5: true,
  has_guardrails: true,
  guardrails_keys: ['never_say', 'technical_terms', 'weather_cliches'],  ← No 'forbidden_phrases'
  forbidden_count: 0  ← PROBLEM
}
```
**Fix:** Migration script didn't work - re-run run-phase2-week1-migration.mjs

## After Checking Logs

Report which scenario you see, and we'll fix it.

## Alternative: Local Verification

If logs are unclear, run this to see the actual data structure:

```bash
node debug-brand-voice.mjs
```

This shows exactly what's in the database brand_profile_v5 field.
