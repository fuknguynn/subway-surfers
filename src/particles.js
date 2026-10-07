import * as THREE from 'three';

// Pool particle cố định: không alloc trong loop, burst tái dùng slot chết.
const KIND = {
  coin: { color: [1.0, 0.85, 0.3], speed: 3.5, up: 2.5, gravity: -6, life: 0.5, n: 10 },
  land: { color: [0.9, 0.9, 0.9], speed: 2.0, up: 1.0, gravity: -5, life: 0.35, n: 8 },
  hit: { color: [1.0, 0.35, 0.2], speed: 5.0, up: 3.0, gravity: -7, life: 0.6, n: 16 },
};

export function createParticles(scene, budget = 120) {
  const max = budget;
  const pos = new Float32Array(max * 3);
  const col = new Float32Array(max * 3);
  const vel = new Float32Array(max * 3);
  const life = new Float32Array(max);
  const maxLife = new Float32Array(max);
  for (let i = 0; i < max; i++) pos[i * 3 + 1] = -999;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.18, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  let cursor = 0;
  let activeBudget = max;

  const p = {
    setBudget(n) {
      activeBudget = Math.min(max, Math.max(0, n));
      if (activeBudget > 0) cursor = cursor % activeBudget;
      else cursor = 0;
    },
    aliveCount() {
      let c = 0;
      for (let i = 0; i < max; i++) if (life[i] > 0) c++;
      return c;
    },
    poolSize() {
      return max;
    },
    burst(kind, x, y, z) {
      const k = KIND[kind];
      if (!k) return;
      for (let i = 0; i < k.n; i++) {
        const idx = cursor;
        cursor = (cursor + 1) % activeBudget || 0;
        if (activeBudget === 0) return;
        const a = (i / k.n) * Math.PI * 2;
        vel[idx * 3] = Math.cos(a) * k.speed * (0.5 + ((i * 37) % 10) / 20);
        vel[idx * 3 + 1] = k.up * (0.6 + ((i * 53) % 10) / 25);
        vel[idx * 3 + 2] = Math.sin(a) * k.speed * 0.7;
        pos[idx * 3] = x;
        pos[idx * 3 + 1] = y;
        pos[idx * 3 + 2] = z;
        col[idx * 3] = k.color[0];
        col[idx * 3 + 1] = k.color[1];
        col[idx * 3 + 2] = k.color[2];
        life[idx] = k.life;
        maxLife[idx] = k.life;
      }
      geo.attributes.color.needsUpdate = true;
    },
    update(dt) {
      let any = false;
      for (let i = 0; i < max; i++) {
        if (life[i] <= 0) continue;
        any = true;
        life[i] -= dt;
        if (life[i] <= 0) {
          pos[i * 3 + 1] = -999;
          continue;
        }
        vel[i * 3 + 1] += -6 * dt;
        pos[i * 3] += vel[i * 3] * dt;
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        if (pos[i * 3 + 1] < 0.02) {
          pos[i * 3 + 1] = 0.02;
          vel[i * 3 + 1] = 0;
        }
      }
      if (any) geo.attributes.position.needsUpdate = true;
    },
  };

  return p;
}
