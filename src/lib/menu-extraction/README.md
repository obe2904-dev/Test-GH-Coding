# Menu Extraction System v2.0

**Source-first, evidence-based menu extraction with multi-dimensional quality scoring.**

## Architecture Overview

This system extracts restaurant menus from various sources (HTML, PDF, JSON) using a **cascade of specialized strategies**, each optimized for different menu representations.

### Key Principles

1. **Source-First**: Discover all available menu sources before deciding extraction strategy
2. **Evidence-Based**: Every extracted field includes evidence (DOM selector, JSON path, PDF page)
3. **Multi-Dimensional Quality**: Score completeness, evidence, structure, and consistency separately
4. **Cascading Strategies**: Try best strategies first, fallback to others if needed
5. **Partial Success**: Capture 42 items with uncertain prices rather than failing completely

## Pipeline Stages

```
1. Source Discovery
   ├─ Scan HTML for PDF links, images, JSON-LD, iframes
   ├─ Detect platform (WordPress, Wix, Umbraco)
   ├─ Detect providers (Zenchef, Menufy, OpenTable)
   └─ Rank sources by quality potential

2. Artifact Capture
   ├─ Store initial HTML, rendered HTML, screenshots
   ├─ Redact sensitive data (API keys, emails, phones)
   └─ 90-day retention for debugging

3. Strategy Cascade
   ├─ StructuredJSONStrategy (Schema.org, JSON-LD)
   ├─ PDFTextStrategy (text layer PDFs)
   ├─ SemanticDOMStrategy (well-structured HTML)
   ├─ VisualScreenshotStrategy (GPT-4 Vision)
   └─ GenericHTMLStrategy (fallback)

4. Quality Scoring
   ├─ Completeness: name/price/category/description coverage
   ├─ Evidence: % of fields with source references
   ├─ Structural: category organization quality
   └─ Consistency: internal contradictions detection

5. Validation
   ├─ Warnings: low price coverage, navigation content
   ├─ Hard Failures: no items, invalid names
   └─ Manual Review: quality < 0.6

6. Persistence
   ├─ Write to menu_results_v2 (structured_data JSONB)
   └─ Flatten to menu_items_normalized (queryable rows)
```

## Usage

### Basic Extraction

```typescript
import { ExtractionOrchestrator } from '@/lib/menu-extraction';

const orchestrator = new ExtractionOrchestrator({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
});

const result = await orchestrator.extract({
  businessId: 'uuid',
  sourceId: 'uuid',
  sourceUrl: 'https://restaurant.dk/menu',
  sourceType: SourceType.HTML_INLINE,
  runId: crypto.randomUUID(),
  artifacts: {
    renderedHtml: '<html>...</html>',
    visibleText: 'menu text...',
  },
});

// Result structure
{
  status: 'done' | 'partial' | 'manual_review_needed' | 'permanent_error',
  menu: NormalizedMenu,
  quality: ExtractionQuality,
  attempts: StrategyAttempt[],
}
```

### Custom Strategy

```typescript
import { BaseStrategy } from '@/lib/menu-extraction';

class CustomStrategy extends BaseStrategy {
  strategyName = 'custom';
  strategyVersion = '1.0.0';
  
  async canHandle(context: ExtractionContext): Promise<boolean> {
    return context.sourceUrl.includes('custom-provider.com');
  }
  
  async extract(context: ExtractionContext): Promise<MenuExtractionResult> {
    // Your extraction logic
    const menu = await this.extractFromCustomProvider(context);
    
    return {
      status: 'done',
      menu,
      quality: undefined, // Will be scored by orchestrator
      attempts: [{ strategy: this.strategyName, status: 'success', ... }],
    };
  }
}
```

## Data Model

### NormalizedMenu

```typescript
{
  title: string,
  categories: MenuCategory[],
  servicePeriods?: ServicePeriod[],
  sourceLang: string,
  sourceCurrency: string,
  sourceEvidence: EvidenceReference[],
}
```

### MenuItem

```typescript
{
  id: string,
  name: string,
  description?: string,
  prices: Price[],
  variants: MenuItemVariant[],
  dietaryLabels: string[],
  sourceEvidence: EvidenceReference[],
  availability?: { servicePeriod?: string },
}
```

### EvidenceReference

```typescript
{
  type: 'dom_text' | 'json_field' | 'pdf_text' | 'screenshot_region',
  domSelector?: string,
  jsonPath?: string,
  pdfPage?: number,
  textExcerpt?: string,
  contentHash: string,
}
```

## Quality Scoring

### Thresholds

- **Auto-Accept**: ≥ 0.8 - High confidence, automatic approval
- **Partial Accept**: ≥ 0.6 - Usable but may have gaps
- **Manual Review**: < 0.6 - Requires human verification

