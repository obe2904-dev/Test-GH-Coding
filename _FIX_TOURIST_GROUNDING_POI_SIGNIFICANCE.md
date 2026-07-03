# Fix: Tourist Grounding POI Significance Issue

## Problem

On the location dashboard at `http://localhost:3000/dashboard/location`, the "Hvem er i området" section shows:

**Sekundær (30-70% tilstedeværelse)**
- Turister/besøgende

With grounding note:
> "Aarhus Domkirke 162m — turister tiltrækkes af den historiske katedral"

**Issue**: Aarhus Cathedral (Domkirke) is not a significant tourist attraction that draws many visitors, but the system cited it as justification for tourist presence in the area.

## Root Cause

The AI location analyzer cited POIs from Google Places landmarks without filtering for significance. The prompt assumed all churches/cathedrals with `tourist_attraction` type are major draws, which is incorrect for most ordinary churches.

## Solution Implemented

### 1. Added POI Significance Filter to AI Prompt

**File**: `/supabase/functions/populate-location-intelligence/services/claude-analyzer.ts`

**Added REGEL 2 — POI SIGNIFICANCE**:
```
who.notes må IKKE citere en enkelt POI som begrundelse for tourist-tilstedeværelse,
medmindre POI'en er et genuint signifikant turistmål.

SIGNIFIKANTE POIs (OK at citere):
✅ Nationale/internationale attraktioner (ARoS, Tivoli, Den Lille Havfrue)
✅ UNESCO sites (Kronborg, Jelling, Stevns Klint)
✅ Store kulturinstitutioner (Nationalmuseet, Louisiana)
✅ Ikoniske landmarks med stor besøgsvolume (Nyhavn, Skagen Grenen)

IKKE-SIGNIFIKANTE POIs (brug IKKE som tourist-grounding):
❌ Almindelige kirker og domkirker (Aarhus Domkirke, Ribe Domkirke)
❌ Lokale museer uden national betydning
❌ Generiske tourist_attraction tags fra Google Places
❌ Monumenter, statuer, springvand uden ikonisk status
```

### 2. Added Validation Check

**Added validation step #4**:
```
4. TOURIST GROUNDING SIGNIFICANCE:
   Indeholder who.notes en reference til en kirke, domkirke eller almindelig tourist_attraction?
   → Verificer at POI'en er genuint signifikant (ARoS, Tivoli, UNESCO site, etc.)
   Hvis POI'en er en almindelig kirke/domkirke → fjern noten, sæt who.notes = null
```

### 3. Deployment

Function deployed:
```bash
npx supabase functions deploy populate-location-intelligence
```

## How to Apply the Fix

### Option 1: Automatic Re-Analysis (Recommended)

1. Open the Location Intelligence page in the app:
   ```
   http://localhost:3000/dashboard/location
   ```

2. The cache has been cleared (90-day TTL reset), so next time you visit the page, it will automatically re-analyze with the new rules.

### Option 2: Manual Re-Analysis via SQL

Run the SQL script:
```sql
-- File: _fix_tourist_grounding_cache_clear.sql

UPDATE business_location_intelligence
SET 
  who = jsonb_set(who, '{notes}', 'null'::jsonb),
  last_updated_by_ai = NULL
WHERE 
  who->'notes'::text ILIKE '%domkirke%'
  AND who->'notes'::text ILIKE '%turister%';
```

### Option 3: Force Refresh via API

Use the `force_refresh` parameter:
```bash
curl -X POST https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/populate-location-intelligence \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"business_id": "<your_business_id>", "force_refresh": true}'
```

## Expected Result After Fix

**Before**:
```
Sekundær (30-70% tilstedeværelse)
○ Turister/besøgende

Aarhus Domkirke 162m — turister tiltrækkes af den historiske katedral
```

**After**:
```
Sekundær (30-70% tilstedeværelse)
○ Turister/besøgende

(No grounding note, or only if a genuinely significant POI exists like ARoS)
```

## Future Improvements

Consider adding Google Places `user_ratings_total` as a significance metric:
- POIs with <1000 ratings → likely not significant enough to justify tourist presence
- POIs with >10,000 ratings → genuinely significant attractions

## Files Changed

1. `/supabase/functions/populate-location-intelligence/services/claude-analyzer.ts`
   - Added REGEL 2 — POI SIGNIFICANCE
   - Added validation check #4
   - Fixed numbering in validation section

2. `/_fix_tourist_grounding_cache_clear.sql` (new)
   - SQL script to clear invalid cached data

## Testing

1. Visit `http://localhost:3000/dashboard/location`
2. Verify the grounding note no longer cites Aarhus Cathedral
3. If "Turister" still appears in secondary audience, verify no grounding note appears OR only significant POIs are cited
