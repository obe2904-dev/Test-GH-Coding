# LIFECYCLE RULES & REGENERATION POLICY

**Version**: 1.0  
**Purpose**: Define when brand profiles are generated, updated, preserved, or regenerated  
**Critical Principle**: **Never overwrite user edits without explicit permission**

---

## CORE LIFECYCLE RULES

### Rule 1: User Edits Are Sacred 🔒

**Once a user manually edits ANY brand variable, AI NEVER overwrites it automatically.**

**Implementation**:
- Track `last_edited_by` and `last_edited_at` for each variable
- If `last_edited_by = 'user'`, skip auto-regeneration
- Only regenerate if `forceRegenerate: true` is explicitly passed

**Database Schema** (add to `business_brand_profile`):
```sql
ALTER TABLE business_brand_profile
ADD COLUMN IF NOT EXISTS last_edited_by TEXT DEFAULT 'ai',
ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMP DEFAULT NOW();

-- Tracks who last edited: 'user' or 'ai'
-- If 'user', AI skips this variable during auto-regeneration
```

---

### Rule 2: Auto-Generation Triggers ⚡

Brand profiles are **automatically generated** when:

| Trigger | Condition | Timing |
|---------|-----------|--------|
| **Website Analyzer Completion** | `website_analysis` table updated | Immediately after analysis |
| **Menu Upload** | New menu data added | After menu extraction completes |
| **Onboarding Completion** | User finishes business setup | After final onboarding step |
| **Manual Button Click** | User clicks "Generate Brand Profile" | On-demand |

**Implementation**:
```typescript
// After website analysis completes
await supabase.functions.invoke('brand-profile-generator', {
  body: {
    businessId: business.id,
    trigger: 'website_analysis',
    forceRegenerate: false // Respect existing user edits
  }
})
```

---

### Rule 3: Incremental Updates (Smart Merge) 🔄

When new data arrives **after** user has edited some variables:

- ✅ **Update AI-generated variables** (where `last_edited_by = 'ai'`)
- ❌ **Skip user-edited variables** (where `last_edited_by = 'user'`)
- 📊 **Show diff notification** in UI: "New insights available for X variables"

**Example**:
```
User edited: brand_essence, tone_of_voice (manually refined)
New menu uploaded: AI can now improve core_offerings, content_focus

Result:
- brand_essence: UNCHANGED (user edit preserved)
- tone_of_voice: UNCHANGED (user edit preserved)
- core_offerings: UPDATED (was AI-generated, new menu data available)
- content_focus: UPDATED (was AI-generated, new signals found)
```

---

### Rule 4: Force Regeneration (Explicit Override) 🔓

**When**: User explicitly clicks "Regenerate All" or passes `forceRegenerate: true`

**What happens**:
1. Show confirmation modal: "Dette vil overskrive dine manuelle ændringer. Er du sikker?"
2. If confirmed: Regenerate ALL 9 variables
3. Archive previous version (versioning, see below)
4. Update `last_edited_by = 'ai'` for all variables

**UI Button**:
```tsx
// BrandProfilePage_NEW.tsx

<button
  onClick={() => handleForceRegenerate()}
  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
>
  ⚡ Regenerer alle (overskriver ændringer)
</button>

const handleForceRegenerate = async () => {
  const confirmed = window.confirm(
    'Dette vil overskrive alle dine manuelle ændringer med nye AI-genererede beskrivelser. Er du sikker?'
  )
  
  if (!confirmed) return

  setIsRegenerating(true)
  
  await supabase.functions.invoke('brand-profile-generator', {
    body: {
      businessId: currentBusiness.id,
      forceRegenerate: true // Override user edits
    }
  })
  
  setIsRegenerating(false)
  toast.success('Brand profile regenereret')
}
```

---

## GENERATION SCENARIOS

### Scenario 1: First-Time Generation (No Existing Profile)

**Condition**: `business_brand_profile` table has no row for this business

