# Quick Start - Language Quality Testing

## Installation

No installation required! Tests use Deno's built-in testing framework.

## Running Tests

### 1. Quick Test (Recommended)
```bash
cd supabase/functions/_shared/tests
./run-tests.sh
```

### 2. Individual Test Files

**Language Quality Tests:**
```bash
deno test language-quality.test.ts --allow-read
```

**Prompt Consistency Tests:**
```bash
deno test prompt-language-consistency.test.ts --allow-read
```

**Integration Tests** (requires environment variables):
```bash
export SUPABASE_URL="your-supabase-url"
export SUPABASE_SERVICE_ROLE_KEY="your-service-key"
deno test integration-example.test.ts --allow-net --allow-read --allow-write
```

### 3. Watch Mode (Development)
```bash
deno test --watch --allow-read
```

## Test Results

### ✅ All Tests Pass
```
test Language Detection - Identifies English leakage ... ok (5ms)
test Meta-commentary Detection - Identifies AI reasoning ... ok (3ms)
test Forbidden Phrases Detection - Identifies banned words ... ok (4ms)
test Passive Voice Detection - Identifies passive constructions ... ok (3ms)

ok | 15 passed | 0 failed (127ms)
```

### ❌ Tests Fail
```
test Content Generation - English leakage is detected ... FAILED (8ms)

 ERRORS 

Content Generation - English leakage is detected => ./language-quality.test.ts:145:3
error: AssertionError: Failed to detect English leakage
    at assertEquals (https://deno.land/std@0.168.0/testing/asserts.ts:190:9)
```

## What the Tests Check

### 1. Language Quality Tests
- ✅ No English words in Danish output
- ✅ No meta-commentary ("Based on...", "Given that...")
- ✅ No forbidden marketing buzzwords
- ✅ No passive voice constructions
- ✅ Overall quality score >95%

### 2. Prompt Consistency Tests
- ✅ System prompt language matches output language
- ✅ User prompt language matches output language
- ✅ Explicit language instructions present
- ✅ No language mixing within prompts

### 3. Integration Tests (Optional)
- ✅ Real Edge Function outputs pass quality checks
- ✅ Batch processing maintains quality
- ✅ Load testing (50+ generations)
- ✅ Regression testing vs baseline

## Common Issues

### Issue: "Permission denied"
```bash
chmod +x run-tests.sh
```

### Issue: "Deno not found"
Install Deno: https://deno.land/manual/getting_started/installation

### Issue: "Module not found"
Make sure you're in the correct directory:
```bash
cd supabase/functions/_shared/tests
```

## Daily Workflow

### For Developers

**Before committing changes:**
```bash
./run-tests.sh
```

**When changing prompts:**
```bash
# 1. Run tests to establish baseline
deno test language-quality.test.ts --allow-read

# 2. Make your changes

# 3. Run tests again to verify no regression
deno test language-quality.test.ts --allow-read

# 4. If quality improved, great! If degraded, fix issues.
```

### For QA

**Daily quality check:**
```bash
# Run full suite including integration tests
export SUPABASE_URL="..."
export SUPABASE_SERVICE_ROLE_KEY="..."
deno test --allow-net --allow-read --allow-write
```

**Weekly baseline update:**
```bash
# Run regression test to update baseline if quality improved
deno test integration-example.test.ts --allow-net --allow-read --allow-write
```

## Interpreting Results

### Quality Score Breakdown
```
Quality Score: 98.5%
  Passed: 197/200
  Failed: 3
  
  Issues:
    English Leakage: 2
    Meta-commentary: 1
    Forbidden Phrases: 0
    Passive Voice: 0
```

**Good:** >95% = Production ready
**Warning:** 90-95% = Review failed cases
**Bad:** <90% = Do not deploy

### Sample Failed Test Output
```
Failed content:
"Based on the waterfront location, this café serverer..."

Issues detected:
- English leakage: "Based on"
- Passive voice: "serverer"

Recommendation: Fix prompt to eliminate meta-commentary
```

## Next Steps

1. ✅ Run `./run-tests.sh` to verify setup
2. ✅ Review test output for any warnings
3. ✅ Set up pre-commit hook (optional)
4. ✅ Integrate with CI/CD (optional)
5. ✅ Enable integration tests when ready

## Support

Questions? Check:
- README.md - Full documentation
- integration-example.test.ts - Real-world examples
- language-quality.test.ts - Pattern definitions
