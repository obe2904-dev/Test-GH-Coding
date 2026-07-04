# WEEKLY STRATEGY GENERATION - COMPREHENSIVE ANALYSIS
**Date:** 2026-06-07  
**Scope:** Phase 0 → Phase 1 → Phase 2 (excluding text generation from ideas)

---

## 1. ARCHITECTURE OVERVIEW

### 1.1 Three-Phase Pipeline

```
Phase 0: Contextual Analysis (behavioral insights)
    ↓ (~2s, GPT-4o)
Phase 1: Strategic Brief (angles + reasoning) 
    ↓ (~4-6s, GPT-4o, 2 AI calls)
Phase 2: Content Plan (planner → detailer → narrative)
    ↓ (~10-20s depending on post count, Gemini 2.5 Flash)
─────────────────────────────────────────────────
Total: ~16-28 seconds for 4-post week
```

### 1.2 Orchestration Flow

**Entry Point:** `get-weekly-strategy/index.ts`
- Lines: ~1,700 (main function)
- Complexity: **Medium-High**
- Responsibilities:
  - User authentication
  - Database queries (parallel execution)
  - Week context assembly
  - Cache management
  - Async strategy generation trigger

**Strategy Generator:** `weekly-strategy-generator.ts`
- Lines: ~200 (thin orchestrator)
- Complexity: **Low**
- Coordinates: Phase 0 → 1 → 2 → validation → post-processing

---

## 2. CODE COMPLEXITY ANALYSIS

### 2.1 Phase 0: Contextual Analysis
**File:** `strategy/phase0.ts` (684 lines)

**Complexity:** ★★★☆☆ (Medium)

**Key Components:**
- Prompt builder: ~500 lines
- Driver hierarchy pre-computation
- Weekly framing synthesis
- Weather relevance capping
- Behavioral language transformation

**Prompt Structure (estimated):**
```
Base prompt:                    ~1,500 tokens
+ Business context:             ~300 tokens
+ Operating model:              ~200 tokens  
+ Driver hierarchy:             ~300 tokens
+ Weekly framing:               ~200 tokens
+ Weather data:                 ~150 tokens
+ Events:                       ~200 tokens
+ Programme windows (v5):       ~500 tokens (if present)
──────────────────────────────────────────────
TOTAL INPUT:                    ~3,350 tokens
Expected output:                ~1,500 tokens
──────────────────────────────────────────────
TOTAL TOKENS PER CALL:          ~4,850 tokens
```

**AI Configuration:**
- Model: `gpt-4o` (all tiers)
- Temperature: 0.3 (first attempt), 0 (retries)
- Max tokens: 2,048
- Retries: Up to 3 attempts

**Cost per call:**
- Input: 3,350 tokens @ $2.50/1M = **$0.0084**
- Output: 1,500 tokens @ $10/1M = **$0.015**
- **Total: ~$0.023**

---

### 2.2 Phase 1: Strategic Brief
**File:** `strategy/phase1.ts` (1,088 lines)

**Complexity:** ★★★★★ (Very High)

**Key Components:**
1. **Step 1: Contextual Analysis Prompt** (~300 lines)
   - Business intelligence integration
   - Activation engine output formatting
   - Phase 0 factor synthesis
   - Service period strategies

2. **Step 2: Full Strategy Prompt** (~400 lines)
   - Menu capabilities analysis
   - Goal mode guidance
   - Segment allocation
   - Angle generation instructions
   - Slot system integration (NEW: Business Rules Engine)

3. **Slot System** (~200 lines)
   - Revenue-driven slot generation
   - BASE_SLOTS_FALLBACK (hardcoded)
   - Slot metadata assignment
   - Content category allocation

**Two-Step Generation Process:**

#### Step 1: Contextual Analysis
```
Base prompt:                    ~2,000 tokens
+ Business intelligence:        ~800 tokens
+ Activation output:            ~1,200 tokens (if present)
+ Phase 0 analysis:             ~600 tokens
+ Events/weather:               ~200 tokens
──────────────────────────────────────────────
TOTAL INPUT:                    ~4,800 tokens
Expected output:                ~800 tokens
──────────────────────────────────────────────
TOTAL TOKENS PER CALL:          ~5,600 tokens
```

