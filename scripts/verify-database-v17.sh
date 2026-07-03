#!/bin/bash
# Database Verification Script v17
# Purpose: Verify Café Faust data quality before and after cleanup
# Date: 17. februar 2026

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Database Verification - Café Faust${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Get service key
echo -e "${YELLOW}→ Getting Supabase service key...${NC}"
SERVICE_KEY=$(supabase projects api-keys --project-ref kvqdkohdpvmdylqgujpn -o json | jq -r '.[] | select(.name=="service_role") | .api_key')

if [ -z "$SERVICE_KEY" ]; then
  echo -e "${RED}✗ Failed to get service key${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Service key retrieved${NC}"
echo ""

# Business ID for Café Faust
BUSINESS_ID="840347de-9ba7-4275-8aa3-4553417fc2af"

# ============================================================================
# VERIFICATION 1: Enriched Fields Status
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}1. ENRICHED FIELDS STATUS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

curl -s "https://kvqdkohdpvmdylqgujpn.supabase.co/rest/v1/business_brand_profile?business_id=eq.$BUSINESS_ID&select=never_say,signature_phrases,typical_openings,typical_closings,humor_level,formality,emoji_style,storytelling_style" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" | \
jq -r '
.[0] | 
"never_say:
  Count: \(if .never_say then (.never_say | length) else 0 end)
  Sample (first 10): \(if .never_say then (.never_say[0:10] | join(", ")) else "EMPTY" end)
  Has Danish chars: \(if .never_say then (.never_say | join(" ") | test("[æøåÆØÅ]")) else false end)

signature_phrases:
  Count: \(if .signature_phrases then (.signature_phrases | length) else 0 end)
  Values: \(if .signature_phrases then (.signature_phrases | join(", ")) else "EMPTY" end)

typical_openings:
  Count: \(if .typical_openings then (.typical_openings | length) else 0 end)
  Values (first 3): \(if .typical_openings then (.typical_openings[0:3] | join(" | ")) else "EMPTY" end)

typical_closings:
  Count: \(if .typical_closings then (.typical_closings | length) else 0 end)
  Values: \(if .typical_closings then (.typical_closings | join(", ")) else "EMPTY" end)

