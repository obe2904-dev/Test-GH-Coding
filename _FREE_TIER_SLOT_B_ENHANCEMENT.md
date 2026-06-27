# Free Tier Slot B Enhancement
**Date:** 2026-06-23  
**Context:** Enhance Free tier atmosphere suggestions using all available business_profile fields

## Problem Statement
Free tier was only using `key_offerings` for Slot A (menu items) and limited operational data for Slot B (atmosphere). The business_profile table contains 4 descriptive fields that were either unused or underutilized:
- `ai_place_synopsis` - **ORPHANED** (written but never read anywhere)
- `user_about_text` - Only used in Stage 2 text generation
- `menu_description` - Only used in Stage 2 text generation  
- `long_description` - Only used in brand profile generation (V5)

## Solution: Enhanced Free Tier Slot B Data

### Changes Made

1. **Expanded business_profile query** (line ~1356)
   - BEFORE: Only fetched `key_offerings`
   - AFTER: Fetches `key_offerings, menu_description, user_about_text, long_description, ai_place_synopsis`

2. **Added Free tier profile storage** (line ~1373)
   - Store descriptive fields in `globalThis.__freeTierProfile` for later use
   - Logs which fields are populated for debugging

3. **Enhanced confirmedFactsSlotB** (line ~3115)
   - Added Free tier-specific block after operational facts (outdoor seating, kids menu, takeaway)
   - Priority fallback chain:
     1. `ai_place_synopsis` → "Om stedet: [synopsis]"
     2. `user_about_text` → "Stedet er: [text]"
     3. `menu_description` → "Stedet er: [description]"
     4. `long_description` → "Beskrivelse: [truncated to 200 chars]"
   - Clean up global variable after use

### Priority Rationale

**Why ai_place_synopsis first?**
- AI-generated concise summary (ideal length for atmosphere context)
- Purpose-built for place description
- Currently orphaned in codebase (written but never used)

**Why user_about_text second?**
- Authentic owner voice
- User-curated content (high intent)
- Already validated in Stage 2 text generation

**Why menu_description third?**
- AI-generated menu overview
- Reliable fallback from website analysis
- Already used in voice profile generation

**Why long_description last?**
- Can be lengthy (website "about" sections)
- Truncated to 200 chars to avoid token waste
- Generic website content (lower signal)

## Impact

### Before Enhancement
Free tier Slot B had limited atmosphere anchors:
- Opening hours
- Outdoor seating (weather-dependent)
- Kids menu (if available)
- Takeaway (if available)

**Example confirmedFactsSlotB:**
```
- Åbningstider i dag: 12:00–22:00
- Udeservering i dag — GODT VEJR (18°C, lav vind, ingen nedbør)
```

### After Enhancement
Free tier Slot B now has rich descriptive context:
```
- Åbningstider i dag: 12:00–22:00
- Udeservering i dag — GODT VEJR (18°C, lav vind, ingen nedbør)
- Om stedet: Cozy Italian bistro in Nørrebro with fresh handmade pasta and natural wines
```

**Result:** Atmosphere suggestions can now reference:
- Business character/vibe
- Cuisine style
- Unique selling points
- Neighborhood context

## Field Status After Enhancement

| Field | Written By | Read By | Status |
|-------|-----------|---------|--------|
| `ai_place_synopsis` | website-analysis-saver | ✅ get-quick-suggestions (Free Slot B) | **NOW ACTIVE** |
| `user_about_text` | User onboarding | get-quick-suggestions (Free Slot B), generate-text-from-idea | Active |
| `menu_description` | website-analysis-saver | get-quick-suggestions (Free Slot B), generate-text-from-idea, voice-profile | Active |
| `long_description` | website-analysis-saver | get-quick-suggestions (Free Slot B), brand-profile-generator-v5, location-intelligence | Active |

## Deployment

**Edge Function:** `get-quick-suggestions`  
**Deployed:** 2026-06-23  
**Size:** 382.3kB

## Testing Checklist

- [ ] Verify Free tier generates 2 suggestions (1 menu + 1 atmosphere)
- [ ] Check logs for field usage: "✅ Free tier: Using [field_name] for Slot B"
- [ ] Confirm atmosphere suggestions reference descriptive facts
- [ ] Test fallback chain when fields are NULL
- [ ] Verify long_description truncation at 200 chars
- [ ] Validate globalThis cleanup (no memory leaks)

## Related Files

- `/supabase/functions/get-quick-suggestions/index.ts` (lines ~1356, ~3115)
- `/supabase/functions/_shared/persistence/website-analysis-saver.ts` (writes ai_place_synopsis)
- `/supabase/functions/generate-text-from-idea/resolve-context.ts` (uses user_about_text, menu_description)

## Notes

- `ai_place_synopsis` was previously orphaned (written during website analysis but never read)
- This enhancement makes Free tier Slot B competitive with paid tiers for atmosphere content
- Global variable pattern used for simplicity (Free tier only executes once per request)
- Truncation at 200 chars prevents token waste from verbose website "about" sections
