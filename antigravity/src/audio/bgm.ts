/**
 * Procedural smooth-jazz BGM for Shibadoku.
 *
 * Same philosophy as the SFX engine: pure Web Audio, zero external assets.
 *
 * Smooth jazz is not swing, and the earlier version of this file was really a
 * swing trio (triplet feel, ride cymbal, walking bass). What makes the genre is
 * a straight, laid-back R&B groove under lush extended chords and a singable
 * sax line, all soaked in reverb. So:
 *
 *   Groove   straight 16ths at 86 BPM; closed hi-hat 16ths with an accent
 *            pattern, cross-stick on 2 and 4 (a hair late), soft kick
 *   Bass     syncopated electric-bass line with octave pops and chromatic
 *            approach notes, not quarter-note walking
 *   Keys     FM Rhodes through chorus and a slow stereo auto-pan, comping with
 *            the R&B habit of anticipating each chord an 8th early
 *   Pad      soft detuned-saw strings for the "lush" layer
 *   Lead     a composed, repeating sax hook (not random notes), with a scoop
 *            into long notes, breath noise and delayed vibrato
 *   Space    synthetic convolution reverb + gentle bus compression
 *
 * Harmony is the classic IVmaj7 - III7 - vi7 - v7 I7 smooth-jazz loop
 * (Dbmaj9 | C7b9 | Fm9 | Ebm9 Ab13). A chord progression is a common musical
 * form, not a work; the melody over it is original.
 *
 * Arrangement cycles every four loops (~45s): groove only, hook A, hook B,
 * hook A -- so the lead breathes instead of playing non-stop.
 *
 * Scheduling uses the standard lookahead pattern: a coarse timer queues
 * sample-accurate events slightly ahead of the audio clock.
 */
import { getSharedAudioContext } from './context';

const TEMPO = 86;
const STEP_SEC = 60 / TEMPO / 4; // one 16th note
const STEPS_PER_BAR = 16;
const LOOP_STEPS = 64; // four bars
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.2; // seconds of audio queued in advance
// After the bus compressor. Chosen so a given slider position is about as loud
// as the previous (swing) version: measured RMS 0.086 at 100% vs 0.082 before,
// with the peak around 0.36, well clear of clipping.
const MAX_GAIN = 0.45;

interface Segment {
  /** First 16th step of the chord within the four-bar loop. */
  start: number;
  /** Length in 16th steps. */
  len: number;
  /** Bass root, MIDI. */
  root: number;
  /** Rhodes voicing, MIDI (rootless, mid register). */
  voicing: number[];
}

const LOOP: Segment[] = [
  { start: 0, len: 16, root: 37, voicing: [53, 56, 60, 63] }, // Dbmaj9: F Ab C Eb
  { start: 16, len: 16, root: 36, voicing: [52, 55, 58, 61] }, // C7b9:  E G Bb Db
  { start: 32, len: 16, root: 41, voicing: [56, 60, 63, 67] }, // Fm9:   Ab C Eb G
  { start: 48, len: 8, root: 39, voicing: [54, 58, 61, 65] }, // Ebm9:  Gb Bb Db F
  { start: 56, len: 8, root: 44, voicing: [54, 58, 60, 65] }, // Ab13:  Gb Bb C F
];

interface Note {
  /** 16th step within the loop. */
  s: number;
  /** Length in 16th steps. */
  len: number;
  midi: number;
}

/** Hook A: settles on chord colour tones (maj7, b9) with room to breathe. */
const HOOK_A: Note[] = [
  { s: 2, len: 2, midi: 68 },
  { s: 4, len: 6, midi: 72 },
  { s: 10, len: 2, midi: 70 },
  { s: 12, len: 4, midi: 68 },
  { s: 16, len: 6, midi: 67 },
  { s: 22, len: 2, midi: 64 },
  { s: 24, len: 2, midi: 67 },
  { s: 26, len: 2, midi: 70 },
  { s: 28, len: 4, midi: 73 },
  { s: 32, len: 8, midi: 72 },
  { s: 40, len: 2, midi: 68 },
  { s: 42, len: 2, midi: 67 },
  { s: 44, len: 4, midi: 65 },
  { s: 48, len: 4, midi: 66 },
  { s: 52, len: 2, midi: 65 },
  { s: 54, len: 2, midi: 63 },
  { s: 56, len: 6, midi: 72 },
];

