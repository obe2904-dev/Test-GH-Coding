# AI Photo Analysis — Gemini 2.5 Flash Integration

## Overview

The AI Photo Analysis feature uses Google's Gemini 2.5 Flash model to analyse uploaded photos and provide actionable improvement feedback. Analysis is available to **all tiers** (Free, Smart, Pro), but the depth of output and the number of suggestions returned scale with the tier.

---

## Tier Differentiation

| Tier | Analysis level | Prompt | Max suggestions |
|------|---------------|--------|-----------------|
| Free (`free`) | `basic` | Simple (cost-efficient) | 2 |
| Smart (`standardplus`) | `advanced` | Full | 4 |
| Pro (`premium`) | `premium` | Full | 6 |

The analysis level is derived from the `tier` field in the request. Free tier uses `buildSimplePrompt`; Smart and Pro use `buildPaidPrompt`. The suggestion cap is enforced server-side before the response is returned.

**Note:** The Gemini model itself (`gemini-2.5-flash`) is the same for all tiers. Differentiation is in prompt complexity and suggestion volume.

---

## Backend (Supabase Edge Function)

**Location:** `supabase/functions/analyze-photo/index.ts`

**Authentication:** Requires a valid Supabase JWT in the `Authorization` header. Returns `401` if absent or invalid.

**Quota:** Each analysis call counts as one `aiGenerations` usage. Daily limits: Free 100, Smart 100 (monthly 1000), Pro unlimited. Returns `429` if limit is exceeded.

**Request:**
```typescript
{
  imageUrl: string          // Publicly accessible URL of the image
  postText?: string         // Optional post caption for content-match scoring
  businessType?: string     // Optional business type (café, restaurant, etc.)
  language?: string         // 'da' | 'en', default: 'da'
  tier?: 'free' | 'standardplus' | 'premium'  // Defaults to quota-resolved tier
  mediaType?: 'image' | 'video'               // Default: 'image'
  duration?: number         // Video duration in seconds (videos > 30s are rejected)
  imageWidth?: number       // Client-detected pixel width (preferred over server parsing)
  imageHeight?: number      // Client-detected pixel height
}
```

**Response:**
```typescript
{
  contentMatch: {
    rating: 'excellent' | 'good' | 'fair' | 'poor'
    feedback: string        // Short explanation of the match
  }
  emojiMatch: string | null // Whether emojis in post text match the photo mood
  whatWorks: string[]       // Positive observations (empty [] on error)
  generalFeedback: string   // Overall assessment — positive frame only; sub-threshold problems are silently dropped
  suggestions: Suggestion[] // AI-executable improvement cards — 0 to tier-cap items
  humanSuggestions: HumanSuggestion[] // Named ingredient/item mismatches the human should address next time ([] when no mismatch)
  recommendation: 'post-it' | 'good-enough' | 'quick-fix' | 'retake'
  recommendationText: string
  platformNote?: string     // Optional platform-specific note (e.g. crop warning)
}

interface HumanSuggestion {
  text: string  // Short note: "The text mentions X but it's not visible in the image."
}

interface Suggestion {
  id: string
  category: 'cropping' | 'cleaning' | 'color'
  title: string            // Short label (max 60 chars)
  reason: string           // Why this matters (max 120 chars)
  location: string         // Plain-text description of where the issue is
  action:
    | 'crop_to_square'
    | 'crop_to_portrait_4_5'
    | 'crop_to_landscape_16_9'
    | 'remove_object'
    | 'reduce_clutter'
    | 'reduce_smudge'
    | 'adjust_temperature_warm'
    | 'adjust_temperature_cool'
    | 'fix_exposure'
}
```

**Gemini configuration:**
```typescript
generationConfig: {
  temperature: 0.4,
  topK: 40,
  topP: 0.95,
  maxOutputTokens: 4000,
  responseMimeType: 'application/json'
}
```

**Size limits:** images 4 MB max, videos 10 MB max.

---

## Frontend Hook

**Location:** `src/hooks/usePhotoAnalysis.ts`

```typescript
const { analyzePhoto, isAnalyzing, error } = usePhotoAnalysis()

const result = await analyzePhoto(
  imageUrl,
  postText,
  businessType,
  language,
  tier,
  mediaType,
  duration,
  imageWidth,
  imageHeight
)
```

---

## Frontend Display — `MediaAnalysisPanel`

**Location:** `src/components/media/MediaAnalysisPanel.tsx`

Always shown (all tiers): content match rating, emoji match callout, "what works" highlights, "remember for next time" (`humanSuggestions`) amber section (when non-empty), general feedback.

