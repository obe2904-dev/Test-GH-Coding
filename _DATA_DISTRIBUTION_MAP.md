# Website Analysis Data Distribution Map

## Overview
The `analyze-and-distribute-website` function now provides comprehensive logging and a detailed distribution summary showing exactly what data was extracted and where it was stored.

## Response Structure

```json
{
  "success": true,
  "scrape_id": "uuid",
  "quality": "good|partial|poor",
  "ai_analysis": {
    "about": "2-3 sentence summary",
    "description": "1-sentence compelling description",
    "venue_hooks": ["selling point 1", "selling point 2"],
    "keywords": ["keyword1", "keyword2"],
    "tone_of_voice": "casual|professional|warm",
    "menu_highlights": ["dish1", "dish2"],
    "services": {
      "has_table_service": true,
      "has_takeaway": false
    },
    "confidence_score": 0.85
  },
  "distribution_summary": {
    "tables_updated": ["businesses", "business_profile"],
    "fields_by_table": {
      "businesses": ["name", "last_scraped_at"],
      "business_profile": ["user_about_text", "key_offerings"]
    },
    "ai_fields": { ... },
    "structured_data": { ... }
  },
  "duration_ms": 9530
}
```

## Data Distribution Map

### 1. **businesses** table
- **Source**: Scraper extraction
- **Fields**:
  - `name` ← `extraction.business.name.value` (confidence ≥ 0.7)
  - `last_scraped_at` ← timestamp

### 2. **business_profile** table
- **Source**: AI analysis + scraper extraction
- **Fields**:
  - `user_about_text` ← AI: `about` (2-3 sentence summary)
  - `long_description` ← AI: `description` (1-sentence)
  - `key_offerings` ← AI: `venue_hooks` (array)
  - `menu_signal` ← AI: `{ signatureItems: menu_highlights, source, confidence }`
  - `business_keywords` ← AI: `keywords` (array)
  - `brand_tone` ← AI: `tone_of_voice`
  - `booking_url` ← Scraper: `services.booking.url`
  - `takeaway_url` ← Scraper: `services.takeaway.url`
  - `google_maps_url` ← Scraper: `services.maps.url`
  - `food_inspection_url` ← Scraper: `services.findsmiley.url`
  - `social_profiles` ← Scraper: `[{platform, url, confidence}]`

### 3. **business_locations** table
- **Source**: Scraper extraction
- **Fields**:
  - `email` ← `extraction.contact.emails[0].value` (confidence ≥ 0.7)
  - `phone` ← `extraction.contact.phones[0].value` (confidence ≥ 0.7)
  - `address_line1` ← `extraction.contact.addresses[0].value` (confidence ≥ 0.7)

### 4. **opening_hours** table
- **Source**: Scraper extraction
- **Fields**:
  - `weekday` ← parsed from `extraction.opening_hours.candidates`
  - `open_time` ← parsed (HH:MM:SS format)
  - `close_time` ← parsed (HH:MM:SS format)
  - `kind` ← 'normal'
- **Format**: Accepts both string `"monday: 09.30 - 23.00"` and object `{day: "monday", time: "09.30 - 23.00"}`

### 5. **social_accounts** table
- **Source**: Scraper extraction
- **Fields**:
  - `platform` ← `extraction.social.{facebook|instagram|linkedin}.platform`
  - `handle` ← extracted from URL
  - `profile_url` ← `extraction.social.{platform}.url`
  - `is_connected` ← false (scraper discovered, not OAuth)

### 6. **menu_sources** table
- **Source**: Scraper extraction
- **Fields**:
  - `source_url` ← `extraction.services.menu.url`
  - `source_type` ← `extraction.services.menu.type` ('link'|'inline'|'pdf')
  - `is_active` ← true
  - `discovered_at` ← timestamp

### 7. **business_operations** table
- **Source**: AI analysis
- **Fields**:
  - `has_table_service` ← AI: `services.has_table_service`
  - `has_takeaway` ← AI: `services.has_takeaway`
  - `has_delivery` ← AI: `services.has_delivery`
  - `has_outdoor_seating` ← AI: `services.has_outdoor_seating`

