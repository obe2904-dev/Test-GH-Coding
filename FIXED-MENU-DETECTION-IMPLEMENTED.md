# Fixed Menu Detection & Framing - Implementation Complete

**Date**: 26. maj 2026  
**Status**: ✅ IMPLEMENTED  
**File Modified**: `supabase/functions/generate-text-from-idea/resolve-context.ts`

---

## Problem Solved

**Before**: AI treated brunch menus and sharing platters as individual dishes, creating misleading copy:
- ❌ "Lad skyrens cremede konsistens smelte sammen..." (reads like ordering just skyr)
- ❌ "Vores hjemmelavede salmon rillettes..." (reads like ordering just rillettes)
- ❌ No indication that "DEN ENE" is a complete brunch menu with 11 components

**After**: AI recognizes fixed menus and frames them correctly:
- ✅ "DEN ENE byder på scrambled eggs, lakserilletter, Serrano, danske pølser..."
- ✅ Clear signal that this is a bundled offering: "11 komponenter"
- ✅ Menu-level framing instead of cherry-picking individual items

---

## What Was Implemented

### 1. Menu Type Detection Function (`detectMenuType`)

**Location**: Lines 60-130 in `resolve-context.ts`

**Detection Logic**:
```typescript
// Pattern 1: Fixed Brunch Menu
- 5+ comma-separated components AND
- Brunch keywords in name (DEN ENE, FAVORITTEN, BØRNEBRUNCH, etc.) OR
- Brunch components in description (spejlæg, skyr, granola, smoothie)
→ Type: 'fixed_menu'

// Pattern 2: Sharing Platter
- 15+ comma-separated components OR
- Sharing keywords (tapas, min. X personer, deling)
→ Type: 'sharing_platter'

// Pattern 3: À La Carte
- Everything else
→ Type: 'a_la_carte'
```

**Returns**:
- `type`: Menu classification
- `componentCount`: Number of comma-separated items
- `shouldFrameAsMenu`: Boolean flag for special framing
- `framingInstruction`: Danish instruction block for AI

### 2. Automatic Framing Instruction Injection

**Location**: Lines 1209-1220 in `resolve-context.ts`

**How it works**:
1. After `sanitizeMenuDesc()`, detect menu type
2. If `shouldFrameAsMenu === true`, inject detailed instruction BEFORE the description
3. Instruction tells AI:
   - This is a COMPLETE MENU with X components
   - Start with menu name: "[Name] byder på..." / "[Name] inkluderer..."
   - Highlight 3-5 items from the full list
   - Signal there are more: "blandt andet", "både...og", "X komponenter"
   - Never describe individual components as separate dishes

**Example Injected Instruction** (for DEN ENE):
```
VIGTIGT — FAST BRUNCHMENU:
"DEN ENE" er en KOMPLET BRUNCHMENU med 11 inkluderede komponenter til én samlet pris.

KORREKT fremgangsmåde:
- Start med menunavnet: "DEN ENE byder på..." eller "DEN ENE inkluderer..."
- Fremhæv 3-5 højdepunkter fra de 11 komponenter
- Signal at der er flere: "blandt andet", "både...og", "plus" eller "11 komponenter"
- Beskriv HELHEDEN, ikke enkeltretter
- Aldrig nævn individuelle priser for komponenter

FORKERT fremgangsmåde (undgå):
- ❌ Beskriv skyr som en separat ret i sig selv
- ❌ Beskriv lakserilletter som en individuel anbefaling
- ❌ Skab indtryk af at gæsten vælger enkelte komponenter
- ❌ Glem at nævne at dette er en fast menu
```

### 3. Console Logging for Debugging

```typescript
if (menuType.shouldFrameAsMenu) {
  console.log(`🍽️ Detected ${menuType.type}: "${menuItemName}" (${menuType.componentCount} components)`)
}
```

This helps track when fixed menu detection activates.

---

## Menu Types Detected

### **Fixed Brunch Menus** (5+ components, brunch keywords)
- DEN ENE (11 components)
- FAVORITTEN (7 components)
- DEN NYE LUKSURIØSE BRUNCH (serveres i 2 serveringer)
- DEN LILLE BRUNCH (6 components)
- BØRNEBRUNCH (5 components)
- VEGETAR BRUNCH (6 components)
- VEGANSK BRUNCH (5 components)

### **Sharing Platters** (15+ components or sharing keywords)
- TAPAS (19 components, "min. 2 pers.")

