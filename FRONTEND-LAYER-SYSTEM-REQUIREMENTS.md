# Frontend Requirements for 5-Layer Programme-Aware System

**Date:** May 6, 2026  
**Purpose:** Assess frontend changes needed to display Layers 1-4 with fact-checking capabilities  
**Current State:** Brand Profile page only shows business-level data from `business_brand_profile`  
**Target State:** Display both business-level (Layers 3, 5) and programme-level (Layers 1, 2, 4) data

---

## Current Frontend Implementation

### Data Source
**Table:** `business_brand_profile` (business-level only)  
**Fetched in:** `BrandProfilePageV5.tsx` → `useBrandProfile()` hook

### Displayed Fields
✅ **Still Relevant:**
- `brand_essence` (Layer 3) ✅
- `tone_of_voice` (Layer 5 - future) ✅
- `core_offerings` ✅
- `image_preferences` ✅
- `things_to_avoid` / `never_say` ✅
- `signature_phrases` (Layer 5) ✅
- `tone_model` ✅

⚠️ **Needs Update:**
- `audience_segments` - Shows **old Stage B5 business-level segments** ("Locals", "Tourists")
  - **Problem:** Replaced by Layer 4 programme-specific segments
  - **Action:** Deprecate and replace with Layer 4 programme segments

❌ **Missing:**
- `positioning` (Layer 3) - **NEW** competitive differentiation field
- `values` → `core_values` (Layer 3) - Exists in DB but not displayed
- `what_makes_us_different` - Exists but not prominently shown

🚫 **Not in Frontend Yet:**
- Layer 1: Programme Detection (programmes list, hours, days)
- Layer 2: Commercial Orientation (decision_timing, goal_split per programme)
- Layer 4: Audience Segmentation (2-4 segments per programme with evidence)

---

## New Data Schema

### Business-Level Data (Layers 3 & 5)
**Table:** `business_brand_profile`

**Layer 3 (Identity Profile):**
```typescript
{
  brand_essence: string,           // ✅ Already displayed
  positioning: string,              // ❌ NEW - needs display
  values: string[],                 // ❌ Exists as `core_values` - needs display
  what_makes_us_different: string  // ⚠️ Exists but not prominently shown
}
```

**Layer 5 (Voice - Future):**
```typescript
{
  tone_of_voice: string,            // ✅ Already displayed
  signature_phrases: string[],      // ✅ Already displayed
  never_say: string[],              // ✅ Already displayed
  voice_constraints: string         // ⚠️ Exists but not displayed
}
```

### Programme-Level Data (Layers 1, 2, 4)
**Table:** `business_programme_profiles`  
**Key:** `(business_id, programme_type)`

**Layer 1 (Programme Detection):**
```typescript
{
  programme_type: string,           // "brunch", "lunch", "dinner", etc.
  programme_name: string,           // "Brunch", "Frokost", etc.
  time_windows: string[],           // ["Lør-Søn 09:00-14:00"]
  operating_days: string[],         // ["Lør", "Søn"]
  menu_evidence: string[],          // ["eggs benedict", "avocado toast"]
  confidence: number                // 0-1
}
```

**Layer 2 (Commercial Orientation):**
```typescript
{
  decision_timing: string,          // "spontaneous" | "planned" | "mixed"
  baseline_goal_split: {
    drive_footfall: number,         // % (e.g., 40)
    strengthen_brand: number,       // % (e.g., 40)
    retain_regulars: number         // % (e.g., 20)
  },
  content_type_affinity: {
    product_menu: number,           // 0-1 (e.g., 0.8)
    behind_scenes: number,          // 0-1 (e.g., 0.4)
    atmosphere: number,             // 0-1 (e.g., 0.7)
    community: number,              // 0-1 (e.g., 0.5)
    educational: number             // 0-1 (e.g., 0.2)
  }
}
```

