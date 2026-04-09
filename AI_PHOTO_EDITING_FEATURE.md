# AI Photo Editing Feature

## Overview

Smart and Pro tier users can select AI-generated improvement suggestions and have Gemini automatically apply them to their photo. Free tier users see analysis results but cannot apply edits (blocked at backend with 403).

---

## Architecture

### 1. Analysis Phase — `analyze-photo`

**Model:** `gemini-2.5-flash` (same for all tiers — differentiation is in prompt and suggestion cap)

**Output per suggestion:**
```typescript
interface Suggestion {
  id: string
  category: 'cropping' | 'cleaning' | 'color'
  title: string     // Max 60 chars
  reason: string    // Max 120 chars
  location: string  // Plain text, e.g. "top-left corner of the table"
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

Suggestion counts by tier: Free → 2, Smart → 4, Pro → 6.

### 2. Editing Phase — `edit-photo`

**Model:** `gemini-2.5-flash-image`

**Tier gate:** `tier === 'free'` → immediate `403` response. Smart and Pro proceed.

**Sequential pipeline:**
1. **Cleaning + Color pass** — inpainting and colour grading. `temperature: 0.3, topK: 40, topP: 0.9`

All crop actions (`crop_to_portrait_4_5`, `crop_to_square`, `crop_to_landscape_16_9`) are handled entirely **client-side via canvas** in `CreateStep.tsx` and never reach this endpoint.

**Request:**
```typescript
{
  imageUrl: string
  selectedSuggestions: Suggestion[]
  language?: string  // 'da' | 'en'
}
```

**Response:**
```typescript
{
  success: boolean
  editedImage: string   // base64 data URL: "data:image/jpeg;base64,..."
  appliedEdits: number
  message: string
}
```

---

## Frontend Integration

### `MediaAnalysisPanel` — `src/components/media/MediaAnalysisPanel.tsx`

- Multi-select checkbox cards grouped by category (Cropping / Cleaning / Color)
- "Anvend N forbedringer" batch-apply button appears when ≥1 card is selected
- Applied suggestions are locked (green) until the edited image is deleted
- **Smart:** up to 4 suggestion cards
- **Pro:** up to 6 suggestion cards
- **Prop for batch apply:** `onApplyBatch?: (selectedIds: string[]) => void`

### `AIAdjustmentControls` — `src/components/post-creation/design/AIAdjustmentControls.tsx` (Pro only)

Rendered in `CreateStep` only when `currentTier === 'premium'`. Provides:
- **Auto Enhance** — one-click button that calls `edit-photo` with auto-selected suggestions
- **Manual Controls (collapsible):**
  - Crop & Size: platform selector (Facebook / Instagram / Both) + focus mode dropdown
  - Photo Cleaning: checkboxes (background, objects, blemishes) + intensity slider
  - Color & Grading: temperature slider + quick presets (Natural / Vibrant / Muted / Custom)

This panel does **not** appear for Smart users — Smart users interact with photo enhancement exclusively through the AI suggestion cards in `MediaAnalysisPanel`.

### CreateStep flow — `src/components/post-creation/CreateStep.tsx`

1. User uploads photo → client detects `width`/`height` via `new Image()`
2. "Analyse"-button available for all tiers → calls `analyze-photo`
3. `MediaAnalysisPanel` renders with `tier` prop (controls display and card count)
4. User selects suggestion cards → `handleApplySelectedSuggestions` fires:
   - Canvas crops (`crop_to_portrait_4_5`, `crop_to_square`, `crop_to_landscape_16_9`) applied client-side first
   - Remaining AI suggestions (cleaning, color) sent to `edit-photo`
   - Resulting edited image uploaded to Supabase Storage if needed
4a. User clicks "Beskær" button → `CropOverlay` opens for free-form manual crop (drag handles + ratio presets)
5. On `403` from `edit-photo` → upgrade modal shown (`setShowUpgradeModal('photo-picker')`)
6. Pro users additionally see `AIAdjustmentControls` for manual control

---

## Tier Summary

| Feature | Free | Smart | Pro |
|---------|------|-------|-----|
| Analysis prompt | Simple (`buildSimplePrompt`) | Full (`buildPaidPrompt`) | Full (`buildPaidPrompt`) |
| Photo analysis display | Bullet list, max 2 hints | Full cards, max 4 | Full cards, max 6 |
| AI apply edits (Gemini) | Blocked (403) | Batch apply | Batch apply |
| Client-side canvas crops | Blocked (no apply button) | Yes | Yes |
| Manual `AIAdjustmentControls` | No | No | Yes |

**Panel layers (all tiers):**
- Layer 1 Assessment: always shown — `recommendation` + `recommendationText` + `generalFeedback`
- Layer 2 Human actions: conditional — only `contentMatch` (fair/poor), `emojiMatch`, `humanSuggestions` when present
- Layer 3 AI Enhancements: suggestion cards or explicit empty-state message per recommendation value

The Smart → Pro differentiation on photo editing comes from `AIAdjustmentControls` (Pro only), not from suggestion count alone.

---

## Deployment

```bash
cd "/Users/olebaek/Test P2G 1"
npx supabase functions deploy analyze-photo
npx supabase functions deploy edit-photo
```

Both functions **require JWT**. Do not deploy with `--no-verify-jwt`.

---

## Quota

Both `analyze-photo` and `edit-photo` count as one `aiGenerations` usage each. A full analyse + edit workflow costs 2 generations per photo.

---

**Last updated:** 20 March 2026

