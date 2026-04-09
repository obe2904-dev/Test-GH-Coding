# AI Generate V2 - Architecture & Usage

**Status**: ✅ Deployed and ready for testing  
**Function**: `ai-generate-v2`  
**Tier Requirement**: Smart, StandardPlus, or Premium (not Free)  
**Model**: GPT-4o  

## Architecture Overview

```
ai-generate-v2/
├── index.ts                           # Main HTTP handler & orchestration
├── types.ts                           # TypeScript interfaces
├── data-sources/
│   ├── business-profile.ts            # Fetch from business_profile table
│   ├── menu.ts                        # Fetch from menu_categories + menu_items
│   ├── weather.ts                     # OpenWeather API integration
│   ├── previous-posts.ts              # Learn from post_drafts (status='published')
│   └── index.ts                       # Module exports
├── generators/
│   ├── prompt-builder.ts              # Context-aware prompt assembly
│   └── smart-generator.ts             # GPT-4o generation logic
└── validators/
    ├── content-validator.ts           # Quality validation
    └── index.ts                       # Module exports
```

## Key Features

### 1. Modular Data Sources
- **Business Profile**: Brand voice, tone, offerings, content pillars
- **Menu Items**: Categories with analysis (morning/lunch/dinner/cocktail/kids)
- **Weather**: Real-time via OpenWeather API (requires OPENWEATHER_API_KEY env var)
- **Previous Posts**: Learns from last 10 published posts

### 2. Language Compliance
Built-in understanding of:
- **Danish**: Hygge, understated tone, informal "du", specific idioms
- **Swedish**: Lagom mentality, fika culture, reserved style
- **German**: Sie/Du formality, precision, Gemütlichkeit, compound words

### 3. Intelligent Diversity
Generates 3 suggestions that are substantively different:
- Suggestion 1: Product/service focused with emotional appeal
- Suggestion 2: Lifestyle/experience broader appeal
- Suggestion 3: Timely/seasonal angle

### 4. Context-Aware Generation
Considers:
- Current weather conditions
- Season and date
- Time of day
- Available menu categories
- Brand voice and style
- Previous successful posts

### 5. Fail-Fast Validation
Validates:
- Required fields present
- Forbidden terms not used
- Menu items exist if referenced
- Language compliance (no English words in Danish text)
- Content diversity across suggestions
- Text length (20-500 characters)

## API Usage

### Endpoint
```
POST https://[project].supabase.co/functions/v1/ai-generate-v2
```

### Request
```json
{
  "user_id": "uuid-string",
  "business_id": "uuid-string (optional)",
  "count": 3,
  "userTier": "smart"
}
```

### Response (Success)
```json
{
  "suggestions": [
    {
      "headline": "Brief attention-grabbing title",
      "text": "Main post content in primary language",
      "photoSuggestion": "Detailed photo description",
      "bestTimeToPost": "12:00 - Lunchtime when audience active",
      "impact": "medium",
      "menuItemUsed": "BØF & BEARNAISE (FROKOST)"
    },
    // ... 2 more suggestions
  ],
  "metadata": {
    "model": "gpt-4o",
    "language": "da",
    "context_used": ["business_profile", "menu", "weather", "previous_posts"],
    "generated_at": "2026-01-06T17:30:00.000Z"
  }
}
```

### Response (Validation Error)
```json
{
  "error": "Generated content failed validation",
  "validationErrors": [
    {
      "field": "Suggestion 1.text",
      "message": "Contains forbidden term: \"soul-warming\"",
      "severity": "error"
    }
  ]
}
```

## Environment Variables Required

```
SUPABASE_URL=https://[project].supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=sk-...
OPENWEATHER_API_KEY=your-openweather-key (optional but recommended)
```

## Differences from V1 (ai-generate)

| Feature | V1 (ai-generate) | V2 (ai-generate-v2) |
|---------|------------------|---------------------|
| **Tiers** | Free + all paid | Smart/Pro only |
| **Model** | gpt-4o-mini (free), gpt-4o (paid) | GPT-4o only |
| **Architecture** | Monolithic (1623 lines) | Modular (9 files) |
| **Data Sources** | Frontend-provided prompt | Direct Supabase fetch + API calls |
| **Language** | Basic validation | Deep cultural compliance |
| **Weather** | Not integrated | OpenWeather API |
| **Learning** | No history | Learns from previous posts |
| **Validation** | 6 validators + 4 repairs | Focused fail-fast validation |
| **Diversity** | Repair-based forcing | Built into generation prompt |

## Testing Checklist

- [ ] **Tier enforcement**: Free tier users get 403 error
- [ ] **Business profile**: Loads correctly with all fields
- [ ] **Menu items**: Fetches and analyzes categories properly
- [ ] **Weather**: Gets current conditions (if city set)
- [ ] **Previous posts**: Learns from published posts
- [ ] **Language**: Danish content is native-sounding, no English words
- [ ] **Diversity**: 3 suggestions are substantively different
- [ ] **Menu usage**: At least 1-2 suggestions feature menu items
- [ ] **Validation**: Forbidden terms blocked, required fields present
- [ ] **Response format**: Matches expected JSON structure

## Next Steps

### Immediate
1. Test with real business account (Smart tier)
2. Verify weather API integration
3. Check language quality for Danish content
4. Validate menu category analysis

### Future Enhancements
1. Add retry logic for OpenAI rate limits
2. Implement caching for frequently-requested data
3. Add more language-specific validators (Swedish, German)
4. Track suggestion success rates
5. A/B test different generation strategies
6. Add image generation hints based on photoSuggestion

## Rollout Strategy

1. **Phase 1**: Deploy V2, keep V1 running (current state)
2. **Phase 2**: Test V2 with beta users (Smart tier volunteers)
3. **Phase 3**: Gradually migrate Smart tier to V2 via feature flag
4. **Phase 4**: V2 becomes default for Smart/Pro, V1 remains for Free tier
5. **Phase 5**: Monitor performance, iterate on feedback

## Maintenance

- **Log monitoring**: Check Supabase Functions logs for errors
- **OpenAI costs**: Track GPT-4o usage vs gpt-4o-mini
- **Weather API**: Monitor quota (OpenWeather free tier = 1000 calls/day)
- **Database**: Ensure business_profile, menu_categories have proper indexes
- **Performance**: Target < 5s response time for generation

---

**Built**: January 6, 2026  
**Deployed to**: kvqdkohdpvmdylqgujpn.supabase.co  
**Backup**: Original ai-generate function preserved
