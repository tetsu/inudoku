/**
 * Procedural smooth-jazz BGM for Shibadoku.
 *
 * Same philosophy as the SFX engine: pure Web Audio, zero external assets, so
 * the bundle stays asset-free and playback starts instantly. Generates an
 * endless lazy ii-V-I loop in F major with four voices:
 *   - Rhodes-style electric piano comping (FM tine + long decay)
 *   - Walking upright bass in quarter notes with chromatic approach tones
 *   - Brushed drums (filtered noise ride pattern + backbeat swish)
 *   - A sparse, breathy sax-ish lead that sits out more often than it plays
 *
 * Notes are scheduled with the standard Web Audio lookahead pattern: a coarse
 * setInterval timer queues sample-accurate events a little ahead of the clock.
 */
import { getSharedAudioContext } from './context';

const TEMPO = 84; // BPM - unhurried lounge tempo
const SECONDS_PER_BEAT = 60 / TEMPO;
const SWING = 2 / 3; // Off-beat 8ths land on the triplet, not halfway
const LOOKAHEAD_MS = 25; // How often the scheduler wakes up
const SCHEDULE_AHEAD = 0.25; // Seconds of audio queued in advance
const MAX_GAIN = 0.5; // Ceiling so the four-voice mix never clips
const STEPS_PER_BAR = 8; // 8th-note resolution

interface Chord {
  /** Rootless mid-register voicing for the Rhodes, as MIDI note numbers. */
  voicing: number[];
  /** Bass root, MIDI note number. */
  bass: number;
  /** Chord-tone offsets above the bass root the walking line may use. */
  bassTones: number[];
  /** Melody pool: chord tones plus tensions, MIDI note numbers. */
  color: number[];
}

/**
 * Eight-bar loop: Gm9 | C13 | Fmaj9 | Fmaj9 | Dm9 | Gm9 | C13 | Fmaj9
 * The classic lazy ii-V-I turnaround that reads as "smooth jazz" instantly.
 */
const PROGRESSION: Chord[] = [
  // Gm9 - rootless Bb D F A
  { voicing: [58, 62, 65, 69], bass: 43, bassTones: [0, 3, 7, 10], color: [65, 69, 70, 72, 74, 77] },
  // C13 - rootless Bb D E A
  { voicing: [58, 62, 64, 69], bass: 48, bassTones: [0, 4, 7, 10], color: [64, 67, 69, 70, 72, 76] },
  // Fmaj9 - rootless A C E G
  { voicing: [57, 60, 64, 67], bass: 41, bassTones: [0, 4, 7, 11], color: [65, 67, 69, 72, 76, 77] },
  { voicing: [57, 60, 64, 67], bass: 41, bassTones: [0, 4, 7, 11], color: [65, 67, 69, 72, 76, 77] },
  // Dm9 - rootless F A C E
  { voicing: [53, 57, 60, 64], bass: 38, bassTones: [0, 3, 7, 10], color: [62, 65, 69, 72, 74, 76] },
  { voicing: [58, 62, 65, 69], bass: 43, bassTones: [0, 3, 7, 10], color: [65, 69, 70, 72, 74, 77] },
  { voicing: [58, 62, 64, 69], bass: 48, bassTones: [0, 4, 7, 10], color: [64, 67, 69, 70, 72, 76] },
  { voicing: [57, 60, 64, 67], bass: 41, bassTones: [0, 4, 7, 11], color: [65, 67, 69, 72, 76, 77] },
];

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

class MusicEngine {
  private enabled = true;
  private volume = 0.35;
  private playing = false;

  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private timer: number | null = null;

  /** Global 8th-note counter; drives both the bar/beat position and the form. */
  private step = 0;
  /** AudioContext time at which `step` should sound. */
  private nextStepTime = 0;
  /** Last melody note played, so phrases move by step rather than leaping. */
  private lastMelodyNote = 69;

  // --- Public API -----------------------------------------------------------

  /**
   * Enables or disables music. Disabling stops immediately; enabling does NOT
   * auto-start, because the caller knows whether it is inside a user gesture
   * (autoplay policy) - call start() explicitly for that.
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.stop();
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  /** Volume as 0..1; 0 leaves the loop running silently. */
  public setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
    const ctx = getSharedAudioContext();
    if (this.master && ctx) {
      // Short ramp instead of a jump, so dragging the slider doesn't click.
      this.master.gain.cancelScheduledValues(ctx.currentTime);
      this.master.gain.setTargetAtTime(this.volume * MAX_GAIN, ctx.currentTime, 0.05);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public isPlaying(): boolean {
    return this.playing;
  }

  /**
   * Begins playback. Safe to call repeatedly and safe to call before the user
   * has interacted: the context simply stays suspended until they do.
   */
  public start(): void {
    if (!this.enabled || this.playing) return;

    const ctx = getSharedAudioContext();
    if (!ctx) return;

    this.master = ctx.createGain();
    this.master.gain.setValueAtTime(this.volume * MAX_GAIN, ctx.currentTime);
    this.master.connect(ctx.destination);

    this.playing = true;
    this.step = 0;
    this.nextStepTime = ctx.currentTime + 0.12;
    this.timer = window.setInterval(() => this.scheduler(), LOOKAHEAD_MS);
  }

  /** Fades out and tears down. Safe to call when already stopped. */
  public stop(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    this.playing = false;

    const ctx = getSharedAudioContext();
    const master = this.master;
    this.master = null;
    if (!master || !ctx) return;

    // Fade before disconnecting so the tail doesn't cut off with a click.
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0.0001, now + 0.4);
    window.setTimeout(() => master.disconnect(), 900);
  }

