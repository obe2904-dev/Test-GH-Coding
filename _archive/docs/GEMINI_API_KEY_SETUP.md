# Gemini API Key Environment Variable Setup

## ⚠️ CRITICAL: Set Environment Variable

The `analyze-photo` Edge Function now uses an environment variable for the Gemini API key (secure approach).

### Steps to Complete Setup:

1. **Go to Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard/project/kvqdkohdpvmdylqgujpn/settings/functions

2. **Add Environment Variable**
   - Click "Add new secret"
   - Name: `GEMINI_API_KEY`
   - Value: `AIzaSyBYxwYfj5Dp58pNpTQ0lvLgAUEegRRiwGE`
   - Click "Save"

3. **Redeploy Function** (optional, but recommended)
   ```bash
   npx supabase functions deploy analyze-photo
   ```

### Security Improvement

✅ **Before**: API key was hardcoded in the function code (security risk, visible in git)
✅ **After**: API key stored securely as environment variable (not in code, not in git)

### Testing

After setting the environment variable, test the photo analysis feature:
- Upload a photo in the Create Post flow
- Verify the AI analysis works correctly
- Check that quickTips and improvementCategories are now populated

---

## What Changed in This Deployment

### 1. **Explicit "Only Suggestions" Language**
   - Added clear rules: "Du beskriver KUN billedet og mulige forbedringer – du REDIGERER ikke billedet"
   - Prevents AI from saying "we edited" or "the image will be"
   - Uses phrasing like "du kan..." instead of "vi har..."

### 2. **QuickTips & ImprovementCategories Now Used**
   - Previously these fields were always empty
   - Now AI provides 2-4 short, actionable tips
   - Categories help users see at a glance what needs work (lighting, composition, etc.)

### 3. **Authenticity / "Nænsomme Forbedringer" Philosophy**
   - Added rule: "Dine forslag skal være nænsomme og realistiske"
   - No crazy filters, no artificial elements, no major manipulations
   - Just realistic clean-up & light adjustments

### 4. **API Key Security**
   - Moved from hardcoded string to environment variable
   - Must be set in Supabase dashboard (see steps above)

---

## Frontend Updates Needed

The frontend (`CreateStep.tsx`) should be updated to display the new fields:

### Display QuickTips
```tsx
{analysis.quickTips && analysis.quickTips.length > 0 && (
  <div className="mt-4">
    <h4 className="font-medium mb-2">Hurtige Tips:</h4>
    <ul className="list-disc list-inside space-y-1">
      {analysis.quickTips.map((tip, index) => (
        <li key={index} className="text-sm">{tip}</li>
      ))}
    </ul>
  </div>
)}
```

### Display ImprovementCategories as Chips/Badges
```tsx
{analysis.improvementCategories && analysis.improvementCategories.length > 0 && (
  <div className="mt-4">
    <h4 className="font-medium mb-2">Fokusområder:</h4>
    <div className="flex gap-2 flex-wrap">
      {analysis.improvementCategories.map((category, index) => (
        <span key={index} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
          {category === 'lighting' ? 'Lys' : 
           category === 'composition' ? 'Komposition' : 
           category === 'background' ? 'Baggrund' : 
           category === 'contrast' ? 'Kontrast' : category}
        </span>
      ))}
    </div>
  </div>
)}
```

### TypeScript Type Safety (Recommended)
Consider using a discriminated union for the response:

```typescript
interface AnalysisResultFree {
  tier: 'free'
  overallFeedback: string
  quickTips: string[]
  improvementCategories?: ('lighting' | 'composition' | 'background' | 'contrast')[]
}

interface AnalysisResultPaid {
  tier: 'standardplus' | 'premium'
  contentMatch: { ... }
  suggestions: { ... }
  improvements: { ... }
  overallScore: number
}

type AnalysisResult = AnalysisResultFree | AnalysisResultPaid
```

Then check:
```typescript
if (result.tier === 'free') {
  // TypeScript knows result has overallFeedback, quickTips, etc.
} else {
  // TypeScript knows result has contentMatch, overallScore, etc.
}
```
