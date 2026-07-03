# Physical Anchor Taxonomy v3 - Developer Guide

**Schema Version:** 3  
**Migration:** `20260701000001_add_who_and_traffic_rhythm.sql`  
**Status:** Active (replaces demographic_proximity model)

## Overview

Physical Anchor Taxonomy v3 provides business-blind location intelligence through three core dimensions:

1. **WHERE** — 9 physical anchor types (category_scores)
2. **WHO** — People physically present (structured semantic model)
3. **WHEN** — Traffic rhythm patterns (time-aware location facts)

### Key Principles

- **Business-blind facts only** — No assumptions about what the venue sells
- **Single venues = content signals** — Not location types (e.g., ARoS Museum nearby = pre-show positioning opportunity, NOT "cultural destination" location type)
- **Area-level vs landmark-proximity distinction** — Location types describe areas, not single buildings
- **Strict proximity gates** — Certain WHO types require measurable distance verification

---

## Database Schema

### New Fields (v3)

```sql
ALTER TABLE business_location_intelligence
  ADD COLUMN who JSONB DEFAULT NULL,
  ADD COLUMN traffic_rhythm JSONB DEFAULT NULL,
  ALTER COLUMN location_architecture_version SET DEFAULT 3;
```

### Field Structures

#### `who` (JSONB)

```json
{
  "primary": ["office_worker", "local_resident"],
  "secondary": ["tourist"],
  "notes": "Aarhus Universitet 450m nord — studenter fylder området 08:00–18:00 i semestertid"
}
```

**Valid WHO Types (11 total):**
- `local_resident` — Lives within 1km, daily routine presence
- `office_worker` — Works in nearby offices, weekday presence
- `student` — University students (requires 400-600m campus proximity)
- `shopper` — Active shoppers in retail district
- `tourist` — International/domestic leisure visitors
- `commuter` — In transit through transport hub
- `leisure_walker` — Walking for pleasure (waterfront, park)
- `family` — Parents with children
- `medical_staff` — Hospital staff (requires 300-500m hospital proximity)
- `hospital_visitor` — Visiting patients (requires 300-500m hospital proximity)
- `event_visitor` — Attending nearby event venue (secondary only, 200-250m)

**Proximity Gates:**
- `student`: Requires university within 400-600m
- `medical_staff` / `hospital_visitor`: Requires hospital within 300-500m
- `event_visitor`: Requires event venue within 200-250m (secondary only)

#### `traffic_rhythm` (JSONB)

```json
{
  "peak_days": "weekday",
  "peak_hours": "08:00–09:30 og 11:30–13:30",
  "dead_periods": "efter 17:00 og weekender",
  "seasonal_pattern": "stable",
  "seasonal_note": "Sommerferie: -40%"
}
```

**peak_days Values:**
- `weekday` — Monday-Friday dominance
- `weekend` — Saturday-Sunday dominance
- `both` — Relatively even distribution

**seasonal_pattern Values:**
- `stable` — Year-round consistency (±10%)
- `summer_peak` — 50-100% summer boost
- `semester_only` — University areas (70% drop in summer)
- `retail_calendar` — Shopping areas (Christmas boost, January slump)

---

## The 9 Physical Anchor Types

### Removed from v2:
- ❌ `mixed_use` (multi-score model handles this implicitly)
- ❌ `destination` (replaced by `tourist_destination` with area-level definition)

### Added in v3:
- ✅ `university_campus` (split from institutional_campus)
- ✅ `hospital_campus` (split from institutional_campus)
- ✅ `tourist_destination` (redefined as area-level only)

### Complete List:

1. **city_centre** — High-street / city core
2. **transport_hub** — Major transit interchange
3. **shopping_district** — Retail concentration
4. **waterfront** — Water-adjacent promenade
5. **office** — Business district
6. **residential** — Neighborhood
7. **university_campus** — University area (NEW)
8. **hospital_campus** — Hospital area (NEW)
9. **tourist_destination** — Tourist area (REDEFINED)
10. **nature_park** — Park / nature area

---

## Code Examples

### Reading Location Intelligence

```typescript
import { createClient } from '@supabase/supabase-js';

const { data } = await supabase
  .from('business_location_intelligence')
  .select('category_scores, who, traffic_rhythm, area_type')
  .eq('business_id', businessId)
  .single();

// Access WHO field
if (data.who) {
  const primaryAudiences = data.who.primary;  // ["office_worker", "local_resident"]
  const secondaryAudiences = data.who.secondary;  // ["tourist"]
  const notes = data.who.notes;  // Optional proximity evidence
}

// Access TRAFFIC_RHYTHM
if (data.traffic_rhythm) {
  const peakDays = data.traffic_rhythm.peak_days;  // "weekday" | "weekend" | "both"
  const peakHours = data.traffic_rhythm.peak_hours;  // "08:00–09:30 og 11:30–13:30"
  const seasonalPattern = data.traffic_rhythm.seasonal_pattern;
}
```

