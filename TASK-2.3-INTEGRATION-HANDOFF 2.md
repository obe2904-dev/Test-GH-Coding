# Task 2.3 Integration Handoff

## Current Status: 60% Complete

### ✅ Completed Work

**Module Created**: `supabase/functions/_shared/dagens-forslag-prompt-builder.ts` (773 lines)
- All helper functions extracted and tested
- No TypeScript errors
- Comprehensive inline documentation

**Main File Updates**:
- Imports added for all module functions
- Duplicate `getBTSActivityWindow` removed (-63 lines)
- Current line count: 2510 (down from 2700)

### ⏳ Remaining Work

**Step 1: Build DagensPromptContext Object** (~45 min)

Insert after line ~1870 (after `isHybridBusiness` is defined):

```typescript
// Build context object for prompt builder module
const menuCategories: MenuCategory[] = menuCategoryEntries.map(cat => ({
  catName: cat.catName,
  items: cat.items
}))

const promptContext: DagensPromptContext = {
  // Business identity
  businessName: business.name,
  businessVertical: business.vertical || '',
  effectiveVertical,
  isHybridBusiness,
  businessCharacter: businessCharacterText,
  cuisineStyle,
  identityKeywords: identityKeywordsText,
  visualCharacter: visualCharacterText,
  venueScene: venueSceneText,
  venueEnergyText,
  guestSituation: guestSituationText,
  emotionalPromise: emotionalPromiseText,
  
  // Location
  city: location?.city,
  country: location?.country,
  
  // Operations
  todayOpenTime,
  todayCloseTime,
  kitchenCloseTime,
  activeServicePeriod,
  priceLevel: operations?.price_level,
  
  // Day/time context
  dayName,
  dayBehavior,
  isWeekend,
  currentHour: new Date().getHours(),
  
  // Weather/season
  weatherInfo,
  season,
  outdoorNote,
  outdoorSuitability,
  outdoorProhibitionBlock,
  
  // Audience
  targetAudienceText,
  activeSegmentAngle: activeSegmentAngleText,
  audienceBreadth: audienceBreadthQS,
  businessModelType: businessModelTypeQS,
  primaryCopyHook: primaryCopyHookQS,
  
  // Menu
  menuCategories,
  signatureItems,
  menuDescriptionMap,
  socialLeadLabel,
  menuLanguage,
  
  // Facts banks
  confirmedFacts,
  confirmedFactsSlotB,
  calendarEventFacts,
  locationMarketingHooks,
  menuIntelligenceFacts,
  
  // Constraints
  hasKidsMenu,
  hasTakeaway,
  hasOutdoorSeating,
  hasTableService,
  
  // Content strategy  
  contentExclusions: contentExclusionsText,
  conceptFitAvoid: conceptFitAvoidItems,
  disabledSlots,
  
  // History
  recentSuggestions: (recentSuggestions || []) as any[],
  recentSlotADishes: recentSlotASection,
  selectionBiasBlock,
  
  // Brand voice
  toneInstructions,
  voiceRationale: voiceRationaleText,
  isPaidTier,
  touristContext,
}
```

**Step 2: Replace Helper Code** (~30 min)

Replace lines ~1872-1990 (neverSayList, cuisineBlock, menuBlock) with:

```typescript
// Build never-say list, menu block, shared context using module
const { list: neverSayList, block: neverSayBlock } = 
  buildComprehensiveNeverSayList(promptContext, brandProfile)
  
const menuBlock = buildMenuBlock(promptContext)

const sharedCtx = buildSharedContext(promptContext)

const sharedRules = buildSharedRules(promptContext, neverSayBlock)
```

**Step 3: Replace Slot Planner** (~15 min)

Replace lines ~2020-2140 with:

```typescript
const plannerResult = await runSlotPlanner(promptContext, GEMINI_API_KEY)
const slotExpectedContentTypes = plannerResult.slot_types
const plannerRationale = plannerResult.rationale
```

**Step 4: Replace Prompt Construction** (~90 min)

Replace lines ~2207-2470 (sharedCtx, sharedRules, promptA, promptB, promptC) with:

```typescript
// Note: Remove the inline sharedCtx and sharedRules building (already built above)

// Build confirmed facts blocks
const confirmedFactsSlotBBlock = confirmedFactsSlotB.length > 0
  ? `\n\n──── BEKRÆFTEDE SERVICE-FACTS (eneste gyldige kilde til concrete_anchor for Slot B) ────\nSlot B er et gæstemoment — anker SKAL være en service- eller timingfact, IKKE interiørbeskrivelse.\nconcrete_anchor MÅ KUN vælges herfra — opfind IKKE nye facts:\n${confirmedFactsSlotB.map(f => `- ${f}`).join('\n')}\n`
  : ''
  
const confirmedFactsSlotCBlock = confirmedFacts.length > 0
  ? `\n\n──── BEKRÆFTEDE FACTS (eneste gyldige kilde til concrete_anchor for Slot C) ────\nconcrete_anchor MÅ KUN vælges herfra — opfind IKKE nye facts om stedet:\n${confirmedFacts.map(f => `- ${f}`).join('\n')}\n`
  : ''

const menuIntelligenceBlock = menuIntelligenceFacts.length > 0
  ? `\n\n──── MENU KARAKTERISTIKA (til Slot C ide-valg) ────\nSærlige kendetegn der egner sig til indholdsideer:\n${menuIntelligenceFacts.map(f => `- ${f}`).join('\n')}\n`
  : ''

// Slot enable/disable
const slotAEnabled = !disabledSlots.includes('offering')
const slotBEnabled = !disabledSlots.includes('guest_moment')
const slotCEnabled = !disabledSlots.includes('brand_behind')

// Determine slot types
const slotAExpectedType = slotExpectedContentTypes[0]
const plannedSlotBType = slotExpectedContentTypes[1] ?? 'atmosphere'
const plannedSlotCType = slotExpectedContentTypes[2] ?? (effectiveSlotC === 'behind_scenes' ? 'behind_scenes' : 'atmosphere')
const slotBIsMenu = plannedSlotBType === 'menu_item'

// Build prompts using module
const promptA = slotAEnabled 
  ? buildSlotAPrompt(
      promptContext,
      slotAExpectedType,
      sharedCtx,
      sharedRules,
      menuBlock,
      recentSlotASection
    )
  : ''

const promptB = slotBEnabled
  ? buildSlotBPrompt(
      promptContext,
      plannedSlotBType,
      slotBIsMenu,
      sharedCtx,
      sharedRules,
      menuBlock,
      recentSlotASection,
      confirmedFactsSlotBBlock
    )
  : ''

const promptC = slotCEnabled
  ? buildSlotCPrompt(
      promptContext,
      plannedSlotCType,
      sharedCtx,
      sharedRules,
      confirmedFactsSlotCBlock,
      menuIntelligenceBlock,
      avoidSection
    )
  : ''
  
// Fallback objects remain unchanged
const slotAFallback = {
  title: signatureItems[0] ? `${signatureItems[0]} i dag` : 'Dagens ret er klar',
  menu_item_name: signatureItems[0] || '',
  dish_text_brief: menuDescriptionMap.get(signatureItems[0] || '') || '',
  why_explanation: signatureItems[0]
    ? `${signatureItems[0]} er et godt valg til netop dette tidspunkt på dagen.`
    : 'Del dagens tilbud med dine følgere.',
  content_type: slotAExpectedType,
  slot: 'offering',
}

const slotBFallback = {
  title: 'Et øjeblik på stedet',
  concrete_anchor: confirmedFactsSlotB[0] || '',
  why_explanation: 'Giv følgerne et indblik i stemningen hos jer.',
  content_type: plannedSlotBType,
  slot: 'guest_moment',
}

const slotCType = effectiveSlotC === 'behind_scenes' ? 'behind_scenes' : 'atmosphere'
const slotCFallback = {
  title: effectiveSlotC === 'behind_scenes'
    ? `Bag kulisserne hos ${business.name}`
    : `${business.name} ${getBTSActivityWindow(todayOpenTime, todayCloseTime, effectiveVertical).toLowerCase().includes('køkken') ? 'åbner køkkenet' : 'byder indenfor'}`,
  concrete_anchor: confirmedFacts[0] || '',
  why_explanation: effectiveSlotC === 'behind_scenes'
    ? `Teamet hos ${business.name} gør klar til dagens gæster. ${confirmedFacts[0] ? confirmedFacts[0] + '.' : ''}`
    : `${business.name} er klar til dagen. ${confirmedFacts[0] ? confirmedFacts[0] + '.' : ''}`,
  content_type: slotCType,
  slot: 'brand_behind',
}
```

### Expected Results

**Line Count**: ~1800 lines (down from 2510)
**Lines Removed**: ~710 lines of inline prompt construction
**TypeScript Errors**: Same Deno-related warnings (expected, not actual errors)

### Validation Checklist

- [ ] TypeScript compiles without new errors
- [ ] Line count is ~1800 (+/- 50 lines)
- [ ] `callGeminiForSlot` calls remain unchanged
- [ ] Parallel Promise.all structure unchanged
- [ ] All variables referenced in prompts are defined
- [ ] Test with `DEBUG_PROMPT_LOGGING=true` to compare prompts

### Files Modified

- `supabase/functions/get-quick-suggestions/index.ts` - Main integration
- `CONTENT-SYSTEMS-IMPROVEMENT-PLAN.md` - Update to v1.5, mark 2.3 complete

### Next Session Priority

Complete Steps 1-4 above (~3 hours) to finish Month 1 Category 2 goals.

---

**Created**: 1. maj 2026  
**Status**: Ready for integration  
**Module**: Fully built and tested
