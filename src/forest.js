import * as THREE from 'three';
import { MAT, part, boxGeo } from './assets.js';

// Rừng núi: chunk tái dùng + theme theo quãng đường (visual only).
// Layout data (test được): mọi slot |x|<4.5 phải cao <1.2m.
export const SLOT_PLAN = [
  { id: 'treeA', count: 10, xs: [6, 8, 11, 13], h: 6, kind: 'tree' },
  { id: 'treeB', count: 8, xs: [7, 9, 12], h: 7, kind: 'tree' },
  { id: 'treeC', count: 6, xs: [6.5, 10], h: 5, kind: 'tree' },
  { id: 'bushA', count: 10, xs: [4.8, 6, 8], h: 1.0, kind: 'bush' },
  { id: 'bushB', count: 10, xs: [5, 7], h: 0.6, kind: 'bush' },
  { id: 'grassA', count: 14, xs: [4.6, 5.5, 7, 9], h: 0.4, kind: 'grass' },
  { id: 'grassB', count: 14, xs: [4.6, 6, 8], h: 0.3, kind: 'grass' },
  { id: 'rockA', count: 8, xs: [5.5, 8, 11], h: 1.4, kind: 'rock' },
  { id: 'rockB', count: 8, xs: [5, 7], h: 0.7, kind: 'rock' },
  { id: 'cliff', count: 6, xs: [13, 16], h: 9, kind: 'cliff' },
  { id: 'logs', count: 4, xs: [7.5, 9], h: 1.2, kind: 'camp' },
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

export function themeAt(distanceM) {
  return THEMES[Math.floor(distanceM / 300) % THEMES.length];
}

export function createForest(scene, assets, opts = {}) {
  const group = new THREE.Group();
  scene.add(group);
  const quality = opts.quality || 'MEDIUM';
  const densityScale = quality === 'LOW' ? 0.5 : quality === 'HIGH' ? 1 : 0.75;

  const slots = []; // {obj, z, kind, h, x, span}
  let ready = false;
  let theme = 'deep';

  function addSlot(obj, x, z, kind, h, span = WRAP) {
    obj.position.x = x;
    obj.position.z = z;
    group.add(obj);
    slots.push({ obj, z, kind, h, x, span });
  }

  async function load() {
    const base = (import.meta.env && import.meta.env.BASE_URL) || './';
    const files = {
      treeA: 'tree_pineTallA.glb',
      treeB: 'tree_pineTallB.glb',
      treeC: 'tree_oak.glb',
      bushA: 'plant_bushLarge.glb',
      bushB: 'plant_bushSmall.glb',
      grassA: 'grass_large.glb',
      grassB: 'grass_leafs.glb',
      rockA: 'rock_largeA.glb',
      rockB: 'rock_smallA.glb',
      cliff: 'cliff_rock.glb',
      logs: 'log_stack.glb',
    };
    const loaded = {};
    for (const [id, file] of Object.entries(files)) {
      try {
        loaded[id] = await assets.loadModel(`veg-${id}`, `${base}assets/vegetation/${file}`);
      } catch {
        loaded[id] = null; // thiếu file lẻ: bỏ qua loại đó, rừng vẫn mọc
      }
    }

    const put = (id, count, xs, h, kind, span, y0 = 0, s = 1) => {
      const src = loaded[id];
      if (!src) return;
      for (let i = 0; i < count; i++) {
        const m = assets.cloneModel(`veg-${id}`);
        m.scale.setScalar(s * (0.8 + ((i * 37) % 10) / 25));
        m.position.y = y0;
        m.rotation.y = (i * 1.7) % 6.28;
        const side = i % 2 === 0 ? -1 : 1;
        addSlot(m, side * xs[i % xs.length], 10 - i * (span / count), kind, h, span);
      }
    };

    for (const e of SLOT_PLAN) put(e.id, e.count, e.xs, e.h, e.kind, WRAP);
    const cabin = part(3, 2.4, 3, MAT.houseB, -8.5, 1.2, -40);
    const roof = part(3.6, 0.3, 3.6, MAT.pants, -8.5, 2.55, -40);
    const lamp = part(0.25, 0.25, 0.25, MAT.glow, -6.5, 2.2, -40);
    const pole = part(0.15, 2.2, 0.15, MAT.pants, -6.5, 1.1, -40);
    for (const m of [cabin, roof, lamp, pole]) group.add(m);
    slots.push({ obj: cabin, z: -40, kind: 'camp', h: 2.7, x: -8.5, span: WRAP });
    slots.push({ obj: roof, z: -40, kind: 'camp', h: 0, x: -8.5, span: WRAP, follow: cabin });
    slots.push({ obj: lamp, z: -40, kind: 'camp', h: 0, x: -6.5, span: WRAP, follow: cabin });
    slots.push({ obj: pole, z: -40, kind: 'camp', h: 0, x: -6.5, span: WRAP, follow: cabin });
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
    slots, // test hook: kiểm tra occlusion
    setTheme: (name) => applyTheme(name),
    update(dt, speed, distanceM) {
      const dz = speed * dt;
      const t = themeAt(distanceM);
      if (t !== theme) applyTheme(t);
      if (!ready) return;
      const d = DENSITY[theme];
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i];
        if (s.follow) {
          s.obj.position.z = s.follow.position.z;
          continue;
        }
        s.z += dz;
        if (s.z > DESPAWN_Z) s.z -= s.span;
        s.obj.position.z = s.z;
        const w = (d[s.kind] ?? 1) * densityScale;
        // Ẩn bớt theo density (ổn định theo index, không nhấp nháy)
        s.obj.visible = w >= 1 || (i % 4) / 4 < w;
      }
    },
  };

  return forest;
}
