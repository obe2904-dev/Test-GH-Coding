# Menu Extraction v2.0 - Quick Integration Guide

## 🚀 Getting Started in 5 Minutes

### 1. Apply Database Migration

```bash
# Connect to Supabase database
psql $SUPABASE_DB_URL -f _add_menu_extraction_tracking.sql

# Verify columns were added
psql $SUPABASE_DB_URL -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'menu_results_v2' AND column_name LIKE '%_detected%';"
```

### 2. Test Basic Extraction

```typescript
import { ExtractionOrchestrator, SourceType } from '@/lib/menu-extraction';

// Initialize orchestrator
const orchestrator = new ExtractionOrchestrator({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  enableArtifactCapture: true, // Store debugging artifacts
  enablePersistence: true,     // Write to database
});

// Extract menu
const result = await orchestrator.extract({
  businessId: 'your-business-uuid',
  sourceId: 'your-source-uuid',
  sourceUrl: 'https://restaurant.dk/menu',
  sourceType: SourceType.HTML_INLINE,
  runId: crypto.randomUUID(),
  artifacts: {
    renderedHtml: '<html>Your menu HTML</html>',
    visibleText: 'Extracted text from page',
  },
});

// Check result
console.log('Status:', result.status);
// => 'done' | 'partial' | 'manual_review_needed' | 'permanent_error'

console.log('Quality Score:', result.quality.overallScore);
// => 0.85 (0.0-1.0)

console.log('Menu Items:', result.menu.categories.flatMap(c => c.items).length);
// => 42

console.log('Strategy Used:', result.attempts[0].strategy);
// => 'structured_json' | 'pdf_text' | 'semantic_dom'
```

### 3. Integrate with MenuPage.tsx

Replace existing `extractMenuInternal()` function:

```typescript
// OLD (MenuPage.tsx lines 504-620)
const extractMenuInternal = async (sourceId: string) => {
  // Old WordPress-specific extraction
  const response = await supabase.functions.invoke('menu-extract-v2', { ... });
  // ...
};

// NEW
import { ExtractionOrchestrator, SourceType } from '@/lib/menu-extraction';

const extractMenuInternal = async (sourceId: string) => {
  // 1. Initialize orchestrator
  const orchestrator = new ExtractionOrchestrator({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  });
  
  // 2. Get source from database
  const { data: source } = await supabase
    .from('menu_sources')
    .select('*')
    .eq('id', sourceId)
    .single();
  
  if (!source) throw new Error('Source not found');
  
  // 3. Scrape page (existing Cloud Run scraper)
  const scrapeResponse = await fetch('https://scraper-xxx.run.app/scrape-v3', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: source.source_url }),
  });
  
  const scrapedData = await scrapeResponse.json();
  
  // 4. Run extraction
  const result = await orchestrator.extract({
    businessId: currentBusiness.id,
    sourceId: source.id,
    sourceUrl: source.source_url,
    sourceType: scrapedData.sourceType || SourceType.HTML_INLINE,
    runId: crypto.randomUUID(),
    artifacts: {
      initialHtml: scrapedData.initialHtml,
      renderedHtml: scrapedData.renderedHtml,
      visibleText: scrapedData.visibleText,
      platformMetadata: scrapedData.platformMetadata,
    },
  });
  
  // 5. Handle result
  if (result.status === 'done' || result.status === 'partial') {
    toast.success(`Menu extracted! Quality: ${(result.quality.overallScore * 100).toFixed(0)}%`);
  } else if (result.status === 'manual_review_needed') {
    toast.warning('Menu extracted but needs review');
  } else {
    toast.error('Extraction failed: ' + result.errorMessage);
  }
  
  return result;
};
```

## 📋 Common Integration Tasks

### Task 1: Display Quality Metrics in UI

```typescript
// In MenuPage.tsx or MenuResultCard.tsx
import { ExtractionQuality } from '@/lib/menu-extraction';

function QualityBadge({ quality }: { quality: ExtractionQuality }) {
  const score = quality.overallScore;
  const color = score >= 0.8 ? 'green' : score >= 0.6 ? 'yellow' : 'red';
  
  return (
    <div className={`badge badge-${color}`}>
      Quality: {(score * 100).toFixed(0)}%
      
      {/* Detailed breakdown */}
      <div className="tooltip">
        <div>Completeness: {(quality.completenessScore * 100).toFixed(0)}%</div>
        <div>Evidence: {(quality.evidenceScore * 100).toFixed(0)}%</div>
        <div>Structure: {(quality.structuralScore * 100).toFixed(0)}%</div>
        <div>Consistency: {(quality.consistencyScore * 100).toFixed(0)}%</div>
      </div>
    </div>
  );
}
```

### Task 2: Show Extraction Warnings

