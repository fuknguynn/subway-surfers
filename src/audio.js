// SFX procedural WebAudio: zero asset. Context chỉ tạo sau gesture người dùng.
// Mọi play đều no-op khi chưa unlock / muted / suspended.
const MUTE_KEY = 'subway-mini-muted';

function loadMuted() {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function saveMuted(m) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(MUTE_KEY, m ? '1' : '0');
  } catch {
    // bỏ qua
  }
}

export function createAudio() {
  let ctx = null;
  let muted = loadMuted();

  function ac() {
    if (typeof window === 'undefined') return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    return ctx;
  }

  function tone({ type = 'sine', from = 440, to = 440, dur = 0.15, vol = 0.2, delay = 0 }) {
    if (muted) return;
    const c = ac();
    if (!c || c.state === 'suspended') return;
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  const a = {
    unlock() {
      const c = ac();
      if (c && c.state === 'suspended') c.resume().catch(() => {});
      return !!c;
    },
    isMuted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      saveMuted(muted);
      return muted;
    },
    suspend() {
      if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
    },
    resume() {
      if (ctx && ctx.state === 'suspended' && !muted) ctx.resume().catch(() => {});
    },
    hasContext() {
      return !!ctx;
    },
    coin() {
      tone({ type: 'square', from: 880, to: 1320, dur: 0.12, vol: 0.12 });
    },
    jump() {
      tone({ type: 'sine', from: 300, to: 620, dur: 0.18, vol: 0.15 });
    },
    slide() {
      tone({ type: 'sawtooth', from: 200, to: 90, dur: 0.25, vol: 0.12 });
    },
    hit() {
      tone({ type: 'square', from: 150, to: 55, dur: 0.3, vol: 0.25 });
    },
    click() {
      tone({ type: 'sine', from: 660, to: 660, dur: 0.07, vol: 0.12 });
    },
    power() {
      tone({ type: 'sine', from: 520, to: 1040, dur: 0.25, vol: 0.15 });
      tone({ type: 'sine', from: 780, to: 1560, dur: 0.25, vol: 0.1, delay: 0.08 });
    },
  };

  return a;
}
