# AI Generate v3 — 3-Idea Engine Spec

## Purpose
Build a new, incremental 3-idea generation engine (`ai-generate-v3`) that uses Setup data (Content Style, structured menus, operations, location intelligence) to produce three business-specific post ideas. Keep `ai-generate-v2` unchanged and available as fallback.

## High-level goals
- Produce 3 distinct, non-hallucinated ideas per request.
- Each idea: short caption (<=140 chars), CTA suggestion, suggested image direction, referenced menu item(s) if available.
- Respect saved Content Style (`business_brand_profile.business_voice`) and emoji guidance from `business_visual_identity` when present.
- Fail-safe: if required data missing, fall back gracefully and annotate missing pieces in returned metadata.

## Inputs (required/requested)
- `business_id` (UUID) — required
- `count` — optional (default 3); engine will produce exactly 3 for MVP
- `user_tier` / `requester_id` — optional for tier-based capabilities/limits

## Data Sources (prioritized)
1. `menu_results_v2` (structured_data) — preferred source of menu items (categories, items, price). Use latest `status='done'` rows for `business_id`.
2. `menu_extractions` — legacy fallback.
3. `business_brand_profile` — `business_voice` (tone), `booking_link`, `core_offerings`.
4. `business_visual_identity` — `platform_visuals` (instagram/facebook) → `content_style`, emoji guidance, color hints.
5. `business_operations` — `price_level`, `average_check_per_person`, service flags (takeaway/delivery/table service).
6. `business_profile` / `business_locations` / `business_location_intelligence` — optional contextual fields (area_type, category_scores) for advanced iterations.

If a table is absent or empty, record that as metadata and use a safe fallback (see Fallbacks).

## Fallback Mapping
- If `business_visual_identity` missing, use `business_brand_profile.business_voice` for tone and a deterministic emoji set per voice.
- If no menu rows exist, generate ideas using `core_offerings` or `business_profile.long_description` and mark `menu_used: false` in metadata.

## Output Schema (JSON)
{
  "ideas": [
    {
      "id": "uuid",
      "caption": "string (<=140 chars)",
      "cta": "string (short)",
      "image_direction": "string (1-2 sentences)",
      "menu_refs": [{ "category": "", "item": "", "price": number | null }],
      "tone": "friendly|formal|professional|casual",
      "confidence": number (0..1)
    }
  ],
  "metadata": {
    "used_menu_source": "menu_results_v2|menu_extractions|none",
    "visual_identity_present": true|false,
    "brand_voice": "friendly|...",
    "validation": { "hallucination_warnings": [], "language_leakage": [] }
  }
}

## Prompting strategy (MVP)
- System prompt: agent role, safety rules, Do not invent menu items; if referencing menu item ensure exact match or use generic phrasing.
- User prompt: include concise context block (brand voice, top 5 menu items with category/name/price, price_level, location area_type if present, request: produce 3 ideas with specified fields).

### System prompt (example)
You are a creative assistant that writes social media post suggestions for small hospitality businesses. Always follow these rules:
- Do NOT invent menu items. Only reference items provided in the MENU block. If no menu items are present, write ideas using generic offering phrasing (e.g., "our signature dish").
- Keep captions ≤140 characters. Provide a short CTA and a one-line image direction.
- Match the `VOICE` provided. Use emojis only if visual guidance allows it.
- Avoid internal or model tokens leaking (no explanations of process in the caption).

### User prompt (example)
BUSINESS: {name}
VOICE: {business_voice}
PRICE_LEVEL: {price_level}
MENU (top 5 items):
- [Category] Item name — price
...
TASK: Produce exactly 3 post ideas. For each idea return: caption, cta, image_direction, menu_refs (empty if not referencing item). Prefer variety across ideas (timing/angle/CTA). Validate menu references exist.

## Validation rules
- Reject any idea that references an item not present in the MENU block.
- Enforce caption length ≤140 chars; truncate and flag if model returns longer.
- Detect non-local-language leakage (e.g., English vs Danish) and flag.

## Acceptance criteria (MVP)
- For a business with at least one menu item and a saved `business_voice`, generated output uses that voice and references actual menu items in at least one of the three ideas.
- Exactly 3 ideas returned, all pass validation rules, and `metadata.validation` is empty.
- If menu empty, `metadata.used_menu_source: none` and captions use generic offering phrasing.

## API/Deployment notes
- Implement as a new Edge Function `ai-generate-v3` under `supabase/functions/`.
- Expose same HTTP contract as v2. Add query param or header `X-AI-ENGINE: v3` and a feature-flag in the DB or environment to enable v3 per business or globally.
- Keep v2 as fallback: if v3 returns validation warnings or confidence < 0.4, orchestrator should call v2 and return v2 response (log both).

## Testing
- Unit tests for prompt-builder: ensure menu->prompt formatting, voice injection, and sanitization.
- Strategy-engine tests: deterministic mapping from top menu items to idea slots.
- Integration: mock DB payloads for three cases: (A) full menu + visual identity + brand voice, (B) menu missing but brand voice present, (C) everything missing — ensure correct fallbacks.

## Rollout plan
1. Implement and test locally with mocks. 2. Deploy `ai-generate-v3` to staging and enable feature-flag for test accounts. 3. Run E2E with sample businesses; compare v2 and v3 outputs — measure hallucination rate, user-selected idea rate. 4. Gradually enable per-business with monitoring and quick rollback to v2.

---

## Initial prompt template (MVP)

SYSTEM:
You are a helpful copywriter for hospitality social posts. Follow the safety rules: never invent menu items; limit caption to 140 characters; prefer concise CTAs (e.g., "Book now", "Reserve", "Order online").

USER (context + task):
BUSINESS: {business_name}
VOICE: {business_voice}
PRICE_LEVEL: {price_level}
MENU:
{menu_lines}

TASK: Create exactly 3 post ideas. For each idea output JSON with fields: caption, cta, image_direction, menu_refs (array). Menu_refs MUST reference items from MENU (exact names). Use emojis according to visual guidance if available.

Return only JSON matching the Output Schema.

---

## Next steps (immediately)
- Review and confirm acceptance criteria and required fields. If confirmed, I will implement the `prompt-builder` module and a minimal `strategy-engine` that picks top 3 diverse angles from the menu.