| Tier | Suggestions display |
|------|--------------------|
| Free | Plain bullet list — title + reason text only. No action buttons. Upgrade banner shown. |
| Smart | Interactive checkbox cards grouped by category. Batch-apply button when ≥1 selected. Max 4 cards. |
| Pro | Same checkbox cards as Smart. Max 6 cards. Plus `AIAdjustmentControls` manual panel. |
**Note:** `contentMatch` is only surfaced in the human-actions layer when rating is `fair` or `poor`. Excellent/good matches are not shown — they require no action from the user.
**Panel structure — three layers:**

1. **Assessment** (always shown): `recommendation` badge + `recommendationText` as headline, followed by `generalFeedback`. This layer closes the loop — `post-it` and `good-enough` are complete answers, not preludes to a list of problems.
2. **Til dig / For you** (only shown when there is something actionable for the human): `contentMatch` (only when rating is `fair` or `poor`), `emojiMatch` (only when non-null), `humanSuggestions` (only when non-empty). The entire layer is hidden when all conditions are absent.
3. **AI Forbedringer / AI Enhancements** (always shown): suggestion cards when present; explicit empty-state message when `suggestions` is empty, worded per `recommendation` value so the user always understands why there are no cards. A subline beneath the heading states: "AI kan fjerne, justere og rette — aldrig tilføje" — setting the expectation that AI enhancement preserves authenticity.

**Empty-state messages per recommendation:**
- `post-it`: "Billedet er klar til opslag — ingen AI-forbedringer nødvendige."
- `good-enough`: "Billedet ser godt ud. Ingen AI-justeringer ville gøre en meningsfuld forskel."
- `retake`: "Problemerne her (lys, fokus, komposition) kan ikke rettes af AI. Et nyt billede er den bedste løsning."
- `video`: "AI-forbedringer er ikke tilgængelige for video."

**Analysis persistence:** Results are stored on the `MediaItem` in `postCreationStore` (field `analysisResult`). Switching between photos keeps each photo's result alive. The "Skjul Analyse" button has been removed — results are always visible once run. The analyse button label changes to "Analyser Igen" when a result already exists.

---

## Configuration

**API key:** Read from Supabase Secrets — `Deno.env.get('GEMINI_API_KEY')`. Never hardcoded.

```bash
supabase secrets set GEMINI_API_KEY=your_key --project-ref <project-ref>
```

**Prompt override (no redeploy needed):**
```bash
supabase secrets set PROMPT_VERSION=simple --project-ref <project-ref>
```
Setting `PROMPT_VERSION=simple` forces `buildSimplePrompt` for all tiers (useful for cost testing).

---

## Deployment

```bash
cd "/Users/olebaek/Test P2G 1"
npx supabase functions deploy analyze-photo
```

The function **requires JWT** — do not deploy with `--no-verify-jwt`.

---

## Testing

```bash
# Requires a valid user JWT
curl -X POST https://<project-ref>.supabase.co/functions/v1/analyze-photo \
  -H "Authorization: Bearer <user-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"imageUrl": "https://example.com/photo.jpg", "postText": "Nyd en kop kaffe", "language": "da", "tier": "premium"}'
```

---

**Last updated:** 20 March 2026

3. **Rate Limits**: Gemini has rate limits (check current quotas)
4. **Language**: Currently supports Danish and English

## Future Enhancements

- [ ] Add support for more languages
- [ ] Implement image cropping suggestions with coordinates
- [ ] Add A/B testing recommendations
- [ ] Platform-specific optimization tips (FB vs IG)
- [ ] Historical analysis comparison
- [ ] Automated improvements application
- [ ] Batch analysis for multiple photos
- [ ] Analytics on photo performance vs analysis scores

## Troubleshooting

### Common Issues

**"Failed to fetch image"**
- Ensure image URL is publicly accessible
- Check for CORS restrictions
- Verify URL is complete and valid

**"Gemini API request failed: 400"**
- Check API key is valid
- Verify image format is supported (JPEG, PNG, WebP)
- Ensure image size is under 20MB

**"Failed to parse analysis result"**
- Gemini response might not be in expected JSON format
- Check logs for raw response
- Consider adjusting temperature/prompts for more consistent output

**Rate Limiting**
- Implement request queuing
- Add exponential backoff retry logic
- Consider upgrading Gemini API tier

## Security Notes

1. **API Key Protection**: Never expose API key in client-side code
2. **Input Validation**: Validate image URLs to prevent SSRF attacks
3. **Rate Limiting**: Implement per-user rate limits to prevent abuse
4. **Content Filtering**: Consider adding content moderation
5. **Cost Controls**: Set budget alerts in Google Cloud Console

## Deployment

Function is already deployed to:
```
https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/analyze-photo
```

To redeploy after changes:
```bash
cd "/Users/olebaek/Test GH Coding"
supabase functions deploy analyze-photo --project-ref kvqdkohdpvmdylqgujpn --no-verify-jwt
```

## Support

For issues or questions:
1. Check Supabase function logs in Dashboard
2. Review Gemini API documentation: https://ai.google.dev/docs
3. Check Google Cloud Console for API usage and errors
