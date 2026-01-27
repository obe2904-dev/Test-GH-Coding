# Manual Menu Entry Feature

## Overview
Added "Indtast menu selv" (Manual Menu Entry) option to MenuOfferingsPanel, allowing users to directly type or paste menu content instead of uploading PDFs or providing URLs.

## Implementation Details

### State Management
- **New State**: `manualMenuText` (React.useState)
- Stores the raw text input from user
- Character limit enforced: 5000 characters max

### Handler Function
**Location**: [MenuOfferingsPanel.tsx](src/pages/dashboard/businessProfile/components/MenuOfferingsPanel.tsx#L758) (handleManualMenuEntry)

**Flow**:
1. Validate that input is not empty
2. Check character limit (5000 chars)
3. Get current session token from Supabase
4. Call `parse-menu-text` Edge Function with:
   - `extractedText`: User's manual input
   - `menuName`: "Manuelt indtastet menu"
   - `language`: 'da' (Danish)
5. Reload menu extractions from database
6. Clear input field on success
7. Show error message on failure

### UI Component
**Location**: [MenuOfferingsPanel.tsx](src/pages/dashboard/businessProfile/components/MenuOfferingsPanel.tsx#L1240) (Option 3 section)

**Features**:
- Textarea with 5000 character limit
- Live character counter (current / 5000)
- Placeholder with example format
- "Analysér menu" button (disabled while processing)
- Processing indicator while analyzing
- Error message display below

### Input Format
Users enter menu as plain text:
```
Menunavn
Menuret 1
Menuret 2
Menuret 3
```

Example:
```
Frokostmenu
Smørrebrød med røget laks
Fiskefrikadeller
Salat med kylling
```

The parse-menu-text function treats:
- **First line**: Menu headline
- **Remaining lines**: Individual menu items

## Edge Function Integration
Uses existing `parse-menu-text` Edge Function which:
- Extracts structure (headline + items)
- Applies Danish language OCR corrections
- Creates menu_extractions database record
- Returns structured menu data

**No changes needed** to Edge Function - it's language-agnostic and already supports plain text input.

## Character Limits
- **Total input**: 5000 characters
- **Headline** (when parsed): ~100 characters
- **Per item** (when parsed): ~250 characters
- Enforced client-side in textarea onChange
- Enforced server-side in Edge Function

## UI/UX Details
- **Label**: "Indtast menu selv" (Danish)
- **Placeholder**: Shows format + example
- **Button**: "Analysér menu" (changes to "Analyserer..." while processing)
- **Counter**: Real-time character count
- **Styling**: Consistent with PDF upload and URL input options
- **Disabled state**: Button disabled while processing or input is empty

## Testing
### Manual Test Case 1: Basic Menu Entry
1. Enter in textarea:
   ```
   Frokost
   Smørrebrød
   Fiskefrikadeller
   ```
2. Click "Analysér menu"
3. Should appear in "📋 AI forstået Menu" section with:
   - Headline: "Frokost"
   - 2 menu items

### Manual Test Case 2: Character Limit
1. Try to paste text > 5000 characters
2. Should not be able to enter beyond 5000
3. Counter should show max limit

### Manual Test Case 3: Empty Input
1. Try to click "Analysér menu" without entering text
2. Should show error: "Indtast venligst en menu"

## Files Modified
- [src/pages/dashboard/businessProfile/components/MenuOfferingsPanel.tsx](src/pages/dashboard/businessProfile/components/MenuOfferingsPanel.tsx)
  - Added `handleManualMenuEntry` function (lines ~758-835)
  - Added UI section for manual entry (lines ~1240-1275)
  - State already added: `manualMenuText`

## No Breaking Changes
- Additive feature only
- All existing PDF and URL input methods still work
- No Edge Function changes required
- No database schema changes