/** Hook B: the answer phrase, climbing higher before falling back. */
const HOOK_B: Note[] = [
  { s: 3, len: 1, midi: 75 },
  { s: 4, len: 6, midi: 77 },
  { s: 10, len: 2, midi: 75 },
  { s: 12, len: 4, midi: 72 },
  { s: 16, len: 4, midi: 73 },
  { s: 20, len: 2, midi: 72 },
  { s: 22, len: 2, midi: 70 },
  { s: 24, len: 8, midi: 67 },
  { s: 34, len: 2, midi: 68 },
  { s: 36, len: 2, midi: 72 },
  { s: 38, len: 6, midi: 75 },
  { s: 44, len: 2, midi: 73 },
  { s: 46, len: 2, midi: 72 },
  { s: 48, len: 6, midi: 70 },
  { s: 54, len: 2, midi: 68 },
  { s: 56, len: 4, midi: 66 },
  { s: 60, len: 4, midi: 65 },
];

/** Which hook plays on each loop of the four-loop cycle (null = lead rests). */
const ARRANGEMENT: (Note[] | null)[] = [null, HOOK_A, HOOK_B, HOOK_A];

/** Hi-hat velocity per 16th within a beat: downbeat, e, and, a. */
const HAT_ACCENT = [0.9, 0.32, 0.62, 0.36];

interface BassHit {
  s: number;
  len: number;
  /** Semitones above the root, or 'approach' for a chromatic lead-in. */
  note: number | 'approach';
  vel: number;
}

const BASS_LONG: BassHit[] = [
  { s: 0, len: 5, note: 0, vel: 1 },
  { s: 6, len: 2, note: 12, vel: 0.7 },
  { s: 8, len: 3, note: 7, vel: 0.85 },
  { s: 14, len: 2, note: 'approach', vel: 0.75 },
];

const BASS_SHORT: BassHit[] = [
  { s: 0, len: 5, note: 0, vel: 1 },
  { s: 6, len: 2, note: 'approach', vel: 0.75 },
];

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function segmentIndexAt(loopStep: number): number {
  for (let i = LOOP.length - 1; i >= 0; i--) {
    if (loopStep >= LOOP[i].start) return i;
  }
  return 0;
}

/** Small timing drift so the groove does not sound quantised to the sample. */
function humanize(amount = 0.006): number {
  return (Math.random() * 2 - 1) * amount;
}

interface Graph {
  master: GainNode;
  kick: AudioNode;
  stick: AudioNode;
  hat: AudioNode;
  bass: AudioNode;
  keys: AudioNode;
  pad: AudioNode;
  sax: AudioNode;
  lfos: OscillatorNode[];
}

class MusicEngine {
  private enabled = true;
  private volume = 0.35;
  private playing = false;

  private graph: Graph | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private impulse: AudioBuffer | null = null;
  private timer: number | null = null;

  /** Global 16th-note counter since start(). */
  private step = 0;
  /** AudioContext time at which `step` should sound. */
  private nextStepTime = 0;

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
    if (this.graph && ctx) {
      // Short ramp instead of a jump, so dragging the slider doesn't click.
      this.graph.master.gain.cancelScheduledValues(ctx.currentTime);
      this.graph.master.gain.setTargetAtTime(this.volume * MAX_GAIN, ctx.currentTime, 0.05);
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

    this.graph = this.buildGraph(ctx);
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
    const graph = this.graph;
    this.graph = null;
    if (!graph || !ctx) return;

    // Fade before disconnecting so the reverb tail doesn't cut off with a click.
    const now = ctx.currentTime;
    const gain = graph.master.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(0.0001, now + 0.5);
    window.setTimeout(() => {
      // The LFOs run forever unless stopped; everything else is one-shot.
      graph.lfos.forEach((lfo) => {
        try {
          lfo.stop();
        } catch {
          /* already stopped */
        }
      });
      graph.master.disconnect();
    }, 900);
  }

  // --- Signal graph ---------------------------------------------------------

