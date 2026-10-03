/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_ROOT_DOMAIN?: string;
  readonly VITE_USE_SUBDOMAINS?: string;
  readonly VITE_BRAND_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
