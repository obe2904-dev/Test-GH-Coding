# Phase 1 Deployment Guide - V5 Layer 3 Integration

**Date**: May 8, 2026  
**Phase**: Phase 1 - Layer 3 (Identity Profile) Integration  
**Risk Level**: LOW (feature flags + test business only + fallback)

---

## Pre-Deployment Checklist

- [x] Phase 0 complete (types, utilities, data fetchers)
- [x] Unit tests passing (26/26)
- [x] Integration tests passing (8/8)
- [x] Café Faust V5 data verified (100% ready)
- [x] V5 imports added to get-weekly-strategy
- [x] v5_identity field added to WeekContext type
- [x] Phase 1 prompt updated with V5 identity section
- [x] Test script created

## Step 1: Set Environment Variables

Navigate to **Supabase Dashboard** → **Settings** → **Edge Functions** → **Secrets**

Add the following environment variables:

```bash
# V5 Feature Flags
V5_ENABLED=true                                # Master enable/disable
V5_LAYER3_ENABLED=false                       # Phase 1 control (start disabled)
V5_LAYER4_ENABLED=false                       # Phase 2 control
V5_QUALITY_RULES_ENABLED=false                # Phase 3 control
V5_EVIDENCE_ENABLED=false                     # Phase 4 control

# Safety Controls
V5_TEST_BUSINESS_ONLY=true                    # Limit to test businesses
V5_TEST_BUSINESS_IDS=2037d63c-a138-4247-89c5-5b6b8cef9f3f  # Café Faust

# Logging Controls
V5_DEBUG=true                                  # Enable debug logging
V5_LOG_COMPARISONS=true                       # Log V5 vs legacy
V5_LOG_EVIDENCE=false                         # Evidence validation logs
```

**CRITICAL**: Set `V5_LAYER3_ENABLED=false` initially for shadow mode testing.

---

## Step 2: Deploy Updated Functions

Deploy the updated `get-weekly-strategy` function:

```bash
cd "/Users/olebaek/Library/Mobile Documents/com~apple~CloudDocs/Test P2G 1-iCloud"

supabase functions deploy get-weekly-strategy --project-ref kvqdkohdpvmdylqgujpn
```

Expected output:
```
Deploying function get-weekly-strategy (x/y)
Deployed function get-weekly-strategy in x.xxs
```

---

## Step 3: Shadow Mode Testing

With `V5_LAYER3_ENABLED=false`, the function will:
- Fetch V5 identity profile
- Log V5 data fetch success/failure
- NOT inject V5 into prompts
- Continue using legacy brand_voice

**Test Shadow Mode:**

```bash
deno run --allow-net --allow-env --allow-read --env-file=.env scripts/test-phase1-integration.ts
```

**Check Supabase Logs:**
- Navigate to **Edge Functions** → **get-weekly-strategy** → **Logs**
- Look for: `[get-weekly-strategy] V5 Layer 3 enabled - fetching identity profile`
- Look for: `[get-weekly-strategy] V5 identity profile loaded: { confidence: "90%", coreValues: 4 }`

**Expected**: V5 data fetched successfully, but not used in strategy generation.

---

## Step 4: Enable V5 Layer 3

Once shadow mode confirms V5 data fetches correctly:

**Update Environment Variable:**
```bash
V5_LAYER3_ENABLED=true
```

This activates V5 identity injection into Phase 1 prompts.

---

## Step 5: Generate Test Strategy

Trigger weekly strategy generation for Café Faust:

**Option A: Via Frontend**
1. Navigate to `http://localhost:3000/dashboard/programmes`
2. Select Café Faust
3. Click "Generate Weekly Strategy"
4. Monitor progress

**Option B: Via API**
```bash
deno run --allow-net --allow-env --allow-read --env-file=.env scripts/test-phase1-integration.ts
```

---

## Step 6: Validation Checks

### Check 1: V5 Data Fetch Success
**Supabase Logs** should show:
```json
{
  "phase": "V5-FETCH-LAYER3",
  "businessId": "2037d63c-a138-4247-89c5-5b6b8cef9f3f"
}
{
  "phase": "V5-FETCH-LAYER3-SUCCESS",
  "businessId": "2037d63c-a138-4247-89c5-5b6b8cef9f3f",
  "confidence": 0.9
}
```

### Check 2: V5 Identity in Strategy
Retrieve generated strategy from database:
```sql
SELECT 
  id,
  narrative,
  strategic_priorities,
  generated_at
FROM weekly_strategies
WHERE business_id = '2037d63c-a138-4247-89c5-5b6b8cef9f3f'
ORDER BY generated_at DESC
LIMIT 1;
```