  /**
   * Instrument buses -> mix -> compressor -> master volume -> speakers, with
   * every bus also feeding a shared convolution reverb at its own send level.
   */
  private buildGraph(ctx: AudioContext): Graph {
    const master = ctx.createGain();
    master.gain.setValueAtTime(this.volume * MAX_GAIN, ctx.currentTime);
    master.connect(ctx.destination);

    // Gentle glue: evens out the voices and keeps peaks away from clipping.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.setValueAtTime(-20, ctx.currentTime);
    comp.knee.setValueAtTime(14, ctx.currentTime);
    comp.ratio.setValueAtTime(3, ctx.currentTime);
    comp.attack.setValueAtTime(0.012, ctx.currentTime);
    comp.release.setValueAtTime(0.25, ctx.currentTime);
    comp.connect(master);

    const mix = ctx.createGain();
    mix.connect(comp);

    const reverb = ctx.createConvolver();
    reverb.buffer = this.getImpulse(ctx);
    const reverbReturn = ctx.createGain();
    reverbReturn.gain.setValueAtTime(0.6, ctx.currentTime);
    reverb.connect(reverbReturn);
    reverbReturn.connect(comp);

    const bus = (pan: number, send: number): GainNode => {
      const input = ctx.createGain();
      const panner = this.createPanner(ctx, pan);
      input.connect(panner);
      panner.connect(mix);
      if (send > 0) {
        const sendGain = ctx.createGain();
        sendGain.gain.setValueAtTime(send, ctx.currentTime);
        input.connect(sendGain);
        sendGain.connect(reverb);
      }
      return input;
    };

    // Rhodes: chorus (a short, slowly wobbling delay) and a slow stereo
    // auto-pan -- the two effects that make it read as "smooth".
    const lfos: OscillatorNode[] = [];
    const keysIn = ctx.createGain();
    const keysPan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const keysOut: AudioNode = keysPan ?? ctx.createGain();
    keysOut.connect(mix);
    keysIn.connect(keysOut);

    const chorus = ctx.createDelay(0.05);
    chorus.delayTime.setValueAtTime(0.02, ctx.currentTime);
    const chorusWet = ctx.createGain();
    chorusWet.gain.setValueAtTime(0.5, ctx.currentTime);
    keysIn.connect(chorus);
    chorus.connect(chorusWet);
    chorusWet.connect(keysOut);

    const chorusLfo = ctx.createOscillator();
    chorusLfo.frequency.setValueAtTime(0.9, ctx.currentTime);
    const chorusDepth = ctx.createGain();
    chorusDepth.gain.setValueAtTime(0.004, ctx.currentTime);
    chorusLfo.connect(chorusDepth);
    chorusDepth.connect(chorus.delayTime);
    chorusLfo.start();
    lfos.push(chorusLfo);

    if (keysPan) {
      const panLfo = ctx.createOscillator();
      panLfo.frequency.setValueAtTime(0.35, ctx.currentTime);
      const panDepth = ctx.createGain();
      panDepth.gain.setValueAtTime(0.35, ctx.currentTime);
      panLfo.connect(panDepth);
      panDepth.connect(keysPan.pan);
      panLfo.start();
      lfos.push(panLfo);
    }

    const keysSend = ctx.createGain();
    keysSend.gain.setValueAtTime(0.3, ctx.currentTime);
    keysIn.connect(keysSend);
    keysSend.connect(reverb);

    return {
      master,
      kick: bus(0, 0),
      stick: bus(-0.12, 0.22),
      hat: bus(0.28, 0.08),
      bass: bus(0, 0.04),
      keys: keysIn,
      pad: bus(0, 0.5),
      sax: bus(0.05, 0.4),
      lfos,
    };
  }

  /** StereoPanner where supported (Safari < 14.1 lacks it), else a pass-through. */
  private createPanner(ctx: AudioContext, pan: number): AudioNode {
    if (!ctx.createStereoPanner) return ctx.createGain();
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(pan, ctx.currentTime);
    return panner;
  }

  // --- Scheduling -----------------------------------------------------------

