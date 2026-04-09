# Brand Profile Generator — Changelog

## v4.13.0 (Cleanup — 12 mar 2026)
- **Removed**: A1/A2 split architecture (`USE_SPLIT_PROMPT_A` flag, `mergeA1A2ToLegacyAnalysis`, `prompt-a1-evidence.ts`, `prompt-a2-interpretation.ts`) — was never activated in production. Files archived in `_shared/brand-profile/_archive/`.
- **Removed**: `assertNoForbidden`, `UNIVERSAL_FORBIDDEN`, `CONDITIONAL_FORBIDDEN` — warn-only logging, never blocked generation, no practical effect.
- **Removed**: `proof-grounding.ts` — not called from production pipeline (test file only).
- **Moved**: Full changelog from `index.ts` file header to this file.

## v4.12.4
- FIX: Removed JSON-fixer chain + AI repair call from Prompt B (were untimed, 30-130s extra → wall-clock kill)
- FIX: Reduced Prompt B menu injection from 80+ items to 12 (saves ~1500 tokens → 10-20s faster)

## v4.12.3
- FIX: Prompt A model gpt-4o-mini→gpt-4o (mini took 47-60s, timed out at 55s). Budget: A(35)+B(50)=85s

## v4.12.2
- FIX: Removed hook repair retry (55s) — was causing 150s wall-clock kill. Budget: A(55)+B(50)=105s

## v4.12.1
- FIX: assertNoForbidden changed from hard throw to warn+continue (was crashing on "kvalitetsbevidst")
  _Note: assertNoForbidden removed entirely in v4.13.0 — warn-only, never blocked._

## v4.12.0
- FIX: Contract validator corpus now uses real `extractStructuredWebsiteData` (was stub returning [])
- FIX: Prompt A timeout increased 35s→55s (gpt-4o-mini takes 47-55s for this prompt)
- FIX: Contract validation after repair now fails-open (warns) instead of crashing with 500

## v4.11.8
- CRITICAL: Fixed `content_pillars` validation by extracting array values correctly
- Fallback `tone_model` derivation from `tone_of_voice.value` when AI `tone_model` fails sanitization
- Added `pickArrayValue()` helper to handle `content_pillars` extraction (fixes last validation error)
- `content_pillars` now correctly extracts from both direct arrays and `{value: array}` objects

## v4.11.7
- DEBUG: Added detailed logging for remaining hard errors

## v4.11.6
- CRITICAL: Fixed 8 hard errors by preserving proof arrays in `parseBrandProfileResponse()`

## v4.11.5
- Fixed: `primaryLanguage` undefined error (use `language.name`)

## v4.11.4
- Clarified proof rules to quote Danish evidence (not English labels from hooks)

## v4.11.3
- Updated Prompt B proof rules to forbid content trigger references (prevents translation corruption)
- Enforces verbatim quotes from source data only (no EN→DA re-translation)

## v4.11.2
- Added `content_triggers[].trigger` names to proof allowlist (e.g., "Waterfront Dining Experience")

## v4.11.1
- Expanded `buildAllowedProofTokens()` to include hook labels and usage occasion IDs (fixes proof grounding over-filtering)
- Added debug logging to verify proof token expansion is active

## v4.11.0 — A1/A2 Split Architecture _(never activated, removed v4.13.0)_
- Introduced A1/A2 split architecture controlled by `USE_SPLIT_PROMPT_A` env flag
- Flag defaulted to `false`; architecture was never deployed in production

## v4.7.3
- CRITICAL: `tone_model` DB constraint violation fix
- Added `sanitizeToneModelForDb()` to ensure DB-safe `tone_model` (never 500 on constraint violation)
- Improved error handling for `tone_model` DB constraints (return 422, not 500)
- Added runtime tests for `tone_model` sanitizer
- Retry save with `tone_model=null` if constraint violation occurs

## v4.7.2
- Fixed `tone_model.generated_at` hallucination (always override with current timestamp)
- Removed "indbydende" from `tone_of_voice` fallback (was causing validation errors)
- Added deterministic patch for `content_pillars` missing notes
- Hardcoded `tone_model.version="2.0"` and `source="website"` (never trust AI for metadata)

## v4.7.1
- Menu data reduced to business type only, timeout 45s→60s (fix Prompt A timeouts)

## v4.7.0
- Added source hashing, version_hash tracking, skip regeneration if unchanged

## v4.6.0
- Added `quality_status` computation and storage (green/yellow/red)

## v4.5.0
- Added `tone_of_voice` + `content_focus` fallbacks, complete field overwrites in repair

## v4.4.0
- Increased `max_tokens` 2000→3500, added explicit size limits (prevent truncation)

## v4.3.0
- Filter hooks by language (no English hooks in Danish content)

## v4.2.0
- Added country name→ISO code mapping, Danish waterfront phrase to generic locale

## v4.1.0
- Fixed locale resolution to use `location.city`, fixed fallback location phrases

## v4.0.0 — Phase 2
- Error Tracking, Multi-Locale, Robust Fallbacks

## v3.2.0
- Modular refactoring for maintainability

## v3.1.0
- Production hardening (timeout, retry, request ID)

## v2.11.0
- Model optimization (gpt-4o + temp 0.5)

## v2.6.0
- Reduced Prompt B information overload

## v2.5.0
- Added hard evidence constraints

## v2.4.0
- Added `must_use_phrases`, `concrete_anchors`, `disallowed_generic_words`

## v2.3.0
- Added controlled third-party context flag

## v2.2.0
- Converted Prompt B to JSON output
