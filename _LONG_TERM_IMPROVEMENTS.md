# Long-Term Location Vocabulary Improvements

**Date**: 2026-06-22  
**Status**: Recommendations for Future Enhancement  
**Priority**: MEDIUM (Immediate fix already implemented)

---

## Vision: Culturally Intelligent Location Vocabulary

The goal is to move beyond blacklisting generic terms toward a system that understands:
- Water body hierarchy (åen > vandet, Nyhavn > havnen)
- Cultural locality (Danish, Norwegian, Swedish conventions)
- Operator intent (what they say on their website is gospel)

---

## Improvement 1: Semantic Water Body Taxonomy

### Problem
Current system treats all water references equally. Doesn't understand:
- "Ved åen" (specific) is better than "ved vandet" (generic)
- "I Nyhavn" (proper noun) is better than "i havnen" (common noun)
- "Ved Søerne" (Copenhagen landmark) ≠ "ved søen" (any lake)

### Solution
Build a semantic hierarchy:

```typescript
// Water body specificity levels
const WATER_BODY_SPECIFICITY = {
  // Level 5: Proper nouns (highest specificity)
  proper_nouns: ['Nyhavn', 'Søerne', 'Aarhus Å', 'Isefjorden'],
  
  // Level 4: Specific water bodies with article
  specific_with_article: ['åen', 'kanalen', 'bugten', 'fjorden', 'havnen'],
  
  // Level 3: Generic with context
  generic_with_context: ['ved åen', 'langs kanalen', 'i havnen'],
  
  // Level 2: Generic water references
  generic: ['vandet', 'havet', 'søen'],
  
  // Level 1: Ultra-generic (forbidden)
  ultra_generic: ['ved vandet', 'vandkanten', 'havnefronten']
};

function getWaterBodySpecificity(term: string): number {
  for (const [level, terms] of Object.entries(WATER_BODY_SPECIFICITY)) {
    if (terms.some(t => term.toLowerCase().includes(t))) {
      return parseInt(level.match(/\d/)?.[0] || '0');
    }
  }
  return 0;
}

// Rule: If local_location_reference has specificity >= 4, 
// remove all vocabulary with specificity < 3
function filterBySpecificity(vocab: string[], llr: string) {
  const llrLevel = getWaterBodySpecificity(llr);
  
  if (llrLevel >= 4) {
    return vocab.filter(term => {
      const termLevel = getWaterBodySpecificity(term);
      // Keep if not water-related OR has high specificity
      return termLevel === 0 || termLevel >= 3;
    });
  }
  
  return vocab;
}
```

### Example
```typescript
Input:
  local_location_reference: "ved åen i Aarhus" (specificity: 5)
  vocabulary: ["ved åen", "på Åboulevarden", "ved vandet", "udsigt"]

After filtering:
  vocabulary: ["ved åen", "på Åboulevarden"]
  removed: ["ved vandet" (specificity: 1), "udsigt" (not water-related but too grand)]
```

---

## Improvement 2: Proper Noun Detection

### Problem
System doesn't recognize proper nouns vs common nouns:
- "Nyhavn" (proper) should ALWAYS be preserved
- "i havnen" (common) can be removed if too generic

### Solution
```typescript
const DANISH_LOCATION_PROPER_NOUNS = [
  // Copenhagen
  'Nyhavn', 'Søerne', 'Vesterbro', 'Nørrebro', 'Østerbro',
  
  // Aarhus
  'Åboulevarden', 'Aarhus Å', 'Aarhus Ø', 'Latinerkvarteret',
  
  // Natural features
  'Øresund', 'Isefjorden', 'Roskilde Fjord'
];

function isProperNoun(term: string): boolean {
  return DANISH_LOCATION_PROPER_NOUNS.some(pn => 
    term.includes(pn)
  ) || /^[A-ZÆØÅ]/.test(term); // Starts with capital
}

// Rule: NEVER remove proper nouns
function filterGenericTerms(vocab: string[]) {
  return vocab.filter(term => {
    if (isProperNoun(term)) return true; // Always keep proper nouns
    if (FORBIDDEN_GENERIC_TERMS.includes(term.toLowerCase())) return false;
    return true;
  });
}
```

---

## Improvement 3: Context-Aware Water Vocabulary

### Problem
"Ved vandet" is only bad if you have something more specific. If business is truly generic waterfront, it might be acceptable.

### Solution
Contextual blacklist based on available specificity:

```typescript
function shouldBlockTerm(term: string, context: {
  hasLocalLocationReference: boolean;
  llrMentionsWater: boolean;
  llrSpecificity: number;
}) {
  const termLower = term.toLowerCase();
  
  // Always block ultra-generic
  if (['waterfront', 'havnefronten'].includes(termLower)) {
    return true;
  }
  
  // Block "ved vandet" only if we have something better
  if (termLower === 'ved vandet') {
    return context.hasLocalLocationReference && context.llrMentionsWater;
  }
  
  // Block "udsigt" if positioning is casual (not fine dining)
  if (['udsigt', 'udsigten'].includes(termLower)) {
    return context.positioningLevel !== 'premium';
  }
  
  return false;
}
```