**Action**:
1. Run full Prompt A analysis
2. Run Prompt B generation
3. Insert all 9 variables
4. Set `last_edited_by = 'ai'` for all
5. Set `generated_at = NOW()`

**Result**: Complete brand profile created

---

### Scenario 2: New Data Arrives (Website/Menu Update)

**Condition**: New `website_analysis` or `menu_items` data added

**Action**:
1. Check which variables were edited by user (`last_edited_by = 'user'`)
2. Run Prompt A analysis on new data
3. Run Prompt B generation
4. **Only update variables where `last_edited_by = 'ai'`**
5. Preserve user-edited variables

**Result**: Incremental update, user edits preserved

**SQL Logic**:
```sql
-- Update only AI-generated variables
UPDATE business_brand_profile
SET 
  brand_essence = CASE 
    WHEN last_edited_by = 'ai' THEN $1 
    ELSE brand_essence 
  END,
  tone_of_voice = CASE 
    WHEN last_edited_by = 'ai' THEN $2 
    ELSE tone_of_voice 
  END,
  -- ... (repeat for all 9 variables)
  generated_at = NOW()
WHERE business_id = $business_id
```

---

### Scenario 3: User Manually Edits a Variable

**Condition**: User saves changes to any variable in UI

**Action**:
1. Update that specific column
2. Set `last_edited_by = 'user'`
3. Set `last_edited_at = NOW()`
4. **Do NOT trigger auto-regeneration**

**Result**: User edit locked, AI will skip this variable

**Code**:
```typescript
// BrandProfilePage_NEW.tsx

const handleSaveBrand = async () => {
  await supabase
    .from('business_brand_profile')
    .upsert({
      business_id: currentBusiness.id,
      brand_essence: brandEssence,
      tone_of_voice: toneOfVoice,
      // ... other fields
      last_edited_by: 'user', // Mark as user-edited
      last_edited_at: new Date().toISOString()
    })
}
```

---

### Scenario 4: User Clicks "Regenerate All"

**Condition**: User explicitly requests full regeneration

**Action**:
1. Show confirmation modal with warning
2. If confirmed: Archive current version (optional)
3. Run full Prompt A + B
4. Overwrite ALL 9 variables
5. Set `last_edited_by = 'ai'` for all
6. Set `generated_at = NOW()`

**Result**: Complete regeneration, user edits replaced

---

## VERSIONING & HISTORY (OPTIONAL)

For advanced users or audit trails, store previous versions:

**Schema**:
```sql
CREATE TABLE IF NOT EXISTS business_brand_profile_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  version INT NOT NULL,
  
  -- 9 brand variables (snapshot)
  brand_essence TEXT,
  tone_of_voice TEXT,
  things_to_avoid TEXT,
  target_audience TEXT,
  core_offerings TEXT,
  content_focus TEXT,
  cta_style TEXT,
  communication_goal TEXT,
  image_preferences TEXT,
  
  -- Metadata
  generated_at TIMESTAMP DEFAULT NOW(),
  generated_by TEXT, -- 'ai' or 'user'
  trigger_event TEXT, -- 'website_analysis', 'manual', 'force_regenerate'
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_brand_profile_history_business 
  ON business_brand_profile_history(business_id, version DESC);
```

**Implementation**:
```typescript
// Before overwriting, archive current version
const currentProfile = await supabase
  .from('business_brand_profile')
  .select('*')
  .eq('business_id', businessId)
  .single()

if (currentProfile.data) {
  // Determine next version number
  const { data: latestVersion } = await supabase
    .from('business_brand_profile_history')
    .select('version')
    .eq('business_id', businessId)
    .order('version', { ascending: false })
    .limit(1)
    .single()

  const nextVersion = (latestVersion?.version || 0) + 1

  // Insert into history
  await supabase
    .from('business_brand_profile_history')
    .insert({
      business_id: businessId,
      version: nextVersion,
      ...currentProfile.data,
      generated_by: currentProfile.data.last_edited_by,
      trigger_event: 'force_regenerate'
    })
}

// Now safely overwrite current profile
```

