import * as THREE from 'three';
import { MAT, part } from './assets.js';

// Rừng núi: chunk tái dùng + theme theo quãng đường (visual only).
// Vegetation GLB render bằng InstancedMesh (mỗi model 1-2 draws cho mọi slot).
// Quy tắc occlusion: |x| < 4.5 thì cao < 1.2m.
export const THEMES = ['deep', 'camp', 'cliff', 'meadow'];
const DENSITY = {
  deep: { tree: 1.0, bush: 0.8, grass: 0.6, rock: 0.5, cliff: 0 },
  camp: { tree: 0.5, bush: 0.6, grass: 0.6, rock: 0.4, cliff: 0 },
  cliff: { tree: 0.35, bush: 0.3, grass: 0.3, rock: 0.8, cliff: 1 },
  meadow: { tree: 0.4, bush: 1.0, grass: 1.0, rock: 0.3, cliff: 0 },
};
const FOG_TINT = {
  deep: 0x9fd4c0,
  camp: 0xd8c49a,
  cliff: 0x9db8cc,
  meadow: 0xcfeef7,
};
const WRAP = 200;
const DESPAWN_Z = 14;

// Layout data (test được): mọi slot |x|<4.5 phải cao <1.2m.
export const SLOT_PLAN = [
  { id: 'treeA', file: 'tree_pineTallA.glb', count: 10, xs: [6, 8, 11, 13], h: 6, kind: 'tree' },
  { id: 'treeB', file: 'tree_pineTallB.glb', count: 8, xs: [7, 9, 12], h: 7, kind: 'tree' },
  { id: 'treeC', file: 'tree_oak.glb', count: 6, xs: [6.5, 10], h: 5, kind: 'tree' },
  { id: 'bushA', file: 'plant_bushLarge.glb', count: 10, xs: [4.8, 6, 8], h: 1.0, kind: 'bush' },
  { id: 'bushB', file: 'plant_bushSmall.glb', count: 10, xs: [5, 7], h: 0.6, kind: 'bush' },
  { id: 'grassA', file: 'grass_large.glb', count: 14, xs: [4.6, 5.5, 7, 9], h: 0.4, kind: 'grass' },
  { id: 'grassB', file: 'grass_leafs.glb', count: 14, xs: [4.6, 6, 8], h: 0.3, kind: 'grass' },
  { id: 'rockA', file: 'rock_largeA.glb', count: 8, xs: [5.5, 8, 11], h: 1.4, kind: 'rock' },
  { id: 'rockB', file: 'rock_smallA.glb', count: 8, xs: [5, 7], h: 0.7, kind: 'rock' },
  { id: 'cliff', file: 'cliff_rock.glb', count: 6, xs: [13, 16], h: 9, kind: 'cliff' },
  { id: 'logs', file: 'log_stack.glb', count: 4, xs: [7.5, 9], h: 1.2, kind: 'camp' },
];

export function checkOcclusion(plan = SLOT_PLAN) {
  const bad = [];
  for (const e of plan) {
    for (const x of e.xs) {
      if (Math.abs(x) < 4.5 && e.h >= 1.2) bad.push(`${e.id}@${x} h=${e.h}`);
    }
  }
  return bad;
}

export function themeAt(distanceM) {
  return THEMES[Math.floor(distanceM / 300) % THEMES.length];
}

const dummy = new THREE.Object3D();

export function createForest(scene, assets, opts = {}) {
  const group = new THREE.Group();
  scene.add(group);
  const quality = opts.quality || 'MEDIUM';
  const densityScale = quality === 'LOW' ? 0.5 : quality === 'HIGH' ? 1 : 0.75;

  const batches = []; // {imesh, slots: [{z, x, kind, y, s, rot}]}
  const statics = []; // {obj, z, kind, span, follow?} — cabin camp
  let ready = false;
  let theme = 'deep';

  async function load() {
    const base = (import.meta.env && import.meta.env.BASE_URL) || './';
    for (const e of SLOT_PLAN) {
      let model = null;
      try {
        model = await assets.loadModel(`veg-${e.id}`, `${base}assets/vegetation/${e.file}`);
      } catch {
        continue; // thiếu file lẻ: bỏ qua loại đó
      }
      const prims = [];
      model.traverse((o) => {
        if (o.isMesh) prims.push({ geo: o.geometry, mat: o.material });
      });
      if (!prims.length) continue;
      const imeshes = prims.map(
        (p) => {
          const im = new THREE.InstancedMesh(p.geo, p.mat, e.count);
          im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
          im.frustumCulled = false;
          group.add(im);
          return im;
        },
      );
      const slots = [];
      for (let i = 0; i < e.count; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        slots.push({
          z: 10 - i * (WRAP / e.count),
          x: side * e.xs[i % e.xs.length],
          y: 0,
          s: 0.8 + ((i * 37) % 10) / 25,
          rot: (i * 1.7) % 6.28,
        });
      }
      batches.push({ imeshes, slots, kind: e.kind });
    }
    // Trại gỗ procedural (cabin + mái + đèn + cột)
    const cabin = part(3, 2.4, 3, MAT.houseB, -8.5, 1.2, -40);
    const roof = part(3.6, 0.3, 3.6, MAT.pants, -8.5, 2.55, -40);
    const lamp = part(0.25, 0.25, 0.25, MAT.glow, -6.5, 2.2, -40);
    const pole = part(0.15, 2.2, 0.15, MAT.pants, -6.5, 1.1, -40);
    for (const m of [cabin, roof, lamp, pole]) group.add(m);
    statics.push({ obj: cabin, z: -40 });
    statics.push({ obj: roof, z: -40, follow: cabin });
    statics.push({ obj: lamp, z: -40, follow: cabin });
    statics.push({ obj: pole, z: -40, follow: cabin });
    ready = true;
    applyTheme(theme);
  }

  function applyTheme(name) {
    theme = name;
    if (scene.fog) scene.fog.color.setHex(FOG_TINT[name]);
  }

  const forest = {
    load: () => load(),
    isReady: () => ready,
    theme,
    batchCount: () => batches.reduce((n, b) => n + b.imeshes.length, 0),
    setTheme: (name) => applyTheme(name),
    update(dt, speed, distanceM) {
      const t = themeAt(distanceM);
      if (t !== theme) applyTheme(t);
      if (!ready) return;
      const dz = speed * dt;
      const d = DENSITY[theme];
      for (const b of batches) {
        const w = (d[b.kind] ?? 1) * densityScale;
        for (let i = 0; i < b.slots.length; i++) {
          const s = b.slots[i];
          s.z += dz;
          if (s.z > DESPAWN_Z) s.z -= WRAP;
          const show = w >= 1 || (i % 4) / 4 < w;
          for (const im of b.imeshes) {
            if (show) {
              dummy.position.set(s.x, s.y, s.z);
              dummy.scale.setScalar(s.s);
              dummy.rotation.set(0, s.rot, 0);
            } else {
              dummy.position.set(0, -999, 0);
              dummy.scale.setScalar(0.001);
              dummy.rotation.set(0, 0, 0);
            }
            dummy.updateMatrix();
            im.setMatrixAt(i, dummy.matrix);
          }
        }
        for (const im of b.imeshes) im.instanceMatrix.needsUpdate = true;
      }
      for (const s of statics) {
        if (s.follow) {
          s.obj.position.z = s.follow.position.z;
          continue;
        }
        s.z += dz;
        if (s.z > DESPAWN_Z + 6) s.z -= WRAP;
        s.obj.position.z = s.z;
      }
    },
  };

  return forest;
}
