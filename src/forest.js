import * as THREE from 'three';
import { MAT, part } from './assets.js';
import { normalizeToHeight } from './scaleTable.js';
import { groundHeightAt } from './world.js';

// Rừng núi: chunk tái dùng + theme theo quãng đường (visual only).
// Vegetation GLB render bằng InstancedMesh (mỗi model 1-2 draws cho mọi slot).
// Quy tắc occlusion: |x| < 4.5 thì cao < 1.2m.
export const THEMES = ['dense', 'rocky', 'mountain', 'cabin', 'river', 'misty'];
const DENSITY = {
  dense: { tree: 1.0, bush: 0.9, grass: 0.7, rock: 0.4, cliff: 0 },
  rocky: { tree: 0.4, bush: 0.4, grass: 0.4, rock: 1.0, cliff: 0.8 },
  mountain: { tree: 0.7, bush: 0.4, grass: 0.4, rock: 0.6, cliff: 0.6 },
  cabin: { tree: 0.5, bush: 0.6, grass: 0.7, rock: 0.4, cliff: 0 },
  river: { tree: 0.7, bush: 0.8, grass: 0.9, rock: 0.6, cliff: 0 },
  misty: { tree: 0.9, bush: 0.7, grass: 0.6, rock: 0.4, cliff: 0.3 },
};
const FOG_TINT = {
  dense: 0x9fd4c0,
  rocky: 0xb8c4c4,
  mountain: 0xa8c8e0,
  cabin: 0xd8c49a,
  river: 0xaed8e0,
  misty: 0xc8d8dc,
};
const FOG_RANGE = {
  dense: [30, 95], rocky: [30, 100], mountain: [40, 160],
  cabin: [30, 95], river: [30, 110], misty: [12, 60],
};
const WRAP = 200;
const DESPAWN_Z = 14;

// Layout data (test được): mọi slot |x|<4.5 phải cao <1.2m.
export const SLOT_PLAN = [
  { id: 'treeA', file: 'tree_pineTallA.glb', count: 10, xs: [6, 8, 11, 13], h: 6, kind: 'tree', th: 12 },
  { id: 'treeB', file: 'tree_pineTallB.glb', count: 8, xs: [7, 9, 12], h: 7, kind: 'tree', th: 14 },
  { id: 'treeC', file: 'tree_oak.glb', count: 6, xs: [6.5, 10], h: 5, kind: 'tree', th: 8 },
  { id: 'bushA', file: 'plant_bushLarge.glb', count: 10, xs: [4.8, 6, 8], h: 1.0, kind: 'bush', th: 1.0 },
  { id: 'bushB', file: 'plant_bushSmall.glb', count: 10, xs: [5, 7], h: 0.6, kind: 'bush', th: 0.6 },
  { id: 'grassA', file: 'grass_large.glb', count: 14, xs: [4.6, 5.5, 7, 9], h: 0.4, kind: 'grass', th: 0.4 },
  { id: 'grassB', file: 'grass_leafs.glb', count: 14, xs: [4.6, 6, 8], h: 0.3, kind: 'grass', th: 0.3 },
  { id: 'rockA', file: 'rock_largeA.glb', count: 8, xs: [5.5, 8, 11], h: 1.4, kind: 'rock', th: 1.5 },
  { id: 'rockB', file: 'rock_smallA.glb', count: 8, xs: [5, 7], h: 0.7, kind: 'rock', th: 0.8 },
  { id: 'cliff', file: 'cliff_rock.glb', count: 6, xs: [13, 16], h: 9, kind: 'cliff', th: 9 },
  { id: 'logs', file: 'log_stack.glb', count: 4, xs: [7.5, 9], h: 1.2, kind: 'camp', th: 1.2 },
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
  return THEMES[Math.floor(distanceM / 250) % THEMES.length];
}

const dummy = new THREE.Object3D();