```typescript
function ExtractionWarnings({ quality }: { quality: ExtractionQuality }) {
  if (quality.warningCodes.length === 0) return null;
  
  const warningMessages: Record<string, string> = {
    'WARN_NO_PRICES': 'Some items are missing prices',
    'WARN_FEW_ITEMS': 'Only a few items were found',
    'WARN_NAVIGATION_DETECTED': 'Navigation content may be included',
    'WARN_SEASONAL_MENU': 'This appears to be a seasonal menu',
  };
  
  return (
    <div className="warnings">
      {quality.warningCodes.map(code => (
        <div key={code} className="warning-item">
          ⚠️ {warningMessages[code] || code}
        </div>
      ))}
    </div>
  );
}
```

### Task 3: Link to Stored Artifacts

```typescript
// Query menu result with artifact_storage_prefix
const { data: menuResult } = await supabase
  .from('menu_results_v2')
  .select('artifact_storage_prefix, strategy_used, quality_summary')
  .eq('id', menuResultId)
  .single();

if (menuResult.artifact_storage_prefix) {
  // Download artifacts for debugging
  const { data: screenshot } = await supabase.storage
    .from('menu-extraction-artifacts')
    .download(`${menuResult.artifact_storage_prefix}/screenshot-full.webp`);
  
  const { data: html } = await supabase.storage
    .from('menu-extraction-artifacts')
    .download(`${menuResult.artifact_storage_prefix}/rendered.html.gz`);
}
```

### Task 4: Create Custom Strategy

```typescript
// Create: src/lib/menu-extraction/strategies/MyCustomStrategy.ts
import { BaseStrategy } from '../BaseStrategy';
import { ExtractionContext, MenuExtractionResult, SourceType } from '../types';

export class MyCustomStrategy extends BaseStrategy {
  strategyName = 'my_custom';
  strategyVersion = '1.0.0';
  
  async canHandle(context: ExtractionContext): Promise<boolean> {
    // Check if this strategy can handle the source
    return context.sourceUrl.includes('my-restaurant-provider.com');
  }
  
  async extract(context: ExtractionContext): Promise<MenuExtractionResult> {
    // Your extraction logic
    const html = context.artifacts.renderedHtml;
    
    // Use utility methods from BaseStrategy
    const items = this.extractItemsFromHtml(html);
    
    const menu = {
      title: 'My Menu',
      categories: [{
        id: this.hashContent('category-1'),
        name: 'Main Dishes',
        items: items,
      }],
      sourceLang: 'da',
      sourceCurrency: 'DKK',
      sourceEvidence: [{
        type: 'dom_text' as const,
        domSelector: '.menu-container',
        textExcerpt: html.substring(0, 200),
        contentHash: this.hashContent(html),
      }],
    };
    
    if (!this.isViableMenu(menu)) {
      return this.noMenuFound();
    }
    
    return {
      status: 'done',
      menu,
      quality: undefined, // Will be scored by orchestrator
      attempts: [{
        strategy: this.strategyName,
        strategyVersion: this.strategyVersion,
        status: 'success',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        candidateCount: 1,
      }],
    };
  }
  
  private extractItemsFromHtml(html: string) {
    // Custom extraction logic
    return [];
  }
}

// Register in ExtractionOrchestrator.ts
import { MyCustomStrategy } from './strategies/MyCustomStrategy';

this.strategies = [
  new StructuredJSONStrategy(),
  new PDFTextStrategy(),
  new MyCustomStrategy(), // Add your strategy
  new SemanticDOMStrategy(),
];
```

## 🔍 Debugging Tips

### Check What Strategies Can Handle a Source

```typescript
import { StructuredJSONStrategy, PDFTextStrategy, SemanticDOMStrategy } from '@/lib/menu-extraction';

const strategies = [
  new StructuredJSONStrategy(),
  new PDFTextStrategy(),
  new SemanticDOMStrategy(),
];

for (const strategy of strategies) {
  const canHandle = await strategy.canHandle(context);
  console.log(`${strategy.strategyName}: ${canHandle ? '✅' : '❌'}`);
}
```

### Inspect Extraction Quality Breakdown

```typescript
import { StandardQualityScorer } from '@/lib/menu-extraction';

const scorer = new StandardQualityScorer();
const quality = scorer.calculateQuality(
  { menu: extractedMenu, strategy: 'test' },
  { itemCount: 42, sourceType: SourceType.HTML_INLINE }
);

console.log('Overall:', quality.overallScore);
console.log('Completeness:', quality.completenessScore);
console.log('- Name coverage:', quality.itemNameCoverage);
console.log('- Price coverage:', quality.priceCoverage);
console.log('- Category coverage:', quality.categoryCoverage);
console.log('Evidence:', quality.evidenceScore);
console.log('Structural:', quality.structuralScore);
console.log('Consistency:', quality.consistencyScore);
console.log('Warnings:', quality.warningCodes);
```

### Validate Extracted Menu

