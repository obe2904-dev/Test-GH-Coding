# Core AI Flow Testing Guide
## Test the Complete Strategy → Publish Pipeline Step-by-Step

Use your **running app** to test each stage. Open DevTools (F12) and follow along.

---

## 🎯 The Complete Flow

```
1. GET WEEKLY STRATEGY
   ↓ (generates 5-7 ideas)
2. USER SELECTS IDEAS
   ↓ (picks 3-5 to create)
3. GENERATE POSTS
   ↓ (AI creates text + hashtags + emojis + CTA)
4. REVIEW & EDIT
   ↓ (user approves/edits)
5. SCHEDULE/PUBLISH
   ↓ (posts to Facebook/Instagram)
```

---

## 📋 Step-by-Step Testing

### **STEP 1: Get Weekly Strategy**

**In your app:**
1. Go to Strategy/Planning page
2. Click "Generate Weekly Strategy"

**In Browser DevTools Console, paste:**
```javascript
// Monitor strategy generation
console.log('🔍 Watching strategy generation...')

// Hook into the generation to see what's happening
window.addEventListener('fetch', (e) => {
  if (e.request.url.includes('get-weekly-strategy')) {
    console.log('📡 Strategy request sent')
  }
})
```

**In Network Tab:**
- Find `get-weekly-strategy` request
- Check **Response** → Should see:
  ```json
  {
    "success": true,
    "strategy": {
      "post_ideas": [
        {
          "id": 1,
          "title": "Pariserbøf klassiker",
          "content_type": "menu_item",
          ...
        }
      ]
    }
  }
  ```

**✅ PASS IF:**
- Status 200
- post_ideas array has 5-7 ideas
- Each idea has: id, title, content_type, description

**❌ FAIL IF:**
- Status 500/400
- No post_ideas
- Ideas missing required fields

---

### **STEP 2: Select Ideas**

**In your app:**
1. See the generated ideas
2. Select 3-5 ideas (checkboxes)
3. Click "Create Posts"

**In Console, check selection:**
```javascript
// Check what ideas are selected
const selectedIdeas = document.querySelectorAll('[data-idea-selected="true"]')
console.log('✔️ Selected ideas:', selectedIdeas.length)
selectedIdeas.forEach(el => {
  console.log('  -', el.dataset.ideaTitle)
})
```

**✅ PASS IF:**
- At least 1 idea selected
- "Create Posts" button enabled

---

### **STEP 3: Generate Posts (THIS IS WHERE THE BUG IS)**

**In your app:**
1. Click "Generate Posts"
2. Watch it generate for each platform

**In Network Tab:**
- Find `ai-generate-from-strategy` requests
- **CRITICAL:** Right-click → **Copy as cURL**
- Save this - we'll use it for debugging

**In Console, monitor generation:**
```javascript
// Watch post generation in real-time
window.addEventListener('fetch', async (e) => {
  const url = e.request.url
  if (url.includes('ai-generate-from-strategy')) {
    console.log('🎨 Generating post...')
    
    // Clone and read the request body
    const clone = e.request.clone()
    const body = await clone.json()
    console.log('   Request:', {
      business_id: body.business_id?.substring(0, 12) + '...',
      idea_id: body.idea_id,
      platforms: body.platforms
    })
  }
})
```

**Check Response in Network Tab:**
```json
{
  "success": true,
  "text": "Weekend comfort food...",
  "hashtags": ["DanskMad", "Hygge", "FoodieKbh"],  ← CHECK THESE!
  "emojis": ["🍽️", "❤️"],
  "cta": "Book et bord",
  "recommended_post_time": "2026-02-22T11:00:00"
}
```