Personality Traits:
  humor_level: \(.humor_level // "NOT SET")
  formality: \(.formality // "NOT SET")
  emoji_style: \(.emoji_style // "NOT SET")
  storytelling_style: \(.storytelling_style // "NOT SET")
"
'

echo ""

# ============================================================================
# VERIFICATION 2: Legacy Fields Status
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}2. LEGACY FIELDS STATUS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

curl -s "https://kvqdkohdpvmdylqgujpn.supabase.co/rest/v1/business_brand_profile?business_id=eq.$BUSINESS_ID&select=do_not_say,things_to_avoid,tone_keywords,voice_style,values,certifications" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" | \
jq -r '
.[0] | 
"do_not_say:
  Exists: \(if .do_not_say then "YES" else "NO" end)
  Structure: \(if .do_not_say then (.do_not_say | type) else "N/A" end)
  Words count: \(if .do_not_say and .do_not_say.words then (.do_not_say.words | length) else 0 end)

things_to_avoid:
  Exists: \(if .things_to_avoid then "YES" else "NO" end)
  Structure: \(if .things_to_avoid then (.things_to_avoid | type) else "N/A" end)

tone_keywords:
  Count: \(if .tone_keywords then (.tone_keywords | length) else 0 end)
  Values: \(if .tone_keywords then (.tone_keywords | join(", ")) else "EMPTY" end)

voice_style:
  Value: \(.voice_style // "EMPTY")

values:
  Count: \(if .values then (.values | length) else 0 end)
  Values: \(if .values then (.values | join(", ")) else "EMPTY" end)

certifications:
  Count: \(if .certifications then (.certifications | length) else 0 end)
  Values: \(if .certifications then (.certifications | join(", ")) else "EMPTY" end)
"
'

echo ""

# ============================================================================
# VERIFICATION 3: Data Quality Assessment
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}3. DATA QUALITY ASSESSMENT${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Check enriched field completeness
ENRICHED_CHECK=$(curl -s "https://kvqdkohdpvmdylqgujpn.supabase.co/rest/v1/business_brand_profile?business_id=eq.$BUSINESS_ID&select=never_say,signature_phrases,typical_openings,humor_level,formality" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY")

# Count populated enriched fields
NEVER_SAY_OK=$(echo "$ENRICHED_CHECK" | jq '.[0].never_say != null and (.[0].never_say | length) > 0')
SIGNATURES_OK=$(echo "$ENRICHED_CHECK" | jq '.[0].signature_phrases != null and (.[0].signature_phrases | length) > 0')
OPENINGS_OK=$(echo "$ENRICHED_CHECK" | jq '.[0].typical_openings != null and (.[0].typical_openings | length) > 0')
HUMOR_OK=$(echo "$ENRICHED_CHECK" | jq '.[0].humor_level != null')
FORMALITY_OK=$(echo "$ENRICHED_CHECK" | jq '.[0].formality != null')

# Display results
if [ "$NEVER_SAY_OK" = "true" ]; then
  echo -e "${GREEN}✓ never_say: POPULATED${NC}"
else
  echo -e "${RED}✗ never_say: EMPTY${NC}"
fi

if [ "$SIGNATURES_OK" = "true" ]; then
  echo -e "${GREEN}✓ signature_phrases: POPULATED${NC}"
else
  echo -e "${RED}✗ signature_phrases: EMPTY${NC}"
fi

if [ "$OPENINGS_OK" = "true" ]; then
  echo -e "${GREEN}✓ typical_openings: POPULATED${NC}"
else
  echo -e "${RED}✗ typical_openings: EMPTY${NC}"
fi

if [ "$HUMOR_OK" = "true" ]; then
  echo -e "${GREEN}✓ humor_level: SET${NC}"
else
  echo -e "${YELLOW}⚠ humor_level: NOT SET${NC}"
fi

if [ "$FORMALITY_OK" = "true" ]; then
  echo -e "${GREEN}✓ formality: SET${NC}"
else
  echo -e "${YELLOW}⚠ formality: NOT SET${NC}"
fi

echo ""

# ============================================================================
# VERIFICATION 4: Danish Content Check
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}4. DANISH CONTENT VERIFICATION${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Check if never_say contains Danish phrases (not just English hashtags)
curl -s "https://kvqdkohdpvmdylqgujpn.supabase.co/rest/v1/business_brand_profile?business_id=eq.$BUSINESS_ID&select=never_say" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" | \
jq -r '
.[0].never_say as $words |
if $words then
  (($words | join(" ") | test("[æøåÆØÅ]")) | if . then "✓ Contains Danish characters (æ, ø, å)" else "⚠ WARNING: No Danish characters found - may be English-only!" end),
  "",
  "Checking for known problematic generic terms:",
  (if ($words | any(. == "kom forbi" or . == "kom indenfor")) then "  ✓ \"kom forbi/indenfor\" found in banned list" else "  ✗ MISSING: \"kom forbi/indenfor\"" end),
  (if ($words | any(. == "nyd" or . == "nyd en kop")) then "  ✓ \"nyd\" found in banned list" else "  ✗ MISSING: \"nyd\"" end),
  (if ($words | any(. == "kaffepause")) then "  ✓ \"kaffepause\" found in banned list" else "  ✗ MISSING: \"kaffepause\"" end),
  (if ($words | any(. == "hyggelig stemning" or . == "hyggelig")) then "  ✓ \"hyggelig stemning\" found in banned list" else "  ⚠ Consider adding: \"hyggelig stemning\"" end)
else
  "✗ never_say is empty!"
end
'

echo ""

# ============================================================================
# VERIFICATION 5: Metadata
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}5. METADATA & TIMESTAMPS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

curl -s "https://kvqdkohdpvmdylqgujpn.supabase.co/rest/v1/business_brand_profile?business_id=eq.$BUSINESS_ID&select=voice_extraction_source,voice_extracted_at,voice_confidence_score,updated_at" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" | \
jq -r '
.[0] | 
"voice_extraction_source: \(.voice_extraction_source // "NOT SET")
voice_extracted_at: \(.voice_extracted_at // "NOT SET")
voice_confidence_score: \(.voice_confidence_score // "NOT SET")
updated_at: \(.updated_at // "NOT SET")
"
'

echo ""

# ============================================================================
# SUMMARY
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}VERIFICATION SUMMARY${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Calculate readiness score
SCORE=0
[ "$NEVER_SAY_OK" = "true" ] && SCORE=$((SCORE + 30))
[ "$SIGNATURES_OK" = "true" ] && SCORE=$((SCORE + 20))
[ "$OPENINGS_OK" = "true" ] && SCORE=$((SCORE + 20))
[ "$HUMOR_OK" = "true" ] && SCORE=$((SCORE + 15))
[ "$FORMALITY_OK" = "true" ] && SCORE=$((SCORE + 15))

echo -e "Data Readiness Score: ${BLUE}$SCORE/100${NC}"
echo ""

if [ $SCORE -ge 85 ]; then
  echo -e "${GREEN}✓ EXCELLENT: Data is ready for Phase 1 implementation${NC}"
  echo -e "${GREEN}  All critical enriched fields are populated.${NC}"
elif [ $SCORE -ge 70 ]; then
  echo -e "${YELLOW}⚠ GOOD: Data is mostly ready, minor gaps${NC}"
  echo -e "${YELLOW}  Consider filling missing personality fields (humor_level, formality)${NC}"
elif [ $SCORE -ge 50 ]; then
  echo -e "${YELLOW}⚠ FAIR: Some enriched fields missing${NC}"
  echo -e "${YELLOW}  Recommend running voice enrichment before Phase 1${NC}"
else
  echo -e "${RED}✗ POOR: Major data gaps detected${NC}"
  echo -e "${RED}  MUST run database cleanup and voice enrichment before Phase 1${NC}"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Verification Complete${NC}"
echo -e "${BLUE}========================================${NC}"
