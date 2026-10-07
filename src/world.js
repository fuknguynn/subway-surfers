import * as THREE from 'three';
import { LANES } from './player.js';
import { MAT, GEO, part, blobShadow } from './assets.js';

const SPAWN_Z = -85;
const DESPAWN_Z = 12;
const ROW_GAP = 20;
const TRAIN_MIN = 8;
const TRAIN_MAX = 14;
const SLEEPER_COUNT = 60;

// Va chạm AABB với độ co để công bằng cho người chơi.
export function boxesOverlap(a, b, shrink = 0.15) {
  return (
    a.minX < b.maxX - shrink &&
    a.maxX > b.minX + shrink &&
    a.minY < b.maxY - shrink &&
    a.maxY > b.minY + shrink &&
    a.minZ < b.maxZ - shrink &&
    a.maxZ > b.minZ + shrink
  );
}

const dummy = new THREE.Object3D(); // tái dùng cho InstancedMesh, không alloc/frame

export function createWorld(scene) {
  scene.fog = new THREE.Fog(0x87ceeb, 30, 95);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(5, 10, 5);
  scene.add(sun);

  // Mặt đất + 3 dải ray (material dùng chung)
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 220),
    MAT.ground,
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -80;
  scene.add(ground);

  for (const x of LANES) {
    const rail = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 220), MAT.road);
    rail.rotation.x = -Math.PI / 2;
    rail.position.set(x, 0.01, -80);
    scene.add(rail);
  }

  // Tà vẹt: 1 InstancedMesh duy nhất
  const sleeperGeo = new THREE.BoxGeometry(7.5, 0.04, 0.5);
  const sleepers = new THREE.InstancedMesh(sleeperGeo, MAT.sleeper, SLEEPER_COUNT);
  const sleeperZ = [];
  for (let i = 0; i < SLEEPER_COUNT; i++) sleeperZ.push(10 - i * 2);
  scene.add(sleepers);

  // Nhà 2 bên: 2 material dùng chung, khác scale
  const houses = [];
  for (let i = 0; i < 24; i++) {
    const h = 2 + (i % 4);
    const house = part(3, 1, 4, i % 2 === 0 ? MAT.houseA : MAT.houseB);
    house.scale.y = h;
    house.position.set(i % 2 === 0 ? -7 : 7, h / 2, 10 - i * 8);
    scene.add(house);
    houses.push(house);
  }

  // Pool obstacle/coin theo loại
  const pools = { low: [], high: [], train: [], coin: [] };
  const active = { obstacles: [], coins: [] };

  function obtain(kind, make) {
    const pooled = pools[kind].pop();
    if (pooled) {
      pooled.visible = true;
      return pooled;
    }
    const mesh = make();
    scene.add(mesh);
    return mesh;
  }

  function release(kind, mesh) {
    mesh.visible = false;
    pools[kind].push(mesh);
  }

  function withBlob(group, scale) {
    const b = blobShadow(scale);
    group.add(b);
    return group;
  }

  const makers = {
    // Rào thấp: nhảy qua (hitbox cao 0.9, visual tương đương)
    low: () => {
      const g = new THREE.Group();
      g.add(part(1.6, 0.9, 0.5, MAT.barrierLow, 0, 0.45, 0));
      g.add(part(0.25, 0.7, 0.54, MAT.glow, -0.4, 0.45, 0)); // chevron
      g.add(part(0.25, 0.7, 0.54, MAT.glow, 0.4, 0.45, 0));
      g.userData.half = { x: 0.8, y: 0.45, z: 0.3 };
      return withBlob(g, 1.6);
    },
    // Rào cao: trượt qua (hitbox đáy y=1.1, đỉnh 2.1)
    high: () => {
      const g = new THREE.Group();
      g.add(part(1.6, 1.0, 0.5, MAT.barrierHigh, 0, 0, 0));
      g.add(part(0.2, 1.0, 0.54, MAT.glow, -0.5, 0, 0));
      g.add(part(0.2, 1.0, 0.54, MAT.glow, 0.5, 0, 0));
      g.userData.half = { x: 0.8, y: 0.5, z: 0.3 };
      g.userData.elevated = 1.1;
      return g;
    },
    // Tàu dài: phải đổi làn (hitbox cao 2.4)
    train: () => {
      const len = TRAIN_MIN + Math.random() * (TRAIN_MAX - TRAIN_MIN);
      const g = new THREE.Group();
      g.add(part(1.7, 2.0, len, MAT.train, 0, 1.0, 0));
      g.add(part(1.5, 0.7, 1.2, MAT.trainDark, 0, 1.9, len / 2 - 0.8)); // cabin
      g.add(part(0.3, 0.3, 0.1, MAT.glow, -0.5, 1.0, len / 2 + 0.01)); // đèn
      g.add(part(0.3, 0.3, 0.1, MAT.glow, 0.5, 1.0, len / 2 + 0.01));
      g.userData.half = { x: 0.85, y: 1.2, z: len / 2 };
      return withBlob(g, 2.2);
    },
    coin: () => {
      const m = new THREE.Mesh(GEO.coin, MAT.coin);
      m.rotation.x = Math.PI / 2;
      return m;
    },
  };

  let distance = 0;
  let lastRowAt = 0;
  let rowId = 0;
  let prevSafe = 1;

  function spawnRow() {
    rowId += 1;
    // Làn an toàn: giữ nguyên hoặc kề làn trước (luôn tới được)
    const options = [prevSafe];
    if (prevSafe > 0) options.push(prevSafe - 1);
    if (prevSafe < 2) options.push(prevSafe + 1);
    const safe = options[Math.floor(Math.random() * options.length)];
    prevSafe = safe;

    for (let lane = 0; lane < 3; lane++) {
      if (lane === safe) continue;
      const r = Math.random();
      const kind = r < 0.4 ? 'low' : r < 0.7 ? 'high' : 'train';
      const m = obtain(kind, makers[kind]);
      m.position.set(LANES[lane], 0, SPAWN_Z);
      m.visible = true;
      m.userData.lane = lane;
      m.userData.row = rowId;
      m.userData.kind = kind;
      active.obstacles.push(m);
    }

    // Hàng xu dọc làn an toàn
    for (let i = 0; i < 5; i++) {
      const c = obtain('coin', makers.coin);
      c.position.set(LANES[safe], 1.0, SPAWN_Z - i * 2);
      c.visible = true;
      active.coins.push(c);
    }
  }

  function boundsOf(m) {
    const h = m.userData.half;
    const y0 = m.position.y + (m.userData.elevated ? m.userData.elevated : 0);
    return {
      minX: m.position.x - h.x,
      maxX: m.position.x + h.x,
      minY: y0,
      maxY: y0 + h.y * 2,
      minZ: m.position.z - h.z,
      maxZ: m.position.z + h.z,
    };
  }

  const world = {
    update(dt, speed) {
      const dz = speed * dt;
      distance += dz;

      for (let i = 0; i < SLEEPER_COUNT; i++) {
        let z = sleeperZ[i] + dz;
        if (z > DESPAWN_Z) z -= 120;
        sleeperZ[i] = z;
        dummy.position.set(0, 0.02, z);
        dummy.updateMatrix();
        sleepers.setMatrixAt(i, dummy.matrix);
      }
      sleepers.instanceMatrix.needsUpdate = true;

      for (const h of houses) {
        h.position.z += dz;
        if (h.position.z > DESPAWN_Z + 6) h.position.z -= 192;
      }

      if (distance - lastRowAt >= ROW_GAP) {
        lastRowAt = distance;
        spawnRow();
      }

      for (let i = active.obstacles.length - 1; i >= 0; i--) {
        const m = active.obstacles[i];
        m.position.z += dz;
        if (m.position.z - m.userData.half.z > DESPAWN_Z) {
          active.obstacles.splice(i, 1);
          release(m.userData.kind, m);
        }
      }
      for (let i = active.coins.length - 1; i >= 0; i--) {
        const c = active.coins[i];
        c.position.z += dz;
        c.rotation.z += dt * 4;
        if (c.position.z > DESPAWN_Z) {
          active.coins.splice(i, 1);
          release('coin', c);
        }
      }
    },

    getObstacles() {
      return active.obstacles;
    },

    getCoins() {
      return active.coins;
    },

    collectCoin(coin) {
      const i = active.coins.indexOf(coin);
      if (i >= 0) {
        active.coins.splice(i, 1);
        release('coin', coin);
      }
    },

    obstacleBounds(m) {
      return boundsOf(m);
    },

    reset() {
      for (const m of active.obstacles) release(m.userData.kind, m);
      for (const c of active.coins) release('coin', c);
      active.obstacles.length = 0;
      active.coins.length = 0;
      distance = 0;
      lastRowAt = 0;
      prevSafe = 1;
    },

    poolSizes() {
      return {
        low: pools.low.length,
        high: pools.high.length,
        train: pools.train.length,
        coin: pools.coin.length,
        activeOb: active.obstacles.length,
        activeCoins: active.coins.length,
      };
    },
  };

  return world;
}
