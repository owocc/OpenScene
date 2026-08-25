/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OPENSCENE_ADMIN_URL: string;
  readonly VITE_OPENSCENE_APP_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
