# Brand Profile V5 Integration Guide
## Phase 2A + 2B Implementation

This guide shows the exact code changes needed for `generate-brand-profile-v5` Edge Function.

---

## Prerequisites

1. ✅ Migration applied: `20260625000002_add_brand_profile_location_strategy.sql`
2. ✅ Helper modules deployed:
   - `_shared/brand-profile/location-strategy-config.ts`
   - `_shared/brand-profile/competitive-gap-analyzer.ts`
   - `_shared/brand-profile/location-strategy.ts`

---

## Change 1: Update Location Data Fetch Query

**File:** `generate-brand-profile-v5/index.ts`

**Find:**
```typescript
const { data: location } = await supabaseClient
  .from('business_location_intelligence')
  .select(`
    neighborhood,
    neighborhood_character,
    area_type,
    category_scores,
    landmarks_nearby,
    nearby_hospitality,
    // ... other fields
  `)
  .eq('business_id', businessId)
  .single()
```

**Replace with:**
```typescript
const { data: location } = await supabaseClient
  .from('business_location_intelligence')
  .select(`
    neighborhood,
    neighborhood_character,
    area_type,
    category_scores,
    demographic_proximity,
    physical_context,
    raw_competitive_venues,
    landmarks_nearby,
    nearby_hospitality,
    category_modifiers,
    location_marketing_hooks,
    local_location_reference,
    latitude,
    longitude
  `)
  .eq('business_id', businessId)
  .maybeSingle()

// Log the split fields
console.log(`[${requestId}] ✅ Location geography (WHERE): ${JSON.stringify(location?.category_scores || {})}`)
console.log(`[${requestId}] ✅ Location demographics (WHO nearby): ${JSON.stringify(location?.demographic_proximity || {})}`)
console.log(`[${requestId}] ✅ Physical context: pedestrian_flow=${location?.physical_context?.pedestrian_flow || 'unknown'}`)
```

---

## Change 2: Fix extractToneRelevantDemographics

**File:** `generate-brand-profile-v5/index.ts`

**Find this block:**
```typescript
const DEMOGRAPHIC_TYPES = ['student', 'tourist'];
const LOCATION_TYPES = ['city_centre', 'waterfront', 'residential', 'office', /* etc */];

const demographicScores = location?.category_scores
  ? Object.fromEntries(
      Object.entries(location.category_scores)
        .filter(([key]) => DEMOGRAPHIC_TYPES.includes(key))
    )
  : {};

const locationScores = location?.category_scores
  ? Object.fromEntries(
      Object.entries(location.category_scores)
        .filter(([key]) => LOCATION_TYPES.includes(key))
    )
  : {};
```

**Replace with:**
```typescript
// demographic_proximity is the dedicated field for WHO is nearby
// category_scores contains only geographic types (city_centre, waterfront, etc.)
const demographicScores = location?.demographic_proximity || {};
const locationScores = location?.category_scores || {};

console.log(`[${requestId}] 👥 Demographic proximity scores:`, 
  Object.keys(demographicScores).length > 0
    ? Object.entries(demographicScores).map(([k, v]) => `${k}=${v}`).join(', ')
    : 'None'
)
console.log(`[${requestId}] 📍 Location scores:`,
  Object.keys(locationScores).length > 0
    ? Object.entries(locationScores).map(([k, v]) => `${k}=${v}`).join(', ')
    : 'None'
)
```

**Note:** Remove the `DEMOGRAPHIC_TYPES` and `LOCATION_TYPES` arrays entirely - no longer needed.

---

## Change 3: Fix voiceProfile Location Filter

**File:** `generate-brand-profile-v5/index.ts`

**Find:**
```typescript
locationIntelligence: location ? {
  category_scores: location.category_scores 
    ? Object.fromEntries(
        Object.entries(location.category_scores)
          .filter(([key]) => !['student', 'tourist'].includes(key))
      )
    : location.category_scores,
  neighborhood_character: location.neighborhood_character,
  area_type: location.area_type,
} : undefined,
```

