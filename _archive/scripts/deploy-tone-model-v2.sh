#!/bin/bash
set -e

echo "🚀 Deploying Tone Model v2..."
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
PROJECT_REF="kvqdkohdpvmdylqgujpn"
SUPABASE_URL="https://kvqdkohdpvmdylqgujpn.supabase.co"

echo -e "${BLUE}Step 1: Database Migration${NC}"
echo "-----------------------------------"
echo ""
echo "⚠️  IMPORTANT: This migration will:"
echo "   - Add tone_model JSONB column (if not exists)"
echo "   - Create comprehensive validation constraints"
echo "   - Create GIN indexes for performance"
echo ""
echo "Please run the following SQL in Supabase Dashboard > SQL Editor:"
echo ""
echo -e "${YELLOW}────────────────────────────────────────${NC}"
cat supabase/migrations/20260108_add_tone_model_v2_column.sql
echo -e "${YELLOW}────────────────────────────────────────${NC}"
echo ""
echo "📋 To run the migration:"
echo "   1. Go to: ${SUPABASE_URL}/project/${PROJECT_REF}/sql/new"
echo "   2. Copy the SQL above"
echo "   3. Paste and click 'Run'"
echo "   4. Verify: Should see 'Success. No rows returned'"
echo ""
read -p "Press Enter after running the migration in Supabase Dashboard..."
echo ""

echo -e "${GREEN}✓ Migration step completed${NC}"
echo ""

echo -e "${BLUE}Step 2: Deploy Edge Functions${NC}"
echo "-----------------------------------"
echo ""
echo "Deploying brand-profile-generator with updated tone_model parser..."
echo ""

# Check if supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}✗ Supabase CLI not found${NC}"
    echo "Please install: brew install supabase/tap/supabase"
    exit 1
fi

# Deploy brand-profile-generator function
echo "Deploying brand-profile-generator..."
supabase functions deploy brand-profile-generator --project-ref $PROJECT_REF || {
    echo -e "${RED}✗ Failed to deploy brand-profile-generator${NC}"
    echo ""
    echo "Manual deployment:"
    echo "   1. Go to: ${SUPABASE_URL}/project/${PROJECT_REF}/functions"
    echo "   2. Select 'brand-profile-generator'"
    echo "   3. Click 'Deploy new version'"
    echo "   4. Upload the function code"
    exit 1
}

echo -e "${GREEN}✓ Edge function deployed${NC}"
echo ""

echo -e "${BLUE}Step 3: Verification${NC}"
echo "-----------------------------------"
echo ""
echo "To verify the deployment, run these SQL queries in Supabase Dashboard:"
echo ""
echo -e "${YELLOW}1. Check column exists:${NC}"
echo "SELECT column_name, data_type FROM information_schema.columns"
echo "WHERE table_name = 'business_brand_profile' AND column_name = 'tone_model';"
echo ""
echo -e "${YELLOW}2. Check constraint exists:${NC}"
echo "SELECT conname FROM pg_constraint"
echo "WHERE conname = 'tone_model_valid_structure_v2';"
echo ""
echo -e "${YELLOW}3. Check indexes:${NC}"
echo "\di+ idx_tone_model*"
echo ""
echo -e "${YELLOW}4. Test insertion (should succeed):${NC}"
echo "INSERT INTO business_brand_profile (business_id, tone_model)"
echo "VALUES ("
echo "  '00000000-0000-0000-0000-000000000001',"
echo "  '{"
echo "    \"primary_keywords\": [\"test\", \"verify\"],"
echo "    \"writing_rules\": [\"Rule 1\", \"Rule 2\", \"Rule 3\"],"
echo "    \"good_examples\": [\"Example 1\", \"Example 2\"],"
echo "    \"avoid_examples\": [\"Avoid 1\", \"Avoid 2\"],"
echo "    \"formality\": \"informal\","
echo "    \"emoji_level\": \"moderate\","
echo "    \"version\": \"2.0\","
echo "    \"language\": \"da\","
echo "    \"generated_at\": \"2026-01-08T23:00:00Z\","
echo "    \"source\": \"website\","
echo "    \"confidence\": \"high\""
echo "  }'"
echo ");"
echo ""
echo -e "${YELLOW}5. Clean up test data:${NC}"
echo "DELETE FROM business_brand_profile"
echo "WHERE business_id = '00000000-0000-0000-0000-000000000001';"
echo ""

echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Deployment Complete!${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo "📚 Documentation:"
echo "   - Implementation: STRUCTURED_TONE_MODEL_IMPLEMENTATION.md"
echo "   - Deployment: TONE_MODEL_V2_DEPLOYMENT.md"
echo "   - Architecture: IDEA_GENERATION_ARCHITECTURE.md (Design Decision #13)"
echo ""
echo "🧪 Next Steps:"
echo "   1. Run verification queries above"
echo "   2. Generate a brand profile for a test business"
echo "   3. Check that tone_model has all 12 fields (6 core + 6 metadata)"
echo "   4. Monitor logs for any constraint violations"
echo ""
echo "🎉 Tone Model v2 is now live!"
