# Testing Guide: 10 Test Businesses
**Created:** 2026-02-18  
**Purpose:** Full onboarding and V17 validation testing

---

## 📋 Quick Reference

| # | Business | Type | City | What to Test |
|---|----------|------|------|--------------|
| 1 | Café Solskin | SBO (Generic) | København | Standard café flow, banned words |
| 2 | Vinbar Nordlys | SBO_wine | Aarhus | Wine bar framework, sophisticated tone |
| 3 | Coffee House Ø | SBO_coffee | Odense | Coffee shop framework, morning posts |
| 4 | Restaurant Havfruen | FSE | Aalborg | Fine dining, seasonal focus |
| 5 | Burger Street | QSR | København | Takeaway flow, speed/convenience |
| 6 | Sushi Maru | SBO | Aarhus | International cuisine handling |
| 7 | Cocktailbar Hemingway | SBO_cocktail | København | Cocktail bar framework, evening focus |
| 8 | Pizzeria Bella | SBO | Esbjerg | Italian cuisine, family style |
| 9 | Food Truck Grill Master | FOOD_TRUCK | København | Mobile business, location posts |
| 10 | Restaurant Brasserie 1901 | FSE | Aarhus | French fine dining, heritage |

---

## 🔗 Magic Links for Frontend Testing

**IMPORTANT:** Replace `localhost:3000` with your production frontend URL if testing remotely.

### 1. Café Solskin (SBO - København)
```
https://kvqdkohdpvmdylqgujpn.supabase.co/auth/v1/verify?token=8f4102cd588a5fbe7f7a70975a13a5a7eb36f67860f101fafa8d4dfb&type=magiclink&redirect_to=http://localhost:3000
```
**Business ID:** `a42c1b92-38bf-44eb-bd31-1a242fb5c76d`

### 2. Vinbar Nordlys (SBO_wine - Aarhus)
```
https://kvqdkohdpvmdylqgujpn.supabase.co/auth/v1/verify?token=889c65148030f90d3a592be70f4894d9bcad2d05192b690ae0b7c01b&type=magiclink&redirect_to=http://localhost:3000
```
**Business ID:** `00bbc61e-5031-4521-bcb5-29dd54c1e5df`

### 3. Coffee House Ø (SBO_coffee - Odense)
```
https://kvqdkohdpvmdylqgujpn.supabase.co/auth/v1/verify?token=dbf9553a8bd3ed312d82e1a0f76e9e3d9edc42c2cf8ec6f1aa2d559a&type=magiclink&redirect_to=http://localhost:3000
```
**Business ID:** `550c5d13-1732-4150-b3fd-6e6393fe711a`

### 4. Restaurant Havfruen (FSE - Aalborg)
```
https://kvqdkohdpvmdylqgujpn.supabase.co/auth/v1/verify?token=64367c9411258369a51548033622a6263c65eeda83489fc4406a0de0&type=magiclink&redirect_to=http://localhost:3000
```
**Business ID:** `459962e7-8966-41fe-bcf1-3c427b392386`

### 5. Burger Street (QSR - København)
```
https://kvqdkohdpvmdylqgujpn.supabase.co/auth/v1/verify?token=082895040c981ede9b59a861b508eabc61561bf5ec441d68f0c0511d&type=magiclink&redirect_to=http://localhost:3000
```
**Business ID:** `42696ca2-2345-476b-80cd-fbd9fedc1d69`

### 6. Sushi Maru (SBO - Aarhus)
```
https://kvqdkohdpvmdylqgujpn.supabase.co/auth/v1/verify?token=5be789c5e9e92cd3ebfcf5de9abd128be70e667592fd0f9085e33649&type=magiclink&redirect_to=http://localhost:3000
```
**Business ID:** `43df2b64-8ffe-4f3a-b020-a1687d02b3fe`

### 7. Cocktailbar Hemingway (SBO_cocktail - København)
```
https://kvqdkohdpvmdylqgujpn.supabase.co/auth/v1/verify?token=1b61faeb376dd069cbe7281e671f4382b3f3c9633539ce1853fe059c&type=magiclink&redirect_to=http://localhost:3000
```
**Business ID:** `eb0129bd-6216-4d2d-a496-74327a45dcea`

### 8. Pizzeria Bella (SBO - Esbjerg)
```
https://kvqdkohdpvmdylqgujpn.supabase.co/auth/v1/verify?token=4a9d9f1d4274150d0206c0a74b5f764775834db9d23914dced3350ba&type=magiclink&redirect_to=http://localhost:3000
```
**Business ID:** `b262c18d-d485-40d7-abaa-b9ebf96bb110`

