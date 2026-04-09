# Make.com Setup Guide

## Overview

Make.com provides the AI workflows for Post2Grow. You'll need to create 3 scenarios (workflows) and configure their webhook URLs.

---

## 🚀 Quick Setup

### 1. Create Make.com Account

1. Go to [make.com](https://www.make.com)
2. Sign up for a free account (1,000 operations/month)
3. Choose **EU region** (Frankfurt) for best performance

### 2. Create Your First Scenario: AI Content Generation

#### Step-by-Step:

1. **Create New Scenario**
   - Click "Create a new scenario"
   - Name it: "Post2Grow - AI Content Generation"

2. **Add Webhook Module**
   - Click the "+" button
   - Search for "Webhooks"
   - Select "Webhooks" → "Custom webhook"
   - Click "Create a webhook"
   - Name it: "AI Content Generate"
   - Click "Save"
   - **Copy the webhook URL** (looks like: `https://hook.eu1.make.com/xxxxx`)

3. **Add OpenAI Module**
   - Click "+" after the webhook
   - Search for "OpenAI"
   - Select "Create a Completion" (or "Create a Chat Completion" for GPT-4)
   - Connect your OpenAI account (you'll need an API key from openai.com)
   
4. **Configure OpenAI Prompt**
   ```
   You are a social media expert helping a {{1.businessType}} business.
   
   Topic: {{1.topic}}
   Platforms: {{1.platforms}}
   
   Generate 3 engaging social media post variations with:
   - Clear headline
   - Engaging copy with emojis
   - Relevant hashtags
   - Call-to-action
   
   Make it authentic and conversational for Danish audience.
   ```

5. **Add Response Module**
   - Click "+" after OpenAI
   - Search for "Webhook Response"
   - Select "Webhook Response"
   - Map the OpenAI output to the response

6. **Save & Activate**
   - Click "Save" (bottom right)
   - Toggle "Scheduling" to ON
   - Copy the webhook URL from step 2

7. **Add to .env**
   ```bash
   VITE_MAKE_WEBHOOK_AI_GENERATE=https://hook.eu1.make.com/xxxxx
   ```

---

### 3. Create Second Scenario: Publish to Social Media

#### Step-by-Step:

1. **Create New Scenario**
   - Name it: "Post2Grow - Social Media Publish"

2. **Add Webhook Module**
   - Add "Custom webhook"
   - Name it: "Publish Post"
   - **Copy the webhook URL**

3. **Add Router Module**
   - Click "+" after webhook
   - Search for "Router"
   - This will split the flow by platform

4. **Add Facebook Branch**
   - Click "+" on first router path
   - Search for "Facebook"
   - Select "Create a Page Post"
   - Connect your Facebook account
   - Map fields:
     - Page ID: `{{1.platforms.facebook.pageId}}`
     - Message: `{{1.content.text}}`
     - Upload media if present

5. **Add Instagram Branch**
   - Click "+" on second router path
   - Search for "Instagram"
   - Select "Create a Media Object Post"
   - Connect your Instagram Business account
   - Map fields accordingly

6. **Add Update Supabase Module**
   - Click "+" after the router (outside branches)
   - Search for "Supabase"
   - Select "Update a Row"
   - Connect to your Supabase project
   - Update the post status to "published"

7. **Save & Add to .env**
   ```bash
   VITE_MAKE_WEBHOOK_PUBLISH=https://hook.eu1.make.com/xxxxx
   ```

---

### 4. Create Third Scenario: AI Post Ideas

#### Step-by-Step:

1. **Create New Scenario**
   - Name it: "Post2Grow - AI Ideas Generation"

2. **Add Schedule Trigger**
   - Click "+" to start
   - Search for "Schedule"
   - Select "Schedule" → "Every day"
   - Set time: 6:00 AM

3. **Add Supabase Module**
   - Click "+"
   - Search for "Supabase"
   - Select "Search Rows"
   - Connect to your Supabase project
   - Table: `profiles`
   - Filter: `tier IN ('standardPlus', 'premium')`

4. **Add Iterator**
   - Click "+"
   - Search for "Iterator"
   - This will process each user

5. **Add OpenAI Module**
   - Generate post ideas based on:
     - Business type
     - Recent performance data
     - Calendar events
     - Weather (for Premium tier)

6. **Add Supabase Insert**
   - Insert generated ideas into `ai_ideas` table

7. **Save & Add to .env**
   ```bash
   VITE_MAKE_WEBHOOK_AI_IDEAS=https://hook.eu1.make.com/xxxxx
   ```

---

## 🧪 Testing Your Scenarios

### Test AI Content Generation

```typescript
// In browser console:
const response = await fetch('YOUR_WEBHOOK_URL', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'test-user',
    topic: 'summer cocktail special',
    businessType: 'cafe',
    platforms: ['facebook', 'instagram']
  })
})

const data = await response.json()
console.log(data)
```

### Test in Make.com

1. Open your scenario
2. Click "Run once" (bottom left)
3. Trigger the webhook from your app
4. Watch the modules execute in real-time
5. Check for errors in the execution history

---

## 📊 Cost Estimation

### Make.com Operations:

- **AI Content Generation**: ~3 operations per request
- **Publish Post**: ~5 operations per post
- **AI Ideas**: ~15 operations per user per day

### Recommended Plans:

- **Free**: 1,000 ops/month → ~30 AI generations + 50 posts
- **Core** ($9/month): 10,000 ops → Good for 100-200 posts/month
- **Pro** ($16/month): 10,000 ops + premium apps → Best for scaling

---

## 🔧 Troubleshooting

### Webhook Not Working?

1. **Check URL in .env**
   - Must start with `https://hook.eu1.make.com/`
   - No typos or extra spaces

2. **Verify Scenario is Active**
   - Toggle must be ON in Make.com
   - Check "Scheduling" section

3. **Check Execution History**
   - Make.com Dashboard → Scenarios → Select scenario
   - View "History" tab for errors

### OpenAI Errors?

1. **API Key Valid?**
   - Check openai.com for account status
   - Ensure you have credits

2. **Rate Limits?**
   - OpenAI has rate limits on free tier
   - Upgrade or add delays between requests

---

## 🎯 Next Steps

1. ✅ Set up all 3 scenarios
2. ✅ Add webhook URLs to `.env`
3. ✅ Restart your dev server (`npm run dev`)
4. ✅ Check browser console for confirmation
5. ✅ Test AI generation from GenerateStep
6. ✅ Test post publishing from PublishStep

---

## 📚 Resources

- **Make.com Academy**: https://www.make.com/en/academy
- **Make.com Templates**: https://www.make.com/en/templates
- **OpenAI API Docs**: https://platform.openai.com/docs
- **Facebook Graph API**: https://developers.facebook.com/docs/graph-api
- **Instagram API**: https://developers.facebook.com/docs/instagram-api

---

**Need Help?** Check Make.com's excellent documentation or community forums!
