/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CENTRAL_SUPABASE_URL: string
  readonly VITE_CENTRAL_SUPABASE_ANON_KEY: string
  readonly VITE_KMG_SUPABASE_URL: string
  readonly VITE_KMG_SUPABASE_ANON_KEY: string
  readonly VITE_MURUDESHWARA_SUPABASE_URL: string
  readonly VITE_MURUDESHWARA_SUPABASE_ANON_KEY: string
  readonly VITE_APP_NAME: string
  readonly VITE_DEFAULT_TIMEZONE: string
  readonly VITE_DEFAULT_CURRENCY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