### 9. Food Truck Grill Master (FOOD_TRUCK - København)
```
https://kvqdkohdpvmdylqgujpn.supabase.co/auth/v1/verify?token=b9e67c861eadbe0bfd5b16221e187976600c8f4ed10f39853fbfc00f&type=magiclink&redirect_to=http://localhost:3000
```
**Business ID:** `d38fb08f-fb9d-419d-af82-f23557accb8a`

### 10. Restaurant Brasserie 1901 (FSE - Aarhus)
```
https://kvqdkohdpvmdylqgujpn.supabase.co/auth/v1/verify?token=a22fe72bd24f847e68b6e82bac6045ba8fff8c6cc60faff14e4f2b28&type=magiclink&redirect_to=http://localhost:3000
```
**Business ID:** `bc2549e9-88e9-4a35-84f7-75c4c07373cb`

---

## ✅ Testing Checklist (Per Business)

### Phase 1: Onboarding
- [ ] **Login:** Click magic link → redirects to frontend
- [ ] **Business Info:** Name, city, type are pre-filled
- [ ] **Website Analysis:** Enter website URL (or use placeholder)
- [ ] **Brand Profile Generation:** 
  - [ ] Profile generated successfully
  - [ ] Tone keywords match business type
  - [ ] Banned words list populated (107 words)
  - [ ] Voice style appropriate for vertical
- [ ] **Menu/Offerings:**
  - [ ] Add 5-8 menu items
  - [ ] Descriptions saved
- [ ] **Platform Selection:**
  - [ ] Instagram + Facebook selected
- [ ] **Onboarding Complete:** Dashboard loads

### Phase 2: Strategy Generation
- [ ] **Navigate to Calendar/Content**
- [ ] **Generate Weekly Strategy:**
  - [ ] Strategy generated (< 60 seconds)
  - [ ] 5 post ideas returned
  - [ ] Post themes match business type framework
  - [ ] Strategic angles make sense for the week
  - [ ] No Phase 0/2b JSON errors (fixed with GPT-4o-mini)
- [ ] **Review Strategic Brief:**
  - [ ] Week summary considers weather/economics
  - [ ] Angles align with business vertical
  - [ ] Content mix appropriate (atmosphere vs menu items)

### Phase 3: Caption Generation (V17 Testing)
- [ ] **Select 3-5 posts for caption generation**
- [ ] **Generate Captions:**
  - [ ] All captions generated successfully
  - [ ] Captions use GPT-4o (check logs or cost)
  - [ ] Tone matches brand profile
  - [ ] **CRITICAL: Check for banned words:**
    - [ ] No "kom forbi" (come by)
    - [ ] No "nyd" / "nyder" (enjoy)
    - [ ] No "oplev" / "oplevelse" (experience)
    - [ ] No "autentisk" (authentic)
    - [ ] No "unik" / "unikke" (unique)
    - [ ] No "perfekt" / "perfekte" (perfect)
    - [ ] No "fantastisk" (fantastic)
    - [ ] No "hyggelig" / "hyggeligt" (cozy)
    - [ ] No "lækker" / "lækkert" (delicious)
- [ ] **Positive Framing:**
  - [ ] Captions use specific details instead of generic adjectives
  - [ ] CTAs are creative (not just "Book bord")
  - [ ] Storytelling elements present
- [ ] **Regeneration Test (if issues found):**
  - [ ] Regenerate caption with banned word
  - [ ] Check if validation loop catches it
  - [ ] Max 3 attempts enforced

### Phase 4: Business Type Framework Validation
**Check that content matches the expected framework for each vertical:**

#### For SBO (Generic Café/Bar):
- [ ] 80% food/drink, 20% atmosphere
- [ ] Casual, friendly tone
- [ ] Daily comfort positioning
- [ ] Example posts: "Dagens ret", "Ugens special", "Hygge i caféen"

#### For SBO_wine (Wine Bar):
- [ ] Wine education focus (pairings, regions)
- [ ] Sophisticated but accessible tone
- [ ] "Ugens vin", "Regionspotlight", "Pairing-tips"
- [ ] More text-heavy (wine stories)

#### For SBO_coffee (Coffee Shop):
- [ ] Morning/ritual focus
- [ ] Third place culture
- [ ] "Dagens bryg", "Sæsondrink", "Morgenkaffe"
- [ ] Warm, inviting tone

#### For SBO_cocktail (Cocktail Bar):
- [ ] Evening/weekend positioning
- [ ] Craft cocktail focus
- [ ] "Ugens cocktail", "Bartenderen anbefaler"
- [ ] Playful, sophisticated

