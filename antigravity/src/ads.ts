import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  AdmobConsentStatus,
  InterstitialAdPluginEvents,
} from '@capacitor-community/admob';

/**
 * AdMob interstitials for the iOS app. Everything here is a no-op on the web
 * build and on platforms without an ad unit yet.
 *
 * Ads are test ads unless the native app is a Release build (archive,
 * TestFlight, App Store), which sets `window.__adsLive`. Running from Xcode in
 * Debug therefore never serves, and can't be accidentally tapped on, a live ad,
 * while a shipped build can't end up with test ads.
 */

const IOS_INTERSTITIAL_ID = 'ca-app-pub-3354299395899148/5007768686';

const LIVE = window.__adsLive === true;

/** Show an interstitial at most once every this many stage clears... */
const CLEARS_PER_AD = 3;
/** ...and never sooner than this after the previous one. */
const MIN_INTERVAL_MS = 90_000;
/** Give up on an ad that was never presented (no timeout once it is up). */
const PRESENT_TIMEOUT_MS = 10_000;

const interstitialId = Capacitor.getPlatform() === 'ios' ? IOS_INTERSTITIAL_ID : null;

let ready = false;
let loaded = false;
let loading = false;
let clearsSinceAd = 0;
let lastAdAt = 0;
let privacyOptionsRequired = false;

async function prepare() {
  if (!interstitialId || loaded || loading) return;
  loading = true;
  try {
    await AdMob.prepareInterstitial({ adId: interstitialId, isTesting: !LIVE });
    loaded = true;
  } catch {
    // No fill or offline: try again on the next clear
  } finally {
    loading = false;
  }
}

/**
 * Gathers consent (EU/UK) and tracking permission, then initialises the SDK and
 * preloads the first ad - but only when consent allows requesting ads. Safe to
 * call on any platform; failures just mean no ads this session.
 */
export async function initAds(): Promise<void> {
  if (!Capacitor.isNativePlatform() || !interstitialId) return;
  try {
    // GDPR consent. Fails when no consent message is published in the AdMob
    // console, in which case there's nothing to gather and ads may be requested.
    let canRequestAds = true;
    try {
      let consent = await AdMob.requestConsentInfo();
      if (consent.isConsentFormAvailable && consent.status === AdmobConsentStatus.REQUIRED) {
        consent = await AdMob.showConsentForm();
      }
      canRequestAds = consent.canRequestAds;
      privacyOptionsRequired = consent.privacyOptionsRequirementStatus === 'REQUIRED';
    } catch (e) {
      console.warn('[ads] consent info unavailable', e);
    }
    if (!canRequestAds) return;

    const tracking = await AdMob.trackingAuthorizationStatus();
    if (tracking.status === 'notDetermined') {
      await AdMob.requestTrackingAuthorization();
    }

    await AdMob.initialize({ initializeForTesting: !LIVE });
    ready = true;
    void prepare();
  } catch (e) {
    console.warn('[ads] AdMob unavailable', e);
  }
}

/** Whether the settings screen should offer to revisit the consent choices. */
export function isAdPrivacyOptionsRequired(): boolean {
  return privacyOptionsRequired;
}

/** Re-opens the consent form so the player can change or withdraw consent. */
export async function showAdPrivacyOptions(): Promise<void> {
  try {
    await AdMob.showPrivacyOptionsForm();
  } catch (e) {
    console.warn('[ads] privacy options unavailable', e);
  }
}

/**
 * Called between stages. Shows an interstitial when one is due and loaded and
 * resolves once it has been closed (or immediately when no ad is shown), so the
 * caller can start the next stage afterwards.
 */
export async function maybeShowInterstitial(hooks: { onOpen?: () => void; onClose?: () => void } = {}): Promise<void> {
  if (!ready) return;
  clearsSinceAd++;
  const due = clearsSinceAd >= CLEARS_PER_AD && Date.now() - lastAdAt >= MIN_INTERVAL_MS;
  if (!due || !loaded) {
    void prepare();
    return;
  }

  loaded = false;
  hooks.onOpen?.();
  try {
    await new Promise<void>((resolve) => {
      const handles: Promise<{ remove: () => Promise<void> }>[] = [];
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        handles.forEach((h) => void h.then((x) => x.remove()));
        resolve();
      };
      const timer = setTimeout(done, PRESENT_TIMEOUT_MS);
      handles.push(AdMob.addListener(InterstitialAdPluginEvents.Dismissed, done));
      handles.push(AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, done));
      // Resolves once the ad is presented; from then on only Dismissed ends it
      AdMob.showInterstitial().then(
        () => {
          clearTimeout(timer);
          clearsSinceAd = 0;
          lastAdAt = Date.now();
        },
        done
      );
    });
  } finally {
    hooks.onClose?.();
    void prepare();
  }
}