---

## Improvement 4: Operator Override System

### Problem
Sometimes operators WANT terms we think are generic. Need manual override capability.

### Solution
Add `business_vocabulary_overrides` table:

```sql
CREATE TABLE business_vocabulary_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  override_type TEXT NOT NULL CHECK (override_type IN ('force_include', 'force_exclude', 'review')),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(business_id, term)
);
```

**Usage**:
```typescript
// Check overrides before filtering
const { data: overrides } = await supabase
  .from('business_vocabulary_overrides')
  .select('term, override_type')
  .eq('business_id', businessId);

const forceInclude = overrides
  .filter(o => o.override_type === 'force_include')
  .map(o => o.term);

const forceExclude = overrides
  .filter(o => o.override_type === 'force_exclude')
  .map(o => o.term);

// Apply overrides
vocab = vocab.filter(term => {
  if (forceExclude.includes(term)) return false;
  if (FORBIDDEN_GENERIC_TERMS.includes(term) && !forceInclude.includes(term)) return false;
  return true;
});

// Add forced terms if missing
forceInclude.forEach(term => {
  if (!vocab.includes(term)) vocab.push(term);
});
```

---

## Improvement 5: Multi-Language Water Body Taxonomy

### Problem
Current solution is Danish-only. Need support for Norwegian, Swedish, German.

### Solution
Language-specific taxonomies:

```typescript
const WATER_VOCABULARIES = {
  da: {
    ultra_generic: ['ved vandet', 'havnefronten', 'vandkanten'],
    generic: ['vandet', 'havet', 'søen'],
    specific: ['åen', 'kanalen', 'havnen', 'bugten', 'fjorden'],
    proper: ['Nyhavn', 'Søerne', 'Aarhus Å']
  },
  
  no: {
    ultra_generic: ['ved vannet', 'havnefronten', 'vannkanten'],
    generic: ['vannet', 'havet', 'sjøen'],
    specific: ['elva', 'kanalen', 'havna', 'bukta', 'fjorden'],
    proper: ['Aker Brygge', 'Tjuvholmen', 'Oslo Fjord']
  },
  
  sv: {
    ultra_generic: ['vid vattnet', 'hamnfronten', 'vattenkanten'],
    generic: ['vattnet', 'havet', 'sjön'],
    specific: ['ån', 'kanalen', 'hamnen', 'viken', 'fjorden'],
    proper: ['Nyhamnnen', 'Djurgården', 'Mälaren']
  },
  
  de: {
    ultra_generic: ['am Wasser', 'an der Uferpromenade'],
    generic: ['Wasser', 'Meer', 'See'],
    specific: ['Fluss', 'Kanal', 'Hafen', 'Bucht'],
    proper: ['Alster', 'Elbe', 'Spree']
  }
};

function getForbiddenTerms(language: string): string[] {
  const vocab = WATER_VOCABULARIES[language] || WATER_VOCABULARIES.da;
  return [...vocab.ultra_generic, ...vocab.generic];
}
```

---

## Improvement 6: Subpage Analysis Strengthening

### Problem
User pointed out: "Havnær.dk has location info on /naer.htm subpage, not homepage"

### Current State
`analyze-website` analyzes:
- Homepage ✅
- Up to 20 additional pages ✅

### Enhancement
Prioritize location-relevant pages:

```typescript
const LOCATION_INDICATOR_PATHS = [
  '/om', '/about', '/om-os', '/kontakt', '/contact',
  '/location', '/find-us', '/finde-os', '/lokation',
  '/naer', '/hvor', '/where'
];

// Score pages by likelihood of containing location info
function scorePageForLocationInfo(url: string, linkText: string): number {
  let score = 0;
  
  const urlLower = url.toLowerCase();
  const textLower = linkText.toLowerCase();
  
  // High priority paths
  if (LOCATION_INDICATOR_PATHS.some(path => urlLower.includes(path))) {
    score += 10;
  }
  
  // Link text indicators
  if (['om os', 'about', 'contact', 'find us', 'lokation'].some(kw => textLower.includes(kw))) {
    score += 5;
  }
  
  return score;
}

// Analyze high-scoring pages first
pages.sort((a, b) => 
  scorePageForLocationInfo(b.url, b.text) - scorePageForLocationInfo(a.url, a.text)
);
```

---

## Improvement 7: AI Explanation Tracking

### Problem
Hard to debug why AI chose certain terms without its reasoning.

### Solution
Ask AI to explain each vocabulary choice:

```typescript
// In tone DNA schema
interface V5ToneDNALocationDriver {
  natural_vocabulary: Array<{
    term: string;
    reasoning: string;  // NEW: Why this term?
    source: 'operator_website' | 'location_intelligence' | 'ai_enhancement';
  }>;
}

// Example output
{
  "natural_vocabulary": [
    {
      "term": "ved åen",
      "reasoning": "Direkte fra virksomhedens hjemmeside: 'ved åen i Aarhus'",
      "source": "operator_website"
    },
    {
      "term": "på Åboulevarden",
      "reasoning": "Gadenavnet fra Google Maps placering",
      "source": "location_intelligence"
    },
    {
      "term": "udeservering",
      "reasoning": "Nævnt på hjemmeside som central feature",
      "source": "operator_website"
    }
  ]
}
```

**Benefits**:
- Transparency for debugging
- Can filter by source ("only keep operator_website terms")
- Quality metrics ("how many AI-only terms?")

---

## Improvement 8: Quality Metrics Dashboard

### Problem
Can't measure success without metrics.

### Solution
Track vocabulary quality over time:

```sql
CREATE TABLE brand_profile_vocabulary_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID REFERENCES businesses(id),
  profile_generated_at TIMESTAMPTZ,
  
  -- Source tracking
  terms_from_operator INT DEFAULT 0,
  terms_from_location_intel INT DEFAULT 0,
  terms_ai_generated INT DEFAULT 0,
  
  -- Quality metrics
  forbidden_terms_removed INT DEFAULT 0,
  specificity_score FLOAT,  -- 0-100
  proper_nouns_count INT DEFAULT 0,
  
  -- Language compliance
  language TEXT,
  language_consistency_score FLOAT,  -- 0-100
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Dashboard queries**:
```sql
-- Businesses with problematic vocabulary
SELECT b.name, COUNT(*) as forbidden_count
FROM business_brand_profile bbp
JOIN businesses b ON b.id = bbp.business_id
CROSS JOIN LATERAL jsonb_array_elements_text(
  bbp.brand_profile_v5->'voice'->'tone_dna'->'location_driver'->'natural_vocabulary'
) AS vocab(term)
WHERE LOWER(vocab.term) IN ('ved vandet', 'havnefronten', 'udsigt')
GROUP BY b.name
ORDER BY forbidden_count DESC;

-- Quality distribution
SELECT 
  CASE 
    WHEN specificity_score >= 80 THEN 'Excellent'
    WHEN specificity_score >= 60 THEN 'Good'
    WHEN specificity_score >= 40 THEN 'Fair'
    ELSE 'Needs Improvement'
  END as quality,
  COUNT(*) as businesses
FROM brand_profile_vocabulary_metrics
WHERE profile_generated_at > NOW() - INTERVAL '30 days'
GROUP BY quality;
```

---

## Implementation Roadmap

### Phase 1: Immediate (DONE)
- ✅ Blacklist post-processing
- ✅ Root cause documentation
- ✅ Café Faust database investigation

### Phase 2: Short-term (1-2 weeks)
- [ ] Water body specificity taxonomy
- [ ] Proper noun detection
- [ ] Enhanced subpage analysis
- [ ] Multi-language blacklists (NO, SV, DE)

### Phase 3: Medium-term (1-2 months)
- [ ] Operator override system
- [ ] AI explanation tracking
- [ ] Context-aware filtering
- [ ] Quality metrics dashboard

### Phase 4: Long-term (3-6 months)
- [ ] Machine learning for cultural appropriateness
- [ ] A/B testing vocabulary variations
- [ ] Operator feedback loop
- [ ] Automated vocabulary suggestions

---

## Success Criteria

### Immediate (Current Fix)
- ✅ No "ved vandet" in new brand profiles
- ✅ No "udsigt" for casual businesses
- ✅ `local_location_reference` always first

### Short-term
- 95%+ of businesses have operator website terms as first vocabulary
- <5% manual corrections needed
- Zero translation contamination incidents

### Medium-term
- Specificity score average >75
- <1% forbidden terms slip through
- Multi-language support for NO, SV, DE

### Long-term
- Operator satisfaction >90%
- Cultural appropriateness score >95%
- Zero manual overrides needed for 80% of businesses

---

## Maintenance

### Monthly Review
- [ ] Check forbidden terms blacklist (add new patterns)
- [ ] Review operator override requests
- [ ] Update proper noun database with new landmarks
- [ ] Analyze quality metrics trends

### Quarterly Enhancement
- [ ] Add new languages
- [ ] Refine specificity algorithm
- [ ] Update cultural taxonomy
- [ ] Performance optimization

---

## Conclusion

The immediate fix (blacklist) solves the urgent problem. Long-term improvements build toward a system that:
1. Understands cultural nuance
2. Respects operator intent  
3. Scales across languages
4. Self-improves through metrics

**Priority**: Focus on Phase 2 (specificity taxonomy + multi-language) as next step.
