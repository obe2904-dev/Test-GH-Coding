# AI Photo Analysis - Gemini 2.0 Flash Integration

## Overview

The AI Photo Analysis feature uses Google's Gemini 2.0 Flash model to analyze uploaded photos and provide actionable feedback for improving social media post engagement.

## Implementation

### Backend (Supabase Edge Function)

**Location:** `supabase/functions/analyze-photo/index.ts`

**API Endpoint:** `https://[project-ref].supabase.co/functions/v1/analyze-photo`

**Request Format:**
```typescript
{
  imageUrl: string         // URL of the image to analyze (must be publicly accessible)
  postText?: string        // Optional: Post content for context matching
  businessType?: string    // Optional: Type of business (café, restaurant, etc.)
  language?: string        // 'da' (Danish) or 'en' (English), default: 'da'
}
```

**Response Format:**
```typescript
{
  contentMatch: {
    score: number          // 0-100
    rating: 'excellent' | 'good' | 'fair' | 'poor'
    feedback: string       // Brief explanation
  },
  suggestions: {
    composition: string[]  // Composition tips
    lighting: string[]     // Lighting improvements
    styling: string[]      // Styling suggestions
    subject: string[]      // Subject focus tips
  },
  improvements: Array<{
    category: 'crop' | 'lighting' | 'color' | 'cleanup'
    title: string
    description: string
    impact: 'high' | 'medium' | 'low'
  }>,
  overallScore: number     // 0-100
}
```

### Frontend Hook

**Location:** `src/hooks/usePhotoAnalysis.ts`

**Usage:**
```typescript
import { usePhotoAnalysis } from '../hooks/usePhotoAnalysis'

function MyComponent() {
  const { analyzePhoto, isAnalyzing, error } = usePhotoAnalysis()

  const handleAnalyze = async () => {
    const result = await analyzePhoto(
      imageUrl,
      'Post text here',
      'Café',
      'da'
    )
    
    if (result) {
      console.log('Analysis:', result)
    }
  }

  return (
    <button onClick={handleAnalyze} disabled={isAnalyzing}>
      {isAnalyzing ? 'Analyzing...' : 'Analyze Photo'}
    </button>
  )
}
```

### Integration in CreateStep

The photo analysis is integrated into the `CreateStep` component (`src/components/post-creation/CreateStep.tsx`):

1. **Analyze Button**: Available for all tiers when a photo is uploaded
2. **Analysis Results**: Displays content match score, overall score, and improvement suggestions
3. **Visual Feedback**: Color-coded ratings and impact levels

## Configuration

### Gemini API Key

The API key is currently hardcoded in the Edge Function for quick setup:

```typescript
const GEMINI_API_KEY = 'AIzaSyBYxwYfj5Dp58pNpTQ0lvLgAUEegRRiwGE'
```

**Production Recommendation:** Move this to Supabase Secrets:

```bash
# Set secret
supabase secrets set GEMINI_API_KEY=your_api_key_here --project-ref kvqdkohdpvmdylqgujpn

# Update function to read from environment
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
```

### Model Configuration

**Current Model:** `gemini-2.0-flash-exp` (experimental)

**Configuration:**
```typescript
generationConfig: {
  temperature: 0.7,      // Balanced creativity/consistency
  topK: 40,              // Token selection diversity
  topP: 0.95,            // Cumulative probability cutoff
  maxOutputTokens: 2048  // Response length limit
}
```

## Features

### Content Matching
- Analyzes how well the image matches the post text
- Provides a score (0-100) and rating (excellent/good/fair/poor)
- Gives specific feedback on alignment

### Composition Analysis
- Rule of thirds evaluation
- Subject placement
- Frame balance
- Visual hierarchy

### Lighting Assessment
- Exposure levels
- Shadow/highlight balance
- Natural vs artificial lighting
- Mood appropriateness

### Styling Suggestions
- Color palette
- Mood and atmosphere
- Brand consistency
- Platform-specific optimizations

### Subject Focus
- Main subject clarity
- Distracting elements
- Background clutter
- Focus points

## Testing

### Test the Edge Function Directly

```bash
curl -X POST https://kvqdkohdpvmdylqgujpn.supabase.co/functions/v1/analyze-photo \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrl": "https://example.com/photo.jpg",
    "postText": "Nyd en kop kaffe hos os i dag",
    "language": "da"
  }'
```

### Test in Browser Console

```javascript
const { data, error } = await window.supabase.functions.invoke('analyze-photo', {
  body: {
    imageUrl: 'https://your-image-url.jpg',
    postText: 'Your post text',
    language: 'da'
  }
})
console.log('Result:', data)
console.log('Error:', error)
```

## Pricing

**Gemini 2.0 Flash Pricing (as of Dec 2024):**
- Input: $0.075 per 1M tokens
- Output: $0.30 per 1M tokens
- Images: Counted as ~258 tokens per image

**Estimated Cost per Analysis:**
- Image: ~258 tokens ($0.00002)
- Prompt: ~100 tokens ($0.000008)
- Response: ~500 tokens ($0.00015)
- **Total: ~$0.00018 per analysis**

For 1000 analyses/month: ~$0.18

## Limitations

1. **Image Accessibility**: Image URL must be publicly accessible
2. **File Size**: Gemini supports images up to 20MB
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
