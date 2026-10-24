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
 * Ads are test ads unless the bundle was built with VITE_ADMOB_LIVE=true
 * (`npm run ios:release`), so a development build on a real device can never
 * serve, and be accidentally tapped on, a live ad.
 */

const IOS_INTERSTITIAL_ID = 'ca-app-pub-3354299395899148/5007768686';

const LIVE = import.meta.env.VITE_ADMOB_LIVE === 'true';

/** Show an interstitial at most once every this many stage clears... */
const CLEARS_PER_AD = 3;
/** ...and never sooner than this after the previous one. */
const MIN_INTERVAL_MS = 90_000;
/** Give up waiting for an ad that never reports back. */
const SHOW_TIMEOUT_MS = 60_000;

const interstitialId = Capacitor.getPlatform() === 'ios' ? IOS_INTERSTITIAL_ID : null;

let ready = false;
let loaded = false;
let loading = false;
let clearsSinceAd = 0;
let lastAdAt = 0;

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
 * Initialises the SDK, asks for consent (EU/UK) and tracking permission, and
 * preloads the first ad. Safe to call on any platform; failures just mean no
 * ads this session.
 */
export async function initAds(): Promise<void> {
  if (!Capacitor.isNativePlatform() || !interstitialId) return;
  try {
    await AdMob.initialize({ initializeForTesting: !LIVE });

    // GDPR consent (EU/UK). Fails when no consent message is published in the
    // AdMob console; ads still work then, so carry on.
    try {
      const consent = await AdMob.requestConsentInfo();
      if (consent.isConsentFormAvailable && consent.status === AdmobConsentStatus.REQUIRED) {
        await AdMob.showConsentForm();
      }
    } catch (e) {
      console.warn('[ads] consent info unavailable', e);
    }

    const tracking = await AdMob.trackingAuthorizationStatus();
    if (tracking.status === 'notDetermined') {
      await AdMob.requestTrackingAuthorization();
    }

    ready = true;
    void prepare();
  } catch (e) {
    console.warn('[ads] AdMob unavailable', e);
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
      const done = () => {
        clearTimeout(timer);
        handles.forEach((h) => void h.then((x) => x.remove()));
        resolve();
      };
      const timer = setTimeout(done, SHOW_TIMEOUT_MS);
      handles.push(AdMob.addListener(InterstitialAdPluginEvents.Dismissed, done));
      handles.push(AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, done));
      AdMob.showInterstitial().then(
        () => {
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
