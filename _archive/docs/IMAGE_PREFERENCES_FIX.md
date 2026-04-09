# Image Preferences DON'Ts - Fixed Overly Restrictive Rules

**Issue Reported**: Image Preferences DON'Ts were too restrictive, blocking legitimate content types:
- ❌ "Billeder uden gæster" (Pictures without guests)
- ❌ "Indendørs uden åen" (Indoor without the river)
- ❌ "Generiske madbilleder" (Generic food pictures)

**Problem**: This blocks valid social media content like:
- Menu close-ups
- Behind-the-scenes (BTS) content
- Solo product shots
- Ingredient prep photos
- Staff portraits
- Empty venue shots (showing space/atmosphere)

---

## 🔧 Root Cause

The AI was generating overly restrictive DON'T rules without proper guidance. There was no instruction to differentiate between:
- **Strategic restrictions** (generic stock-photo feel, tone mismatches)
- **Legitimate content types** (menu shots, BTS, solo products)

---

## ✅ Fix Applied

### 1. Updated Prompt B (Brand Profile Generation)

**Location**: `/supabase/functions/_shared/brand-profile/prompts/prompt-b.ts`

**Added comprehensive IMAGE PREFERENCES RULES**:

```typescript
**IMAGE PREFERENCES RULES (IMPORTANT)**:

**DOS** (3 visual best practices):
- Be SPECIFIC to this business's distinctive elements (location, space, style)
- Example: "Billeder ved åen med morgen/aftenlys", "Fokus på brunch-opsætninger og gæster"
- Base on actual evidence from uploaded images or website

**DON'TS** (3 visual anti-patterns - BE STRATEGIC, NOT OVERLY RESTRICTIVE):
- ONLY ban what genuinely conflicts with their brand or evidence
- DO allow legitimate content types: menu close-ups, BTS (behind-the-scene), solo product shots, prep work
- DO allow variation: indoor-only shots, ingredient close-ups, staff portraits, empty venue shots
- Focus DON'Ts on: 
  * Generic stock-photo feel
  * Wrong location context (if they have distinctive location)
  * Tone mismatch (e.g., "overdrevent polerede billeder" for casual places)
- AVOID overly restrictive rules like "Billeder uden gæster" or "Indendørs uden [location]"
- Example GOOD DON'Ts: "Generiske madbilleder uden personlighed", "Mørke billeder uden naturligt lys", "Stockfoto-æstetik"
- Example BAD DON'Ts: "Billeder uden gæster", "Solo produktbilleder", "Indendørs shots" (these are LEGITIMATE content types)

**SIGNATURE SHOT** (1 iconic description):
- Describe the MOST distinctive shot type for this venue
- Include: scene, lighting, people/objects, location cue
- Be specific but not overly prescriptive
```

### 2. Updated Prompt A (Internal Analysis)

**Location**: `/supabase/functions/_shared/brand-profile/prompts/prompt-a.ts`

**Added guidance note to image_preferences signal**:

```typescript
"image_donts": [
  "DON'T 1 (strategic, not overly restrictive)", 
  "DON'T 2 (focus on tone/feel conflicts)", 
  "DON'T 3 (avoid banning legitimate content types like menu shots, BTS, solo products)"
],
"notes": "CRITICAL: DON'Ts should focus on generic/stock-photo feel and tone mismatches, NOT ban legitimate content types like menu close-ups, behind-the-scenes, solo products, indoor shots, or images without people. Those are valid social media content."
```

---

## 📊 Expected Behavior Change

### Before (Too Restrictive):
```json
{
  "image_preferences": {
    "dos": [
      "Billeder ved åen med gæster",
      "Morgen- eller aftenlys",
      "Autentiske øjeblikke"
    ],
    "donts": [
      "Generiske madbilleder",
      "Indendørs uden åen",
      "Billeder uden gæster"  // ❌ TOO RESTRICTIVE
    ]
  }
}
```

### After (Strategic):
```json
{
  "image_preferences": {
    "dos": [
      "Billeder ved åen med naturligt lys",
      "Fokus på brunch-opsætninger og atmosfære",
      "Autentiske øjeblikke med gæster eller solo mad-shots"
    ],
    "donts": [
      "Generiske stockfoto-billeder uden personlighed",
      "Overdrevent mørke eller polerede shots (vi er casual)",
      "Billeder der ikke viser vores location eller mad-fokus"  // ✅ STRATEGIC
    ]
  }
}
```

---

## ✅ Validation: Legitimate Content Types Now Allowed

### Menu Close-ups ✓
- **Before**: Banned by "Generiske madbilleder"
- **After**: Allowed (only ban "generic stock-photo feel", not menu shots themselves)