**Replace with:**
```typescript
locationIntelligence: location ? {
  // category_scores now contains only geographic types — no filtering needed
  category_scores: location.category_scores || {},
  // demographic_proximity is the separate field for student/tourist signals
  demographic_proximity: location.demographic_proximity || {},
  neighborhood_character: location.neighborhood_character,
  area_type: location.area_type,
  physical_context: location.physical_context || null,
} : undefined,
```

---

## Change 4: Fix generateToneDNA Input

**File:** `tone-dna-generator.ts`

**Update the input interface:**
```typescript
interface ToneDNAInput {
  business: {
    name: string;
    city: string;
    country: string;
    om_os_text: string;
  };
  location_intelligence?: {
    category_scores: Record<string, number>;        // geographic types only
    demographic_proximity: Record<string, number>;  // student, tourist, etc.
    neighborhood_character?: string;
    area_type?: string;
    location_marketing_hooks?: string[];
    physical_context?: {
      pedestrian_flow?: string;
      transit_within_150m?: boolean;
      nearest_transit?: { name: string; distance_meters: number } | null;
      parking_within_300m?: boolean;
    } | null;
    local_location_reference?: string;
  };
  // ... rest of interface
}
```

**In `index.ts`, update the call:**
```typescript
toneDNA = await generateToneDNA(
  {
    business: {
      name: business.name,
      city: geographicContext?.city_profile?.city || business.city || 'Unknown',
      country: 'Danmark',
      om_os_text: omOsText || 'Not provided'
    },
    location_intelligence: location ? {
      category_scores: location.category_scores || {},       // WHERE (geographic)
      demographic_proximity: location.demographic_proximity || {},  // WHO nearby
      neighborhood_character: location.neighborhood_character,
      area_type: location.area_type,
      location_marketing_hooks: location.location_marketing_hooks,
      physical_context: location.physical_context || null,
      local_location_reference: business.local_location_reference 
        || location.local_location_reference 
        || undefined,
    } : undefined,
    // ... rest of parameters
  },
  // ... other arguments
)
```

**Update prompt construction in `generateToneDNA`:**

If the prompt references location data, ensure it uses both fields:

```typescript
const locationContext = input.location_intelligence ? `
LOCATION CONTEXT:
Geographic positioning (WHERE):
${Object.entries(input.location_intelligence.category_scores)
  .map(([type, score]) => `- ${type}: ${score}`)
  .join('\n')}

Demographics nearby (WHO):
${Object.entries(input.location_intelligence.demographic_proximity || {})
  .map(([demo, score]) => `- ${demo}: ${score}% proximity`)
  .join('\n')}

Physical context:
- Pedestrian flow: ${input.location_intelligence.physical_context?.pedestrian_flow || 'unknown'}
- Transit within 150m: ${input.location_intelligence.physical_context?.transit_within_150m ? 'Yes' : 'No'}
` : '';
```

---

## Change 6: Add Location Strategy Generation

**File:** `generate-brand-profile-v5/index.ts`

**Add import at top:**
```typescript
import { generateLocationStrategy } from '../_shared/brand-profile/location-strategy.ts'
```