**Layer 4 (Audience Segmentation):**
```typescript
{
  audience_segments: [              // 2-4 segments per programme
    {
      label: string,                // "Weekend-familier"
      timing_windows: string[],     // ["Lør-Søn 10:00-13:00"]
      content_angles: string[],     // ["Børnevenlig menu", "Hyggelige weekender"]
      segment_size: string,         // "primary" | "secondary" | "niche"
      motivation: string,           // "social_gathering" | "convenience" | etc.
      decision_timing: string,      // "spontaneous" | "planned" | "mixed"
      goal_contribution: string,    // "drive_footfall" | "strengthen_brand" | etc.
      evidence: string[]            // ⭐ FACT-CHECKING: ["Menu has børneportioner", ...]
    }
  ],
  segment_confidence: number,       // 0-1
  segment_reasoning: string         // ⭐ FACT-CHECKING: Why these segments
}
```

---

## Proposed Frontend Architecture

### Page Structure

```
Brand Profile Dashboard
├── 📋 Identity Section (Business-Level - Layers 3 & 5)
│   ├── Brand Essence ✅
│   ├── Positioning (NEW) ⭐
│   ├── Core Values (NEW) ⭐
│   ├── What Makes Us Different ⭐
│   ├── Tone of Voice ✅
│   ├── Signature Phrases ✅
│   └── Never Say ✅
│
└── 🎯 Programme Profiles Section (NEW - Layers 1, 2, 4)
    ├── Programme: Brunch
    │   ├── 📅 Operating Schedule (Layer 1)
    │   │   ├── Days: Lør-Søn
    │   │   ├── Hours: 09:00-14:00
    │   │   ├── Menu Evidence: [eggs benedict, børnebrunch, ...]
    │   │   └── Confidence: 0.90
    │   │
    │   ├── 💼 Commercial Strategy (Layer 2)
    │   │   ├── Decision Timing: mixed
    │   │   ├── Goal Split:
    │   │   │   ├── Drive Footfall: 40%
    │   │   │   ├── Strengthen Brand: 40%
    │   │   │   └── Retain Regulars: 20%
    │   │   └── Content Affinity:
    │   │       ├── Product/Menu: 80%
    │   │       ├── Atmosphere: 70%
    │   │       └── Behind Scenes: 40%
    │   │
    │   └── 👥 Audience Segments (Layer 4)
    │       ├── Segment 1: "Weekend-familier" (PRIMARY) ⭐
    │       │   ├── Timing: Lør-Søn 10:00-13:00
    │       │   ├── Motivation: social_gathering
    │       │   ├── Decision: planned
    │       │   ├── Goal: strengthen_brand
    │       │   ├── Content Angles:
    │       │   │   • Børnevenlig menu
    │       │   │   • Hyggelige weekender
    │       │   │   • Plads til barnevogne
    │       │   └── Evidence (FACT-CHECK): ⭐
    │       │       • Menu has børneportioner
    │       │       • Weekend hours 09:00-13:00
    │       │       • Family-safe area
    │       │
    │       ├── Segment 2: "Brunch-entusiaster" (SECONDARY)
    │       │   └── [same structure with evidence]
    │       │
    │       └── Reasoning: "Brunch programme med..." ⭐
    │
    ├── Programme: Lunch
    │   └── [same structure]
    │
    └── Programme: Dinner
        └── [same structure]
```

---

## Implementation Requirements

### 1. New Data Fetching

**Add `useProgrammeProfiles()` hook:**
```typescript
function useProgrammeProfiles(businessId: string | undefined) {
  const [programmes, setProgrammes] = useState<ProgrammeProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) return;

    const fetchProgrammes = async () => {
      const { data, error } = await supabase
        .from('business_programme_profiles')
        .select('*')
        .eq('business_id', businessId)
        .order('programme_type');

      if (!error && data) {
        setProgrammes(data);
      }
      setLoading(false);
    };

    fetchProgrammes();
  }, [businessId]);

  return { programmes, loading };
}
```

**Update `useBrandProfile()` to fetch Layer 3 fields:**
```typescript
const { data, error } = await supabase
  .from('business_brand_profile')
  .select(`
    *,
    positioning,              // Layer 3
    values,                   // Layer 3 (core_values)
    what_makes_us_different   // Layer 3
  `)
  .eq('business_id', businessId)
  .single();
```

### 2. New Components

