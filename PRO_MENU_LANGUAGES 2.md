# Pro Feature: Multi-Language Menu Support

## What it does
Smart tier businesses only receive dishes from their local-language menus (e.g. Danish menus for a Danish business).  
Pro tier businesses can enable additional languages (e.g. their English tourist menu), so posts can feature dishes from all enabled menus.

---

## How it works

**Column**: `business_operations.enabled_menu_languages TEXT[] DEFAULT NULL`

| Value | Behavior |
|---|---|
| `NULL` (default) | Smart: local language only (derived from country code) |
| `['da', 'en']` | Pro: Danish + English menus both included |
| `['da', 'en', 'de']` | Pro: Danish + English + German menus included |

Language codes follow ISO 639-1 (same as `menu_results_v2.language_code`).

The filter runs in both `get-weekly-strategy` and `generate-weekly-plan` against `menu_items_normalized.menu_result_id → menu_results_v2.language_code`.  
Rows with no `language_code` are always treated as local (legacy data).

---

## To enable for a Pro business

### Via SQL (Supabase dashboard or migration):
```sql
UPDATE business_operations
SET enabled_menu_languages = ARRAY['da', 'en']
WHERE business_id = '<business_uuid>';
```

### Via Supabase JS client:
```ts
await supabase
  .from('business_operations')
  .update({ enabled_menu_languages: ['da', 'en'] })
  .eq('business_id', businessId);
```

---

## To build the frontend toggle (future)

1. **Detect available languages** for the business:
```ts
const { data } = await supabase
  .from('menu_results_v2')
  .select('language_code')
  .eq('business_id', businessId)
  .eq('status', 'done');

const available = [...new Set(data.map(r => r.language_code).filter(Boolean))];
// e.g. ['da', 'en']
```

2. **Show a toggle per language** in business settings, gated behind `subscription_tier === 'pro'`.

3. **On save**, write the selected array to `business_operations.enabled_menu_languages`.  
   Set to `NULL` to revert to Smart default (local only).

---

## Country → default language mapping

| Country code | Default language |
|---|---|
| DK | da |
| NO | no |
| SE | sv |
| FI | fi |
| IS | is |
| DE | de |
| FR | fr |
| ES | es |
| IT | it |
| NL | nl |