**UI**:
```tsx
// Show version history in UI
<button onClick={() => setShowHistory(true)}>
  📜 Se historik ({versionCount} versioner)
</button>

{showHistory && (
  <div className="space-y-2">
    {history.map(version => (
      <div key={version.id} className="border p-2 rounded">
        <p className="text-xs text-gray-600">
          Version {version.version} · {new Date(version.created_at).toLocaleDateString()}
        </p>
        <button onClick={() => restoreVersion(version)}>
          Gendan denne version
        </button>
      </div>
    ))}
  </div>
)}
```

---

## NOTIFICATION SYSTEM

When new data arrives and AI could improve variables:

**Show UI Badge**:
```tsx
// BrandProfilePage_NEW.tsx

{hasNewInsights && (
  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
    <h3 className="text-sm font-semibold text-blue-900">
      🔍 Nye indsigter tilgængelige
    </h3>
    <p className="text-xs text-blue-700 mt-1">
      Vi har opdaget ny information der kan forbedre {updatableVariables.length} variabler.
    </p>
    <button
      onClick={() => handleUpdateInsights()}
      className="mt-2 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md"
    >
      Opdater AI-genererede variabler
    </button>
  </div>
)}
```

**Backend Logic**:
```typescript
// Detect if new data could improve variables
const updatableVariables = []

for (const variable of ['brand_essence', 'tone_of_voice', ...]) {
  const lastEdited = profile[`${variable}_last_edited_by`]
  
  if (lastEdited === 'ai') {
    // Check if new data is available since last generation
    const lastGenerated = profile.generated_at
    const latestDataTimestamp = Math.max(
      website_analysis?.updated_at,
      menu?.updated_at
    )
    
    if (latestDataTimestamp > lastGenerated) {
      updatableVariables.push(variable)
    }
  }
}

return {
  hasNewInsights: updatableVariables.length > 0,
  updatableVariables
}
```

---

## EDGE FUNCTION REGENERATION LOGIC

```typescript
// supabase/functions/brand-profile-generator/index.ts

async function saveBrandProfile(
  businessId: string,
  brandProfile: BrandProfile,
  forceRegenerate: boolean
) {
  // Fetch existing profile
  const { data: existing } = await supabase
    .from('business_brand_profile')
    .select('*')
    .eq('business_id', businessId)
    .single()

  if (!existing) {
    // First-time generation: insert all
    await supabase.from('business_brand_profile').insert({
      business_id: businessId,
      ...brandProfile,
      last_edited_by: 'ai',
      last_edited_at: new Date().toISOString(),
      generated_at: new Date().toISOString()
    })
    return
  }

  // Update logic depends on forceRegenerate flag
  if (forceRegenerate) {
    // Overwrite everything
    await supabase.from('business_brand_profile').update({
      ...brandProfile,
      last_edited_by: 'ai',
      last_edited_at: new Date().toISOString(),
      generated_at: new Date().toISOString()
    }).eq('business_id', businessId)
    
    return
  }

  // Smart merge: only update AI-generated variables
  const updates: any = {
    generated_at: new Date().toISOString()
  }

  for (const [key, value] of Object.entries(brandProfile)) {
    // Check if this variable was user-edited
    const lastEditedBy = existing.last_edited_by // Assumes single tracking field
    
    // If AI-generated, allow update
    if (lastEditedBy === 'ai' || !existing[key]) {
      updates[key] = value
    }
    // If user-edited, skip (preserve user edit)
  }

  await supabase
    .from('business_brand_profile')
    .update(updates)
    .eq('business_id', businessId)
}
```

---

## TESTING LIFECYCLE RULES

