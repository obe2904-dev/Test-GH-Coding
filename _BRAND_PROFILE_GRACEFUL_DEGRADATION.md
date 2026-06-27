# Brand Profile Graceful Degradation Strategy

## Problem
User flow: Menu → Location → Brand Profile
If power/network fails mid-pipeline, what state do we return?

## Solution: Partial Profile with Missing Data Flags

### Database Schema Addition
```sql
ALTER TABLE business_brand_profile 
ADD COLUMN IF NOT EXISTS generation_status JSONB DEFAULT NULL;

-- Example structure:
-- {
--   "menu_status": "complete" | "missing" | "partial",
--   "location_status": "complete" | "missing" | "partial",
--   "brand_profile_status": "complete" | "missing" | "partial",
--   "missing_components": ["menu_data", "location_intelligence"],
--   "generated_at": "2026-06-25T10:30:00Z",
--   "fallback_mode": true
-- }
```

### Edge Function Response Structure

```typescript
interface BrandProfileV5Response {
  success: boolean;
  brand_profile_v5: any; // The actual profile data
  
  // NEW: Generation status flags
  generation_status: {
    menu_status: 'complete' | 'missing' | 'partial';
    location_status: 'complete' | 'missing' | 'partial';
    brand_profile_status: 'complete' | 'partial';
    missing_components: string[]; // ["menu_data", "location_intelligence"]
    fallback_mode: boolean; // True if using degraded mode
    warnings: string[]; // User-facing warnings
  };
  
  // What was actually used
  data_sources_used: {
    menu_data: boolean;
    location_intelligence: boolean;
    business_profile: boolean;
    operations: boolean;
  };
}
```

### Implementation Pattern

```typescript
// In generate-brand-profile-v5/index.ts

async function generateBrandProfileV5(businessId: string) {
  const generationStatus = {
    menu_status: 'missing' as 'complete' | 'missing' | 'partial',
    location_status: 'missing' as 'complete' | 'missing' | 'partial',
    brand_profile_status: 'partial' as 'complete' | 'partial',
    missing_components: [] as string[],
    fallback_mode: false,
    warnings: [] as string[]
  };

  const dataSourcesUsed = {
    menu_data: false,
    location_intelligence: false,
    business_profile: false,
    operations: false
  };

  // --- LAYER 0: Fetch Menu Data (Critical) ---
  let menuData = null;
  try {
    menuData = await fetchMenuData(businessId);
    if (menuData && menuData.categories?.length > 0) {
      generationStatus.menu_status = 'complete';
      dataSourcesUsed.menu_data = true;
    } else {
      generationStatus.menu_status = 'partial';
      generationStatus.missing_components.push('menu_categories');
      generationStatus.warnings.push('Menu data incomplete - using minimal profile');
    }
  } catch (error) {
    console.error('Menu fetch failed:', error);
    generationStatus.menu_status = 'missing';
    generationStatus.missing_components.push('menu_data');
    generationStatus.fallback_mode = true;
    generationStatus.warnings.push('Menu not generated yet - please complete menu extraction first');
  }

  // --- LAYER 0: Fetch Location Intelligence (Important but not critical) ---
  let locationData = null;
  try {
    locationData = await fetchLocationIntelligence(businessId);
    if (locationData) {
      generationStatus.location_status = 'complete';
      dataSourcesUsed.location_intelligence = true;
    }
  } catch (error) {
    console.error('Location fetch failed:', error);
    generationStatus.location_status = 'missing';
    generationStatus.missing_components.push('location_intelligence');
    generationStatus.fallback_mode = true;
    generationStatus.warnings.push('Location intelligence not generated yet - using generic positioning');
  }

  // --- PROCEED WITH PARTIAL DATA ---
  // Generate what we can with available data
  
  let locationStrategy = null;
  if (locationData) {
    try {
      locationStrategy = generateLocationStrategy({
        location_scores: locationData.category_scores || {},
        demographic_proximity: locationData.demographic_proximity || {},
        // ... rest of input
      });
    } catch (error) {
      console.warn('Location strategy generation failed, continuing without it:', error);
      generationStatus.warnings.push('Location strategy unavailable - using generic audience targeting');
    }
  }

  // Generate brand profile with whatever data we have
  const brandProfile = {
    layer_0_intelligence: {
      // ... other fields
      location_strategy: locationStrategy || null, // null if missing
    },
    // ... rest of profile
  };

  // --- SAVE WITH STATUS FLAGS ---
  await supabase
    .from('business_brand_profile')
    .upsert({
      business_id: businessId,
      brand_profile_v5: brandProfile,
      generation_status: generationStatus,
      data_sources_used: dataSourcesUsed,
      last_generated: new Date().toISOString()
    });

  return {
    success: true,
    brand_profile_v5: brandProfile,
    generation_status: generationStatus,
    data_sources_used: dataSourcesUsed
  };
}
```