### Score Components

1. **Completeness** (35%): Coverage of names, prices, categories, descriptions
2. **Evidence** (25%): Percentage of fields with source references
3. **Structural** (20%): Category organization and balance
4. **Consistency** (20%): No price outliers, duplicate detection

## Error Handling

### Retryable Errors
- `ERR_NETWORK_TIMEOUT` - Network issues
- `ERR_BROWSER_CRASH` - Browser crashed
- `ERR_OPENAI_RATE_LIMIT` - API rate limit

### Permanent Errors
- `ERR_SOURCE_NOT_FOUND` - 404 Not Found
- `ERR_PDF_ENCRYPTED` - Password-protected PDF
- `ERR_NO_MENU_EXISTS` - Confirmed no menu on page

### Warnings
- `WARN_NO_PRICES` - Items found but prices missing
- `WARN_NAVIGATION_DETECTED` - Extracted nav content instead of menu
- `WARN_SEASONAL_MENU` - May be outdated (summer/winter menu)

## Database Schema

### menu_results_v2 (Enhanced)

```sql
-- Existing columns
structured_data JSONB,
ai_summary TEXT,
service_periods TEXT[],
status TEXT,

-- New tracking columns (nullable, backward compatible)
platform_detected TEXT,
provider_detected TEXT,
strategy_used TEXT,
extraction_run_id UUID,
artifact_storage_prefix TEXT,
quality_summary JSONB,
extraction_attempts INTEGER,
pipeline_version TEXT
```

### menu_items_normalized (Unchanged)

```sql
menu_result_id UUID,
item_name TEXT,
item_price NUMERIC,
category_name TEXT,
description TEXT,
dietary_labels TEXT[],
service_period TEXT
```

## Configuration

### Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
OPENAI_API_KEY=sk-xxx
CLOUD_RUN_SCRAPER_URL=https://scraper-xxx.run.app
```

### Constants

See `constants.ts` for:
- Quality thresholds
- Strategy priorities
- Danish price patterns
- Retry configurations
- LLM settings

## Testing

### Unit Tests

```bash
npm test src/lib/menu-extraction
```

### Integration Tests

```bash
npm run test:integration
```

### Manual Testing

```bash
npm run extract:test -- --url https://restaurant.dk/menu
```

## Performance

### Expected Metrics

- **Success Rate**: 70-85% (v2.0), targeting 90%+ with visual strategy
- **Extraction Time**: 5-15 seconds per menu
- **Quality Score**: Average 0.75 for Danish restaurants
- **Artifact Storage**: ~$0.05-0.15/month per 1,000 businesses (90-day retention)

### Optimization Tips

1. Enable artifact capture only in development/staging
2. Set `maxStrategyAttempts` to 3 for faster extraction
3. Disable persistence during testing
4. Use strategy-specific timeouts for slow strategies

## Deployment

### Database Migration

```bash
psql $DATABASE_URL -f _add_menu_extraction_tracking.sql
```

### Vercel Edge Function

Update `supabase/functions/menu-extract-v2/index.ts`:

```typescript
import { ExtractionOrchestrator } from '@/lib/menu-extraction';

const orchestrator = new ExtractionOrchestrator({
  supabaseUrl: Deno.env.get('SUPABASE_URL')!,
  supabaseKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
});

Deno.serve(async (req) => {
  const { sourceId, businessId, artifacts } = await req.json();
  
  const result = await orchestrator.extract({
    businessId,
    sourceId,
    sourceUrl: artifacts.sourceUrl,
    sourceType: artifacts.sourceType,
    runId: crypto.randomUUID(),
    artifacts,
  });
  
  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

## Roadmap

### Phase 1: Core Infrastructure ✅
- Type system, constants, base strategy
- Artifact capture with redaction
- Database schema enhancement
- Quality scoring and validation
- Persistence helpers

### Phase 2: Source Discovery (In Progress)
- PDF link detection
- Image gallery detection
- JSON-LD extraction
- Provider iframe detection
- Source ranking algorithm

### Phase 3: Additional Strategies (In Progress)
- ✅ StructuredJSONStrategy
- ✅ PDFTextStrategy
- ✅ SemanticDOMStrategy
- ⏳ VisualScreenshotStrategy (GPT-4 Vision)
- ⏳ GenericHTMLStrategy (fallback)

### Phase 4: Integration & UI (Next)
- MenuPage.tsx integration
- Manual review interface
- Quality dashboard
- Monitoring and alerts

## Support

For questions or issues, contact the development team or see internal documentation.

---

**Version**: 2.0.0  
**Last Updated**: 2025  
**Maintainer**: P2G Development Team