**Expected**:
- Narrative mentions "ved åen" (location reference from V5)
- Strategic priorities align with V5 core values
- Brand consistency improved vs. legacy

### Check 3: Brand Consistency
Compare with previous week's strategy (if exists):
- **Location naming**: Should use "ved åen" not "ved Aarhus Å"
- **Brand voice**: Should reflect V5 positioning
- **Core values**: Should align with V5 core_values array

---

## Step 7: A/B Comparison (Optional)

To measure quality improvement:

1. **Generate with V5 OFF:**
   ```bash
   V5_LAYER3_ENABLED=false
   ```
   Regenerate strategy, save as "Legacy Strategy"

2. **Generate with V5 ON:**
   ```bash
   V5_LAYER3_ENABLED=true
   ```
   Regenerate strategy, save as "V5 Strategy"

3. **Compare:**
   - Brand consistency
   - Location naming
   - Factual accuracy
   - Strategic depth

---

## Success Criteria

Phase 1 is successful if:

- ✅ V5 identity data fetches successfully (no errors)
- ✅ V5 identity appears in Phase 1 prompts
- ✅ Weekly strategy generation completes without errors
- ✅ Brand consistency ≥ 95% (location naming, core values)
- ✅ No regressions in strategy quality
- ✅ Fallback to legacy works if V5 data missing

---

## Rollback Procedure

### Immediate Rollback (Emergency)
```bash
V5_ENABLED=false
```
This disables ALL V5 features instantly. System reverts to legacy immediately.

### Phase 1 Only Rollback
```bash
V5_LAYER3_ENABLED=false
```
Keeps V5 infrastructure but disables Layer 3 injection.

### Full Deployment Rollback
```bash
cd "/Users/olebaek/Library/Mobile Documents/com~apple~CloudDocs/Test P2G 1-iCloud"
git revert <commit-hash>
supabase functions deploy get-weekly-strategy --project-ref kvqdkohdpvmdylqgujpn
```

---

## Monitoring

### Key Metrics to Watch

1. **V5 Fetch Success Rate**
   - Target: 100% for Café Faust
   - Check Supabase logs for `V5-FETCH-LAYER3-SUCCESS`

2. **Strategy Generation Success Rate**
   - Target: 100% (no regressions)
   - Check for errors in weekly_strategies table

3. **Brand Consistency**
   - Target: 95%+ location naming consistency
   - Manual review of generated strategies

4. **Strategy Quality**
   - Target: No regression vs. legacy
   - Compare strategic priorities depth

### Log Queries

**Check V5 fetch attempts:**
```sql
SELECT 
  log_time,
  message
FROM edge_function_logs
WHERE function_name = 'get-weekly-strategy'
  AND message LIKE '%V5%'
ORDER BY log_time DESC
LIMIT 20;
```

---

## Known Issues & Limitations

### Issue 1: local_location_reference Missing
**Status**: Known, not blocking  
**Impact**: Low (will fetch from business_location_intelligence later)  
**Workaround**: Field currently optional in V5 types

### Issue 2: "Dagligt" Timing Parser
**Status**: Known, minor  
**Impact**: Very low (rare Danish day format)  
**Fix**: Handled in Phase 0, not blocking Phase 1

---

## Next Steps After Phase 1

Once Phase 1 is stable (7+ days in production):

### Phase 2: Layer 4 Integration (Week 2)
- Fetch programme-specific audience segments
- Integrate into slot assignment
- Enable `V5_LAYER4_ENABLED=true`

### Phase 3: Content Quality Rules (Week 3)
- Brunch terminology enforcement
- Location consistency validation
- Enable `V5_QUALITY_RULES_ENABLED=true`

### Phase 4: Evidence Validation (Week 4)
- Fact-checking gates for content claims
- Evidence-based angle validation
- Enable `V5_EVIDENCE_ENABLED=true`

---

## Support & Debugging

### If V5 data fetch fails:
1. Check Café Faust has V5 data: `deno run scripts/audit-v5-data-quality.ts`
2. Check environment variables in Supabase Dashboard
3. Check logs for error messages
4. Verify service role key has read access to business_brand_profile

### If strategy generation fails:
1. Check Supabase logs for error details
2. Verify V5 types are correctly imported
3. Check weekContext includes v5_identity field
4. Rollback to `V5_LAYER3_ENABLED=false` if needed

### If quality degrades:
1. Enable `V5_LOG_COMPARISONS=true`
2. Generate A/B comparison
3. Review prompt integration
4. Adjust V5 identity section formatting if needed

---

**Deployment Owner**: AI Development Team  
**Deployment Date**: May 8, 2026  
**Review Date**: May 15, 2026 (1 week after deployment)
