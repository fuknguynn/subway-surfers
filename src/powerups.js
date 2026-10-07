import * as THREE from 'three';
import { LANES } from './player.js';
import { MAT, part } from './assets.js';
import { boxesOverlap } from './world.js';

// Magnet hút xu, shield đỡ 1 hit (+1s bất tử), multi x2 điểm.
// Timer chỉ chạy khi game gọi update (playing && !paused) nên tự freeze khi pause.
export const DURATIONS = { magnet: 8, shield: 12, multi: 10 };
export const SPAWN_EVERY_S = 45;
export const MAGNET_RADIUS = 3;
const DESPAWN_Z = 12;
const SPAWN_Z = -85;

function makePickupMesh(kind) {
  const g = new THREE.Group();
  if (kind === 'magnet') {
    g.add(part(0.5, 0.5, 0.2, MAT.barrierHigh, 0, 0, 0));
    g.add(part(0.18, 0.3, 0.22, MAT.shoe, -0.16, -0.35, 0));
    g.add(part(0.18, 0.3, 0.22, MAT.shoe, 0.16, -0.35, 0));
  } else if (kind === 'shield') {
    g.add(part(0.55, 0.7, 0.15, MAT.train, 0, 0, 0));
    g.add(part(0.25, 0.3, 0.17, MAT.glow, 0, 0, 0));
  } else {
    g.add(part(0.5, 0.5, 0.5, MAT.glow, 0, 0, 0));
    g.add(part(0.2, 0.2, 0.52, MAT.coin, 0, 0, 0));
  }
  g.visible = false;
  return g;
}

export function createPowerups(scene) {
  const pool = {
    magnet: [makePickupMesh('magnet')],
    shield: [makePickupMesh('shield')],
    multi: [makePickupMesh('multi')],
  };
  for (const k of Object.keys(pool)) scene.add(pool[k][0]);

  const pu = {
    timers: { magnet: 0, shield: 0, multi: 0 },
    invuln: 0,
    spawnClock: 0,
    spawned: [], // test hook: [{kind, lane}]
    active: [], // {mesh, kind}
    kinds: ['magnet', 'shield', 'multi'],

    reset() {
      pu.timers.magnet = 0;
      pu.timers.shield = 0;
      pu.timers.multi = 0;
      pu.invuln = 0;
      pu.spawnClock = 0;
      for (const a of pu.active) {
        a.mesh.visible = false;
        pool[a.kind].push(a.mesh);
      }
      pu.active.length = 0;
    },

    hasShield() {
      return pu.timers.shield > 0;
    },
    isMagnet() {
      return pu.timers.magnet > 0;
    },
    coinMultiplier() {
      return pu.timers.multi > 0 ? 2 : 1;
    },
    isInvulnerable() {
      return pu.invuln > 0;
    },
    absorbHit() {
      // Trả về true nếu shield đỡ được hit này
      if (pu.timers.shield > 0 && pu.invuln <= 0) {
        pu.timers.shield = 0;
        pu.invuln = 1.0;
        return true;
      }
      return false;
    },

    update(dt, speed, playerBounds, reachable, onPickup, time = 0) {
      // Decay timer (chỉ gọi khi playing && !paused)
      for (const k of pu.kinds) {
        if (pu.timers[k] > 0) pu.timers[k] = Math.max(0, pu.timers[k] - dt);
      }
      if (pu.invuln > 0) pu.invuln = Math.max(0, pu.invuln - dt);

      // Spawn thưa, chỉ trên làn survivable
      pu.spawnClock += dt;
      if (pu.spawnClock >= SPAWN_EVERY_S && reachable.length > 0) {
        pu.spawnClock = 0;
        const kind = pu.kinds[Math.floor(Math.random() * pu.kinds.length)];
        const lane = reachable[Math.floor(Math.random() * reachable.length)];
        const mesh = pool[kind].pop() || makePickupMesh(kind);
        if (!mesh.parent) scene.add(mesh);
        mesh.position.set(LANES[lane], 1.0, SPAWN_Z);
        mesh.visible = true;
        pu.active.push({ mesh, kind });
        pu.spawned.push({ kind, lane });
      }

      // Trôi + nhặt
      for (let i = pu.active.length - 1; i >= 0; i--) {
        const a = pu.active[i];
        a.mesh.position.z += speed * dt;
        a.mesh.position.y = 1.0 + Math.sin(time * 3 + i) * 0.15;
        a.mesh.rotation.y += dt * 2;
        if (a.mesh.position.z > DESPAWN_Z) {
          a.mesh.visible = false;
          pool[a.kind].push(a.mesh);
          pu.active.splice(i, 1);
          continue;
        }
        const p = a.mesh.position;
        const box = {
          minX: p.x - 0.5, maxX: p.x + 0.5,
          minY: p.y - 0.6, maxY: p.y + 0.6,
          minZ: p.z - 0.5, maxZ: p.z + 0.5,
        };
        if (boxesOverlap(playerBounds, box, 0)) {
          pu.timers[a.kind] = DURATIONS[a.kind];
          a.mesh.visible = false;
          pool[a.kind].push(a.mesh);
          pu.active.splice(i, 1);
          if (onPickup) onPickup(a.kind);
        }
      }
    },
  };

  return pu;
}
