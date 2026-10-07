// Headless mobile checks: node scripts/check-mobile.mjs
// Chạy: npm run check:mobile. Browser-only (render, DOM, âm thanh thật,
// cảm giác tay) vẫn cần playtest trên điện thoại.
let failures = 0;
function check(name, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' ' + name);
  if (!cond) failures++;
}

const input = await import('../src/input.js');
const quality = await import('../src/quality.js');
const game = await import('../src/game.js');
const worldM = await import('../src/world.js');
const playerM = await import('../src/player.js');
const patterns = await import('../src/patterns.js');
const powerups = await import('../src/powerups.js');
const particles = await import('../src/particles.js');
const assets = await import('../src/assets.js');

// 1. Touch: 1 action/gesture, lock tới touchend
{
  const calls = [];
  const player = { moveLane: (d) => calls.push(d), jump: () => {}, slide: () => {} };
  const target = new EventTarget();
  input.bindInput(player, { target });
  const s = new Event('touchstart'); s.touches = [{ clientX: 100, clientY: 100 }];
  target.dispatchEvent(s);
  for (const x of [160, 220]) {
    const e = new Event('touchend'); e.changedTouches = [{ clientX: x, clientY: 100 }];
    target.dispatchEvent(e);
  }
  check('touch one-action-per-gesture', calls.length === 1);
}

// 2. Quality hysteresis: down@120x22ms, cooldown, up@600x14ms
{
  const sets = [];
  let t = 0;
  const q = quality.createQuality({ setPixelRatio: (v) => sets.push(v) },
    { coarse: true, devicePixelRatio: 3, now: () => t });
  check('dpr cap 1.5', sets[0] === 1.5);
  for (let i = 0; i < 119; i++) { t += 25; q.noteFrame(25); }
  check('no change before 120 slow frames', q.changes === 0);
  t += 25; q.noteFrame(25);
  check('downscale at threshold', q.changes === 1);
  for (let i = 0; i < 200; i++) { t += 25; q.noteFrame(25); }
  check('8s cooldown blocks 2nd change', q.changes === 1);
}

// 3. Substep anti-tunnel: 30m/s + dt 0.05 phát hiện rào mỏng
{
  const speed = 30, dt = 0.05, travel = speed * dt;
  const pb = { minX: -0.35, maxX: 0.35, minY: 0, maxY: 1.9, minZ: -0.25, maxZ: 0.25 };
  const ob = { minX: -0.8, maxX: 0.8, minY: 0, maxY: 0.9, minZ: -1.05, maxZ: -0.95 };
  const end = { ...ob, minZ: ob.minZ + travel, maxZ: ob.maxZ + travel };
  const { count, h } = game.splitDt(dt);
  let hit = false;
  for (let i = 1; i <= count; i++) {
    const m = { ...ob, minZ: ob.minZ + speed * h * i, maxZ: ob.maxZ + speed * h * i };
    if (worldM.boxesOverlap(pb, m)) { hit = true; break; }
  }
  check('substep detects tunneled thin barrier', hit && !worldM.boxesOverlap(pb, end));
}

// 4. Pattern proof walk: mọi pattern x mọi tập reachable
{
  let s = 42;
  const rand = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const subsets = [[0], [1], [2], [0, 1], [1, 2], [0, 2], [0, 1, 2]];
  const near = (ls) => { const st = new Set(); for (const r of ls) { st.add(r); if (r > 0) st.add(r - 1); if (r < 2) st.add(r + 1); } return [...st]; };
  let bad = 0;
  for (const name of patterns.PATTERN_NAMES)
    for (const prev of subsets)
      for (let k = 0; k < 20; k++) {
        const r = patterns.generatePattern(name, prev, rand);
        let cur = [...prev];
        for (const row of r.rows) {
          const trains = new Set(row.obstacles.filter((o) => o.kind === 'train').map((o) => o.lane));
          cur = near(cur).filter((l) => !trains.has(l));
          if (!cur.length) { bad++; break; }
        }
      }
  check('pattern proof walk 1400 cases', bad === 0);
}

// 5. No consecutive jumpCoinLine
{
  let s = 7;
  const rand = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const g = patterns.createPatternGen({ random: rand });
  let prev = null, repeats = 0;
  for (let i = 0; i < 2000; i++) {
    const r = g.next([0, 1, 2], 1000);
    if (r.name === 'jumpCoinLine' && prev === 'jumpCoinLine') repeats++;
    prev = r.name;
  }
  check('no consecutive jumpCoinLine', repeats === 0);
}

