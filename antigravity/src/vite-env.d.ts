/// <reference types="vite/client" />

interface Window {
  /** Set by the iOS app in Release builds only: serve live AdMob ads instead of test ads */
  __adsLive?: boolean;
}