### Converting WHO to Scores (v2 Compatibility)

```typescript
function convertWhoToScores(who: LocationWho | null): Record<string, number> {
  if (!who) return {};
  
  const scores: Record<string, number> = {};
  
  (who.primary || []).forEach(whoType => {
    scores[whoType] = 90;  // Primary = very high score
  });
  
  (who.secondary || []).forEach(whoType => {
    if (!scores[whoType]) scores[whoType] = 50;  // Secondary = medium score
  });
  
  return scores;
}
```

### Filtering Audience Labels (with WHO support)

```typescript
import { filterAudienceLabels } from '@/functions/_shared/utils/audience-filter';

const result = filterAudienceLabels(
  null,  // demographic_proximity (v2, deprecated)
  maxMenuPrice,
  categoryScores,
  who  // V3: WHO field
);

console.log(result.permittedLabels);  // ["erhvervsgæster", "lokale beboere"]
console.log(result.audienceProfileString);  // "erhvervsgæster, lokale beboere"
```

### Validating Proximity Gates

```typescript
import { validateWhoProximityGate } from '@/functions/_shared/brand-profile/location-strategy-config';

const validation = validateWhoProximityGate('student', landmarks);

if (!validation.is_valid) {
  console.error(validation.reason);
  // "No university found within 400-600m range"
}
```

---

## Migration Path (v2 → v3)

### Backward Compatibility

The implementation maintains full backward compatibility:

1. **Database**: Both `demographic_proximity` (v2) and `who` (v3) fields coexist
2. **Code**: Automatically falls back to v2 if v3 fields are missing
3. **UI**: Displays v3 structure when available, v2 scores otherwise
4. **Audience Filter**: Accepts both formats, converts v3 WHO to v2 scores internally

### Running the Migration

```bash
# 1. Run schema migration (adds columns)
psql $DATABASE_URL -f supabase/migrations/20260701000001_add_who_and_traffic_rhythm.sql

# 2. Run data migration (transforms existing data)
psql $DATABASE_URL -f supabase/migrations/20260701000002_migrate_data_to_v3.sql

# 3. Verify migration success
node _test_physical_anchor_taxonomy_v3.mjs
```

### Data Transformation Rules

**demographic_proximity → who:**
- Score ≥70 → `primary`
- Score 40-69 → `secondary`
- Score <40 → omitted
- Special mapping: `business_professional` → `office_worker`

**area_type → traffic_rhythm:**
- Synthesized from dominant area_type
- Default patterns defined per type (see populate-location-intelligence/index.ts)

---

## Testing

Run the test suite to validate implementation:

```bash
node _test_physical_anchor_taxonomy_v3.mjs
```

**Tests include:**
1. Database schema validation (columns exist)
2. Geographic location types (9 types, no mixed_use/destination)
3. WHO field structure validation
4. TRAFFIC_RHYTHM field structure validation
5. Proximity gate enforcement

---

## Common Pitfalls

### ❌ Don't

```typescript
// DON'T assign student WHO type without proximity verification
who.primary.push('student');  // Missing university proximity gate!

// DON'T use destination (removed in v3)
category_scores.destination = 80;  // Should be tourist_destination

// DON'T treat single landmarks as location types
category_scores.cultural_destination = 90;  // ARoS Museum nearby ≠ cultural destination area
```

### ✅ Do

```typescript
// DO verify proximity gates before assigning WHO types
if (hasUniversityWithin(400, 600)) {
  who.primary.push('student');
  who.notes = `Aarhus Universitet ${distance}m nord`;
}

// DO use tourist_destination for AREA-level tourist zones
if (isHistoricQuarter && hasMultipleAttractions && hasTouristInfrastructure) {
  category_scores.tourist_destination = 85;
}

// DO use single landmarks as content hooks, not location types
if (hasARoSMuseum) {
  // Store as landmark_nearby for pre-show positioning
  // NOT as location type
}
```

---

## Further Reading

- **Design Spec**: [`design-physical-anchor-taxonomy.md`](design-physical-anchor-taxonomy.md)
- **Migration Scripts**: [`supabase/migrations/20260701000001_add_who_and_traffic_rhythm.sql`](supabase/migrations/20260701000001_add_who_and_traffic_rhythm.sql)
- **Type Definitions**: [`supabase/functions/_shared/types/location-who.ts`](supabase/functions/_shared/types/location-who.ts)
- **Claude Analyzer**: [`supabase/functions/populate-location-intelligence/services/claude-analyzer.ts`](supabase/functions/populate-location-intelligence/services/claude-analyzer.ts)

---

**Last Updated**: 2026-07-01  
**Schema Version**: 3  
**Status**: Production Ready