**`ProgrammeProfilesSection.tsx`** (NEW):
```typescript
interface ProgrammeProfilesSectionProps {
  programmes: ProgrammeProfile[];
}

export function ProgrammeProfilesSection({ programmes }: Props) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Programme Profiles</h2>
      
      {programmes.map(programme => (
        <ProgrammeCard 
          key={programme.programme_type}
          programme={programme}
        />
      ))}
    </div>
  );
}
```

**`ProgrammeCard.tsx`** (NEW):
```typescript
interface ProgrammeCardProps {
  programme: ProgrammeProfile;
}

export function ProgrammeCard({ programme }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded-lg p-6">
      {/* Header with programme name and expand/collapse */}
      <div onClick={() => setExpanded(!expanded)}>
        <h3>{programme.programme_name}</h3>
        <p>{programme.time_windows.join(', ')}</p>
      </div>

      {expanded && (
        <>
          {/* Layer 1: Operating Schedule */}
          <OperatingSchedule programme={programme} />

          {/* Layer 2: Commercial Strategy */}
          <CommercialStrategy 
            decisionTiming={programme.decision_timing}
            goalSplit={programme.baseline_goal_split}
            contentAffinity={programme.content_type_affinity}
          />

          {/* Layer 4: Audience Segments */}
          <AudienceSegments 
            segments={programme.audience_segments}
            reasoning={programme.segment_reasoning}
          />
        </>
      )}
    </div>
  );
}
```

**`AudienceSegmentCard.tsx`** (NEW - Key for Fact-Checking):
```typescript
interface AudienceSegmentCardProps {
  segment: AudienceSegment;
}

export function AudienceSegmentCard({ segment }: Props) {
  const [showEvidence, setShowEvidence] = useState(true); // Default: show evidence

  return (
    <div className="border rounded-lg p-4">
      {/* Segment header */}
      <div className="flex items-center gap-2">
        <h4 className="font-semibold">{segment.label}</h4>
        <span className={`badge ${
          segment.segment_size === 'primary' ? 'bg-blue-500' :
          segment.segment_size === 'secondary' ? 'bg-green-500' :
          'bg-gray-500'
        }`}>
          {segment.segment_size.toUpperCase()}
        </span>
      </div>

      {/* Timing & motivation */}
      <p className="text-sm text-gray-600">
        {segment.timing_windows.join(', ')} · {segment.motivation}
      </p>

      {/* Decision & goal */}
      <p className="text-sm">
        Decision: {segment.decision_timing} | Goal: {segment.goal_contribution}
      </p>

      {/* Content angles */}
      <div className="mt-2">
        <p className="text-xs font-semibold uppercase text-gray-500">Content Angles:</p>
        <ul className="list-disc list-inside">
          {segment.content_angles.map((angle, i) => (
            <li key={i} className="text-sm">{angle}</li>
          ))}
        </ul>
      </div>

      {/* Evidence (FACT-CHECKING) ⭐ */}
      <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded p-3">
        <div 
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setShowEvidence(!showEvidence)}
        >
          <p className="text-xs font-bold uppercase text-yellow-800">
            ⭐ Evidence (Fact-Check)
          </p>
          <span>{showEvidence ? '▼' : '▶'}</span>
        </div>

        {showEvidence && (
          <ul className="mt-2 space-y-1">
            {segment.evidence.map((evidence, i) => (
              <li key={i} className="text-sm text-gray-700">
                • {evidence}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
```

### 3. Update Existing Components

**`BrandProfileDisplay.tsx`** - Add Layer 3 fields:
```typescript
{/* NEW: Layer 3 Identity Section */}
{profile.positioning && (
  <div className="space-y-2">
    <h3 className="text-sm font-semibold uppercase text-gray-500">
      Positioning (Layer 3)
    </h3>
    <p className="text-base">{profile.positioning}</p>
  </div>
)}

{profile.values && profile.values.length > 0 && (
  <div className="space-y-2">
    <h3 className="text-sm font-semibold uppercase text-gray-500">
      Core Values (Layer 3)
    </h3>
    <ul className="space-y-1">
      {profile.values.map((value, i) => (
        <li key={i} className="flex items-start gap-2">
          <span className="text-green-500">•</span>
          <span className="text-sm">{value}</span>
        </li>
      ))}
    </ul>
  </div>
)}

{profile.what_makes_us_different && (
  <div className="space-y-2">
    <h3 className="text-sm font-semibold uppercase text-gray-500">
      What Makes Us Different (Layer 3)
    </h3>
    <p className="text-base">{profile.what_makes_us_different}</p>
  </div>
)}
```

