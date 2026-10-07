import * as THREE from 'three';
import { normalizeToHeight } from './scaleTable.js';
import { groundHeightAt } from './world.js';

// Wildlife visual-only: không va chạm, không vào làn (|x|>=6), không gameplay.
// Mixer: 1/instance đang animate khi cần, cap toàn cục theo quality, pool
// cùng instance (mixer dừng + giải phóng khi recycle).
export const SPECIES = {
  deer: { file: 'deer.glb', height: 1.2, weight: 0.45, clips: { idle: 'Idle', walk: 'Walk', graze: 'Eating' } },
  stag: { file: 'stag.glb', height: 1.3, weight: 0.3, clips: { idle: 'Idle', walk: 'Walk', graze: 'Eating' } },
  fox: { file: 'fox.glb', height: 0.45, weight: 0.17, clips: { idle: 'Idle', walk: 'Walk', graze: 'Eating' } },
  wolf: { file: 'wolf.glb', height: 0.85, weight: 0.08, clips: { idle: 'Idle', walk: 'Walk', graze: 'Eating' } },
};
export const MAX_ANIM = { HIGH: 6, MEDIUM: 4, LOW: 2 };
const POOL_EACH = 3;
const SPAWN_EVERY_S = 7;
const MIN_X = 6;
const DESPAWN_Z = 18;
const SPAWN_Z = -80;

export function pickSpecies(rand = Math.random) {
  const entries = Object.entries(SPECIES);
  const total = entries.reduce((n, [, s]) => n + s.weight, 0);
  let r = rand() * total;
  for (const [name, s] of entries) {
    r -= s.weight;
    if (r <= 0) return name;
  }
  return entries[0][0];
}

export function createWildlife(scene, assets, opts = {}) {
  const quality = opts.quality || 'MEDIUM';
  const rand = opts.random || Math.random;
  const group = new THREE.Group();
  scene.add(group);

  const pools = {}; // species -> [{root, mixer, clips}]
  const active = [];
  const spawned = []; // test hook: {species, x} (giữ 500 mẫu cuối)
  let spawnClock = 0;
  let animated = 0;
  const base = (import.meta.env && import.meta.env.BASE_URL) || './';

  const wl = {
    animatedCount: () => animated,
    activeCount: () => active.length,
    spawned,

    async load() {
      for (const [name, s] of Object.entries(SPECIES)) {
        pools[name] = [];
        let model = null;
        try {
          model = await assets.loadModel(`wild-${name}`, `${base}assets/wildlife/${s.file}`);
        } catch (err) {
          console.warn(`[wildlife] ${name} model failed (${err && err.message}) — species skipped`);
          continue; // thiếu loài: bỏ qua, các loài khác vẫn sống
        }
        for (let i = 0; i < POOL_EACH; i++) {
          const root = assets.cloneModel(`wild-${name}`);
          normalizeToHeight(root, s.height);
          root.visible = false;
          group.add(root);
          pools[name].push({ root, mixer: null, clips: assets.getClips ? assets.getClips(`wild-${name}`) : [] });
        }
      }
    },

    reset() {
      for (const a of active) {
        wl.release(a);
      }
      active.length = 0;
      spawnClock = 0;
    },

    release(a) {
      if (a.mixer) {
        a.mixer.stopAllAction();
        a.mixer = null;
        animated = Math.max(0, animated - 1);
      }
      a.root.visible = false;
      pools[a.species].push(a);
    },

    update(dt, speed, distanceM, time = 0) {
      void distanceM;
      spawnClock += dt;
      const cap = MAX_ANIM[quality] ?? MAX_ANIM.MEDIUM;
      if (spawnClock >= SPAWN_EVERY_S) {
        spawnClock = 0;
        const name = pickSpecies(rand);
        const pool = pools[name];
        if (pool && pool.length) {
          const a = pool.pop();
          const side = rand() < 0.5 ? -1 : 1;
          const sx = side * (MIN_X + rand() * 8);
          const sz = SPAWN_Z - rand() * 10;
          a.root.position.set(sx, groundHeightAt(sx, sz), sz);
          spawned.push({ species: name, x: a.root.position.x });
          if (spawned.length > 500) spawned.shift();
          a.root.rotation.y = side > 0 ? -Math.PI / 2 + (rand() - 0.5) : Math.PI / 2 + (rand() - 0.5);
          a.root.visible = true;
          a.species = name;
          a.mode = rand() < 0.5 ? 'graze' : 'walk';
          a.mixer = null;
          // Mixer riêng khi còn slot cap (ưu tiên gần camera)
          if (animated < cap) {
            const clips = {};
            for (const [k, n] of Object.entries(SPECIES[name].clips)) {
              const c = a.clips.find((x) => x.name === n);
              if (c) clips[k] = c;
            }
            if (!clips.idle || !clips.walk) {
              console.warn(
                `[wildlife] ${name} missing clips, have: ${a.clips.map((c) => c.name).join(',') || '(none)'} — static fallback`,
              );
            }
            if (clips.idle && clips.walk) {
              a.mixer = new THREE.AnimationMixer(a.root);
              animated += 1;
              a.actions = {};
              for (const [k, c] of Object.entries(clips)) a.actions[k] = a.mixer.clipAction(c);
              const first = a.mode === 'walk' ? a.actions.walk : a.actions.graze || a.actions.idle;
              if (first) first.play();
              a.clipsByKind = clips;
            }
          }
          active.push(a);
        }
      }
      for (let i = active.length - 1; i >= 0; i--) {
        const a = active[i];
        a.root.position.z += speed * dt * (a.mode === 'walk' ? 0.92 : 1.0);
        a.root.position.y = groundHeightAt(a.root.position.x, a.root.position.z);
        if (a.mixer && (quality !== 'LOW' || a.root.position.z > -50)) {
          a.mixer.update(dt);
        }
        if (a.root.position.z > DESPAWN_Z) {
          active.splice(i, 1);
          wl.release(a);
        }
      }
      void time;
    },
  };

  return wl;
}
