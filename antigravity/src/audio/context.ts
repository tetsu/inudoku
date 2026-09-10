/**
 * Single shared AudioContext for every audio source in the game.
 *
 * Both the SFX engine and the BGM engine pull from here rather than each
 * constructing their own: browsers cap the number of live AudioContexts
 * (Safari/iOS especially), and a context only leaves the "suspended" state
 * once it has been resumed inside a user gesture. Sharing one means a single
 * unlock serves everything.
 */
let sharedCtx: AudioContext | null = null;

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

/**
 * Returns the shared context, creating it on first call and opportunistically
 * resuming it. Returns null when Web Audio is unavailable.
 */
export function getSharedAudioContext(): AudioContext | null {
  if (!sharedCtx) {
    const AudioContextClass = window.AudioContext || (window as WebkitWindow).webkitAudioContext;
    if (!AudioContextClass) return null;
    try {
      sharedCtx = new AudioContextClass();
    } catch {
      return null;
    }
  }

  if (sharedCtx.state === 'suspended') {
    void sharedCtx.resume().catch(() => {
      /* Autoplay policy: stays suspended until a real user gesture. */
    });
  }

  return sharedCtx;
}