  // --- Scheduling -----------------------------------------------------------

  private scheduler(): void {
    const ctx = getSharedAudioContext();
    if (!ctx || !this.master) return;

    // Autoplay policy can leave the context suspended after start(). Its clock is
    // frozen while suspended, so scheduling now would queue a pile of events that
    // all fire the instant it resumes. Just hold the cursor until it is running.
    if (ctx.state !== 'running') {
      this.nextStepTime = ctx.currentTime + 0.12;
      return;
    }

    // Background tabs throttle setInterval, so the clock can fall behind. Without
    // this resync every missed step would fire at once as one loud burst.
    if (this.nextStepTime < ctx.currentTime) {
      this.nextStepTime = ctx.currentTime + 0.05;
    }

    while (this.nextStepTime < ctx.currentTime + SCHEDULE_AHEAD) {
      this.scheduleStep(ctx, this.step, this.nextStepTime);
      // On-beat -> off-beat is the long side of the swing, off -> on the short.
      const isOnBeat = this.step % 2 === 0;
      this.nextStepTime += SECONDS_PER_BEAT * (isOnBeat ? SWING : 1 - SWING);
      this.step++;
    }
  }

  private scheduleStep(ctx: AudioContext, step: number, time: number): void {
    const stepInBar = step % STEPS_PER_BAR;
    const bar = Math.floor(step / STEPS_PER_BAR) % PROGRESSION.length;
    const beat = Math.floor(stepInBar / 2);
    const isOnBeat = stepInBar % 2 === 0;

    const chord = PROGRESSION[bar];
    const nextChord = PROGRESSION[(bar + 1) % PROGRESSION.length];

    if (isOnBeat) {
      this.scheduleBass(ctx, chord, nextChord, beat, time);
      // Ride cymbal marks all four quarters.
      this.playBrush(ctx, time, 0.055, 7200, 0.22);
      // Brush swish on the backbeat.
      if (beat === 1 || beat === 3) {
        this.playBrush(ctx, time, 0.16, 3400, 0.1);
      }
    } else if (beat === 1 || beat === 3) {
      // Swung "ding-da-ding": extra ride note after beats 2 and 4.
      this.playBrush(ctx, time, 0.05, 7600, 0.16);
    }

    // Comp on the downbeat, plus a syncopated push into the second half.
    if (stepInBar === 0) {
      this.playChord(ctx, chord.voicing, time, 0.5);
    } else if (stepInBar === 5 && Math.random() < 0.6) {
      this.playChord(ctx, chord.voicing, time, 0.28);
    }

    this.scheduleMelody(ctx, chord, stepInBar, time);
  }

  private scheduleBass(
    ctx: AudioContext,
    chord: Chord,
    nextChord: Chord,
    beat: number,
    time: number
  ): void {
    let note: number;
    if (beat === 0) {
      note = chord.bass;
    } else if (beat === 3) {
      // Chromatic approach into the next bar's root, from above or below.
      note = nextChord.bass + (Math.random() < 0.5 ? -1 : 1);
    } else {
      const tones = chord.bassTones;
      note = chord.bass + tones[Math.floor(Math.random() * tones.length)];
    }
    this.playBass(ctx, midiToFreq(note), time);
  }

  private scheduleMelody(ctx: AudioContext, chord: Chord, stepInBar: number, time: number): void {
    // Deliberately sparse: the lead should decorate the comp, not sit on top of
    // it. Phrases favour the off-beats, and most steps stay silent.
    const density = stepInBar % 2 === 1 ? 0.22 : 0.1;
    if (Math.random() > density) return;

    // Prefer the pool note nearest the last one so the line moves stepwise.
    const pool = chord.color;
    let best = pool[0];
    let bestDist = Infinity;
    for (const candidate of pool) {
      // Random tie-break keeps repeated bars from producing identical phrases.
      const dist = Math.abs(candidate - this.lastMelodyNote) + Math.random() * 5;
      if (dist < bestDist) {
        bestDist = dist;
        best = candidate;
      }
    }
    this.lastMelodyNote = best;

    const dur = SECONDS_PER_BEAT * (0.5 + Math.random() * 1.2);
    this.playSax(ctx, midiToFreq(best), time, dur);
  }

