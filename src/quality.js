// Quality profiles + adaptive render scale. Graphics only — never touches gameplay.
export const MOBILE_DPR_CAP = 1.5;
export const DESKTOP_DPR_CAP = 2.0;
export const COOLDOWN_MS = 8000;
export const DOWN_AFTER_FRAMES = 120;
export const UP_AFTER_FRAMES = 600;
export const DOWN_FRAME_MS = 22;
export const UP_FRAME_MS = 14;
const SCALE_DOWN = 0.85;
const SCALE_UP = 1.15;
const SCALE_MIN = 0.6;

export function isCoarsePointer() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  );
}

export function createQuality(renderer, opts = {}) {
  const coarse = opts.coarse ?? isCoarsePointer();
  const dpr =
    opts.devicePixelRatio ??
    (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
  const baseDpr = Math.min(dpr, coarse ? MOBILE_DPR_CAP : DESKTOP_DPR_CAP);
  const now = opts.now || (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));

  const q = {
    profile: coarse ? 'MEDIUM' : 'HIGH',
    scale: 1,
    slowFrames: 0,
    fastFrames: 0,
    lastChangeAt: -COOLDOWN_MS, // cho phép adapt ngay từ đầu, cooldown chỉ giữa các lần đổi
    changes: 0, // test hook
    applyDPR() {
      renderer.setPixelRatio(baseDpr * q.scale);
    },
    noteFrame(ms) {
      if (ms > DOWN_FRAME_MS) {
        q.slowFrames += 1;
        q.fastFrames = 0;
      } else if (ms < UP_FRAME_MS) {
        q.fastFrames += 1;
        q.slowFrames = 0;
      } else {
        q.slowFrames = 0;
        q.fastFrames = 0;
      }
      const t = now();
      if (t - q.lastChangeAt < COOLDOWN_MS) return;
      if (q.slowFrames >= DOWN_AFTER_FRAMES && q.scale > SCALE_MIN) {
        q.scale = Math.max(SCALE_MIN, q.scale * SCALE_DOWN);
        q.applyDPR();
        q.lastChangeAt = t;
        q.changes += 1;
        q.slowFrames = 0;
        q.fastFrames = 0;
      } else if (q.fastFrames >= UP_AFTER_FRAMES && q.scale < 1) {
        q.scale = Math.min(1, q.scale * SCALE_UP);
        q.applyDPR();
        q.lastChangeAt = t;
        q.changes += 1;
        q.slowFrames = 0;
        q.fastFrames = 0;
      }
    },
    getScale() {
      return q.scale;
    },
  };

  q.applyDPR();
  return q;
}