### 8. **website_scrape_results** table
- **Source**: Full scraper payload + AI results
- **Fields**:
  - `scraper_payload` ← complete scraper response
  - `extracted_data` ← AI analysis results
  - `content_quality` ← mapped quality ('rich'|'thin'|'shell')
  - `extraction_model` ← 'gemini-1.5-flash-002'

## UI Display Mapping

The UI reads data from these tables:

### BusinessProfilePage.tsx

| UI Field | Database Table | Database Field |
|----------|---------------|----------------|
| Business Name | `businesses` | `name` |
| Website URL | `businesses` | `website_url` |
| "Om os" text | `business_profile` | `user_about_text` |
| "Hvad tilbyder I?" | `business_profile` | `key_offerings` (array) |
| Menu highlights | `business_profile` | `menu_signal.signatureItems` (array) |
| Phone | `business_locations` | `phone` |
| Email | `business_locations` | `email` |
| Address | `business_locations` | `address_line1` |
| Booking URL | `business_profile` | `booking_url` |
| Opening hours | `opening_hours` | `weekday, open_time, close_time` (7 rows) |
| Service checkboxes | `business_operations` | `has_*` fields |

## Debugging: Why No Data in UI?

### Check 1: Was AI skipped?
Look for log: `⏭️ Skipping AI (no meaningful text)`

**Cause**: Website has < 100 characters of text content
**Result**: No "Om os", "Hvad tilbyder I?", menu highlights, or service model
**Fix**: Website needs more content text, or manually enter data

### Check 2: Are opening hours missing?
Look for log: `🕐 Opening hours data: { hasCandidates: false }`

**Cause**: Scraper couldn't find structured opening hours on page
**Result**: Opening hours section empty in UI
**Fix**: Check website has visible opening hours; may need scraper enhancement

### Check 3: Check scrape quality
Look for log: `✅ Scrape complete: { quality: "poor" }`

**Quality levels**:
- `good`: 8+ fields extracted
- `partial`: 5-7 fields
- `poor`: < 5 fields

**Low quality means**: Website structure not recognized, minimal data extracted

### Check 4: Verify table writes
Look for logs like:
- `✓ Business name updated`
- `✓ Location contact info updated: email, address_line1`
- `✓ Opening hours updated: 7 days`

**Missing logs**: Data not found in scraper payload or confidence too low (< 0.7)

### Check 5: Run verification SQL
Use `_VERIFY_SCRAPE_DATA.sql` to query all tables and see what's actually in the database.

## Troubleshooting Commands

### See latest scrape result:
```sql
SELECT * FROM website_scrape_results 
WHERE business_id = 'ac838e1d-571a-4aeb-8a3e-00fe0b0903b0'
ORDER BY created_at DESC LIMIT 1;
```

### Check AI extracted data:
```sql
SELECT 
  user_about_text,
  key_offerings,
  menu_signal
FROM business_profile
WHERE business_id = 'ac838e1d-571a-4aeb-8a3e-00fe0b0903b0';
```

### Verify opening hours:
```sql
SELECT * FROM opening_hours
WHERE business_id = 'ac838e1d-571a-4aeb-8a3e-00fe0b0903b0'
ORDER BY weekday;
```

## Testing Workflow

1. **Run analysis**: Click "🚀 Analyser Min Hjemmeside"
2. **Check alert**: Shows scrape_id and distribution summary
3. **Verify logs**: Check Supabase function logs for detailed breakdown
4. **Check UI**: After page reload, verify data appears
5. **Run SQL**: Use `_VERIFY_SCRAPE_DATA.sql` to see raw database values

## Common Issues

**Issue**: "UI shows no data after reload"
- **Check**: Browser cache (Cmd+Shift+R to hard refresh)
- **Check**: Supabase logs show data was written
- **Check**: SQL verification shows data in database
- **Fix**: If data in DB but not in UI, check UI query paths

**Issue**: "AI always skipped"
- **Check**: Website has substantial text content (> 100 chars)
- **Check**: Scraper quality rating is "good" or "partial", not "poor"
- **Fix**: Improve website content or manually enter data

**Issue**: "Opening hours always empty"
- **Check**: Log shows `hasCandidates: true`
- **Check**: Scraper found structured opening hours on page
- **Fix**: Website needs properly formatted opening hours
