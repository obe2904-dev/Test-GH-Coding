# Behavioral Drivers Layer - Implementation Complete

**Date**: 6 January 2026  
**Location**: `/src/features/aiPromptBuilder.ts`

---

## 🎯 Architectural Insight

**Problem**: Target Audience alone isn't enough for strategic AI content.

**Solution**: Add missing **Behavioral Drivers** layer between usage occasions and AI content generation.

---

## 📐 New Architecture

### Before (incomplete):
```
Brand Profile
 └─ Target Audience (usage occasions)
     └─ AI Ideas
```

### After (complete):
```
Brand Profile
 ├─ Target Audience (usage occasions - WHEN/HOW)
 └─ Behavioral Drivers (WHY people choose this place)
     └─ AI Content Strategy
         └─ AI Ideas (with behavioral hooks)
```

---

## 🔧 Implementation

### 1. New Types (Internal, Non-UI)

```typescript
export interface BehavioralDriver {
  id: string
  behavior: string           // What they do (e.g., "Kommer til brunch, bliver siddende i timer")
  tension: string            // Problem/need (e.g., "Behov for sted hvor langsomt tempo er OK")
  desiredOutcome: string     // What they want (e.g., "Slappe af uden at føle sig presset")
  confidence: number         // 0-1 (evidence strength)
  proof: string[]            // 1-3 evidence lines
}

export interface ContentTrigger {
  trigger: string            // Behavioral hook (e.g., "dag→aften flow")
  instruction: string        // AI guidance (e.g., "Frame as 'start med mad, bliv til drinks'")
  proof: string[]            // Supporting evidence
  confidence: number         // 0-1
}
```

---

### 2. Derivation Function (Evidence-Anchored, No Hallucination)

**Location**: `deriveBehavioralDrivers()` in `aiPromptBuilder.ts`

**Input Sources** (existing data only):
- `services` (Brunch, Cocktails, Børnemenu)
- `detectedMenuUrls` (brunch/aften/cocktails pages)
- `menu_highlights`
- `opening_hours` (late hours detection)
- `booking_url` (reservation behavior)
- `location` (city center, by river context)

**Derived Drivers** (6 patterns):

#### Driver 1: Extended Stay (Brunch)
```typescript
{
  id: 'stay-for-hours',
  behavior: 'Kommer til brunch, bliver siddende i flere timer',
  tension: 'Behov for et sted hvor langsomt tempo er OK',
  desiredOutcome: 'Slappe af uden at føle sig presset til at gå',
  confidence: 0.7,
  proof: ['Service listed: Brunch', 'Dedicated brunch menu page exists']
}
```

#### Driver 2: Day→Evening Flow
```typescript
{
  id: 'day-to-evening',
  behavior: 'Starter med mad, ender med drinks',
  tension: 'Vil ikke skulle skifte location for at fortsætte aftenen',
  desiredOutcome: 'Samme sted kan dække hele aftenen (mad → drinks)',
  confidence: 0.8,
  proof: ['Service: Cocktails available', 'Opening hours: Late evening service (22:00+)']
}
```

#### Driver 3: Easy Family Meals
```typescript
{
  id: 'easy-with-kids',
  behavior: 'Måltider hvor børn kan spise med uden stress',
  tension: 'Usikkerhed om stedet passer til børn',
  desiredOutcome: 'Nemt at vælge, børnene er tilfredse',
  confidence: 0.9,
  proof: ['Kids menu detected in services or menu URLs']
}
```

#### Driver 4: Secure Your Spot
```typescript
{
  id: 'secure-spot',
  behavior: 'Booker bord for at være sikker på plads',
  tension: 'Bekymring for at møde op og ikke få plads',
  desiredOutcome: 'Sikkerhed for at aftenen går som planlagt',
  confidence: 0.7,
  proof: ['Booking URL present', 'Evening hours suggest higher demand']
}
```

#### Driver 5: Quick City Pause
```typescript
{
  id: 'quick-pause',
  behavior: 'Hurtig pause midt i byen (frokost/kaffe)',
  tension: 'Begrænset tid, men vil have kvalitet',
  desiredOutcome: 'God pause uden at bruge for lang tid',
  confidence: 0.6,
  proof: ['Location: Aarhus centrum (city center context)']
}
```

#### Driver 6: Nature Escape
```typescript
{
  id: 'nature-escape',
  behavior: 'Spiser/drikker med udsigt til vand/natur',
  tension: 'Vil væk fra byens stress',
  desiredOutcome: 'Ro og natur som en del af oplevelsen',
  confidence: 0.7,
  proof: ['Location or context mentions river/water/nature']
}
```

---

### 3. Content Triggers (Behavior → AI Instructions)

**Location**: `deriveContentTriggers()` in `aiPromptBuilder.ts`

**Example Mappings**:

| Driver | Content Trigger Instruction |
|--------|----------------------------|
| stay-for-hours | Frame brunch as "tag hele morgenen", "bliv siddende", "nyd langsomt tempo". Suggest multi-course or extended stays. |
| day-to-evening | Show flow: "Start med [meal], bliv til [drinks]". Highlight same-location convenience for full evening. |
| easy-with-kids | Mention kids menu casually ("der er børnemenu, så alle er med"). Focus on ease, not family-centric language. |
| secure-spot | Encourage booking for popular times (weekends, evenings). Use "book bord" CTA naturally. |
| quick-pause | Frame lunch/coffee as "hurtig pause", "midt i byen". Emphasize quality despite quick visit. |
| nature-escape | Mention view/location ("ved åen", "udsigt") as part of experience. Suggest outdoor seating when relevant. |

---

### 4. Prompt Integration

**New Sections Added** (between Business Context and Operational Rules):

#### Section 1: Behavioral Drivers
```
=== BEHAVIORAL DRIVERS (INTERNAL, EVIDENCE-ANCHORED) ===

REGLER: Dette er adfærdslogik (ikke fakta-claims). Brug det til vinkel og hook. Opfind ikke konkrete features.

- Kommer til brunch, bliver siddende i flere timer
  Tension: Behov for et sted hvor langsomt tempo er OK
  Desired Outcome: Slappe af uden at føle sig presset til at gå
  Proof: Service listed: Brunch | Dedicated brunch menu page exists

- Starter med mad, ender med drinks
  Tension: Vil ikke skulle skifte location for at fortsætte aftenen
  Desired Outcome: Samme sted kan dække hele aftenen (mad → drinks)
  Proof: Service: Cocktails available | Opening hours: Late evening service
```

#### Section 2: Content Triggers
```
=== AI CONTENT TRIGGERS (HOW TO USE BEHAVIORAL DRIVERS) ===

REGLER: Brug mindst 1 trigger i hver idé. Triggers er creative guidance, ikke facts.

- Trigger: Kommer til brunch, bliver siddende i flere timer
  Instruction: Frame brunch as "tag hele morgenen", "bliv siddende", "nyd langsomt tempo". Suggest multi-course or extended stays.

- Trigger: Starter med mad, ender med drinks
  Instruction: Show flow: "Start med [meal], bliv til [drinks]". Highlight same-location convenience for full evening.
```

---

## 🔒 Safety Guardrails

### 1. Evidence-Only Derivation
- Uses **only existing signals** (no hallucination)
- Requires **proof** for each driver
- Minimum **confidence threshold** (0.6)

### 2. Internal Use Only
- **NOT shown in UI**
- Used for AI content strategy only
- No user-facing claims

### 3. Behavioral Language (Not Factual Claims)
- Prompt explicitly states: "Dette er adfærdslogik (ikke fakta-claims)"
- AI instructed to use as **angles/hooks**, not facts
- Prevents inventing concrete features

---

## 📊 Café Faust Example

### Derived Drivers:
1. ✅ **stay-for-hours** (Brunch service detected)
2. ✅ **day-to-evening** (Cocktails + evening hours)
3. ✅ **easy-with-kids** (Kids menu present)
4. ✅ **secure-spot** (Booking URL exists)
5. ✅ **nature-escape** ("ved åen" in location context)

### Content Triggers Generated:
- Frame brunch as extended stay experience
- Highlight dinner→drinks flow
- Mention kids menu casually
- Encourage booking for evenings
- Emphasize riverside location

### Impact on AI Ideas:
**Before** (generic):
> "Vi har brunch i weekenden. Kom og smag vores lækre retter."

**After** (strategic, behavior-driven):
> "Tag hele morgenen til brunch ved åen. Start med bagværk, bliv til frokost – der er ingen stress her. Børnemenu gør det nemt for hele bordet. 🥐"

---

## ✅ Status

- **Types defined**: ✅ BehavioralDriver, ContentTrigger
- **Derivation logic**: ✅ 6 evidence-based patterns
- **Content triggers**: ✅ Behavior → AI instructions
- **Prompt integration**: ✅ Two new sections added
- **Safety guardrails**: ✅ Evidence-only, internal use, behavioral framing
- **TypeScript validation**: ✅ No errors

**Ready to use!** The AI now has strategic behavioral context to generate more targeted, Gemini-like content ideas.

---

## 🎓 Key Principles

1. **Separation of Concerns**:
   - Target Audience = WHEN/HOW (usage occasions)
   - Behavioral Drivers = WHY (motivations/tensions)
   - Content Triggers = HOW TO WRITE (creative guidance)

2. **Evidence-First**:
   - Every driver requires proof
   - Only existing signals used
   - Confidence scoring applied

3. **Internal Architecture**:
   - Not shown in UI
   - Used for AI strategy only
   - No hallucinated features

4. **Actionable Guidance**:
   - Converts WHY into HOW
   - Provides specific content hooks
   - Maintains brand safety

This fills the missing layer Gemini implicitly uses! 🚀