  private scheduler(): void {
    const ctx = getSharedAudioContext();
    if (!ctx || !this.graph) return;

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
      this.scheduleStep(ctx, this.graph, this.step, this.nextStepTime);
      this.nextStepTime += STEP_SEC; // straight 16ths: no swing
      this.step++;
    }
  }

  private scheduleStep(ctx: AudioContext, g: Graph, step: number, time: number): void {
    const loopStep = step % LOOP_STEPS;
    const loopIndex = Math.floor(step / LOOP_STEPS);
    const bar = Math.floor(loopStep / STEPS_PER_BAR);
    const barStep = loopStep % STEPS_PER_BAR;

    const segIdx = segmentIndexAt(loopStep);
    const seg = LOOP[segIdx];
    const next = LOOP[(segIdx + 1) % LOOP.length];
    const rel = loopStep - seg.start;

    this.scheduleDrums(ctx, g, bar, barStep, loopIndex, time);

    // Bass
    const pattern = seg.len === 16 ? BASS_LONG : BASS_SHORT;
    for (const hit of pattern) {
      if (hit.s !== rel) continue;
      const midi =
        hit.note === 'approach' ? next.root + (next.root >= seg.root ? -1 : 1) : seg.root + hit.note;
      this.playBass(ctx, g, midiToFreq(midi), time + humanize(0.004), hit.len * STEP_SEC, hit.vel);
    }

    // Rhodes: each chord is struck an 8th before its bar (the R&B
    // anticipation), with a lighter re-strike mid-bar on the long chords.
    if (step === 0) {
      this.playRhodes(ctx, g, seg.voicing, time, 12, 0.45); // nothing anticipated the first chord
    }
    if (seg.len === 16) {
      if (rel === 10) this.playRhodes(ctx, g, seg.voicing, time + humanize(), 3, 0.26);
      if (rel === 14) this.playRhodes(ctx, g, next.voicing, time + humanize(), 10, 0.42);
    } else if (rel === 6) {
      this.playRhodes(ctx, g, next.voicing, time + humanize(), 8, 0.4);
    }

    // Pad swells in under each chord.
    if (rel === 0) {
      this.playPad(ctx, g, seg.voicing, time, seg.len * STEP_SEC);
    }

    // Lead
    const hook = ARRANGEMENT[loopIndex % ARRANGEMENT.length];
    if (hook) {
      for (const note of hook) {
        if (note.s !== loopStep) continue;
        const dur = note.len * STEP_SEC + 0.05; // slight overlap for legato
        this.playSax(ctx, g, midiToFreq(note.midi), time + humanize(0.01), dur, note.len >= 4);
      }
    }
  }

  private scheduleDrums(
    ctx: AudioContext,
    g: Graph,
    bar: number,
    barStep: number,
    loopIndex: number,
    time: number
  ): void {
    const kickSteps = [0, 10];
    if (bar % 2 === 1) kickSteps.push(7);
    if (bar === 3) kickSteps.push(14);
    if (kickSteps.includes(barStep)) this.playKick(ctx, g, time);

    // Cross-stick on 2 and 4, landing a touch behind the beat: laid back.
    if (barStep === 4 || barStep === 12) {
      this.playStick(ctx, g, time + 0.012, 1);
    }
    if (bar === 3 && barStep === 15 && loopIndex % 2 === 1) {
      this.playStick(ctx, g, time, 0.4); // ghost note into the turnaround
    }

    const openHat = bar === 3 && barStep === 14 && loopIndex % 2 === 0;
    const vel = HAT_ACCENT[barStep % 4] * (0.85 + Math.random() * 0.3);
    this.playHat(ctx, g, time + humanize(0.004), openHat ? 0.7 : vel, openHat);
  }

  // --- Voices ---------------------------------------------------------------

  /** Soft kick: pitch-swept sine plus a click so it reads on small speakers. */
  private playKick(ctx: AudioContext, g: Graph, time: number): void {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, time);
    osc.frequency.exponentialRampToValueAtTime(48, time + 0.11);

    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.linearRampToValueAtTime(0.55, time + 0.004);
    amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.32);

    osc.connect(amp);
    amp.connect(g.kick);
    osc.start(time);
    osc.stop(time + 0.35);

    this.playNoise(ctx, g.kick, time, 0.02, 'highpass', 3000, 0.7, 0.05);
  }

  /** Cross-stick: a woody click (band-passed noise) with a short tonal knock. */
  private playStick(ctx: AudioContext, g: Graph, time: number, vel: number): void {
    this.playNoise(ctx, g.stick, time, 0.06, 'bandpass', 1900, 1.8, 0.22 * vel);

    const knock = ctx.createOscillator();
    knock.type = 'sine';
    knock.frequency.setValueAtTime(430, time);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.12 * vel, time);
    amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);
    knock.connect(amp);
    amp.connect(g.stick);
    knock.start(time);
    knock.stop(time + 0.05);
  }

  private playHat(ctx: AudioContext, g: Graph, time: number, vel: number, open: boolean): void {
    this.playNoise(ctx, g.hat, time, open ? 0.28 : 0.035, 'highpass', 7500, 0.7, 0.045 * vel);
  }

  /**
   * Fingered electric bass: sine body for weight plus filtered saw harmonics,
   * which is what makes a bass line audible on phone speakers.
   */
  private playBass(ctx: AudioContext, g: Graph, freq: number, time: number, dur: number, vel: number): void {
    const body = ctx.createOscillator();
    body.type = 'sine';
    body.frequency.setValueAtTime(freq, time);

    const edge = ctx.createOscillator();
    edge.type = 'sawtooth';
    edge.frequency.setValueAtTime(freq, time);
    const edgeGain = ctx.createGain();
    edgeGain.gain.setValueAtTime(0.35, time);

    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.Q.setValueAtTime(1.5, time);
    tone.frequency.setValueAtTime(1200, time);
    tone.frequency.exponentialRampToValueAtTime(520, time + 0.12);

    const amp = ctx.createGain();
    const end = time + dur;
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.linearRampToValueAtTime(0.33 * vel, time + 0.006);
    amp.gain.exponentialRampToValueAtTime(0.22 * vel, time + 0.15);
    amp.gain.setValueAtTime(0.22 * vel, end);
    amp.gain.exponentialRampToValueAtTime(0.0001, end + 0.06);

    body.connect(tone);
    edge.connect(edgeGain);
    edgeGain.connect(tone);
    tone.connect(amp);
    amp.connect(g.bass);

    body.start(time);
    edge.start(time);
    body.stop(end + 0.08);
    edge.stop(end + 0.08);
  }

  /** Rhodes-style electric piano: 1:1 FM for the tine, long soft decay. */
  private playRhodes(
    ctx: AudioContext,
    g: Graph,
    voicing: number[],
    time: number,
    steps: number,
    velocity: number
  ): void {
    const ring = steps * STEP_SEC + 0.6;
    voicing.forEach((midi, idx) => {
      const freq = midiToFreq(midi);
      const t = time + idx * 0.009; // light strum
      const vel = velocity * (0.9 + Math.random() * 0.2);

      const carrier = ctx.createOscillator();
      carrier.type = 'sine';
      carrier.frequency.setValueAtTime(freq, t);

      const modulator = ctx.createOscillator();
      modulator.type = 'sine';
      modulator.frequency.setValueAtTime(freq, t);
      const modDepth = ctx.createGain();
      modDepth.gain.setValueAtTime(freq * 1.8, t);
      modDepth.gain.exponentialRampToValueAtTime(freq * 0.03, t + 0.35);

      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.setValueAtTime(2400, t);

      const amp = ctx.createGain();
      amp.gain.setValueAtTime(0.0001, t);
      amp.gain.linearRampToValueAtTime(vel * 0.075, t + 0.012);
      amp.gain.exponentialRampToValueAtTime(0.0001, t + ring);

      modulator.connect(modDepth);
      modDepth.connect(carrier.frequency);
      carrier.connect(tone);
      tone.connect(amp);
      amp.connect(g.keys);

      modulator.start(t);
      carrier.start(t);
      modulator.stop(t + ring);
      carrier.stop(t + ring);
    });
  }

  /** String pad an octave above the keys: two detuned saws, slow swell. */
  private playPad(ctx: AudioContext, g: Graph, voicing: number[], time: number, dur: number): void {
    const attack = 0.8;
    const release = 1.2;
    for (const midi of voicing.slice(1)) {
      const freq = midiToFreq(midi + 12);
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.setValueAtTime(1400, time);
      tone.Q.setValueAtTime(0.5, time);

      const amp = ctx.createGain();
      amp.gain.setValueAtTime(0.0001, time);
      amp.gain.linearRampToValueAtTime(0.018, time + attack);
      amp.gain.setValueAtTime(0.018, time + dur);
      amp.gain.exponentialRampToValueAtTime(0.0001, time + dur + release);

      for (const detune of [-7, 7]) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, time);
        osc.detune.setValueAtTime(detune, time);
        osc.connect(tone);
        osc.start(time);
        osc.stop(time + dur + release + 0.05);
      }
      tone.connect(amp);
      amp.connect(g.pad);
    }
  }

  /**
   * Alto-sax-ish lead: saw + square through a formant peak and an opening
   * low-pass, a breath-noise transient, a scoop up into longer notes, and
   * vibrato that only arrives once the note has sustained a while.
   */
  private playSax(
    ctx: AudioContext,
    g: Graph,
    freq: number,
    time: number,
    dur: number,
    scoop: boolean
  ): void {
    const end = time + dur;

    const saw = ctx.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.setValueAtTime(freq, time);
    const square = ctx.createOscillator();
    square.type = 'square';
    square.frequency.setValueAtTime(freq, time);
    square.detune.setValueAtTime(4, time);
    const squareGain = ctx.createGain();
    squareGain.gain.setValueAtTime(0.25, time);

    if (scoop) {
      // Start a little flat and slide up: the signature smooth-jazz sax entry.
      for (const osc of [saw, square]) {
        osc.detune.setValueAtTime(-70, time);
        osc.detune.linearRampToValueAtTime(osc === square ? 4 : 0, time + 0.07);
      }
    }

    const vibrato = ctx.createOscillator();
    vibrato.frequency.setValueAtTime(5.3, time);
    const vibratoDepth = ctx.createGain(); // in cents
    vibratoDepth.gain.setValueAtTime(0, time);
    vibratoDepth.gain.setValueAtTime(0, time + Math.min(0.25, dur * 0.45));
    vibratoDepth.gain.linearRampToValueAtTime(dur > 0.4 ? 18 : 6, end);
    vibrato.connect(vibratoDepth);
    vibratoDepth.connect(saw.detune);
    vibratoDepth.connect(square.detune);

    const formant = ctx.createBiquadFilter();
    formant.type = 'peaking';
    formant.frequency.setValueAtTime(1300, time);
    formant.Q.setValueAtTime(1.2, time);
    formant.gain.setValueAtTime(6, time);

    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.Q.setValueAtTime(1, time);
    tone.frequency.setValueAtTime(1100, time);
    tone.frequency.linearRampToValueAtTime(2600, time + 0.06);
    tone.frequency.setTargetAtTime(2000, time + 0.08, 0.2);

    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.linearRampToValueAtTime(0.11, time + 0.045);
    amp.gain.setTargetAtTime(0.085, time + 0.06, 0.25);
    amp.gain.setValueAtTime(0.085, end);
    amp.gain.exponentialRampToValueAtTime(0.0001, end + 0.11);

    saw.connect(formant);
    square.connect(squareGain);
    squareGain.connect(formant);
    formant.connect(tone);
    tone.connect(amp);
    amp.connect(g.sax);

    for (const osc of [saw, square, vibrato]) {
      osc.start(time);
      osc.stop(end + 0.15);
    }

    // Breath on the attack.
    this.playNoise(ctx, g.sax, time, 0.15, 'bandpass', 2500, 0.7, 0.03);
  }

  /** One-shot filtered noise burst; the building block of every drum and breath. */
  private playNoise(
    ctx: AudioContext,
    out: AudioNode,
    time: number,
    dur: number,
    type: BiquadFilterType,
    freq: number,
    q: number,
    level: number
  ): void {
    const buffer = this.getNoiseBuffer(ctx);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    // Random offset so consecutive hits don't replay identical noise.
    const offset = Math.random() * Math.max(0, buffer.duration - dur - 0.01);

    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, time);
    filter.Q.setValueAtTime(q, time);

    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.linearRampToValueAtTime(level, time + 0.003);
    amp.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    src.connect(filter);
    filter.connect(amp);
    amp.connect(out);
    src.start(time, offset, dur + 0.02);
    src.stop(time + dur + 0.05);
  }

  // --- Buffers --------------------------------------------------------------

  /** One second of white noise, generated once and reused. */
  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer;
    const length = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  /**
   * Synthetic 2.6s stereo room: decorrelated noise under an exponential decay.
   * Avoids shipping an impulse-response file while still giving the lead and
   * keys the long, lush tail the genre is known for.
   */
  private getImpulse(ctx: AudioContext): AudioBuffer {
    if (this.impulse) return this.impulse;
    const length = Math.floor(ctx.sampleRate * 2.6);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.8);
      }
    }
    this.impulse = buffer;
    return buffer;
  }
}

export const bgm = new MusicEngine();
