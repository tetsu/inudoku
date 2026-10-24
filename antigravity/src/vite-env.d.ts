/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" only for App Store builds: serve live AdMob ads instead of test ads */
  readonly VITE_ADMOB_LIVE?: string;
}
