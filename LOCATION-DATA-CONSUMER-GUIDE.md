# Location Data Consumer Guide

**Date:** May 22, 2026  
**Version:** Architecture v2 (demographic separation)

## 🎯 What Changed

The location intelligence system now separates **geographic location types** (WHERE the business is physically located) from **demographic proximity** (WHO is nearby).

### Problem Fixed
Previously, `category_scores` mixed incompatible concepts:
- **Geographic types** (waterfront, city_centre) - physical positioning
- **Demographics** (student, tourist) - nearby populations

This caused confusion: a business near a university would show "Student Area 88%" as a location type, implying they should target students globally across all programmes.

### New Solution
Two separate fields:
1. **`category_scores`** - Only geographic location types (9 types)
2. **`demographic_proximity`** - Population demographics nearby (4 metrics)

---

## 📊 Database Schema

### Table: `business_location_intelligence`

#### New Columns
```sql
-- WHO is nearby (hidden from UI, used as input for segmentation)
demographic_proximity JSONB DEFAULT '{}'::jsonb

-- Migration version tracker
location_architecture_version INT DEFAULT 1
```

#### Key Fields
```sql
-- Primary geographic type
area_type TEXT

-- All geographic location scores (WHERE business is)
category_scores JSONB
  -- Contains: city_centre, residential, office, transport_hub, waterfront,
  --           shopping_district, mixed_use, destination, nature_park

-- Demographic proximity scores (WHO is nearby)
demographic_proximity JSONB
  -- Contains: university_proximity, tourist_flow, 
  --           office_worker_density, residential_density

-- Marketing implications per geographic type
concept_fit_by_category JSONB

-- Version: 1 = old (demographics in category_scores), 2 = new (separated)
location_architecture_version INT
```

---

## 🔍 How to Query Location Data

### Get Geographic Location Types (Display to Users)
```sql
SELECT 
  area_type,
  category_scores,
  location_architecture_version
FROM business_location_intelligence
WHERE business_id = 'your-business-id';
```

**Example Result:**
```json
{
  "area_type": "waterfront",
  "category_scores": {
    "waterfront": 95,
    "city_centre": 85,
    "transport_hub": 60
  },
  "location_architecture_version": 2
}
```

### Get Demographic Proximity (Hidden Input for Segmentation)
```sql
SELECT 
  demographic_proximity
FROM business_location_intelligence
WHERE business_id = 'your-business-id';
```

**Example Result:**
```json
{
  "university_proximity": 88,
  "tourist_flow": 82,
  "office_worker_density": 0,
  "residential_density": 0
}
```

### Get Location Types for Display (Score >= 60)
```sql
SELECT 
  key as location_type,
  value::int as score
FROM business_location_intelligence,
     jsonb_each_text(category_scores)
WHERE business_id = 'your-business-id'
  AND value::int >= 60
  AND key IN (
    'city_centre', 'residential', 'office', 'transport_hub', 
    'waterfront', 'shopping_district', 'mixed_use', 'destination', 'nature_park'
  )
ORDER BY value::int DESC;
```

---

## 📋 Geographic Location Types (9 Types)

These represent **WHERE** the business is physically located:

| Type | Description | Example Signals |
|------|-------------|-----------------|
| `city_centre` | Central urban area | High POI density, shopping, dining |
| `waterfront` | Harbor/marina area | Waterfront POIs, scenic location |
| `residential` | Neighborhood area | Residential POIs, parks, local vibe |
| `office` | Business district | Office buildings, banks, corporate |
| `transport_hub` | Major transit station | Train/metro stations, bus terminals (not regular bus stops) |
| `shopping_district` | Retail area | Malls, stores, shopping centers |
| `mixed_use` | Modern development | Mix of residential, office, retail |
| `destination` | Drive-to location | Low POI density, car-dependent |
| `nature_park` | Park/nature area | Parks, outdoor recreation |

### Filter Rule
Only show types with `score >= 60` in UI.

---

## 👥 Demographic Proximity (4 Metrics)

These represent **WHO** is nearby (hidden from location UI, used for programme segmentation):

| Metric | Description | Use Case |
|--------|-------------|----------|
| `university_proximity` | Students nearby | Student-friendly lunch programmes |
| `tourist_flow` | Tourists in area | Tourist-targeted content, seasonal peaks |
| `office_worker_density` | Office workers | Weekday lunch specials, business meetings |
| `residential_density` | Local residents | Family offerings, regular customer base |

### Usage Pattern
```typescript
// Use demographic data to generate programme-specific segments
if (demographicProximity.university_proximity >= 70) {
  // Add "Studerende til frokost" segment to LUNCH programme only
  // NOT a global business targeting strategy
}
```

---

## 🔄 Migration Status

