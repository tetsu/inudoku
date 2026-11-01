/// <reference types="vite/client" />

interface Window {
  /** Set by the iOS app in Release builds only: serve live AdMob ads instead of test ads */
  __adsLive?: boolean;
  /** Set by the iOS app in Debug builds only: enables developer tools */
  __debugBuild?: boolean;
}
