# Test AI Hashtags from Browser Console

Since your local Supabase might not have the business data, test directly from your **production app browser console** where it's working.

## 🎯 Quick Test (30 seconds)

1. **Open your app** in browser at `http://localhost:3000`
2. **Open DevTools** (F12 or Cmd+Option+I)
3. **Go to Console tab**
4. **Paste this code:**

```javascript
// Quick hashtag test
(async () => {
  console.log('🧪 Testing AI Hashtags for Aarhus...')
  
  const { data, error } = await window.supabase.functions.invoke('ai-generate-from-strategy', {
    body: {
      business_id: '840347de-9ba7-4275-8aa3-4553417fc2af',
      idea_id: 3,
      idea_title: 'En ægte klassiker: Pariserbøf',
      idea_description: 'Weekend comfort food',
      content_type: 'menu_item',
      platforms: ['instagram']
    }
  })
  
  if (error) {
    console.error('❌ Error:', error)
    return
  }
  
  console.log('\n📊 RESULTS:\n')
  console.log('Text:', data.text?.substring(0, 100) + '...')
  console.log('\n🏷️ HASHTAGS:')
  
  (data.hashtags || []).forEach(tag => {
    const emoji = tag.toLowerCase().includes('kbh') || tag.toLowerCase().includes('københavn') 
      ? '❌ WRONG CITY' 
      : tag.toLowerCase().includes('aarhus')
      ? '✅ CORRECT'
      : '  '
    console.log(`   ${emoji} #${tag}`)
  })
  
  const hasKbh = data.hashtags?.some(t => t.toLowerCase().includes('kbh') || t.toLowerCase().includes('københavn'))
  const hasAarhus = data.hashtags?.some(t => t.toLowerCase().includes('aarhus'))
  
  console.log('\n🔍 DIAGNOSIS:')
  console.log('   København tags:', hasKbh ? '🐛 YES (BUG!)' : '✅ No')
  console.log('   Aarhus tags:', hasAarhus ? '✅ Yes' : '❌ No')
})()
```

5. **Press Enter** and check results

---

## 📋 What to Look For:

### ✅ **CORRECT** (Fixed):
```
🏷️ HASHTAGS:
   ✅ CORRECT #Aarhus
   ✅ CORRECT #MadAarhus
      #DanskMad
      #Hygge
```

### ❌ **BUG** (Not Fixed):
```
🏷️ HASHTAGS:
   ❌ WRONG CITY #København
   ❌ WRONG CITY #FoodieKbh
      #DanskMad
      #Hygge
```

---

## 🔧 If You See the Bug:

The city parameter isn't reaching the AI. Check:

1. **Database:** Is city set to 'Aarhus'?
   ```sql
   SELECT city FROM business_locations 
   WHERE business_id = '840347de-9ba7-4275-8aa3-4553417fc2af';
   ```

2. **Edge Function Logs:** Check Supabase terminal for:
   ```
   [ai-generate-from-strategy] Context built: {
     city: undefined  ← Problem!
   }
   ```

3. **Fix Options:**
   - Update database city value
   - Restart Supabase functions
   - Clear any caching

---

## 🎯 Alternative: Copy Working Request

From your browser Network tab:

1. Regenerate the post
2. Find the `ai-generate-from-strategy` request
3. Right-click → Copy as cURL
4. Run in terminal to see server logs
5. Check logs for `city` value

---

This bypasses all local setup issues and tests directly against your working environment!
