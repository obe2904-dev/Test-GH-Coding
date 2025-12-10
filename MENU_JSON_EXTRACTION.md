# Menu JSON Extraction Implementation

## What Changed

We've upgraded the PDF extraction system to automatically parse menu PDFs into structured JSON format that AI can easily understand and use for content generation.

## Architecture

```
PDF Upload → GPT-4 Vision (text extraction) → GPT-4o-mini (JSON parsing) → Store in Database
```

### Two-Stage AI Processing:

1. **Stage 1: Text Extraction** (Tier-based)
   - **Premium/StandardPlus**: GPT-4 Vision with high-detail analysis
   - **Free**: unpdf for basic text extraction
   
2. **Stage 2: Menu Parsing** (All tiers)
   - **All tiers**: GPT-4o-mini parses extracted text into structured JSON
   - Cost-effective: ~$0.001 per menu

## JSON Structure

The extracted menu data follows this format:

```json
{
  "restaurant_name": "Restaurant Name",
  "menu_type": "food_menu" | "wine_list" | "drinks_menu",
  "categories": [
    {
      "name": "Starters",
      "items": [
        {
          "name": "Burrata Salad",
          "description": "Fresh burrata with heirloom tomatoes",
          "price": 95.0,
          "currency": "kr",
          "dietary": ["vegetarian"]
        }
      ]
    }
  ]
}
```

## Database Changes

### New Column: `business_documents.extracted_json`
- **Type**: JSONB (PostgreSQL JSON with indexing)
- **Purpose**: Stores structured menu data for AI consumption
- **Index**: GIN index for fast JSON queries
- **Migration**: `ADD_EXTRACTED_JSON_COLUMN.sql`

### Updated TypeScript Types
- Added `extracted_json` field to `business_documents` table type
- Type: `Json | null` (allows any valid JSON structure)

## Code Changes

### Edge Function: `upload-pdf/index.ts`

#### New Function: `parseMenuToJSON()`
```typescript
async function parseMenuToJSON(extractedText: string, pdfType: string): Promise<any>
```
- Takes extracted text and PDF type as input
- Uses GPT-4o-mini with `response_format: { type: 'json_object' }`
- Returns structured menu JSON
- Error handling: returns null if parsing fails (text is still stored)

#### Enhanced Flow:
1. Extract text (existing: Vision or unpdf)
2. **NEW**: Parse text to JSON if text length > 50 chars
3. Store both `extracted_text` AND `extracted_json` in database
4. Return menu item count in response

#### Response Includes:
```typescript
{
  success: true,
  extractedJSON: { ... },  // NEW: Structured menu data
  menuItemsCount: 24,      // NEW: Total items across all categories
  extractedText: "...",
  // ... other fields
}
```

## Usage Examples

### For AI Content Generation:

```typescript
// Fetch menu for a business
const { data: doc } = await supabase
  .from('business_documents')
  .select('extracted_json')
  .eq('business_id', businessId)
  .eq('document_type', 'menu')
  .single()

const menu = doc.extracted_json

// Generate post about specific dish
const dish = menu.categories[0].items[0]
const prompt = `Create social media post about ${dish.name}: ${dish.description}. Price: ${dish.price} ${dish.currency}`
```

### Query Menu Items by Category:

```sql
-- Find all vegetarian items
SELECT 
  file_name,
  jsonb_path_query(
    extracted_json, 
    '$.categories[*].items[*] ? (@.dietary[*] == "vegetarian")'
  ) as vegetarian_items
FROM business_documents
WHERE document_type = 'menu'
```

## Cost Analysis

### Per PDF Processing:
- **Vision Extraction** (Premium/StandardPlus): ~$0.01 per page
- **JSON Parsing** (All tiers): ~$0.001 per menu
- **Total**: ~$0.011 for typical 1-page menu

### Example Menu:
- 4 categories
- 24 menu items
- Total tokens: ~2000
- Cost: $0.001

## Testing

### Manual Test:
1. Go to Business Profile page
2. Enter website URL with menu PDF
3. Click "Analyze Website"
4. When PDF detected, click "Yes, store them"
5. Check database: `extracted_json` should contain structured data

### Expected Result:
```json
{
  "restaurant_name": "...",
  "categories": [
    {
      "name": "Appetizers",
      "items": [...]
    }
  ]
}
```

## Next Steps

### To Use Menu Data in AI Generation:

1. **Update `ai-generate` Edge Function**:
   ```typescript
   // Fetch business menu
   const { data: menu } = await supabase
     .from('business_documents')
     .select('extracted_json')
     .eq('business_id', businessId)
     .single()
   
   // Include in AI prompt
   const prompt = `You are generating content for a ${vertical}. 
   Here are their menu items: ${JSON.stringify(menu.extracted_json)}`
   ```

2. **Smart Content Suggestions**:
   - Suggest posts about new menu items
   - Highlight signature dishes
   - Create seasonal specials content
   - Generate "dish of the day" posts

3. **Menu-Aware Hashtags**:
   - Extract cuisine types from menu
   - Suggest dietary hashtags (#vegan, #glutenfree)
   - Use dish names in hashtags

## Files Modified

### Edge Functions:
- ✅ `supabase/functions/upload-pdf/index.ts` - Added JSON parsing

### Database:
- ✅ `supabase/migrations/004_add_extracted_json.sql` - Migration (idempotent)
- ✅ `ADD_EXTRACTED_JSON_COLUMN.sql` - Simple execution script

### Frontend Types:
- ✅ `src/types/database.ts` - Added `extracted_json` field

## Deployment Status

- ✅ Edge Function deployed to production
- ⏳ Database migration pending (run `ADD_EXTRACTED_JSON_COLUMN.sql` in SQL Editor)

## Support for Multiple Document Types

The system automatically detects document type and adjusts parsing:

- **menu**: Food menu parsing (items, prices, categories)
- **wine_list**: Wine list parsing (wines, vintages, prices)
- **other**: General document (text extraction only, no JSON)

The `menu_type` field in JSON indicates what was detected:
- `"food_menu"`
- `"wine_list"`
- `"drinks_menu"`