**Deprecate Stage B5 audience_segments:**
```typescript
{/* DEPRECATED: Stage B5 business-level segments */}
{normalisedAudienceSegments && (
  <div className="border-l-4 border-yellow-500 bg-yellow-50 p-4">
    <p className="text-xs font-bold uppercase text-yellow-800 mb-2">
      ⚠️ DEPRECATED: Business-Level Segments (Stage B5)
    </p>
    <p className="text-sm text-gray-600 mb-3">
      These segments are business-level averages. See Programme Profiles below for precise, programme-specific segments (Layer 4).
    </p>
    {/* Existing segment display code */}
  </div>
)}
```

---

## Data to Remove/Deprecate

### Stage B5 Audience Segments (business_brand_profile.audience_segments)

**Current State:**
- Business-level segments: 3-6 generic segments like "Locals", "Tourists", "Weekend-familier"
- Stored in: `business_brand_profile.audience_segments` (JSONB)
- Generated by: Stage B5 in brand-profile-generator

**Problem:**
- Not programme-specific (averages across all programmes)
- Less precise than Layer 4 programme segments
- Confusing dual representation with Layer 4

**Action:**
1. **Short-term:** Mark as deprecated in UI with warning banner
2. **Medium-term:** Hide by default, show only if Layer 4 data missing (fallback)
3. **Long-term:** Remove Stage B5 generation entirely when Layer 4 integrated into Weekly Plan

**Migration:**
```typescript
// Show Layer 4 programme segments if available, otherwise fallback to Stage B5
const hasLayer4Segments = programmes.some(p => p.audience_segments?.length > 0);

{hasLayer4Segments ? (
  <ProgrammeProfilesSection programmes={programmes} />
) : (
  <DeprecatedStageB5Segments segments={profile.audience_segments} />
)}
```

---

## Fact-Checking Features

### Evidence Highlighting

**Purpose:** Allow owner to verify AI didn't hallucinate

**Implementation:**
1. **Audience Segments (Layer 4):**
   - Show `evidence[]` array prominently
   - Color-code evidence items with yellow background
   - Add "Fact-Check" label
   - Default: expanded (always visible)

2. **Segment Reasoning:**
   - Show `segment_reasoning` explaining why AI chose these segments
   - Allows owner to verify logic

3. **Commercial Strategy (Layer 2):**
   - Show reasoning for decision_timing choice
   - Show reasoning for goal_split percentages

4. **Identity Profile (Layer 3):**
   - Show which core_values have evidence
   - Link to menu items/operations data

### Verification Workflow

**Owner review checklist:**
- [ ] Layer 1: Time windows match actual operating hours
- [ ] Layer 1: Menu evidence items exist in menu
- [ ] Layer 2: Decision timing makes sense (spontaneous vs planned)
- [ ] Layer 2: Goal split aligns with business strategy
- [ ] Layer 4: Segment labels are specific (not generic "Locals")
- [ ] Layer 4: Evidence items are verifiable
- [ ] Layer 4: Timing windows within programme hours
- [ ] Layer 4: Content angles make sense

---

## UI/UX Considerations

### Collapsible Sections
- Programmes can be collapsed by default (many programmes = long page)
- Evidence sections can be expanded/collapsed
- Default: Show all evidence (fact-checking priority)

### Color Coding
- **Primary segment:** Blue badge
- **Secondary segment:** Green badge
- **Niche segment:** Gray badge
- **Evidence section:** Yellow background (highlight for review)
- **Deprecated Stage B5:** Yellow warning banner

### Confidence Scores
- Show Layer 1 confidence (programme detection)
- Show Layer 4 segment_confidence
- Visual indicator: Green (>0.85), Yellow (0.70-0.85), Red (<0.70)

