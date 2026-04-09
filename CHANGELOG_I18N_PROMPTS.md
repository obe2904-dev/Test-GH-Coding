# Changelog: i18n, Prompt Renderer & Test Conversion

Date: 2026-01-27

Summary
-------
- Implemented country-driven UI and extracted Danish UI strings to i18n.
- Added a canonical token system and Danish canonical phrase mapping.
- Introduced a prompt renderer used by Brand Profile prompts to avoid translation drift.
- Converted Deno-style tests to run under Vitest and fixed remaining Deno import issues.
- Patched validators and proof-grounding to accept legacy analysis shapes and numeric references (#1 style).

High-Level Changes
------------------

- i18n and locales
  - Added `config/canonical-tokens.ts` — centralized token enums.
  - Added `config/i18n/da-DK.ts` and `config/i18n/index.ts` — Danish canonical phrase mappings and accessor.
  - Repaired `src/lib/locales/promptI18n.da.json` and added `src/lib/locales/promptI18n.en.json`.

- Prompt renderer & prompt migrations
  - Added `supabase/functions/_shared/brand-profile/prompts/prompt-builder.ts` — runtime renderer for tokens and location phrases.
  - Migrated location-related usages in several prompts (Prompt A, Prompt B, analyze-concept-fit) to use renderer tokens.

- Validators & Proof Grounding
  - Modified `supabase/functions/_shared/brand-profile/validators.ts`:
    - `buildAllowedProofTokens` now ensures at least one token (fallback 'generic').
    - `buildNormalizedRefs` extended to include legacy/reference-style tokens and short numeric references like `#1`.
    - Additional language-awareness improvements and defensive checks.
  - Updated `supabase/functions/_shared/brand-profile/proof-grounding.ts` to work with the new token/ref output.

- Deno -> Node test conversions
  - Converted Deno.test + std/assert style tests to Vitest in several test files under `supabase/functions/_shared/*`.
  - Reworked `supabase/functions/analyze-concept-fit/index.ts` to avoid top-level `https:` remote imports by dynamically importing Deno-only modules at runtime.

- Frontend
  - Extracted and wired country-driven UI for top-bar and business profile pages; components and hooks added/updated under `src/components/*` and `src/hooks/*`.

Files Added / Heavily Modified (non-exhaustive)
----------------------------------------------
- config/canonical-tokens.ts
- config/i18n/da-DK.ts
- config/i18n/index.ts
- supabase/functions/_shared/brand-profile/prompts/prompt-builder.ts
- supabase/functions/_shared/brand-profile/validators.ts (mod)
- supabase/functions/_shared/brand-profile/proof-grounding.ts (mod)
- supabase/functions/analyze-concept-fit/index.ts (mod)
- src/lib/locales/promptI18n.da.json (fixed)
- many frontend components under `src/pages` and `src/components` (i18n wiring)
- Converted tests under `supabase/functions/_shared/.../__tests__/*.test.ts` to Vitest

Test Results
------------

- Local vitest run: 9 test files, 85 tests — all passed.
  - Key fix: `buildNormalizedRefs` updated to include `#N` refs addressed a failing assertion in `proof-grounding.test.ts`.

Commit
------
- Commit message: `chore: i18n + prompt renderer; convert tests to vitest; validators + refs fix`
- Commit summary: 674 files changed (large refactor and additions). The commit is staged in the current branch (`refactor/prompt-a-split` in local history).

Next Steps / Recommendations
----------------------------

1. Push branch and open a PR for review (suggest creating a concise PR description linking to this changelog and `LANGUAGE_HARDCODING_AUDIT.md`).

   Commands to push (replace `origin` and branch as needed):

```bash
git push origin HEAD
# or push to a named branch
git push origin refactor/prompt-a-split:refactor/prompt-a-split
```

2. CI: run the project's full build and end-to-end suites in CI (some tests rely on network/Supabase keys and should be mocked in CI or guarded).

3. Address audit high-priority items from `LANGUAGE_HARDCODING_AUDIT.md` (recommended order):
   - Replace hard-coded location phrases with language-mapped phrases across all prompts and repair examples.
   - Make validator error messages language-aware (use targetLanguage variable in messages).
   - Centralize language-specific domain allowlists and patterns (`language-constants.ts`).

4. Phase 2 migration: add customer/service tokens and migrate remaining prompts that still assert exact canonical strings.

Notes
-----
- The repo now contains many new and modified files; review the PR carefully for unintentional changes to unrelated areas (the commit touched many files as part of the sweep).
- Network-dependent tests in `src/features/BusinessProfilerAI/index.test.ts` still expect Supabase/OpenAI/Gemini endpoints when mocks are disabled; CI should use environment variables or mock endpoints.

References
----------
- Language audit: `LANGUAGE_HARDCODING_AUDIT.md` (see root)
- Proof grounding tests: `supabase/functions/_shared/brand-profile/__tests__/proof-grounding.test.ts`

If you want, I can
- push the branch and open a PR with this changelog as the PR body
- or produce a smaller targeted PR containing only the prompt/validator changes (safer for review)

-- GitHub Copilot
