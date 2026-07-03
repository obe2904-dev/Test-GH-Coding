#!/bin/bash

# Language Quality Test Runner
# Runs all language quality and consistency tests

set -e

echo "🧪 Running Language Quality Tests..."
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Deno is installed
if ! command -v deno &> /dev/null; then
    echo -e "${RED}❌ Deno is not installed. Please install Deno first.${NC}"
    echo "Visit: https://deno.land/manual/getting_started/installation"
    exit 1
fi

echo "✅ Deno version: $(deno --version | head -n 1)"
echo ""

# Navigate to test directory
cd "$(dirname "$0")"

# Run language quality tests
echo "📋 Running Language Quality Tests..."
echo "------------------------------------"
if deno test language-quality.test.ts --allow-read --allow-net --quiet; then
    echo -e "${GREEN}✅ Language Quality Tests PASSED${NC}"
else
    echo -e "${RED}❌ Language Quality Tests FAILED${NC}"
    exit 1
fi
echo ""

# Run prompt consistency tests
echo "📋 Running Prompt Consistency Tests..."
echo "---------------------------------------"
if deno test prompt-language-consistency.test.ts --allow-read --allow-net --quiet; then
    echo -e "${GREEN}✅ Prompt Consistency Tests PASSED${NC}"
else
    echo -e "${RED}❌ Prompt Consistency Tests FAILED${NC}"
    exit 1
fi
echo ""

# Summary
echo "======================================"
echo -e "${GREEN}🎉 All tests passed successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. Review test output for any warnings"
echo "2. Check quality scores meet targets (>95%)"
echo "3. Update prompts if issues detected"
echo ""