export function createForest(scene, assets, opts = {}) {
  const group = new THREE.Group();
  scene.add(group);
  const quality = opts.quality || 'MEDIUM';
  const densityScale = quality === 'LOW' ? 0.5 : quality === 'HIGH' ? 1 : 0.75;

  const batches = []; // {imesh, slots: [{z, x, kind, y, s, rot}]}
  const backdrop = []; // {obj, z, span} — núi xa, parallax 0.05
  const BRIDGE_N = 3;
  let bridgeMeshes = [];
  const bridgeZ = [];
  let bridgeK = 1;
  const fogTarget = new THREE.Color(
    scene.fog ? scene.fog.color.getHex() : FOG_TINT.deep,
  );
  let ready = false;
  let theme = 'deep';

  async function loadBatch(e, dir) {
    const base = (import.meta.env && import.meta.env.BASE_URL) || './';
    let model = null;
    try {
      model = await assets.loadModel(`veg-${e.id}`, `${base}assets/${dir}/${e.file}`);
    } catch {
      return; // thiếu file lẻ: bỏ qua loại đó
    }
    // Chuẩn hóa scale nguồn 1 lần (không tin unit gốc), bake vào slot
    let normK = 1;
    try {
      const box = new THREE.Box3().setFromObject(model);
      const h0 = box.getSize(new THREE.Vector3()).y;
      if (h0 > 0 && e.th) normK = e.th / h0;
    } catch {
      normK = 1;
    }
      const prims = [];
      model.traverse((o) => {
        if (o.isMesh) prims.push({ geo: o.geometry, mat: o.material });
      });
      if (!prims.length) return;
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
      batches.push({ imeshes, slots, kind: e.kind, normK });
  }

  const CAMP_PLAN = [
    { id: 'tent', file: 'tent.glb', count: 3, xs: [8], h: 2.2, kind: 'camp' },
    { id: 'campfire', file: 'campfire.glb', count: 3, xs: [6.8], h: 0.6, kind: 'camp' },
  ];

  async function load() {
    for (const e of SLOT_PLAN) await loadBatch(e, 'vegetation');
    for (const e of CAMP_PLAN) await loadBatch(e, 'props');

    // Sông visual 1 bên (ngoài cây), cầu gỗ ngang qua định kỳ
    const water = new THREE.Mesh(new THREE.PlaneGeometry(6, 240), MAT.train);
    water.rotation.x = -Math.PI / 2;
    water.position.set(20, 0.03, -90);
    scene.add(water);
    try {
      const base = (import.meta.env && import.meta.env.BASE_URL) || './';
      const bg = await assets.loadModel('prop-bridge', `${base}assets/props/bridge_wood.glb`);
      try {
        const bb = new THREE.Box3().setFromObject(bg);
        const bh = bb.getSize(new THREE.Vector3()).y;
        if (bh > 0) bridgeK = 1.0 / bh; // mặt cầu cao ~1m
      } catch {
        bridgeK = 1;
      }
      const prims = [];
      bg.traverse((o) => { if (o.isMesh) prims.push({ geo: o.geometry, mat: o.material }); });
      if (prims.length) {
        bridgeMeshes = prims.map((p) => {
          const im = new THREE.InstancedMesh(p.geo, p.mat, BRIDGE_N);
          im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
          im.frustumCulled = false;
          group.add(im);
          return im;
        });
        for (let i = 0; i < BRIDGE_N; i++) bridgeZ.push(-30 - i * 80);
      }
    } catch {
      // Không cầu: sông + đá vẫn ổn
    }

    // Background: núi + đồi xa (vượt tầm fog scene -> fog:false + haze tay, parallax 0.05)
    try {
      const base = (import.meta.env && import.meta.env.BASE_URL) || './';
      const mtn = await assets.loadModel('bg-mountain', `${base}assets/props/mountain.glb`);
      const sky = new THREE.Color(0x9fc8e0);
      const defs = [
        { h: 300, x: -140, z: -300 }, { h: 260, x: 30, z: -320 }, { h: 340, x: 170, z: -280 },
        { h: 90, x: -70, z: -180 }, { h: 110, x: 110, z: -200 },
      ];
      for (const d of defs) {
        const m = mtn.clone(true);
        normalizeToHeight(m, d.h);
        m.traverse((o) => {
          if (o.isMesh) {
            o.material = o.material.clone();
            o.material.fog = false;
            o.material.color.lerp(sky, 0.55);
          }
        });
        m.position.set(d.x, 0, d.z);
        group.add(m);
        backdrop.push({ obj: m, z: d.z, span: 500 });
      }
    } catch {
      // Không núi: trời + fog vẫn ổn
    }
    ready = true;
    applyTheme(theme);
  }

  function applyTheme(name) {
    theme = name;
    if (scene.fog) fogTarget.set(FOG_TINT[name]);
  }

  // Lerp fog mượt (màu + tầm nhìn, tránh cắt cảnh khi đổi theme); test được.
  // Trả về delta lớn nhất của bước này.
  function stepFog(dt) {
    if (!scene.fog) return 0;
    const k = 1 - Math.exp(-2 * dt);
    const c = scene.fog.color;
    const r0 = c.r, g0 = c.g, b0 = c.b, n0 = scene.fog.near, f0 = scene.fog.far;
    c.lerp(fogTarget, k);
    const [tn, tf] = FOG_RANGE[theme] || FOG_RANGE.dense;
    scene.fog.near += (tn - n0) * k;
    scene.fog.far += (tf - f0) * k;
    return Math.max(
      Math.abs(c.r - r0), Math.abs(c.g - g0), Math.abs(c.b - b0),
      Math.abs(scene.fog.near - n0) / 100, Math.abs(scene.fog.far - f0) / 100,
    );
  }

  const forest = {
    load: () => load(),
    isReady: () => ready,
    theme,
    batchCount: () => batches.reduce((n, b) => n + b.imeshes.length, 0),
    stepFog,
    setTheme: (name) => applyTheme(name),
    update(dt, speed, distanceM) {
      const t = themeAt(distanceM);
      if (t !== theme) applyTheme(t);
      stepFog(dt);
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
              dummy.position.set(s.x, groundHeightAt(s.x, s.z), s.z);
              dummy.scale.setScalar(s.s * (b.normK || 1));
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
      for (const b of backdrop) {
        b.z += dz * 0.05; // parallax xa
        if (b.z > -50) b.z -= b.span;
        b.obj.position.z = b.z;
      }
      for (let i = 0; i < BRIDGE_N && bridgeMeshes.length; i++) {
        let z = bridgeZ[i] + dz;
        if (z > DESPAWN_Z) z -= 240;
        bridgeZ[i] = z;
        dummy.position.set(20, groundHeightAt(20, z), z);
        dummy.rotation.set(0, Math.PI / 2, 0);
        dummy.scale.setScalar(bridgeK);
        dummy.updateMatrix();
        for (const im of bridgeMeshes) im.setMatrixAt(i, dummy.matrix);
      }
      if (bridgeMeshes.length) for (const im of bridgeMeshes) im.instanceMatrix.needsUpdate = true;
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
    },
  };

  return forest;
}
