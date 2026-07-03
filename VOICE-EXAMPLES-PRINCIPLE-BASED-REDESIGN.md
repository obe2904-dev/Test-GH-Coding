# Voice & Menu Examples: Principle-Based Redesign

**Date:** 25 maj 2026  
**Status:** In Progress  
**Version:** V5.3 → V5.4 Transition

## Problem Statement

After building sophisticated intelligence (location, audience, programmes, signature themes), menu examples felt **flat and generic**:
- "Ribeye med fritter og bearnaise" - could be ANY restaurant
- Missing personality ("moderne, indbydende, lokal, playful")
- Not following tone rules ("Fokusér på tilberedningsmetoder")
- No pride in craft - disrespectful to business owners

**Root cause:** Optimized for constraint compliance, lost the soul.

## The Vision

### System Architecture
```
Layer 1: Programme Detection → "What do they serve?"
Layer 2: Brand Identity → "Who is this business?"
Layer 3: Audience & Commercial → "Who comes here?"
Layer 4: Strategic Positioning → "How should they position?"
Layer 5a: VOICE FRAMEWORK → "How should they sound?" (Foundation for ALL content)
Layer 5b: MENU EXAMPLES → "Demonstrate the voice through food"
```

### Key Principles

**1. Focused AI Tasks**
- Each layer = One clear task
- No overwhelming with 7 responsibilities in one prompt
- Trust AI to reason, don't micro-manage

**2. Layered Intelligence**
- Each layer receives ALL previous intelligence
- Voice framework gets: location + audience + themes + programmes
- Menu examples get: voice framework + actual menu items

**3. Universal Voice**
- Generated ONCE in Layer 5a
- Works for ALL content types (menu, atmosphere, events, behind-the-scenes)
- Specific to THIS business, not generic café

**4. Principle-Based, Not Rule-Based**
- Short prompts (~100-150 lines)
- Clear principles AI can reason about
- Not endless forbidden pattern lists

**5. Pride in Craft**
- Show respect for business owner's work
- Use culinary knowledge (ovnbagt = slow → saftig)
- Frame through voice (casual vs formal vs traditional)
- Never invent claims (no "hjemmelavet" unless we know)

## The Two-Layer System

### Layer 1: Universal Culinary Logic
**Facts that apply to ALL businesses:**
- ovnbagt = langsom (oven = slow, physics)
- hollandaise = cremet (sauce nature)
- pommes frites = sprøde (fry goal)
- grillet = hurtig varme (grill method)

### Layer 2: Voice-Specific Framing
**Same fact, different expression per personality:**

**Fine Dining (formal):**
- "Præcist ovnbagt laks med klassisk hollandaise"

**Casual Bistro (playful):**
- "Saftig laks fra ovnen med cremet hollandaise"

**Traditional (heritage):**
- "Ovnbagt laks efter traditionel metode"

**Modern Health (clean):**
- "Langsomt ovnbagt laks med let hollandaise"

## Implementation Changes

### Phase 1: Clean Layer 5a (Voice Framework)
**COMPLETED**

**Removed:**
- Menu items context (belongs only in 5b)
- Generic instruction: "Generer voice guidelines"

**Added:**
- Explicit demand for intelligence-driven tone rules
- Examples of what GOOD vs BAD rules look like
- Clear connection: "If location = waterfront → reference social vibe"

**Result:** Layer 5a now explicitly asks for business-specific, actionable tone rules.

### Phase 2: Rebuild Layer 5b (Menu Examples)
**IN PROGRESS**

**Current state:** 500+ lines of rules and constraints
**Target state:** 100-150 lines of principles

**New structure:**
```
1. PURPOSE
   Demonstrate the voice through menu descriptions
   
2. CULINARY KNOWLEDGE PRINCIPLES
   - Use technique deduction (ovnbagt → langsom, saftig)
   - Frame through voice personality
   - Pride in craft without invention
   
3. VOICE ALIGNMENT
   - Demonstrate tone_rules in practice
   - Match personality_traits
   - Follow formality_level
   
4. BASIC EXPECTATIONS
   - 6 descriptions (2 per dish, 8-12 words each)
   - Single sentences
   - Varied approaches (not wallpaper)
   
5. SMART EXAMPLES
   - Show GOOD work (specific, proud, on-voice)
   - Show BAD work (generic, flat, off-voice)
```

**Key removals:**
- Endless forbidden pattern lists
- Micro-validation rules
- Defensive constraints

**Key additions:**
- Culinary knowledge framework
- Pride in craft principle
- Voice demonstration focus

### Phase 3: Test & Validate
**PENDING**

1. Regenerate Café Faust brand profile
2. Verify tone rules are specific and actionable
3. Verify menu examples show pride + personality
4. Check alignment with tone rules

## Expected Outcomes

### Before (Current)
**Tone Rules:** Generic
- "Vær professionel"
- "Skriv kort"

**Menu Examples:** Flat
- "Ribeye med fritter og bearnaise"
- "Ovnbagt laks med hollandaise"

**User Reaction:** "Is that it?"

### After (Target)
**Tone Rules:** Specific
- "Fokusér på ingrediensernes kvalitet og tilberedningsmetoder"
- "Brug lokale referencer til Aarhus og åen"
- "Inkludér subtile hints til den sociale spiseoplevelse"

**Menu Examples:** Proud
- "Saftig ribeye fra grillen med cremet bearnaise" (shows method + result)
- "Langsomt ovnbagt laks med hollandaise og citron" (shows technique + warmth)

**User Reaction:** "That's how I talk about my food!"

## Success Criteria

✅ **Business owners see their pride reflected**
- Descriptions honor the craft
- Show quality without inventing claims

✅ **Tone rules are actionable**
- Specific to THIS business
- Derived from intelligence
- Usable for ALL content types

✅ **Menu examples demonstrate voice**
- Show personality in practice
- Teach correct patterns
- Inspire confidence

✅ **System is maintainable**
- Short, clear prompts
- Principle-based reasoning
- Doesn't grow endlessly

## Next Steps

1. ✅ Complete Layer 5a enhancements
2. ⏸️ Complete Layer 5b rebuild (principle-based prompt)
3. 🔲 Deploy and test with Café Faust
4. 🔲 Validate quality and alignment
5. 🔲 Document learnings

---

**Core Insight:**  
"Every business owner has pride in their craft. Our job is to help them express it through their unique voice - not reduce it to ingredient lists."