**🐛 BUG CHECK - In Console:**
```javascript
// Analyze hashtags for location bug
(async () => {
  const response = await fetch('http://127.0.0.1:54321/functions/v1/ai-generate-from-strategy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_TOKEN_HERE'
    },
    body: JSON.stringify({
      business_id: '840347de-9ba7-4275-8aa3-4553417fc2af',
      idea_id: 3,
      content_type: 'menu_item',
      platforms: ['instagram']
    })
  })
  
  const data = await response.json()
  
  console.log('\n🏷️ HASHTAG ANALYSIS:')
  data.hashtags.forEach(tag => {
    const location = tag.match(/(København|Kbh|Aarhus|Copenhagen)/i)
    if (location) {
      console.log(`   📍 ${tag} → Location: ${location[1]}`)
    } else {
      console.log(`   ✓ ${tag}`)
    }
  })
  
  const hasKbh = data.hashtags.some(t => /københavn|kbh/i.test(t))
  const hasAarhus = data.hashtags.some(t => /aarhus/i.test(t))
  
  console.log('\n🔍 VERDICT:')
  console.log('   København tags:', hasKbh ? '❌ YES (should be Aarhus!)' : '✅ No')
  console.log('   Aarhus tags:', hasAarhus ? '✅ Yes' : '❌ No (should have!)')
})()
```

**✅ PASS IF:**
- Status 200
- text field present and makes sense
- hashtags array has 3-8 tags
- **For Aarhus business: hashtags include #Aarhus, NOT #FoodieKbh/#København**
- emojis array present
- cta present

**❌ FAIL IF:**
- Status 500/400
- Wrong location hashtags (København for Aarhus)
- Missing required fields
- Text too short/long

---

### **STEP 4: Check Database State**

**While testing, verify database has correct data:**

**In Console:**
```javascript
// Check what's stored in database
(async () => {
  const { data: location } = await window.supabase
    .from('business_locations')
    .select('city, country')
    .eq('business_id', '840347de-9ba7-4275-8aa3-4553417fc2af')
    .single()
  
  console.log('📍 Database Location:', location)
  console.log('   City:', location?.city || '⚠️ NULL')
  console.log('   Expected: Aarhus')
  console.log('   Match:', location?.city === 'Aarhus' ? '✅' : '❌')
})()
```

**✅ PASS IF:**
- city = 'Aarhus'
- country = 'DK'

**❌ FAIL IF:**
- city is NULL
- city is wrong (København)

---

### **STEP 5: Check Edge Function Logs**

**Find your Supabase terminal** (should be running somewhere):

Look for these logs when you generate a post:

```
[ai-generate-from-strategy] Context built: {
  businessName: "Café Faust",
  city: "Aarhus",        ← MUST be Aarhus!
  content_type: "menu_item",
  platform: "instagram"
}
```

**✅ PASS IF:**
- city: "Aarhus"

**❌ FAIL IF:**
- city: undefined
- city: null
- city: "København"

**If logs don't show city field:**
- Edge function not updated
- Need to restart Supabase functions

---

## 🔧 Quick Diagnostic Commands

**Copy/paste into Browser Console:**

### 1. **Full Pipeline Test**
```javascript
(async () => {
  console.log('🧪 FULL PIPELINE TEST\n')
  
  // 1. Check database
  console.log('STEP 1: Database Check')
  const { data: loc } = await window.supabase
    .from('business_locations')
    .select('city')
    .eq('business_id', '840347de-9ba7-4275-8aa3-4553417fc2af')
    .single()
  console.log('   City in DB:', loc?.city || 'NULL', loc?.city === 'Aarhus' ? '✅' : '❌')
  
  // 2. Generate test post
  console.log('\nSTEP 2: Generate Post')
  const { data: post, error } = await window.supabase.functions.invoke('ai-generate-from-strategy', {
    body: {
      business_id: '840347de-9ba7-4275-8aa3-4553417fc2af',
      idea_id: 3,
      content_type: 'menu_item',
      platforms: ['instagram']
    }
  })
  
  if (error) {
    console.error('   ❌ Generation failed:', error)
    return
  }
  
  // 3. Analyze hashtags
  console.log('\nSTEP 3: Hashtag Analysis')
  const hasKbh = post.hashtags?.some(t => /københavn|kbh/i.test(t))
  const hasAarhus = post.hashtags?.some(t => /aarhus/i.test(t))
  
  console.log('   Hashtags:', post.hashtags?.join(', '))
  console.log('   Has København:', hasKbh ? '❌ BUG!' : '✅ Good')
  console.log('   Has Aarhus:', hasAarhus ? '✅ Good' : '❌ Missing!')
  
  // 4. Final verdict
  console.log('\n🏁 VERDICT:')
  if (!hasKbh && hasAarhus) {
    console.log('   ✅✅✅ WORKING CORRECTLY!')
  } else if (hasKbh) {
    console.log('   🐛🐛🐛 BUG: København hashtags for Aarhus business')
  } else {
    console.log('   ⚠️  No location-specific hashtags')
  }
})()
```