**Add this block after USP extraction (before Layer 1):**
```typescript
// ===== LAYER 0: LOCATION STRATEGY =====
console.log(`[${requestId}] 📍 Layer 0: Generating location strategy...`)

let locationStrategy = null;
let generationStatus = {
  location_status: 'missing' as 'complete' | 'missing' | 'partial',
  fallback_mode: false,
  warnings: [] as string[]
};

if (location) {
  try {
    generationStatus.location_status = 'complete';
    
    locationStrategy = await generateLocationStrategy({
      location_scores: location.category_scores || {},
      demographic_proximity: location.demographic_proximity || {},
      physical_context: location.physical_context || null,
      business: {
        name: business.name,
        category: business.category || business.business_category || '',
        avg_price: crossMenuSummary?.overall_avg_price || null,
        booking_required: operations?.reservation_required ?? false,
        accepts_walkins: operations?.accepts_walkins ?? true,
        has_outdoor_seating: operations?.has_outdoor_seating ?? false,
        about: omOsText || undefined,
        programmes: programmes.map(p => ({
          type: p?.type || p?.programme_type || 'unknown',
          label: p?.label || p?.name || 'Unnamed',
          time_windows: p?.timeWindow 
            ? [`${p.timeWindow.start || '00:00'}-${p.timeWindow.end || '23:59'}`]
            : p?.time_windows || ['00:00-23:59']
        }))
      },
      neighborhood: location.neighborhood || null,
      neighborhood_character: location.neighborhood_character || null,
      local_location_reference: business.local_location_reference 
        || location.local_location_reference 
        || null,
      raw_competitive_venues: location.raw_competitive_venues || null,
      language: language,
      openai_client: openaiClient // For competitive gap analysis
    });

    console.log(`[${requestId}] ✅ Location strategy generated:`)
    console.log(`[${requestId}]    Reachable demographics: ${locationStrategy.reachable_demographics.filter(d => d.is_reachable).map(d => d.demographic).join(', ') || 'none'}`)
    console.log(`[${requestId}]    Filtered out: ${locationStrategy.reachable_demographics.filter(d => !d.is_reachable).map(d => `${d.demographic} (${d.filter_reason})`).join(', ') || 'none'}`)
    console.log(`[${requestId}]    Positioning angles: ${locationStrategy.positioning_angles.length}`)
    console.log(`[${requestId}]    Content triggers: ${locationStrategy.content_triggers.length}`)
    console.log(`[${requestId}]    Competitive gap: ${locationStrategy.competitive_gap?.gap_description || 'none detected'}`)
    
  } catch (error) {
    console.warn(`[${requestId}] ⚠️ Location strategy generation failed:`, error);
    generationStatus.fallback_mode = true;
    generationStatus.warnings.push('Location strategy unavailable - using generic audience targeting');
  }
} else {
  console.warn(`[${requestId}] ⚠️ No location intelligence available - skipping location strategy`);
  generationStatus.location_status = 'missing';
  generationStatus.fallback_mode = true;
  generationStatus.warnings.push('Location intelligence not generated yet - generate it for local positioning');
}
```

---

## Change 8: Save Location Strategy to Database

**File:** `generate-brand-profile-v5/index.ts`

**Update the v5Profile object to include location_strategy in layer_0_intelligence:**
```typescript
const v5Profile = {
  layer_0_intelligence: {
    // ... existing fields (usps, key_offerings, etc.)
    
    // NEW: Location strategy (crossing geography × business facts)
    location_strategy: locationStrategy ? {
      reachable_demographics: locationStrategy.reachable_demographics,
      positioning_angles: locationStrategy.positioning_angles,
      content_triggers: locationStrategy.content_triggers,
      physical_opportunities: locationStrategy.physical_opportunities,
      competitive_gap: locationStrategy.competitive_gap,
    } : null,
  },
  // ... rest of profile structure
};
```

**Update the database upsert:**
```typescript
const { error: upsertError } = await supabaseClient
  .from('business_brand_profile')
  .upsert({
    business_id: businessId,
    brand_profile_v5: v5Profile,
    
    // NEW: Top-level columns for fast access
    location_strategy: locationStrategy,
    generation_status: {
      menu_status: menuData ? 'complete' : 'missing',
      location_status: generationStatus.location_status,
      brand_profile_status: 'complete',
      missing_components: generationStatus.location_status === 'missing' 
        ? ['location_intelligence'] 
        : [],
      fallback_mode: generationStatus.fallback_mode,
      warnings: generationStatus.warnings
    },
    data_sources_used: {
      menu_data: !!menuData,
      location_intelligence: !!location,
      business_profile: !!omOsText,
      operations: !!operations
    },
    
    last_generated: new Date().toISOString(),
  }, {
    onConflict: 'business_id'
  });
```

