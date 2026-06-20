# How to Check Supabase Function Logs

## 1. Via Supabase Dashboard (Recommended)

### Step 1: Navigate to Function Logs
1. Go to: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/functions
2. Click on `get-weekly-strategy` function
3. Click the "Logs" tab
4. Filter by time range: Last 24 hours (or select May 3, 2026)

### Step 2: Search for Diagnostic Patterns

Search for these exact strings in the logs:

#### Detection Logs (Did booking-occasion detection fire?)
```
🎉 Booking-critical occasion detected
```
**Expected:** Should appear if detection worked  
**If missing:** Detection failed - event data format is wrong

#### Validation Logs (Did content-timing validation run?)
```
[weekly-strategy-generator] Validation
```
**Expected:** Should show validation results for each post  
**If missing:** Validation checkpoint isn't running

#### Archetype Logs (Is archetype data flowing through?)
```
Using database archetype: cafe_bar
```
**Expected:** Should see this instead of "Unknown archetype"  
**If "Unknown archetype" appears:** Archetype fix didn't work

#### Content Type Logs (Is inferred_content_type being set?)
```
Inferred content type from dish service period
```
**Expected:** Should appear for menu posts  
**If missing:** Menu item doesn't have service_periods

#### Menu Lookup Logs (Why "Beef" instead of "kalveculotte"?)
```
dish_index
```
**Look for:** Lines showing dish index, menu item lookup  
**Check:** Does it say "dish_index invalid" or "fallback to normalised name"?

---

## 2. Via Supabase CLI (Alternative)

### Command:
```bash
npx supabase functions logs get-weekly-strategy \
  --project-ref kvqdkohdpvmdylqgujpn \
  --limit 500
```

### Filter output:
```bash
# Look for detection
npx supabase functions logs get-weekly-strategy --project-ref kvqdkohdpvmdylqgujpn | grep "occasion"

# Look for validation
npx supabase functions logs get-weekly-strategy --project-ref kvqdkohdpvmdylqgujpn | grep -i "validation"

# Look for errors
npx supabase functions logs get-weekly-strategy --project-ref kvqdkohdpvmdylqgujpn | grep -i "error"
```

---

## 3. What to Look For

### ✅ Success Indicators
- `"🎉 Booking-critical occasion detected: Mors Dag"`
- `"[Phase 2b] Inferred content type from dish service period: dinner"`
- `"[weekly-strategy-generator] Validation result: { violations: [], ... }"`
- `"[deriveWeeklyInterpretation] Using database archetype: cafe_bar"`

### 🚨 Failure Indicators
- `"Unknown archetype: full_service_restaurant"` (archetype still broken)
- NO "🎉 Booking-critical occasion" message (detection didn't fire)
- NO validation logs (validation not running)
- `"dish_index invalid"` or `"fallback to normalised name"` (menu lookup failed)
- Any `"ERROR"` messages

### 🔍 Critical Questions to Answer
1. **Did detection fire?** → Search for "🎉 Booking-critical"
2. **What is the event data structure?** → Look for event objects in logs
3. **Did validation run?** → Search for "Validation result"
4. **Is content_type being set?** → Search for "Inferred content type"
5. **Why "Beef"?** → Search for "dish_index"

---

## 4. Copy Relevant Log Sections

Once you find the logs, copy and paste these sections:

### A. Full context.events Object
Look for where events are logged, should show structure like:
```json
{
  "events": [
    {
      "name": "...",
      "name_dk": "...",
      "event_type": "...",
      "date": "..."
    }
  ]
}
```

### B. Phase 2b Detection Output
Should appear 3 times (one per post):
```
[Phase 2b] Processing post...
[Phase 2b] 🎉 Booking-critical occasion detected: ...
```

### C. Validation Results
Should show for each post:
```
[weekly-strategy-generator] Validation result: {
  violations: [...],
  auto_fix_applied: true/false,
  ...
}
```

### D. Any Errors
Copy full error stack traces if present.

---

## Next Steps

After checking logs and running the SQL diagnostics:

1. **Report findings** in this format:
   - Detection fired: YES/NO
   - Event data format: (paste structure)
   - Validation ran: YES/NO
   - Content type populated: YES/NO
   - Menu lookup: (what happened)

2. **Based on findings**, we'll create targeted fixes:
   - If detection didn't fire → fix event detection logic
   - If validation didn't run → fix checkpoint integration
   - If content_type not set → fix menu data or fallback
   - If all systems fired but still generic → fix prompt strength

3. **One fix at a time** with verification before moving to next issue.