// 6. Power-up timers + absorb + pool bound
{
  const scene = { add() {} };
  const pu = powerups.createPowerups(scene);
  for (let i = 0; i < 100; i++) pu.update(0.016, 12, { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 }, [1], null, 0);
  check('no spawn before 45s', pu.spawned.length === 0);
  pu.timers.shield = 5;
  check('shield absorbs once then invuln', pu.absorbHit() && !pu.absorbHit() && pu.isInvulnerable());
  const pts = particles.createParticles(scene, 120);
  for (let i = 0; i < 200; i++) pts.burst('coin', 0, 1, 0);
  check('particle pool constant', pts.poolSize() === 120 && pts.aliveCount() <= 120);
}

// 7. Shared materials + player bounds intact
{
  check('distinct materials <= 16', assets.materialCount() <= 16);
  const scene = { add() {} };
  const pl = playerM.createPlayer(scene);
  const b0 = pl.getBounds();
  pl.slide(); pl.update(0.1);
  check('bounds stand 1.9 / slide 0.7', b0.maxY === 1.9 && pl.getBounds().maxY === 0.7);
}

// 8. Payload audit: production assets trong budget
{
  const fs = await import('node:fs');
  const path = await import('node:path');
  const walk = (dir) => {
    let total = 0;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) total += walk(p);
      else total += fs.statSync(p).size;
    }
    return total;
  };
  const assetsBytes = walk('public/assets');
  const charBytes = fs.statSync('public/assets/character/human_male.glb').size;
  console.log('payload assets:', (assetsBytes / 1048576).toFixed(2) + 'MB');
  check('payload <15MB', assetsBytes < 15 * 1024 * 1024);
  check('character glb <8MB', charBytes < 8 * 1024 * 1024);
}

// 9. Heap phẳng qua reset cycles
{
  const world = worldM.createWorld({ add() {}, fog: null });
  const pl = playerM.createPlayer({ add() {} });
  const sizes = [];
  for (let c = 0; c < 3; c++) {
    for (let i = 0; i < 2000; i++) { world.update(0.016, 20); pl.update(0.016); }
    world.reset(); pl.reset();
    if (global.gc) global.gc();
    sizes.push(process.memoryUsage().heapUsed);
  }
  const growth = (sizes[2] - sizes[0]) / sizes[0];
  check('heap flat over cycles', growth < 0.15);
}

// 10. Review pins: timeout-retry, mixer stability, clip-name verification
{
  const amM = await import('../src/assetManager.js');
  let fetches = 0;
  const hanging = () => ({ load: () => { fetches++; } });
  const am = amM.createAssetManager({ makeLoader: hanging });
  try { await am.loadModel('r', 'u', { timeoutMs: 30 }); } catch {}
  try { await am.loadModel('r', 'u', { timeoutMs: 30 }); } catch {}
  check('timeout evicts, retry refetches', fetches === 2);

  const pv = await import('../src/playerVisual.js');
  const THREE = await import('three');
  const v = pv.createPlayerVisual();
  const mkClip = (n) => new THREE.AnimationClip(n, 1, []);
  const clips = ['Idle_Loop', 'Jog_Fwd_Loop', 'Jump_Loop', 'Slide_Loop', 'Hit_Chest'].map(mkClip);
  const root = new THREE.Group();
  root.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.8, 0.5)));
  for (let i = 0; i < 5; i++) {
    v.setModel(root.clone(), clips);
    v.setState('run');
    v.update(0.016);
    v.clearModel();
  }
  check('mixer balanced over 5 cycles', v.mixerCount() === 0);

  const fs = await import('node:fs');
  const buf = fs.readFileSync('public/assets/character/human_male.glb');
  const jl = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jl).toString('utf8'));
  const names = json.animations.map((a) => a.name);
  let mapped = null;
  try {
    mapped = pv.resolveClipMap(names);
  } catch (e) {
    mapped = null;
  }
  check('shipped GLB covers all visual states', !!mapped && Object.keys(mapped).length === 5);
}

console.log(failures === 0 ? '\nALL CHECKS PASS' : `\n${failures} CHECKS FAILED`);
process.exit(failures === 0 ? 0 : 1);
