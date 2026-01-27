#!/bin/bash
# Menu Extraction System - Test Suite
# Run each test in order to validate deployment

set -e

echo "🚀 Menu Extraction System - Validation Test Suite"
echo "=================================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SUPABASE_URL="${VITE_SUPABASE_URL:-http://localhost:54321}"
SUPABASE_KEY="${VITE_SUPABASE_ANON_KEY:-}"
BUSINESS_ID="${TEST_BUSINESS_ID:-test-business-123}"

echo "Configuration:"
echo "  Supabase URL: $SUPABASE_URL"
echo "  Business ID: $BUSINESS_ID"
echo ""

# TEST 1: Check database tables exist
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 1: Verify Database Tables"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# This is a manual test - requires SQL access
echo "ℹ️  Manual check required in Supabase SQL Editor:"
echo ""
echo "Copy-paste this SQL:"
echo "---"
echo "SELECT table_name FROM information_schema.tables"
echo "WHERE table_schema = 'public' AND table_name IN ('menu_sources', 'menu_extractions');"
echo "---"
echo "✓ Both tables should appear"
echo ""

# TEST 2: Check RLS Policies
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 2: Verify RLS Policies"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "ℹ️  Manual check required in Supabase SQL Editor:"
echo ""
echo "Copy-paste this SQL:"
echo "---"
echo "SELECT tablename, policyname, permissive FROM pg_policies"
echo "WHERE tablename IN ('menu_sources', 'menu_extractions')"
echo "ORDER BY tablename;"
echo "---"
echo "✓ Should show 8 policies (4 per table)"
echo "✓ All should be 'PERMISSIVE' (true)"
echo ""

# TEST 3: Check Environment Variables
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 3: Verify Environment Variables"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -z "$SUPABASE_URL" ]; then
    echo -e "${RED}❌ VITE_SUPABASE_URL not set${NC}"
    exit 1
else
    echo -e "${GREEN}✓ SUPABASE_URL set${NC}"
fi

if [ -z "$SUPABASE_KEY" ]; then
    echo -e "${YELLOW}⚠️  VITE_SUPABASE_ANON_KEY not set (may be needed for tests)${NC}"
else
    echo -e "${GREEN}✓ SUPABASE_KEY set${NC}"
fi

echo ""

# TEST 4: Test Edge Function - Extract Menu PDF
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 4: Test extract-menu-pdf Function"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "ℹ️  Manual test in browser console:"
echo ""
echo "Navigate to: http://localhost:5173"
echo "Open browser console (F12)"
echo "Paste this code:"
echo "---"
cat << 'EOF'
const response = await fetch(
  'http://localhost:54321/functions/v1/extract-menu-pdf',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_AUTH_TOKEN'
    },
    body: JSON.stringify({
      url: 'https://jakobsenco.dk/viggo/wp-content/uploads/sites/35/2025/11/Viggo-julemenu-2025.pdf'
    })
  }
);
const data = await response.json();
console.log('Response:', data);
EOF
echo "---"
echo ""
echo "✓ Should receive JSON with extractedText field"
echo "✓ extractedText should contain menu content"
echo ""

# TEST 5: Test Edge Function - Parse Menu Text
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 5: Test parse-menu-text Function"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "ℹ️  Manual test in browser console:"
echo ""
echo "Paste this code:"
echo "---"
cat << 'EOF'
const response = await fetch(
  'http://localhost:54321/functions/v1/parse-menu-text',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_AUTH_TOKEN'
    },
    body: JSON.stringify({
      extractedText: 'BRUNCH\nEggs Benedict 95 kr\nPancakes 85 kr\n\nMAIN\nSteak 195 kr',
      menuName: 'Test Menu',
      menuType: 'standard',
      businessId: 'YOUR_BUSINESS_ID'
    })
  }
);
const data = await response.json();
console.log('Response:', data);
EOF
echo "---"
echo ""
echo "✓ Should receive JSON with success: true"
echo "✓ Should show number of categories extracted"
echo ""

# TEST 6: Frontend Integration Test
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 6: Frontend Integration Test"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "ℹ️  Manual test in UI:"
echo ""
echo "1. Start dev server:"
echo "   npm run dev"
echo ""
echo "2. Navigate to: Profile → Menu tab"
echo ""
echo "3. In 'Menu-kilder' section, add menu:"
echo "   - Paste URL: https://jakobsenco.dk/viggo/wp-content/uploads/sites/35/2025/11/Viggo-julemenu-2025.pdf"
echo "   - Click 'Få AI til at hente'"
echo ""
echo "4. Watch browser console (F12):"
echo "   - Should see extraction logs"
echo "   - Should see parsing logs"
echo ""
echo "5. Check 'AI forstået Menu' section:"
echo "   - Should appear with collapsed categories"
echo "   - Expand to see menu items"
echo ""

# TEST 7: Database Record Verification
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 7: Verify Database Records Created"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "ℹ️  In Supabase SQL Editor, verify records were created:"
echo ""
echo "Check menu_sources:"
echo "---"
echo "SELECT id, source_url, status, created_at FROM menu_sources"
echo "WHERE business_id = 'YOUR_BUSINESS_ID'"
echo "ORDER BY created_at DESC LIMIT 5;"
echo "---"
echo ""
echo "Check menu_extractions:"
echo "---"
echo "SELECT id, menu_name, jsonb_array_length(extracted_data->'categories') as category_count"
echo "FROM menu_extractions"
echo "WHERE business_id = 'YOUR_BUSINESS_ID'"
echo "ORDER BY created_at DESC LIMIT 5;"
echo "---"
echo ""

# SUMMARY
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ VALIDATION COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "If all tests pass:"
echo "  ✓ Database is ready"
echo "  ✓ Functions are deployed"
echo "  ✓ Frontend integration works"
echo "  ✓ System is production-ready"
echo ""
echo "Next steps:"
echo "  1. Monitor browser console during extraction"
echo "  2. Check Supabase function logs for any errors"
echo "  3. Verify menu data appears in database"
echo "  4. Test with real business data"
echo ""
