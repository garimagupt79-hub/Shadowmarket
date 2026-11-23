let soundEnabled = true;

export function setSoundEnabled(v: boolean) {
  soundEnabled = v;
}

export function isSoundEnabled() {
  return soundEnabled;
}

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
  }
  return audioCtx;
}

// Crisp cash-register "cha-ching" synthesized via Web Audio API
export function playCashoutSound() {
  if (!soundEnabled) return;
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();

  const now = ctx.currentTime;

  // Two-tone bell: a bright "cha" then a lower "ching"
  const tones = [
    { freq: 1568, start: 0, dur: 0.08, gain: 0.18 },
    { freq: 1318, start: 0.06, dur: 0.12, gain: 0.15 },
    { freq: 2093, start: 0.12, dur: 0.18, gain: 0.12 },
  ];

  for (const t of tones) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(t.freq, now + t.start);
    gain.gain.setValueAtTime(0, now + t.start);
    gain.gain.linearRampToValueAtTime(t.gain, now + t.start + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + t.start + t.dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + t.start);
    osc.stop(now + t.start + t.dur + 0.02);
  }
}
