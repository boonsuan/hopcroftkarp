/**
 * Small synthesized sounds for interactions, made with the Web Audio API
 * (no audio files). Every sound is short, soft, and tuned to a pentatonic
 * scale so that sequences of steps sound like a tune rather than noise.
 * The volume slider and mute button control a master gain; both settings
 * are remembered.
 */

const KEY = 'hk-sound';
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let volume = 0.55;
let muted = false;

try {
  const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
  if (saved && typeof saved.volume === 'number') {
    volume = saved.volume;
    muted = !!saved.muted;
  }
} catch {
  /* ignore unreadable settings */
}

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ volume, muted }));
  } catch {
    /* ignore */
  }
}

function level(): number {
  return muted ? 0 : 0.35 * volume * volume;
}

// Sounds respond to the reader's actions only: nothing plays until the first
// click, tap or key press (widgets that draw themselves on load stay silent).
let armed = false;
const arm = () => { armed = true; };
document.addEventListener('pointerdown', arm, { capture: true });
document.addEventListener('keydown', arm, { capture: true });

/** Lazily create the audio graph; browsers only allow this after a user gesture. */
function audio(): AudioContext | null {
  if (!armed || level() === 0) return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = level();
    // A gentle low-pass keeps everything soft, and a compressor stops quick
    // runs of notes from piling up into something loud.
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 4200;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -18;
    limiter.ratio.value = 4;
    master.connect(lp).connect(limiter).connect(ctx.destination);
    // Let the audio device sleep while the tab is hidden.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) void ctx?.suspend();
    });
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

// A major pentatonic scale around A3..A5.
const SCALE = [220, 247.5, 277.2, 330, 370, 440, 495, 554.4, 660, 740, 880, 990, 1108.7];
const noteFreq = (k: number) => SCALE[Math.max(0, Math.min(SCALE.length - 1, k))];

interface Tone {
  freq: number;
  dur?: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  slideTo?: number;
}

function tone({ freq, dur = 0.18, type = 'sine', gain = 1, delay = 0, slideTo }: Tone): void {
  const ac = audio();
  if (!ac || !master) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const env = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(gain, t0 + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(env).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** A soft wooden tick: for ordinary steps and button presses. */
export function tick(): void {
  tone({ freq: 1320, dur: 0.05, type: 'triangle', gain: 0.25 });
}

/** A marimba-like note; `degree` picks a scale step (higher = brighter). */
export function note(degree: number, gain = 0.6): void {
  const f = noteFreq(degree);
  tone({ freq: f, dur: 0.32, type: 'sine', gain });
  tone({ freq: f * 4, dur: 0.06, type: 'sine', gain: gain * 0.15 });
}

/** Something new was found (a boy discovered, a level added). */
export function discover(level: number): void {
  note(3 + level, 0.45);
}

/** A rising arpeggio: a SAP was completed or a matching was augmented. */
export function success(): void {
  [5, 7, 9, 12].forEach((k, j) => {
    const f = noteFreq(k);
    tone({ freq: f, dur: 0.42, type: 'sine', gain: 0.5, delay: j * 0.07 });
    tone({ freq: f * 2, dur: 0.12, type: 'sine', gain: 0.08, delay: j * 0.07 });
  });
}

/** A short low pluck: an arc to a deleted girl, a root that fails, an illegal move. */
export function blocked(): void {
  tone({ freq: 260, dur: 0.2, type: 'triangle', gain: 0.45, slideTo: 200 });
}

/** A gentle two-note chime: a round or a game finished. */
export function chime(): void {
  tone({ freq: noteFreq(7), dur: 0.7, gain: 0.45 });
  tone({ freq: noteFreq(10), dur: 0.9, gain: 0.35, delay: 0.12 });
}

/** A soft swoosh for sliders and resets. */
export function swoosh(up = true): void {
  tone({ freq: up ? 300 : 700, slideTo: up ? 700 : 300, dur: 0.16, type: 'sine', gain: 0.18 });
}

/** Wire up a mute button and a volume slider. */
export function initSoundControls(button: HTMLButtonElement, slider: HTMLInputElement): void {
  const icon = () => {
    button.setAttribute('aria-label', muted ? 'Unmute sounds' : 'Mute sounds');
    button.title = muted ? 'Sounds off' : 'Sounds on';
    button.querySelector('.on')?.toggleAttribute('hidden', muted || volume === 0);
    button.querySelector('.off')?.toggleAttribute('hidden', !(muted || volume === 0));
  };
  const update = () => {
    if (master && ctx) master.gain.setTargetAtTime(level(), ctx.currentTime, 0.02);
    icon();
    save();
  };
  slider.value = String(Math.round(volume * 100));
  slider.addEventListener('input', () => {
    volume = Number(slider.value) / 100;
    if (volume > 0) muted = false;
    update();
  });
  slider.addEventListener('change', () => tick());
  button.addEventListener('click', () => {
    muted = !muted;
    if (!muted && volume === 0) {
      // Unmuting at zero volume would still be silent: bring the volume back.
      volume = 0.55;
      slider.value = '55';
    }
    update();
    if (!muted) chime();
  });
  icon();
}