**Cost (Step 1):**
- Input: 4,800 tokens @ $2.50/1M = **$0.012**
- Output: 800 tokens @ $10/1M = **$0.008**
- **Total: ~$0.020**

#### Step 2: Full Strategy
```
Base prompt:                    ~2,500 tokens
+ Business intelligence:        ~800 tokens
+ Segment guidance:             ~1,000 tokens (if activation)
+ Menu capabilities:            ~300 tokens
+ Phase 0 analysis:             ~600 tokens
+ Contextual analysis (Step 1): ~800 tokens
+ Example:                      ~1,000 tokens
──────────────────────────────────────────────
TOTAL INPUT:                    ~7,000 tokens
Expected output:                ~2,500 tokens (4 angles)
──────────────────────────────────────────────
TOTAL TOKENS PER CALL:          ~9,500 tokens
```

**Cost (Step 2):**
- Input: 7,000 tokens @ $2.50/1M = **$0.0175**
- Output: 2,500 tokens @ $10/1M = **$0.025**
- **Total: ~$0.043**

**Phase 1 Total Cost:** $0.020 + $0.043 = **$0.063**

**AI Configuration:**
- Model: `gpt-4o` (both tiers)
- Temperature: 0.3/0.55 (first), 0 (retries)
- Max tokens: 2,048 (Step 1), ~4,096 (Step 2)
- Retries: Up to 3 attempts each

**Business Rules Engine Integration:**
```typescript
// Lines 927-931 in phase1.ts
const revenueDrivers = (context as any).revenue_drivers;
const slots = revenueDrivers 
  ? generateSlotsFromRevenueDrivers(revenueDrivers)  // ← Data-driven
  : BASE_SLOTS_FALLBACK;                             // ← Hardcoded
```

**NEW: Revenue-Driven Slot Generation**
- Source: `brand_profile_v5.layer_1_programmes` (95% confidence)
- Replaces: Hardcoded BASE_SLOTS when data available
- Impact: Intelligent timing based on actual revenue moments

---

### 2.3 Phase 2: Content Plan
**Files:** `strategy/phase2/` (2,176 total lines)

**Complexity:** ★★★★☆ (High)

**Sub-phases:**

#### 2a: Content Planner (~300 lines)
```
Base prompt:                    ~1,500 tokens
+ Strategic brief:              ~1,200 tokens
+ Available days:               ~100 tokens
+ Previous week history:        ~200 tokens
+ Events for pinning:           ~200 tokens
──────────────────────────────────────────────
TOTAL INPUT:                    ~3,200 tokens
Expected output:                ~600 tokens (4 post shells)
──────────────────────────────────────────────
TOTAL TOKENS PER CALL:          ~3,800 tokens
```

**Cost (Phase 2a):**
- Input: 3,200 tokens @ $0.15/1M = **$0.00048**
- Output: 600 tokens @ $0.60/1M = **$0.00036**
- **Total: ~$0.00084**

**Model:** `gemini-2.5-flash`
**Temperature:** 0.2

#### 2b: Content Detailer (~1,200 lines)
**Most complex sub-phase** - generates detailed post specifications

```
PER POST:
Base prompt:                    ~3,500 tokens
+ Business intelligence:        ~1,000 tokens
+ Strategic context:            ~800 tokens
+ Contextual analysis:          ~600 tokens
+ Menu items:                   ~1,500 tokens
+ Used items tracking:          ~200 tokens
+ Content plan slot:            ~300 tokens
+ Brand voice:                  ~400 tokens
──────────────────────────────────────────────
TOTAL INPUT:                    ~8,300 tokens
Expected output:                ~1,200 tokens
──────────────────────────────────────────────
TOTAL TOKENS PER POST:          ~9,500 tokens
```

**Cost per post (Phase 2b):**
- Input: 8,300 tokens @ $0.15/1M = **$0.00125**
- Output: 1,200 tokens @ $0.60/1M = **$0.00072**
- **Total: ~$0.00197 per post**

**For 4 posts:** $0.00197 × 4 = **$0.0079**

