# Language Quality Testing Suite

Comprehensive test suite for validating AI prompt language quality and consistency.

## Test Files

### 1. `language-quality.test.ts`
Tests for content quality and language purity:
- English leakage detection
- Meta-commentary detection
- Forbidden phrase detection
- Passive voice detection
- Batch quality scoring

### 2. `prompt-language-consistency.test.ts`
Tests for prompt structure and language consistency:
- Language detection in prompts
- Prompt component consistency
- Explicit language instruction validation
- Comprehensive prompt auditing

## Running Tests

### Run all tests
```bash
cd supabase/functions/_shared/tests
deno test --allow-read --allow-net
```

### Run specific test file
```bash
deno test language-quality.test.ts --allow-read
```

### Run with verbose output
```bash
deno test --allow-read --allow-net -- --verbose
```

### Run with coverage
```bash
deno test --coverage=coverage --allow-read --allow-net
deno coverage coverage
```

## Test Categories

### Unit Tests
Individual pattern detection and validation functions:
- Pattern matching
- Language detection
- Quality scoring algorithms

### Integration Tests
End-to-end content generation quality:
- Generate test content
- Validate against all quality rules
- Batch processing

### Validation Tests
Real prompt validation:
- Audit existing prompts
- Check language consistency
- Verify explicit instructions

## Quality Metrics

### Target Scores
- English leakage: <2%
- Meta-commentary: <1%
- Forbidden phrases: 0%
- Passive voice: <5%
- Overall quality: >95%

### Quality Score Calculation
```
Quality Score = (Passed Tests / Total Tests) × 100
```

## Usage Examples

### Testing Generated Content
```typescript
import { detectEnglishLeakage, assessContentQuality } from './language-quality.test.ts'

const content = "Your generated Danish content here..."

// Check single content
const leakageCheck = detectEnglishLeakage(content)
if (leakageCheck.hasLeakage) {
  console.error('English leakage detected:', leakageCheck.matches)
}

// Batch assessment
const batch = [content1, content2, content3]
const score = assessContentQuality(batch)
console.log('Quality score:', score.score, '%')
```

### Auditing Prompts
```typescript
import { auditPrompt } from './prompt-language-consistency.test.ts'

const prompt = {
  system: "Du er en content writer...",
  user: "Generer et forslag...",
  expectedLanguage: 'da',
  promptName: 'my-prompt'
}

const audit = auditPrompt(prompt)
if (!audit.isConsistent) {
  console.error('Issues:', audit.issues)
  console.log('Recommendations:', audit.recommendations)
}
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Language Quality Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: denoland/setup-deno@v1
      - run: |
          cd supabase/functions/_shared/tests
          deno test --allow-read --allow-net
```

### Pre-commit Hook
```bash
#!/bin/bash
# .git/hooks/pre-commit

cd supabase/functions/_shared/tests
deno test --quiet --allow-read --allow-net

if [ $? -ne 0 ]; then
  echo "Language quality tests failed. Commit aborted."
  exit 1
fi
```

## Extending Tests

### Adding New Pattern Detection
```typescript
// In language-quality.test.ts

const NEW_PATTERN = [
  /your-regex-pattern/i,
]

function detectNewPattern(text: string): { hasPattern: boolean; matches: string[] } {
  const matches: string[] = []
  for (const pattern of NEW_PATTERN) {
    const match = text.match(pattern)
    if (match) matches.push(match[0])
  }
  return { hasPattern: matches.length > 0, matches }
}

Deno.test('New Pattern Detection', () => {
  // Your test here
})
```

### Adding New Language Support
```typescript
// In prompt-language-consistency.test.ts

const LANGUAGE_INDICATORS = {
  // ... existing languages
  de: {
    systemKeywords: ['du bist', 'schreiben', 'deutsch'],
    forbiddenKeywords: ['you are', 'du er', 'engelsk'],
    requiredClosers: ['antworten sie nur auf deutsch'],
  }
}
```

## Troubleshooting

### Tests Failing Locally
1. Ensure you're in the correct directory: `supabase/functions/_shared/tests/`
2. Check Deno version: `deno --version` (requires 1.37+)
3. Verify permissions: `--allow-read --allow-net`

### False Positives
If legitimate content is flagged:
1. Review the pattern in question
2. Check for edge cases
3. Adjust regex patterns if needed
4. Add test case for the edge case

### Integration with Edge Functions
To test actual Edge Function output:
1. Replace mock `generateTestContent()` with real function calls
2. Use service role key for authentication
3. Test against staging environment first

## Best Practices

1. **Run tests before commits** - Catch issues early
2. **Review test output** - Don't just check pass/fail
3. **Update patterns** - As language evolves, update detection patterns
4. **Document edge cases** - Add comments for unusual patterns
5. **Keep tests fast** - Mock expensive operations
6. **Test real data** - Periodically test with real generated content

## Performance

### Expected Test Times
- Unit tests: <100ms total
- Integration tests: <500ms total
- Full suite: <1 second

### Optimization Tips
- Use mocked data for unit tests
- Batch real API calls for integration tests
- Run expensive tests only in CI/CD

## Maintenance

### Weekly Tasks
- Review quality scores from production
- Update forbidden phrase list if needed
- Check for new language patterns

### Monthly Tasks
- Audit all prompts with test suite
- Review and update quality thresholds
- Add new test cases from production issues

### Quarterly Tasks
- Full prompt audit and documentation
- Performance optimization
- Language expansion planning
