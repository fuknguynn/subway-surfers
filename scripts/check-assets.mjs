// Asset gate: node scripts/check-assets.mjs
// Mỗi file production: tồn tại, <2MB. Tổng payload <15MB.
// GLB động vật: liệt kê clips (map thủ công sau).
import fs from 'node:fs';
import path from 'node:path';

let failures = 0;
function check(name, cond, extra = '') {
  console.log((cond ? 'PASS' : 'FAIL') + ' ' + name + (extra ? ' — ' + extra : ''));
  if (!cond) failures++;
}

const WANT = [
  'public/assets/wildlife/deer.glb',
  'public/assets/wildlife/stag.glb',
  'public/assets/wildlife/fox.glb',
  'public/assets/wildlife/wolf.glb',
  'public/assets/props/tent.glb',
  'public/assets/props/campfire.glb',
  'public/assets/props/bridge_wood.glb',
  'public/assets/props/mountain.glb',
  'public/assets/props/sign.glb',
  'public/assets/props/flower_red.glb',
  'public/assets/props/flower_yellow.glb',
  'public/assets/props/mushroom_red.glb',
  'public/assets/props/mushroom_tan.glb',
  'public/assets/props/stump_round.glb',
  'public/assets/props/stump_old.glb',
];

function readJsonChunk(p) {
  const buf = fs.readFileSync(p);
  const magic = buf.subarray(0, 4).toString('ascii');
  if (magic === 'glTF') {
    const len = buf.readUInt32LE(12);
    return JSON.parse(buf.subarray(20, 20 + len).toString('utf8'));
  }
  return JSON.parse(buf.toString('utf8')); // .gltf
}

let total = 0;
for (const f of WANT) {
  let ok = false;
  let size = 0;
  try {
    size = fs.statSync(f).size;
    total += size;
    ok = size < 2 * 1024 * 1024;
  } catch {}
  check(`${f} exists <2MB`, ok, size ? (size / 1024).toFixed(1) + 'KB' : 'missing');
}

console.log('wanted payload:', (total / 1048576).toFixed(2) + 'MB');
check('wanted payload <15MB', total < 15 * 1024 * 1024);

for (const a of ['deer', 'stag', 'fox', 'wolf']) {
  const p = `public/assets/wildlife/${a}.glb`;
  try {
    const j = readJsonChunk(p);
    const names = (j.animations || []).map((x) => x.name);
    console.log(`${a} clips (${names.length}):`, names.join(', ') || '(static/none)');
    check(`${a} has ≥1 clip or recorded static`, true);
  } catch {
    check(`${a} clips listed`, false, 'file missing');
  }
}

console.log(failures === 0 ? '\nASSET GATE PASS' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