### **À La Carte** (remains unchanged)
- PARISERBØF
- OVNBAGT LAKS
- BØF & BEARNAISE
- KLASSISK CAESAR
- FAUSTBURGER
- All other individual dishes

---

## Expected Output Changes

### **Before (DEN ENE - Broken)**
```
Tirsdagsafslapning med en god bog

Lad skyrens cremede konsistens smelte sammen med æblekompotens sødme 
og den sprøde, håndlavede granola. Vores hjemmelavede salmon rillettes 
byder på en rig smag med et strejf af friskhed fra avocadoen. Tag en 
pause fra hverdagens travlhed og nyd et stille øjeblik ved åen. Kom og 
oplev Aarhus' smag.
```

**Problems**:
- ❌ No mention of "DEN ENE" menu name
- ❌ Reads like ordering 2 separate dishes (skyr + salmon)
- ❌ No indication this includes 11 items
- ❌ Lifestyle marketing fluff instead of food facts

### **After (DEN ENE - Fixed)**
```
Brunch ved åen i dag

DEN ENE byder på scrambled eggs med purløg, håndlavede lakserilletter 
fra køkkenet, Gran Reserva Serrano og danske pølser fra Højer. Skyr 
med sød æblekompot og sprød granola. Friskbagt rugbrød og gulerodskage 
med frosting. 11 komponenter. Book dit bord.
```

**Improvements**:
- ✅ Menu name in opening: "DEN ENE byder på..."
- ✅ Samples 5-6 highlights from 11 components
- ✅ Signals completeness: "11 komponenter"
- ✅ Focus on food preparation, not lifestyle
- ✅ Clear this is a bundled offering

### **Before (TAPAS - Broken)**
```
Tapas aften ved åen

Nyd Serrano skinke reserva med den perfekte balance af salt og 
umami. Chorizo charcuteri med parmesan giver en krydret kontrast...
```

**Problems**:
- ❌ Reads like ordering individual tapas items
- ❌ No mention this is a sharing platter
- ❌ No indication there are 19 components

### **After (TAPAS - Fixed)**
```
Tapas onsdag-lørdag

Vores tapasmenu samler Serrano reserva, Chorizo med parmesan, 
Manchego, Gorgonzola, paté og oliven. Romesco, aioli og pan con 
tomate. Saltede mandler og syltede nødder. 19 specialiteter til 
deling. Min. 2 personer. Book bord.
```

**Improvements**:
- ✅ Framed as complete menu: "Vores tapasmenu samler..."
- ✅ Lists multiple items to show variety
- ✅ Signals it's for sharing: "til deling", "Min. 2 personer"
- ✅ Component count: "19 specialiteter"

---

## Testing Checklist

Before deploying:

- [ ] Test with DEN ENE brunch menu
  - Verify "DEN ENE byder på..." opening
  - Verify multiple components mentioned
  - Verify "X komponenter" signal
  - Verify no individual-dish framing

- [ ] Test with TAPAS sharing platter
  - Verify sharing/deling language
  - Verify "min. 2 personer" mentioned
  - Verify multiple items sampled

- [ ] Test with à la carte dish (PARISERBØF)
  - Verify NO framing instruction injected
  - Verify normal dish description works

- [ ] Check console logs for detection triggers
  - Look for: `🍽️ Detected fixed_menu: "DEN ENE" (11 components)`

---

## Deployment

```bash
cd "/Users/olebaek/Library/Mobile Documents/com~apple~CloudDocs/Test P2G 1-iCloud"
npx supabase functions deploy generate-text-from-idea
```

---

## Technical Details

**Lines Modified**: ~150 new lines added
- Lines 60-130: `detectMenuType()` function
- Lines 1209-1220: Menu type detection + framing injection

**No Breaking Changes**: 
- À la carte dishes continue to work exactly as before
- Only fixed menus and sharing platters get special treatment

**Performance Impact**: Negligible
- Simple string analysis (component counting, regex matching)
- Runs once per generation, adds <1ms

---

## Future Enhancements

If additional menu types need detection:

1. **Prix Fixe Menus** (2-course, 3-course)
   - Pattern: "2-RETTERS MENU", "3-RETTERS MENU"
   - Add to `detectMenuType` function

2. **Set Lunch Menus**
   - Pattern: "DAGENS RET" with multiple components
   - Similar to brunch detection logic

3. **Afternoon Tea / High Tea**
   - Pattern: Multiple sweet + savory tiers
   - Similar to sharing platter logic

Just add patterns to the `detectMenuType` function and provide appropriate framing instructions.