### Check Migration Version
```sql
SELECT 
  business_id,
  location_architecture_version,
  CASE 
    WHEN location_architecture_version = 1 THEN 'Old: demographics in category_scores'
    WHEN location_architecture_version = 2 THEN 'New: demographics separated'
    ELSE 'Unknown'
  END as status
FROM business_location_intelligence
WHERE business_id = 'your-business-id';
```

### Backward Compatibility
- **Version 1**: `student` and `tourist` still in `category_scores`
- **Version 2**: Demographics moved to `demographic_proximity`, removed from `category_scores`

---

## 💡 Usage Examples

### Example 1: Café Faust (Business ID: `f4679fa9-3120-4a59-9506-d059b010c34a`)

**Before Migration (v1):**
```json
{
  "category_scores": {
    "waterfront": 95,
    "student": 88,      // ❌ Wrong: demographic in geographic field
    "city_centre": 85,
    "tourist": 82,      // ❌ Wrong: demographic in geographic field
    "transport_hub": 60 // ❌ Borderline: likely just bus stops, not major station
  }
}
```
Result: 5 location cards shown, including "Student Area" and "Tourist Area"

**After Migration (v2):**
```json
{
  "category_scores": {
    "waterfront": 95,
    "city_centre": 85
    // transport_hub removed: score too low after stricter criteria
  },
  "demographic_proximity": {
    "university_proximity": 88,  // ✅ Correct: demographic data separated
    "tourist_flow": 82,           // ✅ Correct: demographic data separated
    "office_worker_density": 0,
    "residential_density": 0
  }
}
```
Result: 2 location cards shown (Waterfront, City Centre only)

### Example 2: Programme Segment Generation

```typescript
// ✅ CORRECT: Use demographic proximity for programme-specific targeting
function generateAudienceSegments(
  programmeType: string,
  demographicProximity: DemographicProximity
): AudienceSegment[] {
  const segments = [];
  
  if (programmeType === 'lunch' && demographicProximity.university_proximity >= 70) {
    segments.push({
      name: 'Studerende til frokost',
      description: 'Students looking for affordable lunch',
      priceSensitivity: 'high',
      source: 'demographic_proximity.university_proximity'
    });
  }
  
  // Dinner programme does NOT target students (expensive mains)
  // Even though they're nearby (proximity != targeting)
  
  return segments;
}

// ❌ WRONG: Don't use category_scores for audience targeting
// category_scores is for geographic positioning only
```

---

## 🚨 Important Rules

### DO:
- ✅ Display `category_scores` types (score >= 60) as location cards
- ✅ Use `demographic_proximity` as input for programme segment generation
- ✅ Filter to geographic types only: `city_centre`, `waterfront`, `residential`, `office`, `transport_hub`, `shopping_district`, `mixed_use`, `destination`, `nature_park`
- ✅ Check `location_architecture_version` to handle both old and new data

### DON'T:
- ❌ Display `student` or `tourist` from `category_scores` (old data only)
- ❌ Show demographic proximity as location types in UI
- ❌ Use location types for global audience targeting
- ❌ Assume proximity = targeting strategy

---

## 📝 SQL Diagnostic Query

Use this to check location data for any business:

```sql
SELECT 
  b.name,
  bli.area_type,
  jsonb_pretty(bli.category_scores) as geographic_types,
  jsonb_pretty(bli.demographic_proximity) as demographics,
  bli.location_architecture_version as version,
  CASE 
    WHEN bli.location_architecture_version = 2 THEN '✅ Migrated'
    ELSE '⚠️ Old schema'
  END as status
FROM businesses b
JOIN business_location_intelligence bli ON bli.business_id = b.id
WHERE b.id = 'your-business-id';
```

---

## 🔗 Related Files

- **Migration 1**: `supabase/migrations/20260522000001_add_demographic_proximity.sql`
- **Migration 2**: `supabase/migrations/20260522000002_migrate_demographics.sql`
- **Type Definitions**: `supabase/functions/_shared/geographic-location-types.ts`
- **Demographic Profiles**: `supabase/functions/_shared/demographic-profiles.ts`

---

## ❓ Quick Reference

### Which field should I use?

| Use Case | Field | Filter |
|----------|-------|--------|
| Display location cards in UI | `category_scores` | Score >= 60, geographic types only |
| Generate programme segments | `demographic_proximity` | Threshold varies (e.g., >= 70) |
| Show primary location type | `area_type` | N/A |
| Check migration status | `location_architecture_version` | 1 = old, 2 = new |

### What are the 9 geographic types?
1. city_centre
2. residential
3. office
4. transport_hub
5. waterfront
6. shopping_district
7. mixed_use
8. destination
9. nature_park

### What are the 4 demographic metrics?
1. university_proximity
2. tourist_flow
3. office_worker_density
4. residential_density

---

**Last Updated:** May 22, 2026  
**Architecture Version:** 2 (demographics separated)
