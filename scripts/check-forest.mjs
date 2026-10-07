// Forest/wildlife gates: node scripts/check-forest.mjs
import * as THREE from 'three';

let failures = 0;
function check(name, cond, extra = '') {
  console.log((cond ? 'PASS' : 'FAIL') + ' ' + name + (extra ? ' — ' + extra : ''));
  if (!cond) failures++;
}

const forest = await import('../src/forest.js');
const scale = await import('../src/scaleTable.js');
const world = await import('../src/world.js');
const wild = await import('../src/wildlife.js');

// 1. Scale audit: backdrop + fence minima, mọi entry >0
{
  check('mountain >= 200m', scale.TARGET_HEIGHTS.mountain >= 200);
  check('fence <= 1.5m', scale.TARGET_HEIGHTS.fence <= 1.5);
  const bad = Object.entries(scale.TARGET_HEIGHTS).filter(([, v]) => !(v > 0));
  check('all scale entries positive', bad.length === 0, bad.map(([k]) => k).join(','));
}

// 2. Fog-lerp epsilon: đổi theme, 120 bước không nhảy, hội tụ
{
  const scene = { add() {}, fog: { color: new THREE.Color(0x87ceeb), near: 30, far: 95 } };
  const fo = forest.createForest(scene, null, {});
  fo.setTheme('misty');
  let maxD = 0;
  for (let i = 0; i < 120; i++) maxD = Math.max(maxD, fo.stepFog(0.016));
  check('fog-lerp smooth (<0.05/step incl. range)', maxD < 0.05, 'max ' + maxD.toFixed(4));
  const t = new THREE.Color(0xc8d8dc);
  const c = scene.fog.color;
  const dist = Math.abs(c.r - t.r) + Math.abs(c.g - t.g) + Math.abs(c.b - t.b);
  check('fog converges + misty range closer', dist < 0.1 && scene.fog.far < 95);
}

// 3. Theme rotation hits all 6
{
  const got = new Set([0, 250, 500, 750, 1000, 1250].map((d) => forest.themeAt(d)));
  check('all 6 themes rotate', got.size === 6, [...got].join(','));
}

// 4. Occlusion rule on layout data
{
  check('occlusion rule clean', forest.checkOcclusion().length === 0);
}

// 5. Wildlife spawn bounds with stub assets (no GLB needed)
{
  const mkRoot = () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 1, 0.5)));
    return g;
  };
  const clips = ['Idle', 'Walk', 'Eating'].map((n) => new THREE.AnimationClip(n, 1, []));
  const assets = {
    loadModel: async () => mkRoot(),
    cloneModel: () => mkRoot(),
    getClips: () => clips,
  };
  const wl = wild.createWildlife({ add() {} }, assets, {});
  await wl.load();
  for (let i = 0; i < 4000; i++) wl.update(0.5, 20, 0, 0);
  const bad = wl.spawned.filter((s) => Math.abs(s.x) < 6);
  check('wildlife spawns |x|>=6', wl.spawned.length > 0 && bad.length === 0, wl.spawned.length + ' spawns');
  check('animated capped (MEDIUM<=4)', wl.animatedCount() <= 4);
  wl.reset();
  check('reset balanced', wl.animatedCount() === 0 && wl.activeCount() === 0);
}

// 6. groundHeightAt: phẳng trong làn, gồ ghề ngoài
{
  const g = world.groundHeightAt;
  check('flat in corridor', g(0, -50) === 0 && g(4.5, -50) === 0 && g(-2, -50) === 0);
  const h = g(12, -50);
  check('bumpy outside (|h|<=2)', Math.abs(h) > 0.01 && Math.abs(h) <= 2.1, 'h=' + h.toFixed(2));
}

console.log(failures === 0 ? '\nALL FOREST CHECKS PASS' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