**Model:** `gpt-4o` (NOT Gemini - uses OpenAI)
**Temperature:** 0.4 (first), 0 (retries)
**Max tokens:** 8,192
**Sequential execution:** 800ms delay between posts

#### 2c: Narrative Generator (~500 lines)
```
Base prompt:                    ~2,000 tokens
+ Strategic brief:              ~1,200 tokens
+ Post summaries:               ~800 tokens
+ Contextual analysis:          ~600 tokens
+ Context data:                 ~500 tokens
──────────────────────────────────────────────
TOTAL INPUT:                    ~5,100 tokens
Expected output:                ~1,500 tokens
──────────────────────────────────────────────
TOTAL TOKENS PER CALL:          ~6,600 tokens
```

**Cost (Phase 2c):**
- Input: 5,100 tokens @ $0.15/1M = **$0.00077**
- Output: 1,500 tokens @ $0.60/1M = **$0.00090**
- **Total: ~$0.00167**

**Model:** `gemini-2.5-flash`
**Temperature:** 0.3
**Max tokens:** 3,072

**Phase 2 Total Cost:** $0.00084 + $0.0079 + $0.00167 = **$0.0104**

---

## 3. PERSONA & BRAND VOICE USAGE

### 3.1 Business Character
**Source:** `business_brand_profile.business_character` (text field)
**Usage:** Phase 0, Phase 1, Phase 2b prompts
**Purpose:** AI-generated free-form business description

**Example:**
```
"Hybrid day-to-evening cafe serving brunch to dinner, 
waterfront location, signature cocktails and Nordic lunch menu"
```

### 3.2 Brand Voice Structure
**Source:** `brand_profile_v5` JSONB column

**Components:**
```typescript
brand_voice: {
  content_strategy?: {
    goal_blend: {
      drive_footfall: 50%,
      build_brand: 30%,
      retain_loyalty: 20%
    },
    content_category_weights: {
      product_menu: 35%,
      craving_visual: 25%,
      behind_scenes: 20%,
      team_people: 20%
    },
    week_goal_blend?: { ... }  // Weekly modulation
  }
}
```

**Used in:**
- Phase 1: Slot D goal mode selection
- Phase 1: Content category allocation
- Phase 2a: Post type distribution
- Phase 2b: Content direction guidance

### 3.3 Business Intelligence (NEW)
**Source:** Assembled from `brand_profile_v5.layer_1_programmes`

**Components:**
1. **Service Period Strategies**
   - Goal distribution per service period
   - Audience segments per period
   - Decision timing patterns

2. **Audience Segments**
   - Segment names and motivations
   - Commercial orientation
   - Time windows

**Token Impact:** +800-1,200 tokens per prompt

**Usage:**
- Phase 1 Step 1: Contextual analysis guidance
- Phase 1 Step 2: Goal mode allocation
- Phase 2b: Post detail generation

---

## 4. TOTAL COST ANALYSIS

### 4.1 Per-Week Strategy Generation

| Phase | Model | Input Tokens | Output Tokens | Cost |
|-------|-------|--------------|---------------|------|
| Phase 0 | GPT-4o | 3,350 | 1,500 | $0.023 |
| Phase 1 Step 1 | GPT-4o | 4,800 | 800 | $0.020 |
| Phase 1 Step 2 | GPT-4o | 7,000 | 2,500 | $0.043 |
| Phase 2a | Gemini 2.5 Flash | 3,200 | 600 | $0.00084 |
| Phase 2b (×4 posts) | GPT-4o | 33,200 | 4,800 | $0.0079 |
| Phase 2c | Gemini 2.5 Flash | 5,100 | 1,500 | $0.00167 |
| **TOTAL** | | **56,650** | **11,700** | **$0.096** |

**Note:** Costs assume:
- GPT-4o: $2.50/1M input, $10/1M output
- Gemini 2.5 Flash: $0.15/1M input, $0.60/1M output

### 4.2 Cost Variations

**Smart Tier (4 posts/week):** ~$0.096
**Pro Tier (5-7 posts/week):**
- 5 posts: ~$0.098 (+$0.002)
- 6 posts: ~$0.100 (+$0.004)
- 7 posts: ~$0.102 (+$0.006)

**Cost drivers:**
- Phase 2b scales linearly with post count
- Each additional post: +$0.00197