**Update the response:**
```typescript
return new Response(
  JSON.stringify({
    success: true,
    brand_profile_v5: v5Profile,
    generation_status: {
      menu_status: menuData ? 'complete' : 'missing',
      location_status: generationStatus.location_status,
      brand_profile_status: 'complete',
      missing_components: generationStatus.location_status === 'missing' 
        ? ['location_intelligence'] 
        : [],
      fallback_mode: generationStatus.fallback_mode,
      warnings: generationStatus.warnings
    },
    data_sources_used: {
      menu_data: !!menuData,
      location_intelligence: !!location,
      business_profile: !!omOsText,
      operations: !!operations
    }
  }),
  { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
);
```

---

## Deployment Checklist

### 1. Apply Migration
```sql
-- In Supabase Dashboard SQL Editor
\i supabase/migrations/20260625000002_add_brand_profile_location_strategy.sql

-- Verify
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'business_brand_profile' 
AND column_name IN ('location_strategy', 'generation_status', 'data_sources_used');
```

### 2. Deploy Helper Modules
```bash
# Ensure these files are in _shared/brand-profile/:
# - location-strategy-config.ts ✓
# - competitive-gap-analyzer.ts ✓
# - location-strategy.ts ✓

# Deploy entire _shared directory or verify it's already deployed
```

### 3. Apply Code Changes
Apply all changes (1-4, 6, 8) to `generate-brand-profile-v5/index.ts` and `tone-dna-generator.ts`

### 4. Deploy Edge Function
```bash
supabase functions deploy generate-brand-profile-v5
```

### 5. Test with K-BBQ
```bash
curl -X POST \
  'https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/generate-brand-profile-v5' \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -d '{"business_id": "K_BBQ_BUSINESS_ID"}'
```

### 6. Verify Database
```sql
SELECT 
  business_id,
  location_strategy->'positioning_angles' as positioning_angles,
  location_strategy->'competitive_gap'->>'gap_description' as competitive_gap,
  location_strategy->'reachable_demographics' as demographics,
  generation_status->>'fallback_mode' as fallback_mode,
  generation_status->'warnings' as warnings
FROM business_brand_profile
WHERE business_id = 'K_BBQ_BUSINESS_ID';
```

---

## Expected Results

### K-BBQ (High Price + Booking Required)

**Reachable demographics:**
- ✅ local_resident (proximity: 60)
- ✅ business_professional (proximity: 45)
- ❌ tourist (filtered: "booking_required excludes spontaneous visits")
- ❌ student (filtered: "avg_price 420 DKK exceeds student budget 200 DKK")

**Positioning angles:**
- "Central location in Silkeborg centrum — convenience positioning"
- "Business district proximity — lunch and after-work positioning"

**Competitive gap:**
- "Unique Korean BBQ concept in area — novelty and experience positioning"

---

## Troubleshooting

### Issue: "category_scores still has student/tourist"
**Cause:** Old location intelligence data
**Fix:** Regenerate location intelligence for test business

### Issue: "location_strategy is null"
**Cause:** Location intelligence not generated yet
**Fix:** Expected behavior - should show fallback_mode: true with warning

### Issue: "competitive_gap is null"
**Cause:** No openai_client passed or no competitors
**Fix:** Verify OpenAI client initialization in Edge Function

### Issue: "Type error on programmes mapping"
**Cause:** Programme structure mismatch
**Fix:** Log actual programme structure and adjust mapping

---

## Success Criteria

✅ No errors during brand profile generation  
✅ location_strategy saved to database  
✅ generation_status shows complete or fallback_mode  
✅ category_scores contains only geographic types  
✅ demographic_proximity contains student/tourist/etc  
✅ Reachable demographics filters correctly  
✅ Competitive gap analysis runs (if competitors present)  
✅ Logs show clear crossing decisions  

---

## Next Steps

After successful deployment:
1. Test with multiple business types (varied pricing, booking requirements)
2. Monitor generation_status.warnings in production
3. Tune thresholds in location-strategy-config.ts based on real data
4. Phase 2C: Update audience segmentation to consume reachable_demographics
