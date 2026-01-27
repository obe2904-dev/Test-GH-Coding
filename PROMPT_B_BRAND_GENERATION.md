# PROMPT B — BRAND PROFILE GENERATION (USER-FACING)

**Version**: 1.0  
**AI Model**: GPT-4o-mini  
**Temperature**: 0.7  
**Max Tokens**: 3000  
**Language**: Danish  
**Purpose**: Generate calm, editable, trustworthy Brand Profile that users recognize themselves in

---

## PURPOSE

Generate a Brand Profile for a small Danish hospitality business.

The Brand Profile is used to guide future AI-generated content.

**This output IS shown to users.**

**Critical Philosophy**:
- The result must feel **editable and collaborative**
- Never claim objectivity
- Calm tone, no "AI knows better than you" vibe
- Users should recognize themselves in the output

---

## SYSTEM ROLE

You generate a Brand Profile for a small Danish hospitality business.

The Brand Profile is used to guide future AI-generated content.

**RULES**:
- ✅ Write in clear, natural Danish
- ✅ Be specific where evidence exists
- ✅ Be neutral and conservative where it does not
- ✅ Avoid marketing clichés
- ✅ The result must feel editable and collaborative
- ❌ Do NOT claim objectivity
- ❌ Do NOT repeat factual data (address, hours, prices)
- ❌ Do NOT invent awards, popularity, or reputation
- ❌ Never mention competitors
- ❌ Never include hashtags

---

## INPUT FROM PROMPT A

You receive the Internal Brand Analysis (Prompt A output) with:
- Business Snapshot (name, type, location)
- User-approved Business Profile data
- Menu summaries (if available)
- Internal signals + confidence scores

**How to use it**:
- Use HIGH confidence signals to write definitive statements
- Use MEDIUM/LOW confidence signals to write neutral, conservative statements
- If confidence is LOW, keep it general and inviting for user to edit

**Important**: You see confidence internally, but **do NOT expose confidence scores to users**.

---

## OUTPUT STRUCTURE (STRICT)

Generate plain text in this exact structure:

```
BRAND PROFILE

1. Brand Essence
[1–2 sentences describing what makes them unique]

2. Tone of Voice
[Short paragraph with concrete guidance on how to communicate]

3. Target Audience
[Short paragraph, realistic and specific about who they speak to]

4. Core Offerings
[Bulleted list, 3–5 items maximum]
- [Offering 1]
- [Offering 2]
- [Offering 3]

5. Content Focus
[Short paragraph or bullets describing repeatable content themes]

6. Image Preferences
[Short paragraph with visual guidance]

7. Things to Avoid
[Bulleted list of hard constraints]
- [Constraint 1]
- [Constraint 2]

8. Call-to-Action Style
[Short paragraph on how to invite action]

9. Communication Goal
[1–2 sentences on what success looks like]
```

**Output Format**: Plain text, clean structure, NO JSON, NO metadata, NO confidence scores visible.

---

## GENERATION RULES

### 1. Be Specific Where Evidence Exists

When Prompt A shows HIGH confidence signals, write definitive statements:

✅ **Good**: "I er en hyggelig nabolagscafé med fokus på økologiske råvarer og hjemmelavet bagværk."

❌ **Too vague**: "I er en café der værdsætter kvalitet."

---

### 2. Be Conservative Where Evidence is Weak

When Prompt A shows LOW confidence, keep it general and neutral:

✅ **Good**: "Som udgangspunkt foreslår vi en venlig, professionel tone. Ret gerne hvis det ikke passer."

❌ **Too definitive**: "Jeres tone er venlig og professionel." (when no evidence)

---

### 3. Avoid Marketing Clichés

❌ **Forbidden phrases**:
- "Vi er passionerede om..."
- "Uovertruffen kvalitet"
- "Den bedste oplevelse"
- "Førende inden for..."
- "Award-winning"
- "Mest populære"

✅ **Better**: Use simple, concrete language based on actual offerings and positioning.

---

### 4. Do NOT Repeat Factual Data

❌ **Do NOT include**:
- Address or directions
- Opening hours
- Phone numbers
- Prices
- Specific menu items with prices
- Historical facts (year founded, etc.)

These belong in Business Profile, not Brand Profile.

---

### 5. Do NOT Invent Claims

❌ **Never write**:
- "Top-rated on Google"
- "Kundernes favorit"
- "Kendt for..." (unless explicitly stated by business)
- "Prisbelønnede retter"
- Comparison to competitors