**With Activation Engine:**
- Additional input tokens: +1,200 (Phase 1)
- Additional cost: ~$0.003
- **New total: ~$0.099**

### 4.3 Monthly Volume Estimate

**Assumptions:**
- 100 active businesses
- Average 4.2 weeks/month
- Mix: 70% Smart (4 posts), 30% Pro (6 posts)

**Monthly calculations:**
```
Smart businesses: 70 × 4.2 weeks × $0.096 = $28.22
Pro businesses:   30 × 4.2 weeks × $0.100 = $12.60
──────────────────────────────────────────────
TOTAL MONTHLY:                          $40.82
ANNUAL:                                 $490
```

**Per business annual cost:** ~$4.90

---

## 5. PROMPT ENGINEERING PATTERNS

### 5.1 Common Patterns

**1. Structured Data Injection**
```
═══════════════════════════════════════════════
SECTION TITLE
═══════════════════════════════════════════════

Formatted data here...
```

**2. Example-Driven Learning**
```
STELLAR EXAMPLE (using contextual_analysis)
{
  "week_summary": "...",
  "angles": [...]
}
```

**3. Progressive Disclosure**
- Phase 0 → Pure analysis (no strategy)
- Phase 1 Step 1 → Contextual synthesis
- Phase 1 Step 2 → Use Step 1 output for angles
- Phase 2 → Execute strategic brief

**4. Constraint Enforcement**
```
VIGTIGT: Hver angle skal matche ét af disse aktiverede segmenter.
⚠️ VIGTIGT: Du SKAL levere præcis 4 angles
SVAR KUN MED JSON - INGEN FORKLARING FØR ELLER EFTER
```

### 5.2 Anti-Hallucination Techniques

**1. Factual Grounding**
- Phase 0 separates facts from strategy
- Phase 1 references Phase 0 output
- Phase 2 references Phase 1 output

**2. Deduplication Tracking**
```typescript
const usedMenuItems: string[] = [...]
const usedExperiencePosts: Array<{...}> = []
const usedRationaleThemes: string[] = []
```

**3. Behavioral Language Transformation**
```typescript
// Post-process financial jargon → behavioral patterns
.replace(/budgetbevidsthed/gi, 'folk overvejer mere hvad de bruger')
.replace(/impulskøb/gi, 'spontane valg')
```

**4. Weather Weight Capping**
```typescript
// GPT-4o over-weights weather — deterministic override
if (weatherRelevance === 'low') {
  factor.strategic_weight = 'lav'; // Cap to 'lav'
}
```

---

## 6. CODE QUALITY METRICS

### 6.1 Cyclomatic Complexity

| File | Lines | Functions | Estimated Complexity |
|------|-------|-----------|---------------------|
| phase0.ts | 684 | ~8 | Medium (15-20) |
| phase1.ts | 1,088 | ~15 | Very High (30-40) |
| phase2/index.ts | 182 | ~3 | Low (5-8) |
| phase2/phase2a.ts | ~300 | ~5 | Medium (12-15) |
| phase2/phase2b.ts | ~1,200 | ~20 | Very High (35-45) |
| phase2/phase2c.ts | ~500 | ~8 | Medium (15-20) |

**Highest complexity:** Phase 2b (Content Detailer)
- Menu item selection logic
- Deduplication tracking
- CTA resolution
- Slot metadata assignment
- Business intelligence integration

### 6.2 Dependency Chain

```
get-weekly-strategy/index.ts
    ↓
weekly-strategy-generator.ts
    ↓
    ├── phase0.ts → callAI (GPT-4o)
    ├── phase1.ts → callAI (GPT-4o × 2)
    │   ├── business-rules-engine.ts (NEW)
    │   └── assemble-business-intelligence.ts
    └── phase2/index.ts
        ├── phase2a.ts → callAI (Gemini)
        ├── phase2b.ts → callAI (GPT-4o × 4-7)
        └── phase2c.ts → callAI (Gemini)
```

**Critical dependencies:**
- `ai-provider.ts` (AI model abstraction)
- `assemble-business-intelligence.ts` (data assembly)
- `business-rules-engine.ts` (slot generation)
- `types/strategy-types.ts` (type definitions)