```typescript
import { MenuValidator } from '@/lib/menu-extraction';

const validator = new MenuValidator();
const validation = validator.validate(extractedMenu, context);

console.log('Valid:', validation.valid);
console.log('Warnings:', validation.warnings);
console.log('Hard Failures:', validation.hardFailures);
```

## 🎯 Performance Tuning

### Disable Artifact Capture (Faster)

```typescript
const orchestrator = new ExtractionOrchestrator({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  enableArtifactCapture: false, // Skip artifact storage
  enablePersistence: true,
});
```

### Limit Strategy Attempts (Faster)

```typescript
const orchestrator = new ExtractionOrchestrator({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  maxStrategyAttempts: 2, // Only try first 2 strategies
});
```

### Adjust Timeouts

```typescript
// Edit src/lib/menu-extraction/constants.ts
export const CONFIG = {
  STRATEGY_TIMEOUT_MS: 20_000,        // 20 seconds per strategy (was 30)
  TOTAL_EXTRACTION_TIMEOUT_MS: 60_000, // 60 seconds total (was 120)
  // ...
};
```

## 📊 Query Extraction Metrics

### Success Rate by Platform

```sql
SELECT 
  platform_detected,
  COUNT(*) as total_extractions,
  SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as successful,
  ROUND(100.0 * SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) / COUNT(*), 1) as success_rate
FROM menu_results_v2
WHERE platform_detected IS NOT NULL
GROUP BY platform_detected
ORDER BY total_extractions DESC;
```

### Average Quality Score by Strategy

```sql
SELECT 
  strategy_used,
  COUNT(*) as total_uses,
  ROUND(AVG((quality_summary->>'overallScore')::numeric), 3) as avg_quality,
  ROUND(AVG((quality_summary->>'completenessScore')::numeric), 3) as avg_completeness
FROM menu_results_v2
WHERE strategy_used IS NOT NULL
GROUP BY strategy_used
ORDER BY total_uses DESC;
```

### Recent Extractions Needing Review

```sql
SELECT 
  mr.id,
  b.name as business_name,
  ms.source_url,
  mr.status,
  (mr.quality_summary->>'overallScore')::numeric as quality_score,
  mr.strategy_used,
  mr.created_at
FROM menu_results_v2 mr
JOIN menu_sources ms ON mr.source_id = ms.id
JOIN businesses b ON ms.business_id = b.id
WHERE mr.status = 'manual_review_needed'
ORDER BY mr.created_at DESC
LIMIT 20;
```

## 🆘 Troubleshooting

### Problem: TypeScript Import Errors

**Solution**: Ensure tsconfig.json has correct path mapping:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Problem: "No menu found" for Known Good Menu

**Solution**: Check if any strategy can handle the source:

```typescript
// Add logging to canHandle() methods
async canHandle(context: ExtractionContext): Promise<boolean> {
  const html = context.artifacts.renderedHtml;
  console.log('HTML length:', html?.length);
  console.log('Has JSON-LD:', html?.includes('application/ld+json'));
  // ...
}
```

### Problem: Quality Score Always Low

**Solution**: Check coverage metrics:

```typescript
const quality = scorer.calculateQuality(candidate, context);
console.log('Name coverage:', quality.itemNameCoverage); // Should be > 0.8
console.log('Price coverage:', quality.priceCoverage);   // Should be > 0.5
console.log('Evidence score:', quality.evidenceScore);    // Should be > 0.7
```

### Problem: Extraction Timeout

**Solution**: Check strategy performance:

```typescript
const startTime = Date.now();
const result = await strategy.extract(context);
console.log(`${strategy.strategyName} took ${Date.now() - startTime}ms`);
```

## 📚 Additional Resources

- **Full Documentation**: [src/lib/menu-extraction/README.md](src/lib/menu-extraction/README.md)
- **Implementation Summary**: [_IMPLEMENTATION_SUMMARY_MENU_EXTRACTION_V2.md](_IMPLEMENTATION_SUMMARY_MENU_EXTRACTION_V2.md)
- **Type Definitions**: [src/lib/menu-extraction/types.ts](src/lib/menu-extraction/types.ts)
- **External Assessment**: [_ASSESSMENT_MENU_EXTRACTION_ARCHITECTURE.md](_ASSESSMENT_MENU_EXTRACTION_ARCHITECTURE.md)

## ✅ Checklist for Integration

- [ ] Apply database migration (`_add_menu_extraction_tracking.sql`)
- [ ] Test orchestrator with sample HTML
- [ ] Update `MenuPage.tsx` to use orchestrator
- [ ] Display quality metrics in UI
- [ ] Show extraction warnings to users
- [ ] Link to artifact storage for debugging
- [ ] Query metrics dashboard (success rate, quality distribution)
- [ ] Test with 5-10 real restaurant websites
- [ ] Deploy to staging environment
- [ ] Monitor extraction success rate

---

**Ready to integrate?** Start with the database migration, then test the orchestrator standalone before integrating into MenuPage.tsx.