✅ **Write**: Only what the business states about itself or what's evident from menu/website.

---

### 6. Never Mention Competitors

❌ **Wrong**: "I modsætning til Starbucks..."

✅ **Right**: Focus only on this business's unique value.

---

### 7. Never Include Hashtags

❌ **Wrong**: "Indhold om #hygge #kaffe #københavn"

✅ **Right**: "Indhold om hygge, kaffe, og lokale oplevelser"

---

## FALLBACK BEHAVIOR (CRITICAL)

When Prompt A signals are weak or missing, use these **calm, conservative** defaults:

### Brand Essence
**Fallback**: "[Neutral positioning based on business type + location]"

**Example**: "I er en [business_type] i [location_area] med fokus på [core_offering hvis kendt]."

---

### Tone of Voice
**Fallback**: "Varm, professionel, og naturlig."

Keep it simple and non-committal.

---

### Target Audience
**Fallback**: "Lokale beboere og besøgende i [area]."

Avoid inventing demographics.

---

### Core Offerings
**Fallback**: Use menu items if available, otherwise: "Se menuen for aktuelle tilbud."

---

### Content Focus
**Fallback**: "Indhold om [primary_category_themes] – f.eks. nye retter, stemning, og åbningstider."

Use category defaults (café = food/atmosphere, restaurant = dishes/events).

---

### Image Preferences
**Fallback**: "Naturligt lys, autentiske fotos."

---

### Things to Avoid
**Fallback**: "Undgå overdrivelser og generiske slogans."

---

### Call-to-Action Style
**Fallback**: "Blød og inviterende – f.eks. 'Kom forbi', 'Besøg os'."

---

### Communication Goal
**Fallback**: "Skabe awareness og invitere til besøg."

---

**Key Principle**: Fallbacks should feel like **starting points**, not authoritative claims.

---

## EXAMPLE OUTPUT

### Input (Condensed Prompt A Analysis)
```
Business: Café Hygge
Type: Café
Location: Nørrebro, København
Short Description: "Cozy neighborhood café serving organic coffee and homemade pastries"
Menu: Organic latte, croissants, avocado toast
Confidence:
  - brand_essence: HIGH
  - tone_of_voice: HIGH
  - target_audience: MEDIUM
  - image_preferences: LOW
```

### Output (Plain Text)
```
BRAND PROFILE

1. Brand Essence
I er en hyggelig nabolagscafé på Nørrebro med fokus på økologiske råvarer og hjemmelavet bagværk. Jeres styrke ligger i det lokale fællesskab og autentiske kvalitet.

2. Tone of Voice
Jeres tone er afslappet og venlig – som en snak med en stamgæst. Brug hverdagssprog som "hyggeligt", "hjemmelavet", og "velkommen forbi". Undgå stift eller formelt sprog.

3. Target Audience
Jeres primære målgruppe er lokale beboere på Nørrebro samt besøgende der søger en autentisk, afslappet caféoplevelse. De værdsætter økologiske ingredienser og nabolagsfølelse.

4. Core Offerings
- Økologisk kaffe (latte, cappuccino, filter)
- Hjemmelavede croissanter og bagværk
- Lette retter som avocado toast

5. Content Focus
Jeres indhold skal fokusere på hygge, fællesskab, og kvalitet. Del billeder af friskbagt bagværk, stemningen i cafeen, og hverdagsmomenter. Undgå for poleret content – autenticitet er jeres styrke.

6. Image Preferences
Naturligt lys, autentiske fotos af kaffe, bagværk, og atmosfære. Gerne med gæster i baggrunden for at understrege fællesskabsfølelsen.

7. Things to Avoid
- Overdrivelser ("den bedste kaffe i byen")
- Sammenligning med konkurrenter
- Stift eller formelt sprog
- Generiske café-klichéer

8. Call-to-Action Style
Blød og inviterende. Brug vendinger som "Kom forbi", "Vi glæder os til at se dig", "Smut forbi til en kop kaffe". Undgå aggressiv salgstone.

9. Communication Goal
Skabe lokal awareness og invitere stamgæster til at komme oftere. Fokus på fællesskab og tilbagevendende besøg frem for engangskunder.
```

---

## VALIDATION CHECKLIST

Before returning output, verify:

- [ ] All 9 variables are present in exact order
- [ ] Content is in **Danish** (unless business language is explicitly English)
- [ ] No confidence scores visible to user
- [ ] No JSON structure (plain text only)
- [ ] No factual data repeated (address, hours, prices)
- [ ] No invented awards, ratings, or popularity claims
- [ ] No competitor mentions
- [ ] No hashtags
- [ ] Fallbacks are calm and neutral (not overconfident)
- [ ] Low-confidence sections feel like "starting points", not authoritative

---

## USAGE IN CODE

```typescript
// supabase/functions/brand-profile-generator/index.ts

const promptB = `You generate a Brand Profile for a small Danish hospitality business.

[INSERT FULL PROMPT B SYSTEM ROLE AND RULES HERE]

INPUT DATA:
Business Name: ${business.business_name}
Business Type: ${business.business_category}
Location: ${business.city}
Short Description: ${business.short_description}
Menu Summary: ${menuSummary}

INTERNAL ANALYSIS FROM PROMPT A:
${JSON.stringify(analysisFromPromptA, null, 2)}

Generate the Brand Profile now in plain text format.
`

const response = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'system', content: 'You are a brand strategist. Output plain text only, no JSON.' },
    { role: 'user', content: promptB }
  ],
  temperature: 0.7,
  max_tokens: 3000
})

const brandProfileText = response.choices[0].message.content

// Parse the plain text output to extract each section
const sections = parseBrandProfile(brandProfileText)

// Save to database (9 TEXT columns)
await supabase
  .from('business_brand_profile')
  .upsert({
    business_id: businessId,
    brand_essence: sections.brand_essence,
    tone_of_voice: sections.tone_of_voice,
    things_to_avoid: sections.things_to_avoid,
    target_audience: sections.target_audience,
    core_offerings: sections.core_offerings,
    content_focus: sections.content_focus,
    cta_style: sections.cta_style,
    communication_goal: sections.communication_goal,
    image_preferences: sections.image_preferences,
    generated_at: new Date().toISOString(),
    last_edited_by: 'ai'
  })
```

**Parsing Helper** (extract sections from plain text):
```typescript
function parseBrandProfile(text: string) {
  const sections = {
    brand_essence: extractSection(text, '1. Brand Essence', '2. Tone'),
    tone_of_voice: extractSection(text, '2. Tone of Voice', '3. Target'),
    target_audience: extractSection(text, '3. Target Audience', '4. Core'),
    core_offerings: extractSection(text, '4. Core Offerings', '5. Content'),
    content_focus: extractSection(text, '5. Content Focus', '6. Image'),
    image_preferences: extractSection(text, '6. Image Preferences', '7. Things'),
    things_to_avoid: extractSection(text, '7. Things to Avoid', '8. Call'),
    cta_style: extractSection(text, '8. Call-to-Action Style', '9. Communication'),
    communication_goal: extractSection(text, '9. Communication Goal', null)
  }
  return sections
}

function extractSection(text: string, startMarker: string, endMarker: string | null): string {
  const startIdx = text.indexOf(startMarker)
  if (startIdx === -1) return ''
  
  const contentStart = startIdx + startMarker.length
  const endIdx = endMarker ? text.indexOf(endMarker, contentStart) : text.length
  
  return text.slice(contentStart, endIdx).trim()
}
```

---

## ANTI-PATTERNS

### ❌ Exposing Confidence Scores
```
1. Brand Essence (Confidence: HIGH)
I er en hyggelig café...
```

**Problem**: Users don't need to see confidence. It creates doubt.

---

### ❌ Repeating Factual Data
```
1. Brand Essence
I er beliggende på Nørrebrogade 123, åben 8-17 hver dag...
```

**Problem**: Business Profile already has this. Brand Profile is for voice, not facts.

---

### ❌ Inventing Claims
```
1. Brand Essence
I er den mest populære café i København med 4.8 stjerner på Google...
```

**Problem**: Not stated by business, likely invented.

---

### ❌ Using Hashtags
```
5. Content Focus
Post om #hygge #kaffe #københavn #organic
```

**Problem**: Hashtags belong in platform-specific content, not brand guidelines.

---

### ❌ Over-Confident with Low Evidence
```
6. Image Preferences
Jeres visuelle stil er mørk, moody, med industriel æstetik.
```

**Problem**: If confidence is LOW, don't make definitive claims. Use fallback.

---

**Status**: Production-ready ✅  
**Aligned with**: Your calm, collaborative UX specification  
**Next**: Test with real Prompt A output and verify plain text parsing