### Mobile Responsiveness
- Collapsible cards essential for mobile
- Evidence lists should stack vertically
- Goal split percentages: horizontal bars on desktop, vertical on mobile

---

## Implementation Priority

### Phase 1 (High Priority - Fact-Checking):
1. ✅ Create `useProgrammeProfiles()` hook
2. ✅ Create `ProgrammeCard.tsx` component
3. ✅ Create `AudienceSegmentCard.tsx` with evidence display
4. ✅ Add Layer 3 fields to `BrandProfileDisplay.tsx`
5. ✅ Add deprecation warning to Stage B5 segments

### Phase 2 (Medium Priority - Polish):
1. Add Commercial Strategy visualization (goal split charts)
2. Add Content Affinity visualization (radar chart or bars)
3. Add confidence score indicators
4. Add export/print functionality for owner review

### Phase 3 (Low Priority - Future):
1. Add inline editing for manual corrections
2. Add segment approval workflow
3. Add comparison view (before/after regeneration)
4. Add analytics on which segments drive most engagement

---

## Testing Checklist

### Data Fetching
- [ ] `business_programme_profiles` fetches all programmes
- [ ] Handles missing programmes gracefully
- [ ] Handles missing Layer 4 audience_segments (fallback to empty)
- [ ] Layer 3 fields (positioning, values) display correctly

### Evidence Display
- [ ] Evidence arrays render for all segments
- [ ] Empty evidence shows placeholder/warning
- [ ] Evidence section is collapsible
- [ ] Default state: expanded (visible)

### Programme Display
- [ ] All programmes render correctly
- [ ] Time windows format properly
- [ ] Goal split percentages sum to 100%
- [ ] Segment badges show correct colors

### Deprecation Handling
- [ ] Stage B5 segments show deprecation warning
- [ ] If Layer 4 exists, Stage B5 hidden or minimized
- [ ] If Layer 4 missing, Stage B5 shows as fallback

### Responsive Design
- [ ] Mobile: Cards stack vertically
- [ ] Mobile: Evidence readable
- [ ] Desktop: Side-by-side segments if space allows

---

## Database Migration Notes

**No new migrations needed** - All tables already exist:
- ✅ `business_programme_profiles` created in Layer 2 migration
- ✅ `audience_segments` JSONB column exists
- ✅ `business_brand_profile.positioning` column created in Layer 3 migration
- ✅ `business_brand_profile.values` column already exists (reused as core_values)

---

## Files to Create/Modify

### New Files:
1. `src/hooks/useProgrammeProfiles.ts` - Hook to fetch programme data
2. `src/components/brandProfile/ProgrammeProfilesSection.tsx` - Main section
3. `src/components/brandProfile/ProgrammeCard.tsx` - Individual programme card
4. `src/components/brandProfile/OperatingSchedule.tsx` - Layer 1 display
5. `src/components/brandProfile/CommercialStrategy.tsx` - Layer 2 display
6. `src/components/brandProfile/AudienceSegments.tsx` - Layer 4 container
7. `src/components/brandProfile/AudienceSegmentCard.tsx` - Individual segment with evidence

### Modified Files:
1. `src/pages/dashboard/BrandProfilePageV5.tsx` - Add programme profiles section
2. `src/components/brandProfile/BrandProfileDisplay.tsx` - Add Layer 3 fields, deprecate Stage B5

---

## Next Steps

1. **Implement Phase 1** (fact-checking priority):
   - Create new components for programme profiles
   - Add evidence display with highlighting
   - Update brand profile page to fetch and display Layer 1-4 data

2. **Test with real data**:
   - Run Layers 1-4 generation for test businesses
   - Verify evidence is factual and verifiable
   - Check all segments have proper evidence

3. **Owner feedback**:
   - Get feedback on evidence clarity
   - Verify fact-checking workflow is intuitive
   - Adjust UI based on usability testing

4. **Deploy**:
   - Deploy frontend changes
   - Monitor for errors
   - Iterate based on usage

---

**Status:** Ready for implementation  
**Blocker:** None - all backend data (Layers 1-4) already functional  
**Priority:** High - fact-checking is critical for owner trust
