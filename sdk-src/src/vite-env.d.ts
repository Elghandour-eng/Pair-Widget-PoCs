/// <reference types="vite/client" />

interface ViteTypeOptions {
  // By adding this line, you can make the type of ImportMetaEnv strict
  // to disallow unknown keys.
  strictImportMetaEnv: unknown
}

interface ImportMetaEnv {
  readonly VITE_BASE_URL: string
  readonly VITE_PUSHER_APP_KEY: string
  readonly VITE_PUSHER_CLUSTER?: string
  readonly VITE_HIRO_WIDGET_ID?: string
  readonly VITE_PUSHER_HOST?: string
  readonly VITE_PUSHER_PORT?: string
  readonly VITE_PUSHER_FORCE_TLS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  // Written into the page by the server that serves this build; see core/env.ts.
  __PAIR_WIDGET_ENV__?: Partial<Record<keyof ImportMetaEnv, string>>
}