### Behind-the-Scenes (BTS) ✓
- **Before**: Potentially banned by "Indendørs" or "uden gæster"
- **After**: Explicitly allowed as legitimate content type

### Solo Product Shots ✓
- **Before**: Banned by "Billeder uden gæster"
- **After**: Explicitly allowed (prep work, ingredient shots, etc.)

### Indoor Shots ✓
- **Before**: Banned by "Indendørs uden åen" (if venue is by river)
- **After**: Allowed - DON'T should focus on tone/feel, not location-only

### Empty Venue Shots ✓
- **Before**: Banned by "Billeder uden gæster"
- **After**: Allowed (showing space, atmosphere, interior design)

### Staff Portraits ✓
- **Before**: Not explicitly banned but restrictive rules could block
- **After**: Explicitly protected as legitimate content type

---

## 🎯 What DON'Ts SHOULD Focus On

### ✅ GOOD DON'Ts (Strategic):
1. **Generic stock-photo feel**
   - "Stockfoto-æstetik uden personlighed"
   - "Overdrevent polerede billeder (vi er casual)"
   - "Generiske food-styling shots som kunne være fra hvor som helst"

2. **Tone mismatches**
   - "Alt for formelle opsætninger (vi er en afslappet café)"
   - "Mørke, dystre billeder (vi har lyst og venligt interiør)"
   - "Hipster-filter hvis vi er traditionel"

3. **Wrong context** (ONLY if distinctive location exists)
   - "Billeder uden at vise vores udsigt til åen" (if river view is KEY differentiator)
   - "Fotos der kunne være fra hvilket som helst sted i byen" (lack of distinctive context)

### ❌ BAD DON'Ts (Overly Restrictive):
1. "Billeder uden gæster" → Blocks menu shots, BTS, empty venue
2. "Indendørs shots" → Blocks most restaurant content
3. "Solo produktbilleder" → Blocks menu highlights, ingredients
4. "Tætpå mad-fotos" → Blocks crave-worthy content
5. "Billeder af personale" → Blocks staff/culture content

---

## 🚀 Deployment Steps

1. **Code Changes**: ✅ Applied to both Prompt A and Prompt B
2. **Edge Function Deployment**: Pending (run when ready):
   ```bash
   cd /Users/olebaek/Test\ P2G\ 1
   supabase functions deploy brand-profile-generator
   ```
3. **Testing**: Regenerate Brand Profile for Café Faust (or test business)
4. **Validation**: Check image_preferences.donts are strategic, not overly restrictive

---

## 📋 Testing Checklist

After deployment, regenerate Brand Profile and verify:

- [ ] DON'Ts do NOT include "Billeder uden gæster"
- [ ] DON'Ts do NOT ban "indendørs" or "indoor" generically
- [ ] DON'Ts do NOT ban "solo produktbilleder" or "menu shots"
- [ ] DON'Ts DO focus on tone/feel (e.g., "stockfoto-æstetik", "overdrevent poleret")
- [ ] DON'Ts DO allow location flexibility (unless location IS the key differentiator)
- [ ] DOS are specific to the business's distinctive elements
- [ ] SIGNATURE_SHOT is specific but not overly prescriptive

---

## 💡 Example Output (Expected After Fix)

**Café by River with Brunch Focus:**

```json
{
  "image_preferences": {
    "dos": [
      "Billeder ved åen med naturligt morgen- eller aftenlys",
      "Brunch-opsætninger med fokus på farverige retter og kaffe",
      "Atmosfære-shots med gæster, eller tomme borde der viser vores riverside location"
    ],
    "donts": [
      "Generiske stockfoto-billeder der kunne være fra hvilken som helst café",
      "Overdrevent mørke eller polerede shots (vi har en casual, lys atmosfære)",
      "Billeder der ikke kommunikerer vores riverside location eller brunch-fokus"
    ],
    "signature_shot": "Brunch-opsætning ved vinduet med udsigt til åen, morgenlys, kaffekop og farverige retter i forgrunden, gæster i baggrunden (eller tomt bord med atmosfære)"
  }
}
```

**Note**: This still allows menu close-ups, BTS kitchen shots, ingredient prep, staff portraits, empty venue atmosphere shots, etc. - all legitimate social media content types.

---

## 🎓 Key Principle

**DON'Ts are for STRATEGY, not CENSORSHIP**

- Ban what conflicts with brand tone/positioning
- Allow diverse content types (menu, BTS, products, people, space)
- Focus on feel/quality, not content category

This aligns with social media best practices where variety (Crave-worthy + BTS + Vibe + Social proof) drives engagement.

---

## ✅ Status

- **Code**: ✅ Updated
- **Deployment**: ⏳ Ready to deploy
- **Testing**: ⏳ Pending regeneration

Run deployment when ready, then regenerate Brand Profile to test! 🚀