#### For FSE (Fine Dining):
- [ ] Seasonal ingredients emphasis
- [ ] Special occasions positioning
- [ ] "3-retters menu", "Sæsonmenu", "Vinkælder"
- [ ] Refined, elevated tone
- [ ] NO casual language ("kom forbi", "tag en tur")

#### For QSR (Quick Service):
- [ ] Convenience + speed focus
- [ ] Value messaging
- [ ] "Dagens deal", "Hurtig takeaway"
- [ ] **NOTE:** If 60/40 food/atmosphere mix fails, document for fixing

#### For FOOD_TRUCK (Mobile):
- [ ] Location announcement posts
- [ ] "Vi er på [location] i dag"
- [ ] Event presence
- [ ] **NOTE:** Check if location tracking logic exists

---

## 📊 Results Tracking

### Create a testing spreadsheet with these columns:

| Business | Onboarding | Strategy Gen | Caption Gen | Banned Words | Framework Match | Issues Found |
|----------|------------|--------------|-------------|--------------|-----------------|--------------|
| Café Solskin | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ | Notes |
| ... | | | | | | |

### Key Metrics to Record:
- **Time to complete onboarding:** _____ minutes
- **Strategy generation time:** _____ seconds
- **Caption generation time per post:** _____ seconds
- **Banned words found:** _____ (should be 0)
- **Regeneration attempts needed:** _____ (should be 0-1)
- **Business type framework accuracy:** 1-5 rating

---

## 🚨 Known Issues to Watch For

### From Previous Testing:
1. ✅ **Phase 0 JSON errors** - FIXED (now using GPT-4o-mini)
2. ✅ **Phase 2b JSON errors** - FIXED (now using GPT-4o-mini)
3. ✅ **Banned words in captions** - FIXED with V17 (GPT-4o + validation)

### Potential New Issues:
1. **QSR takeaway content:**
   - May still suggest "atmosphere" posts (60/40 mix not ideal for takeaway-only)
   - Strategy should focus on convenience, not ambiance
   
2. **Food Truck location tracking:**
   - System may not have dynamic location update logic
   - Posts might not reference current location
   
3. **Business profile generation:**
   - Website analysis might fail for placeholder URLs
   - May need to manually fill in brand details

---

## 💡 Testing Tips

### Parallel Testing:
- Open 3-4 businesses in different browser profiles/incognito windows
- Complete onboarding for all before moving to strategy generation
- Compare strategies side-by-side to validate framework differences

### Screenshot Critical Points:
- Strategy generation output (post themes)
- Caption examples (for banned word audit)
- Any error messages
- Framework-specific content (wine bar vs fine dining)

### API Testing (Optional):
If you want to test via API instead of frontend:

```bash
# Get strategy
curl -X POST "https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/get-weekly-strategy" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"business_id":"BUSINESS_ID_HERE","regenerate":true}'

# Generate captions
curl -X POST "https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/generate-weekly-plan" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"business_id":"BUSINESS_ID_HERE","strategy_id":"STRATEGY_ID","selected_idea_ids":[1,2,3]}'
```

---

## 📝 Reporting Issues

If you find issues, document:

1. **Business name + ID**
2. **Step where it occurred** (onboarding/strategy/caption)
3. **Expected behavior**
4. **Actual behavior**
5. **Screenshot/logs if possible**
6. **Reproducible?** (yes/no)

Example:
```
Business: Vinbar Nordlys (00bbc61e-5031-4521-bcb5-29dd54c1e5df)
Step: Caption generation
Expected: Wine-focused content, no banned words
Actual: Caption contained "nyd vores unikke vinudvalg"
Reproducible: Yes, 2/3 captions had banned words
```

---

## 🎯 Success Criteria

### Minimum pass rate:
- **90%+ businesses complete onboarding** without errors
- **100% strategies generate** successfully (no Phase 0/2b errors)
- **0 banned words** in captions (V17 validation working)
- **80%+ framework accuracy** (content matches business type)

### Ideal outcome:
- All 10 businesses complete full flow
- Business type frameworks clearly differentiated
- V17 banned word enforcement 100% effective
- No critical bugs found

---

## 🔄 Next Steps After Testing

1. **Compile results** into summary report
2. **Document any issues** found (with reproduction steps)
3. **Priority fixes** for critical bugs
4. **Framework adjustments** if QSR/Food Truck need tweaking
5. **Production rollout** if all tests pass

---

**Happy Testing! 🚀**