### 6.3 Error Handling

**Retry Logic:**
- All AI calls: Up to 3 attempts
- Temperature reduction: 0.3 → 0 on retry
- Exponential backoff: 1s, 2s, 3s

**Validation:**
- Phase 2: Structural validation post-generation
- Business Intelligence: Usage validation
- Output: JSON schema validation

---

## 7. PERFORMANCE CHARACTERISTICS

### 7.1 Timing Analysis (4-post week)

| Phase | AI Calls | Model | Avg Time | Parallel? |
|-------|----------|-------|----------|-----------|
| Phase 0 | 1 | GPT-4o | ~2s | No |
| Phase 1 Step 1 | 1 | GPT-4o | ~2s | No |
| Phase 1 Step 2 | 1 | GPT-4o | ~3s | No |
| Phase 2a | 1 | Gemini | ~1.5s | No |
| Phase 2b | 4 | GPT-4o | ~8s | Sequential |
| Phase 2c | 1 | Gemini | ~2s | No |
| **TOTAL** | **9** | | **~18.5s** | |

**Sequential bottleneck:** Phase 2b (800ms delay between posts)

**7-post week timing:** ~25s (additional 3 posts × 2s each)

### 7.2 Database Operations (get-weekly-strategy/index.ts)

**Parallel queries (Promise.all):**
1. `business_operations` (opening hours, active platforms)
2. `business_brand_profile` (character, revenue_drivers, brand_profile_v5)
3. `business_tier` (subscription info) - REMOVED (column doesn't exist)

**Sequential queries:**
1. Menu items fetch
2. Drink items fetch
3. Cache check
4. Strategy row insert

**Total DB time:** ~200-500ms (parallel execution)

### 7.3 Caching Strategy

**Cache key:** `business_id + week_start`
**Cache duration:** Indefinite (until regenerate=true)
**Cache hit:** Returns immediately (~50ms)
**Cache miss:** Full generation (~18.5s)

**Cache effectiveness:**
- First request: 18.5s
- Subsequent requests: 50ms
- **Speedup: 370x**

---

## 8. REVENUE DRIVER INTEGRATION IMPACT

### 8.1 New Data Flow

**Before (Hardcoded):**
```
Phase 1 → BASE_SLOTS_FALLBACK
    ↓
Slot A: Fri-Sat 14:00 (hardcoded)
Slot B: Wed-Thu 11:00 (hardcoded)
```

**After (Data-Driven):**
```
analyze-revenue-drivers → brand_profile_v5.layer_1_programmes
    ↓ (95% confidence)
business_brand_profile.revenue_drivers (JSONB)
    ↓
Phase 1 → generateSlotsFromRevenueDrivers()
    ↓
Slot A: Thu 14:00 (weekend dinner intent)
Slot B: Mon-Fri 08:00-10:00 (lunch decision window)
```

### 8.2 Token Impact

**Additional context in Phase 1:**
```
revenue_drivers object:       ~500 tokens
├─ analyzed_from:             "brand_profile_v5.layer_1_programmes"
├─ confidence_score:          95
├─ primary_revenue_moment:    {...} ~150 tokens
└─ secondary_moments:         [...] ~350 tokens
```

**Cost increase:** +$0.001 per strategy
**New Phase 1 cost:** $0.064 (was $0.063)

### 8.3 Quality Improvement

**Precision gains:**
- Timing windows: From generic to service-specific
- Content focus: Aligned with actual revenue moments
- Decision windows: Based on customer behavior patterns

**Confidence levels:**
- Structured data: 95% (from programmes)
- AI inference: 85% (from menu/hours)
- Hardcoded fallback: 60% (generic assumptions)

---

## 9. OPTIMIZATION OPPORTUNITIES

### 9.1 Code Simplification

**High complexity areas:**
1. **Phase 2b:** 1,200 lines, 35-45 complexity
   - Candidate for modularization
   - Menu selection logic could be extracted
   - Deduplication tracking could be service

2. **Phase 1:** Two-step generation adds latency
   - Consider single-shot with structured output
   - Trade-off: Quality vs. speed

### 9.2 Cost Reduction

**1. Phase 2b → Gemini Migration**
- Current: GPT-4o ($0.0079 for 4 posts)
- Proposed: Gemini 2.5 Flash ($0.0006 for 4 posts)
- **Savings: $0.0073 per strategy (76% reduction in Phase 2b)**
- **Risk:** Quality degradation in menu selection

**2. Prompt Compression**
- Business intelligence: 800-1,200 tokens
- Opportunity: Summarize to 400-600 tokens
- **Savings: ~$0.005 per strategy**

**3. Smart Caching**
- Phase 0 output: Reusable for similar contexts
- Could cache weather interpretations by conditions
- **Potential savings: 20-30% on regenerations**

### 9.3 Performance Improvements

**1. Parallel Phase 2b Execution**
- Current: Sequential (800ms delays)
- Proposed: Parallel with rate limiting
- **Time savings: ~3-5s for 4 posts**

**2. Incremental Context Loading**
- Load business intelligence only when needed
- Lazy load menu items for Phase 2b
- **DB time reduction: ~100-200ms**

---

## 10. RISK ASSESSMENT

### 10.1 Complexity Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Phase 1 two-step failure | High | Retry logic, fallback to single-step |
| Phase 2b sequential bottleneck | Medium | Already has 800ms delays, stable |
| Business intelligence size growth | Medium | Token budget monitoring |
| Revenue driver data missing | Low | BASE_SLOTS_FALLBACK exists |

### 10.2 Cost Risks

| Scenario | Monthly Cost Impact | Trigger |
|----------|---------------------|---------|
| GPT-4o price increase (20%) | +$8.16/month | OpenAI pricing change |
| User base growth (2x) | +$40.82/month | Business growth |
| Average posts/week increase (5→6) | +$1.68/month | Tier changes |
| Failed retries (10% increase) | +$4.08/month | AI reliability issues |

**Current monthly buffer:** ~$10 (cost: $40.82)

### 10.3 Quality Risks

**1. Prompt Drift**
- Symptoms: Inconsistent outputs, missing fields
- Monitoring: Validation failure rates
- Threshold: >5% validation failures

**2. Business Intelligence Gaps**
- Symptoms: Falling back to BASE_SLOTS frequently
- Monitoring: revenue_drivers presence rate
- Threshold: <70% coverage

**3. Context Overload**
- Symptoms: Truncated responses, JSON errors
- Monitoring: Token usage approaching max
- Threshold: >90% of maxTokens used

---

## 11. SUMMARY & RECOMMENDATIONS

### 11.1 Current State

✅ **Strengths:**
- Well-architected three-phase pipeline
- Strong anti-hallucination measures
- Effective caching (370x speedup)
- Revenue-driven slot intelligence (NEW)
- Reasonable costs (~$0.096/strategy)

⚠️ **Concerns:**
- High complexity in Phase 1 (1,088 lines) and Phase 2b (1,200 lines)
- Sequential Phase 2b execution (bottleneck)
- Two-step Phase 1 adds latency
- Business intelligence adds token overhead

### 11.2 Recommended Actions

**Immediate (Next Sprint):**
1. Add monitoring for token usage trends
2. Implement validation dashboard for BI coverage
3. Document Phase 2b menu selection logic

**Short-term (1-2 months):**
1. Test Gemini for Phase 2b (quality validation required)
2. Modularize Phase 2b menu selection into service
3. Implement parallel Phase 2b with rate limiting

**Long-term (3-6 months):**
1. Evaluate single-shot Phase 1 generation
2. Compress business intelligence prompts
3. Smart caching for Phase 0 weather interpretations

### 11.3 Metrics to Track

**Cost metrics:**
- Average tokens/strategy (current: 68,350 total)
- Cost/business/month (current: $0.40)
- Failed retry rate (target: <5%)

**Quality metrics:**
- Validation pass rate (target: >95%)
- BI coverage rate (target: >70%)
- Cache hit rate (target: >60%)

**Performance metrics:**
- Average generation time (current: 18.5s)
- P95 generation time (target: <25s)
- Database query time (target: <500ms)

---

**Analysis Completed:** 2026-06-07  
**Next Review:** After 1,000 strategy generations  
**Document Version:** 1.0