  // --- Voices ---------------------------------------------------------------

  /** Rhodes-style electric piano: 1:1 FM for the tine, long soft decay. */
  private playChord(ctx: AudioContext, voicing: number[], time: number, velocity: number): void {
    voicing.forEach((midi, idx) => {
      const freq = midiToFreq(midi);
      // Tiny spread so the voicing strums rather than landing as a block.
      const t = time + idx * 0.012;
      const dur = 1.8;

      const carrier = ctx.createOscillator();
      carrier.type = 'sine';
      carrier.frequency.setValueAtTime(freq, t);

      const modulator = ctx.createOscillator();
      modulator.type = 'sine';
      modulator.frequency.setValueAtTime(freq, t);

      // Modulation index decays fast: that bell-like attack is the Rhodes tine.
      const modDepth = ctx.createGain();
      modDepth.gain.setValueAtTime(freq * 2.4, t);
      modDepth.gain.exponentialRampToValueAtTime(freq * 0.04, t + 0.4);

      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.setValueAtTime(2600, t);

      const amp = ctx.createGain();
      amp.gain.setValueAtTime(0.0001, t);
      amp.gain.linearRampToValueAtTime(velocity * 0.16, t + 0.02);
      amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      modulator.connect(modDepth);
      modDepth.connect(carrier.frequency);
      carrier.connect(tone);
      tone.connect(amp);
      amp.connect(this.master!);

      modulator.start(t);
      carrier.start(t);
      modulator.stop(t + dur);
      carrier.stop(t + dur);
    });
  }

  /** Upright-ish bass: filtered triangle with a quick pluck envelope. */
  private playBass(ctx: AudioContext, freq: number, time: number): void {
    const dur = SECONDS_PER_BEAT * 0.9;

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);
    // Slight downward drift mimics the pitch settling on a plucked string.
    osc.frequency.exponentialRampToValueAtTime(freq * 0.995, time + 0.08);

    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.setValueAtTime(420, time);

    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.linearRampToValueAtTime(0.3, time + 0.02);
    amp.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    osc.connect(tone);
    tone.connect(amp);
    amp.connect(this.master!);

    osc.start(time);
    osc.stop(time + dur);
  }

  /** Brushed drums: band-passed noise. Short+bright = ride, long+dark = swish. */
  private playBrush(
    ctx: AudioContext,
    time: number,
    dur: number,
    filterFreq: number,
    velocity: number
  ): void {
    const buffer = this.getNoiseBuffer(ctx);
    if (!buffer) return;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    // Random offset so consecutive hits don't replay identical noise.
    const offset = Math.random() * Math.max(0, buffer.duration - dur - 0.01);

    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.setValueAtTime(filterFreq, time);
    band.Q.setValueAtTime(0.8, time);

    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.linearRampToValueAtTime(velocity * 0.09, time + 0.005);
    amp.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    src.connect(band);
    band.connect(amp);
    amp.connect(this.master!);

    src.start(time, offset, dur + 0.02);
    src.stop(time + dur + 0.05);
  }

  /** Sax-ish lead: filtered saw with breathy attack and a touch of vibrato. */
  private playSax(ctx: AudioContext, freq: number, time: number, dur: number): void {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    const vibrato = ctx.createOscillator();
    vibrato.type = 'sine';
    vibrato.frequency.setValueAtTime(5.2, time);
    const vibratoDepth = ctx.createGain();
    // In cents, so the depth is pitch-independent.
    vibratoDepth.gain.setValueAtTime(0.0001, time);
    vibratoDepth.gain.linearRampToValueAtTime(14, time + dur * 0.5);

    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.setValueAtTime(1500, time);
    tone.frequency.linearRampToValueAtTime(2300, time + 0.12);
    tone.Q.setValueAtTime(3.5, time);

    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.linearRampToValueAtTime(0.1, time + 0.07); // Slow breathy attack
    amp.gain.setTargetAtTime(0.055, time + 0.1, 0.3);
    amp.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    vibrato.connect(vibratoDepth);
    vibratoDepth.connect(osc.detune);
    osc.connect(tone);
    tone.connect(amp);
    amp.connect(this.master!);

    vibrato.start(time);
    osc.start(time);
    vibrato.stop(time + dur);
    osc.stop(time + dur);
  }

  /** Two seconds of white noise, generated once and reused for every brush hit. */
  private getNoiseBuffer(ctx: AudioContext): AudioBuffer | null {
    if (this.noiseBuffer) return this.noiseBuffer;
    const length = Math.floor(ctx.sampleRate * 2);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return this.noiseBuffer;
  }
}

export const bgm = new MusicEngine();