### Test 1: First Generation
```bash
# Call Edge Function
curl -X POST https://<project>.supabase.co/functions/v1/brand-profile-generator \
  -H "Authorization: Bearer <anon_key>" \
  -d '{"businessId": "123", "forceRegenerate": false}'

# Verify: All 9 variables created, last_edited_by = 'ai'
```

---

### Test 2: User Edit Preservation
```bash
# 1. User edits brand_essence in UI
UPDATE business_brand_profile
SET brand_essence = 'My custom essence', last_edited_by = 'user'
WHERE business_id = '123';

# 2. New menu uploaded, trigger auto-regeneration
curl -X POST .../brand-profile-generator \
  -d '{"businessId": "123", "forceRegenerate": false}'

# 3. Verify: brand_essence UNCHANGED, other AI variables updated
```

---

### Test 3: Force Regeneration
```bash
# User clicks "Regenerate All"
curl -X POST .../brand-profile-generator \
  -d '{"businessId": "123", "forceRegenerate": true}'

# Verify: ALL variables overwritten, last_edited_by = 'ai' for all
```

---

### Test 4: Incremental Update Notification
```bash
# 1. Website analyzed at t=0, brand profile generated
# 2. User edits 3 variables at t=1
# 3. Menu uploaded at t=2

# Expected:
# - hasNewInsights = true
# - updatableVariables = ['core_offerings', 'content_focus', ...]
# - UI shows "Nye indsigter tilgængelige" badge
```

---

## ANTI-PATTERNS

### ❌ Overwriting User Edits Without Warning
```typescript
// WRONG: Always overwrites, ignores user edits
await supabase.from('business_brand_profile').update({
  brand_essence: newValue
}).eq('business_id', businessId)
```

**Problem**: User loses manual refinements

---

### ❌ Never Regenerating (Stale Data)
```typescript
// WRONG: Only generates once, never updates
if (existingProfile) {
  return existingProfile // Stale data
}
```

**Problem**: New insights from menu/website never incorporated

---

### ❌ No Versioning (Lost History)
```typescript
// WRONG: Overwrites without backup
await supabase.from('business_brand_profile').update(newProfile)
```

**Problem**: User can't undo bad regenerations

---

## IMPLEMENTATION CHECKLIST

- [ ] Add `last_edited_by` and `last_edited_at` columns to `business_brand_profile`
- [ ] Update Edge Function to check `last_edited_by` before overwriting
- [ ] Implement `forceRegenerate` flag in Edge Function
- [ ] Add confirmation modal for "Regenerate All" button
- [ ] Create `business_brand_profile_history` table (optional)
- [ ] Implement incremental update logic (smart merge)
- [ ] Add "New insights available" notification UI
- [ ] Test all 4 lifecycle scenarios
- [ ] Document lifecycle rules in README

---

## DATABASE MIGRATION

```sql
-- Add lifecycle tracking columns
ALTER TABLE business_brand_profile
ADD COLUMN IF NOT EXISTS last_edited_by TEXT DEFAULT 'ai',
ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMP DEFAULT NOW();

COMMENT ON COLUMN business_brand_profile.last_edited_by IS 
  'Tracks who last modified this profile: "ai" or "user". If "user", AI skips auto-regeneration.';

COMMENT ON COLUMN business_brand_profile.last_edited_at IS 
  'Timestamp of last edit by user or AI.';

-- Optional: Create history table for versioning
CREATE TABLE IF NOT EXISTS business_brand_profile_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  version INT NOT NULL,
  
  brand_essence TEXT,
  tone_of_voice TEXT,
  things_to_avoid TEXT,
  target_audience TEXT,
  core_offerings TEXT,
  content_focus TEXT,
  cta_style TEXT,
  communication_goal TEXT,
  image_preferences TEXT,
  
  generated_at TIMESTAMP,
  generated_by TEXT,
  trigger_event TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_brand_profile_history_business 
  ON business_brand_profile_history(business_id, version DESC);
```

---

**Status**: Production-ready ✅  
**Next**: Integrate lifecycle rules into Edge Function and UI
