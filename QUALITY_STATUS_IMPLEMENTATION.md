# Quality Status System - v4.6

## Overview

Added quality status tracking to brand profile generation. The system automatically assesses generation quality and stores it in the database.

## Quality Status Levels

- **🟢 green**: Perfect generation - no errors
- **🟡 yellow**: Usable but could improve - medium/low errors only
- **🔴 red**: Needs attention - critical or high errors present

## Implementation

### 1. Database Schema

```sql
-- Added columns to business_brand_profile
quality_status TEXT CHECK (quality_status IN ('green', 'yellow', 'red')) DEFAULT 'green'
generation_errors JSONB DEFAULT '[]'::jsonb

-- Added index for filtering
CREATE INDEX idx_business_brand_profile_quality_status 
ON business_brand_profile (quality_status);
```

**Migration**: `20260108000000_add_quality_status_to_brand_profile.sql`

### 2. Backend Logic

**Error Collector** (`errors.ts`):
```typescript
getQualityStatus(): 'green' | 'yellow' | 'red' {
  const bySeverity = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
  this.errors.forEach(e => bySeverity[e.severity]++)
  
  if (bySeverity.CRITICAL > 0 || bySeverity.HIGH > 0) return 'red'
  if (bySeverity.MEDIUM > 0 || bySeverity.LOW > 0) return 'yellow'
  return 'green'
}
```

**Save Function** (`database.ts`):
```typescript
export async function saveBrandProfile(
  supabase: any,
  businessId: string,
  brandProfile: BrandProfile,
  qualityStatus?: 'green' | 'yellow' | 'red',
  generationErrors?: any[]
): Promise<void>
```

**Main Generator** (`index.ts`):
```typescript
// Compute quality status
const qualityStatus = requestErrors.getQualityStatus()
const errorSummary = requestErrors.getSummary()

console.log(`💾 Saving brand profile...`)
console.log(`📊 Quality Status: ${qualityStatus} (${errorSummary})`)

// Save with quality data
await saveBrandProfile(
  supabaseClient,
  businessId,
  brandProfile,
  qualityStatus,
  requestErrors.toJSON()
)
```

### 3. API Response

```json
{
  "success": true,
  "qualityStatus": "yellow",
  "locale": {
    "code": "da-DK-aarhus",
    "city": "aarhus"
  },
  "errors": {
    "summary": "Errors: 0 critical, 0 high, 2 medium, 0 low",
    "errors": [
      {
        "category": "AI_INSTRUCTION_FAILURE",
        "severity": "MEDIUM",
        "message": "tone_of_voice missing proper structure",
        "phase": "validation"
      }
    ],
    "hasCritical": false
  }
}
```

## Frontend Integration (Planned)

### Status Badge
```tsx
{qualityStatus === 'green' && <Badge color="green">✓ Klar</Badge>}
{qualityStatus === 'yellow' && <Badge color="yellow">⚠ Kan forbedres</Badge>}
{qualityStatus === 'red' && <Badge color="red">✗ Fejl opstået</Badge>}
```

### Re-generation Button
```tsx
{qualityStatus !== 'green' && (
  <Button onClick={handleRegenerate}>
    🔄 Forbedre profil
  </Button>
)}
```

### Error Details
```tsx
{generationErrors.length > 0 && (
  <Popover>
    <PopoverTrigger>
      <InfoIcon /> {generationErrors.length} advarsler
    </PopoverTrigger>
    <PopoverContent>
      {generationErrors.map(err => (
        <div key={err.timestamp}>
          <strong>{err.category}</strong>
          <p>{err.message}</p>
        </div>
      ))}
    </PopoverContent>
  </Popover>
)}
```

## Monitoring & Analytics

### Quality Distribution Query
```sql
SELECT 
  quality_status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM business_brand_profile
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY quality_status
ORDER BY count DESC;
```

### Common Error Patterns
```sql
SELECT 
  e->>'category' as error_category,
  e->>'severity' as severity,
  COUNT(*) as occurrences
FROM business_brand_profile,
  jsonb_array_elements(generation_errors->'errors') as e
WHERE quality_status IN ('yellow', 'red')
GROUP BY error_category, severity
ORDER BY occurrences DESC
LIMIT 10;
```

### Quality Trends Over Time
```sql
SELECT 
  DATE_TRUNC('day', created_at) as date,
  quality_status,
  COUNT(*) as count
FROM business_brand_profile
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY date, quality_status
ORDER BY date DESC, quality_status;
```

## Example Console Output

```bash
[req_abc123] 🌍 Locale resolved: {
  code: "da-DK-aarhus",
  city: "aarhus",
  normalized: true
}

[req_abc123] 🔧 Applying deterministic repairs...
⚠️ tone_of_voice missing proper structure, applying robust fallback
⚠️ content_focus missing 3 required areas, applying robust fallback

[req_abc123] 💾 Saving brand profile...
[req_abc123] 📊 Quality Status: yellow (Errors: 0 critical, 0 high, 2 medium, 0 low)

[req_abc123] ✅ Complete in 42,351ms
```

## Deployment

**Version**: v4.6  
**Size**: 274.5kB  
**Date**: 2026-01-08  
**Status**: ✅ Deployed to production

Migration applied successfully:
```
✓ business_brand_profile.quality_status column created
✓ business_brand_profile.generation_errors column created
✓ idx_business_brand_profile_quality_status index created
```

## Next Steps

1. ✅ Database schema - COMPLETE
2. ✅ Backend computation - COMPLETE  
3. ✅ API response - COMPLETE
4. ⏳ Frontend UI badges - PENDING
5. ⏳ Re-generation trigger - PENDING
6. ⏳ Error detail tooltips - PENDING
7. ⏳ Admin analytics dashboard - PENDING
