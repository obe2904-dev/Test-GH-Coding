/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_AI_PROMPT_DEBUG?: string
  readonly VITE_BUSINESS_PROFILER_DEBUG?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
