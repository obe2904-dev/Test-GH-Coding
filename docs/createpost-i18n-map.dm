Create Post i18n Missing-Key Map

Scope
- This document maps the UI surfaces related to the missing i18next key:
  createPost.generate.selectSuggestionError.
- The warning is emitted from the create-post flow, not from multiple unrelated app pages.

What actually triggers the warning
- The key is referenced in src/components/post-creation/hooks/useGenerateValidation.ts.
- It is only reached when activePath is ai-ideas and the user has not selected an AI suggestion, typed at least 10 characters, or attached photos.
- In practice, this means the warning is part of the AI Ideas branch of the Create Post flow.

Primary page surface
- /dashboard/create
- Entry point: src/App.tsx registers the route.
- Page host: src/pages/dashboard/CreatePostPage.tsx lazy-loads the post-creation step UI.
- The specific warning can appear only in the generate step when the page is in ai-ideas mode.

Create Post modes under the same page
- write: shares the same page shell, but does not hit this validation branch.
- ai-ideas: this is the only mode that can emit createPost.generate.selectSuggestionError.
- weekly-plan: shares the page shell, but the validation branch for this key is not used.

Shared UI surfaces that reuse the same translation namespace
- src/components/post-creation/GenerateStep.tsx
  - Main shared step component inside the create-post flow.
  - Owns the call into the validation hook.
- src/components/post-creation/shared/ActionButtons.tsx
  - Uses createPost.generate for shared action labels inside the same flow.
- src/components/post-creation/BusinessInfoPromptModal.tsx
  - Uses the same namespace for business-info prompts shown from the create-post experience.
- src/components/post-creation/BusinessSetupModal.tsx
  - Uses the same namespace for the setup prompt shown from the create-post experience.
- src/components/post-creation/EnhancementControls.tsx
  - Uses the same namespace for post-editing controls inside the same flow.

Locale status
- src/lib/locales/en.json contains createPost.generate entries for the create-post flow.
- src/lib/locales/da.json contains many createPost.generate entries, but the specific selectSuggestionError key is missing.
- The code falls back to the literal Danish string, which is why the UI can still render while i18next logs a missingKey warning.

Conclusion
- This is a localized translation gap, not a broad multi-page logic bug.
- Fix priority should be on the shared create-post translation resources, with ai-ideas mode as the only page state that actually exercises the missing key.