### 2. **Quick Hashtag Check**
```javascript
// Just check hashtags quickly
(async () => {
  const { data } = await window.supabase.functions.invoke('ai-generate-from-strategy', {
    body: {
      business_id: '840347de-9ba7-4275-8aa3-4553417fc2af',
      idea_id: 3,
      content_type: 'menu_item',
      platforms: ['instagram']
    }
  })
  
  console.log('🏷️', data.hashtags?.join(', '))
  
  const bug = data.hashtags?.some(t => /københavn|kbh/i.test(t))
  console.log(bug ? '🐛 København hashtags (BUG!)' : '✅ No København hashtags')
})()
```

### 3. **Database Location Check**
```javascript
// Verify Café Faust location
(async () => {
  const { data } = await window.supabase
    .from('business_locations')
    .select('city, country, is_primary')
    .eq('business_id', '840347de-9ba7-4275-8aa3-4553417fc2af')
  
  console.log('📍 Café Faust Locations:', data)
  data?.forEach(loc => {
    console.log(`   ${loc.is_primary ? '⭐' : '  '} ${loc.city || 'NO CITY'}, ${loc.country}`)
  })
})()
```

---

## 🚨 Common Issues & Fixes

### **Issue 1: city is NULL in database**

**Fix:**
```javascript
// Update database
await window.supabase
  .from('business_locations')
  .update({ city: 'Aarhus' })
  .eq('business_id', '840347de-9ba7-4275-8aa3-4553417fc2af')

console.log('✅ Updated city to Aarhus')
```

### **Issue 2: Edge function not passing city**

**Check:** Are edge functions restarted?
- Stop Supabase: `supabase stop`
- Start again: `supabase start`
- Or just restart functions: `supabase functions serve --env-file supabase/.env.local`

### **Issue 3: Still getting København hashtags**

**Check default fallback:**
- File: `supabase/functions/_shared/ai-caption-generator/i18n-config.ts`
- Line 76: `defaultCity: 'København'`
- This is used when city is undefined

**Temporary fix:**
```typescript
// Change line 76 to:
defaultCity: 'Aarhus',  // Or better: null (forces error if city missing)
```

---

## ✅ Success Criteria

After testing all steps, you should have:

1. ✅ Database has city = 'Aarhus'
2. ✅ Edge function logs show city: "Aarhus"
3. ✅ Generated hashtags include #Aarhus
4. ✅ Generated hashtags do NOT include #København or #FoodieKbh
5. ✅ All posts generate successfully (status 200)
6. ✅ Text quality is good for both Facebook and Instagram
7. ✅ Emojis, CTA, and timing are appropriate

---

## 📝 Test Checklist

```
□ Step 1: Weekly strategy generates successfully
□ Step 2: Can select 3-5 ideas
□ Step 3: Posts generate for all selected ideas
□ Step 4: Database has correct city ('Aarhus')
□ Step 5: Edge function logs show correct city
□ Step 6: Hashtags are location-appropriate
□ Step 7: No København hashtags for Aarhus business
□ Step 8: Text quality is appropriate
□ Step 9: All required fields present (text, hashtags, emojis, CTA, time)
□ Step 10: Can edit posts before publishing
```

---

**Once all tests pass, the flow is rock solid!** Then we can look at frontend improvements.