### UI Display Strategy

```typescript
// In UI component
function BrandProfileStatus({ generationStatus }) {
  if (!generationStatus.fallback_mode) {
    return <Badge color="green">Complete</Badge>;
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-semibold text-amber-900 mb-1">
            Partial Profile Generated
          </h4>
          <p className="text-xs text-amber-800 mb-2">
            Your brand profile was created with limited data. Complete the following steps for full analysis:
          </p>
          <ul className="space-y-1">
            {generationStatus.missing_components.includes('menu_data') && (
              <li className="text-xs text-amber-800 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                <button className="underline hover:text-amber-900">
                  Generate menu extraction
                </button>
              </li>
            )}
            {generationStatus.missing_components.includes('location_intelligence') && (
              <li className="text-xs text-amber-800 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                <button className="underline hover:text-amber-900">
                  Generate location intelligence
                </button>
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
```

## Fallback Hierarchy

### Menu Missing → Critical Failure
- **Cannot generate**: Tone DNA, Audience Segments, USPs
- **Can generate**: Basic identity from business_profile.om_os_text
- **UI Message**: "Menu required - please complete menu extraction first"
- **Action**: Block brand profile generation, show menu extraction CTA

### Location Missing → Degraded Mode
- **Cannot generate**: Location strategy, physical context positioning
- **Can generate**: Everything else (tone, audience from menu/operations)
- **Fallbacks**:
  - `location_strategy = null`
  - `positioning_angles = []` (empty - use generic)
  - `reachable_demographics = []` (use all demographics from operations)
- **UI Message**: "Generic positioning used - generate location intelligence for local targeting"
- **Action**: Allow brand profile generation, show location intelligence CTA

### Operations Missing → Minor Degradation
- **Cannot generate**: Programme-specific audience segments
- **Can generate**: Everything else
- **Fallbacks**:
  - Assume 7-day operation, 11:00-22:00
  - No booking requirement
  - Accepts walk-ins
- **UI Message**: "Using default hours - update business operations for accuracy"

## Testing Scenarios

### Test 1: Full Pipeline Success
```bash
# All data present
Menu ✓ → Location ✓ → Brand Profile ✓
Result: generation_status.fallback_mode = false
```

### Test 2: Menu Missing
```bash
Menu ✗ → Location ✓ → Brand Profile ✗
Result: Error 400 "Menu data required"
```

### Test 3: Location Missing
```bash
Menu ✓ → Location ✗ → Brand Profile ✓ (degraded)
Result: 
  generation_status.fallback_mode = true
  generation_status.missing_components = ['location_intelligence']
  location_strategy = null
```

### Test 4: Mid-Generation Failure (Network)
```bash
Menu ✓ → Location ✓ → Brand Profile (crashes during AI call)
Result: 
  - Transaction rollback (if wrapped in transaction)
  - OR: Partial profile saved with generation_status.brand_profile_status = 'partial'
  - UI shows: "Generation interrupted - retry to complete"
```

## Recommendations

1. ✅ **Add `generation_status` column to `business_brand_profile`**
2. ✅ **Wrap all data fetches in try-catch with fallback logic**
3. ✅ **Return status flags in every response**
4. ✅ **UI: Show actionable CTAs for missing components**
5. ✅ **Block menu-less generation** (critical dependency)
6. ✅ **Allow location-less generation** (degraded mode OK)
7. ✅ **Log degradation events** for monitoring
